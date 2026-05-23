// Notification functions are no-op stubs.
// expo-notifications was removed from Expo Go in SDK 53.
// These will work in production/development builds when connected to RevenueCat.
// For now they're safe stubs that never throw.

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function scheduleReminder(_title: string, _body: string): Promise<void> {
  // No-op in Expo Go
}

export async function cancelReminders(): Promise<void> {
  // No-op in Expo Go
}
