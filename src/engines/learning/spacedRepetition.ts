// Spaced Repetition Engine
// Implements the Ebbinghaus forgetting curve with confidence modifiers

// Review intervals in days
export const REVIEW_INTERVALS = [1, 3, 7, 21, 45] as const;

// Calculate next review date based on review count and confidence
export function calculateNextReview(reviewCount: number, confidence: number): number {
    const now = Date.now();

    // Get base interval from the schedule
    const intervalIndex = Math.min(reviewCount, REVIEW_INTERVALS.length - 1);
    let intervalDays = REVIEW_INTERVALS[intervalIndex];

    // Apply confidence modifier
    // Low confidence (< 50): reduce interval by up to 50%
    // High confidence (> 70): increase interval by up to 30%
    if (confidence < 50) {
        const modifier = 0.5 + (confidence / 100);
        intervalDays = Math.max(1, Math.floor(intervalDays * modifier));
    } else if (confidence > 70) {
        const modifier = 1 + ((confidence - 70) / 100);
        intervalDays = Math.floor(intervalDays * modifier);
    }

    return now + intervalDays * 24 * 60 * 60 * 1000;
}

// Decay states based on time since last review
export type DecayState = 'fresh' | 'unstable' | 'decaying' | 'neglected';

export function calculateDecayState(lastReviewedAt: number): DecayState {
    const now = Date.now();
    const daysSinceReview = Math.floor((now - lastReviewedAt) / (1000 * 60 * 60 * 24));

    if (daysSinceReview <= 1) return 'fresh';
    if (daysSinceReview <= 3) return 'unstable';
    if (daysSinceReview <= 7) return 'decaying';
    return 'neglected';
}

// Calculate integrity percentage based on decay
export function calculateIntegrity(lastReviewedAt: number, baseIntegrity: number = 100): number {
    const now = Date.now();
    const daysSinceReview = Math.floor((now - lastReviewedAt) / (1000 * 60 * 60 * 24));

    // Decay 5% per day after the first day, min 0%
    const decayAmount = Math.max(0, (daysSinceReview - 1) * 5);
    return Math.max(0, baseIntegrity - decayAmount);
}

// Get color for integrity bar based on decay state
export function getDecayColor(state: DecayState): string {
    switch (state) {
        case 'fresh':
            return '#4ADE80'; // Green
        case 'unstable':
            return '#FBBF24'; // Yellow
        case 'decaying':
            return '#FB923C'; // Orange
        case 'neglected':
            return '#6B7280'; // Grey
    }
}

// Check if a topic needs review today
export function needsReviewToday(nextReviewAt: number | null): boolean {
    if (!nextReviewAt) return false;
    return nextReviewAt <= Date.now();
}

// Get urgency level for notifications
export type UrgencyLevel = 'normal' | 'warning' | 'critical';

export function getReviewUrgency(nextReviewAt: number | null): UrgencyLevel {
    if (!nextReviewAt) return 'normal';

    const now = Date.now();
    const hoursOverdue = (now - nextReviewAt) / (1000 * 60 * 60);

    if (hoursOverdue > 48) return 'critical';
    if (hoursOverdue > 0) return 'warning';
    return 'normal';
}
