import { describe, it, expect } from 'vitest';
import { partitionTickets } from '../app/utils/tickets.js';

const staff = { id: 5 };
const rows = [
    { id: 1, assigned_staff_id: 5 },
    { id: 2, assigned_staff_id: 9 },
    { id: 3, assigned_staff_id: '5' },
];

describe('partitionTickets', () => {
    it('splits the loaded rows into yours and everyone else', () => {
        const { yours, others } = partitionTickets(rows, staff, 80);

        expect(yours.map((t) => t.id)).toEqual([1, 3]);
        expect(others.map((t) => t.id)).toEqual([2]);
    });

    it('reports the rest of the total as everyone else', () => {
        expect(partitionTickets(rows, staff, 80).othersTotal).toBe(78);
        expect(partitionTickets(rows, staff, 1).othersTotal).toBe(0);
    });

    it('treats an unknown staff member as owning nothing', () => {
        expect(partitionTickets(rows, null, 3).yours).toEqual([]);
    });
});
