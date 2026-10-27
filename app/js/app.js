import { STYLES, DEFAULT_MODEL, buildPrompt, generateCover, listImageModels } from './gemini.js';
import { previewCanvas, buildPdf } from './layout.js';
import { saveCover, listCovers, deleteCover } from './storage.js';

const $ = id => document.getElementById(id);
const LS = {
  get key() { return localStorage.getItem('gemini_key') || ''; },
  set key(v) { localStorage.setItem('gemini_key', v); },
  get model() { return localStorage.getItem('gemini_model') || DEFAULT_MODEL; },
  set model(v) { localStorage.setItem('gemini_model', v); },
  get models() { try { return JSON.parse(localStorage.getItem('gemini_models')) || []; } catch { return []; } },
  set models(v) { localStorage.setItem('gemini_models', JSON.stringify(v)); },
  get subtitle() { return localStorage.getItem('pdf_subtitle') || ''; },
  set subtitle(v) { localStorage.setItem('pdf_subtitle', v); },
};

const state = {
  photo: null,       // { mime, base64, url }
  style: 'pop',
  art: null,         // HTMLImageElement
  artDataUrl: null,
  pdfUrl: null,
  pdfBlob: null,
  abort: null,
};

// ---------- UI helpers
function toast(msg, isError = false, ms = 3500) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), isError ? Math.max(ms, 7000) : ms);
}
function loading(on, text) {
  $('loading').classList.toggle('hidden', !on);
  if (text) $('loadingText').textContent = text;
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Immagine non leggibile'));
    img.src = src;
  });
}

/** Ridimensiona la foto (max 1600px) e la converte in JPEG base64. */
async function prepPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const max = 1600;
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.9);
    return { mime: 'image/jpeg', base64: dataUrl.split(',')[1], url: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Step 1: foto
async function onPhoto(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    state.photo = await prepPhoto(file);
    $('photoPreview').src = state.photo.url;
    $('photoBox').classList.remove('empty');
    $('btnGenerate').disabled = false;
    $('step2').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------- Step 2: stile + generazione
function renderChips() {
  const box = $('styleChips');
  box.innerHTML = '';
  for (const [key, s] of Object.entries(STYLES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (key === state.style ? ' active' : '');
    b.textContent = s.label;
    b.onclick = () => { state.style = key; renderChips(); };
    box.appendChild(b);
  }
}

async function generate() {
  if (!state.photo) return toast('Prima scatta o scegli una foto delle sneakers.', true);
  if (!LS.key) { openSettings(); return toast('Inserisci la tua chiave API Gemini.', true); }

  state.abort = new AbortController();
  loading(true, 'Gemini sta disegnando la tua cover…\n(di solito 10–40 secondi)');
  try {
    const out = await generateCover({
      apiKey: LS.key,
      model: LS.model,
      photo: state.photo,
      prompt: buildPrompt(state.style, $('extra').value.trim()),
      signal: state.abort.signal,
    });
    const dataUrl = `data:${out.mime};base64,${out.base64}`;
    await setArt(dataUrl, true);
    toast('Cover pronta! Regola l\'inquadratura e crea il PDF.');
  } catch (err) {
    if (err.name !== 'AbortError') toast(err.message, true);
  } finally {
    loading(false);
    state.abort = null;
  }
}

async function onArtUpload(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setArt(reader.result, true).catch(err => toast(err.message, true));
  reader.readAsDataURL(file);
}

// ---------- Step 3: anteprima + PDF
async function setArt(dataUrl, persist) {
  state.art = await loadImage(dataUrl);
  state.artDataUrl = dataUrl;
  $('zoom').value = 1; $('offX').value = 0; $('offY').value = 0;
  resetPdf();
  $('step3').classList.remove('hidden');
  renderPreview();
  $('step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (persist) {
    await saveCover({ id: crypto.randomUUID?.() || String(Date.now()), created: Date.now(), art: dataUrl, style: state.style });
    renderHistory();
  }
}

function layoutOpts() {
  return {
    zoom: +$('zoom').value,
    offX: +$('offX').value,
    offY: +$('offY').value,
    camera: $('camGuide').checked,
    subtitle: LS.subtitle || undefined,
  };
}

let rafId = 0;
function renderPreview() {
  if (!state.art) return;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    const c = previewCanvas(state.art, layoutOpts());
    const box = $('preview');
    box.innerHTML = '';
    box.appendChild(c);
  });
}

function resetPdf() {
  if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
  state.pdfUrl = null; state.pdfBlob = null;
  $('pdfActions').classList.add('hidden');
}

function makePdf() {
  if (!state.art) return;
  loading(true, 'Creo il PDF di stampa…');
  // lascia ridisegnare l'overlay prima del lavoro pesante
  setTimeout(() => {
    try {
      resetPdf();
      state.pdfBlob = buildPdf(state.art, layoutOpts());
      state.pdfUrl = URL.createObjectURL(state.pdfBlob);
      $('btnDownload').href = state.pdfUrl;
      $('pdfActions').classList.remove('hidden');
      toast('PDF pronto: condividilo verso "Stampa" oppure scaricalo.');
    } catch (err) {
      toast('Errore nella creazione del PDF: ' + err.message, true);
    } finally {
      loading(false);
    }
  }, 50);
}

async function sharePdf() {
  if (!state.pdfBlob) return;
  const file = new File([state.pdfBlob], 'Stampa_Cover_iPhone_16_Pro_Max.pdf', { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Cover iPhone 16 Pro Max' });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  // fallback: apre il PDF (da lì Stampa / Condividi)
  window.open(state.pdfUrl, '_blank');
}

// ---------- Storico
async function renderHistory() {
  const box = $('history');
  let items = [];
  try { items = await listCovers(); } catch { /* IndexedDB non disponibile */ }
  if (!items.length) {
    box.innerHTML = '<p class="hint">Le cover generate compariranno qui.</p>';
    return;
  }
  box.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('div');
    b.className = 'item';
    b.innerHTML = `<img alt="" loading="lazy"><button class="del" aria-label="Elimina">✕</button>`;
    b.querySelector('img').src = it.art;
    b.querySelector('img').onclick = () => setArt(it.art, false);
    b.querySelector('.del').onclick = async ev => {
      ev.stopPropagation();
      if (!confirm('Eliminare questa cover dallo storico?')) return;
      await deleteCover(it.id);
      renderHistory();
    };
    box.appendChild(b);
  }
}

// ---------- Impostazioni
function fillModelSelect() {
  const sel = $('modelSelect');
  const known = [
    { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (Nano Banana)' },
    { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (Nano Banana Pro)' },
    ...LS.models,
  ];
  const seen = new Set();
  sel.innerHTML = '';
  for (const m of known) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const o = document.createElement('option');
    o.value = m.id; o.textContent = `${m.label} — ${m.id}`;
    sel.appendChild(o);
  }
  if (seen.has(LS.model)) { sel.value = LS.model; $('modelCustom').value = ''; }
  else $('modelCustom').value = LS.model;
}

function openSettings() {
  $('apiKey').value = LS.key;
  $('subtitle').value = LS.subtitle;
  fillModelSelect();
  $('settings').showModal();
}

async function loadModels() {
  const key = $('apiKey').value.trim();
  if (!key) return toast('Inserisci prima la chiave API.', true);
  try {
    const models = await listImageModels(key);
    if (!models.length) return toast('Nessun modello immagini trovato per questa chiave.', true);
    LS.models = models;
    fillModelSelect();
    $('modelSelect').value = models[0].id;
    toast(`${models.length} modelli trovati.`);
  } catch (err) {
    toast(err.message, true);
  }
}

function saveSettings() {
  LS.key = $('apiKey').value.trim();
  LS.model = $('modelCustom').value.trim() || $('modelSelect').value || DEFAULT_MODEL;
  LS.subtitle = $('subtitle').value.trim();
  toast('Impostazioni salvate.');
}

// ---------- Avvio
function init() {
  renderChips();
  renderHistory();
  $('inCamera').addEventListener('change', onPhoto);
  $('inGallery').addEventListener('change', onPhoto);
  $('inArt').addEventListener('change', onArtUpload);
  $('btnGenerate').addEventListener('click', generate);
  $('btnRegenerate').addEventListener('click', generate);
  $('btnPdf').addEventListener('click', makePdf);
  $('btnShare').addEventListener('click', sharePdf);
  $('btnCancel').addEventListener('click', () => state.abort?.abort());
  for (const id of ['zoom', 'offX', 'offY', 'camGuide']) {
    $(id).addEventListener('input', () => { resetPdf(); renderPreview(); });
  }
  $('btnSettings').addEventListener('click', openSettings);
  $('btnLoadModels').addEventListener('click', loadModels);
  $('btnSaveSettings').addEventListener('click', saveSettings);

  if (!LS.key) setTimeout(() => toast('Benvenuto! Apri ⚙️ e inserisci la tua chiave API Gemini.', false, 5000), 600);

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
