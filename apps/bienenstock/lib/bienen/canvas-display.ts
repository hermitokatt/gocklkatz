/** Minimum CSS height for the Bienenstock canvas host. */
export const CANVAS_MIN_CSS_HEIGHT = 480;

export type CanvasDisplaySize = {
  cssWidth: number;
  cssHeight: number;
  bitmapWidth: number;
  bitmapHeight: number;
};

/**
 * Resolve canvas CSS + bitmap sizes without a ResizeObserver feedback loop.
 *
 * When `height: 100%` does not resolve, browsers use the canvas bitmap intrinsic size as layout
 * height. Writing `canvas.height` from `getBoundingClientRect() × devicePixelRatio` then grows
 * without bound. If the newly measured box matches the previous bitmap size, keep the prior CSS
 * size. Call `renderer.setSize(w, h, false)` so Three does not also write the CSS box.
 */
export function resolveCanvasDisplaySize(input: {
  measuredWidth: number;
  measuredHeight: number;
  devicePixelRatio: number;
  prevCssWidth: number;
  prevCssHeight: number;
  minCssHeight?: number;
}): CanvasDisplaySize {
  const dpr =
    Number.isFinite(input.devicePixelRatio) && input.devicePixelRatio > 0
      ? input.devicePixelRatio
      : 1;
  const minH = input.minCssHeight ?? CANVAS_MIN_CSS_HEIGHT;

  let cssWidth = Math.max(1, Math.round(input.measuredWidth));
  let cssHeight = Math.max(minH, Math.round(input.measuredHeight));

  if (input.prevCssHeight > 0) {
    const prevBitmapHeight = Math.round(input.prevCssHeight * dpr);
    if (Math.abs(Math.round(input.measuredHeight) - prevBitmapHeight) <= 1) {
      cssHeight = Math.max(minH, Math.round(input.prevCssHeight));
    }
  }

  if (input.prevCssWidth > 0) {
    const prevBitmapWidth = Math.round(input.prevCssWidth * dpr);
    if (Math.abs(Math.round(input.measuredWidth) - prevBitmapWidth) <= 1) {
      cssWidth = Math.max(1, Math.round(input.prevCssWidth));
    }
  }

  return {
    cssWidth,
    cssHeight,
    bitmapWidth: Math.round(cssWidth * dpr),
    bitmapHeight: Math.round(cssHeight * dpr),
  };
}

/**
 * Pin CSS pixel box so bitmap intrinsic size cannot feed layout, then set backing store.
 */
export function applyCanvasDisplaySize(
  canvas: HTMLCanvasElement,
  size: CanvasDisplaySize,
): void {
  canvas.style.width = `${size.cssWidth}px`;
  canvas.style.height = `${size.cssHeight}px`;
  if (canvas.width !== size.bitmapWidth || canvas.height !== size.bitmapHeight) {
    canvas.width = size.bitmapWidth;
    canvas.height = size.bitmapHeight;
  }
}
