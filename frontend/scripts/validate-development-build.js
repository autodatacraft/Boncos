const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const easConfig = require(path.join(root, "eas.json"));
const appConfigFactory = path.join(root, "app.config.js");
const credentialsPath = path.join(root, "credentials.json");

process.env.APP_VARIANT = "development";
process.env.EXPO_PUBLIC_BACKEND_URL = "auto";

delete require.cache[require.resolve(appConfigFactory)];
const appConfig = require(appConfigFactory);
const profile = easConfig.build?.development;

const errors = [];

if (appConfig.android?.package !== "com.autodatacraft.boncos.dev") {
  errors.push("development Android package must be com.autodatacraft.boncos.dev");
}

if (appConfig.scheme !== "boncos-dev") {
  errors.push("development URL scheme must be boncos-dev");
}

if (appConfig.extra?.backendUrl !== "auto") {
  errors.push("development backend must use automatic Expo LAN resolution");
}

if (!profile?.developmentClient || profile?.distribution !== "internal") {
  errors.push("development EAS profile must be an internal development client");
}

if (profile?.credentialsSource !== "local") {
  errors.push("development EAS profile must use the local signing credentials");
}

if (!fs.existsSync(credentialsPath)) {
  errors.push("credentials.json is missing");
} else {
  const credentials = require(credentialsPath);
  const keystorePath = credentials.android?.keystore?.keystorePath;
  const absoluteKeystorePath = keystorePath
    ? path.resolve(root, keystorePath)
    : "";

  if (!absoluteKeystorePath || !fs.existsSync(absoluteKeystorePath)) {
    errors.push("the Android keystore referenced by credentials.json is missing");
  }
}

if (errors.length > 0) {
  console.error(`Development build config is invalid:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log("Development build config is valid.");
console.log("Android package: com.autodatacraft.boncos.dev");
console.log("Backend: Expo LAN host on port 8000");
console.log(
  "Google OAuth SHA-1: 15:14:E3:78:75:40:94:ED:AB:FE:9E:DE:AA:12:6C:84:4D:80:63:85"
);
