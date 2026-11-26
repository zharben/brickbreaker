import './styles/main.css';
import { SoundEngine } from './audio/soundEngine';
import { GameEngine } from './game/engine';
import { CLASSIC_MODE_CONFIG } from './game/modes';
import { BoardRenderer, type PreviewState } from './ui/boardRenderer';
import { DragController } from './ui/dragController';
import { FxCanvas, type CellFxTarget } from './ui/fxCanvas';
import { HudRenderer } from './ui/hudRenderer';
import { TrayRenderer } from './ui/trayRenderer';

const STORAGE_KEY_BEST = 'brickbreaker_classic_best_v1';

function loadBestScore(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_BEST);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_BEST, String(score));
  } catch {
    // ignore storage errors
  }
}

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing required element #${id}`);
  }
  return el as T;
}

function bootstrap(): void {
  const sound = new SoundEngine();
  const engine = new GameEngine({
    mode: CLASSIC_MODE_CONFIG,
    initialBestScore: loadBestScore(),
  });

  const boardEl = getEl<HTMLElement>('game-board');
  const boardFrameEl = getEl<HTMLElement>('board-frame');
  const trayEl = getEl<HTMLElement>('piece-tray');
  const batchDotsEl = getEl<HTMLElement>('batch-dots');
  const trayHintEl = getEl<HTMLElement>('tray-hint');
  const dragLayerEl = getEl<HTMLElement>('drag-layer');
  const fxCanvasEl = getEl<HTMLCanvasElement>('fx-canvas');

  const btnSound = getEl<HTMLButtonElement>('btn-sound');
  const btnRestart = getEl<HTMLButtonElement>('btn-restart');
  const btnPlayAgain = getEl<HTMLButtonElement>('btn-play-again');

  const boardRenderer = new BoardRenderer(boardEl, boardFrameEl);
  const trayRenderer = new TrayRenderer(trayEl, batchDotsEl, trayHintEl);
  const fxCanvas = new FxCanvas(fxCanvasEl);
  const hudRenderer = new HudRenderer({
    scoreEl: getEl('hud-score'),
    bestEl: getEl('hud-best'),
    levelEl: getEl('hud-level'),
    linesProgressEl: getEl('hud-lines-progress'),
    levelBarEl: getEl('hud-level-bar'),
    levelBarWrapEl: getEl('hud-level-bar-wrap'),
    comboCardEl: getEl('hud-combo-card'),
    comboStreakEl: getEl('hud-combo-streak'),
    multiplierEl: getEl('hud-multiplier'),
    roundStatusEl: getEl('hud-round-status'),
    levelBannerEl: getEl('level-banner'),
    levelBannerTitleEl: getEl('level-banner-title'),
    modalEl: getEl('gameover-modal'),
    modalScoreEl: getEl('modal-score'),
    modalBestEl: getEl('modal-best'),
    modalLevelEl: getEl('modal-level'),
    modalLinesEl: getEl('modal-lines'),
  });

  let activePreview: PreviewState | null = null;
  let draggingIndex: number | null = null;
  let selectedIndex: number | null = null;
  let gameOverTimer: number | null = null;

  const syncSoundButton = () => {
    const muted = sound.isMuted();
    const iconOn = btnSound.querySelector<HTMLElement>('.icon-sound-on');
    const iconOff = btnSound.querySelector<HTMLElement>('.icon-sound-off');
    if (iconOn) iconOn.hidden = muted;
    if (iconOff) iconOff.hidden = !muted;
    btnSound.setAttribute('aria-pressed', String(!muted));
  };

  const renderAll = (options?: {
    immediateHud?: boolean;
    animateDeal?: boolean;
    justPlaced?: readonly { row: number; col: number }[];
  }) => {
    const state = engine.getSnapshot();
    boardRenderer.render(
      state.board,
      activePreview,
      options?.justPlaced ?? []
    );
    trayRenderer.render(
      state.tray,
      state.board,
      draggingIndex,
      selectedIndex,
      options?.animateDeal ?? false
    );
    hudRenderer.render(state, options?.immediateHud ?? false);
  };

  const dragController = new DragController(
    trayEl,
    boardEl,
    dragLayerEl,
    boardRenderer,
    {
      getBoard: () => engine.getBoardRef(),
      getTray: () => engine.getSnapshot().tray,
      isInteractive: () => !engine.getSnapshot().isGameOver,
      onPickup: () => {
        sound.unlock();
        sound.playPickup();
      },
      onPreviewChange: (preview) => {
        activePreview = preview;
        boardRenderer.render(engine.getBoardRef(), activePreview);
      },
      onDragStateChange: (dragIdx, selIdx) => {
        draggingIndex = dragIdx;
        selectedIndex = selIdx;
        trayRenderer.render(
          engine.getSnapshot().tray,
          engine.getBoardRef(),
          draggingIndex,
          selectedIndex
        );
      },
      onInvalidDrop: () => {
        sound.playInvalid();
      },
      onAttemptPlace: (trayIndex, row, col) => {
        const result = engine.placePiece(trayIndex, row, col);
        if (!result.success) {
          sound.playInvalid();
          return false;
        }

        activePreview = null;
        draggingIndex = null;
        selectedIndex = null;

        const nextState = engine.getSnapshot();
        saveBestScore(nextState.bestScore);

        if (result.clearInfo.linesCount > 0) {
          // Gather viewport coordinates for each cleared block to drive scaled explosions
          const cellTargets: CellFxTarget[] = result.clearInfo.clearedCells.map(
            (cell) => {
              const center = boardRenderer.getCellCenter(cell.row, cell.col);
              return {
                x: center.x,
                y: center.y,
                size: center.size,
                color: cell.color,
              };
            }
          );

          // Screen-wide lightning along every cleared row & column
          const rowYs = result.clearInfo.clearedRows.map((r) =>
            boardRenderer.getRowCenterY(r)
          );
          const colXs = result.clearInfo.clearedCols.map((c) =>
            boardRenderer.getColCenterX(c)
          );

          fxCanvas.triggerScreenLightning(rowYs, colXs);
          fxCanvas.triggerClearExplosion(
            cellTargets,
            result.clearInfo.clearedBlockCount,
            result.clearInfo.linesCount,
            result.comboStreak,
            result.scoreBreakdown.totalPointsEarned
          );

          boardRenderer.triggerShake(result.clearInfo.clearedBlockCount);
          sound.playExplosion(
            result.clearInfo.clearedBlockCount,
            result.clearInfo.linesCount,
            result.comboStreak
          );
          hudRenderer.pulseCombo();
        } else {
          sound.playPlace(result.placedCells.length);
        }

        if (result.batchRefilled && !result.isGameOver) {
          window.setTimeout(() => sound.playBatchDeal(), 120);
        }

        if (result.leveledUp) {
          hudRenderer.showLevelUp(result.newLevel);
          window.setTimeout(() => sound.playLevelUp(), 180);
        }

        renderAll({
          animateDeal: result.batchRefilled,
          justPlaced: result.clearInfo.linesCount === 0 ? result.placedCells : [],
        });

        if (result.isGameOver) {
          if (gameOverTimer !== null) {
            window.clearTimeout(gameOverTimer);
          }
          gameOverTimer = window.setTimeout(() => {
            sound.playGameOver();
            hudRenderer.showGameOver(engine.getSnapshot());
            gameOverTimer = null;
          }, result.clearInfo.linesCount > 0 ? 520 : 280);
        }

        return true;
      },
    }
  );

  const startNewRun = () => {
    if (gameOverTimer !== null) {
      window.clearTimeout(gameOverTimer);
      gameOverTimer = null;
    }
    sound.unlock();
    activePreview = null;
    draggingIndex = null;
    selectedIndex = null;
    dragController.clearSelection();
    hudRenderer.hideGameOver();
    engine.reset(CLASSIC_MODE_CONFIG);
    renderAll({ immediateHud: true, animateDeal: true });
    sound.playBatchDeal();
  };

  btnSound.addEventListener('click', () => {
    sound.toggleMute();
    syncSoundButton();
  });

  btnRestart.addEventListener('click', startNewRun);
  btnPlayAgain.addEventListener('click', startNewRun);

  syncSoundButton();
  renderAll({ immediateHud: true, animateDeal: true });
}

bootstrap();
