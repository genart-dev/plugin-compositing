/**
 * Render test: Compositing plugin visual outputs
 * 1. Gradient types gallery (linear, radial, angular, diamond)
 * 2. Gradient variations (multi-stop, angled)
 */
const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const {
  solidLayerType,
  gradientLayerType,
} = require("./dist/index.cjs");

const outDir = path.join(__dirname, "test-renders");
fs.mkdirSync(outDir, { recursive: true });

const resources = {};

// ─── 1. Gradient Types Gallery ───
{
  const CW = 200, CH = 200, PAD = 12, LABEL_H = 28;
  const COLS = 4, ROWS = 1;
  const W = COLS * CW + (COLS + 1) * PAD;
  const H = LABEL_H + CH + PAD * 2;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, W, H);

  const types = ["linear", "radial", "angular", "diamond"];
  const stops = JSON.stringify([
    { offset: 0, color: "#4ecdc4" },
    { offset: 0.5, color: "#6b1d9e" },
    { offset: 1, color: "#ff6b6b" },
  ]);

  types.forEach((type, col) => {
    const x = PAD + col * (CW + PAD);
    const y = LABEL_H + PAD;

    ctx.fillStyle = "#e0e0e0";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(type, x + CW / 2 - ctx.measureText(type).width / 2, LABEL_H - 6);

    const bounds = { x, y, width: CW, height: CH };
    const props = {
      ...gradientLayerType.createDefault(),
      gradientType: type,
      stops,
      angle: type === "linear" ? 45 : 0,
    };
    gradientLayerType.render(props, ctx, bounds, resources);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, CW, CH);
  });

  fs.writeFileSync(path.join(outDir, "gradient-types.png"), canvas.toBuffer("image/png"));
  console.log("Wrote gradient-types.png");
}

// ─── 2. Gradient Variations ───
{
  const CW = 200, CH = 200, PAD = 12, LABEL_H = 28;
  const COLS = 4, ROWS = 2;
  const W = COLS * CW + (COLS + 1) * PAD;
  const H = ROWS * (CH + LABEL_H) + (ROWS + 1) * PAD;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, W, H);

  const variations = [
    ["Sunset", "linear", 90, [
      { offset: 0, color: "#ff6b35" },
      { offset: 0.3, color: "#f7c948" },
      { offset: 0.6, color: "#e83e8c" },
      { offset: 1, color: "#1a1a2e" },
    ]],
    ["Ocean", "radial", 0, [
      { offset: 0, color: "#ffffff" },
      { offset: 0.3, color: "#00bfff" },
      { offset: 0.7, color: "#0066cc" },
      { offset: 1, color: "#001a33" },
    ]],
    ["Neon Ring", "angular", 0, [
      { offset: 0, color: "#ff00ff" },
      { offset: 0.25, color: "#00ffff" },
      { offset: 0.5, color: "#ffff00" },
      { offset: 0.75, color: "#ff00ff" },
      { offset: 1, color: "#ff00ff" },
    ]],
    ["Gem", "diamond", 0, [
      { offset: 0, color: "#ffffff" },
      { offset: 0.2, color: "#00ff88" },
      { offset: 0.5, color: "#0088ff" },
      { offset: 1, color: "#000022" },
    ]],
    ["Diagonal", "linear", 135, [
      { offset: 0, color: "#667eea" },
      { offset: 1, color: "#764ba2" },
    ]],
    ["Off-center Radial", "radial", 0, [
      { offset: 0, color: "#ffecd2" },
      { offset: 0.5, color: "#fcb69f" },
      { offset: 1, color: "#4a1a2e" },
    ], 0.3, 0.3],
    ["Spiral Colors", "angular", 0, [
      { offset: 0, color: "#ff0000" },
      { offset: 0.166, color: "#ffff00" },
      { offset: 0.333, color: "#00ff00" },
      { offset: 0.5, color: "#00ffff" },
      { offset: 0.666, color: "#0000ff" },
      { offset: 0.833, color: "#ff00ff" },
      { offset: 1, color: "#ff0000" },
    ]],
    ["Solid Fill", null, 0, null],
  ];

  variations.forEach(([label, type, angle, stops, cx, cy], idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = PAD + col * (CW + PAD);
    const y = PAD + row * (CH + LABEL_H + PAD) + LABEL_H;

    ctx.fillStyle = "#b0b0b0";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(label, x + 4, y - 8);

    const bounds = { x, y, width: CW, height: CH };

    if (type === null) {
      // Solid fill demo
      solidLayerType.render({ color: "#4ecdc4" }, ctx, bounds, resources);
    } else {
      const props = {
        ...gradientLayerType.createDefault(),
        gradientType: type,
        stops: JSON.stringify(stops),
        angle: angle || 0,
        centerX: cx ?? 0.5,
        centerY: cy ?? 0.5,
      };
      gradientLayerType.render(props, ctx, bounds, resources);
    }

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, CW, CH);
  });

  fs.writeFileSync(path.join(outDir, "gradient-variations.png"), canvas.toBuffer("image/png"));
  console.log("Wrote gradient-variations.png");
}
