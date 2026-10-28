/**
 * One phase of the run. Each phase is its own minigame with its own rules, so the shell
 * only knows this contract: start it, tick it, draw it, feed it input, and ask whether it
 * is over. Everything a phase needs beyond that stays inside the phase.
 */
export interface Minigame {
  /** Shown on the title card before the phase starts. */
  readonly title: string;
  /** One-line instruction under the title card, WarioWare style ("Fuja!", "Disfarce!"). */
  readonly hint: string;

  update(dtMs: number): void;
  /** Draws into the world canvas at virtual resolution. */
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
  /** Pointer position already converted to virtual coordinates. */
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): void;

  /** `null` while the phase is running. */
  outcome(): 'won' | 'lost' | null;
}
