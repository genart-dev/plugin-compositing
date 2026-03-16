import type {
  McpToolDefinition,
  McpToolContext,
  McpToolResult,
  JsonSchema,
  DesignLayer,
  LayerTransform,
  LayerProperties,
} from "@genart-dev/core";
import type { GradientStop } from "./gradient.js";

function textResult(text: string): McpToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(text: string): McpToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function generateLayerId(): string {
  return `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultTransform(input: Record<string, unknown>): LayerTransform {
  return {
    x: (input.x as number) ?? 0,
    y: (input.y as number) ?? 0,
    width: (input.width as number) ?? 800,
    height: (input.height as number) ?? 600,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    anchorX: 0.5,
    anchorY: 0.5,
  };
}

function makeLayer(
  typeId: string,
  name: string,
  properties: LayerProperties,
  transform: LayerTransform,
  input: Record<string, unknown>,
): DesignLayer {
  return {
    id: generateLayerId(),
    type: typeId,
    name: (input.layerName as string) ?? name,
    visible: true,
    locked: false,
    opacity: (input.opacity as number) ?? 1,
    blendMode: (input.blendMode as import("@genart-dev/core").BlendMode) ?? "normal",
    transform,
    properties,
  };
}

export const addSolidTool: McpToolDefinition = {
  name: "add_solid",
  description: "Add a solid color fill layer to the canvas.",
  inputSchema: {
    type: "object",
    properties: {
      color: { type: "string", description: "Fill color (hex or rgba). Default #000000." },
      layerName: { type: "string" },
      x: { type: "number" }, y: { type: "number" },
      width: { type: "number" }, height: { type: "number" },
      blendMode: { type: "string" },
      opacity: { type: "number", description: "0–1" },
    },
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const layer = makeLayer(
      "composite:solid",
      "Solid Fill",
      { color: (input.color as string) ?? "#000000" },
      defaultTransform(input),
      input,
    );
    context.layers.add(layer);
    context.emitChange("layer-added");
    return textResult(`Added solid fill layer '${layer.id}'.`);
  },
};

export const addGradientTool: McpToolDefinition = {
  name: "add_gradient",
  description: "Add a gradient fill layer (linear, radial, angular, or diamond).",
  inputSchema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["linear", "radial", "angular", "diamond"], description: 'Default "linear".' },
      stops: {
        type: "array",
        description: "Gradient stops [{offset: 0–1, color: hex}]. Min 2.",
        items: { type: "object", properties: { offset: { type: "number" }, color: { type: "string" } } },
      },
      angle: { type: "number", description: "Degrees for linear/angular. Default 0." },
      centerX: { type: "number", description: "0–1 horizontal center (radial/diamond). Default 0.5." },
      centerY: { type: "number", description: "0–1 vertical center. Default 0.5." },
      layerName: { type: "string" },
      x: { type: "number" }, y: { type: "number" },
      width: { type: "number" }, height: { type: "number" },
      blendMode: { type: "string" },
      opacity: { type: "number" },
    },
    required: ["stops"],
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const stops = input.stops as GradientStop[];
    if (!stops || stops.length < 2) return errorResult("At least 2 gradient stops required.");

    const properties: LayerProperties = {
      gradientType: (input.type as string) ?? "linear",
      stops: JSON.stringify(stops),
      angle: (input.angle as number) ?? 0,
      centerX: (input.centerX as number) ?? 0.5,
      centerY: (input.centerY as number) ?? 0.5,
      scale: 1.0,
    };

    const layer = makeLayer("composite:gradient", "Gradient Fill", properties, defaultTransform(input), input);
    context.layers.add(layer);
    context.emitChange("layer-added");
    return textResult(`Added gradient fill layer '${layer.id}'.`);
  },
};

export const importImageTool: McpToolDefinition = {
  name: "import_image",
  description: "Import a base64-encoded image into the sketch and create a composite:image layer.",
  inputSchema: {
    type: "object",
    properties: {
      data: { type: "string", description: "Base64-encoded image data." },
      mimeType: { type: "string", description: '"image/png", "image/jpeg", or "image/webp".' },
      name: { type: "string", description: "Asset display name." },
      fit: { type: "string", enum: ["cover", "contain", "fill", "none"], description: 'Default "cover".' },
      layerName: { type: "string" },
      x: { type: "number" }, y: { type: "number" },
      width: { type: "number" }, height: { type: "number" },
      blendMode: { type: "string" },
      opacity: { type: "number" },
    },
    required: ["data", "mimeType"],
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const assetId = `asset-${Date.now().toString(36)}`;
    const assetData = {
      mimeType: input.mimeType as string,
      data: input.data as string,
      name: (input.name as string) ?? "image",
    };

    // Store in sketch assets via context if supported
    const ctx = context as unknown as Record<string, unknown>;
    if (typeof ctx.addAsset === "function") {
      (ctx.addAsset as (id: string, data: unknown) => void)(assetId, assetData);
    }

    const properties: LayerProperties = {
      assetId,
      fit: (input.fit as string) ?? "cover",
      anchorX: 0.5,
      anchorY: 0.5,
      flipX: false,
      flipY: false,
    };

    const layer = makeLayer("composite:image", "Image", properties, defaultTransform(input), input);
    context.layers.add(layer);
    context.emitChange("layer-added");
    return textResult(`Imported image as asset '${assetId}', layer '${layer.id}'.`);
  },
};

export const createGroupTool: McpToolDefinition = {
  name: "create_group",
  description: "Create a group layer, optionally moving existing layers into it.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      layerIds: { type: "array", description: "Existing layer IDs to move into the group.", items: { type: "string" } },
      isolate: { type: "boolean", description: "Render children to isolated compositing context. Default true." },
      clip: { type: "boolean", description: "Clip children to group bounds. Default false." },
      blendMode: { type: "string" },
      opacity: { type: "number" },
    },
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const properties: LayerProperties = {
      isolate: (input.isolate as boolean) ?? true,
      clip: (input.clip as boolean) ?? false,
      maskLayerId: "",
    };

    const id = generateLayerId();
    const layer: DesignLayer = {
      id,
      type: "composite:group",
      name: (input.name as string) ?? "Group",
      visible: true,
      locked: false,
      opacity: (input.opacity as number) ?? 1,
      blendMode: (input.blendMode as import("@genart-dev/core").BlendMode) ?? "normal",
      transform: { x: 0, y: 0, width: 800, height: 600, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5 },
      properties,
    };

    context.layers.add(layer);

    // Move specified layers into group if supported
    const layerIds = input.layerIds as string[] | undefined;
    const ctx = context as unknown as Record<string, unknown>;
    if (layerIds && layerIds.length > 0 && typeof ctx.moveLayersToGroup === "function") {
      (ctx.moveLayersToGroup as (groupId: string, ids: string[]) => void)(id, layerIds);
    }

    context.emitChange("layer-added");
    return textResult(`Created group layer '${id}'.`);
  },
};

export const setMaskTool: McpToolDefinition = {
  name: "set_mask",
  description:
    "Apply a mask to a design layer. The mask source layer clips the target layer. " +
    "Modifier-path layers (painting:*, adjust:*, filter:*) cannot be masked.",
  inputSchema: {
    type: "object",
    properties: {
      layerId: { type: "string", description: "ID of the layer to mask." },
      maskLayerId: {
        type: "string",
        description: "ID of the layer to use as the mask source (must be earlier in the stack).",
      },
      maskMode: {
        type: "string",
        enum: ["alpha", "inverted-alpha", "luminosity"],
        description:
          'alpha: show where mask is opaque (default); inverted-alpha: show where mask is transparent; luminosity: modulate by mask brightness.',
      },
    },
    required: ["layerId", "maskLayerId"],
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const layerId = input.layerId as string;
    const maskLayerId = input.maskLayerId as string;

    if (!context.layers.get(layerId)) return errorResult(`Layer '${layerId}' not found.`);
    if (!context.layers.get(maskLayerId)) return errorResult(`Mask source layer '${maskLayerId}' not found.`);
    if (maskLayerId === layerId) return errorResult(`A layer cannot mask itself.`);

    const mode = (input.maskMode as "alpha" | "inverted-alpha" | "luminosity" | undefined) ?? "alpha";
    context.layers.setMask(layerId, maskLayerId, mode);
    return textResult(`Set ${mode} mask on layer '${layerId}' using '${maskLayerId}'.`);
  },
};

export const clearMaskTool: McpToolDefinition = {
  name: "clear_mask",
  description: "Remove the mask from a design layer, restoring full unmasked rendering.",
  inputSchema: {
    type: "object",
    properties: {
      layerId: { type: "string", description: "ID of the layer to unmask." },
    },
    required: ["layerId"],
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const layerId = input.layerId as string;
    if (!context.layers.get(layerId)) return errorResult(`Layer '${layerId}' not found.`);
    context.layers.clearMask(layerId);
    return textResult(`Removed mask from layer '${layerId}'.`);
  },
};

export const listAssetsTool: McpToolDefinition = {
  name: "list_assets",
  description: "List all image assets embedded in the current sketch.",
  inputSchema: {
    type: "object",
    properties: {},
  } satisfies JsonSchema,

  async handler(
    _input: Record<string, unknown>,
    context: McpToolContext,
  ): Promise<McpToolResult> {
    const ctx = context as unknown as Record<string, unknown>;
    const assets = (ctx.assets as Record<string, { name?: string; mimeType: string; data: string }>) ?? {};
    const entries = Object.entries(assets).map(([id, a]) => ({
      id,
      name: a.name ?? id,
      mimeType: a.mimeType,
      sizeBytes: Math.round((a.data.length * 3) / 4),
    }));
    if (entries.length === 0) return textResult("No assets in this sketch.");
    const lines = entries.map((e) => `• ${e.id} — ${e.name} (${e.mimeType}, ${e.sizeBytes} bytes)`);
    return textResult(`Assets:\n${lines.join("\n")}`);
  },
};

export const compositingMcpTools: McpToolDefinition[] = [
  addSolidTool,
  addGradientTool,
  importImageTool,
  createGroupTool,
  setMaskTool,
  clearMaskTool,
  listAssetsTool,
];
