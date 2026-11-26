import {
  BLOCK_COLORS,
  type BlockColor,
  type CellCoord,
  type PieceInstance,
  type PieceShape,
  type ShapeCategory,
} from './types';

function defineShape(
  id: string,
  name: string,
  category: ShapeCategory,
  weight: number,
  pattern: readonly string[]
): PieceShape {
  const cells: CellCoord[] = [];
  let maxRow = 0;
  let maxCol = 0;

  for (let r = 0; r < pattern.length; r++) {
    const rowStr = pattern[r];
    for (let c = 0; c < rowStr.length; c++) {
      if (rowStr[c] === '#') {
        cells.push({ row: r, col: c });
        if (r > maxRow) maxRow = r;
        if (c > maxCol) maxCol = c;
      }
    }
  }

  return {
    id,
    name,
    category,
    cells,
    width: maxCol + 1,
    height: maxRow + 1,
    weight,
  };
}

/**
 * Full catalog of fixed-orientation polyomino shapes.
 * Because pieces cannot be rotated or flipped, distinct orientations
 * are explicitly represented as separate templates.
 */
export const PIECE_SHAPES: readonly PieceShape[] = [
  // Single block
  defineShape('dot-1', 'Single', 'single', 6, ['#']),

  // Straight lines (horizontal & vertical)
  defineShape('line-2h', 'Domino H', 'line', 9, ['##']),
  defineShape('line-2v', 'Domino V', 'line', 9, ['#', '#']),
  defineShape('line-3h', 'Line 3 H', 'line', 10, ['###']),
  defineShape('line-3v', 'Line 3 V', 'line', 10, ['#', '#', '#']),
  defineShape('line-4h', 'Line 4 H', 'line', 8, ['####']),
  defineShape('line-4v', 'Line 4 V', 'line', 8, ['#', '#', '#', '#']),
  defineShape('line-5h', 'Line 5 H', 'line', 5, ['#####']),
  defineShape('line-5v', 'Line 5 V', 'line', 5, ['#', '#', '#', '#', '#']),

  // Squares
  defineShape('sq-2x2', 'Square 2×2', 'square', 12, ['##', '##']),
  defineShape('sq-3x3', 'Square 3×3', 'square', 5, ['###', '###', '###']),

  // Rectangles
  defineShape('rect-2x3', 'Rect 2×3', 'rectangle', 6, ['###', '###']),
  defineShape('rect-3x2', 'Rect 3×2', 'rectangle', 6, ['##', '##', '##']),

  // Small 2x2 corners (3 cells, 4 orientations)
  defineShape('corner-tl', 'Corner TL', 'l-shape', 7, ['##', '#.']),
  defineShape('corner-tr', 'Corner TR', 'l-shape', 7, ['##', '.#']),
  defineShape('corner-bl', 'Corner BL', 'l-shape', 7, ['#.', '##']),
  defineShape('corner-br', 'Corner BR', 'l-shape', 7, ['.#', '##']),

  // Large 3x3 L-corners (5 cells, 4 orientations)
  defineShape('big-l-tl', 'Big L TL', 'l-shape', 4, ['###', '#..', '#..']),
  defineShape('big-l-tr', 'Big L TR', 'l-shape', 4, ['###', '..#', '..#']),
  defineShape('big-l-bl', 'Big L BL', 'l-shape', 4, ['#..', '#..', '###']),
  defineShape('big-l-br', 'Big L BR', 'l-shape', 4, ['..#', '..#', '###']),

  // Classic 4-cell L & J shapes (8 orientations)
  defineShape('l4-down-r', 'L4 Down-R', 'l-shape', 5, ['#.', '#.', '##']),
  defineShape('l4-down-l', 'L4 Down-L', 'l-shape', 5, ['.#', '.#', '##']),
  defineShape('l4-up-r', 'L4 Up-R', 'l-shape', 5, ['##', '#.', '#.']),
  defineShape('l4-up-l', 'L4 Up-L', 'l-shape', 5, ['##', '.#', '.#']),
  defineShape('l4-right-d', 'L4 Right-D', 'l-shape', 5, ['###', '#..']),
  defineShape('l4-right-u', 'L4 Right-U', 'l-shape', 5, ['#..', '###']),
  defineShape('l4-left-d', 'L4 Left-D', 'l-shape', 5, ['###', '..#']),
  defineShape('l4-left-u', 'L4 Left-U', 'l-shape', 5, ['..#', '###']),

  // T-shapes (4 orientations)
  defineShape('t-down', 'T Down', 't-shape', 6, ['###', '.#.']),
  defineShape('t-up', 'T Up', 't-shape', 6, ['.#.', '###']),
  defineShape('t-right', 'T Right', 't-shape', 6, ['#.', '##', '#.']),
  defineShape('t-left', 'T Left', 't-shape', 6, ['.#', '##', '.#']),

  // Irregular clusters (S / Z / diagonal / plus)
  defineShape('z-h', 'Z Horizontal', 'irregular', 5, ['##.', '.##']),
  defineShape('s-h', 'S Horizontal', 'irregular', 5, ['.##', '##.']),
  defineShape('z-v', 'Z Vertical', 'irregular', 5, ['.#', '##', '#.']),
  defineShape('s-v', 'S Vertical', 'irregular', 5, ['#.', '##', '.#']),
  defineShape('diag-2a', 'Diagonal 2 A', 'irregular', 4, ['#.', '.#']),
  defineShape('diag-2b', 'Diagonal 2 B', 'irregular', 4, ['.#', '#.']),
  defineShape('plus-5', 'Plus Cluster', 'irregular', 3, ['.#.', '###', '.#.']),
];

const TOTAL_WEIGHT = PIECE_SHAPES.reduce((acc, s) => acc + s.weight, 0);

let nextPieceUid = 1;

export function createPieceInstance(
  shape: PieceShape,
  color: BlockColor
): PieceInstance {
  return {
    instanceId: `piece-${nextPieceUid++}`,
    shape,
    color,
    placed: false,
  };
}

export function pickWeightedShape(rng: () => number = Math.random): PieceShape {
  let roll = rng() * TOTAL_WEIGHT;
  for (const shape of PIECE_SHAPES) {
    roll -= shape.weight;
    if (roll <= 0) {
      return shape;
    }
  }
  return PIECE_SHAPES[PIECE_SHAPES.length - 1];
}

/**
 * Deals a batch of 3 pieces with distinct colors and mild variety guards
 * (prevents dealing duplicate massive 3x3 blocks in the same batch).
 */
export function dealBatch(
  count: number,
  rng: () => number = Math.random
): PieceInstance[] {
  const availableColors = [...BLOCK_COLORS];
  const batch: PieceInstance[] = [];
  let largeCount = 0;

  for (let i = 0; i < count; i++) {
    let shape = pickWeightedShape(rng);
    let attempts = 0;
    while (
      attempts < 6 &&
      ((shape.cells.length >= 6 && largeCount >= 1) ||
        batch.some((p) => p.shape.id === shape.id))
    ) {
      shape = pickWeightedShape(rng);
      attempts++;
    }
    if (shape.cells.length >= 6) {
      largeCount++;
    }

    const colorIdx = Math.floor(rng() * availableColors.length);
    const color = availableColors.splice(colorIdx, 1)[0] ?? BLOCK_COLORS[i % BLOCK_COLORS.length];

    batch.push(createPieceInstance(shape, color));
  }

  return batch;
}
