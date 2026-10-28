import { MAX_EXPOSURE } from './minigame.ts';
import type { Minigame, PhaseFactory, Run } from './minigame.ts';
import { text, wrap } from './draw.ts';

type Mode = 'title' | 'card' | 'playing' | 'result' | 'end';

/** How long the title card stays up before the phase starts on its own. */
const CARD_MS = 1800;
/** Taps during the first moments of a card or result are ignored, so a tap meant for the
 * game doesn't skip the screen that came up under the finger. */
const TAP_GUARD_MS = 350;
const HUD_H = 14;

/**
 * Everything around the phases: title, the card before each phase, the result after it,
 * and the exposure bar that runs across all of them. A lost phase is retried from the
 * exposure it was entered with, so a retry costs time rather than compounding.
 */
export class Shell {
  private readonly phases: PhaseFactory[];
  private readonly width: number;
  private readonly height: number;
  private mode: Mode = 'title';
  private run: Run = { exposure: 0 };
  private index = 0;
  private game: Minigame | null = null;
  private entryExposure = 0;
  private modeTime = 0;

  constructor(phases: PhaseFactory[], width: number, height: number) {
    this.phases = phases;
    this.width = width;
    this.height = height;
  }

  update(dtMs: number): void {
    this.modeTime += dtMs;
    if (this.mode === 'card' && this.modeTime >= CARD_MS) this.setMode('playing');
    if (this.mode === 'playing' && this.game) {
      this.game.update(dtMs);
      if (this.game.outcome()) this.setMode('result');
    }
  }

  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): void {
    if (this.mode === 'playing') {
      this.game?.pointer(kind, x, y - HUD_H);
      return;
    }
    if (kind !== 'down' || this.modeTime < TAP_GUARD_MS) return;

    switch (this.mode) {
      case 'title':
        this.run = { exposure: 0 };
        this.startPhase(0);
        break;
      case 'card':
        this.setMode('playing');
        break;
      case 'result':
        if (this.game?.outcome() === 'won') {
          if (this.index + 1 < this.phases.length) this.startPhase(this.index + 1);
          else this.setMode('end');
        } else {
          this.run.exposure = this.entryExposure;
          this.startPhase(this.index);
        }
        break;
      case 'end':
        this.setMode('title');
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.fillStyle = '#10202a';
    ctx.fillRect(0, 0, this.width, this.height);
    const cx = this.width / 2;

    switch (this.mode) {
      case 'title':
        text(ctx, 'OPERAÇÃO', cx, 130, 16, '#f2c14e');
        text(ctx, 'MIAMI', cx, 148, 16, '#f2c14e');
        text(ctx, 'Sátira política. Ficção.', cx, 176, 7, '#e8e8e8');
        text(ctx, 'Personagens são caricaturas.', cx, 186, 7, '#e8e8e8');
        if (this.blink()) text(ctx, 'toque para começar', cx, 240, 8, '#3fa34d');
        break;
      case 'card':
        text(ctx, `FASE ${this.index + 1}`, cx, 130, 8, '#e8e8e8');
        text(ctx, this.game?.title ?? '', cx, 150, 16, '#f2c14e');
        text(ctx, this.game?.hint ?? '', cx, 172, 8, '#3fa34d');
        break;
      case 'playing':
      case 'result':
        ctx.save();
        ctx.translate(0, HUD_H);
        this.game?.render(ctx, alpha);
        ctx.restore();
        this.drawHud(ctx);
        if (this.mode === 'result') this.drawResult(ctx);
        break;
      case 'end':
        text(ctx, 'FIM', cx, 110, 16, '#f2c14e');
        text(ctx, 'Chegou a Miami.', cx, 136, 8, '#e8e8e8');
        text(ctx, 'Dormiu no colchão inflável.', cx, 148, 7, '#e8e8e8');
        text(ctx, `Exposição final: ${Math.round(this.run.exposure)}%`, cx, 176, 8, '#e8e8e8');
        text(ctx, endVerdict(this.run.exposure), cx, 192, 7, '#3fa34d');
        if (this.blink()) text(ctx, 'toque para voltar', cx, 240, 8, '#3fa34d');
        break;
    }
  }

  private startPhase(i: number): void {
    this.index = i;
    this.entryExposure = this.run.exposure;
    this.game = this.phases[i](this.run);
    this.setMode('card');
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.modeTime = 0;
  }

  private blink(): boolean {
    return Math.floor(this.modeTime / 500) % 2 === 0;
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#10202a';
    ctx.fillRect(0, 0, this.width, HUD_H);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('MÍDIA', 4, HUD_H / 2);
    const x = 32;
    const w = this.width - x - 4;
    ctx.fillStyle = '#2a3a44';
    ctx.fillRect(x, 4, w, HUD_H - 8);
    ctx.fillStyle = this.run.exposure > 66 ? '#e85d75' : '#f2c14e';
    ctx.fillRect(x, 4, Math.round((w * this.run.exposure) / MAX_EXPOSURE), HUD_H - 8);
    ctx.textBaseline = 'alphabetic';
  }

  private drawResult(ctx: CanvasRenderingContext2D): void {
    const cx = this.width / 2;
    ctx.fillStyle = 'rgba(16, 32, 42, 0.85)';
    ctx.fillRect(0, 110, this.width, 100);
    if (this.game?.outcome() === 'won') {
      text(ctx, 'ESCAPOU!', cx, 150, 16, '#3fa34d');
      if (this.modeTime >= TAP_GUARD_MS) text(ctx, 'toque para seguir', cx, 185, 8, '#e8e8e8');
    } else {
      text(ctx, 'MANCHETE', cx, 136, 8, '#e85d75');
      wrap(ctx, this.game?.headline ?? '', cx, 156, 10, '#ffffff', this.width - 16);
      if (this.modeTime >= TAP_GUARD_MS) text(ctx, 'toque para tentar de novo', cx, 200, 7, '#e8e8e8');
    }
  }
}

/** One line on the end screen, by how much of the trip made the news. */
function endVerdict(exposure: number): string {
  if (exposure < 1) return 'Ninguém ficou sabendo.';
  if (exposure < 40) return 'Saiu uma notinha de rodapé.';
  if (exposure < 75) return 'Virou assunto no grupo da família.';
  return 'Foi parar em todos os jornais.';
}
