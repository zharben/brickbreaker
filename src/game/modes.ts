import type {
  AdventureStageConfig,
  GameModeConfig,
  GameStateSnapshot,
  StageObjective,
} from './types';

export const CLASSIC_MODE_CONFIG: GameModeConfig = {
  id: 'classic',
  label: 'Classic',
};

/**
 * Factory for future Adventure Mode stages.
 * Adventure Mode is not yet exposed in the UI, but the engine already supports
 * loading pre-filled obstacles, gem-embedded blocks, and stage completion checks.
 */
export function createAdventureModeConfig(
  stage: AdventureStageConfig
): GameModeConfig {
  return {
    id: 'adventure',
    label: `Adventure — Stage ${stage.stageNumber}`,
    stage,
  };
}

export function evaluateStageObjectives(
  objectives: readonly StageObjective[],
  state: Pick<
    GameStateSnapshot,
    'score' | 'totalLinesCleared' | 'collectedGems'
  >
): boolean {
  if (objectives.length === 0) return false;

  return objectives.every((obj) => {
    switch (obj.type) {
      case 'target_score':
        return state.score >= obj.target;
      case 'clear_lines':
        return state.totalLinesCleared >= obj.target;
      case 'collect_gems':
        return (state.collectedGems[obj.gem] ?? 0) >= obj.target;
    }
  });
}
