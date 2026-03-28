import { describe, it, expect, vi } from "vitest";
import compositingPlugin from "../src/index.js";
import { dropShadowLayerType } from "../src/drop-shadow.js";
import { innerGlowLayerType } from "../src/inner-glow.js";
import type { DesignLayer, McpToolContext, LayerBounds, RenderResources, LayerProperties } from "@genart-dev/core";

const BOUNDS: LayerBounds = { x: 0, y: 0, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1 };
const RESOURCES: RenderResources = { getFont: () => null, getImage: () => null, theme: "dark", pixelRatio: 1 };

function createMockImageData(w: number, h: number, fill?: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  const [r, g, b] = fill ?? [128, 128, 128];
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
}

function createMockCtx(imageData?: ImageData) {
  const id = imageData ?? createMockImageData(100, 100);
  return {
    save: vi.fn(),
    restore: vi.fn(),
    getImageData: vi.fn(() => id),
    putImageData: vi.fn(),
    fillRect: vi.fn(),
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    shadowColor: "",
    fillStyle: "",
    filter: "",
  } as unknown as CanvasRenderingContext2D;
}

function makeMockToolContext(layers: DesignLayer[] = []): McpToolContext {
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  return {
    layers: {
      add: vi.fn((layer: DesignLayer) => layerMap.set(layer.id, layer)),
      get: vi.fn((id: string) => layerMap.get(id)),
      updateProperties: vi.fn(),
      setMask: vi.fn(),
      clearMask: vi.fn(),
    },
    emitChange: vi.fn(),
  } as unknown as McpToolContext;
}

// ---------------------------------------------------------------------------
// Drop Shadow Layer
// ---------------------------------------------------------------------------
describe("composite:drop-shadow", () => {
  it("has correct metadata", () => {
    expect(dropShadowLayerType.typeId).toBe("composite:drop-shadow");
    expect(dropShadowLayerType.category).toBe("filter");
  });

  it("creates defaults", () => {
    const d = dropShadowLayerType.createDefault();
    expect(d.offsetX).toBe(4);
    expect(d.offsetY).toBe(4);
    expect(d.blur).toBe(8);
    expect(d.color).toBe("#00000066");
  });

  it("renders without error", () => {
    const ctx = createMockCtx();
    expect(() => dropShadowLayerType.render(
      dropShadowLayerType.createDefault(), ctx, BOUNDS, RESOURCES,
    )).not.toThrow();
  });

  it("skips when all offsets and blur are zero", () => {
    const ctx = createMockCtx();
    dropShadowLayerType.render(
      { ...dropShadowLayerType.createDefault(), offsetX: 0, offsetY: 0, blur: 0 },
      ctx, BOUNDS, RESOURCES,
    );
    expect(ctx.getImageData).not.toHaveBeenCalled();
  });

  it("validate returns null", () => {
    expect(dropShadowLayerType.validate({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Inner Glow Layer
// ---------------------------------------------------------------------------
describe("composite:inner-glow", () => {
  it("has correct metadata", () => {
    expect(innerGlowLayerType.typeId).toBe("composite:inner-glow");
    expect(innerGlowLayerType.category).toBe("filter");
  });

  it("creates defaults", () => {
    const d = innerGlowLayerType.createDefault();
    expect(d.radius).toBe(10);
    expect(d.color).toBe("#ffffff");
    expect(d.intensity).toBe(0.5);
  });

  it("renders via getImageData/putImageData", () => {
    const ctx = createMockCtx();
    innerGlowLayerType.render(innerGlowLayerType.createDefault(), ctx, BOUNDS, RESOURCES);
    expect(ctx.getImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("skips at zero intensity", () => {
    const ctx = createMockCtx();
    innerGlowLayerType.render(
      { ...innerGlowLayerType.createDefault(), intensity: 0 },
      ctx, BOUNDS, RESOURCES,
    );
    expect(ctx.getImageData).not.toHaveBeenCalled();
  });

  it("modifies edge pixels toward glow color", () => {
    const id = createMockImageData(20, 20, [0, 0, 0]);
    const ctx = createMockCtx(id);
    innerGlowLayerType.render(
      { radius: 5, color: "#ffffff", intensity: 1.0 },
      ctx, { ...BOUNDS, width: 20, height: 20 }, RESOURCES,
    );
    // Corner pixel (0,0) should be shifted toward white
    expect(id.data[0]).toBeGreaterThan(0);
    // Center pixel (10,10) should be unchanged (far from edge)
    const ci = (10 * 20 + 10) * 4;
    expect(id.data[ci]).toBe(0);
  });

  it("validate returns null", () => {
    expect(innerGlowLayerType.validate({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Blend Mode Tools
// ---------------------------------------------------------------------------
describe("list_blend_modes tool", () => {
  it("lists available blend modes", async () => {
    const tool = compositingPlugin.mcpTools.find((t) => t.name === "list_blend_modes")!;
    expect(tool).toBeDefined();
    const result = await tool.handler({}, makeMockToolContext());
    const text = result.content[0]!;
    expect(text.type).toBe("text");
    expect((text as { text: string }).text).toContain("multiply");
    expect((text as { text: string }).text).toContain("screen");
    expect((text as { text: string }).text).toContain("overlay");
  });
});

describe("set_blend_mode tool", () => {
  it("sets blend mode on existing layer", async () => {
    const transform = { x: 0, y: 0, width: 800, height: 600, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5 };
    const layer: DesignLayer = {
      id: "layer-1", type: "composite:solid", name: "Solid",
      visible: true, locked: false, opacity: 1, blendMode: "normal",
      transform, properties: { color: "#000" },
    };
    const ctx = makeMockToolContext([layer]);
    const tool = compositingPlugin.mcpTools.find((t) => t.name === "set_blend_mode")!;
    const result = await tool.handler({ layerId: "layer-1", blendMode: "multiply" }, ctx);
    expect(result.isError).toBeFalsy();
    expect(ctx.layers.updateProperties).toHaveBeenCalled();
  });

  it("returns error for unknown layer", async () => {
    const ctx = makeMockToolContext();
    const tool = compositingPlugin.mcpTools.find((t) => t.name === "set_blend_mode")!;
    const result = await tool.handler({ layerId: "nonexistent", blendMode: "multiply" }, ctx);
    expect(result.isError).toBe(true);
  });

  it("returns error for invalid blend mode", async () => {
    const transform = { x: 0, y: 0, width: 800, height: 600, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5 };
    const layer: DesignLayer = {
      id: "layer-1", type: "composite:solid", name: "Solid",
      visible: true, locked: false, opacity: 1, blendMode: "normal",
      transform, properties: { color: "#000" },
    };
    const ctx = makeMockToolContext([layer]);
    const tool = compositingPlugin.mcpTools.find((t) => t.name === "set_blend_mode")!;
    const result = await tool.handler({ layerId: "layer-1", blendMode: "invalid" }, ctx);
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Add tools
// ---------------------------------------------------------------------------
describe("add_drop_shadow tool", () => {
  it("creates a drop shadow layer", async () => {
    const ctx = makeMockToolContext();
    const tool = compositingPlugin.mcpTools.find((t) => t.name === "add_drop_shadow")!;
    const result = await tool.handler({ blur: 12, color: "#00000080" }, ctx);
    expect(result.isError).toBeFalsy();
    expect(ctx.layers.add).toHaveBeenCalled();
  });
});

describe("add_inner_glow tool", () => {
  it("creates an inner glow layer", async () => {
    const ctx = makeMockToolContext();
    const tool = compositingPlugin.mcpTools.find((t) => t.name === "add_inner_glow")!;
    const result = await tool.handler({ radius: 15, color: "#ff0000" }, ctx);
    expect(result.isError).toBeFalsy();
    expect(ctx.layers.add).toHaveBeenCalled();
  });
});
