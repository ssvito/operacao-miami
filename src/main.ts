import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { GameLoop } from './game-loop.ts';

/**
 * Virtual resolution, portrait 9:16. The world is drawn here, then integer-scaled to the
 * window; on a landscape desktop it simply letterboxes.
 */
const VIRTUAL_W = 180;
const VIRTUAL_H = 320;

const display = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = display.getContext('2d')!;
const world = document.createElement('canvas');
world.width = VIRTUAL_W;
world.height = VIRTUAL_H;
const wctx = world.getContext('2d')!;

function fit(): void {
  const dpr = window.devicePixelRatio || 1;
  display.width = Math.floor(window.innerWidth * dpr);
  display.height = Math.floor(window.innerHeight * dpr);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', fit);
fit();

let t = 0;

function update(dtMs: number): void {
  t += dtMs;
}

function render(): void {
  wctx.fillStyle = '#10202a';
  wctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
  wctx.fillStyle = '#f2c14e';
  wctx.font = '16px monospace';
  wctx.textAlign = 'center';
  wctx.fillText('OPERAÇÃO', VIRTUAL_W / 2, 140);
  wctx.fillText('MIAMI', VIRTUAL_W / 2, 158);
  if (Math.floor(t / 500) % 2 === 0) {
    wctx.font = '8px monospace';
    wctx.fillStyle = '#e8e8e8';
    wctx.fillText('em construção', VIRTUAL_W / 2, 180);
  }

  const scale = Math.max(1, Math.floor(Math.min(display.width / VIRTUAL_W, display.height / VIRTUAL_H)));
  const w = VIRTUAL_W * scale;
  const h = VIRTUAL_H * scale;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, display.width, display.height);
  ctx.drawImage(world, Math.floor((display.width - w) / 2), Math.floor((display.height - h) / 2), w, h);
}

registerSW({ immediate: true });
new GameLoop(update, render).start();
