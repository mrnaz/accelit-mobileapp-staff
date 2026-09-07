// GET /api/address-book interleaves three row types. Everything the screen
// and the sheet need to know about a row is decided here, once.
export function toPerson(row) {
    const isClient = row?.type === 'client';
    const subtitle = isClient ? 'Main line' : (row?.client_name || 'General contact');

    return {
        key: recentKey(row),
        name: row?.displayname || '',
        subtitle,
        phone: row?.phone || null,
        email: row?.email || null,
        isClient,
        clientId: row?.client_id ?? null,
        clientName: row?.client_name || null,
        avatarId: row?.contact_id ?? row?.client_id ?? null,
        // The recents strip shows a first name only for someone you would
        // call by it. A client is a company and a general contact is a desk
        // ("Vendor Support"), so both keep their full name.
        firstName: row?.type === 'client_contact'
            ? (row?.fname || row?.displayname || '')
            : (row?.displayname || ''),
    };
}

export function recentKey(row) {
    return `${row?.type}-${row?.contact_id ?? row?.client_id}`;
}

export function bumpRecent(keys, key, max = 8) {
    return [key, ...(keys || []).filter((k) => k !== key)].slice(0, max);
}

const letterOf = (name) => {
    const first = String(name || '').trim().charAt(0).toUpperCase();

    return /[A-Z]/.test(first) ? first : '#';
};

// The API already sorts by displayname, so grouping keeps that order.
export function sectionize(rows) {
    const sections = [];

    (rows || []).forEach((row) => {
        const title = letterOf(row.displayname);
        const last = sections[sections.length - 1];

        if (last && last.title === title) last.data.push(row);
        else sections.push({ title, data: [row] });
    });

    return sections;
}

export function matches(row, term) {
    const haystack = `${row?.displayname || ''} ${row?.client_name || ''} ${row?.email || ''} ${row?.phone || ''}`;

    return haystack.toLowerCase().includes(String(term || '').toLowerCase());
}
