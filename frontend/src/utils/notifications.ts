import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  } catch (e) {
    console.log('Notification permission error:', e);
    return false;
  }
}

export async function scheduleReminder(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  
  try {
    // Cancel existing reminders
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // Schedule 4 reminders every 6 hours (6, 12, 18, 24 hours from now)
    for (let i = 1; i <= 4; i++) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: i * 6 * 3600,
          repeats: false,
        },
      });
    }
  } catch (e) {
    console.log('Schedule notification error:', e);
  }
}

export async function cancelReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.log('Cancel notification error:', e);
  }
}
