import {
  BOARD_SIZE,
  type BlockColor,
  type BoardGrid,
  type CellCoord,
  type PieceShape,
} from '../game/types';

export interface PreviewState {
  cells: readonly CellCoord[];
  color: BlockColor;
  clearRows: readonly number[];
  clearCols: readonly number[];
}

export class BoardRenderer {
  private readonly boardEl: HTMLElement;
  private readonly frameEl: HTMLElement;
  private readonly cellEls: HTMLElement[][] = [];
  private shakeTimer: number | null = null;

  constructor(boardEl: HTMLElement, frameEl: HTMLElement) {
    this.boardEl = boardEl;
    this.frameEl = frameEl;
    this.buildGrid();
  }

  private buildGrid(): void {
    this.boardEl.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
      const rowEls: HTMLElement[] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        if (r === 3) cell.classList.add('quad-bottom');
        if (c === 3) cell.classList.add('quad-right');
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.setAttribute('role', 'gridcell');
        this.boardEl.appendChild(cell);
        rowEls.push(cell);
      }
      this.cellEls.push(rowEls);
    }
  }

  public render(
    board: BoardGrid,
    preview: PreviewState | null = null,
    justPlaced: readonly CellCoord[] = []
  ): void {
    const ghostSet = new Set<string>();
    const clearRowSet = new Set<number>(preview?.clearRows ?? []);
    const clearColSet = new Set<number>(preview?.clearCols ?? []);
    const justPlacedSet = new Set<string>();

    if (preview) {
      for (const cell of preview.cells) {
        ghostSet.add(`${cell.row},${cell.col}`);
      }
    }
    for (const cell of justPlaced) {
      justPlacedSet.add(`${cell.row},${cell.col}`);
    }

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const el = this.cellEls[r][c];
        const data = board[r][c];
        const key = `${r},${c}`;
        const isGhost = ghostSet.has(key);
        const willClear = clearRowSet.has(r) || clearColSet.has(c);

        let cls = 'board-cell';
        if (r === 3) cls += ' quad-bottom';
        if (c === 3) cls += ' quad-right';

        if (data) {
          cls += ` is-filled color-${data.color}`;
          if (data.kind === 'obstacle') {
            cls += ' is-obstacle';
          }
          if (data.gem) {
            cls += ` has-gem gem-${data.gem}`;
          }
          if (justPlacedSet.has(key)) {
            cls += ' just-placed';
          }
        } else if (isGhost && preview) {
          cls += ` is-ghost color-${preview.color}`;
        }

        if (willClear) {
          cls += ' will-clear';
        }

        if (el.className !== cls) {
          el.className = cls;
        }
      }
    }
  }

  public getBoardRect(): DOMRect {
    return this.boardEl.getBoundingClientRect();
  }

  public getCellSize(): number {
    const first = this.cellEls[0]?.[0];
    if (!first) return 48;
    return first.getBoundingClientRect().width;
  }

  public getCellGap(): number {
    const c0 = this.cellEls[0]?.[0]?.getBoundingClientRect();
    const c1 = this.cellEls[0]?.[1]?.getBoundingClientRect();
    if (!c0 || !c1) return 4;
    return Math.max(0, c1.left - c0.right);
  }

  public getCellCenter(row: number, col: number): { x: number; y: number; size: number } {
    const el = this.cellEls[row]?.[col];
    if (!el) {
      const rect = this.getBoardRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: 44 };
    }
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      size: rect.width,
    };
  }

  public getRowCenterY(row: number): number {
    return this.getCellCenter(row, 0).y;
  }

  public getColCenterX(col: number): number {
    return this.getCellCenter(0, col).x;
  }

  /**
   * Maps the visual center of a dragged piece in viewport coordinates to the
   * nearest board anchor cell (top-left of the piece's bounding box).
   */
  public pieceCenterToAnchor(
    centerX: number,
    centerY: number,
    shape: PieceShape
  ): { row: number; col: number; exactRow: number; exactCol: number; inProximity: boolean } {
    const rect = this.getBoardRect();
    const stepX = rect.width / BOARD_SIZE;
    const stepY = rect.height / BOARD_SIZE;

    const topLeftX = centerX - (shape.width * stepX) / 2;
    const topLeftY = centerY - (shape.height * stepY) / 2;

    const exactCol = (topLeftX - rect.left) / stepX;
    const exactRow = (topLeftY - rect.top) / stepY;

    const margin = Math.max(stepX, stepY) * 1.1;
    const inProximity =
      centerX >= rect.left - margin &&
      centerX <= rect.right + margin &&
      centerY >= rect.top - margin &&
      centerY <= rect.bottom + margin;

    return {
      row: Math.round(exactRow),
      col: Math.round(exactCol),
      exactRow,
      exactCol,
      inProximity,
    };
  }

  /**
   * Brief physical micro-shake scaled by the number of cleared blocks.
   */
  public triggerShake(clearedBlockCount: number): void {
    const magnitude = Math.min(8, 2 + Math.floor(clearedBlockCount / 5));
    this.frameEl.style.setProperty('--shake-mag', `${magnitude}px`);
    this.frameEl.classList.remove('is-shaking');
    // Force reflow to restart animation cleanly
    void this.frameEl.offsetWidth;
    this.frameEl.classList.add('is-shaking');

    if (this.shakeTimer !== null) {
      window.clearTimeout(this.shakeTimer);
    }
    this.shakeTimer = window.setTimeout(() => {
      this.frameEl.classList.remove('is-shaking');
      this.shakeTimer = null;
    }, 260);
  }
}
