import { describe, expect, it } from "vitest";
import { CANVAS_MIN_CSS_HEIGHT, resolveCanvasDisplaySize } from "@/lib/bienen/canvas-display";

describe("resolveCanvasDisplaySize", () => {
  it("respects the minimum CSS height", () => {
    const size = resolveCanvasDisplaySize({
      measuredWidth: 800,
      measuredHeight: 120,
      devicePixelRatio: 2,
      prevCssWidth: 0,
      prevCssHeight: 0,
    });
    expect(size.cssHeight).toBe(CANVAS_MIN_CSS_HEIGHT);
    expect(size.bitmapHeight).toBe(CANVAS_MIN_CSS_HEIGHT * 2);
  });

  it("does not treat a previous bitmap height as a new CSS height", () => {
    const prevCssHeight = 500;
    const dpr = 2;
    const size = resolveCanvasDisplaySize({
      measuredWidth: 900,
      measuredHeight: prevCssHeight * dpr,
      devicePixelRatio: dpr,
      prevCssWidth: 900,
      prevCssHeight,
    });
    expect(size.cssHeight).toBe(prevCssHeight);
    expect(size.bitmapHeight).toBe(prevCssHeight * dpr);
  });
});
