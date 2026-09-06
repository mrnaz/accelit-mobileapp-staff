import { describe, it, expect } from 'vitest';
import { groupByClient, machineMeta } from '../app/utils/onboarding.js';

describe('groupByClient', () => {
    it('groups stably in first-seen order', () => {
        const rows = [
            { id: 1, client_name: 'Accolade Screens' },
            { id: 2, client_name: 'Drainpro' },
            { id: 3, client_name: 'Accolade Screens' },
        ];

        expect(groupByClient(rows).map((g) => [g.client, g.items.map((r) => r.id)]))
            .toEqual([['Accolade Screens', [1, 3]], ['Drainpro', [2]]]);
    });

    it('labels a missing client', () => {
        expect(groupByClient([{ id: 1 }])[0].client).toBe('No client');
    });
});

describe('machineMeta', () => {
    it('mentions the old name when there was one', () => {
        expect(machineMeta({ prev_computername: 'OLD-PC', created_at: '2026-08-15' })).toBe('was OLD-PC · 15 Aug 2026');
        expect(machineMeta({ prev_computername: null, created_at: '2026-08-15' })).toBe('15 Aug 2026');
    });
});
