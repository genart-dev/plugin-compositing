import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  LayerBounds,
  RenderResources,
} from "@genart-dev/core";

const SOLID_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "color",
    label: "Color",
    type: "color",
    default: "#000000",
    group: "fill",
  },
];

export const solidLayerType: LayerTypeDefinition = {
  typeId: "composite:solid",
  displayName: "Solid Fill",
  icon: "rectangle",
  category: "image",
  properties: SOLID_PROPERTIES,
  propertyEditorId: "composite:solid-editor",

  createDefault(): LayerProperties {
    return { color: "#000000" };
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
    _resources: RenderResources,
  ): void {
    ctx.save();
    ctx.fillStyle = (properties.color as string) ?? "#000000";
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();
  },

  validate(): null {
    return null;
  },
};
