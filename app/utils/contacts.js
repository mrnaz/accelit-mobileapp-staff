// A client contact as the shared person shape, so a row and the contact sheet
// read one client's contacts exactly the way the address book reads
// everyone's. `clientId` stays null: these lists already live on the client's
// own page, so the sheet has nowhere useful to send you.
//
// `key` is the caller's, because the same contact appears in two places at
// once — once as the General tab's primary contact and once in the full list —
// and each needs its own identity.
export function contactPerson(contact, key) {
    return {
        key,
        name: contact?.name || `${contact?.fname || ''} ${contact?.sname || ''}`.trim(),
        subtitle: contact?.position || null,
        phone: contact?.phone || null,
        email: contact?.email || null,
        isClient: false,
        clientId: null,
        clientName: null,
        avatarId: contact?.id ?? null,
        firstName: contact?.fname || '',
    };
}
