import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import endpoints from '../constants/endpoints';
import { STORAGE_KEYS, ALL_AUTH_KEYS } from '../constants/storageKeys';
import { isIpRefusal, errorMessage } from '../utils/apiErrors';
import { onSessionEnded } from '../utils/contactSync';
import * as session from './session';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://app.accelit.online';

// The admin host. These routes are registered inside Route::domain($adminDomain),
// so pointing at the client-portal host returns 404 for every one of them.
const API_ROOT = `${API_BASE_URL}/api`;

// Tells /login and /check-otp this is the staff app, which gets its own kind
// of token: a year-long session that a web sign-in leaves alone, plus an
// address-book-only token for contact sync. Every other route ignores it.
export const CLIENT_HEADER = { 'X-Accel-Client': 'staff-app' };

class ApiService {
    constructor() {
        // The stub from POST /login when MFA is on. It can only exchange a
        // code, so it lives here in memory and nowhere else. The session token
        // is session.js's.
        this.otpToken = null;
        this.deviceToken = null;
    }

    setOtpToken(otpToken) {
        this.otpToken = otpToken || null;
    }

    setDeviceToken(deviceToken) {
        this.deviceToken = deviceToken || null;
    }

    // The remembered-device token only matters to POST /login, so the sign-in
    // screen loads it before offering the form.
    async loadDeviceToken() {
        this.setDeviceToken(await AsyncStorage.getItem(STORAGE_KEYS.mfaDeviceToken));
    }

    // `auth` says whether the request carries a credential at all; `otp` says
    // which one. The OTP stub can only exchange a code, so it goes with the
    // two requests that exist for that and nowhere else. Every other request
    // carries the session's token even if a stale stub is still in memory:
    // a back gesture out of the code step leaves one behind, and letting it
    // win would send the stub (a 403) for every request after the next unlock.
    async request(path, { method = 'GET', body, query, auth = true, otp = false } = {}) {
        const url = new URL(`${API_ROOT}/${path}`);

        // Never send a literal "false": several controllers read boolean flags
        // with plain PHP truthiness, where the string "false" is true.
        if (query) {
            Object.entries(query).forEach(([key, value]) => {
                if (value === undefined || value === null || value === '' || value === false) return;
                url.searchParams.append(key, String(value));
            });
        }

        const headers = { Accept: 'application/json', ...CLIENT_HEADER };
        const bearer = auth ? (otp ? this.otpToken : session.currentToken()) : null;

        if (body) headers['Content-Type'] = 'application/json';
        if (bearer) headers.Authorization = `Bearer ${bearer}`;
        if (this.deviceToken) headers['X-MFA-Device-Token'] = this.deviceToken;

        let response;

        try {
            response = await fetch(url.toString(), {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
        } catch (networkError) {
            const error = new Error('Could not reach the server. Check the VPN connection.');
            error.status = 0;
            error.isNetwork = true;
            throw error;
        }

        const text = await response.text();
        let parsed = null;

        if (text) {
            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = null;
            }
        }

        if (response.ok) return parsed;

        // Which credential this request chose, not which ones exist right now.
        return this.handleFailure(response, parsed, {
            sentSession: !otp && !!bearer,
            sentStub: otp && !!bearer,
        });
    }

    // Only a 401 on a request that carried a token means that token is dead.
    // The login route answers a wrong password with 401 as well, and bouncing
    // to the login screen on that remounts the form and loses the error before
    // anyone reads it.
    async handleFailure(response, body, { sentSession = false, sentStub = false } = {}) {
        if (response.status === 401 && (sentSession || sentStub)) {
            await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
            this.setOtpToken(null);

            if (sentSession) {
                // Expired or revoked. The stored copy is as dead as this one,
                // so it goes too, or every open would ask for Face ID for it.
                await session.end();
                // Not signed out: the worker loses its token, the phone keeps
                // the contacts it already has.
                await onSessionEnded({ explicit: false });
            }

            router.replace(sentSession ? '/(auth)/login?reason=expired' : '/(auth)/login');
        }

        // Off the VPN. Sending the user to the login screen would have them
        // retyping a password that cannot succeed from where they are standing.
        if (response.status === 403 && isIpRefusal(body)) {
            router.replace('/(auth)/vpn');
        }

        const error = new Error(errorMessage(body, `Request failed (${response.status})`));
        error.status = response.status;
        error.body = body;
        throw error;
    }

    // ─── Auth ───────────────────────────────────────────────────────────────
    ipCheck() {
        return this.request(endpoints.LOGIN_IP_CHECK, { auth: false });
    }

    login(email, password) {
        return this.request(endpoints.LOGIN, {
            method: 'POST',
            auth: false,
            body: { email, password },
        });
    }

    checkOtp(code, rememberDevice) {
        return this.request(endpoints.CHECK_OTP, {
            method: 'POST',
            otp: true,
            body: { otp: code, remember_device: !!rememberDevice },
        });
    }

    switchMfaMethod(method) {
        return this.request(endpoints.SWITCH_MFA_METHOD, {
            method: 'POST',
            otp: true,
            body: { method },
        });
    }

    logout() {
        return this.request(endpoints.LOGOUT, { method: 'POST' });
    }

    // Returns a bare object, not {data: ...} — the controller unwraps it.
    me() {
        return this.request(endpoints.ME);
    }

    // ─── Clients ────────────────────────────────────────────────────────────
    // Returns a BARE ARRAY. No pagination, and `search` is accepted but ignored
    // server-side, so the list screen filters locally the way the web SPA does.
    clients(filter) {
        return this.request(endpoints.CLIENTS, { query: { filter } });
    }

    client(id) {
        return this.request(endpoints.CLIENT(id));
    }

    clientAccessLevel(id) {
        return this.request(endpoints.CLIENT_ACCESS_LEVEL(id));
    }

    clientContacts(id) {
        return this.request(endpoints.CLIENT_CONTACTS(id));
    }

    clientSites(id) {
        return this.request(endpoints.CLIENT_SITES(id));
    }

    clientTickets(id, { completed, search, page = 1, limit = 50 } = {}) {
        return this.request(endpoints.CLIENT_TICKETS(id), {
            query: { completed: completed ? 'true' : undefined, search, page, limit },
        });
    }

    // Scoped by the client_id QUERY param — the path segment on the
    // clients/{client}/assets route is ignored by the controller.
    clientAssets(id, { search, page = 1, limit = 50 } = {}) {
        return this.request(endpoints.CLIENT_ASSETS, {
            query: { client_id: id, search, page, limit },
        });
    }

    clientPasswords(id) {
        return this.request(endpoints.CLIENT_PASSWORDS(id));
    }

    clientPassword(id, passwordId) {
        return this.request(endpoints.CLIENT_PASSWORD(id, passwordId));
    }

    // Returns {invoices: [...], total: n}, newest issued first. Honours
    // limit/page; `total` is the count for the whole client.
    clientInvoices(id, { page = 1, limit = 50 } = {}) {
        return this.request(endpoints.INVOICES, { query: { clientId: id, page, limit } });
    }

    // ─── Tickets ────────────────────────────────────────────────────────────
    // Returns {tickets: [...], total: n}. Honours limit/page/search/completed.
    tickets({ completed, search, page = 1, limit = 50, globalList } = {}) {
        return this.request(endpoints.TICKETS, {
            query: {
                completed: completed ? 'true' : undefined,
                global_list: globalList ? 'true' : undefined,
                search,
                page,
                limit,
            },
        });
    }

    ticket(id) {
        return this.request(endpoints.TICKET(id));
    }

    // ─── Everything else ────────────────────────────────────────────────────
    assetOnboarding() {
        return this.request(endpoints.ASSET_ONBOARDING);
    }

    addressBook() {
        return this.request(endpoints.ADDRESS_BOOK);
    }
}

const api = new ApiService();

export default api;
