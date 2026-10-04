const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// zustand's ESM build uses `import.meta`, which breaks the web bundle
// ("Cannot use 'import.meta' outside a module"). Skipping the "import"
// export condition makes Metro pick its CommonJS build instead.
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

// push-worker/ is a separate Cloudflare package with its own node_modules; the app never
// imports it, and crawling it makes the dev server hang on startup.
config.resolver.blockList = [/[\\/]push-worker[\\/].*/];

module.exports = config;
