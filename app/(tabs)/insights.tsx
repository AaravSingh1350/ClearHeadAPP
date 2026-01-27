// Insights Screen
// Weekly insights with brutal factual analysis

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard, GlassButton } from '@/components/glass';
import { useThemeStore } from '@/stores';
import { spacing, typography } from '@/styles/theme';
import { getDatabase, formatDate } from '@/database';
import { useAnimationKey } from '@/utils/animations';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

interface InsightData {
    missedRevisions: number;
    skippedTasks: number;
    completedTasks: number;
    averageDelayDays: number;
    topAvoidanceTime: string;
    studyMinutes: number;
    thoughtsLogged: number;
}

const BRUTAL_INSIGHTS = [
    (data: InsightData) => data.missedRevisions > 0
        ? `You ignored ${data.missedRevisions} revision${data.missedRevisions > 1 ? 's' : ''} this week.`
        : null,
    (data: InsightData) => data.skippedTasks > 0
        ? `You skipped ${data.skippedTasks} task${data.skippedTasks > 1 ? 's' : ''}. Each became a recovery task.`
        : null,
    (data: InsightData) => data.averageDelayDays > 1
        ? `You delay action by ${data.averageDelayDays.toFixed(1)} days on average.`
        : null,
    (data: InsightData) => data.topAvoidanceTime
        ? `Your avoidance peaks ${data.topAvoidanceTime}.`
        : null,
    (data: InsightData) => data.studyMinutes < 60
        ? `Only ${data.studyMinutes} minutes of study logged this week.`
        : null,
    (data: InsightData) => data.thoughtsLogged === 0
        ? `No thinking sessions this week. Are you avoiding self-reflection?`
        : null,
];

export default function InsightsScreen() {
    const animationKey = useAnimationKey();
    const { colors, colorScheme } = useThemeStore();
    const [insights, setInsights] = useState<InsightData | null>(null);
    const [generatedInsights, setGeneratedInsights] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [weekRange, setWeekRange] = useState({ start: '', end: '' });

    useFocusEffect(
        useCallback(() => {
            generateWeeklyInsights();
        }, [])
    );

    const generateWeeklyInsights = async () => {
        try {
            const db = getDatabase();
            const now = Date.now();
            const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

            setWeekRange({
                start: formatDate(weekAgo),
                end: formatDate(now),
            });

            // Count missed revisions
            const missedRevisions = await db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM revisions 
         WHERE was_missed = 1 AND scheduled_at >= ? AND scheduled_at <= ?`,
                [weekAgo, now]
            );

            // Count skipped tasks
            const skippedTasks = await db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM tasks 
         WHERE status = 'skipped' AND skipped_at >= ? AND skipped_at <= ?`,
                [weekAgo, now]
            );

            // Count completed tasks
            const completedTasks = await db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM tasks 
         WHERE status = 'completed' AND completed_at >= ? AND completed_at <= ?`,
                [weekAgo, now]
            );

            // Calculate average delay (from created to completed)
            const avgDelay = await db.getFirstAsync<{ avg_delay: number }>(
                `SELECT AVG((completed_at - created_at) / 86400000.0) as avg_delay FROM tasks 
         WHERE status = 'completed' AND completed_at >= ? AND completed_at <= ?`,
                [weekAgo, now]
            );

            // Sum study minutes
            const studyMinutes = await db.getFirstAsync<{ total: number }>(
                `SELECT COALESCE(SUM(time_spent_minutes), 0) as total FROM study_topics 
         WHERE created_at >= ? AND created_at <= ?`,
                [weekAgo, now]
            );

            // Count thoughts
            const thoughts = await db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM thoughts 
         WHERE created_at >= ? AND created_at <= ?`,
                [weekAgo, now]
            );

            const data: InsightData = {
                missedRevisions: missedRevisions?.count || 0,
                skippedTasks: skippedTasks?.count || 0,
                completedTasks: completedTasks?.count || 0,
                averageDelayDays: avgDelay?.avg_delay || 0,
                topAvoidanceTime: 'at night', // Simplified for now
                studyMinutes: studyMinutes?.total || 0,
                thoughtsLogged: thoughts?.count || 0,
            };

            setInsights(data);

            // Generate brutal insights
            const brutalMessages = BRUTAL_INSIGHTS
                .map(fn => fn(data))
                .filter(Boolean) as string[];

            setGeneratedInsights(brutalMessages);
        } catch (error) {
            console.error('Failed to generate insights:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getCompletionRate = () => {
        if (!insights) return 0;
        const total = insights.completedTasks + insights.skippedTasks;
        if (total === 0) return 100;
        return Math.round((insights.completedTasks / total) * 100);
    };

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
                    <Text style={styles.title}>Insights</Text>
                    <Text style={styles.subtitle}>
                        Brutal facts. No sugar coating.
                    </Text>
                    <Text style={styles.weekRange}>
                        Week of {weekRange.start} — {weekRange.end}
                    </Text>
                </Animated.View>

                {/* Stats Overview */}
                {insights && (
                    <Animated.View key={`stats-${animationKey}`} entering={FadeInDown.delay(200)} style={styles.statsGrid}>
                        <GlassCard depth={2} style={styles.statCard}>
                            <Text style={styles.statValue}>{insights.completedTasks}</Text>
                            <Text style={styles.statLabel}>Completed</Text>
                        </GlassCard>
                        <GlassCard depth={2} style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#EF4444' }]}>
                                {insights.skippedTasks}
                            </Text>
                            <Text style={styles.statLabel}>Skipped</Text>
                        </GlassCard>
                        <GlassCard depth={2} style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#FBBF24' }]}>
                                {insights.missedRevisions}
                            </Text>
                            <Text style={styles.statLabel}>Missed Reviews</Text>
                        </GlassCard>
                        <GlassCard depth={2} style={styles.statCard}>
                            <Text style={styles.statValue}>{getCompletionRate()}%</Text>
                            <Text style={styles.statLabel}>Completion Rate</Text>
                        </GlassCard>
                    </Animated.View>
                )}

                {/* Brutal Insights */}
                <Animated.View entering={FadeInUp.delay(300)}>
                    <Text style={styles.sectionTitle}>The Truth</Text>
                    {generatedInsights.length === 0 ? (
                        <GlassCard depth={1} style={styles.goodCard}>
                            <Ionicons name="checkmark-circle" size={32} color={colors.accentPositive} />
                            <Text style={styles.goodText}>
                                No major issues this week. Keep going.
                            </Text>
                        </GlassCard>
                    ) : (
                        generatedInsights.map((insight, index) => (
                            <Animated.View
                                key={index}
                                entering={FadeInUp.delay(400 + index * 100)}
                            >
                                <GlassCard depth={1} style={styles.insightCard}>
                                    <View style={styles.insightRow}>
                                        <Ionicons
                                            name="warning"
                                            size={20}
                                            color="#EF4444"
                                            style={styles.insightIcon}
                                        />
                                        <Text style={styles.insightText}>{insight}</Text>
                                    </View>
                                </GlassCard>
                            </Animated.View>
                        ))
                    )}
                </Animated.View>

                {/* Weekly Summary */}
                {insights && (
                    <Animated.View entering={FadeInUp.delay(600)}>
                        <Text style={styles.sectionTitle}>Activity</Text>
                        <GlassCard depth={1} style={styles.summaryCard}>
                            <View style={styles.summaryRow}>
                                <Ionicons name="book-outline" size={20} color={colors.textSecondary} />
                                <Text style={styles.summaryLabel}>Study time</Text>
                                <Text style={styles.summaryValue}>
                                    {Math.floor(insights.studyMinutes / 60)}h {insights.studyMinutes % 60}m
                                </Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Ionicons name="bulb-outline" size={20} color={colors.textSecondary} />
                                <Text style={styles.summaryLabel}>Thoughts logged</Text>
                                <Text style={styles.summaryValue}>{insights.thoughtsLogged}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                                <Text style={styles.summaryLabel}>Avg. delay</Text>
                                <Text style={styles.summaryValue}>
                                    {insights.averageDelayDays.toFixed(1)} days
                                </Text>
                            </View>
                        </GlassCard>
                    </Animated.View>
                )}

                {/* Refresh Button */}
                <Animated.View entering={FadeInUp.delay(700)} style={styles.refreshSection}>
                    <GlassButton
                        title="Regenerate Insights"
                        onPress={generateWeeklyInsights}
                        loading={isLoading}
                        icon={<Ionicons name="refresh" size={18} color={colors.textPrimary} />}
                    />
                </Animated.View>
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
    },
    weekRange: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        marginBottom: spacing.xl,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    statCard: {
        width: '48%',
        padding: spacing.md,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    statLabel: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    sectionTitle: {
        fontSize: typography.h3.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: spacing.md,
    },
    goodCard: {
        padding: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    goodText: {
        fontSize: typography.body.fontSize,
        color: colors.accentPositive,
        flex: 1,
    },
    insightCard: {
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    insightRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    insightIcon: {
        marginRight: spacing.sm,
        marginTop: 2,
    },
    insightText: {
        fontSize: typography.body.fontSize,
        color: colors.textPrimary,
        flex: 1,
        lineHeight: 22,
    },
    summaryCard: {
        padding: spacing.md,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.glassBorder,
    },
    summaryLabel: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
    },
    summaryValue: {
        fontSize: typography.body.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    refreshSection: {
        marginTop: spacing.xl,
        alignItems: 'center',
    },
});
