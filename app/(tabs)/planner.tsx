// Planner Screen
// Cost-based planner with time blocking

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
import { BlurView } from 'expo-blur';
import { GlassCard, GlassButton, GlassInput, GlassModal } from '@/components/glass';
import { useAppStore, usePlannerStore, useThemeStore } from '@/stores';
import { spacing, typography } from '@/styles/theme';
import { formatDate } from '@/database';
import { Task } from '@/database/schema';
import { useAnimationKey } from '@/utils/animations';

const DAILY_PRIORITIES_LIMIT = 3;

export default function PlannerScreen() {
    const animationKey = useAnimationKey();
    const { colors, colorScheme } = useThemeStore();
    const { selectedDate, setSelectedDate } = useAppStore();
    const {
        tasks,
        timeBlocks,
        loadTasks,
        loadTimeBlocks,
        addTask,
        completeTask,
        skipTask,
        updateTask,
        deleteTask,
        loadTodayTasks,
    } = usePlannerStore();

    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [taskName, setTaskName] = useState('');
    const [timeEstimate, setTimeEstimate] = useState('');
    const [selectedPriority, setSelectedPriority] = useState<1 | 2 | 3 | null>(null);
    const [showDecayCost, setShowDecayCost] = useState<string | null>(null);

    const today = formatDate(Date.now());
    const isToday = selectedDate === today;
    const isPast = selectedDate < today;

    useEffect(() => {
        loadTasks(selectedDate);
        loadTimeBlocks(selectedDate);
    }, [selectedDate]);

    const dayTasks = tasks.filter(t => t.scheduled_date === selectedDate);
    const pendingTasks = dayTasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    const completedTasks = dayTasks.filter(t => t.status === 'completed');
    const skippedTasks = dayTasks.filter(t => t.status === 'skipped');

    const handleAddTask = async () => {
        if (!taskName.trim()) return;

        await addTask(
            taskName,
            parseInt(timeEstimate) || 30,
            selectedDate,
            selectedPriority || undefined
        );

        setTaskName('');
        setTimeEstimate('');
        setSelectedPriority(null);
        setShowAddModal(false);
    };

    const handleCompleteTask = async (taskId: string) => {
        await completeTask(taskId);
    };

    const handleSkipTask = async (taskId: string) => {
        await skipTask(taskId);
    };

    const handleEditTask = (task: Task) => {
        setEditingTask(task);
        setTaskName(task.name);
        setTimeEstimate(task.time_estimate_minutes.toString());
        setSelectedPriority(task.priority);
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingTask || !taskName.trim()) return;
        await updateTask(editingTask.id, {
            name: taskName,
            time_estimate_minutes: parseInt(timeEstimate) || 30,
            priority: selectedPriority,
        });
        setShowEditModal(false);
        setEditingTask(null);
        setTaskName('');
        setTimeEstimate('');
        setSelectedPriority(null);
    };

    const handleDeleteTask = (task: Task) => {
        Alert.alert(
            'Delete Task',
            `Are you sure you want to delete "${task.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteTask(task.id),
                },
            ]
        );
    };

    const handleLongPress = (taskId: string) => {
        setShowDecayCost(taskId);
        setTimeout(() => setShowDecayCost(null), 2000);
    };

    const navigateDay = (direction: 'prev' | 'next') => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() + (direction === 'next' ? 1 : -1));
        setSelectedDate(formatDate(current.getTime()));
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const isEdited = (task: Task) => {
        return task.updated_at > task.created_at + 1000;
    };

    const prioritiesUsed = pendingTasks.filter(t => t.priority !== null).length;
    const canAddPriority = prioritiesUsed < DAILY_PRIORITIES_LIMIT;
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
                    <Text style={styles.title}>Planner</Text>
                    <Text style={styles.subtitle}>
                        Max {DAILY_PRIORITIES_LIMIT} priorities per day. Every skip has a cost.
                    </Text>
                </Animated.View>

                {/* Date Navigator */}
                <Animated.View key={`date-${animationKey}`} entering={FadeInDown.delay(200)} style={styles.dateNav}>
                    <Pressable onPress={() => navigateDay('prev')} style={styles.dateBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </Pressable>
                    <View style={styles.dateCenter}>
                        <Text style={styles.dateText}>
                            {isToday ? 'Today' : new Date(selectedDate).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                            })}
                        </Text>
                        {isPast && (
                            <Text style={styles.datePastLabel}>Past - Read Only</Text>
                        )}
                    </View>
                    <Pressable onPress={() => navigateDay('next')} style={styles.dateBtn}>
                        <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
                    </Pressable>
                </Animated.View>

                {/* Priority Counter */}
                <Animated.View key={`priority-${animationKey}`} entering={FadeInDown.delay(250)} style={styles.priorityCounter}>
                    <Text style={styles.priorityLabel}>Priorities Used</Text>
                    <View style={styles.priorityDots}>
                        {[1, 2, 3].map((i) => (
                            <View
                                key={i}
                                style={[
                                    styles.priorityDot,
                                    prioritiesUsed >= i && styles.priorityDotActive,
                                ]}
                            />
                        ))}
                    </View>
                </Animated.View>

                {/* Add Task Button */}
                {!isPast && (
                    <Animated.View key={`add-${animationKey}`} entering={FadeInDown.delay(300)} style={styles.addSection}>
                        <GlassButton
                            title="Add Task"
                            onPress={() => setShowAddModal(true)}
                            fullWidth
                            icon={<Ionicons name="add-circle-outline" size={20} color={colors.textPrimary} />}
                        />
                    </Animated.View>
                )}

                {/* Pending Tasks */}
                {pendingTasks.length > 0 && (
                    <Animated.View key={`pending-${animationKey}`} entering={FadeInUp.delay(400)}>
                        <Text style={styles.sectionTitle}>To Do</Text>
                        {pendingTasks.map((task, index) => {
                            const edited = isEdited(task);
                            return (
                                <Animated.View
                                    key={task.id}
                                    entering={FadeInUp.delay(400 + index * 50)}
                                >
                                    <Pressable
                                        onLongPress={() => handleLongPress(task.id)}
                                        delayLongPress={500}
                                    >
                                        <GlassCard depth={task.priority ? 2 : 1} style={styles.taskCard}>
                                            {task.is_recovery && (
                                                <View style={styles.recoveryBadge}>
                                                    <Text style={styles.recoveryText}>RECOVERY</Text>
                                                </View>
                                            )}
                                            <View style={styles.taskHeader}>
                                                <View style={styles.taskInfo}>
                                                    {task.priority && (
                                                        <View style={styles.priorityBadge}>
                                                            <Text style={styles.priorityBadgeText}>P{task.priority}</Text>
                                                        </View>
                                                    )}
                                                    <Text style={styles.taskName}>{task.name}</Text>
                                                    {edited && (
                                                        <View style={styles.editedBadge}>
                                                            <Text style={styles.editedText}>edited</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={styles.taskActions}>
                                                    <Pressable
                                                        onPress={() => handleEditTask(task)}
                                                        style={styles.actionBtn}
                                                    >
                                                        <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                                                    </Pressable>
                                                    <Pressable
                                                        onPress={() => handleDeleteTask(task)}
                                                        style={styles.actionBtn}
                                                    >
                                                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                                    </Pressable>
                                                </View>
                                            </View>
                                            <View style={styles.taskMeta}>
                                                <Text style={styles.taskTime}>{task.time_estimate_minutes}min</Text>
                                                <Text style={styles.taskTimestamp}>Added {formatTime(task.created_at)}</Text>
                                            </View>

                                            {showDecayCost === task.id && (
                                                <Animated.View entering={FadeInUp} style={styles.decayCostReveal}>
                                                    <Text style={styles.decayCostLabel}>Decay Cost</Text>
                                                    <Text style={styles.decayCostValue}>{task.decay_cost}</Text>
                                                </Animated.View>
                                            )}

                                            {!isPast && (
                                                <View style={styles.taskButtons}>
                                                    <GlassButton
                                                        title="Skip"
                                                        onPress={() => handleSkipTask(task.id)}
                                                        variant="danger"
                                                        size="small"
                                                    />
                                                    <GlassButton
                                                        title="Complete"
                                                        onPress={() => handleCompleteTask(task.id)}
                                                        variant="primary"
                                                        size="small"
                                                    />
                                                </View>
                                            )}
                                        </GlassCard>
                                    </Pressable>
                                </Animated.View>
                            );
                        })}
                    </Animated.View>
                )}

                {/* Completed Tasks */}
                {completedTasks.length > 0 && (
                    <Animated.View key={`completed-${animationKey}`} entering={FadeInUp.delay(500)}>
                        <Text style={styles.sectionTitle}>Completed</Text>
                        {completedTasks.map((task) => (
                            <GlassCard key={task.id} depth={1} style={styles.taskCardDone}>
                                <View style={styles.taskHeader}>
                                    <Ionicons name="checkmark-circle" size={20} color={colors.accentPositive} />
                                    <Text style={styles.taskNameDone}>{task.name}</Text>
                                </View>
                                {task.completed_at && (
                                    <Text style={styles.completedTime}>
                                        Completed at {formatTime(task.completed_at)}
                                    </Text>
                                )}
                            </GlassCard>
                        ))}
                    </Animated.View>
                )}

                {/* Skipped Tasks */}
                {skippedTasks.length > 0 && (
                    <Animated.View key={`skipped-${animationKey}`} entering={FadeInUp.delay(600)}>
                        <Text style={styles.sectionTitle}>Skipped</Text>
                        {skippedTasks.map((task) => (
                            <View key={task.id} style={styles.skippedWrapper}>
                                <BlurView intensity={20} tint={colorScheme} style={styles.skippedBlur} />
                                <GlassCard depth={1} style={styles.taskCardSkipped}>
                                    <Text style={styles.taskNameSkipped}>{task.name}</Text>
                                    <Text style={styles.mutationNote}>→ Mutated to recovery task</Text>
                                </GlassCard>
                            </View>
                        ))}
                    </Animated.View>
                )}

                {/* Empty State */}
                {dayTasks.length === 0 && (
                    <Animated.View key={`empty-${animationKey}`} entering={FadeInUp.delay(400)}>
                        <GlassCard depth={1} style={styles.emptyCard}>
                            <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>No tasks for this day</Text>
                        </GlassCard>
                    </Animated.View>
                )}
            </ScrollView>

            {/* Add Task Modal */}
            <GlassModal visible={showAddModal} onClose={() => setShowAddModal(false)}>
                <Text style={styles.modalTitle}>Add Task</Text>
                <GlassInput
                    label="Task Name"
                    placeholder="What needs to be done?"
                    value={taskName}
                    onChangeText={setTaskName}
                    containerStyle={styles.modalInput}
                />
                <GlassInput
                    label="Time Estimate (minutes)"
                    placeholder="e.g., 45"
                    value={timeEstimate}
                    onChangeText={setTimeEstimate}
                    keyboardType="numeric"
                    containerStyle={styles.modalInput}
                />
                {canAddPriority && (
                    <View style={styles.prioritySection}>
                        <Text style={styles.prioritySelectLabel}>Set Priority (Optional)</Text>
                        <View style={styles.priorityButtons}>
                            {[1, 2, 3].map((p) => (
                                <Pressable
                                    key={p}
                                    onPress={() => setSelectedPriority(selectedPriority === p ? null : p as 1 | 2 | 3)}
                                    style={[
                                        styles.prioritySelectBtn,
                                        selectedPriority === p && styles.prioritySelectBtnActive,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.prioritySelectText,
                                            selectedPriority === p && styles.prioritySelectTextActive,
                                        ]}
                                    >
                                        P{p}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}
                <View style={styles.modalButtons}>
                    <GlassButton
                        title="Cancel"
                        onPress={() => setShowAddModal(false)}
                        variant="ghost"
                    />
                    <GlassButton
                        title="Add Task"
                        onPress={handleAddTask}
                        variant="primary"
                        disabled={!taskName.trim()}
                    />
                </View>
            </GlassModal>

            {/* Edit Task Modal */}
            <GlassModal visible={showEditModal} onClose={() => setShowEditModal(false)}>
                <Text style={styles.modalTitle}>Edit Task</Text>
                <GlassInput
                    label="Task Name"
                    placeholder="What needs to be done?"
                    value={taskName}
                    onChangeText={setTaskName}
                    containerStyle={styles.modalInput}
                />
                <GlassInput
                    label="Time Estimate (minutes)"
                    placeholder="e.g., 45"
                    value={timeEstimate}
                    onChangeText={setTimeEstimate}
                    keyboardType="numeric"
                    containerStyle={styles.modalInput}
                />
                <View style={styles.prioritySection}>
                    <Text style={styles.prioritySelectLabel}>Priority</Text>
                    <View style={styles.priorityButtons}>
                        {[1, 2, 3].map((p) => (
                            <Pressable
                                key={p}
                                onPress={() => setSelectedPriority(selectedPriority === p ? null : p as 1 | 2 | 3)}
                                style={[
                                    styles.prioritySelectBtn,
                                    selectedPriority === p && styles.prioritySelectBtnActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.prioritySelectText,
                                        selectedPriority === p && styles.prioritySelectTextActive,
                                    ]}
                                >
                                    P{p}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
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
                        disabled={!taskName.trim()}
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
    dateNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    dateBtn: {
        padding: spacing.sm,
    },
    dateCenter: {
        alignItems: 'center',
    },
    dateText: {
        fontSize: typography.h2.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    datePastLabel: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        marginTop: 2,
    },
    priorityCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    priorityLabel: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
    },
    priorityDots: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    priorityDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.textSecondary,
    },
    priorityDotActive: {
        backgroundColor: colors.accentPositive,
        borderColor: colors.accentPositive,
    },
    addSection: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.h3.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: spacing.md,
        marginTop: spacing.md,
    },
    taskCard: {
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    recoveryBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: spacing.sm,
    },
    recoveryText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#EF4444',
        letterSpacing: 1,
    },
    taskHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    taskInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
        flexWrap: 'wrap',
    },
    priorityBadge: {
        backgroundColor: colors.accentPositive,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    priorityBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.background,
    },
    taskName: {
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
    taskActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    actionBtn: {
        padding: 4,
    },
    taskMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.xs,
    },
    taskTime: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
    },
    taskTimestamp: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    decayCostReveal: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.glassBorder,
    },
    decayCostLabel: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
    },
    decayCostValue: {
        fontSize: typography.h3.fontSize,
        fontWeight: '700',
        color: '#EF4444',
    },
    taskButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    taskCardDone: {
        padding: spacing.md,
        marginBottom: spacing.sm,
        opacity: 0.7,
    },
    taskNameDone: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        marginLeft: spacing.sm,
        textDecorationLine: 'line-through',
    },
    completedTime: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        marginLeft: 28,
    },
    skippedWrapper: {
        position: 'relative',
        marginBottom: spacing.sm,
    },
    skippedBlur: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 16,
    },
    taskCardSkipped: {
        padding: spacing.md,
        opacity: 0.5,
    },
    taskNameSkipped: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        textDecorationLine: 'line-through',
    },
    mutationNote: {
        fontSize: typography.caption.fontSize,
        color: '#EF4444',
        marginTop: spacing.xs,
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
    prioritySection: {
        marginBottom: spacing.lg,
    },
    prioritySelectLabel: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    priorityButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    prioritySelectBtn: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        backgroundColor: colors.glassSurface,
        alignItems: 'center',
    },
    prioritySelectBtnActive: {
        borderColor: colors.accentPositive,
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
    },
    prioritySelectText: {
        fontSize: typography.body.fontSize,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    prioritySelectTextActive: {
        color: colors.accentPositive,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
    },
});
