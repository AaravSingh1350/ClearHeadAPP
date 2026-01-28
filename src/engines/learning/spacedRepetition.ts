// CogniFlow - Level-based Spaced Repetition System
// Implements optimized intervals for long-term memory retention

// Review intervals in days based on level (0-8)
// Following the proven SRS curve: 1, 2, 5, 10, 21, 50, 90, 180, 365
export const REVIEW_INTERVALS = [1, 2, 5, 10, 21, 50, 90, 180, 365] as const;

// Level at which a topic is considered "Mastered"
export const MASTERY_LEVEL = 5;

// Feedback types for review responses
export type ReviewFeedback = 'again' | 'hard' | 'good' | 'easy';

// Calculate next level based on feedback
export function calculateNextLevel(currentLevel: number, feedback: ReviewFeedback): number {
    switch (feedback) {
        case 'again':
            return 0; // Reset to beginning
        case 'hard':
            return Math.max(0, currentLevel - 1); // Go back one level
        case 'good':
            return currentLevel; // Stay at same level
        case 'easy':
            return Math.min(REVIEW_INTERVALS.length - 1, currentLevel + 1); // Advance one level
    }
}

// Calculate next review date based on level
export function calculateNextReview(level: number): number {
    const now = Date.now();
    const intervalIndex = Math.min(level, REVIEW_INTERVALS.length - 1);
    const intervalDays = REVIEW_INTERVALS[intervalIndex];
    return now + intervalDays * 24 * 60 * 60 * 1000;
}

// Calculate next review based on feedback (combined helper)
export function calculateNextReviewFromFeedback(currentLevel: number, feedback: ReviewFeedback): {
    nextLevel: number;
    nextReviewAt: number;
    isMastered: boolean;
} {
    const nextLevel = calculateNextLevel(currentLevel, feedback);
    const nextReviewAt = calculateNextReview(nextLevel);
    const isMastered = nextLevel >= MASTERY_LEVEL;
    return { nextLevel, nextReviewAt, isMastered };
}

// Check if a topic is mastered
export function isMastered(level: number): boolean {
    return level >= MASTERY_LEVEL;
}

// Get days until next review
export function getDaysUntilReview(nextReviewAt: number | null): number {
    if (!nextReviewAt) return 0;
    const now = Date.now();
    const diff = nextReviewAt - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Decay states based on time since last review
export type DecayState = 'fresh' | 'due' | 'overdue' | 'critical';

export function calculateDecayState(nextReviewAt: number | null): DecayState {
    if (!nextReviewAt) return 'fresh';

    const now = Date.now();
    const daysOverdue = Math.floor((now - nextReviewAt) / (1000 * 60 * 60 * 24));

    if (daysOverdue < 0) return 'fresh';  // Not due yet
    if (daysOverdue === 0) return 'due';   // Due today
    if (daysOverdue <= 3) return 'overdue'; // 1-3 days overdue
    return 'critical'; // More than 3 days overdue
}

// Get color for decay state
export function getDecayColor(state: DecayState): string {
    switch (state) {
        case 'fresh':
            return '#4ADE80'; // Green
        case 'due':
            return '#FBBF24'; // Yellow
        case 'overdue':
            return '#FB923C'; // Orange
        case 'critical':
            return '#EF4444'; // Red
    }
}

// Check if a topic needs review today
export function needsReviewToday(nextReviewAt: number | null): boolean {
    if (!nextReviewAt) return false;
    return nextReviewAt <= Date.now();
}

// Get level progress as percentage (for mastery visualization)
export function getLevelProgress(level: number): number {
    return Math.min(100, (level / MASTERY_LEVEL) * 100);
}

// Get interval description for a level
export function getIntervalDescription(level: number): string {
    const days = REVIEW_INTERVALS[Math.min(level, REVIEW_INTERVALS.length - 1)];
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.round(days / 7)} weeks`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return '1 year';
}

// Get feedback button color
export function getFeedbackColor(feedback: ReviewFeedback): string {
    switch (feedback) {
        case 'again':
            return '#EF4444'; // Red
        case 'hard':
            return '#FB923C'; // Orange
        case 'good':
            return '#3B82F6'; // Blue
        case 'easy':
            return '#22C55E'; // Green
    }
}

// Priority levels for task organization
export type Priority = 'high' | 'medium' | 'low';

export function getPriorityWeight(priority: Priority): number {
    switch (priority) {
        case 'high': return 3;
        case 'medium': return 2;
        case 'low': return 1;
    }
}
