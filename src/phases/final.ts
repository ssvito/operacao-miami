import { MAX_EXPOSURE } from '../minigame.ts';
import type { Minigame, Run } from '../minigame.ts';
import { drawSenator, text } from '../draw.ts';
import { rng } from '../random.ts';

const WINDOW = { x: 30, y: 22, w: 100, h: 62 };
/** Swipe travel that counts as one pump stroke, and the travel back up that re-arms it. */
const STROKE_DOWN = 24;
const STROKE_UP = 12;
const PER_STROKE = 5;
const LEAK_PER_SEC = 4;
const MATTRESS_FULL = 100;

/** The brother opens the curtain to admire the view, every few seconds. */
const BROTHER_GAP_MIN = 3.5;
const BROTHER_GAP_MAX = 5.5;
const PAP_GAP_MIN = 2.5;
const PAP_GAP_MAX = 4;
const PAP_WARN_SEC = 0.9;
const PAP_FLASH_SEC = 2;
const FLASHED_PER_SEC = 35;
const SEED = 0x3a31;

export class Final implements Minigame {
  readonly title = 'MIAMI';
  readonly hint = 'Encha o colchão!';
  readonly headline = 'SENADOR FOTOGRAFADO DORMINDO NO SOFÁ DO IRMÃO';

  private readonly run: Run;
  private readonly random = rng(SEED);
  private air = 0;
  private blindsOpen = true;
  private nextBrother = BROTHER_GAP_MIN;
  /** Seconds the brother's "que vista!" stays on screen after he opens the curtain. */
  private brotherSays = 0;
  private papWarn = 0;
  private papFlash = 0;
  private nextPap = 1.5;
  private pumping = false;
  private anchorY = 0;
  private armed = true;
  private strokeAnim = 0;
  private t = 0;
  private result: 'won' | 'lost' | null = null;

  constructor(run: Run) {
    this.run = run;
  }

  update(dtMs: number): void {
    if (this.result) return;
    const s = dtMs / 1000;
    this.t += s;
    this.air = Math.max(0, this.air - LEAK_PER_SEC * s);
    this.strokeAnim = Math.max(0, this.strokeAnim - s * 4);
    this.brotherSays = Math.max(0, this.brotherSays - s);

    this.nextBrother -= s;
    if (this.nextBrother <= 0) {
      if (!this.blindsOpen) this.brotherSays = 1.2;
      this.blindsOpen = true;
      this.nextBrother = this.gap(BROTHER_GAP_MIN, BROTHER_GAP_MAX);
    }

    if (this.papWarn > 0) {
      this.papWarn -= s;
      if (this.papWarn <= 0) this.papFlash = PAP_FLASH_SEC;
    } else if (this.papFlash > 0) {
      this.papFlash -= s;
      if (this.blindsOpen) this.expose(FLASHED_PER_SEC * s);
    } else {
      this.nextPap -= s;
      if (this.nextPap <= 0) {
        this.papWarn = PAP_WARN_SEC;
        this.nextPap = this.gap(PAP_GAP_MIN, PAP_GAP_MAX);
      }
    }
  }

  /**
   * Tapping the window closes the curtain. Anywhere else, a finger dragged down and back up
   * works the pump: each downward run of STROKE_DOWN px is a stroke, and it has to come back
   * up STROKE_UP px before the next one counts, so holding still or sliding once does nothing.
   */
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): void {
    if (this.result) return;
    if (kind === 'down') {
      if (x >= WINDOW.x && x <= WINDOW.x + WINDOW.w && y >= WINDOW.y && y <= WINDOW.y + WINDOW.h) {
        this.blindsOpen = false;
        return;
      }
      this.pumping = true;
      this.anchorY = y;
      this.armed = true;
      return;
    }
    if (kind === 'up') {
      this.pumping = false;
      return;
    }
    if (!this.pumping) return;
    if (this.armed) {
      this.anchorY = Math.min(this.anchorY, y);
      if (y - this.anchorY >= STROKE_DOWN) {
        this.stroke();
        this.armed = false;
        this.anchorY = y;
      }
    } else {
      this.anchorY = Math.max(this.anchorY, y);
      if (this.anchorY - y >= STROKE_UP) {
        this.armed = true;
        this.anchorY = y;
      }
    }
  }

  outcome(): 'won' | 'lost' | null {
    return this.result;
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    ctx.fillStyle = '#e8d9c4';
    ctx.fillRect(0, 0, 180, 320);
    ctx.fillStyle = '#b89b72';
    ctx.fillRect(0, 160, 180, 160);

    this.drawWindow(ctx);
    this.drawGuestRoom(ctx);

    // Mattress, rising with the air in it.
    const h = 4 + Math.round((this.air / MATTRESS_FULL) * 22);
    ctx.fillStyle = '#2b7bb9';
    ctx.fillRect(70, 262 - h, 96, h);
    ctx.fillStyle = '#5fa3d6';
    ctx.fillRect(70, 262 - h, 96, 3);
    ctx.fillStyle = '#2b4a63';
    ctx.fillRect(70, 270, 96, 4);
    ctx.fillStyle = '#3fa34d';
    ctx.fillRect(70, 270, Math.round((96 * this.air) / MATTRESS_FULL), 4);
    if (this.air > 0) text(ctx, 'fsss', 170, 250 - h, 5, '#5b6f82');

    // Pump, handle down on each stroke, and the senator working it.
    const handle = Math.round(this.strokeAnim * 8);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(28, 236, 12, 26);
    ctx.fillStyle = '#555';
    ctx.fillRect(33, 222 + handle, 2, 14);
    ctx.fillRect(26, 220 + handle, 16, 3);
    ctx.fillRect(40, 256, 30, 2);
    drawSenator(ctx, 50, 232 + Math.round(handle / 2));

    text(ctx, 'deslize para bombear', 90, 292, 7, '#5b4632');
    text(ctx, 'toque na janela: cortina', 90, 302, 6, '#5b4632');

    if (this.papFlash > 0 && this.blindsOpen && Math.floor(this.t * 8) % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(0, 0, 180, 320);
    }
  }

  private stroke(): void {
    this.strokeAnim = 1;
    this.air = Math.min(MATTRESS_FULL, this.air + PER_STROKE);
    if (this.air >= MATTRESS_FULL && this.result === null) this.result = 'won';
  }

  private gap(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  private expose(amount: number): void {
    this.run.exposure = Math.min(MAX_EXPOSURE, this.run.exposure + amount);
    if (this.run.exposure >= MAX_EXPOSURE) this.result = 'lost';
  }

  private drawWindow(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = WINDOW;
    // Miami at night: sky, skyline lights, a palm.
    ctx.fillStyle = '#1b1f4a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#e8743b';
    ctx.fillRect(x, y + h - 14, w, 14);
    ctx.fillStyle = '#2a2d5c';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 4 + i * 16, y + h - 30 - (i % 3) * 6, 10, 30 + (i % 3) * 6);
    ctx.fillStyle = '#f2d43c';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 7 + i * 16, y + h - 24 - (i % 3) * 6, 2, 2);
    ctx.fillStyle = '#16302a';
    ctx.fillRect(x + 82, y + 24, 2, h - 24);
    ctx.fillRect(x + 75, y + 22, 16, 3);

    if (this.papWarn > 0 || this.papFlash > 0) {
      // Silhouette with a long lens, popping up from the bottom of the window.
      const rise = this.papWarn > 0 ? Math.round((1 - this.papWarn / PAP_WARN_SEC) * 14) : 14;
      ctx.fillStyle = '#0c0c0c';
      ctx.fillRect(x + 30, y + h - rise, 14, rise);
      ctx.fillRect(x + 32, y + h - rise - 8, 10, 8);
      if (this.papFlash > 0) {
        ctx.fillRect(x + 44, y + h - rise + 2, 10, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 52, y + h - rise + 2, 3, 4);
      }
    }

    if (!this.blindsOpen) {
      ctx.fillStyle = '#d6c7a8';
      for (let i = 0; i < h; i += 6) ctx.fillRect(x, y + i, w, 5);
    }
    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    ctx.lineWidth = 1;
  }

  private drawGuestRoom(ctx: CanvasRenderingContext2D): void {
    // The guest room door, taken. The brother leans in the frame in a floral shirt.
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(132, 96, 40, 66);
    ctx.fillStyle = '#3b2a1e';
    ctx.fillRect(136, 100, 32, 62);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(130, 104, 44, 14);
    text(ctx, 'HÓSPEDES', 152, 110, 5, '#1c1c1c');
    text(ctx, 'OCUPADO', 152, 116, 5, '#c0392b');

    const bx = 152;
    const by = 146;
    ctx.fillStyle = '#e8743b';
    ctx.fillRect(bx - 4, by - 4, 8, 10);
    ctx.fillStyle = '#f2d43c';
    ctx.fillRect(bx - 3, by - 2, 2, 2);
    ctx.fillRect(bx + 1, by + 2, 2, 2);
    ctx.fillStyle = '#e0b48a';
    ctx.fillRect(bx - 3, by - 10, 6, 6);
    ctx.fillStyle = '#3b2a1e';
    ctx.fillRect(bx - 3, by - 11, 6, 2);

    if (this.brotherSays > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(104, 128, 40, 12);
      text(ctx, 'que vista!', 124, 136, 6, '#1c1c1c');
    }
  }
}
