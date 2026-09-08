import moment from 'moment';
import { shortDate, parseApiDate } from './datetime';

export const money = (value) => {
    const n = Number(value);

    return Number.isFinite(n)
        ? n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })
        : '—';
};

export const isOutstanding = (invoice) => !invoice?.paid && !invoice?.voided;

// One line of status per invoice row. `paid` is a date when the backend has
// one and a plain flag otherwise, so the date is added only when it parses.
// `now` is injectable so tests can pin the clock.
export function invoiceStatus(invoice, now = new Date()) {
    if (invoice?.voided) return { label: 'Voided', tone: 'muted' };

    if (invoice?.paid) {
        const on = shortDate(invoice.paid);

        return { label: on ? `Paid ${on}` : 'Paid', tone: 'success' };
    }

    const due = parseApiDate(invoice?.due);
    const overdue = due ? due.isBefore(moment(now), 'day') : false;

    return overdue
        ? { label: `Overdue · ${shortDate(invoice.due)}`, tone: 'error' }
        : { label: `Due ${shortDate(invoice?.due) || 'no date'}`, tone: 'muted' };
}

// The next page appended to what is already loaded. A row that appears twice
// — an invoice raised between two requests shifts the pages under it — is
// kept once, in the position it first had.
export function mergeInvoices(existing, incoming) {
    const seen = new Set((existing || []).map((invoice) => String(invoice.invoice_id)));
    const fresh = (incoming || []).filter((invoice) => !seen.has(String(invoice.invoice_id)));

    return [...(existing || []), ...fresh];
}

// The client's arrears off the GET /api/clients rows: how much is unpaid and
// past due. The key is present only for a sysadmin, and null when nothing is
// overdue. The row's `arrears_invoices` is left alone: the backend counts
// line items there, not invoices, so it disagrees with the list below it.
export function arrearsFor(clients, clientId) {
    const row = (clients || []).find((c) => String(c?.id) === String(clientId));

    if (!row || !('arrears_amount' in row)) return null;

    return Number(row.arrears_amount) || 0;
}
