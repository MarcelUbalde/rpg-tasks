// public/avatar.js
// Canvas avatar renderer.
// Future: render layers (body, weapon, armor, effect)

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

function drawCircle(ctx, cx, cy, radius, color) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  // Subtle glow ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.globalAlpha = 1;
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

  drawBackground(ctx, width, height, colors);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;

  drawCircle(ctx, cx, cy, radius, colors.circle);
  drawLevelText(ctx, cx, cy, radius, level);
}
