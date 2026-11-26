import { LINES_PER_LEVEL, type ScoreBreakdown } from './types';

export const POINTS_PER_PLACED_BLOCK = 1;
export const POINTS_PER_CLEARED_BLOCK = 10;

/**
 * Player starts at Level 1.
 * Level 2 at 100 lines, Level 3 at 200 lines, and so on.
 */
export function calculateLevel(totalLinesCleared: number): number {
  return Math.floor(Math.max(0, totalLinesCleared) / LINES_PER_LEVEL) + 1;
}

export function getLinesIntoCurrentLevel(totalLinesCleared: number): number {
  return Math.max(0, totalLinesCleared) % LINES_PER_LEVEL;
}

/**
 * Combo streak increases the rate of scoring via a multiplier on the raw block count.
 * Streak 0 -> x1, Streak 1 -> x2, Streak 2 -> x3, etc.
 */
export function getComboMultiplier(comboStreak: number): number {
  return 1 + Math.max(0, comboStreak);
}

/**
 * Multi-line clears award bonus points proportional to the number of lines
 * simultaneously cleared in one placement.
 */
export function getMultiLineMultiplier(linesCount: number): number {
  if (linesCount <= 0) return 0;
  return linesCount;
}

export function calculatePlacementScore(
  placedBlockCount: number,
  clearedBlockCount: number,
  linesCount: number,
  comboStreak: number
): ScoreBreakdown {
  const placementPoints = placedBlockCount * POINTS_PER_PLACED_BLOCK;

  if (linesCount <= 0 || clearedBlockCount <= 0) {
    return {
      placementPoints,
      clearBasePoints: 0,
      multiLineMultiplier: 0,
      comboMultiplier: getComboMultiplier(comboStreak),
      totalPointsEarned: placementPoints,
    };
  }

  const clearBasePoints = clearedBlockCount * POINTS_PER_CLEARED_BLOCK;
  const multiLineMultiplier = getMultiLineMultiplier(linesCount);
  const comboMultiplier = getComboMultiplier(comboStreak);
  const clearPoints = clearBasePoints * multiLineMultiplier * comboMultiplier;

  return {
    placementPoints,
    clearBasePoints,
    multiLineMultiplier,
    comboMultiplier,
    totalPointsEarned: placementPoints + clearPoints,
  };
}
