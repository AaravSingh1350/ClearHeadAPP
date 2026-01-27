// Timeline Screen
// Unified chronological view with progressive blur effects

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/glass';
import { useThemeStore } from '@/stores';
import { spacing, typography } from '@/styles/theme';
import { getDatabase } from '@/database';
import { TimelineEntry } from '@/database/schema';
import { useAnimationKey } from '@/utils/animations';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

const ENTRY_ICONS: Record<TimelineEntry['entry_type'], string> = {
    problem: 'alert-circle-outline',
    study_session: 'book-outline',
    missed_revision: 'close-circle-outline',
    planner_failure: 'calendar-outline',
    thought: 'bulb-outline',
};

const ENTRY_COLORS: Record<TimelineEntry['entry_type'], string> = {
    problem: '#F59E0B',
    study_session: '#4ADE80',
    missed_revision: '#EF4444',
    planner_failure: '#A3A3A3',
    thought: '#60A5FA',
};

export default function TimelineScreen() {
    const animationKey = useAnimationKey();
    const { colors, colorScheme } = useThemeStore();
    const [entries, setEntries] = useState<TimelineEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            loadTimeline();
        }, [])
    );

    const loadTimeline = async () => {
        try {
            const db = getDatabase();
            const result = await db.getAllAsync<TimelineEntry>(
                'SELECT * FROM timeline_entries ORDER BY created_at DESC LIMIT 50'
            );
            setEntries(result);
        } catch (error) {
            console.error('Failed to load timeline:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getBlurIntensity = (index: number): number => {
        // Progressive blur: older entries get more blur
        if (index < 5) return 0;
        if (index < 10) return 5;
        if (index < 20) return 10;
        return 15;
    };

    const getOpacity = (index: number): number => {
        // Progressive fade
        if (index < 5) return 1;
        if (index < 10) return 0.85;
        if (index < 20) return 0.7;
        return 0.5;
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    // Group entries by date
    const groupedEntries = entries.reduce((groups, entry) => {
        const date = new Date(entry.created_at).toDateString();
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(entry);
        return groups;
    }, {} as Record<string, TimelineEntry[]>);

    const styles = createStyles(colors);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View key={`header-${animationKey}`} entering={FadeInDown.delay(100)}>
                    <Text style={styles.title}>Timeline</Text>
                    <Text style={styles.subtitle}>
                        Every action echoes. Distance creates blur.
                    </Text>
                </Animated.View>

                {/* Legend */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.legend}>
                    {Object.entries(ENTRY_ICONS).map(([type, icon]) => (
                        <View key={type} style={styles.legendItem}>
                            <Ionicons
                                name={icon as any}
                                size={16}
                                color={ENTRY_COLORS[type as TimelineEntry['entry_type']]}
                            />
                            <Text style={styles.legendText}>
                                {type.replace(/_/g, ' ')}
                            </Text>
                        </View>
                    ))}
                </Animated.View>

                {/* Timeline */}
                {entries.length === 0 ? (
                    <Animated.View entering={FadeInUp.delay(300)}>
                        <GlassCard depth={1} style={styles.emptyCard}>
                            <Ionicons name="time-outline" size={48} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>No entries yet</Text>
                            <Text style={styles.emptySubtext}>
                                Your thoughts, studies, and tasks will appear here
                            </Text>
                        </GlassCard>
                    </Animated.View>
                ) : (
                    Object.entries(groupedEntries).map(([date, dayEntries], groupIndex) => (
                        <Animated.View
                            key={date}
                            entering={FadeInUp.delay(300 + groupIndex * 100)}
                            style={styles.dateGroup}
                        >
                            <Text style={styles.dateHeader}>{formatTimestamp(dayEntries[0].created_at)}</Text>
                            <View style={styles.timelineTrack}>
                                {dayEntries.map((entry, entryIndex) => {
                                    const globalIndex = entries.indexOf(entry);
                                    const blurIntensity = getBlurIntensity(globalIndex);
                                    const opacity = getOpacity(globalIndex);
                                    const color = ENTRY_COLORS[entry.entry_type];
                                    const icon = ENTRY_ICONS[entry.entry_type];

                                    return (
                                        <View
                                            key={entry.id}
                                            style={[styles.entryWrapper, { opacity }]}
                                        >
                                            {/* Timeline connector */}
                                            <View style={styles.connector}>
                                                <View style={[styles.dot, { backgroundColor: color }]} />
                                                {entryIndex < dayEntries.length - 1 && (
                                                    <View style={styles.line} />
                                                )}
                                            </View>

                                            {/* Entry card */}
                                            <View style={styles.entryCardWrapper}>
                                                {entry.was_avoided && blurIntensity > 0 && (
                                                    <BlurView
                                                        intensity={blurIntensity + 10}
                                                        tint={colorScheme}
                                                        style={styles.avoidedBlur}
                                                    />
                                                )}
                                                <GlassCard
                                                    depth={1}
                                                    style={[
                                                        styles.entryCard,
                                                        entry.was_avoided && styles.entryCardAvoided,
                                                    ]}
                                                >
                                                    <View style={styles.entryHeader}>
                                                        <Ionicons name={icon as any} size={18} color={color} />
                                                        <Text style={[styles.entryType, { color }]}>
                                                            {entry.entry_type.replace(/_/g, ' ')}
                                                        </Text>
                                                        <Text style={styles.entryTime}>
                                                            {new Date(entry.created_at).toLocaleTimeString([], {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.entryTitle}>{entry.title}</Text>
                                                    {entry.description && (
                                                        <Text style={styles.entryDescription} numberOfLines={2}>
                                                            {entry.description}
                                                        </Text>
                                                    )}
                                                    {entry.was_avoided && (
                                                        <View style={styles.avoidedBadge}>
                                                            <Text style={styles.avoidedText}>AVOIDED</Text>
                                                        </View>
                                                    )}
                                                </GlassCard>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </Animated.View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
        paddingBottom: 100,
    },
    title: {
        fontSize: typography.h1.fontSize,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendText: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        textTransform: 'capitalize',
    },
    emptyCard: {
        padding: spacing.xxl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.h3.fontSize,
        fontWeight: '600',
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    emptySubtext: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        textAlign: 'center',
    },
    dateGroup: {
        marginBottom: spacing.xl,
    },
    dateHeader: {
        fontSize: typography.bodySmall.fontSize,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    timelineTrack: {
        paddingLeft: spacing.sm,
    },
    entryWrapper: {
        flexDirection: 'row',
        marginBottom: spacing.md,
    },
    connector: {
        width: 20,
        alignItems: 'center',
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    line: {
        flex: 1,
        width: 2,
        backgroundColor: colors.glassBorder,
        marginVertical: 4,
    },
    entryCardWrapper: {
        flex: 1,
        marginLeft: spacing.sm,
        position: 'relative',
    },
    avoidedBlur: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 16,
    },
    entryCard: {
        padding: spacing.md,
    },
    entryCardAvoided: {
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderWidth: 1,
    },
    entryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    entryType: {
        fontSize: typography.caption.fontSize,
        fontWeight: '500',
        textTransform: 'capitalize',
        flex: 1,
    },
    entryTime: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
    },
    entryTitle: {
        fontSize: typography.body.fontSize,
        fontWeight: '500',
        color: colors.textPrimary,
    },
    entryDescription: {
        fontSize: typography.bodySmall.fontSize,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    avoidedBadge: {
        marginTop: spacing.sm,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 4,
    },
    avoidedText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#EF4444',
        letterSpacing: 1,
    },
});
