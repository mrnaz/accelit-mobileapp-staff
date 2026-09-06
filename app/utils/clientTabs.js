export const ALL_TABS = [
    { id: 'general', label: 'General', icon: 'person-outline' },
    { id: 'contacts', label: 'Contacts', icon: 'people-outline' },
    { id: 'tickets', label: 'Tickets', icon: 'ticket-outline' },
    { id: 'assets', label: 'Assets', icon: 'laptop-outline' },
    { id: 'passwords', label: 'Passwords', icon: 'key-outline' },
    { id: 'accounts', label: 'Accounts', icon: 'receipt-outline' },
];

// What the web client page shows at access level 'limited'.
const LIMITED = ['general', 'tickets', 'assets'];

// Accounts reads GET /api/invoices, whose manage-client-account gate is
// `$user->sysadmin` and nothing else — a non-sysadmin gets a hard 403, so the
// tab is hidden rather than shown and then failing.
const SYSADMIN_ONLY = ['accounts'];

// Presentation only. Several of the endpoints behind these tabs have no
// server-side authorization at all (passwords especially), so this decides what
// is worth drawing — it is not a security boundary, and the app must not offer
// any other route to the same data.
export function visibleTabs(accessLevel, staff) {
    const sysadmin = !!staff?.sysadmin;
    const allowed = (tab) => !SYSADMIN_ONLY.includes(tab.id) || sysadmin;

    if (sysadmin) return ALL_TABS;

    if (accessLevel === 'full') return ALL_TABS.filter(allowed);

    if (accessLevel === 'limited') {
        return ALL_TABS.filter((tab) => LIMITED.includes(tab.id)).filter(allowed);
    }

    // 'none', undefined, or anything unrecognised — fail closed.
    return [];
}
