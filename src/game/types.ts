export const BOARD_SIZE = 8;
export const BATCH_SIZE = 3;
export const LINES_PER_LEVEL = 100;

export type BlockColor =
  | 'cyan'
  | 'amber'
  | 'violet'
  | 'emerald'
  | 'coral'
  | 'azure'
  | 'magenta';

export const BLOCK_COLORS: readonly BlockColor[] = [
  'cyan',
  'amber',
  'violet',
  'emerald',
  'coral',
  'azure',
  'magenta',
] as const;

export const COLOR_PALETTE: Record<
  BlockColor,
  { fill: string; glow: string; highlight: string }
> = {
  cyan: { fill: '#22d3ee', glow: '#67e8f9', highlight: '#cffafe' },
  amber: { fill: '#f59e0b', glow: '#fbbf24', highlight: '#fef3c7' },
  violet: { fill: '#a855f7', glow: '#c084fc', highlight: '#f3e8ff' },
  emerald: { fill: '#10b981', glow: '#34d399', highlight: '#d1fae5' },
  coral: { fill: '#f43f5e', glow: '#fb7185', highlight: '#ffe4e6' },
  azure: { fill: '#3b82f6', glow: '#60a5fa', highlight: '#dbeafe' },
  magenta: { fill: '#ec4899', glow: '#f472b6', highlight: '#fce7f3' },
};

export interface CellCoord {
  readonly row: number;
  readonly col: number;
}

/**
 * Future Adventure Mode gem collectible types embedded in blocks.
 */
export type GemType = 'ruby' | 'sapphire' | 'emerald' | 'diamond';

/**
 * Cell occupant on the 8x8 board.
 * Designed with Adventure Mode extensibility in mind:
 * - `kind: 'block'` for standard player-placed blocks
 * - `kind: 'obstacle'` for pre-filled stage obstacles (future Adventure Mode)
 * - `gem` for collectible items embedded in blocks (future Adventure Mode)
 * - `durability` for multi-hit blocks/obstacles (future Adventure Mode; defaults to 1)
 */
export interface CellData {
  readonly kind: 'block' | 'obstacle';
  readonly color: BlockColor;
  readonly gem?: GemType;
  readonly durability?: number;
}

export type BoardGrid = (CellData | null)[][];

export type ShapeCategory =
  | 'single'
  | 'line'
  | 'square'
  | 'rectangle'
  | 'l-shape'
  | 't-shape'
  | 'irregular';

export interface PieceShape {
  readonly id: string;
  readonly name: string;
  readonly category: ShapeCategory;
  /** Relative cell offsets from top-left (0, 0). Fixed orientation — never rotated. */
  readonly cells: readonly CellCoord[];
  readonly width: number;
  readonly height: number;
  readonly weight: number;
}

export interface PieceInstance {
  readonly instanceId: string;
  readonly shape: PieceShape;
  readonly color: BlockColor;
  placed: boolean;
}

export interface ClearedCellInfo {
  readonly row: number;
  readonly col: number;
  readonly color: BlockColor;
  readonly gem?: GemType;
}

export interface LineClearInfo {
  readonly clearedRows: readonly number[];
  readonly clearedCols: readonly number[];
  readonly clearedCells: readonly ClearedCellInfo[];
  readonly linesCount: number;
  readonly clearedBlockCount: number;
}

export interface ScoreBreakdown {
  readonly placementPoints: number;
  readonly clearBasePoints: number;
  readonly multiLineMultiplier: number;
  readonly comboMultiplier: number;
  readonly totalPointsEarned: number;
}

export interface PlacementResult {
  readonly success: boolean;
  readonly placedCells: readonly CellCoord[];
  readonly pieceColor?: BlockColor;
  readonly clearInfo: LineClearInfo;
  readonly scoreBreakdown: ScoreBreakdown;
  readonly previousLevel: number;
  readonly newLevel: number;
  readonly leveledUp: boolean;
  readonly comboStreak: number;
  readonly comboReset: boolean;
  readonly batchRefilled: boolean;
  readonly isGameOver: boolean;
  readonly isStageComplete: boolean;
}

/**
 * Extensible mode definitions supporting Classic Mode now and
 * stage-based Adventure Mode in future versions.
 */
export type GameModeId = 'classic' | 'adventure';

export type StageObjective =
  | { readonly type: 'target_score'; readonly target: number }
  | { readonly type: 'collect_gems'; readonly gem: GemType; readonly target: number }
  | { readonly type: 'clear_lines'; readonly target: number };

export interface PresetCell {
  readonly row: number;
  readonly col: number;
  readonly cell: CellData;
}

export interface AdventureStageConfig {
  readonly stageId: string;
  readonly stageNumber: number;
  readonly title: string;
  readonly initialCells: readonly PresetCell[];
  readonly objectives: readonly StageObjective[];
}

export interface GameModeConfig {
  readonly id: GameModeId;
  readonly label: string;
  readonly stage?: AdventureStageConfig;
}

export interface GameStateSnapshot {
  readonly mode: GameModeConfig;
  readonly board: BoardGrid;
  readonly tray: readonly PieceInstance[];
  readonly score: number;
  readonly bestScore: number;
  readonly totalLinesCleared: number;
  readonly level: number;
  readonly linesIntoCurrentLevel: number;
  readonly linesPerLevel: number;
  readonly comboStreak: number;
  readonly comboMultiplier: number;
  readonly roundHadClear: boolean;
  readonly batchNumber: number;
  readonly isGameOver: boolean;
  readonly isStageComplete: boolean;
  readonly collectedGems: Readonly<Record<GemType, number>>;
}
