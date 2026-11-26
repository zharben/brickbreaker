import { canPlacePieceAnywhere } from '../game/board';
import type { BoardGrid, PieceInstance } from '../game/types';

export class TrayRenderer {
  private readonly trayEl: HTMLElement;
  private readonly dotsEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private slotEls: HTMLElement[] = [];

  constructor(trayEl: HTMLElement, dotsEl: HTMLElement, hintEl: HTMLElement) {
    this.trayEl = trayEl;
    this.dotsEl = dotsEl;
    this.hintEl = hintEl;
  }

  public render(
    tray: readonly PieceInstance[],
    board: BoardGrid,
    activeDragIndex: number | null,
    selectedIndex: number | null,
    animateDeal = false
  ): void {
    this.trayEl.innerHTML = '';
    this.slotEls = [];

    let remainingCount = 0;

    tray.forEach((piece, index) => {
      if (!piece.placed) remainingCount++;

      const slot = document.createElement('div');
      slot.className = 'tray-slot';
      slot.dataset.trayIndex = String(index);
      slot.setAttribute('role', 'listitem');

      if (piece.placed) {
        slot.classList.add('is-empty');
        slot.setAttribute('aria-label', `Slot ${index + 1}: placed`);
      } else {
        const placeable = canPlacePieceAnywhere(board, piece.shape);
        if (!placeable) {
          slot.classList.add('is-unplaceable');
        }
        if (activeDragIndex === index) {
          slot.classList.add('is-dragging');
        }
        if (selectedIndex === index) {
          slot.classList.add('is-selected');
        }
        if (animateDeal) {
          slot.classList.add('just-dealt');
          slot.style.animationDelay = `${index * 45}ms`;
        }

        slot.setAttribute(
          'aria-label',
          `${piece.shape.name} piece${placeable ? '' : ' (no space currently)'}`
        );

        const pieceEl = this.createPieceMiniGrid(piece);
        slot.appendChild(pieceEl);
      }

      this.trayEl.appendChild(slot);
      this.slotEls.push(slot);
    });

    // Update batch dots
    const dots = this.dotsEl.querySelectorAll<HTMLElement>('.batch-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('is-active', idx < remainingCount);
    });

    if (selectedIndex !== null && tray[selectedIndex] && !tray[selectedIndex].placed) {
      this.hintEl.textContent =
        'Tap a cell on the board to place selected piece, or drag directly';
    } else {
      this.hintEl.textContent =
        'Drag any piece onto the 8×8 grid — place all 3 for a new batch';
    }
  }

  public getSlotElement(index: number): HTMLElement | null {
    return this.slotEls[index] ?? null;
  }

  private createPieceMiniGrid(piece: PieceInstance): HTMLElement {
    const { shape, color } = piece;
    const grid = document.createElement('div');
    grid.className = 'piece-preview';

    // Scale mini cell size gracefully so 5-long lines or 3x3 blocks fit cleanly
    const maxDim = Math.max(shape.width, shape.height);
    const scaleClass =
      maxDim >= 5 ? 'scale-xs' : maxDim === 4 ? 'scale-sm' : maxDim === 3 ? 'scale-md' : 'scale-lg';
    grid.classList.add(scaleClass);

    grid.style.gridTemplateColumns = `repeat(${shape.width}, var(--mini-cell))`;
    grid.style.gridTemplateRows = `repeat(${shape.height}, var(--mini-cell))`;

    const occupied = new Set(shape.cells.map((c) => `${c.row},${c.col}`));
    for (let r = 0; r < shape.height; r++) {
      for (let c = 0; c < shape.width; c++) {
        const cell = document.createElement('div');
        if (occupied.has(`${r},${c}`)) {
          cell.className = `mini-block color-${color}`;
        } else {
          cell.className = 'mini-empty';
        }
        grid.appendChild(cell);
      }
    }

    return grid;
  }
}
