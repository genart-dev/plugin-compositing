import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  LayerBounds,
  RenderResources,
  ValidationError,
} from "@genart-dev/core";

export interface GradientStop {
  offset: number;
  color: string;
}

const GRADIENT_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "gradientType",
    label: "Type",
    type: "select",
    default: "linear",
    options: [
      { value: "linear", label: "Linear" },
      { value: "radial", label: "Radial" },
      { value: "angular", label: "Angular" },
      { value: "diamond", label: "Diamond" },
    ],
    group: "gradient",
  },
  {
    key: "stops",
    label: "Stops",
    type: "string",
    default: JSON.stringify([
      { offset: 0, color: "#000000" },
      { offset: 1, color: "#ffffff" },
    ]),
    group: "gradient",
  },
  { key: "angle", label: "Angle (deg)", type: "number", default: 0, min: 0, max: 360, step: 1, group: "gradient" },
  { key: "centerX", label: "Center X", type: "number", default: 0.5, min: 0, max: 1, step: 0.01, group: "gradient" },
  { key: "centerY", label: "Center Y", type: "number", default: 0.5, min: 0, max: 1, step: 0.01, group: "gradient" },
  { key: "scale", label: "Scale", type: "number", default: 1.0, min: 0.1, max: 5, step: 0.1, group: "gradient" },
];

function hexToRgba(hex: string, alpha = 1): string {
  return hex; // Canvas 2D accepts hex directly for gradient stops
}

function buildLinearGradient(
  ctx: CanvasRenderingContext2D,
  bounds: LayerBounds,
  stops: GradientStop[],
  angleDeg: number,
): CanvasGradient {
  const rad = (angleDeg * Math.PI) / 180;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const halfDiag = Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height) / 2;
  const x0 = cx - Math.sin(rad) * halfDiag;
  const y0 = cy - Math.cos(rad) * halfDiag;
  const x1 = cx + Math.sin(rad) * halfDiag;
  const y1 = cy + Math.cos(rad) * halfDiag;
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const stop of stops) {
    grad.addColorStop(stop.offset, hexToRgba(stop.color));
  }
  return grad;
}

function buildRadialGradient(
  ctx: CanvasRenderingContext2D,
  bounds: LayerBounds,
  stops: GradientStop[],
  cx: number,
  cy: number,
  scale: number,
): CanvasGradient {
  const fcx = bounds.x + bounds.width * cx;
  const fcy = bounds.y + bounds.height * cy;
  const radius = Math.max(bounds.width, bounds.height) * 0.5 * scale;
  const grad = ctx.createRadialGradient(fcx, fcy, 0, fcx, fcy, radius);
  for (const stop of stops) {
    grad.addColorStop(stop.offset, hexToRgba(stop.color));
  }
  return grad;
}

/** Render angular or diamond gradient via per-pixel ImageData. Cached by hash. */
const offscreenCache = new Map<string, ImageData>();

function renderPerPixelGradient(
  ctx: CanvasRenderingContext2D,
  bounds: LayerBounds,
  stops: GradientStop[],
  type: "angular" | "diamond",
  cx: number,
  cy: number,
): void {
  const w = Math.ceil(bounds.width);
  const h = Math.ceil(bounds.height);
  const key = `${type}:${w}x${h}:${JSON.stringify(stops)}:${cx},${cy}`;

  let imageData = offscreenCache.get(key);
  if (!imageData) {
    imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    const fcx = cx * w;
    const fcy = cy * h;

    // Pre-parse stops
    const parsedStops = stops.map((s) => {
      const hex = s.color.replace("#", "");
      return {
        offset: s.offset,
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    });

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let t: number;
        if (type === "angular") {
          t = (Math.atan2(y - fcy, x - fcx) / (2 * Math.PI) + 0.5 + 0.25) % 1;
        } else {
          // diamond: Manhattan distance from center, normalized
          const dx = Math.abs(x - fcx) / w;
          const dy = Math.abs(y - fcy) / h;
          t = Math.min(1, (dx + dy) * 2);
        }

        // Interpolate between stops
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < parsedStops.length - 1; i++) {
          const s0 = parsedStops[i]!;
          const s1 = parsedStops[i + 1]!;
          if (t >= s0.offset && t <= s1.offset) {
            const frac = (t - s0.offset) / (s1.offset - s0.offset);
            r = Math.round(s0.r + (s1.r - s0.r) * frac);
            g = Math.round(s0.g + (s1.g - s0.g) * frac);
            b = Math.round(s0.b + (s1.b - s0.b) * frac);
            break;
          }
        }
        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    offscreenCache.set(key, imageData);
  }

  ctx.putImageData(imageData, bounds.x, bounds.y);
}

export const gradientLayerType: LayerTypeDefinition = {
  typeId: "composite:gradient",
  displayName: "Gradient Fill",
  icon: "gradient",
  category: "image",
  properties: GRADIENT_PROPERTIES,
  propertyEditorId: "composite:gradient-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const s of GRADIENT_PROPERTIES) props[s.key] = s.default;
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
    _resources: RenderResources,
  ): void {
    const type = (properties.gradientType as string) ?? "linear";
    const stops = JSON.parse((properties.stops as string) ?? "[]") as GradientStop[];
    if (stops.length < 2) return;

    const angle = (properties.angle as number) ?? 0;
    const cx = (properties.centerX as number) ?? 0.5;
    const cy = (properties.centerY as number) ?? 0.5;
    const scale = (properties.scale as number) ?? 1.0;

    ctx.save();

    if (type === "linear") {
      ctx.fillStyle = buildLinearGradient(ctx, bounds, stops, angle);
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    } else if (type === "radial") {
      ctx.fillStyle = buildRadialGradient(ctx, bounds, stops, cx, cy, scale);
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    } else {
      renderPerPixelGradient(ctx, bounds, stops, type as "angular" | "diamond", cx, cy);
    }

    ctx.restore();
  },

  validate(properties: LayerProperties): ValidationError[] | null {
    try {
      const stops = JSON.parse(properties.stops as string) as GradientStop[];
      if (!Array.isArray(stops) || stops.length < 2) {
        return [{ property: "stops", message: "At least 2 gradient stops required" }];
      }
    } catch {
      return [{ property: "stops", message: "Invalid JSON for stops" }];
    }
    return null;
  },
};
