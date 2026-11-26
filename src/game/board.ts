import {
  BOARD_SIZE,
  type BlockColor,
  type BoardGrid,
  type CellCoord,
  type CellData,
  type ClearedCellInfo,
  type LineClearInfo,
  type PieceInstance,
  type PieceShape,
  type PresetCell,
} from './types';

export function createEmptyBoard(): BoardGrid {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

export function createBoardFromPreset(
  presetCells?: readonly PresetCell[]
): BoardGrid {
  const board = createEmptyBoard();
  if (!presetCells) return board;

  for (const preset of presetCells) {
    if (
      preset.row >= 0 &&
      preset.row < BOARD_SIZE &&
      preset.col >= 0 &&
      preset.col < BOARD_SIZE
    ) {
      board[preset.row][preset.col] = { ...preset.cell };
    }
  }
  return board;
}

export function cloneBoard(board: BoardGrid): BoardGrid {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function canPlacePiece(
  board: BoardGrid,
  shape: PieceShape,
  anchorRow: number,
  anchorCol: number
): boolean {
  for (const offset of shape.cells) {
    const r = anchorRow + offset.row;
    const c = anchorCol + offset.col;
    if (!isInBounds(r, c) || board[r][c] !== null) {
      return false;
    }
  }
  return true;
}

export function canPlacePieceAnywhere(
  board: BoardGrid,
  shape: PieceShape
): boolean {
  const maxAnchorRow = BOARD_SIZE - shape.height;
  const maxAnchorCol = BOARD_SIZE - shape.width;

  for (let r = 0; r <= maxAnchorRow; r++) {
    for (let c = 0; c <= maxAnchorCol; c++) {
      if (canPlacePiece(board, shape, r, c)) {
        return true;
      }
    }
  }
  return false;
}

export function hasAnyLegalMove(
  board: BoardGrid,
  tray: readonly PieceInstance[]
): boolean {
  for (const piece of tray) {
    if (!piece.placed && canPlacePieceAnywhere(board, piece.shape)) {
      return true;
    }
  }
  return false;
}

/**
 * Predicts which rows and columns would clear if `shape` were placed at
 * `(anchorRow, anchorCol)`. Does not mutate the board.
 */
export function getPreviewClears(
  board: BoardGrid,
  shape: PieceShape,
  anchorRow: number,
  anchorCol: number
): { rows: number[]; cols: number[] } {
  if (!canPlacePiece(board, shape, anchorRow, anchorCol)) {
    return { rows: [], cols: [] };
  }

  const placedSet = new Set<string>();
  for (const offset of shape.cells) {
    placedSet.add(`${anchorRow + offset.row},${anchorCol + offset.col}`);
  }

  const isFilled = (r: number, c: number): boolean =>
    board[r][c] !== null || placedSet.has(`${r},${c}`);

  const rows: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!isFilled(r, c)) {
        full = false;
        break;
      }
    }
    if (full) rows.push(r);
  }

  const cols: number[] = [];
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (!isFilled(r, c)) {
        full = false;
        break;
      }
    }
    if (full) cols.push(c);
  }

  return { rows, cols };
}

/**
 * Places a piece onto `board` (mutating in-place) and resolves simultaneous
 * horizontal row & vertical column clears. Remaining blocks do NOT fall (no gravity).
 */
export function placeAndResolveClears(
  board: BoardGrid,
  shape: PieceShape,
  color: BlockColor,
  anchorRow: number,
  anchorCol: number
): { placedCells: CellCoord[]; clearInfo: LineClearInfo } {
  const placedCells: CellCoord[] = [];
  for (const offset of shape.cells) {
    const r = anchorRow + offset.row;
    const c = anchorCol + offset.col;
    const cell: CellData = { kind: 'block', color };
    board[r][c] = cell;
    placedCells.push({ row: r, col: c });
  }

  const clearedRows: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (board[r].every((cell) => cell !== null)) {
      clearedRows.push(r);
    }
  }

  const clearedCols: number[] = [];
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r][c] === null) {
        full = false;
        break;
      }
    }
    if (full) {
      clearedCols.push(c);
    }
  }

  const clearedCells: ClearedCellInfo[] = [];
  const visited = new Set<string>();

  const clearCell = (r: number, c: number) => {
    const key = `${r},${c}`;
    if (visited.has(key)) return;
    visited.add(key);

    const existing = board[r][c];
    if (!existing) return;

    const durability = existing.durability ?? 1;
    if (durability > 1) {
      // Adventure Mode support: multi-hit obstacles decrement durability
      board[r][c] = { ...existing, durability: durability - 1 };
    } else {
      board[r][c] = null;
      clearedCells.push({
        row: r,
        col: c,
        color: existing.color,
        gem: existing.gem,
      });
    }
  };

  for (const r of clearedRows) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      clearCell(r, c);
    }
  }

  for (const c of clearedCols) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      clearCell(r, c);
    }
  }

  const clearInfo: LineClearInfo = {
    clearedRows,
    clearedCols,
    clearedCells,
    linesCount: clearedRows.length + clearedCols.length,
    clearedBlockCount: clearedCells.length,
  };

  return { placedCells, clearInfo };
}
