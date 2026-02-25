// public/avatar.js
// Canvas avatar renderer.
// Future: render layers (body, weapon, armor, effect)

// Visual properties per evolution stage (0–5).
const STAGE_CONFIG = [
  { radiusFactor: 0.28, shadowBlur: 0,  auraRings: 0 },  // stage 0: small, no glow
  { radiusFactor: 0.30, shadowBlur: 8,  auraRings: 0 },  // stage 1: soft glow
  { radiusFactor: 0.32, shadowBlur: 16, auraRings: 0 },  // stage 2: stronger glow
  { radiusFactor: 0.34, shadowBlur: 20, auraRings: 1 },  // stage 3: outer aura ring
  { radiusFactor: 0.35, shadowBlur: 24, auraRings: 2 },  // stage 4: second aura ring
  { radiusFactor: 0.37, shadowBlur: 30, auraRings: 2 },  // stage 5: max size + double glow
];

const COLOR_MAP = {
  gray:   { bg: ["#3a3a3a", "#1a1a1a"], circle: "#888888" },
  green:  { bg: ["#1a3a1a", "#0a1a0a"], circle: "#44bb44" },
  blue:   { bg: ["#1a2a3a", "#0a0a1a"], circle: "#4488cc" },
  purple: { bg: ["#2a1a3a", "#0a0a1a"], circle: "#9944bb" },
  gold:   { bg: ["#3a2a00", "#1a1000"], circle: "#ffcc00" },
};

// level 1=gray, 2-3=green, 4-5=blue, 6-7=purple, 8+=gold
function getLevelColor(level) {
  if (level < 2) return "gray";
  if (level < 4) return "green";
  if (level < 6) return "blue";
  if (level < 8) return "purple";
  return "gold";
}

function drawBackground(ctx, width, height, colors) {
  const grad = ctx.createRadialGradient(
    width / 2, height / 2, width * 0.1,
    width / 2, height / 2, width * 0.7
  );
  grad.addColorStop(0, colors.bg[0]);
  grad.addColorStop(1, colors.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawAuraRings(ctx, cx, cy, radius, color, count) {
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10 + i * 10, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25 - i * 0.08;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCircle(ctx, cx, cy, radius, color, shadowBlur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = shadowBlur;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawLevelText(ctx, cx, cy, radius, level) {
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.floor(radius * 0.65)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(level), cx, cy);
}

export function drawAvatar(canvas, level) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const key = getLevelColor(level);
  const colors = COLOR_MAP[key];
  const stage = STAGE_CONFIG[Math.min(5, Math.floor((level - 1) / 2))];

  drawBackground(ctx, width, height, colors);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * stage.radiusFactor;

  drawCircle(ctx, cx, cy, radius, colors.circle, stage.shadowBlur);
  drawAuraRings(ctx, cx, cy, radius, colors.circle, stage.auraRings);
  drawLevelText(ctx, cx, cy, radius, level);
}
