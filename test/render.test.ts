import { describe, it, expect, vi } from "vitest";
import {
  solidLayerType,
  gradientLayerType,
  imageLayerType,
  groupLayerType,
} from "../src/index.js";
import type { LayerBounds, RenderResources } from "@genart-dev/core";

const BOUNDS: LayerBounds = { x: 0, y: 0, width: 200, height: 200 };
const RESOURCES: RenderResources = {} as RenderResources;

function makeMockCtx() {
  const ctx: Record<string, unknown> = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "#000",
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    createImageData: vi.fn().mockImplementation((w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
    canvas: { width: 200, height: 200 },
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

describe("solidLayerType render", () => {
  it("calls save/restore and fills the bounds", () => {
    const ctx = makeMockCtx();
    solidLayerType.render({ color: "#ff0000" }, ctx, BOUNDS, RESOURCES);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 200, 200);
    expect(ctx.fillStyle).toBe("#ff0000");
  });

  it("renders at non-zero origin", () => {
    const ctx = makeMockCtx();
    solidLayerType.render({ color: "#00ff00" }, ctx, { x: 50, y: 50, width: 100, height: 100 }, RESOURCES);
    expect(ctx.fillRect).toHaveBeenCalledWith(50, 50, 100, 100);
  });
});

describe("gradientLayerType render", () => {
  it("renders linear gradient with save/restore", () => {
    const ctx = makeMockCtx();
    gradientLayerType.render(gradientLayerType.createDefault(), ctx, BOUNDS, RESOURCES);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("renders radial gradient", () => {
    const ctx = makeMockCtx();
    const props = { ...gradientLayerType.createDefault(), gradientType: "radial" };
    gradientLayerType.render(props, ctx, BOUNDS, RESOURCES);
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("renders angular gradient via per-pixel path", () => {
    const ctx = makeMockCtx();
    const props = { ...gradientLayerType.createDefault(), gradientType: "angular" };
    gradientLayerType.render(props, ctx, BOUNDS, RESOURCES);
    expect(ctx.createImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();
    // Should NOT use canvas gradient API for angular
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });

  it("renders diamond gradient via per-pixel path", () => {
    const ctx = makeMockCtx();
    const props = { ...gradientLayerType.createDefault(), gradientType: "diamond" };
    gradientLayerType.render(props, ctx, BOUNDS, RESOURCES);
    expect(ctx.createImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("skips render with fewer than 2 stops", () => {
    const ctx = makeMockCtx();
    const props = { ...gradientLayerType.createDefault(), stops: JSON.stringify([{ offset: 0, color: "#000" }]) };
    gradientLayerType.render(props, ctx, BOUNDS, RESOURCES);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.putImageData).not.toHaveBeenCalled();
  });

  it("angular gradient pixel data is filled", () => {
    const ctx = makeMockCtx();
    const props = { ...gradientLayerType.createDefault(), gradientType: "angular" };
    gradientLayerType.render(props, ctx, BOUNDS, RESOURCES);
    // putImageData is called with the filled imageData
    const putCall = (ctx.putImageData as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(putCall).toBeDefined();
    const imgData = putCall![0] as { data: Uint8ClampedArray };
    // Some pixels should have non-zero alpha (angular fills alpha=255)
    let hasAlpha = false;
    for (let i = 3; i < imgData.data.length; i += 4) {
      if (imgData.data[i] > 0) { hasAlpha = true; break; }
    }
    expect(hasAlpha).toBe(true);
  });

  it("caches per-pixel gradient on second render", () => {
    const ctx1 = makeMockCtx();
    const ctx2 = makeMockCtx();
    const props = { ...gradientLayerType.createDefault(), gradientType: "angular" };
    gradientLayerType.render(props, ctx1, BOUNDS, RESOURCES);
    gradientLayerType.render(props, ctx2, BOUNDS, RESOURCES);
    // Second call should still putImageData but not createImageData (cached)
    expect(ctx2.putImageData).toHaveBeenCalled();
    expect(ctx2.createImageData).not.toHaveBeenCalled();
  });
});

describe("imageLayerType render", () => {
  it("does not draw when assetId is empty", () => {
    const ctx = makeMockCtx();
    imageLayerType.render(imageLayerType.createDefault(), ctx, BOUNDS, RESOURCES);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe("groupLayerType render", () => {
  it("returns early when isolate is false (pass-through)", () => {
    const ctx = makeMockCtx();
    groupLayerType.render({ isolate: false, clip: false, maskLayerId: "" }, ctx, BOUNDS, RESOURCES);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
