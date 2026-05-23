import { Platform } from 'react-native';

// Lazy import to prevent crash on Expo Go SDK 53+
let Notifications: any = null;
try {
  if (Platform.OS !== 'web') {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (e) {
  // expo-notifications not available (Expo Go SDK 53+)
  console.log('Notifications not available in this environment');
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (e) {
    return false;
  }
}

export async function scheduleReminder(title: string, body: string): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (let i = 1; i <= 4; i++) {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: i * 6 * 3600, repeats: false },
      });
    }
  } catch (e) {
    // Silently fail
  }
}

export async function cancelReminders(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    // Silently fail
  }
}
