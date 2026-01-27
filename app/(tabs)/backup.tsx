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
                                <Text style={styles.actionTitle}>Export Backup</Text>
                                <Text style={styles.actionDesc}>
                                    Create encrypted .clearhead file
                                </Text>
                                {lastBackup && (
                                    <Text style={styles.lastBackup}>
                                        Last backup: {lastBackup}
                                    </Text>
                                )}
                            </View>
                        </View>
                        <GlassButton
                            title="Export"
                            onPress={handleExport}
                            variant="primary"
                            loading={isExporting}
                            icon={<Ionicons name="download-outline" size={18} color={colorScheme === 'dark' ? '#FFFFFF' : '#1A1A1A'} />}
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
                            title="Import"
                            onPress={handleImport}
                            loading={isImporting}
                            icon={<Ionicons name="folder-open-outline" size={18} color={colors.textPrimary} />}
                        />
                    </GlassCard>
                </Animated.View>

                {/* Data Info */}
                <Animated.View key={`data-${animationKey}`} entering={FadeInUp.delay(500)}>
                    <Text style={styles.sectionTitle}>Data Storage</Text>
                    <GlassCard depth={1} style={styles.infoCard}>
                        {[
                            { icon: 'lock-closed-outline', text: 'All data stored locally', checked: true },
                            { icon: 'cloud-offline-outline', text: 'No cloud sync', checked: true },
                            { icon: 'key-outline', text: 'Secured with encryption', checked: true },
                        ].map((item, index) => (
                            <View key={index} style={styles.infoRow}>
                                <Ionicons name={item.icon as any} size={18} color={colors.textSecondary} />
                                <Text style={styles.infoText}>{item.text}</Text>
                                <Ionicons name="checkmark" size={18} color={colors.accentPositive} />
                            </View>
                        ))}
                    </GlassCard>
                </Animated.View>

                {/* Developer Info */}
                <Animated.View key={`dev-${animationKey}`} entering={FadeInUp.delay(550)}>
                    <Text style={styles.sectionTitle}>Developer</Text>
                    <Pressable onPress={() => Linking.openURL('https://github.com/AaravSingh1350')}>
                        <GlassCard depth={2} intensity="heavy" style={styles.devCard}>
                            <View style={styles.devContent}>
                                <Ionicons name="logo-github" size={28} color={colors.textPrimary} />
                                <View style={styles.devTextContainer}>
                                    <Text style={styles.devLabel}>Developed by</Text>
                                    <Text style={styles.devName}>Aarav Singh Rajpoot</Text>
                                    <Text style={styles.devLink}>github.com/AaravSingh1350</Text>
                                </View>
                                <Ionicons name="open-outline" size={20} color={colors.accentPositive} />
                            </View>
                        </GlassCard>
                    </Pressable>
                </Animated.View>

                {/* App Info */}
                <Animated.View key={`app-${animationKey}`} entering={FadeInUp.delay(600)}>
                    <GlassCard depth={1} style={styles.appInfoCard}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
                        <Text style={styles.appInfoText}>
                            ClearHead v1.0 • Your data never leaves your device
                        </Text>
                    </GlassCard>
                </Animated.View>
            </ScrollView>

            {/* Password Modal */}
            <GlassModal visible={showPasswordModal} onClose={() => {
                setShowPasswordModal(false);
                setPassword('');
                setConfirmPassword('');
                pendingBackupData.current = null;
                pendingImportFile.current = null;
                setIsExporting(false);
            }}>
                <Text style={styles.modalTitle}>
                    {mode === 'export' ? 'Set Backup Password' : 'Enter Password'}
                </Text>
                <Text style={styles.modalDesc}>
                    {mode === 'export'
                        ? 'Set a new password for this specific backup file.'
                        : 'Enter the password used when creating this backup.'}
                </Text>
                <GlassInput
                    label="Password"
                    placeholder="Enter password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    containerStyle={styles.modalInput}
                />
                {mode === 'export' && (
                    <GlassInput
                        label="Confirm Password"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        containerStyle={styles.modalInput}
                    />
                )}
                <View style={styles.modalButtons}>
                    <GlassButton
                        title="Cancel"
                        onPress={() => {
                            setShowPasswordModal(false);
                            setPassword('');
                            setConfirmPassword('');
                            setIsExporting(false);
                        }}
                        variant="ghost"
                    />
                    <GlassButton
                        title={mode === 'export' ? 'Continue' : 'Decrypt'}
                        onPress={handlePasswordSubmit}
                        variant="primary"
                        disabled={!password || (mode === 'export' && !confirmPassword)}
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
});
