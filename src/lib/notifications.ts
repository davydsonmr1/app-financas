import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const REMINDER_KEY = 'daily_reminder_hour';
const NOTIFICATION_ID_KEY = 'daily_reminder_notification_id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getReminderTime(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(REMINDER_KEY);
  return raw ? parseInt(raw, 10) : null;
}

export async function scheduleDailyReminder(hour: number): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  await cancelDailyReminder();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Já lançou os gastos de hoje? 💸',
      body: 'Leva menos de 10 segundos — não deixe acumular para amanhã.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
    },
  });

  await AsyncStorage.setItem(REMINDER_KEY, String(hour));
  await AsyncStorage.setItem(NOTIFICATION_ID_KEY, id);
  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  const id = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await AsyncStorage.removeItem(REMINDER_KEY);
  await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
}
