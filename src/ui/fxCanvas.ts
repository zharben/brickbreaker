import { COLOR_PALETTE, type BlockColor } from '../game/types';

export interface CellFxTarget {
  x: number;
  y: number;
  size: number;
  color: BlockColor;
}

interface ExplosionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vRot: number;
  color: string;
  glow: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape: 'square' | 'spark';
}

interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  lineWidth: number;
  color: string;
  life: number;
  maxLife: number;
}

interface LightningBolt {
  points: { x: number; y: number }[];
  branches: { x: number; y: number }[][];
  life: number;
  maxLife: number;
  thickness: number;
}

interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  subtext?: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export class FxCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private particles: ExplosionParticle[] = [];
  private rings: ShockwaveRing[] = [];
  private bolts: LightningBolt[] = [];
  private callouts: FloatingCallout[] = [];
  private screenFlashAlpha = 0;
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private width = 0;
  private height = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D context for FX canvas');
    }
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  public readonly resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /**
   * Triggers block clearing explosions whose size, shockwave radius,
   * particle velocity, and count scale directly with `clearedBlockCount`.
   */
  public triggerClearExplosion(
    targets: readonly CellFxTarget[],
    clearedBlockCount: number,
    linesCount: number,
    comboStreak: number,
    pointsEarned: number
  ): void {
    if (targets.length === 0) return;

    // Scale factor corresponds directly to number of cleared blocks
    // 8 blocks -> ~1.0, 15 blocks -> ~1.55, 22 blocks -> ~2.1, 30 blocks -> ~2.6
    const intensity = Math.min(2.6, 0.45 + clearedBlockCount * 0.072);

    let sumX = 0;
    let sumY = 0;
    const particlesPerCell = Math.round(5 + intensity * 4);

    for (const target of targets) {
      sumX += target.x;
      sumY += target.y;
      const palette = COLOR_PALETTE[target.color];

      for (let i = 0; i < particlesPerCell; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (90 + Math.random() * 240) * (0.75 + intensity * 0.45);
        const isSpark = i % 3 === 0;
        const maxLife = (0.34 + Math.random() * 0.28) * (0.85 + intensity * 0.2);

        this.particles.push({
          x: target.x + (Math.random() - 0.5) * target.size * 0.5,
          y: target.y + (Math.random() - 0.5) * target.size * 0.5,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: isSpark
            ? (3 + Math.random() * 3.5) * Math.min(1.6, intensity * 0.85)
            : (5 + Math.random() * 7) * Math.min(1.85, 0.7 + intensity * 0.55),
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 14,
          color: isSpark ? palette.highlight : palette.fill,
          glow: palette.glow,
          alpha: 1,
          life: 0,
          maxLife,
          shape: isSpark ? 'spark' : 'square',
        });
      }
    }

    const cx = sumX / targets.length;
    const cy = sumY / targets.length;

    // Primary explosion shockwave scaled by clearedBlockCount
    const baseRadius = 56 + clearedBlockCount * 7.5;
    this.rings.push({
      x: cx,
      y: cy,
      radius: 14,
      maxRadius: Math.min(290, baseRadius),
      lineWidth: 3 + intensity * 3.2,
      color: linesCount >= 2 ? '#fde047' : '#38bdf8',
      life: 0,
      maxLife: 0.34 + Math.min(0.24, clearedBlockCount * 0.008),
    });

    // Secondary fiery core wave for larger clears
    if (clearedBlockCount >= 12) {
      this.rings.push({
        x: cx,
        y: cy,
        radius: 8,
        maxRadius: Math.min(220, baseRadius * 0.72),
        lineWidth: 2.5 + intensity * 2.5,
        color: '#f97316',
        life: 0,
        maxLife: 0.28 + Math.min(0.18, clearedBlockCount * 0.006),
      });
    }

    // Floating score & combo popup
    const subParts: string[] = [];
    if (linesCount >= 2) {
      subParts.push(`${linesCount} LINES!`);
    }
    if (comboStreak >= 1) {
      subParts.push(`COMBO ×${1 + comboStreak}`);
    }

    this.callouts.push({
      x: Math.max(90, Math.min(this.width - 90, cx)),
      y: Math.max(80, cy - 10),
      vy: -56 - intensity * 14,
      text: `+${pointsEarned.toLocaleString()}`,
      subtext: subParts.length > 0 ? subParts.join('  •  ') : undefined,
      color: linesCount >= 2 ? '#fde047' : '#ffffff',
      scale: Math.min(1.45, 0.95 + intensity * 0.22),
      life: 0,
      maxLife: 0.95,
    });

    this.ensureLoop();
  }

  /**
   * Briefly flashes jagged electric lightning across the screen aligned with
   * every full horizontal row and/or vertical column cleared in the play.
   */
  public triggerScreenLightning(
    rowYs: readonly number[],
    colXs: readonly number[]
  ): void {
    const totalLines = rowYs.length + colXs.length;
    if (totalLines === 0) return;

    const thickness = Math.min(5.5, 2.8 + totalLines * 0.65);

    for (const y of rowYs) {
      this.bolts.push(
        this.buildBolt(0, y, this.width, y, true, thickness)
      );
    }

    for (const x of colXs) {
      this.bolts.push(
        this.buildBolt(x, 0, x, this.height, false, thickness)
      );
    }

    // Very brief subtle full-screen electric flash
    this.screenFlashAlpha = Math.min(0.24, 0.1 + totalLines * 0.035);
    this.ensureLoop();
  }

  private buildBolt(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    horizontal: boolean,
    thickness: number
  ): LightningBolt {
    const segments = 22;
    const jitter = horizontal ? 24 : 24;
    const points: { x: number; y: number }[] = [];
    const branches: { x: number; y: number }[][] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const edgeTaper = Math.sin(t * Math.PI);
      const offset =
        i === 0 || i === segments
          ? 0
          : (Math.random() - 0.5) * 2 * jitter * (0.45 + 0.55 * edgeTaper);

      const px = x1 + (x2 - x1) * t + (horizontal ? 0 : offset);
      const py = y1 + (y2 - y1) * t + (horizontal ? offset : 0);
      points.push({ x: px, y: py });

      // Spawn 3-5 short electric sub-branches along the bolt
      if (i > 2 && i < segments - 2 && Math.random() < 0.22) {
        const branch: { x: number; y: number }[] = [{ x: px, y: py }];
        let bx = px;
        let by = py;
        const dirSign = Math.random() < 0.5 ? -1 : 1;
        const steps = 3 + Math.floor(Math.random() * 2);
        for (let s = 0; s < steps; s++) {
          if (horizontal) {
            bx += (Math.random() - 0.25) * 34;
            by += dirSign * (14 + Math.random() * 22);
          } else {
            bx += dirSign * (14 + Math.random() * 22);
            by += (Math.random() - 0.25) * 34;
          }
          branch.push({ x: bx, y: by });
        }
        branches.push(branch);
      }
    }

    return {
      points,
      branches,
      life: 0,
      maxLife: 0.27, // Very brief dramatic flash
      thickness,
    };
  }

  private ensureLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTimestamp) / 1000));
    this.lastTimestamp = now;

    this.update(dt);
    this.render();

    const hasActive =
      this.particles.length > 0 ||
      this.rings.length > 0 ||
      this.bolts.length > 0 ||
      this.callouts.length > 0 ||
      this.screenFlashAlpha > 0.005;

    if (hasActive) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.rafId = null;
    }
  };

  private update(dt: number): void {
    // Screen flash decays rapidly
    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 1.45);
    }

    // Update explosion particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      const drag = Math.pow(0.08, dt);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
      p.alpha = 1 - p.life / p.maxLife;
    }

    // Update shockwaves
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      if (r.life >= r.maxLife) {
        this.rings.splice(i, 1);
        continue;
      }
      const progress = r.life / r.maxLife;
      const eased = 1 - Math.pow(1 - progress, 3);
      r.radius = 12 + (r.maxRadius - 12) * eased;
    }

    // Update lightning bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life += dt;
      if (b.life >= b.maxLife) {
        this.bolts.splice(i, 1);
      }
    }

    // Update floating score callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.life += dt;
      if (c.life >= c.maxLife) {
        this.callouts.splice(i, 1);
        continue;
      }
      c.y += c.vy * dt;
      c.vy *= Math.pow(0.25, dt);
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Brief electric screen flash
    if (this.screenFlashAlpha > 0.005) {
      ctx.save();
      ctx.fillStyle = `rgba(186, 230, 253, ${this.screenFlashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    // 2. Explosion shockwave rings
    for (const r of this.rings) {
      const progress = r.life / r.maxLife;
      const alpha = Math.max(0, (1 - progress) * 0.85);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1, r.lineWidth * (1 - progress * 0.7));
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Explosion shards & sparks
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.shadowColor = p.glow;
      ctx.shadowBlur = p.shape === 'spark' ? 12 : 8;
      ctx.fillStyle = p.color;

      if (p.shape === 'spark') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const half = p.size * 0.5;
        ctx.fillRect(-half, -half, p.size, p.size);
      }
      ctx.restore();
    }

    // 4. Screen-wide lightning bolts
    for (const bolt of this.bolts) {
      const progress = bolt.life / bolt.maxLife;
      // Sharp electric flicker envelope
      const flicker =
        progress < 0.25
          ? 1
          : progress < 0.45
          ? 0.55
          : progress < 0.65
          ? 0.95
          : Math.max(0, (1 - progress) / 0.35);

      this.drawBoltPath(
        bolt.points,
        bolt.thickness * 4.2,
        `rgba(56, 189, 248, ${(0.4 * flicker).toFixed(3)})`,
        26
      );
      this.drawBoltPath(
        bolt.points,
        bolt.thickness * 1.9,
        `rgba(125, 211, 252, ${(0.85 * flicker).toFixed(3)})`,
        14
      );
      this.drawBoltPath(
        bolt.points,
        bolt.thickness * 0.85,
        `rgba(255, 255, 255, ${flicker.toFixed(3)})`,
        8
      );

      for (const branch of bolt.branches) {
        this.drawBoltPath(
          branch,
          bolt.thickness * 0.9,
          `rgba(186, 230, 253, ${(0.75 * flicker).toFixed(3)})`,
          10
        );
      }
    }

    // 5. Floating score / combo popups
    for (const c of this.callouts) {
      const progress = c.life / c.maxLife;
      const alpha = progress < 0.2 ? progress / 0.2 : Math.max(0, 1 - (progress - 0.2) / 0.8);
      const popScale =
        progress < 0.16
          ? c.scale * (0.7 + (progress / 0.16) * 0.45)
          : c.scale * (1.15 - Math.min(0.15, (progress - 0.16) * 0.4));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y);
      ctx.scale(popScale, popScale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = '800 28px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(10, 14, 26, 0.85)';
      ctx.strokeText(c.text, 0, 0);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, 0, 0);

      if (c.subtext) {
        ctx.font = '700 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeText(c.subtext, 0, 22);
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(c.subtext, 0, 22);
      }
      ctx.restore();
    }
  }

  private drawBoltPath(
    pts: readonly { x: number; y: number }[],
    width: number,
    strokeStyle: string,
    shadowBlur: number
  ): void {
    if (pts.length < 2) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = shadowBlur;
    ctx.stroke();
    ctx.restore();
  }
}
