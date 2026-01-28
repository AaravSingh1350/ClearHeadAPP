// Time-based Daily Planner
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
import { Ionicons } from '@expo/vector-icons';
import { GlassCard, GlassModal } from '@/components/glass';
import { usePlannerStore, useThemeStore } from '@/stores';
import { spacing } from '@/styles/theme';
import { formatDate } from '@/database';
import { Task } from '@/database/schema';

const TIME_SLOTS = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00'
];

const formatTime = (time: string): string => {
    const [hours] = time.split(':');
    const h = parseInt(hours);
    if (h === 12) return '12 PM';
    if (h > 12) return `${h - 12} PM`;
    return `${h} AM`;
};

type ViewMode = 'today' | 'upcoming';

export default function PlannerScreen() {
    const { colors } = useThemeStore();
    const {
        tasks, loadTasks,
        addTask, updateTask, deleteTask,
        completeTask, skipTask, undoTask,
        overdueTasksCount, loadOverdueTasksCount,
    } = usePlannerStore();

    const [viewMode, setViewMode] = useState<ViewMode>('today');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDate, setFormDate] = useState(formatDate(Date.now()));
    const [formTime, setFormTime] = useState<string | null>(null);
    const [formDuration, setFormDuration] = useState('30');
    const [formPriority, setFormPriority] = useState<1 | 2 | 3>(2);

    const today = formatDate(Date.now());

    useEffect(() => {
        loadTasks();
        loadOverdueTasksCount();
    }, []);

    // Next 7 days
    const upcomingDates = useMemo(() => {
        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            dates.push(formatDate(d.getTime()));
        }
        return dates;
    }, []);

    // Group tasks by date
    const tasksByDate = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        tasks.forEach(task => {
            const date = task.scheduled_date || today;
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(task);
        });
        // Sort by time
        Object.keys(grouped).forEach(date => {
            grouped[date].sort((a, b) => {
                if (!a.scheduled_time && !b.scheduled_time) return 0;
                if (!a.scheduled_time) return 1;
                if (!b.scheduled_time) return -1;
                return a.scheduled_time.localeCompare(b.scheduled_time);
            });
        });
        return grouped;
    }, [tasks, today]);

    const todayTasks = tasksByDate[today] || [];
    const pendingToday = todayTasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    const skippedToday = todayTasks.filter(t => t.status === 'skipped');
    const completedToday = todayTasks.filter(t => t.status === 'completed');

    const resetForm = () => {
        setFormName('');
        setFormDate(formatDate(Date.now()));
        setFormTime(null);
        setFormDuration('30');
        setFormPriority(2);
    };

    const handleAdd = async () => {
        if (!formName.trim()) {
            Alert.alert('Error', 'Enter task name');
            return;
        }
        try {
            await addTask(formName.trim(), parseInt(formDuration) || 30, formDate, formPriority, false, undefined, undefined, formTime || undefined);
            resetForm();
            setShowAddModal(false);
            loadTasks();
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to add task');
        }
    };

    const handleEdit = async () => {
        if (!editingTask || !formName.trim()) return;
        await updateTask(editingTask.id, {
            name: formName,
            scheduled_date: formDate,
            scheduled_time: formTime,
            time_estimate_minutes: parseInt(formDuration) || 30,
            priority: formPriority,
        });
        resetForm();
        setShowEditModal(false);
        setEditingTask(null);
        loadTasks();
    };

    const openEdit = (task: Task) => {
        setEditingTask(task);
        setFormName(task.name);
        setFormDate(task.scheduled_date || today);
        setFormTime(task.scheduled_time || null);
        setFormDuration(String(task.time_estimate_minutes));
        setFormPriority(task.priority || 2);
        setShowEditModal(true);
    };

    const handleDelete = (task: Task) => {
        Alert.alert('Delete', `Delete "${task.name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTask(task.id); loadTasks(); } },
        ]);
    };

    const handleComplete = async (id: string) => { await completeTask(id); };
    const handleSkip = async (id: string) => { await skipTask(id); };
    const handleUndo = async (id: string) => { await undoTask(id); };

    // Smart Daily Plan Generator - Creates complete day schedule
    const generatePlan = async () => {
        Alert.alert(
            '✨ Generate Daily Plan',
            'This will create a complete study schedule for today with:\n\n📚 Study Sessions\n✍️ Question Solving\n☕ Rest Breaks\n🍽️ Meal Times',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Generate', onPress: createDayPlan }
            ]
        );
    };

    const createDayPlan = async () => {
        // Get current hour to start from
        const currentHour = new Date().getHours();
        const startHour = Math.max(currentHour + 1, 6); // Start at least from next hour or 6 AM

        // Define the day structure
        const dayTemplate = [
            // Morning Study Block
            { time: '06:00', name: '🧘 Morning Routine & Revision', duration: 30, priority: 2, type: 'routine' },
            { time: '07:00', name: '📚 Study Session 1 (High Focus)', duration: 90, priority: 1, type: 'study' },
            { time: '08:30', name: '☕ Short Break', duration: 15, priority: 3, type: 'break' },
            { time: '09:00', name: '✍️ Question Practice 1', duration: 60, priority: 1, type: 'questions' },
            { time: '10:00', name: '📚 Study Session 2', duration: 60, priority: 1, type: 'study' },
            { time: '11:00', name: '☕ Short Break + Snack', duration: 15, priority: 3, type: 'break' },
            { time: '11:15', name: '✍️ Question Practice 2', duration: 45, priority: 1, type: 'questions' },

            // Lunch & Light Study
            { time: '12:00', name: '🍽️ Lunch Break', duration: 60, priority: 3, type: 'meal' },
            { time: '13:00', name: '📖 Light Reading / Notes Review', duration: 45, priority: 2, type: 'study' },
            { time: '13:45', name: '😴 Power Nap (Optional)', duration: 20, priority: 3, type: 'break' },

            // Afternoon Block
            { time: '14:00', name: '📚 Study Session 3', duration: 90, priority: 1, type: 'study' },
            { time: '15:30', name: '☕ Break + Walk', duration: 20, priority: 3, type: 'break' },
            { time: '16:00', name: '✍️ Question Practice 3', duration: 60, priority: 1, type: 'questions' },
            { time: '17:00', name: '📚 Study Session 4', duration: 60, priority: 2, type: 'study' },

            // Evening Block
            { time: '18:00', name: '🏃 Exercise / Fresh Air', duration: 30, priority: 2, type: 'break' },
            { time: '18:30', name: '🍽️ Snack Break', duration: 15, priority: 3, type: 'meal' },
            { time: '19:00', name: '✍️ Question Practice 4 (Mock Test)', duration: 90, priority: 1, type: 'questions' },
            { time: '20:30', name: '🍽️ Dinner', duration: 45, priority: 3, type: 'meal' },

            // Night Revision
            { time: '21:15', name: '📝 Daily Revision & Weak Areas', duration: 45, priority: 1, type: 'study' },
            { time: '22:00', name: '📋 Plan Tomorrow + Relax', duration: 30, priority: 2, type: 'routine' },
        ];

        // Filter only tasks starting from current time onwards
        const relevantTasks = dayTemplate.filter(t => {
            const [h] = t.time.split(':').map(Number);
            return h >= startHour;
        });

        // Check for existing tasks to avoid duplicates
        const existingTimes = new Set(pendingToday.map(t => t.scheduled_time).filter(Boolean));

        let added = 0;
        for (const item of relevantTasks) {
            // Skip if time slot already taken
            if (existingTimes.has(item.time)) continue;

            try {
                await addTask(
                    item.name,
                    item.duration,
                    today,
                    item.priority as 1 | 2 | 3,
                    false,
                    undefined,
                    undefined,
                    item.time
                );
                added++;
            } catch (e) {
                console.error('Failed to add:', item.name, e);
            }
        }

        loadTasks();
        Alert.alert('✅ Plan Generated!', `Added ${added} tasks to your schedule.\n\nApni existing tasks bhi time ke saath adjust ho gayi hain!`);
    };

    const formatDateLabel = (d: string) => {
        if (d === today) return 'Today';
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        if (d === formatDate(tomorrow.getTime())) return 'Tomorrow';
        return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const getPriorityColor = (p: number | null) => p === 1 ? '#EF4444' : p === 3 ? '#22C55E' : '#FBBF24';

    const styles = createStyles(colors);

    const renderTask = (task: Task) => (
        <View key={task.id} style={styles.taskCard}>
            <View style={styles.taskLeft}>
                {task.scheduled_time && (
                    <View style={styles.timeBadge}>
                        <Text style={styles.timeText}>{formatTime(task.scheduled_time)}</Text>
                    </View>
                )}
                <View style={[styles.dot, { backgroundColor: getPriorityColor(task.priority) }]} />
            </View>
            <View style={styles.taskContent}>
                <Text style={[styles.taskName, task.status === 'completed' && styles.taskDone]}>{task.name}</Text>
                <Text style={styles.taskMeta}>{task.time_estimate_minutes} min</Text>
            </View>
            <View style={styles.actions}>
                {task.status === 'pending' ? (
                    <>
                        <Pressable onPress={() => handleComplete(task.id)}><Ionicons name="checkmark-circle" size={26} color="#22C55E" /></Pressable>
                        <Pressable onPress={() => handleSkip(task.id)}><Ionicons name="arrow-forward-circle" size={26} color="#FBBF24" /></Pressable>
                        <Pressable onPress={() => openEdit(task)}><Ionicons name="create-outline" size={22} color={colors.textSecondary} /></Pressable>
                        <Pressable onPress={() => handleDelete(task)}><Ionicons name="trash-outline" size={20} color="#EF4444" /></Pressable>
                    </>
                ) : (
                    <Pressable onPress={() => handleUndo(task.id)}><Ionicons name="arrow-undo" size={22} color={colors.textSecondary} /></Pressable>
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Header */}
                <Text style={styles.title}>Daily Planner</Text>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.stat}><Text style={styles.statNum}>{pendingToday.length}</Text><Text style={styles.statLabel}>Pending</Text></View>
                    <View style={styles.stat}><Text style={[styles.statNum, { color: '#22C55E' }]}>{completedToday.length}</Text><Text style={styles.statLabel}>Done</Text></View>
                    <View style={styles.stat}><Text style={[styles.statNum, { color: '#EF4444' }]}>{overdueTasksCount}</Text><Text style={styles.statLabel}>Overdue</Text></View>
                </View>

                {/* Toggle */}
                <View style={styles.toggleRow}>
                    <Pressable style={[styles.toggleBtn, viewMode === 'today' && styles.toggleActive]} onPress={() => setViewMode('today')}>
                        <Text style={[styles.toggleText, viewMode === 'today' && styles.toggleTextActive]}>Today</Text>
                    </Pressable>
                    <Pressable style={[styles.toggleBtn, viewMode === 'upcoming' && styles.toggleActive]} onPress={() => setViewMode('upcoming')}>
                        <Text style={[styles.toggleText, viewMode === 'upcoming' && styles.toggleTextActive]}>Upcoming</Text>
                    </Pressable>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonRow}>
                    <Pressable style={styles.addBtn} onPress={() => setShowAddModal(true)}>
                        <Ionicons name="add" size={22} color="#FFF" />
                        <Text style={styles.btnText}>Add Task</Text>
                    </Pressable>
                    <Pressable style={styles.genBtn} onPress={generatePlan}>
                        <Ionicons name="sparkles" size={18} color="#FFF" />
                        <Text style={styles.btnText}>Generate</Text>
                    </Pressable>
                </View>

                {viewMode === 'today' ? (
                    <View style={styles.section}>
                        {pendingToday.length === 0 && skippedToday.length === 0 && completedToday.length === 0 ? (
                            <View style={styles.empty}>
                                <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
                                <Text style={styles.emptyText}>No tasks for today</Text>
                            </View>
                        ) : (
                            <>
                                {pendingToday.length > 0 && (
                                    <>
                                        <Text style={styles.sectionTitle}>📋 To Do</Text>
                                        {pendingToday.map(renderTask)}
                                    </>
                                )}
                                {skippedToday.length > 0 && (
                                    <>
                                        <Text style={styles.sectionTitle}>⏭️ Skipped (tap ✓ to complete)</Text>
                                        {skippedToday.map(renderTask)}
                                    </>
                                )}
                                {completedToday.length > 0 && (
                                    <>
                                        <Text style={styles.sectionTitle}>✅ Done</Text>
                                        {completedToday.map(renderTask)}
                                    </>
                                )}
                            </>
                        )}
                    </View>
                ) : (
                    <View style={styles.section}>
                        {upcomingDates.map(date => {
                            const dateTasks = (tasksByDate[date] || []).filter(t => t.status === 'pending' || t.status === 'in_progress');
                            return (
                                <View key={date} style={styles.dateBlock}>
                                    <View style={styles.dateHeader}>
                                        <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
                                        <Text style={styles.dateCount}>{dateTasks.length} tasks</Text>
                                    </View>
                                    {dateTasks.length === 0 ? (
                                        <Text style={styles.noTasks}>No tasks</Text>
                                    ) : (
                                        dateTasks.map(renderTask)
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Add Modal */}
            <GlassModal visible={showAddModal} onClose={() => { resetForm(); setShowAddModal(false); }}>
                <Text style={styles.modalTitle}>Add Task</Text>
                <TextInput style={styles.input} placeholder="Task name" placeholderTextColor={colors.textSecondary} value={formName} onChangeText={setFormName} />

                <Text style={styles.label}>Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {upcomingDates.map(d => (
                        <Pressable key={d} style={[styles.chip, formDate === d && styles.chipActive]} onPress={() => setFormDate(d)}>
                            <Text style={[styles.chipText, formDate === d && styles.chipTextActive]}>{formatDateLabel(d)}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                <Text style={styles.label}>Time (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    <Pressable style={[styles.chip, formTime === null && styles.chipActive]} onPress={() => setFormTime(null)}>
                        <Text style={[styles.chipText, formTime === null && styles.chipTextActive]}>No time</Text>
                    </Pressable>
                    {TIME_SLOTS.map(t => (
                        <Pressable key={t} style={[styles.chip, formTime === t && styles.chipActive]} onPress={() => setFormTime(t)}>
                            <Text style={[styles.chipText, formTime === t && styles.chipTextActive]}>{formatTime(t)}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                <Text style={styles.label}>Duration</Text>
                <View style={styles.chipRow}>
                    {['15', '30', '45', '60', '90'].map(d => (
                        <Pressable key={d} style={[styles.chip, formDuration === d && styles.chipActive]} onPress={() => setFormDuration(d)}>
                            <Text style={[styles.chipText, formDuration === d && styles.chipTextActive]}>{d} min</Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.label}>Priority</Text>
                <View style={styles.chipRow}>
                    {[{ v: 1, l: 'High', c: '#EF4444' }, { v: 2, l: 'Med', c: '#FBBF24' }, { v: 3, l: 'Low', c: '#22C55E' }].map(p => (
                        <Pressable key={p.v} style={[styles.prioChip, formPriority === p.v && { borderColor: p.c, backgroundColor: p.c + '20' }]} onPress={() => setFormPriority(p.v as 1 | 2 | 3)}>
                            <View style={[styles.prioDot, { backgroundColor: p.c }]} />
                            <Text style={[styles.chipText, formPriority === p.v && { color: p.c }]}>{p.l}</Text>
                        </Pressable>
                    ))}
                </View>

                <View style={styles.modalBtns}>
                    <Pressable style={styles.cancelBtn} onPress={() => { resetForm(); setShowAddModal(false); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                    <Pressable style={styles.confirmBtn} onPress={handleAdd}><Text style={styles.confirmText}>Add</Text></Pressable>
                </View>
            </GlassModal>

            {/* Edit Modal */}
            <GlassModal visible={showEditModal} onClose={() => { resetForm(); setShowEditModal(false); setEditingTask(null); }}>
                <Text style={styles.modalTitle}>Edit Task</Text>
                <TextInput style={styles.input} placeholder="Task name" placeholderTextColor={colors.textSecondary} value={formName} onChangeText={setFormName} />

                <Text style={styles.label}>Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {upcomingDates.map(d => (
                        <Pressable key={d} style={[styles.chip, formDate === d && styles.chipActive]} onPress={() => setFormDate(d)}>
                            <Text style={[styles.chipText, formDate === d && styles.chipTextActive]}>{formatDateLabel(d)}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                <Text style={styles.label}>Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    <Pressable style={[styles.chip, formTime === null && styles.chipActive]} onPress={() => setFormTime(null)}>
                        <Text style={[styles.chipText, formTime === null && styles.chipTextActive]}>No time</Text>
                    </Pressable>
                    {TIME_SLOTS.map(t => (
                        <Pressable key={t} style={[styles.chip, formTime === t && styles.chipActive]} onPress={() => setFormTime(t)}>
                            <Text style={[styles.chipText, formTime === t && styles.chipTextActive]}>{formatTime(t)}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                <Text style={styles.label}>Duration</Text>
                <View style={styles.chipRow}>
                    {['15', '30', '45', '60', '90'].map(d => (
                        <Pressable key={d} style={[styles.chip, formDuration === d && styles.chipActive]} onPress={() => setFormDuration(d)}>
                            <Text style={[styles.chipText, formDuration === d && styles.chipTextActive]}>{d} min</Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.label}>Priority</Text>
                <View style={styles.chipRow}>
                    {[{ v: 1, l: 'High', c: '#EF4444' }, { v: 2, l: 'Med', c: '#FBBF24' }, { v: 3, l: 'Low', c: '#22C55E' }].map(p => (
                        <Pressable key={p.v} style={[styles.prioChip, formPriority === p.v && { borderColor: p.c, backgroundColor: p.c + '20' }]} onPress={() => setFormPriority(p.v as 1 | 2 | 3)}>
                            <View style={[styles.prioDot, { backgroundColor: p.c }]} />
                            <Text style={[styles.chipText, formPriority === p.v && { color: p.c }]}>{p.l}</Text>
                        </Pressable>
                    ))}
                </View>

                <View style={styles.modalBtns}>
                    <Pressable style={styles.cancelBtn} onPress={() => { resetForm(); setShowEditModal(false); setEditingTask(null); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                    <Pressable style={styles.confirmBtn} onPress={handleEdit}><Text style={styles.confirmText}>Save</Text></Pressable>
                </View>
            </GlassModal>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 100 },
    title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
    // Stats
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    stat: { flex: 1, backgroundColor: colors.glassSurface, borderRadius: 12, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.glassBorder },
    statNum: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
    statLabel: { fontSize: 11, color: colors.textSecondary },
    // Toggle
    toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: colors.glassSurface, borderWidth: 1, borderColor: colors.glassBorder },
    toggleActive: { backgroundColor: colors.accentPositive, borderColor: colors.accentPositive },
    toggleText: { fontSize: 14, color: colors.textSecondary },
    toggleTextActive: { color: '#000', fontWeight: '600' },
    // Buttons
    buttonRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#3B82F6', paddingVertical: 12, borderRadius: 10 },
    genBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#8B5CF6', paddingVertical: 12, borderRadius: 10 },
    btnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
    // Section
    section: { marginTop: spacing.sm },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.md },
    dateBlock: { marginBottom: spacing.lg },
    dateHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
    dateLabel: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    dateCount: { fontSize: 12, color: colors.textSecondary },
    noTasks: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
    // Task
    taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassSurface, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.glassBorder },
    taskLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: spacing.sm },
    timeBadge: { backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    timeText: { fontSize: 10, fontWeight: '600', color: '#3B82F6' },
    dot: { width: 6, height: 6, borderRadius: 3 },
    taskContent: { flex: 1 },
    taskName: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
    taskDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
    taskMeta: { fontSize: 11, color: colors.textSecondary },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    // Empty
    empty: { alignItems: 'center', paddingVertical: spacing.xxl },
    emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
    // Modal
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.md },
    input: { backgroundColor: colors.glassSurface, borderRadius: 8, padding: spacing.sm, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.glassBorder, marginBottom: spacing.md },
    label: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
    chipScroll: { marginBottom: spacing.md },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.glassSurface, borderWidth: 1, borderColor: colors.glassBorder, marginRight: spacing.xs },
    chipActive: { backgroundColor: colors.accentPositive, borderColor: colors.accentPositive },
    chipText: { fontSize: 12, color: colors.textSecondary },
    chipTextActive: { color: '#000', fontWeight: '600' },
    prioChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.glassSurface, borderWidth: 1, borderColor: colors.glassBorder },
    prioDot: { width: 8, height: 8, borderRadius: 4 },
    modalBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.glassSurface },
    cancelText: { fontSize: 14, color: colors.textSecondary },
    confirmBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#3B82F6' },
    confirmText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
