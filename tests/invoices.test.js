import { describe, it, expect } from 'vitest';
import { invoiceStatus, money, mergeInvoices, arrearsFor } from '../app/utils/invoices.js';

const now = new Date('2026-09-06T10:00:00+10:00');

describe('invoiceStatus', () => {
    it('reports a paid invoice with its date', () => {
        expect(invoiceStatus({ paid: '2026-08-03', due: '2026-08-31' }, now))
            .toEqual({ label: 'Paid 3 Aug 2026', tone: 'success' });
    });

    it('reports a voided invoice', () => {
        expect(invoiceStatus({ voided: '2026-08-03', due: '2026-08-31' }, now))
            .toEqual({ label: 'Voided', tone: 'muted' });
    });

    it('reports an unpaid invoice as overdue or due', () => {
        expect(invoiceStatus({ due: '2026-08-31' }, now)).toEqual({ label: 'Overdue · 31 Aug 2026', tone: 'error' });
        expect(invoiceStatus({ due: '2026-09-30' }, now)).toEqual({ label: 'Due 30 Sep 2026', tone: 'muted' });
        expect(invoiceStatus({ due: '2026-09-06' }, now)).toEqual({ label: 'Due 6 Sep 2026', tone: 'muted' });
    });

    it('copes with a missing due date', () => {
        expect(invoiceStatus({}, now)).toEqual({ label: 'Due no date', tone: 'muted' });
    });

    it('treats a boolean paid flag as paid without a date', () => {
        expect(invoiceStatus({ paid: true }, now)).toEqual({ label: 'Paid', tone: 'success' });
    });
});

describe('money', () => {
    it('formats as Australian dollars', () => {
        expect(money(1320)).toBe('$1,320.00');
        expect(money('abc')).toBe('—');
    });
});

describe('mergeInvoices', () => {
    it('appends the next page after what is loaded', () => {
        const merged = mergeInvoices([{ invoice_id: 1 }, { invoice_id: 2 }], [{ invoice_id: 3 }]);

        expect(merged.map((i) => i.invoice_id)).toEqual([1, 2, 3]);
    });

    it('drops a row the next page repeats, as when an invoice lands between requests', () => {
        const merged = mergeInvoices([{ invoice_id: 1 }, { invoice_id: 2 }], [{ invoice_id: 2 }, { invoice_id: 3 }]);

        expect(merged.map((i) => i.invoice_id)).toEqual([1, 2, 3]);
    });

    it('starts from nothing', () => {
        expect(mergeInvoices(null, [{ invoice_id: 9 }])).toEqual([{ invoice_id: 9 }]);
        expect(mergeInvoices([{ invoice_id: 9 }], null)).toEqual([{ invoice_id: 9 }]);
    });
});

describe('arrearsFor', () => {
    // GET /api/clients carries each client's arrears for a sysadmin — the
    // same figure the web client list shows.
    const clients = [
        { id: 1, arrears_invoices: 2, arrears_amount: '480.50' },
        { id: 2, arrears_invoices: null, arrears_amount: null },
        { id: 3 },
    ];

    it('picks the client by id, as a number', () => {
        expect(arrearsFor(clients, '1')).toBe(480.5);
    });

    it('reads no overdue invoices as zero', () => {
        expect(arrearsFor(clients, 2)).toBe(0);
    });

    it('is null when the row has no figure or the client is not listed', () => {
        expect(arrearsFor(clients, 3)).toBeNull();
        expect(arrearsFor(clients, 9)).toBeNull();
        expect(arrearsFor(null, 1)).toBeNull();
    });
});
