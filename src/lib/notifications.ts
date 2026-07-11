import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
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

export async function cancelNotifications(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id))
  );
}
