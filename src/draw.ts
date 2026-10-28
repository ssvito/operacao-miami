/** The senator, centered on (x, y) at the waist. Shared so every phase draws the same man. */
export function drawSenator(ctx: CanvasRenderingContext2D, x: number, y: number, alpha = 1): void {
  ctx.globalAlpha = alpha;
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

/** Centered single-line text. */
export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.font = `${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(s, x, y);
}

/** Centered text broken on spaces to fit `maxWidth`. */
export function wrap(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, maxWidth: number): void {
  ctx.font = `${size}px monospace`;
  const lines: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => text(ctx, l, x, y + i * (size + 2), size, color));
}
