// Paths on the existing Accel admin API, relative to `${EXPO_PUBLIC_API_URL}/api`.
// The app makes no backend changes, so every path here is one the web admin
// already calls. See docs/api-contract.md for each one's response shape.
export default {
    LOGIN_IP_CHECK: 'login-ip-check',
    LOGIN: 'login',
    CHECK_OTP: 'check-otp',
    SWITCH_MFA_METHOD: 'switch-mfa-method',
    LOGOUT: 'logout',
    ME: 'me',

    CLIENTS: 'clients',
    CLIENT: (id) => `clients/${id}`,
    CLIENT_ACCESS_LEVEL: (id) => `clients/${id}/access-level`,
    CLIENT_CONTACTS: (id) => `clients/${id}/contacts`,
    CLIENT_SITES: (id) => `clients/${id}/sites`,
    CLIENT_TICKETS: (id) => `clients/${id}/tickets`,
    // NOTE: the {client} segment is ignored by the controller — only the
    // client_id QUERY parameter scopes this. See gap 5 in the contract.
    CLIENT_ASSETS: 'assets',
    CLIENT_PASSWORDS: (id) => `clients/${id}/passwords`,
    CLIENT_PASSWORD: (id, passwordId) => `clients/${id}/passwords/${passwordId}`,

    TICKETS: 'tickets',
    TICKET: (id) => `tickets/${id}`,

    ASSET_ONBOARDING: 'assets/onboarding',
    ADDRESS_BOOK: 'address-book',
    INVOICES: 'invoices',
};
