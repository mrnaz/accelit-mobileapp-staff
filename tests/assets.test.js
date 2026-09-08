import { describe, it, expect } from 'vitest';
import { assetName, serviceId, lastLogin, lanIp, assetSearchText } from '../app/utils/assets.js';

// The row shape of GET /api/assets?client_id=… (docs/api-contract.md §Assets):
// the machine identity lives under rmm_asset.rmm_asset_data, and an asset the
// RMM has never seen still carries an rmm_asset object with a null id.
const managed = {
    id: 88,
    label: 'PC-01',
    serial_no: 'SN123',
    asset_label: { label_code: 'PC' },
    rmm_asset: {
        id: 7,
        rmm_asset_data: {
            domain: 'ACC',
            computername: 'ACC-PC-01',
            last_user_login: 'ACC\\jsmith',
            lan_ip4: '10.0.0.5',
            wan_ip: '203.0.113.9',
        },
    },
};

const unmanaged = {
    id: 89,
    label: 'Printer',
    serial_no: 'SN999',
    asset_label: null,
    rmm_asset: { id: null, rmm_asset_data: [] },
};

describe('assetName', () => {
    it('is the label, then the computer name, then a placeholder', () => {
        expect(assetName(managed)).toBe('PC-01');
        expect(assetName({ ...managed, label: null })).toBe('ACC-PC-01');
        expect(assetName({ ...unmanaged, label: null })).toBe('Unnamed asset');
    });
});

describe('serviceId', () => {
    it('is domain\\computer for a managed machine, the way the web lists it', () => {
        expect(serviceId(managed)).toBe('ACC\\ACC-PC-01');
    });

    it('drops the domain when the RMM has none', () => {
        const data = { ...managed.rmm_asset.rmm_asset_data, domain: null };

        expect(serviceId({ ...managed, rmm_asset: { id: 7, rmm_asset_data: data } })).toBe('ACC-PC-01');
    });

    it('falls back to the serial number for an unmanaged asset', () => {
        expect(serviceId(unmanaged)).toBe('SN999');
        expect(serviceId({ ...unmanaged, serial_no: null })).toBeNull();
    });
});

describe('lastLogin', () => {
    it('strips the domain prefix from the login', () => {
        expect(lastLogin(managed)).toBe('jsmith');
    });

    it('keeps a login that has no domain', () => {
        const data = { ...managed.rmm_asset.rmm_asset_data, last_user_login: 'local' };

        expect(lastLogin({ ...managed, rmm_asset: { id: 7, rmm_asset_data: data } })).toBe('local');
    });

    it('is null without RMM data', () => {
        expect(lastLogin(unmanaged)).toBeNull();
        expect(lastLogin({})).toBeNull();
    });
});

describe('lanIp', () => {
    it('reads the IPv4 LAN address', () => {
        expect(lanIp(managed)).toBe('10.0.0.5');
        expect(lanIp(unmanaged)).toBeNull();
    });
});

describe('assetSearchText', () => {
    it('covers what the web search covers, lower-cased', () => {
        const text = assetSearchText(managed);

        ['pc-01', 'acc-pc-01', 'jsmith', '10.0.0.5', '203.0.113.9', 'sn123', 'pc'].forEach((term) => {
            expect(text, term).toContain(term);
        });
    });

    it('never throws on a bare row', () => {
        expect(assetSearchText({})).toBe('');
    });
});
