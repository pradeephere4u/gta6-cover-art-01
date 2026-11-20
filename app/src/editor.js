// Neon Dusk Cover Studio: wires the editor page. Own code: the state lives here,
// the canvas in poster.js only draws. Photos are read on this machine and never
// uploaded; the export is a real PNG the canvas writes.

import { renderCover, GRADES, LAYOUTS } from './poster.js';

const SIZES = {
  square: { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

const SAMPLES = ['boulevard', 'pier'];

const state = {
  layout: 'hero-left',
  grade: 'sunset',
  size: 'square',
  caption: 'Vice Nights',
  tagline: 'A Leonida story',
  captionScale: 1,
  panels: [
    { photo: null, zoom: 1, ox: 0, oy: 0 },
    { photo: null, zoom: 1, ox: 0, oy: 0 },
    { photo: null, zoom: 1, ox: 0, oy: 0 },
  ],
};

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
let fontsReady = false;

function setStatus(text) {
  statusEl.textContent = text;
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function currentSize() {
  return SIZES[state.size];
}

function redraw() {
  const size = currentSize();
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  renderCover(canvas, {
    layout: state.layout,
    grade: state.grade,
    caption: state.caption,
    tagline: state.tagline,
    captionScale: state.captionScale,
    panels: state.panels,
  });
}

function visiblePanelCount() {
  return state.layout === 'duo' ? 2 : 3;
}

function refreshPanelSlots() {
  const count = visiblePanelCount();
  document.querySelectorAll('.slot').forEach((slot, i) => {
    slot.classList.toggle('slot-off', i >= count);
  });
}

function refreshButtons(group, value) {
  document.querySelectorAll(`[data-group="${group}"]`).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

function refreshAll() {
  refreshButtons('size', state.size);
  refreshButtons('layout', state.layout);
  refreshButtons('grade', state.grade);
  refreshPanelSlots();
  redraw();
}

async function loadSampleInto(index, name) {
  try {
    state.panels[index].photo = await loadImage(`samples/${name}.jpg`);
    setStatus(`Loaded sample photo ${name} into panel ${index + 1}.`);
    redraw();
  } catch (e) {
    setStatus(`Sample photo ${name} did not load.`);
  }
}

async function loadFileInto(index, file) {
  if (!file) return;
  try {
    state.panels[index].photo = await loadImage(URL.createObjectURL(file));
    setStatus(`Loaded ${file.name} into panel ${index + 1}.`);
    redraw();
  } catch (e) {
    setStatus(`That file did not load as a photo.`);
  }
}

async function fillAllFromFile(file) {
  if (!file) return;
  try {
    const photo = await loadImage(URL.createObjectURL(file));
    state.panels.forEach((panel) => { panel.photo = photo; });
    setStatus(`One photo now fills every panel.`);
    redraw();
  } catch (e) {
    setStatus(`That file did not load as a photo.`);
  }
}

/** Renders the cover at full export size and returns a PNG data URL. */
export async function exportPNG(sizeKey) {
  const key = sizeKey || state.size;
  const size = SIZES[key];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  renderCover(off, {
    layout: state.layout,
    grade: state.grade,
    caption: state.caption,
    tagline: state.tagline,
    captionScale: state.captionScale,
    panels: state.panels,
  });
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

function downloadExport() {
  const size = currentSize();
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  renderCover(off, {
    layout: state.layout,
    grade: state.grade,
    caption: state.caption,
    tagline: state.tagline,
    captionScale: state.captionScale,
    panels: state.panels,
  });
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-dusk-cover-${size.w}x${size.h}.png`;
    a.click();
    setStatus(`Saved neon-dusk-cover-${size.w}x${size.h}.png`);
  }, 'image/png');
}

/** Fixed scenes for screenshots: ?scene=editor shows the page with photos loaded;
 *  ?scene=cover shows the cover alone. Extra query keys: layout, grade, size,
 *  caption, tagline, photo (sample for every panel), photo1/2/3 (per panel).
 *  window.__shotReady is set once the scene is painted. */
async function runScene(query) {
  const scene = query.get('scene') || 'editor';
  if (SIZES[query.get('size')]) state.size = query.get('size');
  if (LAYOUTS.includes(query.get('layout'))) state.layout = query.get('layout');
  if (GRADES[query.get('grade')]) state.grade = query.get('grade');
  if (query.get('caption') !== null) state.caption = query.get('caption');
  if (query.get('tagline') !== null) state.tagline = query.get('tagline');
  const photo = query.get('photo');
  for (let i = 0; i < 3; i++) {
    const name = query.get(`photo${i + 1}`) || photo || SAMPLES[i % SAMPLES.length];
    try {
      state.panels[i].photo = await loadImage(`samples/${name}.jpg`);
    } catch (e) { /* leave the panel empty */ }
  }
  document.getElementById('caption').value = state.caption;
  document.getElementById('tagline').value = state.tagline;
  if (scene === 'cover') document.body.classList.add('scene-cover');
  refreshAll();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

function wireControls() {
  document.querySelectorAll('[data-group]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      if (group === 'size') state.size = btn.dataset.value;
      if (group === 'layout') state.layout = btn.dataset.value;
      if (group === 'grade') state.grade = btn.dataset.value;
      refreshAll();
    });
  });

  document.querySelectorAll('.slot').forEach((slot, i) => {
    const fileInput = slot.querySelector('input[type="file"]');
    fileInput.addEventListener('change', (e) => loadFileInto(i, e.target.files[0]));
    slot.querySelector('.sample-btn').addEventListener('click', () => {
      loadSampleInto(i, SAMPLES[i % SAMPLES.length]);
    });
    slot.querySelector('.zoom').addEventListener('input', (e) => {
      state.panels[i].zoom = parseFloat(e.target.value);
      redraw();
    });
    slot.querySelector('.panx').addEventListener('input', (e) => {
      state.panels[i].ox = parseFloat(e.target.value);
      redraw();
    });
    slot.querySelector('.pany').addEventListener('input', (e) => {
      state.panels[i].oy = parseFloat(e.target.value);
      redraw();
    });
  });

  document.getElementById('fill-all').addEventListener('change', (e) => {
    fillAllFromFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('caption').addEventListener('input', (e) => {
    state.caption = e.target.value;
    redraw();
  });
  document.getElementById('tagline').addEventListener('input', (e) => {
    state.tagline = e.target.value;
    redraw();
  });
  document.getElementById('caption-scale').addEventListener('input', (e) => {
    state.captionScale = parseFloat(e.target.value);
    redraw();
  });
  document.getElementById('export').addEventListener('click', downloadExport);
}

async function start() {
  try {
    await Promise.all([
      document.fonts.load('900 100px NeonDusk'),
      document.fonts.load('700 40px NeonDuskBold'),
      document.fonts.ready,
    ]);
    fontsReady = true;
  } catch (e) {
    fontsReady = false;
  }
  wireControls();
  const query = new URLSearchParams(location.search);
  if (query.get('scene')) {
    await runScene(query);
  } else {
    refreshAll();
  }
}

window.__studio = { exportPNG, get state() { return state; } };

start();
