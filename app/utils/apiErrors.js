// Pure helpers for reading this API's error bodies. Kept free of React Native
// and expo imports so they can be unit tested in plain Node.

// App\Http\Middleware\IpWhitelist refuses off-VPN requests with a `message`,
// while AuthController::login's own second allowlist answers with `errors.ip`.
// Both mean "you are not on the office network" — and neither means the
// credentials were wrong, which is why the app routes them somewhere different.
export function isIpRefusal(body) {
    if (!body) return false;
    if (Array.isArray(body?.errors?.ip)) return true;

    return typeof body.message === 'string'
        && body.message.startsWith('Access denied. Your IP address is not authorized');
}

// Error bodies come in three shapes across this API: {message}, {errors: {...}}
// and, on switch-mfa-method alone, {error}. Parse defensively.
export function errorMessage(body, fallback = 'Something went wrong') {
    if (!body) return fallback;
    if (typeof body.message === 'string' && body.message) return body.message;
    if (typeof body.error === 'string' && body.error) return body.error;

    const first = body.errors && Object.values(body.errors)[0];

    if (Array.isArray(first) && first.length && typeof first[0] === 'string') return first[0];
    if (typeof first === 'string' && first) return first;

    return fallback;
}
