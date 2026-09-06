module.exports = function (api) {
    api.cache(true);

    return {
        presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
        plugins: [
            // The reference app reads env through react-native-dotenv and an
            // "@env" module. This app uses EXPO_PUBLIC_API_URL instead, which
            // Expo inlines into process.env at build time with no plugin.
            'react-native-worklets/plugin', // must be last
        ],
    };
};
