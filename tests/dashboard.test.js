import { describe, it, expect } from 'vitest';
import { onboardedThisMonth, statLine } from '../app/utils/dashboard.js';

const now = new Date('2026-09-06T10:00:00+10:00');

describe('onboardedThisMonth', () => {
    it('counts only this calendar month', () => {
        const rows = [
            { created_at: '2026-09-01 09:00:00+10' },
            { created_at: '2026-08-31 23:00:00+10' },
            { created_at: '2026-09-06T09:00:00+10:00' },
        ];

        expect(onboardedThisMonth(rows, now)).toBe(2);
    });

    it('ignores unparseable dates', () => {
        expect(onboardedThisMonth([{ created_at: null }, { created_at: 'x' }], now)).toBe(0);
    });
});

describe('statLine', () => {
    it('words each stat', () => {
        const stats = { activeClients: 41, openTickets: 80, yourTickets: 3, machinesThisMonth: 1, contacts: 212 };

        expect(statLine('clients', stats)).toBe('41 active');
        expect(statLine('tickets', stats)).toBe('80 open · 3 yours');
        expect(statLine('onboarding', stats)).toBe('1 machine this month');
        expect(statLine('address-book', stats)).toBe('212 contacts');
    });

    it('is null until the stat has loaded', () => {
        expect(statLine('clients', {})).toBeNull();
        expect(statLine('tickets', { openTickets: 4 })).toBeNull();
    });
});
