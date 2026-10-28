import { MAX_EXPOSURE } from '../minigame.ts';
import type { Minigame, Run } from '../minigame.ts';
import { drawSenator } from '../draw.ts';

type Kind = 'ambulante' | 'ciclista' | 'fa';

interface Obstacle {
  kind: Kind;
  lane: number;
  x: number;
  /** Screen y, virtual px. */
  y: number;
  /** A fan steps into the player's lane once, when the player gets close. */
  stepped: boolean;
}

const LANES = [56, 90, 124];
const PLAYER_Y = 250;
/** Run length in world px. At the speed curve below that is ~30s. */
const GOAL = 2600;
const SPEED_START = 70;
const SPEED_END = 105;
const LANE_SPEED = 260;
/** Cyclists come down the walkway against the player, faster than the scroll. */
const CYCLIST_EXTRA = 55;
/** How close (screen px above the player) a fan has to be before stepping in. */
const FAN_TRIGGER = 80;
const FAN_STEP_SPEED = 90;
const HIT: Record<Kind, number> = { ambulante: 15, ciclista: 20, fa: 25 };
const INVULN_MS = 900;
const HIT_BOX = 9;
/** Distance between obstacle rows, world px. Shrinks as the run goes on. */
const ROW_GAP_START = 95;
const ROW_GAP_END = 62;
/** The sound truck turns the lane beside the avenue into a spotlight while it passes. */
const TRUCK_EVERY = 750;
const TRUCK_RELATIVE = 0.55;
const TRUCK_REACH = 42;
const LOUD_PER_SEC = 45;
/** Fixed seed: the same run every time, so it can be learned and simulated. */
const SEED = 0x5eed;

/** Tiny seeded PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Orla implements Minigame {
  readonly title = 'ORLA';
  readonly hint = 'Corra até o aeroporto!';
  readonly headline = 'SENADOR FLAGRADO CORRENDO DE TERNO NA ORLA';

  private readonly run: Run;
  private readonly random = rng(SEED);
  private lane = 1;
  private x = LANES[1];
  private distance = 0;
  private nextRowAt = 120;
  private nextTruckAt = 400;
  private truckY: number | null = null;
  private obstacles: Obstacle[] = [];
  private invulnMs = 0;
  private flashMs = 0;
  private loud = false;
  private t = 0;
  private result: 'won' | 'lost' | null = null;

  constructor(run: Run) {
    this.run = run;
  }

  update(dtMs: number): void {
    if (this.result) return;
    const s = dtMs / 1000;
    this.t += s;
    const progress = Math.min(1, this.distance / GOAL);
    const speed = SPEED_START + (SPEED_END - SPEED_START) * progress;
    this.distance += speed * s;
    this.invulnMs = Math.max(0, this.invulnMs - dtMs);
    this.flashMs = Math.max(0, this.flashMs - dtMs);

    const tx = LANES[this.lane];
    const step = LANE_SPEED * s;
    this.x = Math.abs(tx - this.x) <= step ? tx : this.x + Math.sign(tx - this.x) * step;

    if (this.distance >= this.nextRowAt && this.distance < GOAL - 150) {
      this.spawnRow(progress);
      this.nextRowAt += ROW_GAP_START + (ROW_GAP_END - ROW_GAP_START) * progress;
    }

    for (const o of this.obstacles) {
      o.y += (speed + (o.kind === 'ciclista' ? CYCLIST_EXTRA : 0)) * s;
      if (o.kind === 'fa') {
        if (!o.stepped && PLAYER_Y - o.y < FAN_TRIGGER && o.lane !== this.lane) {
          o.lane += Math.sign(this.lane - o.lane);
          o.stepped = true;
        }
        const fx = LANES[o.lane];
        const fstep = FAN_STEP_SPEED * s;
        o.x = Math.abs(fx - o.x) <= fstep ? fx : o.x + Math.sign(fx - o.x) * fstep;
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.y < 340);

    if (this.invulnMs === 0) {
      const hit = this.obstacles.find((o) => Math.abs(o.x - this.x) < HIT_BOX && Math.abs(o.y - PLAYER_Y) < HIT_BOX);
      if (hit) {
        this.expose(HIT[hit.kind]);
        this.invulnMs = INVULN_MS;
        if (hit.kind === 'fa') this.flashMs = 120;
      }
    }

    if (this.truckY === null && this.distance >= this.nextTruckAt && this.distance < GOAL - 300) {
      this.truckY = -40;
      this.nextTruckAt += TRUCK_EVERY;
    }
    if (this.truckY !== null) {
      this.truckY += speed * TRUCK_RELATIVE * s;
      if (this.truckY > 360) this.truckY = null;
    }
    this.loud = this.truckY !== null && Math.abs(this.truckY - PLAYER_Y) < TRUCK_REACH;
    if (this.loud && this.lane === 2) this.expose(LOUD_PER_SEC * s);

    if (this.result === null && this.distance >= GOAL) this.result = 'won';
  }

  pointer(kind: 'down' | 'move' | 'up', x: number, _y: number): void {
    if (kind !== 'down' || this.result) return;
    this.lane = Math.max(0, Math.min(2, this.lane + (x < 90 ? -1 : 1)));
  }

  outcome(): 'won' | 'lost' | null {
    return this.result;
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    // Sea and sand on the left, avenue on the right, the wave-pattern walkway between.
    ctx.fillStyle = '#2b7bb9';
    ctx.fillRect(0, 0, 12, 320);
    ctx.fillStyle = '#e9d8a6';
    ctx.fillRect(12, 0, 24, 320);
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(36, 0, 108, 320);
    ctx.fillStyle = '#1c1c1c';
    for (let y = 0; y < 320; y++) {
      const wave = Math.round(5 * Math.sin((y - this.distance) / 13));
      for (let k = 0; k < 6; k++) ctx.fillRect(40 + k * 18 + wave, y, 7, 1);
    }
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(144, 0, 36, 320);
    ctx.fillStyle = '#d8d8d8';
    const dash = Math.floor(this.distance) % 24;
    for (let y = -24 + dash; y < 320; y += 24) ctx.fillRect(161, y, 2, 12);

    if (this.loud) {
      ctx.fillStyle = 'rgba(232, 93, 117, 0.25)';
      ctx.fillRect(LANES[2] - 14, 0, 28, 320);
    }
    if (this.truckY !== null) this.drawTruck(ctx, this.truckY);

    for (const o of this.obstacles) this.drawObstacle(ctx, o);

    const blink = this.invulnMs > 0 && Math.floor(this.invulnMs / 90) % 2 === 0;
    drawSenator(ctx, Math.round(this.x), PLAYER_Y, blink ? 0.3 : 1);

    const remaining = Math.max(0, Math.ceil((GOAL - this.distance) / 2));
    ctx.fillStyle = 'rgba(16, 32, 42, 0.75)';
    ctx.fillRect(0, 0, 180, 12);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`AEROPORTO: ${remaining}m`, 90, 8);

    if (this.flashMs > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(0, 0, 180, 320);
    }
  }

  private expose(amount: number): void {
    this.run.exposure = Math.min(MAX_EXPOSURE, this.run.exposure + amount);
    if (this.run.exposure >= MAX_EXPOSURE) this.result = 'lost';
  }

  /** One or two obstacles, never three: there is always a lane out of every row. */
  private spawnRow(progress: number): void {
    const count = this.random() < 0.3 + progress * 0.45 ? 2 : 1;
    const lanes = [0, 1, 2];
    for (let i = 0; i < count; i++) {
      const lane = lanes.splice(Math.floor(this.random() * lanes.length), 1)[0];
      const r = this.random();
      const kind: Kind = r < 0.45 ? 'ambulante' : r < 0.7 ? 'ciclista' : 'fa';
      this.obstacles.push({ kind, lane, x: LANES[lane], y: -16, stepped: false });
    }
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle): void {
    const x = Math.round(o.x);
    const y = Math.round(o.y);
    switch (o.kind) {
      case 'ambulante':
        // Beach umbrella over a styrofoam cooler.
        ctx.fillStyle = '#e8743b';
        ctx.fillRect(x - 8, y - 10, 16, 4);
        ctx.fillStyle = '#6b4226';
        ctx.fillRect(x, y - 6, 1, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 6, y, 12, 7);
        ctx.fillStyle = '#2b7bb9';
        ctx.fillRect(x - 6, y + 2, 12, 2);
        break;
      case 'ciclista':
        ctx.fillStyle = '#222';
        ctx.fillRect(x - 2, y - 8, 4, 4);
        ctx.fillRect(x - 2, y + 5, 4, 4);
        ctx.fillStyle = '#3fa34d';
        ctx.fillRect(x - 3, y - 4, 6, 8);
        ctx.fillStyle = '#e0b48a';
        ctx.fillRect(x - 2, y - 2, 4, 4);
        break;
      case 'fa':
        ctx.fillStyle = '#f2d43c';
        ctx.fillRect(x - 4, y - 4, 8, 9);
        ctx.fillStyle = '#c68e5c';
        ctx.fillRect(x - 3, y - 10, 6, 6);
        // Phone up, ready for the selfie.
        ctx.fillStyle = '#222';
        ctx.fillRect(x + 4, y - 9, 3, 5);
        if (!o.stepped && PLAYER_Y - o.y < FAN_TRIGGER + 30) {
          ctx.fillStyle = '#e85d75';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', x, y - 13);
        }
        break;
    }
  }

  private drawTruck(ctx: CanvasRenderingContext2D, y: number): void {
    const x = 162;
    ctx.fillStyle = '#d6d6d6';
    ctx.fillRect(x - 9, y - 18, 18, 36);
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(x - 7, y - 16, 14, 6);
    ctx.fillRect(x - 6, y - 2, 4, 4);
    ctx.fillRect(x + 2, y - 2, 4, 4);
    // Notes drifting out toward the walkway.
    ctx.fillStyle = '#e85d75';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    const bob = Math.round(Math.sin(this.t * 6) * 2);
    ctx.fillText('♪', x - 16, y - 4 + bob);
    ctx.fillText('♫', x - 24, y + 8 - bob);
  }
}
