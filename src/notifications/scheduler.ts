// Notifications scheduler for ClearHead
// Handles local notifications for reviews, decay warnings, and insights

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handling
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
    }),
});

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    return finalStatus === 'granted';
}

// Notification types with neutral fear-based language
type NotificationType = 'regret' | 'decay_warning' | 'weekly_summary';

const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; bodies: string[] }> = {
    regret: {
        title: 'Regret Incoming',
        bodies: [
            'That task you skipped? It\'s now a recovery task.',
            'Every delay compounds. The cost increases.',
            'You know what needs to be done. Why wait?',
        ],
    },
    decay_warning: {
        title: 'Memory Decay',
        bodies: [
            'Your knowledge of {topic} is fading.',
            '{topic} is now unstable. Review soon.',
            'Neglected: {topic}. The forgetting curve wins.',
        ],
    },
    weekly_summary: {
        title: 'Weekly Reality Check',
        bodies: [
            'Your week in numbers. Face the truth.',
            'Patterns don\'t lie. Review your insights.',
            'Another week passed. What did you actually do?',
        ],
    },
};

// Schedule a local notification
export async function scheduleNotification(
    type: NotificationType,
    data?: { topic?: string },
    triggerDate?: Date
): Promise<string> {
    const template = NOTIFICATION_TEMPLATES[type];
    const bodyIndex = Math.floor(Math.random() * template.bodies.length);
    let body = template.bodies[bodyIndex];

    // Replace placeholders
    if (data?.topic) {
        body = body.replace('{topic}', data.topic);
    }

    const trigger = triggerDate
        ? { date: triggerDate }
        : { seconds: 1 };

    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title: template.title,
            body,
            data: { type, ...data },
        },
        trigger,
    });

    return id;
}

// Schedule decay warning for a topic
export async function scheduleDecayWarning(
    topicId: string,
    topicName: string,
    nextReviewDate: Date
): Promise<string> {
    // Schedule warning 1 day after the review date
    const warningDate = new Date(nextReviewDate);
    warningDate.setDate(warningDate.getDate() + 1);

    return scheduleNotification('decay_warning', { topic: topicName }, warningDate);
}

// Schedule weekly summary (every Sunday at 8 PM)
export async function scheduleWeeklySummary(): Promise<string> {
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + (7 - now.getDay()));
    nextSunday.setHours(20, 0, 0, 0);

    return Notifications.scheduleNotificationAsync({
        content: {
            title: 'Weekly Reality Check',
            body: 'Your week in numbers. Face the truth.',
            data: { type: 'weekly_summary' },
        },
        trigger: {
            weekday: 1, // Sunday
            hour: 20,
            minute: 0,
            repeats: true,
        },
    });
}

// Cancel a scheduled notification
export async function cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// Cancel all scheduled notifications
export async function cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

// Get all pending notifications
export async function getPendingNotifications() {
    return Notifications.getAllScheduledNotificationsAsync();
}
