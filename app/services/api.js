import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import endpoints from '../constants/endpoints';
import { STORAGE_KEYS, ALL_AUTH_KEYS } from '../constants/storageKeys';
import { isIpRefusal, errorMessage } from '../utils/apiErrors';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://app.accelit.com.au';

// The admin host. These routes are registered inside Route::domain($adminDomain),
// so pointing at the client-portal host returns 404 for every one of them.
const API_ROOT = `${API_BASE_URL}/api`;

class ApiService {
    constructor() {
        this.token = null;
        this.deviceToken = null;
    }

    setToken(token) {
        this.token = token || null;
    }

    setDeviceToken(deviceToken) {
        this.deviceToken = deviceToken || null;
    }

    async restore() {
        const [[, token], [, deviceToken]] = await AsyncStorage.multiGet([
            STORAGE_KEYS.token,
            STORAGE_KEYS.mfaDeviceToken,
        ]);

        this.setToken(token);
        this.setDeviceToken(deviceToken);

        return token;
    }

    async request(path, { method = 'GET', body, query, auth = true } = {}) {
        const url = new URL(`${API_ROOT}/${path}`);

        // Never send a literal "false": several controllers read boolean flags
        // with plain PHP truthiness, where the string "false" is true.
        if (query) {
            Object.entries(query).forEach(([key, value]) => {
                if (value === undefined || value === null || value === '' || value === false) return;
                url.searchParams.append(key, String(value));
            });
        }

        const headers = { Accept: 'application/json' };

        if (body) headers['Content-Type'] = 'application/json';
        if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;
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

        return this.handleFailure(response, parsed);
    }

    async handleFailure(response, body) {
        if (response.status === 401) {
            await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
            this.setToken(null);
            router.replace('/(auth)/login');
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

    checkOtp(otp, rememberDevice) {
        return this.request(endpoints.CHECK_OTP, {
            method: 'POST',
            body: { otp, remember_device: !!rememberDevice },
        });
    }

    switchMfaMethod(method) {
        return this.request(endpoints.SWITCH_MFA_METHOD, {
            method: 'POST',
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

    clientInvoices(id) {
        return this.request(endpoints.INVOICES, { query: { clientId: id } });
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
