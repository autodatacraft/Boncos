# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Android development APK

The development build uses a separate app id so it can be installed on the
same phone as the preview build:

- Preview/base Android package: `com.autodatacraft.boncos`
- Development Android package: `com.autodatacraft.boncos.dev`
- Development app name: `Boncos Dev`
- Development URL scheme: `boncos-dev`

Build the development APK with:

```bash
npm run build:android:dev
```

After installing the APK on the phone, start Metro for the development client:

```bash
npm run start:dev
```

The command always starts Expo in LAN mode with the development variant.
API requests automatically use the same LAN host advertised by Expo, on port
`8000`. Start it from the repository root with:

```bash
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Google Sign-In for the development APK requires an Android OAuth client with:

- Package: `com.autodatacraft.boncos.dev`
- SHA-1: `15:14:E3:78:75:40:94:ED:AB:FE:9E:DE:AA:12:6C:84:4D:80:63:85`

The development EAS profile uses `credentials.json`, keeping that fingerprint
stable across rebuilds. The Web OAuth client ID remains the `webClientId` used
to request the backend ID token.

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
