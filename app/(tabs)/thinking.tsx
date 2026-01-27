// Thinking Screen
// Thinking engine with 4 modes and structured questions

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
import Animated, {
    FadeInDown,
    FadeInUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard, GlassButton, GlassInput, GlassModal } from '@/components/glass';
import { useAppStore, useThoughtsStore, useThemeStore } from '@/stores';
import {
    THINKING_MODES,
    ThinkingMode,
    getModeList,
    getQuestion,
    hasMoreQuestions,
} from '@/engines/thinking/modes';
import { spacing, typography } from '@/styles/theme';
import { Thought } from '@/database/schema';
import { useAnimationKey } from '@/utils/animations';

export default function ThinkingScreen() {
    const animationKey = useAnimationKey();
    const { colors, colorScheme } = useThemeStore();
    const {
        currentThinkingMode,
        setThinkingMode,
        currentQuestionIndex,
        setQuestionIndex,
    } = useAppStore();

    const { addThought, loadThoughts, thoughts, updateThought, deleteThought } = useThoughtsStore();

    const [answer, setAnswer] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingThought, setEditingThought] = useState<Thought | null>(null);
    const [editAnswer, setEditAnswer] = useState('');

    const modes = getModeList();
    const currentMode = THINKING_MODES[currentThinkingMode];
    const currentQuestion = getQuestion(currentThinkingMode, currentQuestionIndex);

    useEffect(() => {
        loadThoughts();
    }, []);

    const handleModeSelect = (mode: ThinkingMode) => {
        setThinkingMode(mode);
        setQuestionIndex(0);
        setAnswer('');
    };

    const handleSubmitAnswer = async () => {
        if (!answer.trim() || !currentQuestion) return;

        await addThought(currentThinkingMode, currentQuestion, answer);
        setAnswer('');

        if (hasMoreQuestions(currentThinkingMode, currentQuestionIndex)) {
            setQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const handleNextQuestion = () => {
        if (hasMoreQuestions(currentThinkingMode, currentQuestionIndex)) {
            setQuestionIndex(currentQuestionIndex + 1);
            setAnswer('');
        }
    };

    const handlePreviousQuestion = () => {
        if (currentQuestionIndex > 0) {
            setQuestionIndex(currentQuestionIndex - 1);
            setAnswer('');
        }
    };

    const handleEditThought = (thought: Thought) => {
        setEditingThought(thought);
        setEditAnswer(thought.answer);
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingThought || !editAnswer.trim()) return;
        await updateThought(editingThought.id, editAnswer);
        setShowEditModal(false);
        setEditingThought(null);
        setEditAnswer('');
    };

    const handleDeleteThought = (thought: Thought) => {
        Alert.alert(
            'Delete Thought',
            'Are you sure you want to delete this thought? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteThought(thought.id),
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

    const isEdited = (thought: Thought) => {
        return thought.updated_at > thought.created_at;
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
                    <Text style={styles.title}>Thinking</Text>
                    <Text style={styles.subtitle}>
                        Choose a mode and confront your thoughts
                    </Text>
                </Animated.View>

                {/* Mode Selector */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.modesContainer}>
                    {modes.map((mode) => {
                        const config = THINKING_MODES[mode];
                        const isActive = currentThinkingMode === mode;
                        return (
                            <Pressable
                                key={mode}
                                onPress={() => handleModeSelect(mode)}
                            >
                                <GlassCard
                                    depth={isActive ? 2 : 1}
                                    style={[
                                        styles.modeCard,
                                        isActive ? { borderColor: config.color, borderWidth: 2 } : {},
                                    ]}
                                >
                                    <Ionicons
                                        name={config.icon as any}
                                        size={24}
                                        color={isActive ? config.color : colors.textSecondary}
                                    />
                                    <Text
                                        style={[
                                            styles.modeName,
                                            isActive && { color: config.color },
                                        ]}
                                    >
                                        {config.name}
                                    </Text>
                                </GlassCard>
                            </Pressable>
                        );
                    })}
                </Animated.View>

                {/* Current Question */}
                {currentQuestion && (
                    <Animated.View entering={FadeInUp.delay(300)}>
                        <GlassCard depth={2} style={styles.questionCard}>
                            <View style={styles.questionHeader}>
                                <Text style={[styles.modeLabel, { color: currentMode.color }]}>
                                    {currentMode.name} Mode
                                </Text>
                                <Text style={styles.questionProgress}>
                                    {currentQuestionIndex + 1} / {currentMode.questions.length}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.questionText,
                                    { fontFamily: currentMode.fontFamily },
                                ]}
                            >
                                {currentQuestion}
                            </Text>
                        </GlassCard>
                    </Animated.View>
                )}

                {/* Answer Input */}
                <Animated.View entering={FadeInUp.delay(400)} style={styles.answerSection}>
                    <GlassInput
                        placeholder="Write your answer..."
                        value={answer}
                        onChangeText={setAnswer}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />

                    {/* Submit Button - More Prominent */}
                    <GlassButton
                        title="Submit Answer"
                        onPress={handleSubmitAnswer}
                        variant="primary"
                        disabled={!answer.trim()}
                        icon={<Ionicons name="checkmark-circle" size={20} color={colorScheme === 'dark' ? '#FFFFFF' : '#1A1A1A'} />}
                        style={styles.submitButton}
                    />

                    <View style={styles.buttonRow}>
                        <GlassButton
                            title="Previous"
                            onPress={handlePreviousQuestion}
                            variant="ghost"
                            disabled={currentQuestionIndex === 0}
                            icon={<Ionicons name="chevron-back" size={18} color={colors.textSecondary} />}
                        />
                        <GlassButton
                            title="Skip"
                            onPress={handleNextQuestion}
                            variant="ghost"
                            disabled={!hasMoreQuestions(currentThinkingMode, currentQuestionIndex)}
                            icon={<Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
                        />
                    </View>
                </Animated.View>

                {/* Recent Thoughts */}
                {thoughts.length > 0 && (
                    <Animated.View entering={FadeInUp.delay(500)} style={styles.historySection}>
                        <Text style={styles.sectionTitle}>Recent Thoughts</Text>
                        {thoughts.slice(0, 10).map((thought) => {
                            const config = THINKING_MODES[thought.mode];
                            const edited = isEdited(thought);
                            return (
                                <GlassCard
                                    key={thought.id}
                                    depth={1}
                                    style={styles.thoughtCard}
                                >
                                    <View style={styles.thoughtHeader}>
                                        <View style={styles.thoughtMeta}>
                                            <View
                                                style={[styles.thoughtDot, { backgroundColor: config.color }]}
                                            />
                                            <Text style={styles.thoughtMode}>{config.name}</Text>
                                            {edited && (
                                                <View style={styles.editedBadge}>
                                                    <Text style={styles.editedText}>edited</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.thoughtActions}>
                                            <Pressable
                                                onPress={() => handleEditThought(thought)}
                                                style={styles.actionBtn}
                                            >
                                                <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                                            </Pressable>
                                            <Pressable
                                                onPress={() => handleDeleteThought(thought)}
                                                style={styles.actionBtn}
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                            </Pressable>
                                        </View>
                                    </View>
                                    <Text style={styles.thoughtQuestion}>{thought.question}</Text>
                                    <Text style={styles.thoughtAnswer} numberOfLines={3}>
                                        {thought.answer}
                                    </Text>
                                    <Text style={styles.thoughtTime}>
                                        {formatTime(thought.created_at)}
                                        {edited && ` • Updated ${formatTime(thought.updated_at)}`}
                                    </Text>
                                </GlassCard>
                            );
                        })}
                    </Animated.View>
                )}
            </ScrollView>

            {/* Edit Modal */}
            <GlassModal visible={showEditModal} onClose={() => setShowEditModal(false)}>
                <Text style={styles.modalTitle}>Edit Thought</Text>
                {editingThought && (
                    <Text style={styles.modalQuestion}>{editingThought.question}</Text>
                )}
                <GlassInput
                    placeholder="Your answer..."
                    value={editAnswer}
                    onChangeText={setEditAnswer}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
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
                        disabled={!editAnswer.trim()}
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
    modesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    modeCard: {
        padding: spacing.md,
        alignItems: 'center',
        minWidth: 80,
    },
    modeName: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        textAlign: 'center',
    },
    questionCard: {
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    questionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    modeLabel: {
        fontSize: typography.caption.fontSize,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    questionProgress: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
    },
    questionText: {
        fontSize: typography.h3.fontSize,
        fontWeight: '500',
        color: colors.textPrimary,
        lineHeight: 28,
    },
    answerSection: {
        marginBottom: spacing.xl,
    },
    submitButton: {
        marginTop: spacing.md,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.md,
    },
    historySection: {
        marginTop: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.h3.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: spacing.md,
    },
    thoughtCard: {
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    thoughtHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    thoughtMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    thoughtDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    thoughtMode: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
    },
    editedBadge: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: spacing.xs,
    },
    editedText: {
        fontSize: 10,
        color: '#FBBF24',
        fontWeight: '600',
    },
    thoughtActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    actionBtn: {
        padding: 4,
    },
    thoughtQuestion: {
        fontSize: typography.bodySmall.fontSize,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    thoughtAnswer: {
        fontSize: typography.body.fontSize,
        color: colors.textPrimary,
        lineHeight: 22,
    },
    thoughtTime: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
    modalTitle: {
        fontSize: typography.h2.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    modalQuestion: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        marginBottom: spacing.md,
        fontStyle: 'italic',
    },
    modalInput: {
        marginBottom: spacing.lg,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
    },
});
