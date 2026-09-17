const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

// The directory is a projection of the server, never something to restore:
// keep every byte of app data out of cloud backup and device-to-device
// transfer. The rules file itself ships in the module's res/xml.
module.exports = function withAccelContacts(config) {
    return withAndroidManifest(config, (cfg) => {
        const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);

        application.$['android:allowBackup'] = 'false';
        application.$['android:dataExtractionRules'] = '@xml/accel_data_extraction_rules';
        delete application.$['android:fullBackupContent'];

        return cfg;
    });
};
