import { canPlacePiece, getPreviewClears } from '../game/board';
import type { BoardGrid, PieceInstance, PieceShape } from '../game/types';
import type { BoardRenderer, PreviewState } from './boardRenderer';

export interface DragControllerCallbacks {
  getBoard: () => BoardGrid;
  getTray: () => readonly PieceInstance[];
  isInteractive: () => boolean;
  onPickup: (trayIndex: number) => void;
  onPreviewChange: (preview: PreviewState | null) => void;
  onAttemptPlace: (trayIndex: number, row: number, col: number) => boolean;
  onDragStateChange: (
    draggingIndex: number | null,
    selectedIndex: number | null
  ) => void;
  onInvalidDrop: () => void;
}

interface ActiveDrag {
  pointerId: number;
  trayIndex: number;
  piece: PieceInstance;
  pointerType: string;
  startX: number;
  startY: number;
  moved: boolean;
  touchLiftY: number;
  floatingEl: HTMLElement;
  validAnchor: { row: number; col: number } | null;
}

export class DragController {
  private readonly trayEl: HTMLElement;
  private readonly boardEl: HTMLElement;
  private readonly dragLayerEl: HTMLElement;
  private readonly boardRenderer: BoardRenderer;
  private readonly callbacks: DragControllerCallbacks;

  private activeDrag: ActiveDrag | null = null;
  private selectedIndex: number | null = null;

  constructor(
    trayEl: HTMLElement,
    boardEl: HTMLElement,
    dragLayerEl: HTMLElement,
    boardRenderer: BoardRenderer,
    callbacks: DragControllerCallbacks
  ) {
    this.trayEl = trayEl;
    this.boardEl = boardEl;
    this.dragLayerEl = dragLayerEl;
    this.boardRenderer = boardRenderer;
    this.callbacks = callbacks;

    this.bindEvents();
  }

  public clearSelection(): void {
    this.selectedIndex = null;
    this.callbacks.onPreviewChange(null);
    this.callbacks.onDragStateChange(null, null);
  }

  public getSelectedIndex(): number | null {
    return this.selectedIndex;
  }

  private bindEvents(): void {
    this.trayEl.addEventListener('pointerdown', this.onTrayPointerDown);
    this.boardEl.addEventListener('pointerdown', this.onBoardPointerDown);
    this.boardEl.addEventListener('pointermove', this.onBoardHover);
    this.boardEl.addEventListener('pointerleave', this.onBoardLeave);

    window.addEventListener('pointermove', this.onWindowPointerMove, {
      passive: false,
    });
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('pointercancel', this.onWindowPointerCancel);
  }

  private readonly onTrayPointerDown = (e: PointerEvent): void => {
    if (!this.callbacks.isInteractive()) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const slot = (e.target as HTMLElement | null)?.closest<HTMLElement>(
      '.tray-slot'
    );
    if (!slot) return;

    const trayIndex = Number(slot.dataset.trayIndex);
    const piece = this.callbacks.getTray()[trayIndex];
    if (!piece || piece.placed) return;

    e.preventDefault();

    const isTouch = e.pointerType === 'touch';
    const cellSize = this.boardRenderer.getCellSize();
    const cellGap = this.boardRenderer.getCellGap();

    // Lift the dragged piece above the player's finger on touch devices (10" tablets)
    // so the finger never obscures the landing cells on the 8x8 board.
    const touchLiftY = isTouch
      ? Math.max(76, (piece.shape.height * (cellSize + cellGap)) * 0.55 + 48)
      : 0;

    const floatingEl = this.createFloatingPiece(piece, cellSize, cellGap);
    this.dragLayerEl.innerHTML = '';
    this.dragLayerEl.appendChild(floatingEl);

    this.activeDrag = {
      pointerId: e.pointerId,
      trayIndex,
      piece,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      touchLiftY,
      floatingEl,
      validAnchor: null,
    };

    this.callbacks.onPickup(trayIndex);
    this.callbacks.onDragStateChange(trayIndex, null);
    this.updateDragPosition(e.clientX, e.clientY);
  };

  private readonly onWindowPointerMove = (e: PointerEvent): void => {
    if (!this.activeDrag || e.pointerId !== this.activeDrag.pointerId) return;
    e.preventDefault();

    const dx = e.clientX - this.activeDrag.startX;
    const dy = e.clientY - this.activeDrag.startY;
    if (!this.activeDrag.moved && Math.hypot(dx, dy) > 9) {
      this.activeDrag.moved = true;
    }

    this.updateDragPosition(e.clientX, e.clientY);
  };

  private readonly onWindowPointerUp = (e: PointerEvent): void => {
    if (!this.activeDrag || e.pointerId !== this.activeDrag.pointerId) return;

    const drag = this.activeDrag;
    this.activeDrag = null;
    this.dragLayerEl.innerHTML = '';

    if (drag.validAnchor) {
      this.selectedIndex = null;
      this.callbacks.onPreviewChange(null);
      this.callbacks.onAttemptPlace(
        drag.trayIndex,
        drag.validAnchor.row,
        drag.validAnchor.col
      );
      return;
    }

    // If user tapped a tray slot without dragging, toggle tap-to-place selection
    if (!drag.moved) {
      this.selectedIndex =
        this.selectedIndex === drag.trayIndex ? null : drag.trayIndex;
      this.callbacks.onPreviewChange(null);
      this.callbacks.onDragStateChange(null, this.selectedIndex);
      return;
    }

    // Released over an invalid spot after dragging
    this.callbacks.onPreviewChange(null);
    this.callbacks.onDragStateChange(null, this.selectedIndex);
    this.callbacks.onInvalidDrop();
  };

  private readonly onWindowPointerCancel = (e: PointerEvent): void => {
    if (!this.activeDrag || e.pointerId !== this.activeDrag.pointerId) return;
    this.activeDrag = null;
    this.dragLayerEl.innerHTML = '';
    this.callbacks.onPreviewChange(null);
    this.callbacks.onDragStateChange(null, this.selectedIndex);
  };

  /**
   * Tap-to-place fallback: if a tray piece is selected via tap, tapping/clicking
   * a board cell places it centered at that cell.
   */
  private readonly onBoardPointerDown = (e: PointerEvent): void => {
    if (this.activeDrag || this.selectedIndex === null) return;
    if (!this.callbacks.isInteractive()) return;

    const piece = this.callbacks.getTray()[this.selectedIndex];
    if (!piece || piece.placed) {
      this.clearSelection();
      return;
    }

    const anchor = this.resolveBestValidAnchor(
      e.clientX,
      e.clientY,
      piece.shape
    );
    if (anchor) {
      const idx = this.selectedIndex;
      this.selectedIndex = null;
      this.callbacks.onPreviewChange(null);
      this.callbacks.onAttemptPlace(idx, anchor.row, anchor.col);
    } else {
      this.callbacks.onInvalidDrop();
    }
  };

  private readonly onBoardHover = (e: PointerEvent): void => {
    if (this.activeDrag || this.selectedIndex === null) return;
    if (e.pointerType === 'touch') return;
    const piece = this.callbacks.getTray()[this.selectedIndex];
    if (!piece || piece.placed) return;

    const anchor = this.resolveBestValidAnchor(
      e.clientX,
      e.clientY,
      piece.shape
    );
    this.emitPreview(piece, anchor);
  };

  private readonly onBoardLeave = (): void => {
    if (!this.activeDrag && this.selectedIndex !== null) {
      this.callbacks.onPreviewChange(null);
    }
  };

  private updateDragPosition(clientX: number, clientY: number): void {
    const drag = this.activeDrag;
    if (!drag) return;

    const visualCenterX = clientX;
    const visualCenterY = clientY - drag.touchLiftY;

    drag.floatingEl.style.transform = `translate3d(${visualCenterX}px, ${visualCenterY}px, 0) translate(-50%, -50%)`;

    const anchor = this.resolveBestValidAnchor(
      visualCenterX,
      visualCenterY,
      drag.piece.shape
    );
    drag.validAnchor = anchor;
    drag.floatingEl.classList.toggle('is-snapped', anchor !== null);
    this.emitPreview(drag.piece, anchor);
  }

  /**
   * Resolves the best valid placement anchor near `(centerX, centerY)`.
   * Includes a gentle magnetic tolerance so touchscreen drops feel smooth and forgiving.
   */
  private resolveBestValidAnchor(
    centerX: number,
    centerY: number,
    shape: PieceShape
  ): { row: number; col: number } | null {
    const board = this.callbacks.getBoard();
    const mapped = this.boardRenderer.pieceCenterToAnchor(
      centerX,
      centerY,
      shape
    );
    if (!mapped.inProximity) return null;

    if (canPlacePiece(board, shape, mapped.row, mapped.col)) {
      return { row: mapped.row, col: mapped.col };
    }

    // Subtle 1-cell neighborhood snap within 0.58 cell Euclidean distance
    let best: { row: number; col: number; dist: number } | null = null;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = mapped.row + dr;
        const nc = mapped.col + dc;
        if (!canPlacePiece(board, shape, nr, nc)) continue;
        const dist = Math.hypot(nr - mapped.exactRow, nc - mapped.exactCol);
        if (dist <= 0.62 && (!best || dist < best.dist)) {
          best = { row: nr, col: nc, dist };
        }
      }
    }

    return best ? { row: best.row, col: best.col } : null;
  }

  private emitPreview(
    piece: PieceInstance,
    anchor: { row: number; col: number } | null
  ): void {
    if (!anchor) {
      this.callbacks.onPreviewChange(null);
      return;
    }

    const board = this.callbacks.getBoard();
    const clears = getPreviewClears(board, piece.shape, anchor.row, anchor.col);
    const cells = piece.shape.cells.map((c) => ({
      row: anchor.row + c.row,
      col: anchor.col + c.col,
    }));

    this.callbacks.onPreviewChange({
      cells,
      color: piece.color,
      clearRows: clears.rows,
      clearCols: clears.cols,
    });
  }

  private createFloatingPiece(
    piece: PieceInstance,
    cellSize: number,
    cellGap: number
  ): HTMLElement {
    const { shape, color } = piece;
    const el = document.createElement('div');
    el.className = 'floating-piece';
    el.style.gridTemplateColumns = `repeat(${shape.width}, ${cellSize}px)`;
    el.style.gridTemplateRows = `repeat(${shape.height}, ${cellSize}px)`;
    el.style.gap = `${cellGap}px`;

    const occupied = new Set(shape.cells.map((c) => `${c.row},${c.col}`));
    for (let r = 0; r < shape.height; r++) {
      for (let c = 0; c < shape.width; c++) {
        const cell = document.createElement('div');
        if (occupied.has(`${r},${c}`)) {
          cell.className = `floating-block color-${color}`;
        } else {
          cell.className = 'floating-empty';
        }
        el.appendChild(cell);
      }
    }
    return el;
  }
}
