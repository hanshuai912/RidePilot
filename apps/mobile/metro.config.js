const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

// Metro only needs mobile source and shared contracts from this workspace.
config.watchFolders = config.watchFolders.filter(
  (folder) => folder !== path.resolve(__dirname, '../api'),
);
config.resolver.blockList = [
  ...config.resolver.blockList,
  /(?:^|[\\/])apps[\\/]mobile[\\/]android(?:[\\/]|$)/,
  /^android(?:[\\/]|$)/,
  /(?:^|[\\/])apps[\\/]mobile[\\/]dist(?:[\\/]|$)/,
  /^dist(?:[\\/]|$)/,
  /(?:^|[\\/])android[\\/](?:build|\.cxx|\.gradle)(?:[\\/]|$)/,
  /(?:^|[\\/])ios[\\/](?:build|Pods)(?:[\\/]|$)/,
];

module.exports = withNativeWind(config, { input: './global.css' });
