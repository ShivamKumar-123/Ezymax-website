// Metro for a pnpm monorepo: Expo's default config already watches the workspace root and resolves the
// isolated node_modules; here we only make sure every module (including @kalks/i18n in packages/) gets this
// app's single copy of React and React Native (the web apps use a different React version).
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const pin = ["react", "react-dom", "react-native", "react-native-web"];
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const base = moduleName.split("/")[0];
  if (pin.includes(base)) {
    return context.resolveRequest({ ...context, originModulePath: path.join(__dirname, "package.json") }, moduleName, platform);
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};
// CanvasKit (Skia on web) ships a .wasm asset
config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];
module.exports = config;
