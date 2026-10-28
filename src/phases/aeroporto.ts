import { MAX_EXPOSURE } from '../minigame.ts';
import type { Minigame, Run } from '../minigame.ts';
import { drawSenator, text, wrap } from '../draw.ts';
import { rng } from '../random.ts';

type Stage = 'fila' | 'raiox' | 'form';

const STAGES: Stage[] = ['fila', 'raiox', 'form'];
const STAGE_INFO: Record<Stage, { name: string; hint: string }> = {
  fila: { name: 'FILA', hint: 'Segure para se esconder' },
  raiox: { name: 'RAIO-X', hint: 'Tire o que apita' },
  form: { name: 'FORMULÁRIO', hint: 'Responda rápido' },
};
/** How long each stage's banner stays up. Input is ignored under it. */
const BANNER_MS = 1100;
const SEED = 0xa1b2;

// --- Fila -------------------------------------------------------------------------------

const QUEUE_SIZE = 5;
const SLOT_TOP = 92;
const SLOT_GAP = 30;
/** Time spent not hiding for the front passenger to be served. */
const SERVE_SEC = 0.9;
const LOOK_WARN_SEC = 0.6;
const LOOK_SEC = 0.9;
const LOOK_GAP_MIN = 1.2;
/** The first look comes early, so the rule is taught before the line is half gone. */
const FIRST_LOOK = 0.8;
const LOOK_GAP_MAX = 2.2;
const SEEN_PER_SEC = 60;

interface Passenger {
  /** Displayed slot, eased toward the real one so the line shuffles rather than jumps. */
  y: number;
  /** Seconds left in the "?" warning, then in the look itself. */
  warn: number;
  look: number;
  shirt: string;
}

// --- Raio-X -----------------------------------------------------------------------------

interface ItemDef {
  name: string;
  metal: boolean;
  color: string;
}

const ITEMS: ItemDef[] = [
  { name: 'TRAVESSEIRO', metal: false, color: '#e8e8e8' },
  { name: 'FERRO DE PASSAR', metal: true, color: '#9aa3ad' },
  { name: 'CHINELO', metal: false, color: '#3fa34d' },
  { name: 'RAPADURA', metal: false, color: '#b5762f' },
  { name: 'PANELA', metal: true, color: '#9aa3ad' },
  { name: 'BONÉ', metal: false, color: '#2b7bb9' },
  { name: 'HALTERES', metal: true, color: '#9aa3ad' },
  { name: 'PROTETOR SOLAR', metal: false, color: '#f2d43c' },
  { name: 'MARTELO', metal: true, color: '#9aa3ad' },
  { name: 'PANDEIRO', metal: false, color: '#c0392b' },
];
const BELT_TOP = 30;
const SCANNER_Y = 250;
const BELT_SPEED = 55;
const ITEM_EVERY_SEC = 0.75;
const TAP_RADIUS = 16;
const BEEP = 15;
/** Pulling a harmless item off the belt is its own kind of suspicious. */
const WRONG_PULL = 5;

interface Item {
  def: ItemDef;
  y: number;
  pulled: boolean;
  scanned: boolean;
}

// --- Formulário -------------------------------------------------------------------------

/** `answer` is what a traveller with nothing to hide ticks. The phrasing is the game. */
const QUESTIONS: { q: string; answer: boolean }[] = [
  { q: 'Leva mais de 10 mil dólares em espécie?', answer: false },
  { q: 'Pretende voltar ao Brasil?', answer: true },
  { q: 'Sua viagem NÃO é a turismo?', answer: false },
  { q: 'Deixou de declarar algum bem?', answer: false },
  { q: 'Confirma que NÃO vai morar lá?', answer: true },
];
const ANSWER_SEC = 4.5;
const WRONG_ANSWER = 12;
const FEEDBACK_SEC = 0.5;
const BTN_Y = 214;
const BTN_H = 36;

export class Aeroporto implements Minigame {
  readonly title = 'AEROPORTO';
  readonly hint = 'Passe pelo embarque!';
  readonly headline = 'SENADOR RECONHECIDO NA FILA DO RAIO-X';

  private readonly run: Run;
  private readonly random = rng(SEED);
  private stage = 0;
  private bannerMs = BANNER_MS;
  private t = 0;
  private result: 'won' | 'lost' | null = null;

  private holding = false;
  private queue: Passenger[] = [];
  private playerY = 0;
  private serve = 0;
  private nextLook = 0;

  private items: Item[] = [];
  private spawned = 0;
  private spawnTimer = 0;
  private beepMs = 0;

  private question = 0;
  private answerTimer = ANSWER_SEC;
  private feedback: { ok: boolean; left: number } | null = null;

  constructor(run: Run) {
    this.run = run;
    const shirts = ['#c0392b', '#2b7bb9', '#8e44ad', '#e8743b', '#16a085'];
    for (let i = 0; i < QUEUE_SIZE; i++) this.queue.push({ y: slotY(i), warn: 0, look: 0, shirt: shirts[i] });
    this.playerY = slotY(QUEUE_SIZE);
    this.nextLook = FIRST_LOOK;
  }

  update(dtMs: number): void {
    if (this.result) return;
    const s = dtMs / 1000;
    this.t += s;
    if (this.bannerMs > 0) {
      this.bannerMs = Math.max(0, this.bannerMs - dtMs);
      return;
    }
    switch (STAGES[this.stage]) {
      case 'fila':
        this.updateFila(s);
        break;
      case 'raiox':
        this.updateRaiox(s, dtMs);
        break;
      case 'form':
        this.updateForm(s);
        break;
    }
  }

  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): void {
    if (kind === 'down') this.holding = true;
    if (kind === 'up') this.holding = false;
    if (kind !== 'down' || this.result || this.bannerMs > 0) return;

    const stage = STAGES[this.stage];
    if (stage === 'raiox') {
      const hit = this.items.find((it) => !it.pulled && !it.scanned && Math.abs(it.y - y) < TAP_RADIUS && Math.abs(x - 90) < 34);
      if (hit) {
        hit.pulled = true;
        if (!hit.def.metal) this.expose(WRONG_PULL);
      }
    } else if (stage === 'form' && !this.feedback && y >= BTN_Y && y <= BTN_Y + BTN_H) {
      if (x >= 16 && x < 86) this.answer(true);
      else if (x > 94 && x <= 164) this.answer(false);
    }
  }

  outcome(): 'won' | 'lost' | null {
    return this.result;
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    ctx.fillStyle = '#cfd6dc';
    ctx.fillRect(0, 0, 180, 320);
    switch (STAGES[this.stage]) {
      case 'fila':
        this.renderFila(ctx);
        break;
      case 'raiox':
        this.renderRaiox(ctx);
        break;
      case 'form':
        this.renderForm(ctx);
        break;
    }
    if (this.bannerMs > 0) {
      const info = STAGE_INFO[STAGES[this.stage]];
      ctx.fillStyle = 'rgba(16, 32, 42, 0.85)';
      ctx.fillRect(0, 120, 180, 56);
      text(ctx, info.name, 90, 146, 14, '#f2c14e');
      text(ctx, info.hint, 90, 164, 8, '#e8e8e8');
    }
  }

  // --- stage plumbing ---

  private nextStage(): void {
    this.stage++;
    this.holding = false;
    if (this.stage >= STAGES.length) this.result = 'won';
    else this.bannerMs = BANNER_MS;
  }

  private expose(amount: number): void {
    this.run.exposure = Math.min(MAX_EXPOSURE, this.run.exposure + amount);
    if (this.run.exposure >= MAX_EXPOSURE) this.result = 'lost';
  }

  private lookGap(): number {
    return LOOK_GAP_MIN + this.random() * (LOOK_GAP_MAX - LOOK_GAP_MIN);
  }

  // --- Fila ---

  private updateFila(s: number): void {
    this.nextLook -= s;
    if (this.nextLook <= 0 && this.queue.length > 0) {
      // Not the one at the counter: they'd be served mid-look and the look would vanish.
      const idle = this.queue.slice(1).filter((p) => p.warn <= 0 && p.look <= 0);
      if (idle.length > 0) idle[Math.floor(this.random() * idle.length)].warn = LOOK_WARN_SEC;
      this.nextLook = this.lookGap();
    }
    for (const p of this.queue) {
      if (p.warn > 0) {
        p.warn -= s;
        if (p.warn <= 0) p.look = LOOK_SEC;
      } else if (p.look > 0) {
        p.look -= s;
      }
    }

    if (this.queue.some((p) => p.look > 0) && !this.holding) this.expose(SEEN_PER_SEC * s);

    if (!this.holding && this.queue.length > 0) {
      this.serve += s / SERVE_SEC;
      if (this.serve >= 1) {
        this.serve = 0;
        this.queue.shift();
      }
    }

    this.queue.forEach((p, i) => (p.y = ease(p.y, slotY(i), s)));
    this.playerY = ease(this.playerY, slotY(this.queue.length), s);
    if (this.queue.length === 0 && Math.abs(this.playerY - slotY(0)) < 1) this.nextStage();
  }

  private renderFila(ctx: CanvasRenderingContext2D): void {
    // Check-in counter at the top, the line running down toward the player.
    ctx.fillStyle = '#2b4a63';
    ctx.fillRect(30, 40, 120, 26);
    text(ctx, 'CHECK-IN', 90, 57, 8, '#ffffff');
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(60, 80, 1, 200);
    ctx.fillRect(120, 80, 1, 200);

    for (const p of this.queue) {
      const y = Math.round(p.y);
      ctx.fillStyle = p.shirt;
      ctx.fillRect(86, y - 4, 8, 10);
      // Facing away shows hair; turned around shows a face.
      ctx.fillStyle = p.look > 0 ? '#e0b48a' : '#3b2a1e';
      ctx.fillRect(87, y - 10, 6, 6);
      if (p.look > 0) {
        ctx.fillStyle = '#222';
        ctx.fillRect(88, y - 8, 1, 1);
        ctx.fillRect(91, y - 8, 1, 1);
      }
      if (p.warn > 0) text(ctx, '?', 100, y - 8, 8, '#e85d75');
    }

    const py = Math.round(this.playerY);
    drawSenator(ctx, 90, py);
    if (this.holding) {
      // Newspaper up over the face.
      ctx.fillStyle = '#f4f1ea';
      ctx.fillRect(83, py - 13, 14, 10);
      ctx.fillStyle = '#555';
      ctx.fillRect(85, py - 11, 10, 1);
      ctx.fillRect(85, py - 8, 7, 1);
      ctx.fillRect(85, py - 6, 9, 1);
    }
    if (this.queue.length > 0 && !this.holding) {
      ctx.fillStyle = '#3fa34d';
      ctx.fillRect(40, 300, Math.round(100 * this.serve), 3);
    }
    if (this.bannerMs === 0) text(ctx, this.holding ? 'escondido' : 'segure a tela', 90, 292, 7, '#2b4a63');
  }

  // --- Raio-X ---

  private updateRaiox(s: number, dtMs: number): void {
    this.beepMs = Math.max(0, this.beepMs - dtMs);
    this.spawnTimer -= s;
    if (this.spawned < ITEMS.length && this.spawnTimer <= 0) {
      this.items.push({ def: ITEMS[this.spawned], y: BELT_TOP - 10, pulled: false, scanned: false });
      this.spawned++;
      this.spawnTimer = ITEM_EVERY_SEC;
    }
    for (const it of this.items) {
      if (it.pulled || it.scanned) continue;
      it.y += BELT_SPEED * s;
      if (it.y >= SCANNER_Y) {
        it.scanned = true;
        if (it.def.metal) {
          this.beepMs = 400;
          this.expose(BEEP);
        }
      }
    }
    if (this.spawned === ITEMS.length && this.items.every((it) => it.pulled || it.scanned)) this.nextStage();
  }

  private renderRaiox(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(56, BELT_TOP - 20, 68, SCANNER_Y - BELT_TOP + 20);
    ctx.fillStyle = '#4a4a4a';
    for (let y = BELT_TOP - 20 + ((this.t * BELT_SPEED) % 12); y < SCANNER_Y; y += 12) ctx.fillRect(56, Math.round(y), 68, 1);
    ctx.fillStyle = this.beepMs > 0 ? '#e85d75' : '#2b4a63';
    ctx.fillRect(48, SCANNER_Y, 84, 30);
    text(ctx, this.beepMs > 0 ? 'BIP!' : 'RAIO-X', 90, SCANNER_Y + 19, 9, '#ffffff');

    for (const it of this.items) {
      if (it.pulled || it.scanned) continue;
      const y = Math.round(it.y);
      ctx.fillStyle = it.def.color;
      ctx.fillRect(78, y - 6, 24, 10);
      if (it.def.metal) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(80, y - 5, 6, 1);
      }
      text(ctx, it.def.name, 90, y + 11, 5, '#ffffff');
    }

    // Tray of what was pulled off, down the right side.
    const pulled = this.items.filter((it) => it.pulled);
    text(ctx, 'BANDEJA', 152, 20, 5, '#2b4a63');
    pulled.forEach((it, i) => {
      ctx.fillStyle = it.def.color;
      ctx.fillRect(140, 28 + i * 14, 24, 8);
    });
  }

  // --- Formulário ---

  private updateForm(s: number): void {
    if (this.feedback) {
      this.feedback.left -= s;
      if (this.feedback.left <= 0) {
        this.feedback = null;
        this.question++;
        this.answerTimer = ANSWER_SEC;
        if (this.question >= QUESTIONS.length) this.nextStage();
      }
      return;
    }
    this.answerTimer -= s;
    if (this.answerTimer <= 0) {
      this.expose(WRONG_ANSWER);
      this.feedback = { ok: false, left: FEEDBACK_SEC };
    }
  }

  private answer(yes: boolean): void {
    const ok = yes === QUESTIONS[this.question].answer;
    if (!ok) this.expose(WRONG_ANSWER);
    this.feedback = { ok, left: FEEDBACK_SEC };
  }

  private renderForm(ctx: CanvasRenderingContext2D): void {
    const q = QUESTIONS[Math.min(this.question, QUESTIONS.length - 1)];
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(12, 40, 156, 240);
    ctx.fillStyle = '#2b4a63';
    ctx.fillRect(12, 40, 156, 16);
    text(ctx, `DECLARAÇÃO ${this.question + 1}/${QUESTIONS.length}`, 90, 51, 7, '#ffffff');
    wrap(ctx, q.q, 90, 100, 9, '#1c1c1c', 140);

    ctx.fillStyle = '#d0c8b8';
    ctx.fillRect(24, 190, 132, 4);
    ctx.fillStyle = this.answerTimer < 1.5 ? '#e85d75' : '#2b4a63';
    ctx.fillRect(24, 190, Math.round((132 * Math.max(0, this.answerTimer)) / ANSWER_SEC), 4);

    ctx.fillStyle = '#3fa34d';
    ctx.fillRect(16, BTN_Y, 70, BTN_H);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(94, BTN_Y, 70, BTN_H);
    text(ctx, 'SIM', 51, BTN_Y + 23, 12, '#ffffff');
    text(ctx, 'NÃO', 129, BTN_Y + 23, 12, '#ffffff');

    if (this.feedback) text(ctx, this.feedback.ok ? 'carimbado' : 'a atendente te encara...', 90, 272, 7, this.feedback.ok ? '#3fa34d' : '#c0392b');
  }
}

function slotY(slot: number): number {
  return SLOT_TOP + slot * SLOT_GAP;
}

/** Moves `from` toward `to` at a fixed walking pace. */
function ease(from: number, to: number, s: number): number {
  const step = 60 * s;
  return Math.abs(to - from) <= step ? to : from + Math.sign(to - from) * step;
}
