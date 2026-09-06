import { shortDate } from './datetime';

// Splits the onboarding rows into per-client groups in first-seen order, the
// way the screen wants to render a `SectionLabel` above each client's
// machines without re-sorting the underlying list.
export function groupByClient(rows) {
    const groups = [];
    const index = new Map();

    (rows || []).forEach((row) => {
        const client = row?.client_name || 'No client';

        if (!index.has(client)) {
            index.set(client, groups.length);
            groups.push({ client, items: [] });
        }

        groups[index.get(client)].items.push(row);
    });

    return groups;
}

// "was OLD-PC · 15 Aug 2026", with the "was" clause omitted when the machine
// was never renamed.
export function machineMeta(row) {
    return [
        row?.prev_computername ? `was ${row.prev_computername}` : null,
        shortDate(row?.created_at),
    ].filter(Boolean).join(' · ');
}
