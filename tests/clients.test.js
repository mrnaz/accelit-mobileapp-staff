import { describe, it, expect } from 'vitest';
import { clientMeta } from '../app/utils/clients.js';

const at = (suburb) => ({ primary_site: { address: { suburbcity: suburb } } });

describe('clientMeta', () => {
    it('shows suburb and open tickets', () => {
        expect(clientMeta({ ...at('Cheltenham'), open_tickets: 2 })).toBe('Cheltenham · 2 open tickets');
        expect(clientMeta({ ...at('Braeside'), open_tickets: 1 })).toBe('Braeside · 1 open ticket');
    });

    it('drops the ticket part at zero and flags inactive', () => {
        expect(clientMeta({ ...at('Clayton'), open_tickets: 0 })).toBe('Clayton');
        expect(clientMeta({ ...at('Clayton'), open_tickets: 0, status: 'inactive' })).toBe('Clayton · Inactive');
    });

    it('falls back to a dash', () => {
        expect(clientMeta({})).toBe('—');
    });
});
