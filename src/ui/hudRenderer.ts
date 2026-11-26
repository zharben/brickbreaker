import type { GameStateSnapshot } from '../game/types';

export interface HudElements {
  scoreEl: HTMLElement;
  bestEl: HTMLElement;
  levelEl: HTMLElement;
  linesProgressEl: HTMLElement;
  levelBarEl: HTMLElement;
  levelBarWrapEl: HTMLElement;
  comboCardEl: HTMLElement;
  comboStreakEl: HTMLElement;
  multiplierEl: HTMLElement;
  roundStatusEl: HTMLElement;
  levelBannerEl: HTMLElement;
  levelBannerTitleEl: HTMLElement;
  modalEl: HTMLElement;
  modalScoreEl: HTMLElement;
  modalBestEl: HTMLElement;
  modalLevelEl: HTMLElement;
  modalLinesEl: HTMLElement;
}

export class HudRenderer {
  private readonly els: HudElements;
  private displayedScore = 0;
  private scoreAnimRaf: number | null = null;
  private levelBannerTimer: number | null = null;

  constructor(els: HudElements) {
    this.els = els;
  }

  public render(state: GameStateSnapshot, immediate = false): void {
    if (immediate) {
      if (this.scoreAnimRaf !== null) {
        cancelAnimationFrame(this.scoreAnimRaf);
        this.scoreAnimRaf = null;
      }
      this.displayedScore = state.score;
      this.els.scoreEl.textContent = state.score.toLocaleString();
    } else {
      this.animateScoreTo(state.score);
    }

    this.els.bestEl.textContent = state.bestScore.toLocaleString();
    this.els.levelEl.textContent = String(state.level);
    this.els.linesProgressEl.textContent = `${state.linesIntoCurrentLevel} / ${state.linesPerLevel}`;

    const pct = Math.min(
      100,
      Math.max(0, (state.linesIntoCurrentLevel / state.linesPerLevel) * 100)
    );
    this.els.levelBarEl.style.width = `${pct.toFixed(1)}%`;
    this.els.levelBarWrapEl.setAttribute(
      'aria-valuenow',
      String(state.linesIntoCurrentLevel)
    );

    this.els.comboStreakEl.textContent = String(state.comboStreak);
    this.els.multiplierEl.textContent = `×${state.comboMultiplier}`;

    this.els.comboCardEl.classList.toggle('is-hot', state.comboStreak >= 1);
    this.els.comboCardEl.classList.toggle('is-blazing', state.comboStreak >= 3);

    if (state.roundHadClear) {
      this.els.roundStatusEl.textContent = 'Streak secured this round ✓';
      this.els.roundStatusEl.classList.add('is-secured');
    } else if (state.comboStreak > 0) {
      this.els.roundStatusEl.textContent = 'Clear 1 line to keep streak';
      this.els.roundStatusEl.classList.remove('is-secured');
    } else {
      this.els.roundStatusEl.textContent = 'Clear 1 line to start streak';
      this.els.roundStatusEl.classList.remove('is-secured');
    }
  }

  public pulseCombo(): void {
    this.els.comboCardEl.classList.remove('is-pulsing');
    void this.els.comboCardEl.offsetWidth;
    this.els.comboCardEl.classList.add('is-pulsing');
  }

  public showLevelUp(newLevel: number): void {
    this.els.levelBannerTitleEl.textContent = `LEVEL ${newLevel}`;
    this.els.levelBannerEl.hidden = false;
    this.els.levelBannerEl.classList.remove('is-visible');
    void this.els.levelBannerEl.offsetWidth;
    this.els.levelBannerEl.classList.add('is-visible');

    if (this.levelBannerTimer !== null) {
      window.clearTimeout(this.levelBannerTimer);
    }
    this.levelBannerTimer = window.setTimeout(() => {
      this.els.levelBannerEl.classList.remove('is-visible');
      this.els.levelBannerEl.hidden = true;
      this.levelBannerTimer = null;
    }, 1800);
  }

  public showGameOver(state: GameStateSnapshot): void {
    this.els.modalScoreEl.textContent = state.score.toLocaleString();
    this.els.modalBestEl.textContent = state.bestScore.toLocaleString();
    this.els.modalLevelEl.textContent = String(state.level);
    this.els.modalLinesEl.textContent = state.totalLinesCleared.toLocaleString();
    this.els.modalEl.hidden = false;
  }

  public hideGameOver(): void {
    this.els.modalEl.hidden = true;
  }

  private animateScoreTo(target: number): void {
    if (this.scoreAnimRaf !== null) {
      cancelAnimationFrame(this.scoreAnimRaf);
      this.scoreAnimRaf = null;
    }

    const startVal = this.displayedScore;
    const diff = target - startVal;
    if (diff === 0) return;

    const startTime = performance.now();
    const duration = Math.min(420, Math.max(160, Math.abs(diff) * 0.4));

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.displayedScore = Math.round(startVal + diff * eased);
      this.els.scoreEl.textContent = this.displayedScore.toLocaleString();
      if (t < 1) {
        this.scoreAnimRaf = requestAnimationFrame(step);
      } else {
        this.displayedScore = target;
        this.els.scoreEl.textContent = target.toLocaleString();
        this.scoreAnimRaf = null;
      }
    };

    this.scoreAnimRaf = requestAnimationFrame(step);
  }
}
