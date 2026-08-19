import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lembrete diário local — ESCOPO §4.15.
 *
 * `expo-notifications` NUNCA pode ser importado no topo do módulo aqui.
 * O expo-router carrega todas as telas de cara para montar o mapa de rotas,
 * e a partir do SDK 53 o próprio ato de importar `expo-notifications` já
 * dispara um registro automático de push token que O EXPO GO REJEITA —
 * derrubando o app inteiro antes de qualquer tela abrir, mesmo que a
 * feature nunca seja usada. Import dinâmico = só carrega quando alguém
 * de fato mexe no toggle, e com try/catch para não travar o app numa
 * sessão de teste via Expo Go (funciona normalmente numa build de
 * desenvolvimento/produção).
 */

const REMINDER_KEY = 'daily_reminder_hour';
const NOTIFICATION_ID_KEY = 'daily_reminder_notification_id';

let handlerConfigured = false;

async function loadNotifications() {
  const Notifications = await import('expo-notifications');
  if (!handlerConfigured) {
    handlerConfigured = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
  return Notifications;
}

export async function getReminderTime(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(REMINDER_KEY);
  return raw ? parseInt(raw, 10) : null;
}

/**
 * Retorna `{ok:false, reason:'unsupported'}` em vez de lançar quando o
 * ambiente não suporta (Expo Go a partir do SDK 53) — a tela mostra um
 * aviso em vez de travar.
 */
export async function scheduleDailyReminder(
  hour: number,
): Promise<{ ok: boolean; reason?: 'unsupported' | 'denied' }> {
  try {
    const Notifications = await loadNotifications();
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'denied' };

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
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unsupported' };
  }
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
    if (id) {
      const Notifications = await loadNotifications();
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
  } catch {
    // ambiente sem suporte (Expo Go) — só limpa o estado local
  }
  await AsyncStorage.removeItem(REMINDER_KEY);
  await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
}
