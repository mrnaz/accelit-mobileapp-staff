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
