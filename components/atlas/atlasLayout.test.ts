/** Unit tests for the atlas layout math: hover-card positioning (the
 * container-pixel fix that stopped the tooltip drifting from the cursor)
 * and golden-angle spiral stacking of co-located hybrid incidents.
 *
 * Runs on the built-in Node test runner — no test framework dependency:
 *
 *   node --test components/atlas/*.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  GOLDEN_ANGLE,
  HOVER_EDGE,
  HOVER_GUTTER,
  hoverCardPosition,
  spiralOffset,
} from "./atlasLayout.ts";

const magnitude = (o: { dx: number; dy: number }) => Math.hypot(o.dx, o.dy);

/* ── spiral stacking (hybrid markers) ─────────────────────────────── */

test("spiral: the first marker at a point stays exactly on the anchor", () => {
  assert.deepEqual(spiralOffset(0, 1), { dx: 0, dy: 0 });
  assert.deepEqual(spiralOffset(0, 12), { dx: 0, dy: 0 });
  // Defensive: negative indices are treated as the anchor, never as a
  // backwards spiral that could overlap a neighbouring cluster.
  assert.deepEqual(spiralOffset(-3, 2), { dx: 0, dy: 0 });
});

test("spiral: stacked markers spread outward and never collide", () => {
  const offsets = Array.from({ length: 13 }, (_, n) => spiralOffset(n, 1));

  // Radius follows the sqrt growth law exactly.
  for (let n = 1; n <= 12; n++) {
    assert.ok(
      Math.abs(magnitude(offsets[n]) - (3 + 2.4 * Math.sqrt(n))) < 1e-9,
      `radius at n=${n} should be 3 + 2.4*sqrt(n)`,
    );
  }

  // Every stacked marker is distinct from every other (no overlap).
  for (let i = 1; i <= 12; i++) {
    for (let j = i + 1; j <= 12; j++) {
      assert.notDeepEqual(offsets[i], offsets[j], `n=${i} vs n=${j}`);
      assert.ok(magnitude({ dx: offsets[i].dx - offsets[j].dx, dy: offsets[i].dy - offsets[j].dy }) > 0.5,
        `markers ${i} and ${j} should stay >0.5 units apart`);
    }
  }

  // The cluster stays tight: within ~12 viewBox units at zoom 1, so the
  // stack reads as one pin rather than scattering across the map.
  for (let n = 1; n <= 12; n++) {
    assert.ok(magnitude(offsets[n]) < 12, `n=${n} inside cluster radius`);
  }
});

test("spiral: the golden angle (not 90°) is what de-aligns the stack", () => {
  // Regression guard: with a right-angle step, consecutive markers would
  // alternate between only 4 directions. The golden angle keeps the first
  // three markers on clearly distinct bearings.
  const bearings = [1, 2, 3].map((n) =>
    Math.atan2(spiralOffset(n, 1).dy, spiralOffset(n, 1).dx),
  );
  assert.ok(Math.abs(GOLDEN_ANGLE - Math.PI * (3 - Math.sqrt(5))) < 1e-12);
  for (let i = 0; i < bearings.length; i++) {
    for (let j = i + 1; j < bearings.length; j++) {
      const delta = Math.abs(bearings[i] - bearings[j]);
      assert.ok(delta > 0.5, `bearings ${i} and ${j} should differ`);
    }
  }
});

test("spiral: zoom divides offsets so screen spacing is constant", () => {
  // The layer draws inside the zoomed <g>; offsets must shrink by 1/zoom
  // so a cluster looks the same on screen at zoom 1 and zoom 12.
  for (let n = 1; n <= 8; n++) {
    const base = spiralOffset(n, 1);
    for (const zoom of [1, 2, 4.5, 12]) {
      const scaled = spiralOffset(n, zoom);
      assert.ok(Math.abs(scaled.dx * zoom - base.dx) < 1e-9, `n=${n} zoom=${zoom} dx`);
      assert.ok(Math.abs(scaled.dy * zoom - base.dy) < 1e-9, `n=${n} zoom=${zoom} dy`);
    }
  }
});

/* ── hover-card positioning (container-px tooltip fix) ─────────────── */

test("hover: card follows the cursor with a gutter", () => {
  // Mid-container, no clamping: the card sits exactly GUTTER px from the
  // cursor, in container CSS pixels.
  const { left, top } = hoverCardPosition(400, 200, 960, 500, 268, 176);
  assert.equal(left, 400 + HOVER_GUTTER);
  assert.equal(top, 200 + HOVER_GUTTER);
});

test("hover: positions are container px regardless of rendered width", () => {
  // Regression: when the overlay was positioned in SVG viewBox units, a
  // container rendered narrower than the 960-unit viewBox put the card in
  // the wrong place (it drifted from the cursor). The math must depend
  // only on the container's CSS px, never on the viewBox width.
  const narrow = hoverCardPosition(100, 50, 640, 360, 268, 176);
  assert.equal(narrow.left, 100 + HOVER_GUTTER);
  assert.equal(narrow.top, 50 + HOVER_GUTTER);
  const wide = hoverCardPosition(100, 50, 1440, 810, 268, 176);
  assert.equal(wide.left, 100 + HOVER_GUTTER);
  assert.equal(wide.top, 50 + HOVER_GUTTER);
});

test("hover: card clamps inside the container at every edge", () => {
  const cw = 640;
  const ch = 360;
  const cardW = 268;
  const cardH = 176;
  const maxLeft = Math.max(HOVER_EDGE, cw - cardW);
  const maxTop = Math.max(HOVER_EDGE, ch - cardH);

  // Cursor swept across and beyond the container, in both axes.
  for (const x of [-50, 0, 4, 120, 400, 639, 640, 9999]) {
    for (const y of [-50, 0, 4, 90, 250, 359, 360, 9999]) {
      const { left, top } = hoverCardPosition(x, y, cw, ch, cardW, cardH);
      assert.ok(left >= HOVER_EDGE, `left ${left} >= edge at (${x},${y})`);
      assert.ok(top >= HOVER_EDGE, `top ${top} >= edge at (${x},${y})`);
      assert.ok(left <= maxLeft, `left ${left} <= ${maxLeft} at (${x},${y})`);
      assert.ok(top <= maxTop, `top ${top} <= ${maxTop} at (${x},${y})`);
    }
  }

  // Explicit edge cases: the gutter still applies at the container's
  // origin, the card parks in its allowed box at the far corner, and a
  // cursor that has left the container pins to the edge instead of going
  // negative (which would render the card outside the map entirely).
  assert.deepEqual(hoverCardPosition(0, 0, cw, ch, cardW, cardH), {
    left: HOVER_GUTTER,
    top: HOVER_GUTTER,
  });
  assert.deepEqual(hoverCardPosition(cw, ch, cw, ch, cardW, cardH), {
    left: cw - cardW,
    top: ch - cardH,
  });
  assert.deepEqual(hoverCardPosition(-100, -100, cw, ch, cardW, cardH), {
    left: HOVER_EDGE,
    top: HOVER_EDGE,
  });
});

test("hover: never goes off-screen when the container is smaller than the card", () => {
  // Pinned to the (4, 4) edge rather than flipping to a negative offset
  // that would render the card outside the map entirely.
  const { left, top } = hoverCardPosition(50, 50, 200, 100, 268, 176);
  assert.equal(left, HOVER_EDGE);
  assert.equal(top, HOVER_EDGE);
});
