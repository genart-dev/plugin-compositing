import { describe, it, expect, vi, beforeEach } from "vitest";
import compositingPlugin, {
  solidLayerType,
  gradientLayerType,
  imageLayerType,
  groupLayerType,
} from "../src/index.js";
import type { McpToolContext, DesignLayer, LayerBounds, RenderResources } from "@genart-dev/core";

const mockBounds: LayerBounds = { x: 0, y: 0, width: 800, height: 600 };
const mockResources: RenderResources = {} as RenderResources;

function makeMockCanvas() {
  const fills: string[] = [];
  const ctx: Partial<CanvasRenderingContext2D> = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "#000",
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createImageData: vi.fn().mockImplementation((w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
    canvas: { width: 800, height: 600 } as HTMLCanvasElement,
  };
  return ctx as CanvasRenderingContext2D;
}

function makeMockContext(layers: DesignLayer[] = []) {
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

describe("compositingPlugin", () => {
  it("exports a valid DesignPlugin", () => {
    expect(compositingPlugin.id).toBe("compositing");
    expect(compositingPlugin.tier).toBe("free");
    expect(compositingPlugin.layerTypes).toHaveLength(6);
    expect(compositingPlugin.mcpTools).toHaveLength(11);
  });

  it("all layer types have unique typeIds", () => {
    const ids = compositingPlugin.layerTypes.map((t) => t.typeId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("solidLayerType", () => {
  it("createDefault returns color property", () => {
    const props = solidLayerType.createDefault();
    expect(props.color).toBe("#000000");
  });

  it("renders a filled rect", () => {
    const ctx = makeMockCanvas();
    solidLayerType.render({ color: "#ff0000" }, ctx, mockBounds, mockResources);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.fillStyle).toBe("#ff0000");
  });
});

describe("gradientLayerType", () => {
  it("createDefault has two-stop black-white gradient", () => {
    const props = gradientLayerType.createDefault();
    const stops = JSON.parse(props.stops as string);
    expect(stops).toHaveLength(2);
    expect(stops[0].color).toBe("#000000");
    expect(stops[1].color).toBe("#ffffff");
  });

  it("validate rejects fewer than 2 stops", () => {
    const errors = gradientLayerType.validate!({
      ...gradientLayerType.createDefault(),
      stops: JSON.stringify([{ offset: 0, color: "#000" }]),
    });
    expect(errors).not.toBeNull();
  });

  it("validate accepts 2+ stops", () => {
    const errors = gradientLayerType.validate!(gradientLayerType.createDefault());
    expect(errors).toBeNull();
  });

  it("renders linear gradient", () => {
    const ctx = makeMockCanvas();
    gradientLayerType.render(gradientLayerType.createDefault(), ctx, mockBounds, mockResources);
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("renders radial gradient", () => {
    const ctx = makeMockCanvas();
    const props = { ...gradientLayerType.createDefault(), gradientType: "radial" };
    gradientLayerType.render(props, ctx, mockBounds, mockResources);
    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });
});

describe("imageLayerType", () => {
  it("createDefault has empty assetId", () => {
    const props = imageLayerType.createDefault();
    expect(props.assetId).toBe("");
  });

  it("renders nothing when no assetId", () => {
    const ctx = makeMockCanvas();
    imageLayerType.render({ assetId: "" }, ctx, mockBounds, mockResources);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe("groupLayerType", () => {
  it("createDefault has isolate true", () => {
    const props = groupLayerType.createDefault();
    expect(props.isolate).toBe(true);
    expect(props.clip).toBe(false);
  });
});

describe("add_solid tool", () => {
  it("creates a solid layer", async () => {
    const context = makeMockContext();
    const tool = compositingPlugin.mcpTools.find((t) => t.name === "add_solid")!;
    const result = await tool.handler({ color: "#ff0000" }, context);
    expect(context.layers.add).toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
  });
});

describe("add_gradient tool", () => {
  it("creates a gradient layer", async () => {
    const context = makeMockContext();
    const tool = compositingPlugin.mcpTools.find((t) => t.name === "add_gradient")!;
    const stops = [{ offset: 0, color: "#000" }, { offset: 1, color: "#fff" }];
    const result = await tool.handler({ stops }, context);
    expect(context.layers.add).toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
  });

  it("rejects fewer than 2 stops", async () => {
    const context = makeMockContext();
    const tool = compositingPlugin.mcpTools.find((t) => t.name === "add_gradient")!;
    const result = await tool.handler({ stops: [{ offset: 0, color: "#000" }] }, context);
    expect(result.isError).toBe(true);
  });
});

describe("set_mask tool", () => {
  it("sets mask on a layer", async () => {
    const transform = { x: 0, y: 0, width: 800, height: 600, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5 };
    const layer1: DesignLayer = {
      id: "layer-1", type: "composite:solid", name: "Solid",
      visible: true, locked: false, opacity: 1, blendMode: "normal",
      transform, properties: { color: "#000" },
    };
    const layer2: DesignLayer = {
      id: "layer-2", type: "composite:solid", name: "Mask",
      visible: true, locked: false, opacity: 1, blendMode: "normal",
      transform, properties: { color: "#fff" },
    };
    const context = makeMockContext([layer1, layer2]);
    const tool = compositingPlugin.mcpTools.find((t) => t.name === "set_mask")!;
    const result = await tool.handler({ layerId: "layer-1", maskLayerId: "layer-2" }, context);
    expect(context.layers.setMask).toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
  });

  it("returns error for unknown layer", async () => {
    const context = makeMockContext();
    const tool = compositingPlugin.mcpTools.find((t) => t.name === "set_mask")!;
    const result = await tool.handler({ layerId: "not-found", maskLayerId: "" }, context);
    expect(result.isError).toBe(true);
  });
});
