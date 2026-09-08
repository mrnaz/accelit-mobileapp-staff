// GET /api/address-book interleaves three row types. Everything the screen
// and the sheet need to know about a row is decided here, once.
export function toPerson(row) {
    const isClient = row?.type === 'client';
    const subtitle = isClient ? 'Main line' : (row?.client_name || 'General contact');

    return {
        name: row?.displayname || '',
        subtitle,
        phone: row?.phone || null,
        email: row?.email || null,
        isClient,
        clientId: row?.client_id ?? null,
        clientName: row?.client_name || null,
        avatarId: row?.contact_id ?? row?.client_id ?? null,
    };
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
