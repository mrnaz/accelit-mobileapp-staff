import { describe, it, expect } from 'vitest';
import { visibleTabs } from '../app/utils/clientTabs.js';

const ids = (level, staff) => visibleTabs(level, staff).map((t) => t.id);

describe('visibleTabs', () => {
    it('gives a sysadmin everything at full access', () => {
        expect(ids('full', { sysadmin: true })).toEqual([
            'general', 'contacts', 'tickets', 'assets', 'passwords', 'accounts',
        ]);
    });

    it('hides accounts from ordinary staff, since invoices 403 for them', () => {
        expect(ids('full', { sysadmin: false })).toEqual([
            'general', 'contacts', 'tickets', 'assets', 'passwords',
        ]);
    });

    it('shows three tabs at limited access', () => {
        expect(ids('limited', { sysadmin: false })).toEqual(['general', 'tickets', 'assets']);
    });

    it('shows nothing at none', () => {
        expect(ids('none', { sysadmin: false })).toEqual([]);
    });

    it('gives a sysadmin everything regardless of level', () => {
        expect(ids('limited', { sysadmin: true })).toEqual([
            'general', 'contacts', 'tickets', 'assets', 'passwords', 'accounts',
        ]);
    });

    it('fails closed on an unknown or missing level', () => {
        expect(ids('something-else', { sysadmin: false })).toEqual([]);
        expect(ids(undefined, { sysadmin: false })).toEqual([]);
        expect(ids(null, null)).toEqual([]);
    });
});
