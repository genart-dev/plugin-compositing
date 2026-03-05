import type { DesignPlugin, PluginContext } from "@genart-dev/core";
import { solidLayerType } from "./solid.js";
import { gradientLayerType } from "./gradient.js";
import { imageLayerType } from "./image.js";
import { groupLayerType } from "./group.js";
import { compositingMcpTools } from "./compositing-tools.js";

const compositingPlugin: DesignPlugin = {
  id: "compositing",
  name: "Compositing",
  version: "0.1.0",
  tier: "free",
  description: "Compositing layers: solid fill, gradient fill, image, group.",

  layerTypes: [
    solidLayerType,
    gradientLayerType,
    imageLayerType,
    groupLayerType,
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
export { compositingMcpTools } from "./compositing-tools.js";
export type { GradientStop } from "./gradient.js";
