import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toPerson, sectionize, recentKey, bumpRecent, matches } from '../app/utils/addressBook.js';

// Recents live on the device, so the store stands in for AsyncStorage and the
// tests below read what actually landed in it.
const store = vi.hoisted(() => ({ value: null }));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async () => store.value,
        setItem: async (_key, value) => { store.value = value; },
    },
}));

const { loadRecents, rememberRecent } = await import('../app/utils/recents.js');

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

    it('uses the first name for client contacts and the full name for the rest', () => {
        expect(toPerson(contact).firstName).toBe('Pat');
        expect(toPerson(general).firstName).toBe('Vendor Support');
        expect(toPerson(client).firstName).toBe('Accolade Screens');
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

describe('recents', () => {
    it('keys by type and id', () => {
        expect(recentKey(contact)).toBe('client_contact-44');
        expect(recentKey(client)).toBe('client-12');
    });

    it('bumps to the front and caps at eight', () => {
        expect(bumpRecent(['a', 'b'], 'b')).toEqual(['b', 'a']);
        expect(bumpRecent(['1', '2', '3', '4', '5', '6', '7', '8'], '9')).toEqual(['9', '1', '2', '3', '4', '5', '6', '7']);
    });
});

describe('recents storage', () => {
    beforeEach(() => { store.value = null; });

    it('stores keys and nothing that names the person', async () => {
        const next = await rememberRecent([], recentKey(contact));

        expect(next).toEqual(['client_contact-44']);
        expect(await loadRecents()).toEqual(['client_contact-44']);
        expect(store.value).not.toContain('Pat');
        expect(store.value).not.toContain('0400');
        expect(store.value).not.toContain('accolade');
    });

    it('ignores anything but keys already in storage', async () => {
        store.value = JSON.stringify(['client-12', 44, { displayname: 'Pat Smith' }]);
        expect(await loadRecents()).toEqual(['client-12']);

        store.value = 'not json';
        expect(await loadRecents()).toEqual([]);
    });
});

describe('matches', () => {
    it('searches name, company, email and number', () => {
        expect(matches(contact, 'accolade')).toBe(true);
        expect(matches(contact, '0400')).toBe(true);
        expect(matches(general, 'accolade')).toBe(false);
    });
});
