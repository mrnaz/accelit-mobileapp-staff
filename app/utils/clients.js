// The client row's meta line: suburb, then the open-ticket count (omitted at
// zero — a client with nothing open does not need "0 open tickets"), then
// "Inactive" for a client whose status is not active. '—' when there is
// nothing to show at all.
export function clientMeta(client) {
    const open = Number(client?.open_tickets) || 0;

    return [
        client?.primary_site?.address?.suburbcity,
        open > 0 ? `${open} open ${open === 1 ? 'ticket' : 'tickets'}` : null,
        client?.status === 'inactive' ? 'Inactive' : null,
    ].filter(Boolean).join(' · ') || '—';
}
