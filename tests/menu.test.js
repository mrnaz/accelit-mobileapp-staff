import { describe, it, expect } from 'vitest';
import { visibleMenu, MENU } from '../app/utils/menu.js';

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
