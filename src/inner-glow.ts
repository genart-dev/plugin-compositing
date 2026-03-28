import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  LayerBounds,
  RenderResources,
  ValidationError,
} from "@genart-dev/core";

const INNER_GLOW_PROPERTIES: LayerPropertySchema[] = [
  { key: "radius", label: "Glow Radius", type: "number", default: 10, min: 1, max: 50, step: 1, group: "glow" },
  { key: "color", label: "Glow Color", type: "color", default: "#ffffff", group: "glow" },
  { key: "intensity", label: "Intensity", type: "number", default: 0.5, min: 0, max: 1, step: 0.01, group: "glow" },
];

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace("#", "");
  let r: number, g: number, b: number, a = 255;
  if (clean.length === 8) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
    a = parseInt(clean.slice(6, 8), 16);
  } else {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }
  return [r, g, b, a];
}

export const innerGlowLayerType: LayerTypeDefinition = {
  typeId: "composite:inner-glow",
  displayName: "Inner Glow",
  icon: "glow",
  category: "filter",
  properties: INNER_GLOW_PROPERTIES,
  propertyEditorId: "composite:inner-glow-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const schema of INNER_GLOW_PROPERTIES) {
      props[schema.key] = schema.default;
    }
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
    _resources: RenderResources,
  ): void {
    const radius = (properties.radius as number) ?? 10;
    const colorHex = (properties.color as string) ?? "#ffffff";
    const intensity = (properties.intensity as number) ?? 0.5;

    if (intensity <= 0 || radius <= 0) return;

    const w = Math.ceil(bounds.width);
    const h = Math.ceil(bounds.height);
    if (w <= 0 || h <= 0) return;

    const imageData = ctx.getImageData(bounds.x, bounds.y, w, h);
    const data = imageData.data;
    const [gr, gg, gb] = hexToRgba(colorHex);

    // Compute edge distance for each pixel (distance to nearest transparent pixel or boundary)
    // Use a simple approximation: distance to the nearest edge of bounds
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        const alpha = data[i + 3]!;
        if (alpha === 0) continue;

        // Distance to nearest edge
        const edgeDist = Math.min(px, py, w - 1 - px, h - 1 - py);

        if (edgeDist < radius) {
          // Smooth falloff from edge
          const t = (1 - edgeDist / radius) * intensity;
          data[i]     = Math.round(data[i]! + (gr! - data[i]!) * t);
          data[i + 1] = Math.round(data[i + 1]! + (gg! - data[i + 1]!) * t);
          data[i + 2] = Math.round(data[i + 2]! + (gb! - data[i + 2]!) * t);
        }
      }
    }

    ctx.putImageData(imageData, bounds.x, bounds.y);
  },

  validate(_properties: LayerProperties): ValidationError[] | null {
    return null;
  },
};
