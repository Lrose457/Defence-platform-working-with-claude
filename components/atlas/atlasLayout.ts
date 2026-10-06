/** Pure layout math for the atlas hover overlay and hybrid marker stacking.
 *
 * Deliberately free of React/DOM so it runs under the built-in Node test
 * runner with no extra dependencies:
 *
 *   node --test components/atlas/*.test.ts
 */

/** ~137.5° — the golden angle, in radians. Spreads stacked markers
 * without visible alignment. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Offset for the n-th marker stacked on the same projected point.
 *
 * n === 0 stays exactly on the anchor; n > 0 spirals outward at the golden
 * angle with radius (3 + 2.4·√n), so the cluster stays small but every
 * marker remains individually hoverable. The radius is divided by the
 * current zoom because the layer draws inside the zoomed <g> — this keeps
 * screen spacing constant at every zoom level.
 */
export function spiralOffset(
  n: number,
  zoom: number,
): { dx: number; dy: number } {
  if (n <= 0) return { dx: 0, dy: 0 };
  const angle = n * GOLDEN_ANGLE;
  const radius = (3 + 2.4 * Math.sqrt(n)) / zoom;
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
}

/** Gutter between the cursor and the hover card, in container CSS px. */
export const HOVER_GUTTER = 12;
/** Minimum distance from the container's top/left edge, in container CSS px. */
export const HOVER_EDGE = 4;

/**
 * Position of the shared hover card, in container CSS pixels.
 *
 * The card follows the cursor with a small gutter, then clamps so it never
 * leaves the container — including when the container is smaller than the
 * card (it pins to the top-left edge rather than going negative).
 *
 * All inputs are CSS px: client coordinates relative to the container's
 * bounding rect. They must NOT be SVG viewBox units — positioning the HTML
 * overlay in viewBox units made the panel drift from the cursor whenever
 * the rendered width differed from the 960-unit viewBox.
 *
 * `cardW` is the horizontal footprint to reserve (card width plus the
 * cursor gutter); `cardH` is the card's estimated height — cards are plain
 * flow content, so the caller passes a per-kind estimate.
 */
export function hoverCardPosition(
  x: number,
  y: number,
  cw: number,
  ch: number,
  cardW: number,
  cardH: number,
): { left: number; top: number } {
  return {
    left: Math.max(HOVER_EDGE, Math.min(x + HOVER_GUTTER, cw - cardW)),
    top: Math.max(HOVER_EDGE, Math.min(y + HOVER_GUTTER, ch - cardH)),
  };
}
