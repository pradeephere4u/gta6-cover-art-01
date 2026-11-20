// Neon Dusk poster renderer: draws a GTA-style multi-panel cover onto a canvas.
// Own design: retro sunset sky, slit sun, skyline and palm silhouettes, photo
// panels with white borders, and a big gradient caption with a heavy outline.
// Everything is drawn with the 2D canvas API; no image is fetched from the
// network and no font leaves app/fonts/.

const GRADES = {
  sunset: {
    sky: ['#1d0b3d', '#6d1e5e', '#c33d6e', '#ff7a3d', '#ffb347'],
    sun: ['#fff3b0', '#ffb347', '#ff5e62'],
    caption: ['#ffffff', '#ffd166'],
    tint: 'rgba(255, 90, 40, 0.10)',
  },
  neon: {
    sky: ['#0b1035', '#3b1d6e', '#a4138f', '#ff2e88', '#ff7ad9'],
    sun: ['#d8fbff', '#7df9ff', '#ff2e88'],
    caption: ['#ffffff', '#7df9ff'],
    tint: 'rgba(255, 46, 136, 0.10)',
  },
  dusk: {
    sky: ['#070b24', '#1c1445', '#4b2067', '#8e2f6d', '#e2607a'],
    sun: ['#ffe9c9', '#f7a072', '#c94f7c'],
    caption: ['#ffffff', '#ffc9dd'],
    tint: 'rgba(30, 10, 70, 0.16)',
  },
};

const LAYOUTS = ['hero-left', 'hero-right', 'duo'];

/** Panel rectangles for a layout, in fractions of the photo zone. */
function panelRects(layout, zone) {
  const gap = zone.w * 0.018;
  if (layout === 'duo') {
    const half = (zone.w - gap) / 2;
    return [
      { x: zone.x, y: zone.y, w: half, h: zone.h },
      { x: zone.x + half + gap, y: zone.y, w: half, h: zone.h },
    ];
  }
  const heroW = zone.w * 0.6;
  const sideW = zone.w - heroW - gap;
  const sideH = (zone.h - gap) / 2;
  const sideX = layout === 'hero-right' ? zone.x : zone.x + heroW + gap;
  const heroX = layout === 'hero-right' ? zone.x + sideW + gap : zone.x;
  return [
    { x: heroX, y: zone.y, w: heroW, h: zone.h },
    { x: sideX, y: zone.y, w: sideW, h: sideH },
    { x: sideX, y: zone.y + sideH + gap, w: sideW, h: sideH },
  ];
}

/** Draws one photo cover-fit inside a rect, with zoom and pan offsets. */
function drawPhotoInto(ctx, photo, rect, zoom, ox, oy) {
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * base;
  const dh = ih * base;
  const dx = rect.x + (rect.w - dw) / 2 + ox * rect.w * 0.45;
  const dy = rect.y + (rect.h - dh) / 2 + oy * rect.h * 0.45;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.restore();
}

/** A retro sun: a gradient disc with horizontal slits cut through its lower half. */
function drawRetroSun(ctx, cx, cy, r, sunStops, skyGradient) {
  const grad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  sunStops.forEach((c, i) => grad.addColorStop(i / (sunStops.length - 1), c));
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = skyGradient;
  const slits = 5;
  for (let i = 0; i < slits; i++) {
    const y = cy + r * 0.08 + i * r * 0.17;
    const h = r * 0.045 + i * r * 0.012;
    ctx.fillRect(cx - r, y, r * 2, h);
  }
  ctx.restore();
}

/** A stylised palm silhouette: curved trunk and drooping fronds. */
function drawPalm(ctx, x, y, s, flip, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(14, -70, 34, -120);
  ctx.stroke();
  ctx.lineWidth = 7;
  for (let i = 0; i < 6; i++) {
    const a = (-160 + i * 34) * Math.PI / 180;
    const len = 72 - Math.abs(i - 2.5) * 9;
    const tx = 34 + Math.cos(a) * len;
    const ty = -120 + Math.sin(a) * len * 0.55 + 26;
    ctx.beginPath();
    ctx.moveTo(34, -120);
    ctx.quadraticCurveTo(34 + Math.cos(a) * len * 0.6, -120 + Math.sin(a) * len * 0.3 - 14, tx, ty);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws the caption lines centred in the caption zone, auto-fitting the width. */
function drawCaptionText(ctx, lines, zone, size, fillStops, outline) {
  let px = size;
  const measure = (fontPx) => {
    ctx.font = `900 ${fontPx}px NeonDusk, 'Noto Sans Display', sans-serif`;
    return Math.max(...lines.map((l) => ctx.measureText(l).width));
  };
  while (px > 14 && measure(px) > zone.w) px -= 2;
  ctx.font = `900 ${px}px NeonDusk, 'Noto Sans Display', sans-serif`;
  const grad = ctx.createLinearGradient(0, zone.y, 0, zone.y + zone.h);
  fillStops.forEach((c, i) => grad.addColorStop(i / (fillStops.length - 1), c));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(3, px * 0.07);
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = px * 0.16;
  ctx.shadowOffsetY = px * 0.045;
  const total = lines.length * px * 1.04;
  lines.forEach((line, i) => {
    const cy = zone.y + (zone.h - total) / 2 + px * 0.52 + i * px * 1.04;
    ctx.strokeText(line, zone.x + zone.w / 2, cy);
    ctx.fillText(line, zone.x + zone.w / 2, cy);
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  return px;
}

/**
 * Renders the whole cover onto `canvas` at its own size.
 * state: { layout, grade, caption, tagline, captionScale, panels: [{photo, zoom, ox, oy}] }
 * A panel entry holds an HTMLImageElement or null (empty panel).
 */
export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const M = Math.round(W * 0.038);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  grade.sky.forEach((c, i) => sky.addColorStop(i / (grade.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const zone = { x: M, y: M, w: W - 2 * M, h: H * 0.70 - M };
  const stripH = zone.h * 0.17;
  drawRetroSun(ctx, W * 0.5, zone.y + stripH * 0.52, stripH * 0.44, grade.sun, sky);
  const photoZone = { x: zone.x, y: zone.y + stripH, w: zone.w, h: zone.h - stripH };
  const rects = panelRects(state.layout, photoZone);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || {};
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = W * 0.012;
    ctx.shadowOffsetY = W * 0.006;
    ctx.fillStyle = '#12081f';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    if (panel.photo) {
      drawPhotoInto(ctx, panel.photo, rect, panel.zoom || 1, panel.ox || 0, panel.oy || 0);
    } else {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      g.addColorStop(0, '#3a1650');
      g.addColorStop(1, '#12081f');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = `700 ${Math.max(14, W * 0.016)}px NeonDuskBold, 'Noto Sans Display', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });

  const palmScale = Math.min(W, H) * 0.0018;
  drawPalm(ctx, W * 0.015, H * 0.985, palmScale, false, 'rgba(12, 4, 26, 0.9)');
  drawPalm(ctx, W * 0.985, H * 0.985, palmScale * 0.85, true, 'rgba(12, 4, 26, 0.9)');

  const glow = ctx.createRadialGradient(W / 2, H * 0.82, 10, W / 2, H * 0.82, W * 0.42);
  glow.addColorStop(0, 'rgba(255, 180, 90, 0.30)');
  glow.addColorStop(1, 'rgba(255, 180, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, H * 0.68, W, H * 0.30);

  const captionZone = { x: M, y: H * 0.72, w: W - 2 * M, h: H * 0.20 };
  const rawLines = (state.caption || '').toUpperCase().split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 2);
  const lines = rawLines.length ? rawLines : ['NEON DUSK'];
  const base = H * 0.105 * (state.captionScale || 1);
  drawCaptionText(ctx, lines, captionZone, base, grade.caption, '#14082a');

  if (state.tagline && state.tagline.trim()) {
    ctx.font = `700 ${Math.max(14, H * 0.03)}px NeonDuskBold, 'Noto Sans Display', sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, W * 0.004)}px`; } catch (e) { /* older canvas: no letter spacing */ }
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(10, 0, 24, 0.85)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.tagline.trim().toUpperCase(), W / 2, H - M * 0.9);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    try { ctx.letterSpacing = '0px'; } catch (e) { /* ignore */ }
  }

  ctx.fillStyle = grade.tint;
  ctx.fillRect(0, 0, W, H);
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(8, 0, 18, 0)');
  vig.addColorStop(1, 'rgba(8, 0, 18, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

export { GRADES, LAYOUTS };
