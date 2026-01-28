// CogniFlow - Level-based Spaced Repetition System
// Optimized for long-term memory retention with Again/Hard/Good/Easy feedback

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    Alert,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard, GlassButton, GlassInput, GlassModal } from '@/components/glass';
import { useLearningStore, useThemeStore } from '@/stores';
import { spacing, typography } from '@/styles/theme';
import {
    REVIEW_INTERVALS,
    MASTERY_LEVEL,
    ReviewFeedback,
    calculateNextReviewFromFeedback,
    getFeedbackColor,
    getLevelProgress,
    getIntervalDescription,
    needsReviewToday,
} from '@/engines/learning/spacedRepetition';
import { StudyTopic } from '@/database/schema';
import { useAnimationKey } from '@/utils/animations';

type FilterTab = 'review' | 'upcoming' | 'mastered';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

// Group topics by date
interface DateGroup {
    date: string;
    dateLabel: string;
    learntToday: StudyTopic[];
    revisions: StudyTopic[];
}

export default function CogniFlowScreen() {
    const animationKey = useAnimationKey();
    const { colors } = useThemeStore();

    const {
        topics,
        completedRevisions,
        loadTopics,
        loadDueRevisions,
        loadCompletedRevisions,
        addTopic,
        updateTopic,
        deleteTopic,
    } = useLearningStore();

    // UI State
    const [activeTab, setActiveTab] = useState<FilterTab>('review');
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewingTopic, setReviewingTopic] = useState<StudyTopic | null>(null);

    // Add Topic Form
    const [newTopic, setNewTopic] = useState('');
    const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const [newTags, setNewTags] = useState('');

    // Daily Goal
    const dailyGoal = 10;
    const todayReviews = completedRevisions.length;

    useEffect(() => {
        loadTopics();
        loadDueRevisions();
        loadCompletedRevisions();
    }, []);

    // Helper to get date string
    const getDateString = (timestamp: number | null): string => {
        if (!timestamp) return '';
        return new Date(timestamp).toISOString().split('T')[0];
    };

    // Helper to format date label
    const formatDateLabel = (dateStr: string): string => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayStr = today.toISOString().split('T')[0];
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        if (dateStr === todayStr) return 'Today';
        if (dateStr === tomorrowStr) return 'Tomorrow';

        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    // Get today's date string
    const todayDateStr = new Date().toISOString().split('T')[0];

    // Topics learned today (created today, review_count === 0)
    const learntToday = useMemo(() => {
        return topics.filter(t => {
            const createdDate = getDateString(t.created_at);
            return createdDate === todayDateStr && t.review_count === 0;
        });
    }, [topics, todayDateStr]);

    // Filtered and organized topics
    const organizedTopics = useMemo(() => {
        let filtered = topics;

        // Apply search filter
        if (searchQuery) {
            filtered = filtered.filter(t =>
                t.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.tags && t.tags.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        // Apply priority filter
        if (priorityFilter !== 'all') {
            filtered = filtered.filter(t => t.priority === priorityFilter);
        }

        // For Review: Due now (excluding learnt today)
        const forReview = filtered
            .filter(t => needsReviewToday(t.next_review_at) && !t.is_mastered && t.review_count > 0)
            .sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });

        // Upcoming: Group by date
        const upcomingTopics = filtered.filter(t => !needsReviewToday(t.next_review_at) && !t.is_mastered);

        // Group by next_review_at date
        const dateGroups: Map<string, DateGroup> = new Map();

        upcomingTopics.forEach(topic => {
            const dateStr = getDateString(topic.next_review_at);
            if (!dateStr) return;

            if (!dateGroups.has(dateStr)) {
                dateGroups.set(dateStr, {
                    date: dateStr,
                    dateLabel: formatDateLabel(dateStr),
                    learntToday: [],
                    revisions: [],
                });
            }

            const group = dateGroups.get(dateStr)!;

            // Check if it's a new topic (created today, no reviews yet)
            const createdDate = getDateString(topic.created_at);
            if (createdDate === todayDateStr && topic.review_count === 0) {
                group.learntToday.push(topic);
            } else {
                group.revisions.push(topic);
            }
        });

        // Sort dates
        const sortedDates = Array.from(dateGroups.values()).sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Mastered
        const mastered = filtered
            .filter(t => t.is_mastered)
            .sort((a, b) => b.level - a.level);

        return { forReview, upcoming: sortedDates, mastered };
    }, [topics, searchQuery, priorityFilter, todayDateStr]);

    // Stats
    const masteryPercent = useMemo(() => {
        if (topics.length === 0) return 0;
        const masteredCount = topics.filter(t => t.is_mastered).length;
        return Math.round((masteredCount / topics.length) * 100);
    }, [topics]);

    const handleAddTopic = async () => {
        if (!newTopic.trim()) return;

        await addTopic(newTopic, 0, 50, newPriority, newTags);
        setNewTopic('');
        setNewPriority('medium');
        setNewTags('');
        setShowAddModal(false);
    };

    const handleStartReview = (topic: StudyTopic) => {
        setReviewingTopic(topic);
        setShowReviewModal(true);
    };

    const handleReviewFeedback = async (feedback: ReviewFeedback) => {
        if (!reviewingTopic) return;

        const { nextLevel, nextReviewAt, isMastered: nowMastered } = calculateNextReviewFromFeedback(
            reviewingTopic.level,
            feedback
        );

        await updateTopic(reviewingTopic.id, {
            level: nextLevel,
            next_review_at: nextReviewAt,
            last_reviewed_at: Date.now(),
            review_count: reviewingTopic.review_count + 1,
            is_mastered: nowMastered,
            decay_state: 'fresh',
        });

        setShowReviewModal(false);
        setReviewingTopic(null);
        loadTopics();
        loadCompletedRevisions();
    };

    const handleDeleteTopic = (topic: StudyTopic) => {
        Alert.alert(
            'Delete Topic',
            `Are you sure you want to delete "${topic.topic}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteTopic(topic.id) },
            ]
        );
    };

    const styles = createStyles(colors);

    // Render topic card
    const renderTopicCard = (topic: StudyTopic, showReviewBtn: boolean = false) => (
        <GlassCard depth={1} style={styles.topicCard} key={topic.id}>
            <View style={styles.topicHeader}>
                <View style={styles.topicInfo}>
                    <Text style={styles.topicName}>{topic.topic}</Text>
                    <View style={styles.topicMeta}>
                        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(topic.priority) }]}>
                            <Text style={styles.priorityText}>{topic.priority}</Text>
                        </View>
                        <Text style={styles.levelText}>Level {topic.level}</Text>
                        {topic.is_mastered && (
                            <View style={styles.masteredBadge}>
                                <Ionicons name="trophy" size={12} color="#22C55E" />
                                <Text style={styles.masteredText}>Mastered</Text>
                            </View>
                        )}
                    </View>
                </View>
                <Pressable onPress={() => handleDeleteTopic(topic)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </Pressable>
            </View>

            <View style={styles.levelProgressBg}>
                <View
                    style={[
                        styles.levelProgressFill,
                        {
                            width: `${getLevelProgress(topic.level)}%`,
                            backgroundColor: topic.is_mastered ? '#22C55E' : '#3B82F6'
                        }
                    ]}
                />
            </View>

            <View style={styles.topicFooter}>
                <Text style={styles.nextReviewText}>
                    {needsReviewToday(topic.next_review_at)
                        ? '🔥 Due now'
                        : `Next: ${getIntervalDescription(topic.level)}`}
                </Text>
                {showReviewBtn && (
                    <GlassButton
                        title="Review"
                        size="small"
                        variant="primary"
                        onPress={() => handleStartReview(topic)}
                    />
                )}
            </View>
        </GlassCard>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Header */}
                <Animated.View entering={FadeInDown.delay(100)}>
                    <Text style={styles.title}>CogniFlow</Text>
                    <Text style={styles.subtitle}>Level-based Spaced Repetition</Text>
                </Animated.View>

                {/* Progress Dashboard */}
                <Animated.View entering={FadeInDown.delay(150)} style={styles.dashboard}>
                    <GlassCard depth={2} style={styles.progressCard}>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressTitle}>Daily Goal</Text>
                            <Text style={styles.progressCount}>{todayReviews}/{dailyGoal}</Text>
                        </View>
                        <View style={styles.progressBarBg}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${Math.min(100, (todayReviews / dailyGoal) * 100)}%` }
                                ]}
                            />
                        </View>
                    </GlassCard>

                    <View style={styles.statsRow}>
                        <GlassCard depth={1} style={styles.statCard}>
                            <Ionicons name="flash" size={20} color="#FBBF24" />
                            <Text style={styles.statValue}>{organizedTopics.forReview.length}</Text>
                            <Text style={styles.statLabel}>Due Today</Text>
                        </GlassCard>
                        <GlassCard depth={1} style={styles.statCard}>
                            <Ionicons name="book" size={20} color="#8B5CF6" />
                            <Text style={styles.statValue}>{learntToday.length}</Text>
                            <Text style={styles.statLabel}>Learnt Today</Text>
                        </GlassCard>
                        <GlassCard depth={1} style={styles.statCard}>
                            <Ionicons name="trophy" size={20} color="#22C55E" />
                            <Text style={styles.statValue}>{masteryPercent}%</Text>
                            <Text style={styles.statLabel}>Mastered</Text>
                        </GlassCard>
                    </View>
                </Animated.View>

                {/* Search & Filter */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.filterSection}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={18} color={colors.textSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search topics or tags..."
                            placeholderTextColor={colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    <View style={styles.priorityFilter}>
                        {(['all', 'high', 'medium', 'low'] as PriorityFilter[]).map(p => (
                            <Pressable
                                key={p}
                                style={[styles.filterChip, priorityFilter === p && styles.filterChipActive]}
                                onPress={() => setPriorityFilter(p)}
                            >
                                <Text style={[styles.filterChipText, priorityFilter === p && styles.filterChipTextActive]}>
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </Animated.View>

                {/* Tabs */}
                <Animated.View entering={FadeInDown.delay(250)} style={styles.tabsContainer}>
                    {([
                        { key: 'review', label: 'For Review', count: organizedTopics.forReview.length, icon: 'time' },
                        { key: 'upcoming', label: 'Upcoming', count: topics.filter(t => !needsReviewToday(t.next_review_at) && !t.is_mastered).length, icon: 'calendar' },
                        { key: 'mastered', label: 'Mastered', count: organizedTopics.mastered.length, icon: 'trophy' },
                    ] as const).map(tab => (
                        <Pressable
                            key={tab.key}
                            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                            onPress={() => setActiveTab(tab.key)}
                        >
                            <Ionicons
                                name={tab.icon as any}
                                size={16}
                                color={activeTab === tab.key ? colors.accentPositive : colors.textSecondary}
                            />
                            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                                {tab.label}
                            </Text>
                            <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                                <Text style={styles.tabBadgeText}>{tab.count}</Text>
                            </View>
                        </Pressable>
                    ))}
                </Animated.View>

                {/* Add Button */}
                <Animated.View entering={FadeInDown.delay(300)}>
                    <GlassButton
                        title="What did you learn today?"
                        onPress={() => setShowAddModal(true)}
                        fullWidth
                        icon={<Ionicons name="add-circle" size={20} color={colors.textPrimary} />}
                    />
                </Animated.View>

                {/* Content based on tab */}
                <Animated.View entering={FadeInUp.delay(350)} style={styles.topicList}>
                    {activeTab === 'review' && (
                        <>
                            {/* Learnt Today Section */}
                            {learntToday.length > 0 && (
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="book" size={18} color="#8B5CF6" />
                                        <Text style={styles.sectionTitle}>Learnt Today</Text>
                                        <View style={styles.sectionBadge}>
                                            <Text style={styles.sectionBadgeText}>{learntToday.length}</Text>
                                        </View>
                                    </View>
                                    {learntToday.map(topic => renderTopicCard(topic, true))}
                                </View>
                            )}

                            {/* Due Reviews Section */}
                            {organizedTopics.forReview.length > 0 && (
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="refresh" size={18} color="#FBBF24" />
                                        <Text style={styles.sectionTitle}>Due for Review</Text>
                                        <View style={styles.sectionBadge}>
                                            <Text style={styles.sectionBadgeText}>{organizedTopics.forReview.length}</Text>
                                        </View>
                                    </View>
                                    {organizedTopics.forReview.map(topic => renderTopicCard(topic, true))}
                                </View>
                            )}

                            {learntToday.length === 0 && organizedTopics.forReview.length === 0 && (
                                <GlassCard depth={1} style={styles.emptyCard}>
                                    <Ionicons name="checkmark-circle" size={48} color={colors.textSecondary} />
                                    <Text style={styles.emptyText}>All caught up! No reviews due.</Text>
                                    <Text style={styles.emptySubtext}>Add something you learned today 👆</Text>
                                </GlassCard>
                            )}
                        </>
                    )}

                    {activeTab === 'upcoming' && (
                        <>
                            {organizedTopics.upcoming.length === 0 ? (
                                <GlassCard depth={1} style={styles.emptyCard}>
                                    <Ionicons name="calendar" size={48} color={colors.textSecondary} />
                                    <Text style={styles.emptyText}>No upcoming reviews</Text>
                                    <Text style={styles.emptySubtext}>Start learning something new!</Text>
                                </GlassCard>
                            ) : (
                                organizedTopics.upcoming.map(group => (
                                    <View key={group.date} style={styles.dateGroup}>
                                        {/* Date Header */}
                                        <View style={styles.dateHeader}>
                                            <Ionicons name="calendar-outline" size={16} color={colors.accentPositive} />
                                            <Text style={styles.dateLabel}>{group.dateLabel}</Text>
                                            <Text style={styles.dateCount}>
                                                {group.learntToday.length + group.revisions.length} items
                                            </Text>
                                        </View>

                                        {/* Learnt Today under this date */}
                                        {group.learntToday.length > 0 && (
                                            <View style={styles.subSection}>
                                                <View style={styles.subSectionHeader}>
                                                    <Ionicons name="book-outline" size={14} color="#8B5CF6" />
                                                    <Text style={styles.subSectionTitle}>New Topics</Text>
                                                </View>
                                                {group.learntToday.map(topic => renderTopicCard(topic, false))}
                                            </View>
                                        )}

                                        {/* Revisions under this date */}
                                        {group.revisions.length > 0 && (
                                            <View style={styles.subSection}>
                                                <View style={styles.subSectionHeader}>
                                                    <Ionicons name="refresh-outline" size={14} color="#FBBF24" />
                                                    <Text style={styles.subSectionTitle}>Revisions</Text>
                                                </View>
                                                {group.revisions.map(topic => renderTopicCard(topic, false))}
                                            </View>
                                        )}
                                    </View>
                                ))
                            )}
                        </>
                    )}

                    {activeTab === 'mastered' && (
                        <>
                            {organizedTopics.mastered.length === 0 ? (
                                <GlassCard depth={1} style={styles.emptyCard}>
                                    <Ionicons name="trophy" size={48} color={colors.textSecondary} />
                                    <Text style={styles.emptyText}>No mastered topics yet</Text>
                                    <Text style={styles.emptySubtext}>Keep reviewing to reach Level 5!</Text>
                                </GlassCard>
                            ) : (
                                organizedTopics.mastered.map(topic => renderTopicCard(topic, false))
                            )}
                        </>
                    )}
                </Animated.View>
            </ScrollView>

            {/* Add Topic Modal */}
            <GlassModal visible={showAddModal} onClose={() => setShowAddModal(false)}>
                <Text style={styles.modalTitle}>What did you learn today?</Text>
                <GlassInput
                    label="Topic"
                    placeholder="e.g., Newton's Laws of Motion"
                    value={newTopic}
                    onChangeText={setNewTopic}
                    containerStyle={styles.modalInput}
                />
                <Text style={styles.inputLabel}>Priority</Text>
                <View style={styles.priorityButtons}>
                    {(['high', 'medium', 'low'] as const).map(p => (
                        <Pressable
                            key={p}
                            style={[styles.priorityBtn, newPriority === p && styles.priorityBtnActive]}
                            onPress={() => setNewPriority(p)}
                        >
                            <Text style={[styles.priorityBtnText, newPriority === p && styles.priorityBtnTextActive]}>
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                            </Text>
                        </Pressable>
                    ))}
                </View>
                <GlassInput
                    label="Tags (optional)"
                    placeholder="e.g., physics, mechanics"
                    value={newTags}
                    onChangeText={setNewTags}
                    containerStyle={styles.modalInput}
                />
                <View style={styles.modalButtons}>
                    <GlassButton title="Cancel" onPress={() => setShowAddModal(false)} variant="ghost" />
                    <GlassButton title="Add" onPress={handleAddTopic} variant="primary" disabled={!newTopic.trim()} />
                </View>
            </GlassModal>

            {/* Review Modal */}
            <GlassModal visible={showReviewModal} onClose={() => setShowReviewModal(false)}>
                <Text style={styles.modalTitle}>Review Complete!</Text>
                {reviewingTopic && (
                    <>
                        <Text style={styles.reviewTopicName}>{reviewingTopic.topic}</Text>
                        <Text style={styles.reviewPrompt}>How well did you remember this?</Text>

                        <View style={styles.feedbackButtons}>
                            {([
                                { key: 'again', label: 'Again', sublabel: 'Reset to Level 0', icon: 'refresh' },
                                { key: 'hard', label: 'Hard', sublabel: 'Go back a level', icon: 'arrow-down' },
                                { key: 'good', label: 'Good', sublabel: 'Stay at level', icon: 'checkmark' },
                                { key: 'easy', label: 'Easy', sublabel: 'Level up!', icon: 'arrow-up' },
                            ] as const).map(fb => (
                                <Pressable
                                    key={fb.key}
                                    style={[styles.feedbackBtn, { borderColor: getFeedbackColor(fb.key) }]}
                                    onPress={() => handleReviewFeedback(fb.key)}
                                >
                                    <Ionicons name={fb.icon as any} size={24} color={getFeedbackColor(fb.key)} />
                                    <Text style={[styles.feedbackLabel, { color: getFeedbackColor(fb.key) }]}>{fb.label}</Text>
                                    <Text style={styles.feedbackSublabel}>{fb.sublabel}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </>
                )}
            </GlassModal>
        </SafeAreaView>
    );
}

function getPriorityColor(priority: string): string {
    switch (priority) {
        case 'high': return 'rgba(239, 68, 68, 0.3)';
        case 'medium': return 'rgba(251, 191, 36, 0.3)';
        case 'low': return 'rgba(34, 197, 94, 0.3)';
        default: return 'rgba(107, 114, 128, 0.3)';
    }
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
        fontSize: 32,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    // Dashboard
    dashboard: {
        marginBottom: spacing.lg,
    },
    progressCard: {
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    progressTitle: {
        fontSize: typography.body.fontSize,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    progressCount: {
        fontSize: typography.body.fontSize,
        color: colors.accentPositive,
        fontWeight: '700',
    },
    progressBarBg: {
        height: 8,
        backgroundColor: colors.glassSurface,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: colors.accentPositive,
        borderRadius: 4,
    },
    statsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    statCard: {
        flex: 1,
        padding: spacing.md,
        alignItems: 'center',
        gap: spacing.xs,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    statLabel: {
        fontSize: 10,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    // Filter Section
    filterSection: {
        marginBottom: spacing.md,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glassSurface,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    searchInput: {
        flex: 1,
        paddingVertical: spacing.sm,
        paddingLeft: spacing.sm,
        color: colors.textPrimary,
        fontSize: typography.body.fontSize,
    },
    priorityFilter: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    filterChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 20,
        backgroundColor: colors.glassSurface,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    filterChipActive: {
        backgroundColor: colors.accentPositive,
        borderColor: colors.accentPositive,
    },
    filterChipText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    filterChipTextActive: {
        color: '#000',
        fontWeight: '600',
    },
    // Tabs
    tabsContainer: {
        flexDirection: 'row',
        marginBottom: spacing.md,
        gap: spacing.xs,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: spacing.sm,
        borderRadius: 12,
        backgroundColor: colors.glassSurface,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    tabActive: {
        borderColor: colors.accentPositive,
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
    },
    tabText: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    tabTextActive: {
        color: colors.accentPositive,
        fontWeight: '600',
    },
    tabBadge: {
        backgroundColor: colors.glassBorder,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    tabBadgeActive: {
        backgroundColor: colors.accentPositive,
    },
    tabBadgeText: {
        fontSize: 10,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    // Sections
    section: {
        marginBottom: spacing.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.h3.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        flex: 1,
    },
    sectionBadge: {
        backgroundColor: colors.glassSurface,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    sectionBadgeText: {
        fontSize: 12,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    // Date Groups (Upcoming)
    dateGroup: {
        marginBottom: spacing.xl,
    },
    dateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.glassBorder,
    },
    dateLabel: {
        fontSize: typography.h3.fontSize,
        fontWeight: '700',
        color: colors.textPrimary,
        flex: 1,
    },
    dateCount: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    subSection: {
        marginBottom: spacing.md,
        marginLeft: spacing.md,
    },
    subSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    subSectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    // Topic List
    topicList: {
        marginTop: spacing.md,
    },
    emptyCard: {
        padding: spacing.xxl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        marginTop: spacing.md,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        textAlign: 'center',
    },
    topicCard: {
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    topicHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    topicInfo: {
        flex: 1,
    },
    topicName: {
        fontSize: typography.body.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    topicMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    priorityBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    priorityText: {
        fontSize: 10,
        color: colors.textPrimary,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    levelText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    masteredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    masteredText: {
        fontSize: 11,
        color: '#22C55E',
        fontWeight: '600',
    },
    deleteBtn: {
        padding: 4,
    },
    levelProgressBg: {
        height: 4,
        backgroundColor: colors.glassSurface,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    levelProgressFill: {
        height: '100%',
        borderRadius: 2,
    },
    topicFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    nextReviewText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    // Modal
    modalTitle: {
        fontSize: typography.h2.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    modalInput: {
        marginBottom: spacing.md,
    },
    inputLabel: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    priorityButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    priorityBtn: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        alignItems: 'center',
    },
    priorityBtnActive: {
        borderColor: colors.accentPositive,
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
    },
    priorityBtnText: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
    },
    priorityBtnTextActive: {
        color: colors.accentPositive,
        fontWeight: '600',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
    },
    // Review Modal
    reviewTopicName: {
        fontSize: typography.h3.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    reviewPrompt: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    feedbackButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    feedbackBtn: {
        width: '48%',
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        backgroundColor: colors.glassSurface,
    },
    feedbackLabel: {
        fontSize: typography.body.fontSize,
        fontWeight: '700',
        marginTop: spacing.xs,
    },
    feedbackSublabel: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
    },
});
