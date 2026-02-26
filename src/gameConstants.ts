export type GameState = 'modeSelect' | 'levelSelect' | 'playing' | 'gameOver';
export type GameMode = '1P' | '2P';
export type Difficulty = 'Beginner' | 'Easy' | 'Medium' | 'Hard' | 'Extreme' | 'Insane' | 'Impossible';

export interface AIDifficultyConfig {
  reactionTime: number; // frames
  attackFrequency: number; // 0-1
  aggression: number; // 0-1
  specialUsage: number; // 0-1
  defenseTiming: number; // 0-1
  comboRate: number; // 0-1
}

export const DIFFICULTY_SETTINGS: Record<Difficulty, AIDifficultyConfig> = {
  Beginner: {
    reactionTime: 15,
    attackFrequency: 0.1,
    aggression: 0.7,
    specialUsage: 0.5,
    defenseTiming: 0.6,
    comboRate: 0.5
  },
  Easy: {
    reactionTime: 10,
    attackFrequency: 0.15,
    aggression: 0.85,
    specialUsage: 0.6,
    defenseTiming: 0.75,
    comboRate: 0.65
  },
  Medium: {
    reactionTime: 5,
    attackFrequency: 0.2,
    aggression: 1.0,
    specialUsage: 0.75,
    defenseTiming: 0.85,
    comboRate: 0.8
  },
  Hard: {
    reactionTime: 2,
    attackFrequency: 0.3,
    aggression: 1.1,
    specialUsage: 0.85,
    defenseTiming: 0.95,
    comboRate: 0.9
  },
  Extreme: {
    reactionTime: 1,
    attackFrequency: 0.45,
    aggression: 1.25,
    specialUsage: 0.95,
    defenseTiming: 1.0,
    comboRate: 0.95
  },
  Insane: {
    reactionTime: 0,
    attackFrequency: 0.65,
    aggression: 1.4,
    specialUsage: 1.0,
    defenseTiming: 1.0,
    comboRate: 1.0
  },
  Impossible: {
    reactionTime: 0,
    attackFrequency: 0.9,
    aggression: 1.6,
    specialUsage: 1.0,
    defenseTiming: 1.0,
    comboRate: 1.0
  }
};
