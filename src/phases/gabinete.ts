import { MAX_EXPOSURE } from '../minigame.ts';
import type { Minigame, Run } from '../minigame.ts';

interface Point {
  x: number;
  y: number;
}

interface Reporter {
  x: number;
  y: number;
  dir: 1 | -1;
  /** Patrol speed, virtual px/s. */
  speed: number;
  /** Offset into the sweep, so two reporters never look the same way at the same time. */
  phase: number;
}

/** Pillars and boxes along the corridor. The first one is where the player starts. */
const SPOTS: Point[] = [
  { x: 90, y: 296 },
  { x: 30, y: 262 },
  { x: 150, y: 262 },
  { x: 90, y: 236 },
  { x: 25, y: 204 },
  { x: 155, y: 204 },
  { x: 90, y: 166 },
  { x: 30, y: 128 },
  { x: 150, y: 128 },
  { x: 90, y: 100 },
  { x: 35, y: 64 },
  { x: 145, y: 64 },
];
const EXIT: Point = { x: 90, y: 32 };

const WALK_SPEED = 55;
const TAP_RADIUS = 16;
/** Longest single move. Without it the exit is one tap from the start and the corridor is a straight sprint. */
const MAX_HOP = 80;
const CONE_RANGE = 78;
const CONE_HALF = 0.42;
const SWEEP = 0.95;
const SWEEP_RATE = 1.3;
/** Exposure per second spent inside a cone, out of hiding. Full bar in ~0.8s from empty. */
const EXPOSURE_PER_SEC = 120;
const PATROL_MIN = 18;
const PATROL_MAX = 162;

export class Gabinete implements Minigame {
  readonly title = 'GABINETE';
  readonly hint = 'Saia sem ser visto!';
  readonly headline = 'SENADOR VISTO SAINDO PELOS FUNDOS';

  private readonly run: Run;
  private player: Point = { ...SPOTS[0] };
  private target: Point | null = null;
  private reporters: Reporter[] = [
    { x: 40, y: 182, dir: 1, speed: 26, phase: 0 },
    { x: 140, y: 84, dir: -1, speed: 34, phase: 2.1 },
  ];
  private t = 0;
  private seen = false;
  private result: 'won' | 'lost' | null = null;

  constructor(run: Run) {
    this.run = run;
  }

  update(dtMs: number): void {
    if (this.result) return;
    const s = dtMs / 1000;
    this.t += s;

    for (const r of this.reporters) {
      r.x += r.dir * r.speed * s;
      if (r.x < PATROL_MIN || r.x > PATROL_MAX) {
        r.x = Math.min(PATROL_MAX, Math.max(PATROL_MIN, r.x));
        r.dir = r.dir === 1 ? -1 : 1;
      }
    }

    if (this.target) {
      const dx = this.target.x - this.player.x;
      const dy = this.target.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      const step = WALK_SPEED * s;
      if (dist <= step) {
        this.player = { ...this.target };
        if (this.target === EXIT) this.result = 'won';
        this.target = null;
      } else {
        this.player.x += (dx / dist) * step;
        this.player.y += (dy / dist) * step;
      }
    }

    this.seen = !this.hidden() && this.reporters.some((r) => this.inCone(r, this.player));
    if (this.seen) {
      this.run.exposure = Math.min(MAX_EXPOSURE, this.run.exposure + EXPOSURE_PER_SEC * s);
      if (this.run.exposure >= MAX_EXPOSURE) this.result = 'lost';
    }
  }

  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): void {
    if (kind !== 'down' || this.result) return;
    const candidates = [...SPOTS, EXIT];
    let best: Point | null = null;
    let bestDist = TAP_RADIUS;
    for (const p of candidates) {
      if (Math.hypot(p.x - this.player.x, p.y - this.player.y) > MAX_HOP) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    if (best) this.target = best;
  }

  outcome(): 'won' | 'lost' | null {
    return this.result;
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    // Floor, and the green Senate carpet down the middle.
    ctx.fillStyle = '#d9cfb8';
    ctx.fillRect(0, 0, 180, 320);
    ctx.fillStyle = '#2f6b3a';
    ctx.fillRect(70, 20, 40, 300);

    // Exit.
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(EXIT.x - 12, EXIT.y - 14, 24, 22);
    ctx.fillStyle = '#3fa34d';
    ctx.fillRect(EXIT.x - 10, EXIT.y - 22, 20, 6);
    ctx.fillStyle = '#ffffff';
    ctx.font = '5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SAÍDA', EXIT.x, EXIT.y - 17);

    for (const r of this.reporters) this.drawCone(ctx, r);

    for (const p of SPOTS) {
      ctx.fillStyle = '#8a8478';
      ctx.fillRect(p.x - 7, p.y - 7, 14, 14);
      ctx.fillStyle = '#b5ae9f';
      ctx.fillRect(p.x - 7, p.y - 7, 14, 4);
    }

    // What a tap can reach from here, so the hop limit reads as a rule and not a dead tap.
    if (!this.target) {
      ctx.strokeStyle = '#f2c14e';
      for (const p of [...SPOTS, EXIT]) {
        const d = Math.hypot(p.x - this.player.x, p.y - this.player.y);
        if (d > 0 && d <= MAX_HOP) ctx.strokeRect(p.x - 8.5, p.y - 8.5, 17, 17);
      }
    }

    this.drawPlayer(ctx);
    for (const r of this.reporters) this.drawReporter(ctx, r);

    if (this.target) {
      ctx.strokeStyle = '#f2c14e';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y);
      ctx.lineTo(this.target.x, this.target.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private hidden(): boolean {
    return this.target === null && SPOTS.some((p) => p.x === this.player.x && p.y === this.player.y);
  }

  private facing(r: Reporter): number {
    return Math.PI / 2 + Math.sin(this.t * SWEEP_RATE + r.phase) * SWEEP;
  }

  private inCone(r: Reporter, p: Point): boolean {
    const dx = p.x - r.x;
    const dy = p.y - r.y;
    if (Math.hypot(dx, dy) > CONE_RANGE) return false;
    let diff = Math.atan2(dy, dx) - this.facing(r);
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return Math.abs(diff) < CONE_HALF;
  }

  private drawCone(ctx: CanvasRenderingContext2D, r: Reporter): void {
    const a = this.facing(r);
    ctx.fillStyle = this.seen && this.inCone(r, this.player) ? 'rgba(232, 93, 117, 0.45)' : 'rgba(255, 236, 140, 0.4)';
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.arc(r.x, r.y, CONE_RANGE, a - CONE_HALF, a + CONE_HALF);
    ctx.closePath();
    ctx.fill();
  }

  private drawReporter(ctx: CanvasRenderingContext2D, r: Reporter): void {
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(r.x - 4, r.y - 4, 8, 9);
    ctx.fillStyle = '#e0b48a';
    ctx.fillRect(r.x - 3, r.y - 9, 6, 5);
    // Microphone, pointing where the reporter is looking.
    const a = this.facing(r);
    ctx.fillStyle = '#222';
    ctx.fillRect(Math.round(r.x + Math.cos(a) * 6) - 1, Math.round(r.y + Math.sin(a) * 6) - 1, 3, 3);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this.player;
    ctx.globalAlpha = this.hidden() ? 0.55 : 1;
    ctx.fillStyle = '#1d2b4f';
    ctx.fillRect(x - 4, y - 4, 8, 10);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(x - 1, y - 3, 2, 5);
    ctx.fillStyle = '#e0b48a';
    ctx.fillRect(x - 3, y - 10, 6, 6);
    ctx.fillStyle = '#3b2a1e';
    ctx.fillRect(x - 3, y - 11, 6, 2);
    ctx.globalAlpha = 1;
  }
}
