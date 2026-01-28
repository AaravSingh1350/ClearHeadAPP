// Backup Screen
// Encrypted backup and restore functionality + Settings

import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Alert,
    Switch,
    Pressable,
    Platform,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { GlassCard, GlassButton, GlassInput, GlassModal } from '@/components/glass';
import { useThemeStore, useThoughtsStore, useLearningStore, usePlannerStore } from '@/stores';
import { spacing, typography } from '@/styles/theme';
import { getDatabase, formatDate } from '@/database';
import { encryptData, decryptData, setBackupPassword } from '@/database/encryption';
import { useAnimationKey } from '@/utils/animations';

export default function BackupScreen() {
    const animationKey = useAnimationKey();
    const { colors, colorScheme, toggleColorScheme } = useThemeStore();

    // Store hooks for refreshing data after import
    const { loadThoughts } = useThoughtsStore();
    const { loadTopics, loadDueRevisions } = useLearningStore();
    const { loadTasks, loadTimeBlocks } = usePlannerStore(); // and maybe selectedDate from AppStore if needed

    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [mode, setMode] = useState<'export' | 'import'>('export');
    const [lastBackup, setLastBackup] = useState<string | null>(null);
    const pendingBackupData = useRef<string | null>(null);
    const pendingImportFile = useRef<string | null>(null);

    const handleExport = async () => {
        try {
            const db = getDatabase();

            // Collect all data
            const thoughts = await db.getAllAsync('SELECT * FROM thoughts');
            const topics = await db.getAllAsync('SELECT * FROM study_topics');
            const revisions = await db.getAllAsync('SELECT * FROM revisions');
            const tasks = await db.getAllAsync('SELECT * FROM tasks');
            const timeBlocks = await db.getAllAsync('SELECT * FROM time_blocks');
            const timeline = await db.getAllAsync('SELECT * FROM timeline_entries');
            const insights = await db.getAllAsync('SELECT * FROM insights');

            const backupData = {
                version: '1.0',
                exportedAt: Date.now(),
                data: {
                    thoughts,
                    topics,
                    revisions,
                    tasks,
                    timeBlocks,
                    timeline,
                    insights,
                },
            };

            const jsonData = JSON.stringify(backupData);

            // ALWAYS ask for password for new exports
            pendingBackupData.current = jsonData;
            setMode('export');
            setPassword('');
            setConfirmPassword('');
            setShowPasswordModal(true);

        } catch (error) {
            console.error('Export init failed:', error);
            Alert.alert('Error', `Failed to prepare backup: ${error}`);
        }
    };

    const performExport = async (jsonData: string, pwd: string) => {
        try {
            setIsExporting(true);
            const encrypted = encryptData(jsonData, pwd);
            const fileName = `clearhead_backup_${formatDate(Date.now()).replace(/[: ]/g, '_')}.clearhead`;
            const tempFilePath = `${FileSystem.documentDirectory}${fileName}`;

            // Write to temp file first
            await FileSystem.writeAsStringAsync(tempFilePath, encrypted);
            setLastBackup(formatDate(Date.now()));

            // Directly share the file on all platforms
            await shareFile(tempFilePath);

        } catch (error) {
            console.error('Export failed:', error);
            Alert.alert('Error', `Failed to create backup: ${error}`);
            setIsExporting(false);
        }
    };

    const shareFile = async (filePath: string) => {
        try {
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(filePath, {
                    mimeType: 'application/octet-stream',
                    dialogTitle: 'Save ClearHead Backup',
                    UTI: 'public.data',
                });
            } else {
                Alert.alert('Error', 'Sharing is not available on this device');
            }
        } catch (error) {
            console.error('Sharing failed', error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];
            if (!file.name.endsWith('.clearhead')) {
                Alert.alert('Invalid File', 'Please select a .clearhead backup file');
                return;
            }

            pendingImportFile.current = file.uri;
            setMode('import');
            setPassword('');
            setConfirmPassword('');
            setShowPasswordModal(true);
        } catch (error) {
            console.error('Import failed:', error);
            Alert.alert('Error', 'Failed to import backup');
        }
    };

    const performImport = async (filePath: string, pwd: string) => {
        try {
            setIsImporting(true);

            const encryptedData = await FileSystem.readAsStringAsync(filePath);
            const decryptedData = decryptData(encryptedData, pwd);

            if (!decryptedData) {
                Alert.alert('Error', 'Wrong password or corrupted file');
                return;
            }

            const backupData = JSON.parse(decryptedData);
            const db = getDatabase();

            // Helper to safe insert
            const safeInsert = async (table: string, data: any[]) => {
                if (!data || data.length === 0) return;

                const columns = Object.keys(data[0]);
                const placeholders = columns.map(() => '?').join(', ');
                const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

                for (const item of data) {
                    await db.runAsync(sql, Object.values(item) as any[]);
                }
            };

            // Restore data
            await safeInsert('thoughts', backupData.data.thoughts);
            await safeInsert('study_topics', backupData.data.topics);
            await safeInsert('revisions', backupData.data.revisions);
            await safeInsert('tasks', backupData.data.tasks);
            await safeInsert('time_blocks', backupData.data.timeBlocks);
            await safeInsert('timeline_entries', backupData.data.timeline);
            await safeInsert('insights', backupData.data.insights);

            // REFRESH STORES
            loadThoughts();
            loadTopics();
            loadDueRevisions();
            // Refresh tasks for currently selected date (we can default to today or just refresh without date if supported, 
            // but plannerStore.loadTasks requires a date. We'll refresh with today for now or trust the planner screen handles its own focus)
            const today = formatDate(Date.now());
            loadTasks(today);
            loadTimeBlocks(today);

            Alert.alert('Success', 'Data restored successfully! The app has been updated.');
        } catch (error) {
            console.error('Import failed:', error);
            Alert.alert('Error', 'Import failed. Your backup file might be from an older version or corrupted.');
        } finally {
            setIsImporting(false);
            setShowPasswordModal(false);
            setPassword('');
            pendingImportFile.current = null;
        }
    };

    const handlePasswordSubmit = async () => {
        if (mode === 'export') {
            if (password !== confirmPassword) {
                Alert.alert('Error', 'Passwords do not match');
                return;
            }
            if (password.length < 1) {
                Alert.alert('Error', 'Password cannot be empty');
                return;
            }
            if (password.length > 12) {
                Alert.alert('Error', 'Password must be 12 characters or less');
                return;
            }

            // Optional: Update stored password for convenience, but we always ask anyway
            await setBackupPassword(password);
            setShowPasswordModal(false);

            if (pendingBackupData.current) {
                await performExport(pendingBackupData.current, password);
                pendingBackupData.current = null;
            }

            setPassword('');
            setConfirmPassword('');
        } else {
            // Import mode
            if (pendingImportFile.current) {
                await performImport(pendingImportFile.current, password);
            }
        }
    };

    // Clear timeline history
    const handleClearHistory = (days: number) => {
        const label = days === 0 ? 'ALL timeline history' : `last ${days} days of history`;

        Alert.alert(
            '⚠️ Clear History',
            `Are you sure you want to delete ${label}? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const db = getDatabase();

                            if (days === 0) {
                                // Delete all
                                await db.runAsync('DELETE FROM timeline_entries');
                            } else {
                                // Delete entries older than X days ago
                                const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
                                await db.runAsync(
                                    'DELETE FROM timeline_entries WHERE created_at >= ?',
                                    [cutoffDate]
                                );
                            }

                            Alert.alert('✅ Done', `Timeline history cleared successfully!`);
                        } catch (error) {
                            console.error('Clear history failed:', error);
                            Alert.alert('Error', 'Failed to clear history');
                        }
                    }
                }
            ]
        );
    };

    // State for selective delete
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedDeleteDates, setSelectedDeleteDates] = useState<Set<string>>(new Set());
    const [isLoadingDates, setIsLoadingDates] = useState(false);

    const loadAvailableDates = async () => {
        setIsLoadingDates(true);
        try {
            const db = getDatabase();
            // Get unique dates from timeline
            const result = await db.getAllAsync<{ created_at: number }>(
                'SELECT DISTINCT created_at FROM timeline_entries ORDER BY created_at DESC'
            );

            // Extract unique date strings (YYYY-MM-DD)
            const dates = new Set<string>();
            result.forEach(row => {
                const d = new Date(row.created_at);
                const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                dates.add(localDate);
            });

            setAvailableDates(Array.from(dates));
        } catch (error) {
            console.error('Failed to load dates:', error);
        } finally {
            setIsLoadingDates(false);
        }
    };

    const toggleDeleteDate = (date: string) => {
        const next = new Set(selectedDeleteDates);
        if (next.has(date)) next.delete(date);
        else next.add(date);
        setSelectedDeleteDates(next);
    };

    const confirmDeleteDates = async () => {
        if (selectedDeleteDates.size === 0) return;

        Alert.alert(
            'Confirm Delete',
            `Delete history for ${selectedDeleteDates.size} selected days?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const db = getDatabase();
                            const dates = Array.from(selectedDeleteDates);

                            for (const dateStr of dates) {
                                // dateStr is YYYY-MM-DD
                                const [y, m, d] = dateStr.split('-').map(Number);
                                const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
                                const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();

                                await db.runAsync(
                                    'DELETE FROM timeline_entries WHERE created_at >= ? AND created_at <= ?',
                                    [start, end]
                                );
                            }

                            setShowDeleteModal(false);
                            setSelectedDeleteDates(new Set());
                            Alert.alert('Success', 'Selected history deleted');
                        } catch (e) {
                            console.error(e);
                            Alert.alert('Error', 'Failed to delete history');
                        }
                    }
                }
            ]
        );
    };

    // Export to CSV function
    const exportToCSV = async () => {
        try {
            const db = getDatabase();
            const entries = await db.getAllAsync<any>(
                'SELECT * FROM timeline_entries ORDER BY created_at DESC'
            );

            if (entries.length === 0) {
                Alert.alert('Info', 'No history to export');
                return;
            }

            // CSV Header
            let csvContent = "Date,Time,Activity Type,Title,Description,Status\n";

            // CSV Rows
            entries.forEach(entry => {
                const dateObj = new Date(entry.created_at);
                const date = dateObj.toLocaleDateString();
                const time = dateObj.toLocaleTimeString();
                const type = entry.entry_type;
                // Escape quotes and handle commas
                const title = `"${(entry.title || '').replace(/"/g, '""')}"`;
                const desc = `"${(entry.description || '').replace(/"/g, '""')}"`;
                const status = entry.was_avoided ? 'Missed/Skipped' : 'Completed';

                csvContent += `${date},${time},${type},${title},${desc},${status}\n`;
            });

            const fileName = `Timeline_History_${formatDate(Date.now()).replace(/[: ]/g, '_')}.csv`;
            const filePath = `${FileSystem.documentDirectory}${fileName}`;

            await FileSystem.writeAsStringAsync(filePath, csvContent);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(filePath, {
                    mimeType: 'text/csv',
                    dialogTitle: 'Export Timeline History',
                    UTI: 'public.comma-separated-values-text'
                });
            } else {
                Alert.alert('Error', 'Sharing not available');
            }
        } catch (error) {
            console.error('CSV Export failed:', error);
            Alert.alert('Error', 'Failed to export CSV');
        }
    };

    // Open selective delete modal
    const openSelectiveDelete = () => {
        loadAvailableDates();
        setShowDeleteModal(true);
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
                    <Text style={styles.title}>Settings</Text>
                    <Text style={styles.subtitle}>
                        Backup your data and customize the app
                    </Text>
                </Animated.View>

                {/* Appearance Section */}
                <Animated.View key={`appearance-${animationKey}`} entering={FadeInDown.delay(150)}>
                    <Text style={styles.sectionTitle}>Appearance</Text>
                    <GlassCard depth={1} style={styles.settingCard}>
                        <Pressable style={styles.settingRow} onPress={toggleColorScheme}>
                            <View style={styles.settingInfo}>
                                <Ionicons
                                    name={colorScheme === 'dark' ? 'moon' : 'sunny'}
                                    size={24}
                                    color={colorScheme === 'dark' ? '#A78BFA' : '#FBBF24'}
                                />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingTitle}>Dark Mode</Text>
                                    <Text style={styles.settingDesc}>
                                        {colorScheme === 'dark' ? 'Currently enabled' : 'Currently disabled'}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={colorScheme === 'dark'}
                                onValueChange={toggleColorScheme}
                                trackColor={{ false: '#767577', true: colors.accentPositive }}
                                thumbColor="#FFFFFF"
                            />
                        </Pressable>
                    </GlassCard>
                </Animated.View>

                {/* Export Section */}
                <Animated.View key={`export-${animationKey}`} entering={FadeInUp.delay(200)}>
                    <Text style={styles.sectionTitle}>Backup & Restore</Text>
                    <GlassCard depth={1} style={styles.actionCard}>
                        <View style={styles.actionInfo}>
                            <Ionicons name="cloud-upload-outline" size={32} color={colors.accentPositive} />
                            <View style={styles.actionText}>
                                <Text style={styles.actionTitle}>Full Backup (Encrypted)</Text>
                                <Text style={styles.actionDesc}>
                                    Export all app data securely
                                </Text>
                                {lastBackup && <Text style={styles.lastBackup}>Last: {lastBackup}</Text>}
                            </View>
                        </View>
                        <GlassButton
                            title="Export Backup"
                            onPress={handleExport}
                            variant="primary"
                            loading={isExporting}
                            icon={<Ionicons name="download-outline" size={18} color={colorScheme === 'dark' ? '#FFFFFF' : '#1A1A1A'} />}
                        />
                    </GlassCard>
                </Animated.View>

                {/* CSV Export */}
                <Animated.View key={`csv-${animationKey}`} entering={FadeInUp.delay(300)}>
                    <GlassCard depth={1} style={styles.actionCard}>
                        <View style={styles.actionInfo}>
                            <Ionicons name="document-text-outline" size={32} color="#10B981" />
                            <View style={styles.actionText}>
                                <Text style={styles.actionTitle}>Export to Excel (CSV)</Text>
                                <Text style={styles.actionDesc}>
                                    Save timeline history as spreadsheet
                                </Text>
                            </View>
                        </View>
                        <GlassButton
                            title="Download CSV"
                            onPress={exportToCSV}
                            icon={<Ionicons name="share-outline" size={18} color={colors.textPrimary} />}
                        />
                    </GlassCard>
                </Animated.View>

                {/* Import Section */}
                <Animated.View key={`import-${animationKey}`} entering={FadeInUp.delay(400)}>
                    <GlassCard depth={1} style={styles.actionCard}>
                        <View style={styles.actionInfo}>
                            <Ionicons name="cloud-download-outline" size={32} color="#60A5FA" />
                            <View style={styles.actionText}>
                                <Text style={styles.actionTitle}>Restore Backup</Text>
                                <Text style={styles.actionDesc}>
                                    Import from .clearhead file
                                </Text>
                            </View>
                        </View>
                        <GlassButton
                            title="Import Data"
                            onPress={handleImport}
                            loading={isImporting}
                            icon={<Ionicons name="folder-open-outline" size={18} color={colors.textPrimary} />}
                        />
                    </GlassCard>
                </Animated.View>

                {/* Clear History Section */}
                <Animated.View key={`clear-${animationKey}`} entering={FadeInUp.delay(500)}>
                    <Text style={styles.sectionTitle}>History Management</Text>
                    <GlassCard depth={1} style={styles.actionCard}>
                        <View style={styles.actionInfo}>
                            <Ionicons name="trash-outline" size={32} color="#EF4444" />
                            <View style={styles.actionText}>
                                <Text style={styles.actionTitle}>Clear Timeline</Text>
                                <Text style={styles.actionDesc}>
                                    Remove old activity logs
                                </Text>
                            </View>
                        </View>
                        <View style={styles.clearButtonsRow}>
                            <Pressable
                                style={[styles.clearBtn, { backgroundColor: colors.glassSurface, borderWidth: 1, borderColor: colors.glassBorder }]}
                                onPress={openSelectiveDelete}
                            >
                                <Ionicons name="calendar-outline" size={16} color={colors.textPrimary} />
                                <Text style={[styles.clearBtnText, { color: colors.textPrimary }]}>Select Dates</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.clearBtn, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}
                                onPress={() => handleClearHistory(0)}
                            >
                                <Text style={[styles.clearBtnText, { color: '#EF4444' }]}>Clear All</Text>
                            </Pressable>
                        </View>
                    </GlassCard>
                </Animated.View>

                {/* Developer Info */}
                <Animated.View key={`dev-${animationKey}`} entering={FadeInUp.delay(600)}>
                    <Text style={styles.sectionTitle}>Developer</Text>
                    <Pressable onPress={() => Linking.openURL('https://github.com/AaravSingh1350')}>
                        <GlassCard depth={2} intensity="heavy" style={styles.devCard}>
                            <View style={styles.devContent}>
                                <Ionicons name="logo-github" size={28} color={colors.textPrimary} />
                                <View style={styles.devTextContainer}>
                                    <Text style={styles.devLabel}>Developed by</Text>
                                    <Text style={styles.devName}>Aarav Singh Rajpoot</Text>
                                </View>
                                <Ionicons name="open-outline" size={20} color={colors.accentPositive} />
                            </View>
                        </GlassCard>
                    </Pressable>
                </Animated.View>

                {/* App Info */}
                <View style={styles.appInfoCard}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.appInfoText}>ClearHead v1.2.0 • Made with ❤️</Text>
                </View>
            </ScrollView>

            {/* Password Modal */}
            <GlassModal visible={showPasswordModal} onClose={() => { setShowPasswordModal(false); setPassword(''); setConfirmPassword(''); }}>
                <Text style={styles.modalTitle}>{mode === 'export' ? 'Set Backup Password' : 'Enter Password'}</Text>
                <GlassInput label="Password" value={password} onChangeText={setPassword} secureTextEntry containerStyle={styles.modalInput} />
                {mode === 'export' && <GlassInput label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry containerStyle={styles.modalInput} />}
                <View style={styles.modalButtons}>
                    <GlassButton title="Cancel" onPress={() => setShowPasswordModal(false)} variant="ghost" />
                    <GlassButton title={mode === 'export' ? 'Export' : 'Decrypt'} onPress={handlePasswordSubmit} variant="primary" />
                </View>
            </GlassModal>

            {/* Delete Dates Modal */}
            <GlassModal visible={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
                <Text style={styles.modalTitle}>Select Days to Clear</Text>
                <Text style={styles.modalDesc}>Select days to permanently remove from timeline history.</Text>

                <ScrollView style={{ maxHeight: 300, marginBottom: 20 }}>
                    {isLoadingDates ? (
                        <Text style={{ textAlign: 'center', color: colors.textSecondary }}>Loading dates...</Text>
                    ) : availableDates.length === 0 ? (
                        <Text style={{ textAlign: 'center', color: colors.textSecondary }}>No history found.</Text>
                    ) : (
                        availableDates.map(date => (
                            <Pressable
                                key={date}
                                style={[
                                    styles.dateRow,
                                    selectedDeleteDates.has(date) && { backgroundColor: '#EF444420', borderColor: '#EF4444' }
                                ]}
                                onPress={() => toggleDeleteDate(date)}
                            >
                                <Text style={[styles.dateText, selectedDeleteDates.has(date) && { color: '#EF4444', fontWeight: 'bold' }]}>
                                    {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </Text>
                                {selectedDeleteDates.has(date) && <Ionicons name="checkmark-circle" size={20} color="#EF4444" />}
                            </Pressable>
                        ))
                    )}
                </ScrollView>

                <View style={styles.modalButtons}>
                    <GlassButton title="Cancel" onPress={() => setShowDeleteModal(false)} variant="ghost" />
                    <GlassButton
                        title={`Delete (${selectedDeleteDates.size})`}
                        onPress={confirmDeleteDates}
                        variant="primary"
                        disabled={selectedDeleteDates.size === 0}
                        style={{ backgroundColor: '#EF4444' }}
                    />
                </View>
            </GlassModal>
        </SafeAreaView>
    );
}

// Dynamic styles based on theme
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
    sectionTitle: {
        fontSize: typography.h3.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: spacing.md,
        marginTop: spacing.lg,
    },
    settingCard: {
        padding: spacing.md,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    settingText: {},
    settingTitle: {
        fontSize: typography.body.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    settingDesc: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        marginTop: 2,
    },
    actionCard: {
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    actionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    actionText: {
        flex: 1,
    },
    actionTitle: {
        fontSize: typography.body.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    actionDesc: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        marginTop: 2,
    },
    lastBackup: {
        fontSize: typography.caption.fontSize,
        color: colors.accentPositive,
        marginTop: 4,
    },
    infoCard: {
        padding: spacing.md,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
    },
    infoText: {
        flex: 1,
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
    },
    appInfoCard: {
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.lg,
    },
    appInfoText: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
    },
    devCard: {
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    devContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    devTextContainer: {
        flex: 1,
    },
    devLabel: {
        fontSize: typography.caption.fontSize,
        color: colors.textSecondary,
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    devName: {
        fontSize: typography.h3.fontSize,
        fontWeight: '700',
        color: colors.textPrimary,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', // Fallback, though we have custom fonts
        marginBottom: 2,
    },
    devLink: {
        fontSize: typography.caption.fontSize,
        color: colors.accentPositive,
        fontWeight: '600',
    },
    modalTitle: {
        fontSize: typography.h2.fontSize,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    modalDesc: {
        fontSize: typography.body.fontSize,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
        textAlign: 'center',
        paddingHorizontal: spacing.md,
    },
    modalInput: {
        marginBottom: spacing.md,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
    },
    clearButtonsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    clearBtn: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
    },
    clearBtnText: {
        fontSize: typography.caption.fontSize,
        fontWeight: '600',
        textAlign: 'center',
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: colors.glassSurface,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        marginBottom: 8,
    },
    dateText: {
        fontSize: 16,
        color: colors.textPrimary,
    },
});
