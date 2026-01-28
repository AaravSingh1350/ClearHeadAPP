import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications behave when the app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export async function setupNotifications() {
    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error setting up notifications:', error);
        return false;
    }
}

export async function scheduleDailyNotifications() {
    try {
        // Cancel all existing notifications to avoid duplicates
        await Notifications.cancelAllScheduledNotificationsAsync();

        // 6:00 AM Notification
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "☀️ Good Morning!",
                body: "Ready to conquer the day? check your tasks and start strong.",
                sound: true,
            },
            trigger: {
                hour: 6,
                minute: 0,
                repeats: true,
            } as Notifications.CalendarTriggerInput,
        });

        // 8:00 PM Notification
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "🌙 Evening Check-in",
                body: "How did your day go? Review your progress and plan for tomorrow.",
                sound: true,
            },
            trigger: {
                hour: 20,
                minute: 0,
                repeats: true,
            } as Notifications.CalendarTriggerInput,
        });

        console.log('Daily notifications scheduled for 6:00 AM and 8:00 PM');
    } catch (error) {
        console.error('Error scheduling notifications:', error);
    }
}
