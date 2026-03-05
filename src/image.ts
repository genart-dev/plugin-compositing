import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  LayerBounds,
  RenderResources,
} from "@genart-dev/core";

const IMAGE_PROPERTIES: LayerPropertySchema[] = [
  { key: "assetId", label: "Asset", type: "string", default: "", group: "image" },
  {
    key: "fit",
    label: "Fit",
    type: "select",
    default: "cover",
    options: [
      { value: "cover", label: "Cover" },
      { value: "contain", label: "Contain" },
      { value: "fill", label: "Fill" },
      { value: "none", label: "None" },
    ],
    group: "image",
  },
  { key: "anchorX", label: "Anchor X", type: "number", default: 0.5, min: 0, max: 1, step: 0.01, group: "image" },
  { key: "anchorY", label: "Anchor Y", type: "number", default: 0.5, min: 0, max: 1, step: 0.01, group: "image" },
  { key: "flipX", label: "Flip X", type: "boolean", default: false, group: "image" },
  { key: "flipY", label: "Flip Y", type: "boolean", default: false, group: "image" },
];

/** Simple in-memory image cache. */
const imageCache = new Map<string, HTMLImageElement | null>();

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(src)) return imageCache.get(src)!;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(src, null);
      resolve(null);
    };
    img.src = src;
  });
}

function computeDrawRect(
  imgW: number,
  imgH: number,
  bounds: LayerBounds,
  fit: string,
  anchorX: number,
  anchorY: number,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const bw = bounds.width;
  const bh = bounds.height;
  const bx = bounds.x;
  const by = bounds.y;

  if (fit === "fill") {
    return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx: bx, dy: by, dw: bw, dh: bh };
  }
  if (fit === "none") {
    const dx = bx + (bw - imgW) * anchorX;
    const dy = by + (bh - imgH) * anchorY;
    return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx, dy, dw: imgW, dh: imgH };
  }

  const imgRatio = imgW / imgH;
  const boundsRatio = bw / bh;
  let drawW: number, drawH: number;

  if (fit === "cover") {
    if (imgRatio > boundsRatio) {
      drawH = bh;
      drawW = bh * imgRatio;
    } else {
      drawW = bw;
      drawH = bw / imgRatio;
    }
  } else {
    // contain
    if (imgRatio > boundsRatio) {
      drawW = bw;
      drawH = bw / imgRatio;
    } else {
      drawH = bh;
      drawW = bh * imgRatio;
    }
  }

  const dx = bx + (bw - drawW) * anchorX;
  const dy = by + (bh - drawH) * anchorY;

  if (fit === "cover") {
    // Clip to bounds
    const clipX = Math.max(0, bx - dx);
    const clipY = Math.max(0, by - dy);
    const clipW = drawW - Math.max(0, dx + drawW - (bx + bw)) - clipX;
    const clipH = drawH - Math.max(0, dy + drawH - (by + bh)) - clipY;
    const scaleX = imgW / drawW;
    const scaleY = imgH / drawH;
    return {
      sx: clipX * scaleX,
      sy: clipY * scaleY,
      sw: clipW * scaleX,
      sh: clipH * scaleY,
      dx: dx + clipX,
      dy: dy + clipY,
      dw: clipW,
      dh: clipH,
    };
  }

  return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx, dy, dw: drawW, dh: drawH };
}

export const imageLayerType: LayerTypeDefinition = {
  typeId: "composite:image",
  displayName: "Image",
  icon: "image",
  category: "image",
  properties: IMAGE_PROPERTIES,
  propertyEditorId: "composite:image-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const s of IMAGE_PROPERTIES) props[s.key] = s.default;
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
    resources: RenderResources,
  ): void {
    const assetId = (properties.assetId as string) ?? "";
    if (!assetId) return;

    // Try to resolve asset from resources
    const asset = (resources as unknown as Record<string, unknown>).assets as Record<string, { data: string; mimeType: string }> | undefined;
    if (!asset?.[assetId]) return;

    const { data, mimeType } = asset[assetId]!;
    const src = `data:${mimeType};base64,${data}`;
    const cached = imageCache.get(src);

    if (cached === undefined) {
      // Kick off async load; render nothing this frame
      void loadImage(src);
      return;
    }
    if (cached === null) return; // Load failed

    const fit = (properties.fit as string) ?? "cover";
    const anchorX = (properties.anchorX as number) ?? 0.5;
    const anchorY = (properties.anchorY as number) ?? 0.5;
    const flipX = (properties.flipX as boolean) ?? false;
    const flipY = (properties.flipY as boolean) ?? false;

    const { sx, sy, sw, sh, dx, dy, dw, dh } = computeDrawRect(
      cached.naturalWidth,
      cached.naturalHeight,
      bounds,
      fit,
      anchorX,
      anchorY,
    );

    ctx.save();
    if (flipX || flipY) {
      ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.translate(-(bounds.x + bounds.width / 2), -(bounds.y + bounds.height / 2));
    }
    ctx.drawImage(cached, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
  },

  validate(): null {
    return null;
  },
};
