export function sanitizeOtp(text) {
    return String(text || '').replace(/\D/g, '').slice(0, 6);
}

export function isCompleteOtp(code) {
    return sanitizeOtp(code).length === 6;
}
