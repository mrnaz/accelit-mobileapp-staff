// One asset row from GET /api/assets?client_id=… (docs/api-contract.md
// §Assets), read the way the web client asset list reads it: the machine's
// identity comes from the RMM record under rmm_asset.rmm_asset_data, and an
// asset the RMM has never seen still carries an rmm_asset object whose id is
// null.

// The RMM data block, or null when the asset is not managed. The backend
// serialises "no data" as an empty array, so anything that is not a plain
// object counts as nothing.
function rmmData(asset) {
    const rmm = asset?.rmm_asset;

    if (!rmm?.id) return null;

    const data = rmm.rmm_asset_data;

    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
}

export function assetName(asset) {
    return asset?.label || rmmData(asset)?.computername || 'Unnamed asset';
}

// The web's "Service ID" column: domain\computer for a managed machine, the
// serial number for anything else.
export function serviceId(asset) {
    const data = rmmData(asset);

    if (data) {
        return [data.domain, data.computername].filter(Boolean).join('\\') || null;
    }

    return asset?.serial_no || null;
}

// The user part of "DOMAIN\user", as the web shows it.
export function lastLogin(asset) {
    const login = rmmData(asset)?.last_user_login;

    if (!login) return null;

    return String(login).slice(String(login).indexOf('\\') + 1) || null;
}

export function lanIp(asset) {
    return rmmData(asset)?.lan_ip4 || null;
}

// What the web's search box matches against, lower-cased into one string.
export function assetSearchText(asset) {
    const data = rmmData(asset) || {};

    return [
        asset?.label,
        asset?.serial_no,
        asset?.asset_label?.label_code,
        data.domain,
        data.computername,
        data.lan_ip4,
        data.wan_ip,
        data.last_user_login,
    ].filter(Boolean).join(' ').toLowerCase();
}
