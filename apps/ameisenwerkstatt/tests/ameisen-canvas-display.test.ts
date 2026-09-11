import { describe, expect, it } from "vitest";
import {
  CANVAS_MIN_CSS_HEIGHT,
  resolveCanvasDisplaySize,
} from "@/lib/ameisen/canvas-display";

/** Pre-STE-42 resize: layout height = max(measured, 420), next measure = bitmap height. */
function naiveIntrinsicLoop(startHeight: number, dpr: number, steps: number): number[] {
  const heights: number[] = [];
  let measured = startHeight;
  for (let i = 0; i < steps; i++) {
    const cssHeight = Math.max(measured, CANVAS_MIN_CSS_HEIGHT);
    const bitmapHeight = Math.round(cssHeight * dpr);
    heights.push(bitmapHeight);
    // Without CSS height%, browser uses bitmap intrinsic size as the next layout box.
    measured = bitmapHeight;
  }
  return heights;
}

describe("resolveCanvasDisplaySize (STE-42)", () => {
  it("reproduces unbounded growth under the pre-fix intrinsic feedback model", () => {
    const heights = naiveIntrinsicLoop(150, 2, 6);
    // 420 → 840 → 1680 → 3360 → 6720 → 13440
    expect(heights[0]).toBe(840);
    expect(heights[heights.length - 1]).toBeGreaterThan(10_000);
    expect(heights.every((h, i) => i === 0 || h > heights[i - 1]!)).toBe(true);
  });

  it("stays bounded when measured height tracks the previous bitmap (CSS missing)", () => {
    const dpr = 2;
    let prevCssWidth = 0;
    let prevCssHeight = 0;
    let measuredWidth = 300;
    let measuredHeight = 150;
    const cssHeights: number[] = [];

    for (let i = 0; i < 8; i++) {
      const next = resolveCanvasDisplaySize({
        measuredWidth,
        measuredHeight,
        devicePixelRatio: dpr,
        prevCssWidth,
        prevCssHeight,
      });
      cssHeights.push(next.cssHeight);
      prevCssWidth = next.cssWidth;
      prevCssHeight = next.cssHeight;
      // Simulate intrinsic fallback: next layout box equals the bitmap we just wrote.
      measuredWidth = next.bitmapWidth;
      measuredHeight = next.bitmapHeight;
    }

    expect(cssHeights[0]).toBe(CANVAS_MIN_CSS_HEIGHT);
    expect(Math.max(...cssHeights)).toBe(CANVAS_MIN_CSS_HEIGHT);
    expect(new Set(cssHeights).size).toBe(1);
  });

  it("still allows real parent growth (window / grid resize)", () => {
    const settled = resolveCanvasDisplaySize({
      measuredWidth: 800,
      measuredHeight: 420,
      devicePixelRatio: 2,
      prevCssWidth: 800,
      prevCssHeight: 420,
    });
    expect(settled.cssHeight).toBe(420);
    expect(settled.bitmapHeight).toBe(840);

    const grown = resolveCanvasDisplaySize({
      measuredWidth: 800,
      measuredHeight: 640,
      devicePixelRatio: 2,
      prevCssWidth: settled.cssWidth,
      prevCssHeight: settled.cssHeight,
    });
    expect(grown.cssHeight).toBe(640);
    expect(grown.bitmapHeight).toBe(1280);
  });

  it("rejects bitmap-sized width feedback as well as height", () => {
    const next = resolveCanvasDisplaySize({
      measuredWidth: 1600,
      measuredHeight: 840,
      devicePixelRatio: 2,
      prevCssWidth: 800,
      prevCssHeight: 420,
    });
    expect(next.cssWidth).toBe(800);
    expect(next.cssHeight).toBe(420);
    expect(next.bitmapWidth).toBe(1600);
    expect(next.bitmapHeight).toBe(840);
  });

  it("treats non-positive dpr as 1", () => {
    const next = resolveCanvasDisplaySize({
      measuredWidth: 100,
      measuredHeight: 50,
      devicePixelRatio: 0,
      prevCssWidth: 0,
      prevCssHeight: 0,
    });
    expect(next.cssHeight).toBe(CANVAS_MIN_CSS_HEIGHT);
    expect(next.bitmapHeight).toBe(CANVAS_MIN_CSS_HEIGHT);
  });
});
