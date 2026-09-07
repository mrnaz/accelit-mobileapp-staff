// The four destinations, plus the two backend flags that gate them.
// permission_addressbook and permission_assetlist are the only two gates in the
// whole backend that check anything other than `sysadmin`, so they are the only
// per-staff variation the menu has.
export const MENU = [
    {
        key: 'clients',
        label: 'Clients',
        icon: 'building-o',
        href: '/(main)/clients',
        hint: 'Contacts, tickets, assets and passwords',
    },
    {
        key: 'tickets',
        label: 'Tickets',
        icon: 'ticket',
        href: '/(main)/tickets',
        hint: 'Open work, yours and everyone’s',
    },
    {
        key: 'onboarding',
        label: 'Asset Onboarding',
        icon: 'laptop',
        href: '/(main)/onboarding',
        hint: 'Look up a machine and its local admin password',
        requires: 'assetlist',
    },
    {
        key: 'address-book',
        label: 'Address Book',
        icon: 'address-book-o',
        href: '/(main)/address-book',
        hint: 'Everyone, with one tap to call',
        requires: 'addressbook',
    },
];

// The dashboard itself. It is not a MENU entry: the dashboard's tiles and stat
// requests iterate visibleMenu, and a tile for the screen you are on is noise.
// The Jump-to grid adds it in front, because on iOS that grid is the only way
// back — the tabs have no bar, and there is no back gesture out of a tab.
export const HOME = {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'home',
    href: '/(main)',
    hint: 'Your tickets and the numbers',
};

export function jumpMenu(staff) {
    return [HOME, ...visibleMenu(staff)];
}

export function visibleMenu(staff) {
    if (!staff) return MENU.filter((item) => !item.requires);

    return MENU.filter((item) => {
        if (!item.requires) return true;
        if (staff.sysadmin) return true;
        if (item.requires === 'assetlist') return !!staff.permission_assetlist;
        if (item.requires === 'addressbook') return !!staff.permission_addressbook;

        return false;
    });
}
