/**
 * Path computation between two cells.
 *
 * Step 2 uses a Chebyshev (king-move) straight-line: each step picks the
 * direction that reduces both axes simultaneously when possible. This
 * matches the "tap-to-destination" UX where the player picks a tile within
 * Stride and the engine resolves the cells in order.
 *
 * Returns the ordered cells from `from` to `to`, INCLUSIVE of `to` and
 * EXCLUSIVE of `from`. Empty if from == to.
 */

import type { Cell } from "../core/types.js";

export function chebyshevPath(from: Cell, to: Cell): Cell[] {
  if (from.x === to.x && from.y === to.y) return [];
  const path: Cell[] = [];
  let x = from.x;
  let y = from.y;
  while (x !== to.x || y !== to.y) {
    if (x < to.x) x++;
    else if (x > to.x) x--;
    if (y < to.y) y++;
    else if (y > to.y) y--;
    path.push({ x, y });
  }
  return path;
}
