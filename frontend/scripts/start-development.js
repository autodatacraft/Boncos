const { spawnSync } = require("node:child_process");
const net = require("node:net");

const expoCli = require.resolve("expo/bin/cli");

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }

  throw new Error(`No available Expo port found from ${startPort}.`);
}

async function main() {
  const port = await findAvailablePort(8081);
  const result = spawnSync(
    process.execPath,
    [expoCli, "start", "--dev-client", "--lan", "--port", String(port)],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        APP_VARIANT: "development",
        EXPO_PUBLIC_BACKEND_URL: "auto",
      },
    }
  );

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
