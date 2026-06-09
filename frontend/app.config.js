const baseConfig = require("./app.json");

const APP_VARIANT = process.env.APP_VARIANT || "preview";
const IS_DEV_BUILD = APP_VARIANT === "development";
const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || baseConfig.expo.extra.backendUrl;

module.exports = {
  ...baseConfig.expo,
  name: IS_DEV_BUILD ? "Boncos Dev" : baseConfig.expo.name,
  scheme: IS_DEV_BUILD ? "boncos-dev" : baseConfig.expo.scheme,
  ios: {
    ...baseConfig.expo.ios,
    bundleIdentifier: IS_DEV_BUILD
      ? "com.autodatacraft.boncos.dev"
      : baseConfig.expo.ios.bundleIdentifier,
  },
  android: {
    ...baseConfig.expo.android,
    package: IS_DEV_BUILD
      ? "com.autodatacraft.boncos.dev"
      : baseConfig.expo.android.package,
  },
  extra: {
    ...baseConfig.expo.extra,
    appVariant: APP_VARIANT,
    backendUrl: BACKEND_URL,
    revenueCatAndroidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || "",
    revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "",
    revenueCatWebApiKey: process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY || "",
    projectName: IS_DEV_BUILD ? "Boncos Dev" : baseConfig.expo.extra.projectName,
  },
};
