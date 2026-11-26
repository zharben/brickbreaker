import {
  canPlacePiece,
  cloneBoard,
  createBoardFromPreset,
  hasAnyLegalMove,
  placeAndResolveClears,
} from './board';
import { CLASSIC_MODE_CONFIG, evaluateStageObjectives } from './modes';
import {
  calculateLevel,
  calculatePlacementScore,
  getComboMultiplier,
  getLinesIntoCurrentLevel,
} from './scoring';
import { dealBatch } from './shapes';
import {
  BATCH_SIZE,
  LINES_PER_LEVEL,
  type BoardGrid,
  type GameModeConfig,
  type GameStateSnapshot,
  type GemType,
  type PieceInstance,
  type PlacementResult,
} from './types';

export interface GameEngineOptions {
  mode?: GameModeConfig;
  initialBestScore?: number;
  rng?: () => number;
  customDealer?: (count: number) => PieceInstance[];
}

export class GameEngine {
  private mode: GameModeConfig;
  private board: BoardGrid;
  private tray: PieceInstance[];
  private score = 0;
  private bestScore = 0;
  private totalLinesCleared = 0;
  private comboStreak = 0;
  private roundHadClear = false;
  private batchNumber = 1;
  private isGameOver = false;
  private isStageComplete = false;
  private collectedGems: Record<GemType, number> = {
    ruby: 0,
    sapphire: 0,
    emerald: 0,
    diamond: 0,
  };

  private readonly rng: () => number;
  private readonly dealer: (count: number) => PieceInstance[];

  constructor(options: GameEngineOptions = {}) {
    this.mode = options.mode ?? CLASSIC_MODE_CONFIG;
    this.bestScore = Math.max(0, options.initialBestScore ?? 0);
    this.rng = options.rng ?? Math.random;
    this.dealer = options.customDealer ?? ((count) => dealBatch(count, this.rng));

    this.board = createBoardFromPreset(this.mode.stage?.initialCells);
    this.tray = this.dealer(BATCH_SIZE);
    this.isGameOver = !hasAnyLegalMove(this.board, this.tray);
  }

  public reset(mode?: GameModeConfig): GameStateSnapshot {
    if (mode) {
      this.mode = mode;
    }
    this.board = createBoardFromPreset(this.mode.stage?.initialCells);
    this.score = 0;
    this.totalLinesCleared = 0;
    this.comboStreak = 0;
    this.roundHadClear = false;
    this.batchNumber = 1;
    this.isStageComplete = false;
    this.collectedGems = {
      ruby: 0,
      sapphire: 0,
      emerald: 0,
      diamond: 0,
    };
    this.tray = this.dealer(BATCH_SIZE);
    this.isGameOver = !hasAnyLegalMove(this.board, this.tray);
    return this.getSnapshot();
  }

  public getSnapshot(): GameStateSnapshot {
    const level = calculateLevel(this.totalLinesCleared);
    return {
      mode: this.mode,
      board: cloneBoard(this.board),
      tray: this.tray.map((p) => ({ ...p })),
      score: this.score,
      bestScore: this.bestScore,
      totalLinesCleared: this.totalLinesCleared,
      level,
      linesIntoCurrentLevel: getLinesIntoCurrentLevel(this.totalLinesCleared),
      linesPerLevel: LINES_PER_LEVEL,
      comboStreak: this.comboStreak,
      comboMultiplier: getComboMultiplier(this.comboStreak),
      roundHadClear: this.roundHadClear,
      batchNumber: this.batchNumber,
      isGameOver: this.isGameOver,
      isStageComplete: this.isStageComplete,
      collectedGems: { ...this.collectedGems },
    };
  }

  public getBoardRef(): BoardGrid {
    return this.board;
  }

  public canPlaceTrayPiece(
    trayIndex: number,
    anchorRow: number,
    anchorCol: number
  ): boolean {
    if (this.isGameOver || this.isStageComplete) return false;
    const piece = this.tray[trayIndex];
    if (!piece || piece.placed) return false;
    return canPlacePiece(this.board, piece.shape, anchorRow, anchorCol);
  }

  public placePiece(
    trayIndex: number,
    anchorRow: number,
    anchorCol: number
  ): PlacementResult {
    const emptyFailure: PlacementResult = {
      success: false,
      placedCells: [],
      clearInfo: {
        clearedRows: [],
        clearedCols: [],
        clearedCells: [],
        linesCount: 0,
        clearedBlockCount: 0,
      },
      scoreBreakdown: {
        placementPoints: 0,
        clearBasePoints: 0,
        multiLineMultiplier: 0,
        comboMultiplier: getComboMultiplier(this.comboStreak),
        totalPointsEarned: 0,
      },
      previousLevel: calculateLevel(this.totalLinesCleared),
      newLevel: calculateLevel(this.totalLinesCleared),
      leveledUp: false,
      comboStreak: this.comboStreak,
      comboReset: false,
      batchRefilled: false,
      isGameOver: this.isGameOver,
      isStageComplete: this.isStageComplete,
    };

    if (!this.canPlaceTrayPiece(trayIndex, anchorRow, anchorCol)) {
      return emptyFailure;
    }

    const piece = this.tray[trayIndex];
    const previousLevel = calculateLevel(this.totalLinesCleared);

    const { placedCells, clearInfo } = placeAndResolveClears(
      this.board,
      piece.shape,
      piece.color,
      anchorRow,
      anchorCol
    );

    piece.placed = true;

    // Collect any gems from cleared blocks (future Adventure Mode support)
    for (const cleared of clearInfo.clearedCells) {
      if (cleared.gem) {
        this.collectedGems[cleared.gem] += 1;
      }
    }

    // Update combo streak on clear within the current 3-piece round
    if (clearInfo.linesCount > 0) {
      if (!this.roundHadClear) {
        this.roundHadClear = true;
        this.comboStreak += 1;
      }
      this.totalLinesCleared += clearInfo.linesCount;
    }

    // Score uses the active combo streak multiplier
    const scoreBreakdown = calculatePlacementScore(
      placedCells.length,
      clearInfo.clearedBlockCount,
      clearInfo.linesCount,
      this.comboStreak
    );

    this.score += scoreBreakdown.totalPointsEarned;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }

    // Check if the 3-piece batch is complete
    let batchRefilled = false;
    let comboReset = false;
    const allPlaced = this.tray.every((p) => p.placed);

    if (allPlaced) {
      if (!this.roundHadClear) {
        if (this.comboStreak > 0) {
          comboReset = true;
        }
        this.comboStreak = 0;
      }
      this.roundHadClear = false;
      this.batchNumber += 1;
      this.tray = this.dealer(BATCH_SIZE);
      batchRefilled = true;
    }

    // Check Adventure Mode stage completion if active
    if (this.mode.id === 'adventure' && this.mode.stage) {
      this.isStageComplete = evaluateStageObjectives(
        this.mode.stage.objectives,
        {
          score: this.score,
          totalLinesCleared: this.totalLinesCleared,
          collectedGems: this.collectedGems,
        }
      );
    }

    // Check Game Over: no remaining unplaced piece in tray can legally fit anywhere
    if (!this.isStageComplete) {
      this.isGameOver = !hasAnyLegalMove(this.board, this.tray);
    }

    const newLevel = calculateLevel(this.totalLinesCleared);

    return {
      success: true,
      placedCells,
      pieceColor: piece.color,
      clearInfo,
      scoreBreakdown,
      previousLevel,
      newLevel,
      leveledUp: newLevel > previousLevel,
      comboStreak: this.comboStreak,
      comboReset,
      batchRefilled,
      isGameOver: this.isGameOver,
      isStageComplete: this.isStageComplete,
    };
  }
}
