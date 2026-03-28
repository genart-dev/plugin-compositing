import type { DesignPlugin, PluginContext } from "@genart-dev/core";
import { solidLayerType } from "./solid.js";
import { gradientLayerType } from "./gradient.js";
import { imageLayerType } from "./image.js";
import { groupLayerType } from "./group.js";
import { dropShadowLayerType } from "./drop-shadow.js";
import { innerGlowLayerType } from "./inner-glow.js";
import { compositingMcpTools } from "./compositing-tools.js";

const compositingPlugin: DesignPlugin = {
  id: "compositing",
  name: "Compositing",
  version: "0.2.0",
  tier: "free",
  description: "Compositing layers: solid fill, gradient fill, image, group, drop shadow, inner glow.",

  layerTypes: [
    solidLayerType,
    gradientLayerType,
    imageLayerType,
    groupLayerType,
    dropShadowLayerType,
    innerGlowLayerType,
  ],
  tools: [],
  exportHandlers: [],
  mcpTools: compositingMcpTools,

  async initialize(_context: PluginContext): Promise<void> {},
  dispose(): void {},
};

export default compositingPlugin;
export { solidLayerType } from "./solid.js";
export { gradientLayerType } from "./gradient.js";
export { imageLayerType } from "./image.js";
export { groupLayerType } from "./group.js";
export { dropShadowLayerType } from "./drop-shadow.js";
export { innerGlowLayerType } from "./inner-glow.js";
export { compositingMcpTools } from "./compositing-tools.js";
export type { GradientStop } from "./gradient.js";
