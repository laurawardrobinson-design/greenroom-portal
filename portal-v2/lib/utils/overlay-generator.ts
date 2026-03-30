// Pre-made overlay files for standard aspect ratios
const OVERLAY_FILES: Record<string, string> = {
  "1:1":  "/overlays/1-1.png",
  "4:5":  "/overlays/4-5.png",
  "9:16": "/overlays/9-16.png",
  "16:9": "/overlays/16-9.png",
  "4:3":  "/overlays/4-3.png",
};

/**
 * Download a Capture One overlay for the given aspect ratio.
 * Uses pre-made overlay files when available, falls back to canvas generation.
 */
export function generateOverlayPng({
  width,
  height,
  channel,
  format,
  aspectRatio,
}: {
  width: number;
  height: number;
  channel: string;
  format: string;
  aspectRatio: string;
}) {
  const filePath = OVERLAY_FILES[aspectRatio];
  if (filePath) {
    const filename = `${channel}_${format}_${aspectRatio.replace(":", "x")}_overlay.png`
      .replace(/[^a-zA-Z0-9_.-]/g, "_");
    const a = document.createElement("a");
    a.href = filePath;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // Fallback: generate via canvas for non-standard ratios
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Scale text based on canvas size
  const scale = Math.max(width, height) / 1080;
  const labelSize = Math.round(12 * scale);
  const cornerSize = Math.round(10 * scale);
  const lineWidth = Math.max(1, Math.round(scale));

  ctx.clearRect(0, 0, width, height);

  // --- Title-safe zone (90%) ---
  const titleInset = 0.05;
  const tx = width * titleInset;
  const ty = height * titleInset;
  const tw = width * (1 - 2 * titleInset);
  const th = height * (1 - 2 * titleInset);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(tx, ty, tw, th);

  // Corner brackets for title safe
  const bracketLen = Math.round(20 * scale);
  ctx.lineWidth = lineWidth * 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  // Top-left
  ctx.beginPath();
  ctx.moveTo(tx, ty + bracketLen);
  ctx.lineTo(tx, ty);
  ctx.lineTo(tx + bracketLen, ty);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(tx + tw - bracketLen, ty);
  ctx.lineTo(tx + tw, ty);
  ctx.lineTo(tx + tw, ty + bracketLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(tx, ty + th - bracketLen);
  ctx.lineTo(tx, ty + th);
  ctx.lineTo(tx + bracketLen, ty + th);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(tx + tw - bracketLen, ty + th);
  ctx.lineTo(tx + tw, ty + th);
  ctx.lineTo(tx + tw, ty + th - bracketLen);
  ctx.stroke();

  // --- Action-safe zone (80%) ---
  const actionInset = 0.1;
  const ax = width * actionInset;
  const ay = height * actionInset;
  const aw = width * (1 - 2 * actionInset);
  const ah = height * (1 - 2 * actionInset);

  ctx.setLineDash([6 * scale, 4 * scale]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(ax, ay, aw, ah);
  ctx.setLineDash([]);

  // --- Rule of thirds ---
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = lineWidth;
  for (let i = 1; i <= 2; i++) {
    const x = (width / 3) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    const y = (height / 3) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // --- Center crosshair ---
  const cx = width / 2;
  const cy = height / 2;
  const crossSize = Math.round(15 * scale);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(cx - crossSize, cy);
  ctx.lineTo(cx + crossSize, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - crossSize);
  ctx.lineTo(cx, cy + crossSize);
  ctx.stroke();

  // --- Labels ---
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = `${cornerSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

  // Bottom-left: format info
  ctx.fillText(
    `${channel} · ${format} · ${width}×${height} · ${aspectRatio}`,
    tx + 4,
    ty + th - 6
  );

  // Top-right: safe zone labels
  ctx.textAlign = "right";
  ctx.fillText("Title Safe (90%)", tx + tw - 4, ty + labelSize + 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.fillText("Action Safe (80%)", ax + aw - 4, ay + labelSize + 2);
  ctx.textAlign = "left";

  // --- Download ---
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${channel}_${format}_${width}x${height}_overlay.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}
