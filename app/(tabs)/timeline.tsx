// Timeline Screen - Calendar View
// Fast loading with date-based navigation

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/glass';
import { useThemeStore } from '@/stores';
import { spacing, typography } from '@/styles/theme';
import { getDatabase, formatDate } from '@/database';
import { TimelineEntry } from '@/database/schema';
import { useFocusEffect } from 'expo-router';

const ENTRY_ICONS: Record<TimelineEntry['entry_type'], string> = {
    problem: 'alert-circle',
    study_session: 'book',
    missed_revision: 'close-circle',
    planner_failure: 'calendar',
    thought: 'bulb',
};

const ENTRY_COLORS: Record<TimelineEntry['entry_type'], string> = {
    problem: '#F59E0B',
    study_session: '#4ADE80',
    missed_revision: '#EF4444',
    planner_failure: '#A3A3A3',
    thought: '#60A5FA',
};

export default function TimelineScreen() {
    const { colors } = useThemeStore();
    const [entries, setEntries] = useState<TimelineEntry[]>([]);
    const [selectedDate, setSelectedDate] = useState(formatDate(Date.now()));
    const [isLoading, setIsLoading] = useState(false);

    // Generate calendar dates (current week + past 2 weeks)
    const calendarDates = useMemo(() => {
        const dates: { date: string; dayName: string; dayNum: number; isToday: boolean }[] = [];
        const today = new Date();

        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dates.push({
                date: formatDate(d.getTime()),
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNum: d.getDate(),
                isToday: i === 0,
            });
        }
        return dates;
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadEntriesForDate(selectedDate);
        }, [selectedDate])
    );

    const loadEntriesForDate = async (date: string) => {
        setIsLoading(true);
        try {
            const db = getDatabase();
            // Get entries for selected date only (fast query)
            const dayStart = new Date(date).setHours(0, 0, 0, 0);
            const dayEnd = new Date(date).setHours(23, 59, 59, 999);

            const result = await db.getAllAsync<TimelineEntry>(
                `SELECT * FROM timeline_entries 
                 WHERE created_at >= ? AND created_at <= ?
                 ORDER BY created_at DESC`,
                [dayStart, dayEnd]
            );
            setEntries(result);
        } catch (error) {
            console.error('Failed to load timeline:', error);
            setEntries([]);
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    // Stats for selected date
    const stats = useMemo(() => {
        const studySessions = entries.filter(e => e.entry_type === 'study_session').length;
        const thoughts = entries.filter(e => e.entry_type === 'thought').length;
        const problems = entries.filter(e => e.entry_type === 'problem').length;
        const avoided = entries.filter(e => e.was_avoided).length;
        return { studySessions, thoughts, problems, avoided, total: entries.length };
    }, [entries]);

    const styles = createStyles(colors);

    // Render entry item
    const renderEntry = useCallback(({ item, index }: { item: TimelineEntry; index: number }) => (
        <Animated.View entering={FadeIn.delay(index * 30).duration(200)}>
            <View style={styles.entryCard}>
                <View style={[styles.entryIcon, { backgroundColor: ENTRY_COLORS[item.entry_type] + '20' }]}>
                    <Ionicons
                        name={ENTRY_ICONS[item.entry_type] as any}
                        size={18}
                        color={ENTRY_COLORS[item.entry_type]}
                    />
                </View>
                <View style={styles.entryContent}>
                    <Text style={styles.entryTitle} numberOfLines={1}>{item.title}</Text>
                    {item.description && (
                        <Text style={styles.entryDesc} numberOfLines={2}>{item.description}</Text>
                    )}
                    <Text style={styles.entryTime}>{formatTime(item.created_at)}</Text>
                </View>
                {item.was_avoided && (
                    <View style={styles.avoidedBadge}>
                        <Text style={styles.avoidedText}>!</Text>
                    </View>
                )}
            </View>
        </Animated.View>
    ), [colors]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Timeline</Text>
                <Text style={styles.subtitle}>Your daily activity log</Text>
            </View>

            {/* Calendar Strip */}
            <View style={styles.calendarContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.calendarScroll}
                >
                    {calendarDates.map((day) => (
                        <Pressable
                            key={day.date}
                            style={[
                                styles.dayCard,
                                selectedDate === day.date && styles.dayCardActive,
                                day.isToday && styles.dayCardToday,
                            ]}
                            onPress={() => setSelectedDate(day.date)}
                        >
                            <Text style={[
                                styles.dayName,
                                selectedDate === day.date && styles.dayNameActive
                            ]}>
                                {day.dayName}
                            </Text>
                            <Text style={[
                                styles.dayNum,
                                selectedDate === day.date && styles.dayNumActive
                            ]}>
                                {day.dayNum}
                            </Text>
                            {day.isToday && <View style={styles.todayDot} />}
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            {/* Quick Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Ionicons name="book" size={16} color="#4ADE80" />
                    <Text style={styles.statNum}>{stats.studySessions}</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="bulb" size={16} color="#60A5FA" />
                    <Text style={styles.statNum}>{stats.thoughts}</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                    <Text style={styles.statNum}>{stats.problems}</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="layers" size={16} color={colors.textSecondary} />
                    <Text style={styles.statNum}>{stats.total}</Text>
                </View>
            </View>

            {/* Entries List */}
            {isLoading ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            ) : entries.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.emptyText}>No activity on this day</Text>
                </View>
            ) : (
                <FlatList
                    data={entries}
                    renderItem={renderEntry}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={10}
                    maxToRenderPerBatch={5}
                    windowSize={5}
                />
            )}
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    // Calendar
    calendarContainer: {
        paddingVertical: spacing.sm,
    },
    calendarScroll: {
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
    },
    dayCard: {
        width: 50,
        height: 65,
        borderRadius: 12,
        backgroundColor: colors.glassSurface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    dayCardActive: {
        backgroundColor: colors.accentPositive,
        borderColor: colors.accentPositive,
    },
    dayCardToday: {
        borderColor: colors.accentPositive,
    },
    dayName: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    dayNameActive: {
        color: '#000',
    },
    dayNum: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
        marginTop: 2,
    },
    dayNumActive: {
        color: '#000',
    },
    todayDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.accentPositive,
        marginTop: 4,
    },
    // Stats
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: spacing.md,
        marginHorizontal: spacing.lg,
        borderRadius: 12,
        backgroundColor: colors.glassSurface,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        marginBottom: spacing.md,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statNum: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    // List
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 100,
    },
    entryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: 12,
        backgroundColor: colors.glassSurface,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    entryIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    entryContent: {
        flex: 1,
    },
    entryTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    entryDesc: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    entryTime: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 4,
    },
    avoidedBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avoidedText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFF',
    },
    // Empty
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 100,
    },
    emptyText: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    loadingText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
});
