import { describe, expect, it } from 'vitest';
import {
  canPlacePiece,
  createEmptyBoard,
  getPreviewClears,
} from './board';
import { GameEngine } from './engine';
import { createAdventureModeConfig } from './modes';
import { calculateLevel } from './scoring';
import { createPieceInstance, PIECE_SHAPES } from './shapes';
import { BOARD_SIZE, type PieceInstance, type PieceShape } from './types';

function shapeById(id: string): PieceShape {
  const found = PIECE_SHAPES.find((s) => s.id === id);
  if (!found) throw new Error(`Shape not found: ${id}`);
  return found;
}

function makeFixedDealer(batches: PieceShape[][]): (count: number) => PieceInstance[] {
  let idx = 0;
  return () => {
    const shapes = batches[Math.min(idx, batches.length - 1)];
    idx++;
    return shapes.map((s) => createPieceInstance(s, 'cyan'));
  };
}

describe('BrickBreaker GameEngine core rules', () => {
  it('initializes an empty 8x8 board at Level 1 with 3 pieces in tray', () => {
    const engine = new GameEngine();
    const snap = engine.getSnapshot();

    expect(snap.board.length).toBe(BOARD_SIZE);
    expect(snap.board[0].length).toBe(BOARD_SIZE);
    expect(snap.board.flat().every((c) => c === null)).toBe(true);
    expect(snap.tray.length).toBe(3);
    expect(snap.level).toBe(1);
    expect(snap.comboStreak).toBe(0);
    expect(snap.isGameOver).toBe(false);
  });

  it('allows free-order placement and refills batch only after all 3 pieces are placed', () => {
    const dot = shapeById('dot-1');
    const engine = new GameEngine({
      customDealer: makeFixedDealer([
        [dot, dot, dot],
        [dot, dot, dot],
      ]),
    });

    // Place index 2, then 0, then 1 (out of order)
    const r1 = engine.placePiece(2, 0, 0);
    expect(r1.success).toBe(true);
    expect(r1.batchRefilled).toBe(false);
    expect(engine.getSnapshot().tray[2].placed).toBe(true);

    // Cannot place already-placed slot again
    expect(engine.placePiece(2, 0, 1).success).toBe(false);

    const r2 = engine.placePiece(0, 0, 1);
    expect(r2.success).toBe(true);
    expect(r2.batchRefilled).toBe(false);

    const r3 = engine.placePiece(1, 0, 2);
    expect(r3.success).toBe(true);
    expect(r3.batchRefilled).toBe(true);
    expect(engine.getSnapshot().batchNumber).toBe(2);
    expect(engine.getSnapshot().tray.every((p) => !p.placed)).toBe(true);
  });

  it('enforces no gravity when a row clears (blocks above remain floating in place)', () => {
    const line4h = shapeById('line-4h');
    const dot = shapeById('dot-1');

    const engine = new GameEngine({
      customDealer: makeFixedDealer([[dot, line4h, line4h]]),
    });

    // Place a floating block on row 2, col 3 (above row 5)
    engine.placePiece(0, 2, 3);
    // Fill row 5 completely with two 4-cell horizontal lines
    engine.placePiece(1, 5, 0);
    const clearRes = engine.placePiece(2, 5, 4);

    expect(clearRes.clearInfo.clearedRows).toEqual([5]);
    expect(clearRes.clearInfo.clearedBlockCount).toBe(8);

    const board = engine.getSnapshot().board;
    // Row 5 is cleared
    expect(board[5].every((c) => c === null)).toBe(true);
    // Block at (2, 3) did NOT fall down
    expect(board[2][3]).not.toBeNull();
    expect(board[3][3]).toBeNull();
  });

  it('supports simultaneous intersecting row + column clears without double-counting blocks', () => {
    const line4h = shapeById('line-4h');
    const line3h = shapeById('line-3h');
    const line4v = shapeById('line-4v');
    const line3v = shapeById('line-3v');
    const dot = shapeById('dot-1');

    const engine = new GameEngine({
      customDealer: makeFixedDealer([
        [line4h, line3h, line4v],
        [line3v, dot, dot],
      ]),
    });

    // Row 0: cols 0..3 and 5..7 (missing col 4)
    engine.placePiece(0, 0, 0);
    engine.placePiece(1, 0, 5);
    // Col 4: rows 1..4 and 5..7 (missing row 0)
    engine.placePiece(2, 1, 4);
    engine.placePiece(0, 5, 4);

    // Preview check before placing intersecting dot at (0, 4)
    const preview = getPreviewClears(engine.getBoardRef(), dot, 0, 4);
    expect(preview.rows).toEqual([0]);
    expect(preview.cols).toEqual([4]);

    // Place dot at (0, 4) -> clears row 0 AND col 4 simultaneously!
    const res = engine.placePiece(1, 0, 4);
    expect(res.clearInfo.clearedRows).toEqual([0]);
    expect(res.clearInfo.clearedCols).toEqual([4]);
    expect(res.clearInfo.linesCount).toBe(2);
    // 8 + 8 - 1 intersecting cell = 15 unique cleared blocks
    expect(res.clearInfo.clearedBlockCount).toBe(15);
    expect(res.scoreBreakdown.multiLineMultiplier).toBe(2);
  });

  it('increases combo streak per 3-piece round with a clear and resets to 0 after a round with no clear', () => {
    const line4h = shapeById('line-4h');
    const dot = shapeById('dot-1');

    const engine = new GameEngine({
      customDealer: makeFixedDealer([
        [line4h, line4h, dot], // Round 1: clears 1 row -> streak becomes 1 (x2)
        [line4h, line4h, dot], // Round 2: clears 1 row -> streak becomes 2 (x3)
        [dot, dot, dot], // Round 3: no clears -> streak resets to 0
      ]),
    });

    // Round 1
    engine.placePiece(0, 0, 0);
    const r1Clear = engine.placePiece(1, 0, 4);
    expect(r1Clear.comboStreak).toBe(1);
    expect(r1Clear.scoreBreakdown.comboMultiplier).toBe(2);
    engine.placePiece(2, 7, 7);
    expect(engine.getSnapshot().comboStreak).toBe(1);

    // Round 2
    engine.placePiece(0, 1, 0);
    const r2Clear = engine.placePiece(1, 1, 4);
    expect(r2Clear.comboStreak).toBe(2);
    expect(r2Clear.scoreBreakdown.comboMultiplier).toBe(3);
    expect(r2Clear.scoreBreakdown.totalPointsEarned).toBeGreaterThan(
      r1Clear.scoreBreakdown.totalPointsEarned
    );
    engine.placePiece(2, 7, 6);
    expect(engine.getSnapshot().comboStreak).toBe(2);

    // Round 3: no clears
    engine.placePiece(0, 7, 0);
    engine.placePiece(1, 7, 1);
    const r3End = engine.placePiece(2, 7, 2);
    expect(r3End.comboReset).toBe(true);
    expect(r3End.comboStreak).toBe(0);
    expect(engine.getSnapshot().comboStreak).toBe(0);
    expect(engine.getSnapshot().comboMultiplier).toBe(1);
  });

  it('triggers Game Over only when none of the remaining tray pieces can legally fit', () => {
    const sq3 = shapeById('sq-3x3');
    const dot = shapeById('dot-1');

    // Pre-fill board with 2 empty cells per row/col so no line clears when (0,0) is filled
    // and no 3x3 square can fit anywhere on the board.
    const presetCells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (c === r || c === (r + 1) % BOARD_SIZE) continue;
        presetCells.push({
          row: r,
          col: c,
          cell: { kind: 'block' as const, color: 'azure' as const },
        });
      }
    }

    const mode = createAdventureModeConfig({
      stageId: 'test-tight',
      stageNumber: 1,
      title: 'Tight Fit',
      initialCells: presetCells,
      objectives: [{ type: 'target_score', target: 999999 }],
    });

    const engine = new GameEngine({
      mode,
      customDealer: makeFixedDealer([[dot, sq3, sq3]]),
    });

    // At start, dot fits at (0,0), so NOT game over even though sq3 doesn't fit
    expect(engine.getSnapshot().isGameOver).toBe(false);

    // Place dot at (0,0) -> leaves only (0,1) open, and remaining pieces are two 3x3 squares!
    const res = engine.placePiece(0, 0, 0);
    expect(res.success).toBe(true);
    expect(res.isGameOver).toBe(true);
  });

  it('advances levels every 100 cleared lines', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    expect(calculateLevel(199)).toBe(2);
    expect(calculateLevel(200)).toBe(3);
  });

  it('supports future Adventure Mode gem collection and stage objective completion', () => {
    const line4h = shapeById('line-4h');
    const dot = shapeById('dot-1');

    const mode = createAdventureModeConfig({
      stageId: 'adv-1',
      stageNumber: 1,
      title: 'Gem Collector',
      initialCells: [
        { row: 0, col: 0, cell: { kind: 'obstacle', color: 'coral', gem: 'ruby' } },
        { row: 0, col: 1, cell: { kind: 'block', color: 'amber' } },
        { row: 0, col: 2, cell: { kind: 'block', color: 'amber' } },
        { row: 0, col: 3, cell: { kind: 'block', color: 'amber' } },
      ],
      objectives: [{ type: 'collect_gems', gem: 'ruby', target: 1 }],
    });

    const engine = new GameEngine({
      mode,
      customDealer: makeFixedDealer([[line4h, dot, dot]]),
    });

    const res = engine.placePiece(0, 0, 4);
    expect(res.success).toBe(true);
    expect(res.clearInfo.clearedRows).toEqual([0]);
    expect(res.isStageComplete).toBe(true);
    expect(engine.getSnapshot().collectedGems.ruby).toBe(1);
  });

  it('enforces bounds checking on piece placement', () => {
    const board = createEmptyBoard();
    const line5h = shapeById('line-5h');
    expect(canPlacePiece(board, line5h, 0, 3)).toBe(true);
    expect(canPlacePiece(board, line5h, 0, 4)).toBe(false);
    expect(canPlacePiece(board, line5h, -1, 0)).toBe(false);
  });
});
