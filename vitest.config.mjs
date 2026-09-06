import { defineConfig } from 'vitest/config';

export default defineConfig({
    // The app writes JSX in plain .js files (Expo convention), so esbuild has
    // to be told to parse them as JSX when a test imports a component.
    esbuild: {
        loader: 'jsx',
        include: /\.[jt]sx?$/,
        exclude: [],
        jsx: 'automatic',
    },
    test: {
        // Pure util tests run in node. A component test opts into jsdom with a
        // `@vitest-environment jsdom` docblock at the top of the file.
        environment: 'node',
    },
});
