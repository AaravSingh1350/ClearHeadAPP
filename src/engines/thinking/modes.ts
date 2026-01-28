// Thinking Engine - Mode definitions and questions
// Implements the 4 thinking modes with their unique tones

export type ThinkingMode = 'logical' | 'brutal' | 'reflective' | 'action';

export interface ModeConfig {
    name: string;
    tone: string;
    color: string;
    fontFamily: string;
    icon: string;
    questions: string[];
}

export const THINKING_MODES: Record<ThinkingMode, ModeConfig> = {
    logical: {
        name: 'Logical',
        tone: 'cold',
        color: '#60A5FA',
        fontFamily: 'SpaceGrotesk',
        icon: 'calculator-outline',
        questions: [
            'What exactly is wrong?',
            'What are the constraints?',
            'What is the simplest explanation?',
            'What evidence supports this conclusion?',
            'What assumptions am I making here?',
            'What would a neutral observer say?',
            'What data is missing from this analysis?',
            'If I had to prove myself wrong, what would I look for?',
        ],
    },
    brutal: {
        name: 'Brutal',
        tone: 'confrontational',
        color: '#EF4444',
        fontFamily: 'Orbitron',
        icon: 'flame-outline',
        questions: [
            'What are you avoiding?',
            'What is the cost of delay?',
            'What would happen if nothing changes?',
            'What lie are you telling yourself right now?',
            'Are you making excuses or giving reasons?',
            'What would you tell your younger self about this?',
            'If time stopped here, would you be proud of your effort?',
            'What is the fear hiding behind this procrastination?',
        ],
    },
    reflective: {
        name: 'Reflective',
        tone: 'slow',
        color: '#A78BFA',
        fontFamily: 'Inter',
        icon: 'water-outline',
        questions: [
            'When did this start?',
            'What pattern does this follow?',
            'What emotion is driving this?',
            'How does this connect to your past experiences?',
            'What need is not being met here?',
            'If this feeling could speak, what would it say?',
            'What would change if you accepted this situation?',
            'How would the best version of you handle this?',
        ],
    },
    action: {
        name: 'Action',
        tone: 'decisive',
        color: '#F59E0B',
        fontFamily: 'Satoshi-Bold',
        icon: 'flash-outline',
        questions: [
            'What is the next irreversible step?',
            'When will it be done?',
            'What happens if it is skipped?',
            'Can you do something about it in the next 5 minutes?',
            'What is the smallest action that creates momentum?',
            'Who can help you accomplish this faster?',
            'What blockers need to be removed right now?',
            'What is your commitment for today?',
        ],
    },
};

// Get all modes as array for iteration
export function getModeList(): ThinkingMode[] {
    return ['logical', 'brutal', 'reflective', 'action'];
}

// Get configuration for a specific mode
export function getModeConfig(mode: ThinkingMode): ModeConfig {
    return THINKING_MODES[mode];
}

// Get the next question in a mode's sequence
export function getQuestion(mode: ThinkingMode, index: number): string | null {
    const questions = THINKING_MODES[mode].questions;
    if (index >= questions.length) return null;
    return questions[index];
}

// Check if there are more questions in a mode
export function hasMoreQuestions(mode: ThinkingMode, currentIndex: number): boolean {
    return currentIndex < THINKING_MODES[mode].questions.length - 1;
}
