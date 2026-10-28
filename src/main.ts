import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { GameLoop } from './game-loop.ts';
import { Shell } from './shell.ts';
import { Gabinete } from './phases/gabinete.ts';
import { Orla } from './phases/orla.ts';

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

/** Where the world lands on the display, device pixels. Shared by render and input. */
const view = { scale: 1, offsetX: 0, offsetY: 0, dpr: 1 };

function fit(): void {
  view.dpr = window.devicePixelRatio || 1;
  display.width = Math.floor(window.innerWidth * view.dpr);
  display.height = Math.floor(window.innerHeight * view.dpr);
  ctx.imageSmoothingEnabled = false;
  // Fractional only when the window is smaller than the virtual screen itself.
  const fitScale = Math.min(display.width / VIRTUAL_W, display.height / VIRTUAL_H);
  view.scale = fitScale >= 1 ? Math.floor(fitScale) : fitScale;
  view.offsetX = Math.floor((display.width - VIRTUAL_W * view.scale) / 2);
  view.offsetY = Math.floor((display.height - VIRTUAL_H * view.scale) / 2);
}
window.addEventListener('resize', fit);
fit();

const shell = new Shell([(run) => new Gabinete(run), (run) => new Orla(run)], VIRTUAL_W, VIRTUAL_H);

function onPointer(kind: 'down' | 'move' | 'up') {
  return (e: PointerEvent): void => {
    const x = (e.clientX * view.dpr - view.offsetX) / view.scale;
    const y = (e.clientY * view.dpr - view.offsetY) / view.scale;
    shell.pointer(kind, x, y);
  };
}
display.addEventListener('pointerdown', onPointer('down'));
display.addEventListener('pointermove', onPointer('move'));
display.addEventListener('pointerup', onPointer('up'));

function render(alpha: number): void {
  shell.render(wctx, alpha);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, display.width, display.height);
  ctx.drawImage(world, view.offsetX, view.offsetY, VIRTUAL_W * view.scale, VIRTUAL_H * view.scale);
}

registerSW({ immediate: true });
new GameLoop((dt) => shell.update(dt), render).start();
