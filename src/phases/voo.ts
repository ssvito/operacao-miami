import { MAX_EXPOSURE } from '../minigame.ts';
import type { Minigame, Run } from '../minigame.ts';
import { drawSenator, text } from '../draw.ts';
import { rng } from '../random.ts';

interface Seat {
  col: number;
  row: number;
}

interface Point {
  x: number;
  y: number;
}

interface Filmer {
  seat: Seat;
  /** Seconds left with the phone out but not recording yet, then recording. */
  warn: number;
  rec: number;
}

const COLS = [30, 54, 126, 150];
const AISLE_X = 90;
const ROWS = 8;
const ROW_TOP = 48;
const ROW_GAP = 32;
const SEAT_W = 20;
const SEAT_H = 22;
/** Seats left empty, besides the player's own. */
const EMPTY_SEATS = 7;
const PLAYER_START: Seat = { col: 1, row: 5 };

/** Flight length in seconds. Landing wins. */
const FLIGHT_SEC = 28;
const WALK_SPEED = 55;
/** A selfie video looks backward: these many rows behind the filmer, on their side. */
const FILM_DEPTH = 2;
const WARN_SEC = 1.1;
const REC_SEC = 3.5;
const FILM_GAP_START = 3.2;
const FILM_GAP_END = 1.8;
const MAX_FILMERS_START = 1;
const MAX_FILMERS_END = 3;
const FILMED_PER_SEC = 30;
const TAP_RADIUS = 14;
const SEED = 0xf117;

export class Voo implements Minigame {
  readonly title = 'VOO';
  readonly hint = 'Arraste para trocar de assento!';
  readonly headline = 'SENADOR TROCA DE ASSENTO 9 VEZES NUM SÓ VOO';

  private readonly run: Run;
  private readonly random = rng(SEED);
  private passengers: (string | null)[][] = [];
  private seat: Seat | null = { ...PLAYER_START };
  private pos: Point = seatPoint(PLAYER_START);
  private path: Point[] = [];
  private destination: Seat | null = null;
  private aim: Seat | null = null;
  private dragging = false;
  private filmers: Filmer[] = [];
  private nextFilm = 1.2;
  private elapsed = 0;
  private filmed = false;
  private result: 'won' | 'lost' | null = null;

  constructor(run: Run) {
    this.run = run;
    const shirts = ['#c0392b', '#2b7bb9', '#8e44ad', '#e8743b', '#16a085', '#7f8c8d', '#d35400'];
    for (let r = 0; r < ROWS; r++) {
      this.passengers.push(COLS.map(() => shirts[Math.floor(this.random() * shirts.length)]));
    }
    this.passengers[PLAYER_START.row][PLAYER_START.col] = null;
    let empties = 0;
    while (empties < EMPTY_SEATS) {
      const r = Math.floor(this.random() * ROWS);
      const c = Math.floor(this.random() * COLS.length);
      if (this.passengers[r][c] !== null) {
        this.passengers[r][c] = null;
        empties++;
      }
    }
  }

  update(dtMs: number): void {
    if (this.result) return;
    const s = dtMs / 1000;
    this.elapsed += s;
    const progress = Math.min(1, this.elapsed / FLIGHT_SEC);

    this.nextFilm -= s;
    const maxFilmers = Math.round(MAX_FILMERS_START + (MAX_FILMERS_END - MAX_FILMERS_START) * progress);
    if (this.nextFilm <= 0) {
      if (this.filmers.length < maxFilmers) this.startFilmer();
      this.nextFilm = FILM_GAP_START + (FILM_GAP_END - FILM_GAP_START) * progress;
    }
    for (const f of this.filmers) {
      if (f.warn > 0) {
        f.warn -= s;
        if (f.warn <= 0) f.rec = REC_SEC;
      } else {
        f.rec -= s;
      }
    }
    this.filmers = this.filmers.filter((f) => f.warn > 0 || f.rec > 0);

    this.walk(s);

    this.filmed = this.filmers.some((f) => f.warn <= 0 && inZone(f.seat, this.pos));
    if (this.filmed) {
      this.run.exposure = Math.min(MAX_EXPOSURE, this.run.exposure + FILMED_PER_SEC * s);
      if (this.run.exposure >= MAX_EXPOSURE) this.result = 'lost';
    }

    if (this.result === null && this.elapsed >= FLIGHT_SEC) this.result = 'won';
  }

  /**
   * Down starts aiming, move follows the finger, up commits to the seat under it. A plain
   * tap is a down and an up on the same seat, so tapping works as well as dragging.
   */
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): void {
    if (this.result) return;
    if (kind === 'down') this.dragging = true;
    if (!this.dragging) return;
    if (kind === 'up') {
      const target = this.emptySeatAt(x, y);
      this.dragging = false;
      this.aim = null;
      if (target) this.goTo(target);
    } else {
      this.aim = this.emptySeatAt(x, y);
    }
  }

  outcome(): 'won' | 'lost' | null {
    return this.result;
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    // Fuselage, aisle carpet, and the route along the top.
    ctx.fillStyle = '#1c2a36';
    ctx.fillRect(0, 0, 180, 320);
    ctx.fillStyle = '#e9e4da';
    ctx.fillRect(12, 30, 156, 276);
    ctx.fillStyle = '#5b6f82';
    ctx.fillRect(AISLE_X - 12, 30, 24, 276);

    const progress = Math.min(1, this.elapsed / FLIGHT_SEC);
    text(ctx, 'GIG', 14, 13, 6, '#e8e8e8');
    text(ctx, 'MIA', 166, 13, 6, '#e8e8e8');
    ctx.fillStyle = '#4a5a68';
    ctx.fillRect(26, 10, 128, 1);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(26 + Math.round(128 * progress) - 2, 8, 5, 5);

    for (const f of this.filmers) {
      const side = f.seat.col < 2 ? [12, AISLE_X + 12] : [AISLE_X - 12, 168];
      const top = rowY(f.seat.row) + ROW_GAP / 2;
      const bottom = Math.min(306, rowY(f.seat.row + FILM_DEPTH) + ROW_GAP / 2);
      if (bottom <= top) continue;
      if (f.warn > 0) {
        ctx.strokeStyle = '#e85d75';
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(side[0] + 0.5, top + 0.5, side[1] - side[0] - 1, bottom - top - 1);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(232, 93, 117, 0.3)';
        ctx.fillRect(side[0], top, side[1] - side[0], bottom - top);
      }
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS.length; c++) {
        const { x, y } = seatPoint({ col: c, row: r });
        const aimed = this.aim && this.aim.col === c && this.aim.row === r;
        ctx.fillStyle = aimed ? '#f2c14e' : '#2b4a63';
        ctx.fillRect(x - SEAT_W / 2, y - SEAT_H / 2 + 4, SEAT_W, SEAT_H - 4);
        const shirt = this.passengers[r][c];
        if (shirt) {
          ctx.fillStyle = shirt;
          ctx.fillRect(x - 4, y - 3, 8, 9);
          ctx.fillStyle = '#3b2a1e';
          ctx.fillRect(x - 3, y - 9, 6, 6);
        }
      }
    }

    for (const f of this.filmers) {
      const { x, y } = seatPoint(f.seat);
      // Phone held up and back over the shoulder.
      ctx.fillStyle = '#222';
      ctx.fillRect(x + 4, y - 12, 4, 6);
      if (f.warn <= 0) {
        ctx.fillStyle = '#e85d75';
        ctx.fillRect(x + 5, y - 11, 2, 2);
        text(ctx, 'REC', x, y - 14, 5, '#e85d75');
      } else {
        text(ctx, '?', x, y - 14, 7, '#e85d75');
      }
    }

    if (this.destination) {
      const d = seatPoint(this.destination);
      ctx.strokeStyle = '#f2c14e';
      ctx.strokeRect(d.x - SEAT_W / 2 - 0.5, d.y - SEAT_H / 2 + 3.5, SEAT_W + 1, SEAT_H - 2);
    }
    drawSenator(ctx, Math.round(this.pos.x), Math.round(this.pos.y));
    if (this.filmed) text(ctx, '!', Math.round(this.pos.x) + 7, Math.round(this.pos.y) - 10, 8, '#e85d75');
  }

  private startFilmer(): void {
    const candidates: Seat[] = [];
    for (let r = 0; r < ROWS - 1; r++) {
      for (let c = 0; c < COLS.length; c++) {
        if (this.passengers[r][c] && !this.filmers.some((f) => f.seat.row === r && f.seat.col === c)) candidates.push({ col: c, row: r });
      }
    }
    if (candidates.length === 0) return;
    const seat = candidates[Math.floor(this.random() * candidates.length)];
    this.filmers.push({ seat, warn: WARN_SEC, rec: 0 });
  }

  private emptySeatAt(x: number, y: number): Seat | null {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS.length; c++) {
        const p = seatPoint({ col: c, row: r });
        if (Math.abs(p.x - x) < TAP_RADIUS && Math.abs(p.y - y) < TAP_RADIUS && this.isFree({ col: c, row: r })) return { col: c, row: r };
      }
    }
    return null;
  }

  private isFree(seat: Seat): boolean {
    if (this.passengers[seat.row][seat.col]) return false;
    if (this.seat && this.seat.col === seat.col && this.seat.row === seat.row) return false;
    return true;
  }

  /** Out into the aisle, along it, and back in. Changing course mid-walk starts from where the player stands. */
  private goTo(target: Seat): void {
    const to = seatPoint(target);
    this.path = [];
    if (this.pos.x !== AISLE_X) this.path.push({ x: AISLE_X, y: this.pos.y });
    this.path.push({ x: AISLE_X, y: to.y }, to);
    this.seat = null;
    this.destination = target;
  }

  private walk(s: number): void {
    let budget = WALK_SPEED * s;
    while (budget > 0 && this.path.length > 0) {
      const next = this.path[0];
      const dx = next.x - this.pos.x;
      const dy = next.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= budget) {
        this.pos = { ...next };
        this.path.shift();
        budget -= dist;
      } else {
        this.pos.x += (dx / dist) * budget;
        this.pos.y += (dy / dist) * budget;
        budget = 0;
      }
    }
    if (this.path.length === 0 && this.destination) {
      this.seat = this.destination;
      this.destination = null;
    }
  }
}

function rowY(row: number): number {
  return ROW_TOP + row * ROW_GAP;
}

function seatPoint(seat: Seat): Point {
  return { x: COLS[seat.col], y: rowY(seat.row) };
}

/** The filmed area: the rows behind the filmer, on their side, aisle included. */
function inZone(filmer: Seat, p: Point): boolean {
  const left = filmer.col < 2;
  const onSide = left ? p.x <= AISLE_X + 12 : p.x >= AISLE_X - 12;
  const top = rowY(filmer.row) + ROW_GAP / 2;
  const bottom = rowY(filmer.row + FILM_DEPTH) + ROW_GAP / 2;
  return onSide && p.y > top && p.y < bottom;
}
