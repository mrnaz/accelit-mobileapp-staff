import { priorityColors, priorityLabels } from '../constants/theme';

export function priorityColor(code, colors) {
    return priorityColors[code] || colors.textSecondary;
}

export function priorityLabel(code) {
    return priorityLabels[code] || 'Normal';
}

export function isOpen(ticket) {
    // There is no status column on tickets — open is completed_at IS NULL.
    return !ticket?.completed_at;
}

export function isMine(ticket, staff) {
    if (!staff?.id) return false;

    return String(ticket?.assigned_staff_id) === String(staff.id);
}

// The backend sorts the current user's tickets first, so a page can be split
// client-side without a parameter the API does not have. `total` is the
// server's count for the filter; whatever is not yours is everyone else's.
export function partitionTickets(rows, staff, total) {
    const yours = [];
    const others = [];

    (rows || []).forEach((ticket) => (isMine(ticket, staff) ? yours : others).push(ticket));

    return { yours, others, othersTotal: Math.max(0, (Number(total) || 0) - yours.length) };
}
