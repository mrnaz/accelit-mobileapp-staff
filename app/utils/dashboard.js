import { parseApiDate } from './datetime';

export function onboardedThisMonth(rows, now = new Date()) {
    const month = now.getMonth();
    const year = now.getFullYear();

    return (rows || []).filter((row) => {
        const parsed = parseApiDate(row?.created_at);

        return parsed && parsed.month() === month && parsed.year() === year;
    }).length;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One line under each launcher tile. Null until every number it needs is in,
// so a tile shows its label alone rather than a half-sentence.
export function statLine(key, stats = {}) {
    const has = (...names) => names.every((name) => Number.isFinite(stats[name]));

    switch (key) {
        case 'clients':
            return has('activeClients') ? `${stats.activeClients} active` : null;
        case 'tickets':
            return has('openTickets', 'yourTickets') ? `${stats.openTickets} open · ${stats.yourTickets} yours` : null;
        case 'onboarding':
            return has('machinesThisMonth') ? `${plural(stats.machinesThisMonth, 'machine', 'machines')} this month` : null;
        case 'address-book':
            return has('contacts') ? plural(stats.contacts, 'contact', 'contacts') : null;
        default:
            return null;
    }
}
