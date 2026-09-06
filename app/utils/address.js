// One line for a site address, skipping blank parts. Used by the client
// General tab and the Directions button, so both agree on the text.
export function addressLine(address) {
    if (!address) return null;

    const line = [address.address1, address.address2, address.suburbcity, address.state, address.postcode]
        .filter((part) => part && String(part).trim())
        .join(', ');

    return line || null;
}
