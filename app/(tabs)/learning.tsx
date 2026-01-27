// Learning Screen
// Study tracking with spaced repetition and memory decay visualization

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard, GlassButton, GlassInput, GlassModal } from '@/components/glass';
import { IntegrityBar } from '@/components/IntegrityBar';
import { useAppStore, useLearningStore, useThemeStore } from '@/stores';
import { spacing, typography } from '@/styles/theme';
import { getDecayColor, needsReviewToday } from '@/engines/learning/spacedRepetition';
import { StudyTopic } from '@/database/schema';
import { useAnimationKey } from '@/utils/animations';

export default function LearningScreen() {
    const animationKey = useAnimationKey();
    const { colors, colorScheme } = useThemeStore();
    const { showDailyPrompt, setShowDailyPrompt, lastPromptDate, setLastPromptDate } = useAppStore();
    const { topics, dueRevisions, loadTopics, loadDueRevisions, addTopic, completeRevision, updateTopic, deleteTopic } = useLearningStore();

    const [newTopic, setNewTopic] = useState('');
    const [timeSpent, setTimeSpent] = useState('');
    const [confidence, setConfidence] = useState(50);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTopic, setEditingTopic] = useState<StudyTopic | null>(null);
    const [editTopicName, setEditTopicName] = useState('');

    useEffect(() => {
        loadTopics();
        loadDueRevisions();

        // Check if we should show daily prompt
        const today = new Date().toISOString().split('T')[0];
        if (lastPromptDate !== today) {
            setShowDailyPrompt(true);
        }
    }, []);

    const handleAddStudy = async () => {
        if (!newTopic.trim()) return;

        await addTopic(newTopic, parseInt(timeSpent) || 0, confidence);
        setNewTopic('');
        setTimeSpent('');
        setConfidence(50);
        setShowAddModal(false);
        setShowDailyPrompt(false);
        setLastPromptDate(new Date().toISOString().split('T')[0]);
    };

    const handleDismissPrompt = () => {
        setShowDailyPrompt(false);
        setLastPromptDate(new Date().toISOString().split('T')[0]);
    };

    const handleCompleteRevision = async (revisionId: string) => {
        await completeRevision(revisionId, 70); // Default confidence after review
    };

    const handleEditTopic = (topic: StudyTopic) => {
        setEditingTopic(topic);
        setEditTopicName(topic.topic);
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingTopic || !editTopicName.trim()) return;
        await updateTopic(editingTopic.id, { topic: editTopicName });
        setShowEditModal(false);
        setEditingTopic(null);
        setEditTopicName('');
    };

    const handleDeleteTopic = (topic: StudyTopic) => {
        Alert.alert(
            'Delete Topic',
            `Are you sure you want to delete "${topic.topic}"? This will remove all revision history.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteTopic(topic.id),
                },
            ]
        );
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const isEdited = (topic: StudyTopic) => {
        return topic.updated_at > topic.created_at + 1000; // 1 second buffer
    };

    const topicsNeedingReview = topics.filter(t => needsReviewToday(t.next_review_at));
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
                    <Text style={styles.title}>Learning</Text>
                    <Text style={styles.subtitle}>
                        Track your studies and fight the forgetting curve
                    </Text>
                </Animated.View>

                {/* Due Revisions Alert */}
                {topicsNeedingReview.length > 0 && (
                    <Animated.View key={`alert-${animationKey}`} entering={FadeInDown.delay(200)}>
                        <GlassCard depth={2} style={styles.alertCard}>
                            <View style={styles.alertHeader}>
                                <Ionicons name="alert-circle" size={24} color="#FBBF24" />
                                <Text style={styles.alertTitle}>Revisions Due</Text>
                            </View>
                            <Text style={styles.alertText}>
                                {topicsNeedingReview.length} topic{topicsNeedingReview.length > 1 ? 's' : ''} need{topicsNeedingReview.length === 1 ? 's' : ''} review today
                            </Text>
                            <View style={styles.dueList}>
                                {topicsNeedingReview.slice(0, 3).map((topic) => (
                                    <View key={topic.id} style={styles.dueItem}>
                                        <View style={[styles.dueDot, { backgroundColor: getDecayColor(topic.decay_state) }]} />
                                        <Text style={styles.dueText} numberOfLines={1}>{topic.topic}</Text>
                                        <GlassButton
                                            title="Review"
                                            size="small"
                                            variant="primary"
                                            onPress={() => { }}
                                        />
                                    </View>
                                ))}
                            </View>
                        </GlassCard>
                    </Animated.View>
                )}

                {/* Add Study Button */}
                <Animated.View key={`add-${animationKey}`} entering={FadeInDown.delay(300)} style={styles.addSection}>
                    <GlassButton
                        title="What did you study today?"
                        onPress={() => setShowAddModal(true)}
                        fullWidth
                        icon={<Ionicons name="add-circle-outline" size={20} color={colors.textPrimary} />}
                    />
                </Animated.View>

                {/* Topics List */}
                <Animated.View key={`list-${animationKey}`} entering={FadeInUp.delay(400)}>
                    <Text style={styles.sectionTitle}>Your Topics</Text>
                    {topics.length === 0 ? (
                        <GlassCard depth={1} style={styles.emptyCard}>
                            <Ionicons name="book-outline" size={48} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>No topics yet</Text>
                            <Text style={styles.emptySubtext}>Start tracking your learning</Text>
                        </GlassCard>
                    ) : (
                        topics.map((topic, index) => {
                            const edited = isEdited(topic);
                            return (
                                <Animated.View
                                    key={topic.id}
                                    entering={FadeInUp.delay(400 + index * 50)}
                                >
                                    <GlassCard depth={1} style={styles.topicCard}>
                                        <View style={styles.topicHeader}>
                                            <View style={styles.topicMeta}>
                                                <Text style={styles.topicName}>{topic.topic}</Text>
                                                {edited && (
                                                    <View style={styles.editedBadge}>
                                                        <Text style={styles.editedText}>edited</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.topicActions}>
                                                <Pressable
                                                    onPress={() => handleEditTopic(topic)}
                                                    style={styles.actionBtn}
                                                >
                                                    <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                                                </Pressable>
                                                <Pressable
                                                    onPress={() => handleDeleteTopic(topic)}
                                                    style={styles.actionBtn}
                                                >
                                                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                                </Pressable>
                                            </View>
                                        </View>
                                        <View style={styles.topicStats}>
                                            <Text style={styles.topicTime}>{topic.time_spent_minutes} min studied</Text>
                                            <Text style={styles.topicReviews}>{topic.review_count} reviews</Text>
                                        </View>
                                        <IntegrityBar
                                            percent={topic.integrity_percent}
                                            state={topic.decay_state}
                                        />
                                        <View style={styles.topicFooter}>
                                            <Text style={styles.topicConfidence}>
                                                Confidence: {topic.confidence_level}%
                                            </Text>
                                            {topic.next_review_at && (
                                                <Text style={styles.topicReview}>
                                                    Next: {new Date(topic.next_review_at).toLocaleDateString()}
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={styles.topicTimestamp}>
                                            Added {formatTime(topic.created_at)}
                                            {edited && ` • Updated ${formatTime(topic.updated_at)}`}
                                        </Text>
                                    </GlassCard>
                                </Animated.View>
                            );
                        })
                    )}
                </Animated.View>
            </ScrollView>

            {/* Add Study Modal */}
            <GlassModal
                visible={showAddModal || showDailyPrompt}
                onClose={() => {
                    setShowAddModal(false);
                    if (showDailyPrompt) handleDismissPrompt();
                }}
            >
                <Text style={styles.modalTitle}>What did you study today?</Text>
                <GlassInput
                    label="Topic"
                    placeholder="e.g., Calculus - Integration"
                    value={newTopic}
                    onChangeText={setNewTopic}
                    containerStyle={styles.modalInput}
                />
                <GlassInput
                    label="Time spent (minutes)"
                    placeholder="e.g., 45"
                    value={timeSpent}
                    onChangeText={setTimeSpent}
                    keyboardType="numeric"
                    containerStyle={styles.modalInput}
                />
                <View style={styles.confidenceSection}>
                    <Text style={styles.confidenceLabel}>
                        How confident are you? {confidence}%
                    </Text>
                    <View style={styles.confidenceButtons}>
                        {[25, 50, 75, 100].map((level) => (
                            <Pressable
                                key={level}
                                onPress={() => setConfidence(level)}
                                style={[
                                    styles.confidenceBtn,
                                    confidence === level && styles.confidenceBtnActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.confidenceBtnText,
                                        confidence === level && styles.confidenceBtnTextActive,
                                    ]}
                                >
                                    {level}%
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
                <View style={styles.modalButtons}>
                    {showDailyPrompt && (
                        <GlassButton
                            title="Skip Today"
                            onPress={handleDismissPrompt}
                            variant="ghost"
                        />
                    )}
                    <GlassButton
                        title="Save"
                        onPress={handleAddStudy}
                        variant="primary"
                        disabled={!newTopic.trim()}
                    />
                </View>
            </GlassModal>

            {/* Edit Topic Modal */}
            <GlassModal visible={showEditModal} onClose={() => setShowEditModal(false)}>
                <Text style={styles.modalTitle}>Edit Topic</Text>
                <GlassInput
                    label="Topic Name"
                    placeholder="Topic name..."
                    value={editTopicName}
                    onChangeText={setEditTopicName}
                    containerStyle={styles.modalInput}
                />
                <View style={styles.modalButtons}>
                    <GlassButton
                        title="Cancel"
                        onPress={() => setShowEditModal(false)}
                        variant="ghost"
                    />
                    <GlassButton
                        title="Save"
                        onPress={handleSaveEdit}
                        variant="primary"
                        disabled={!editTopicName.trim()}
                    />
                </View>
            </GlassModal>
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
    alertCard: {
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderColor: 'rgba(251, 191, 36, 0.3)',
        borderWidth: 1,
    },
    alertHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    alertTitle: {
        fontSize: typography.h3.fontSize,
        fontWeight: '600',
        color: '#FBBF24',
    },
    alertText: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    dueList: {
        gap: spacing.sm,
    },
    dueItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    dueDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dueText: {
        flex: 1,
        fontSize: typography.body.fontSize,
        color: colors.textPrimary,
    },
    addSection: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.h3.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: spacing.md,
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
    },
    topicCard: {
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    topicHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    topicMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    topicName: {
        fontSize: typography.body.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        flex: 1,
    },
    editedBadge: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    editedText: {
        fontSize: 10,
        color: '#FBBF24',
        fontWeight: '600',
    },
    topicActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    actionBtn: {
        padding: 4,
    },
    topicStats: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    topicTime: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
    },
    topicReviews: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
    },
    topicFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.sm,
    },
    topicConfidence: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
    },
    topicReview: {
        fontSize: typography.caption.fontSize,
        color: colors.accentPositive,
    },
    topicTimestamp: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        marginTop: spacing.sm,
        fontStyle: 'italic',
    },
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
    confidenceSection: {
        marginBottom: spacing.lg,
    },
    confidenceLabel: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    confidenceButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    confidenceBtn: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        backgroundColor: colors.glassSurface,
        alignItems: 'center',
    },
    confidenceBtnActive: {
        borderColor: colors.accentPositive,
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
    },
    confidenceBtnText: {
        fontSize: typography.body.fontSize,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    confidenceBtnTextActive: {
        color: colors.accentPositive,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
    },
});
