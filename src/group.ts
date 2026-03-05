import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  LayerBounds,
  RenderResources,
} from "@genart-dev/core";

const GROUP_PROPERTIES: LayerPropertySchema[] = [
  { key: "isolate", label: "Isolate", type: "boolean", default: true, group: "group" },
  { key: "clip", label: "Clip to Bounds", type: "boolean", default: false, group: "group" },
  { key: "maskLayerId", label: "Mask Layer", type: "string", default: "", group: "group" },
];

export const groupLayerType: LayerTypeDefinition = {
  typeId: "composite:group",
  displayName: "Group",
  icon: "folder",
  category: "group",
  properties: GROUP_PROPERTIES,
  propertyEditorId: "composite:group-editor",

  createDefault(): LayerProperties {
    return { isolate: true, clip: false, maskLayerId: "" };
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
    resources: RenderResources,
  ): void {
    const isolate = (properties.isolate as boolean) ?? true;
    const clip = (properties.clip as boolean) ?? false;

    if (!isolate) {
      // Pass-through: children render normally via the outer pipeline
      return;
    }

    // Render children into an offscreen canvas
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const offscreen = new OffscreenCanvas(canvasWidth, canvasHeight);
    const offCtx = offscreen.getContext("2d") as unknown as CanvasRenderingContext2D;

    if (clip) {
      offCtx.save();
      offCtx.beginPath();
      offCtx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
      offCtx.clip();
    }

    // Render children via resources.renderChildren if available
    const res = resources as unknown as Record<string, unknown>;
    if (typeof res.renderChildren === "function") {
      (res.renderChildren as (ctx: CanvasRenderingContext2D) => void)(offCtx);
    }

    if (clip) offCtx.restore();

    // Composite offscreen onto parent
    ctx.drawImage(offscreen as unknown as HTMLCanvasElement, 0, 0);
  },

  validate(): null {
    return null;
  },
};
