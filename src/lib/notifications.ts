// Detectar si estamos en web
const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

let Notifications: any = null;

if (!isWeb) {
  // Solo importar en React Native
  Notifications = require("expo-notifications");

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (isWeb) return false; // Web no soporta notificaciones
  if (!Notifications) return false;

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleMedicationReminders(
  medicationName: string,
  doseLabel: string,
  scheduleTimes: string[]
): Promise<string[]> {
  if (isWeb) return []; // Web no soporta notificaciones

  const granted = await ensureNotificationPermission();
  if (!granted) return [];

  const ids: string[] = [];
  for (const time of scheduleTimes) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!match) continue;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Hora de tu medicamento",
        body: `${medicationName}${doseLabel ? ` — ${doseLabel}` : ""}`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
      },
    });
    ids.push(id);
  }
  return ids;
}

export async function notifyPatternFinding(title: string, body: string): Promise<void> {
  if (isWeb) return; // Web no soporta notificaciones

  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
}

export async function cancelNotifications(ids: string[]): Promise<void> {
  if (isWeb) return; // Web no soporta notificaciones
  if (!Notifications) return;

  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id))
  );
}
