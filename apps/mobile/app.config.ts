import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "RidePilot",
  slug: "ridepilot",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "ridepilot",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  plugins: ["expo-router"],
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0D0F0E",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: "metro",
    favicon: "./assets/favicon.png",
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
