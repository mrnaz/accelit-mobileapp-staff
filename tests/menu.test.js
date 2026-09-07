import { describe, it, expect } from 'vitest';
import { visibleMenu, jumpMenu, MENU } from '../app/utils/menu.js';

const keys = (staff) => visibleMenu(staff).map((m) => m.key);

describe('visibleMenu', () => {
    it('shows everything to a sysadmin', () => {
        expect(keys({ sysadmin: true })).toEqual(
            ['clients', 'tickets', 'onboarding', 'address-book'],
        );
    });

    it('honours the two per-staff permission flags', () => {
        expect(keys({
            sysadmin: false,
            permission_assetlist: true,
            permission_addressbook: false,
        })).toEqual(['clients', 'tickets', 'onboarding']);

        expect(keys({
            sysadmin: false,
            permission_assetlist: false,
            permission_addressbook: true,
        })).toEqual(['clients', 'tickets', 'address-book']);
    });

    it('falls back to the ungated entries before the profile loads', () => {
        expect(keys(null)).toEqual(['clients', 'tickets']);
    });

    it('never invents a destination that is not in MENU', () => {
        const all = MENU.map((m) => m.key);

        expect(keys({ sysadmin: true }).every((k) => all.includes(k))).toBe(true);
    });
});

describe('jumpMenu', () => {
    // The Jump-to grid is the only way back to the dashboard on iOS, so it
    // leads with Dashboard; the dashboard's own tiles never include it.
    it('puts Dashboard first, then the visible destinations', () => {
        expect(jumpMenu({ sysadmin: true }).map((m) => m.key)).toEqual(
            ['dashboard', 'clients', 'tickets', 'onboarding', 'address-book'],
        );
        expect(jumpMenu(null).map((m) => m.key)).toEqual(['dashboard', 'clients', 'tickets']);
    });

    it('routes Dashboard to the tabs root', () => {
        expect(jumpMenu(null)[0].href).toBe('/(main)');
    });

    it('keeps Dashboard out of visibleMenu', () => {
        expect(visibleMenu({ sysadmin: true }).some((m) => m.key === 'dashboard')).toBe(false);
    });
});
