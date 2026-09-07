import { describe, it, expect } from 'vitest';
import { contactPerson } from '../app/utils/contacts.js';

describe('contactPerson', () => {
    it('prefers the joined name and falls back to first plus surname', () => {
        expect(contactPerson({ name: 'Pat Smith', fname: 'Pat', sname: 'Smith' }, 'k').name).toBe('Pat Smith');
        expect(contactPerson({ fname: 'Pat', sname: 'Smith' }, 'k').name).toBe('Pat Smith');
        expect(contactPerson({ fname: 'Pat' }, 'k').name).toBe('Pat');
        expect(contactPerson({}, 'k').name).toBe('');
    });

    it('keeps the key it was handed, so one contact can appear twice', () => {
        expect(contactPerson({ id: 44 }, 'primary').key).toBe('primary');
        expect(contactPerson({ id: 44 }, 'contact-44').key).toBe('contact-44');
    });

    it('never links to a client page, and tints the avatar by contact id', () => {
        const person = contactPerson({ id: 44, position: 'Office Manager', phone: '0400000000' }, 'contact-44');

        expect(person.isClient).toBe(false);
        expect(person.clientId).toBeNull();
        expect(person.subtitle).toBe('Office Manager');
        expect(person.phone).toBe('0400000000');
        expect(person.avatarId).toBe(44);
    });

    it('leaves absent details null rather than empty strings', () => {
        const person = contactPerson({ id: 0 }, 'contact-0');

        expect(person.subtitle).toBeNull();
        expect(person.phone).toBeNull();
        expect(person.email).toBeNull();
        expect(person.avatarId).toBe(0);
    });
});
