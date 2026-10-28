import { MAX_EXPOSURE } from '../minigame.ts';
import type { Minigame, Run } from '../minigame.ts';
import { drawSenator, text, wrap } from '../draw.ts';
import { rng } from '../random.ts';

interface Answer {
  text: string;
  /** What the officer says back. */
  reply: string;
  /** Exposure added. 0 is a clean answer. */
  cost: number;
  /** Ends the phase on the spot, with its own headline. */
  ending?: string;
}

interface Question {
  q: string;
  answers: Answer[];
}

/**
 * The officer asks in English; the joke is the senator's English. Every question has one
 * clean answer, and the rest either cost exposure or end the phase with their own headline.
 */
const QUESTIONS: Question[] = [
  {
    q: 'Purpose of your visit?',
    answers: [
      { text: 'Tourism.', reply: 'Uh-huh.', cost: 0 },
      { text: 'The book is on the table.', reply: '...Excuse me?', cost: 15 },
      {
        text: "I'm very famous in Brazil!",
        reply: 'Sir, step aside, please.',
        cost: 0,
        ending: 'SENADOR SE APRESENTA COMO FAMOSO E É MANDADO DE VOLTA',
      },
    ],
  },
  {
    q: 'How long will you stay?',
    answers: [
      { text: 'Two weeks.', reply: 'Okay.', cost: 0 },
      { text: 'Forever and ever!', reply: 'Forever, huh?', cost: 20 },
      { text: 'Depends on the news.', reply: 'The news.', cost: 15 },
    ],
  },
  {
    q: 'Where will you be staying?',
    answers: [
      { text: 'A hotel in Miami.', reply: 'Fine.', cost: 0 },
      { text: "My brother's guest room.", reply: 'Your brother lives here?', cost: 10 },
      {
        text: 'I dunno... Canada?',
        reply: 'Canada is that way, sir.',
        cost: 0,
        ending: 'SENADOR PEDE INFORMAÇÃO E VAI PARAR NO CANADÁ',
      },
    ],
  },
  {
    q: 'Anything to declare?',
    answers: [
      { text: 'No, nothing.', reply: 'Good.', cost: 0 },
      { text: 'Sorry, no English.', reply: "You've been doing fine.", cost: 15 },
      { text: 'I declare... my love for Miami!', reply: 'Sir.', cost: 20 },
    ],
  },
  {
    q: 'Do you have a return ticket?',
    answers: [
      { text: 'Yes, here it is.', reply: 'Thank you.', cost: 0 },
      { text: 'Return...?', reply: 'R-E-T-U-R-N.', cost: 20 },
      { text: 'Ticket to ride!', reply: 'Not a Beatles fan.', cost: 15 },
    ],
  },
];

/** Seconds the officer waits before asking again, impatiently. */
const PATIENCE_SEC = 6;
const TIMEOUT_COST = 15;
const REPLY_SEC = 1.3;
const STAMP_SEC = 1.2;
const BTN_X = 12;
const BTN_W = 156;
const BTN_H = 32;
const BTN_TOP = 176;
const BTN_GAP = 38;
const SEED = 0x1a1a;

export class Imigracao implements Minigame {
  readonly title = 'IMIGRAÇÃO';
  readonly hint = 'Responda em inglês!';

  private readonly run: Run;
  /** Answer order per question, shuffled once so the clean answer isn't always on top. */
  private readonly order: Answer[][];
  private question = 0;
  private patience = PATIENCE_SEC;
  private reply: { text: string; bad: boolean; left: number; advance: boolean } | null = null;
  private ending: string | null = null;
  private stampLeft = 0;
  private sweat = 0;
  private t = 0;
  private result: 'won' | 'lost' | null = null;

  constructor(run: Run) {
    this.run = run;
    const random = rng(SEED);
    this.order = QUESTIONS.map((q) => {
      const a = [...q.answers];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
  }

  get headline(): string {
    return this.ending ?? 'SENADOR BARRADO NA IMIGRAÇÃO POR CAUSA DO INGLÊS';
  }

  update(dtMs: number): void {
    if (this.result) return;
    const s = dtMs / 1000;
    this.t += s;
    this.sweat = Math.max(0, this.sweat - s);

    if (this.stampLeft > 0) {
      this.stampLeft -= s;
      if (this.stampLeft <= 0) this.result = 'won';
      return;
    }

    if (this.reply) {
      this.reply.left -= s;
      if (this.reply.left <= 0) {
        const advance = this.reply.advance;
        this.reply = null;
        if (this.ending) {
          this.result = 'lost';
        } else if (!advance) {
          this.patience = PATIENCE_SEC;
        } else if (this.question + 1 >= QUESTIONS.length) {
          this.stampLeft = STAMP_SEC;
        } else {
          this.question++;
          this.patience = PATIENCE_SEC;
        }
      }
      return;
    }

    this.patience -= s;
    if (this.patience <= 0) {
      this.sweat = 1;
      // Waiting doesn't skip the question: the reply plays, then the same question again.
      this.reply = { text: 'Sir? I asked you a question.', bad: true, left: REPLY_SEC, advance: false };
      this.expose(TIMEOUT_COST);
    }
  }

  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): void {
    if (kind !== 'down' || this.result || this.reply || this.stampLeft > 0) return;
    if (x < BTN_X || x > BTN_X + BTN_W) return;
    const i = Math.floor((y - BTN_TOP) / BTN_GAP);
    if (i < 0 || i >= 3 || y - BTN_TOP - i * BTN_GAP > BTN_H) return;

    const a = this.order[this.question][i];
    const bad = a.cost > 0 || a.ending !== undefined;
    this.reply = { text: a.reply, bad, left: REPLY_SEC, advance: true };
    if (bad) this.sweat = 1;
    if (a.ending) this.ending = a.ending;
    this.expose(a.cost);
  }

  outcome(): 'won' | 'lost' | null {
    return this.result;
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    ctx.fillStyle = '#cfd6dc';
    ctx.fillRect(0, 0, 180, 320);

    // Booth, officer behind the glass, senator on this side.
    ctx.fillStyle = '#2b4a63';
    ctx.fillRect(0, 20, 180, 8);
    text(ctx, 'U.S. CUSTOMS', 90, 27, 6, '#ffffff');
    ctx.fillStyle = '#9fb3c4';
    ctx.fillRect(100, 34, 70, 60);
    this.drawOfficer(ctx, 135, 70);
    ctx.fillStyle = '#5b6f82';
    ctx.fillRect(96, 92, 78, 8);

    drawSenator(ctx, 40, 140);
    if (this.sweat > 0) {
      ctx.fillStyle = '#7fc8f8';
      const drop = Math.round((1 - this.sweat) * 6);
      ctx.fillRect(45, 128 + drop, 2, 2);
      ctx.fillRect(34, 130 + drop, 2, 2);
    }

    // Officer's bubble: the question, or the reply to the last answer.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, 36, 84, 64);
    ctx.fillRect(94, 60, 6, 6);
    const current = this.question;
    if (this.stampLeft > 0) {
      wrap(ctx, 'Welcome to the United States.', 52, 56, 8, '#1c1c1c', 76);
    } else if (this.reply) {
      wrap(ctx, this.reply.text, 52, 56, 8, this.reply.bad ? '#c0392b' : '#1c1c1c', 76);
    } else {
      wrap(ctx, QUESTIONS[current].q, 52, 56, 8, '#1c1c1c', 76);
    }

    text(ctx, `PERGUNTA ${current + 1}/${QUESTIONS.length}`, 120, 120, 6, '#2b4a63');
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(70, 126, 100, 3);
    if (!this.reply && this.stampLeft <= 0) {
      ctx.fillStyle = this.patience < 2 ? '#e85d75' : '#2b4a63';
      ctx.fillRect(70, 126, Math.round((100 * this.patience) / PATIENCE_SEC), 3);
    }

    if (this.stampLeft > 0) {
      ctx.save();
      ctx.translate(90, 230);
      ctx.rotate(-0.2);
      ctx.strokeStyle = '#3fa34d';
      ctx.lineWidth = 2;
      ctx.strokeRect(-56, -16, 112, 32);
      ctx.restore();
      text(ctx, 'ADMITTED', 90, 236, 16, '#3fa34d');
      return;
    }

    const answers = this.order[current];
    answers.forEach((a, i) => {
      const y = BTN_TOP + i * BTN_GAP;
      ctx.fillStyle = this.reply ? '#8a96a1' : '#f4f1ea';
      ctx.fillRect(BTN_X, y, BTN_W, BTN_H);
      ctx.fillStyle = '#2b4a63';
      ctx.fillRect(BTN_X, y, 3, BTN_H);
      wrap(ctx, a.text, 90, y + 14, 8, '#1c1c1c', BTN_W - 16);
    });
  }

  private expose(amount: number): void {
    this.run.exposure = Math.min(MAX_EXPOSURE, this.run.exposure + amount);
    if (this.run.exposure >= MAX_EXPOSURE) {
      this.reply = null;
      this.result = 'lost';
    }
  }

  private drawOfficer(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#1d2b4f';
    ctx.fillRect(x - 10, y, 20, 22);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(x + 3, y + 4, 4, 4);
    ctx.fillStyle = '#c68e5c';
    ctx.fillRect(x - 6, y - 14, 12, 14);
    ctx.fillStyle = '#1d2b4f';
    ctx.fillRect(x - 8, y - 18, 16, 5);
    ctx.fillStyle = '#222';
    // Eyes narrow while the senator sweats.
    const eye = this.sweat > 0 ? 1 : 2;
    ctx.fillRect(x - 4, y - 9, 2, eye);
    ctx.fillRect(x + 2, y - 9, 2, eye);
    ctx.fillRect(x - 3, y - 3, 6, 1);
    // A slow blink, so he reads as waiting rather than frozen.
    if (Math.floor(this.t * 10) % 40 === 0) {
      ctx.fillStyle = '#c68e5c';
      ctx.fillRect(x - 4, y - 9, 8, 2);
    }
  }
}
