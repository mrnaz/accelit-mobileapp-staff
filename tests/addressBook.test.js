import { describe, it, expect } from 'vitest';
import { toPerson, sectionize, matches } from '../app/utils/addressBook.js';

const contact = { type: 'client_contact', displayname: 'Pat Smith', contact_id: 44, client_id: 12, fname: 'Pat', client_name: 'Accolade Screens', email: 'pat@accolade.com.au', phone: '0400000000' };
const general = { type: 'general_contact', displayname: 'Vendor Support', contact_id: 90, client_id: null, fname: 'Vendor', client_name: null, email: 's@v.com', phone: null };
const client = { type: 'client', displayname: 'Accolade Screens', contact_id: null, client_id: 12, client_name: 'Accolade Screens', email: null, phone: '0390000000' };

describe('toPerson', () => {
    it('words the subtitle by row type', () => {
        expect(toPerson(contact).subtitle).toBe('Accolade Screens');
        expect(toPerson(general).subtitle).toBe('General contact');
        expect(toPerson(client).subtitle).toBe('Main line');
    });

    it('flags clients and keeps the client link', () => {
        expect(toPerson(client).isClient).toBe(true);
        expect(toPerson(contact).clientId).toBe(12);
        expect(toPerson(general).clientId).toBeNull();
    });
});

describe('sectionize', () => {
    it('groups by first letter, keeping API order', () => {
        const rows = [client, general, contact].sort((a, b) => a.displayname.localeCompare(b.displayname));
        const sections = sectionize(rows);

        expect(sections.map((s) => s.title)).toEqual(['A', 'P', 'V']);
        expect(sections[0].data[0].displayname).toBe('Accolade Screens');
    });

    it('puts non-letters under #', () => {
        expect(sectionize([{ displayname: '3M Support' }])[0].title).toBe('#');
    });
});

describe('matches', () => {
    it('searches name, company, email and number', () => {
        expect(matches(contact, 'accolade')).toBe(true);
        expect(matches(contact, '0400')).toBe(true);
        expect(matches(general, 'accolade')).toBe(false);
    });
});
