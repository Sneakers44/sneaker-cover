// Layout di stampa: replica 1:1 il PDF "Stampa_Cover_iPhone_16_Pro_Max.pdf"
// Tutte le misure sono in millimetri su foglio A4 verticale.

export const PAGE = { w: 210, h: 297 };

// Sagoma esterna (linea di taglio tratteggiata) – identica all'originale
export const CUT = { x: 27.2, y: 73.95, w: 77.6, h: 163.0, r: 12 };

// Sagoma foro modulo fotocamere iPhone 16 Pro Max (relativa all'angolo in alto a
// sinistra della sagoma, vista posteriore).
export const CAMERA = {
  x: 5.2, y: 5.5, w: 38.2, h: 38.7, r: 6.5,
  holes: [
    { cx: 0.254, cy: 0.192, r: 0.198, ring: true },  // grandangolo
    { cx: 0.254, cy: 0.752, r: 0.198, ring: true },  // ultra-grandangolo
    { cx: 0.726, cy: 0.476, r: 0.198, ring: true },  // teleobiettivo
    { cx: 0.726, cy: 0.143, r: 0.084 },              // flash
    { cx: 0.726, cy: 0.853, r: 0.084 },              // LiDAR
    { cx: 0.881, cy: 0.762, r: 0.016 },              // microfono
  ],
};

const DPI = 300;
const PX_PER_MM = DPI / 25.4;

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/**
 * Rileva ed elimina eventuali margini chiari/bianchi/grigio-carta (anche texturizzati o con
 * cornice arrotondata e watermark nell'angolo) attorno alla grafica generata dall'AI,
 * così che il disegno riempia al 100% l'altezza e la larghezza della sagoma senza bordi bianchi.
 */
export function getArtworkContentBounds(art) {
  const iw = art.naturalWidth || art.width;
  const ih = art.naturalHeight || art.height;
  const sw = Math.min(iw, 380);
  const sh = Math.max(20, Math.round(ih * (sw / iw)));

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sw;
  sampleCanvas.height = sh;
  const sctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(art, 0, 0, sw, sh);

  const data = sctx.getImageData(0, 0, sw, sh).data;
  const isBlank = (x, y) => {
    const idx = (y * sw + x) * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
    if (a < 25) return true;
    const mn = Math.min(r, g, b);
    const mx = Math.max(r, g, b);
    // Cattura bianco puro, avorio, grigio chiaro e sfondi carta (RGB > 205 e bassa saturazione)
    return mn > 205 && (mx - mn) < 28;
  };

  // Analizza la fascia centrale [30%..70%] per ignorare angoli arrotondati e watermark in basso a destra
  const x0 = Math.floor(sw * 0.30), x1 = Math.ceil(sw * 0.70);
  const y0 = Math.floor(sh * 0.30), y1 = Math.ceil(sh * 0.70);
  const maxY = Math.floor(sh * 0.18);
  const maxX = Math.floor(sw * 0.20);

  const rowBlankRatio = y => {
    let c = 0, n = 0;
    for (let x = x0; x < x1; x++, n++) if (isBlank(x, y)) c++;
    return n ? c / n : 0;
  };
  const colBlankRatio = x => {
    let c = 0, n = 0;
    for (let y = y0; y < y1; y++, n++) if (isBlank(x, y)) c++;
    return n ? c / n : 0;
  };

  let top = 0;
  while (top < maxY && rowBlankRatio(top) > 0.88) top++;
  if (top >= maxY) top = 0; // sfondo volutamente chiaro

  let bottom = sh - 1;
  while ((sh - 1 - bottom) < maxY && rowBlankRatio(bottom) > 0.88) bottom--;
  if ((sh - 1 - bottom) >= maxY) bottom = sh - 1;

  let left = 0;
  while (left < maxX && colBlankRatio(left) > 0.88) left++;
  if (left >= maxX) left = 0;

  let right = sw - 1;
  while ((sw - 1 - right) < maxX && colBlankRatio(right) > 0.88) right--;
  if ((sw - 1 - right) >= maxX) right = sw - 1;

  const trimmed = top > 2 || bottom < sh - 3 || left > 2 || right < sw - 3;
  if (trimmed) {
    // Rientro (2.2%) sui lati rifilati: elimina sia gli aloni anti-aliasing sia eventuali
    // bordini neri/cornici disegnati dall'AI attorno alla sagoma
    if (top > 2) top += Math.max(3, Math.round(sh * 0.022));
    if (bottom < sh - 3) bottom -= Math.max(3, Math.round(sh * 0.022));
    if (left > 2) left += Math.max(3, Math.round(sw * 0.022));
    if (right < sw - 3) right -= Math.max(3, Math.round(sw * 0.022));

    // Verifica che nei 3 angoli visibili della sagoma (escluso alto-sx dove c'è la fotocamera)
    // non restino spicchi bianchi dovuti a eventuali cornici arrotondate disegnate dall'AI
    const cornerPts = [
      [CUT.w - 4.5, 4.5],
      [4.5, CUT.h - 4.5],
      [CUT.w - 4.5, CUT.h - 4.5],
    ];
    for (let iter = 0; iter < 5; iter++) {
      const cw = right - left + 1, ch = bottom - top + 1;
      if (cw < sw * 0.5 || ch < sh * 0.5) break;
      const s = Math.max(CUT.w / cw, CUT.h / ch);
      const dw = cw * s, dh = ch * s;
      const dx = (CUT.w - dw) / 2, dy = (CUT.h - dh) / 2;
      let hasCornerWhite = false;
      for (const [mx, my] of cornerPts) {
        const px = Math.round(left + (mx - dx) / s);
        const py = Math.round(top + (my - dy) / s);
        if (px >= 0 && px < sw && py >= 0 && py < sh && isBlank(px, py)) {
          hasCornerWhite = true;
          break;
        }
      }
      if (!hasCornerWhite) break;
      const nx = Math.max(1, Math.round(cw * 0.008));
      const ny = Math.max(1, Math.round(ch * 0.008));
      left += nx; right -= nx; top += ny; bottom -= ny;
    }
  }

  const scaleX = iw / sw;
  const scaleY = ih / sh;
  return {
    sx: Math.round(left * scaleX),
    sy: Math.round(top * scaleY),
    sw: Math.max(1, Math.round((right - left + 1) * scaleX)),
    sh: Math.max(1, Math.round((bottom - top + 1) * scaleY)),
  };
}

/**
 * Compone la grafica della cover (ritagliata nella sagoma) su un canvas a 300 dpi.
 * @param {HTMLImageElement|ImageBitmap} art immagine generata
 * @param {{zoom:number, offX:number, offY:number, camera:boolean, autoTrim?:boolean, scale?:number}} opts
 */
export function composeCover(art, opts = {}) {
  const { zoom = 1, offX = 0, offY = 0, camera = true, autoTrim = true, scale = 1 } = opts;
  const k = PX_PER_MM * scale;
  const W = Math.round(CUT.w * k);
  const H = Math.round(CUT.h * k);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Fondo bianco fuori dagli angoli arrotondati (il JPEG nel PDF non ha canale alfa)
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  roundRectPath(ctx, 0, 0, W, H, CUT.r * k);
  ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // Rileva e rimuove eventuali margini chiari lasciati dall'AI
  let bounds = { sx: 0, sy: 0, sw: art.naturalWidth || art.width, sh: art.naturalHeight || art.height };
  if (autoTrim) {
    try {
      bounds = getArtworkContentBounds(art);
    } catch {
      // fallback a dimensioni piene
    }
  }

  // object-fit: cover perfetto (riempie sia larghezza che altezza al 100% senza bande bianche)
  const s = Math.max(W / bounds.sw, H / bounds.sh) * zoom;
  const dw = bounds.sw * s;
  const dh = bounds.sh * s;
  const dx = (W - dw) / 2 + offX * (dw - W) / 2;
  const dy = (H - dh) / 2 + offY * (dh - H) / 2;

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(art, bounds.sx, bounds.sy, bounds.sw, bounds.sh, dx, dy, dw, dh);

  if (camera) drawCameraInterior(ctx, k);
  ctx.restore();
  return c;
}

/**
 * Disegna l'area interna di scarto del modulo fotocamere con 1.4 mm di abbondanza (bleed) interna:
 * la grafica prosegue per 1.4 mm dentro la linea tratteggiata così che ritagliando lungo il tratteggio
 * non rimanga alcun bordino bianco attorno al foro fotocamere.
 */
function drawCameraInterior(ctx, k) {
  const bleed = 1.4 * k; // 1.4 mm di abbondanza colore dentro la linea di taglio
  const x = CAMERA.x * k + bleed;
  const y = CAMERA.y * k + bleed;
  const w = CAMERA.w * k - bleed * 2;
  const h = CAMERA.h * k - bleed * 2;
  const r = Math.max(1, CAMERA.r * k - bleed);

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fill();

  // Riferimento leggero lenti interne (solo orientamento visivo nella parte da eliminare)
  const ox = CAMERA.x * k, oy = CAMERA.y * k, ow = CAMERA.w * k, oh = CAMERA.h * k;
  ctx.strokeStyle = '#c4c7ce';
  ctx.lineWidth = Math.max(1, 0.2 * k);
  for (const hole of CAMERA.holes) {
    const cx = ox + hole.cx * ow, cy = oy + hole.cy * oh, hr = hole.r * ow;
    ctx.beginPath(); ctx.arc(cx, cy, hr, 0, Math.PI * 2); ctx.stroke();
  }

  // Etichetta chiara "RITAGLIA" al centro della parte da rimuovere
  ctx.fillStyle = '#555';
  ctx.font = `bold ${Math.round(2.7 * k)}px -apple-system, Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✂ RITAGLIA FORO', x + w / 2, y + h / 2);
  ctx.restore();
}

/** Disegna su canvas la linea tratteggiata ad alto contrasto del foro fotocamere (per anteprima). */
function strokeCameraCutLineCanvas(ctx, offsetX, offsetY, k) {
  const x = offsetX + CAMERA.x * k;
  const y = offsetY + CAMERA.y * k;
  const w = CAMERA.w * k;
  const h = CAMERA.h * k;
  const r = CAMERA.r * k;

  ctx.save();
  // Traccia bianca sottile di contrasto per renderla ben visibile anche su sfondi neri/scuri
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = Math.max(1.5, 0.75 * k);
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();

  // Linea tratteggiata scura di taglio (identica per stile al bordo esterno)
  ctx.setLineDash([1.5 * k, 1.0 * k]);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = Math.max(1, 0.35 * k);
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

/** Anteprima con linee tratteggiate di ritaglio (esterna + foro fotocamere). */
export function previewCanvas(art, opts = {}) {
  const { camera = true } = opts;
  const cover = composeCover(art, { ...opts, scale: 0.5 });
  const k = PX_PER_MM * 0.5;
  const pad = Math.round(3 * k);
  const c = document.createElement('canvas');
  c.width = cover.width + pad * 2;
  c.height = cover.height + pad * 2;
  const ctx = c.getContext('2d');
  ctx.drawImage(cover, pad, pad);

  // Linea tratteggiata esterna
  ctx.save();
  ctx.setLineDash([1.5 * k, 1.0 * k]);
  ctx.strokeStyle = '#777';
  ctx.lineWidth = Math.max(1, 0.32 * k);
  roundRectPath(ctx, pad, pad, cover.width, cover.height, CUT.r * k);
  ctx.stroke();
  ctx.restore();

  // Linea tratteggiata foro fotocamere
  if (camera) {
    strokeCameraCutLineCanvas(ctx, pad, pad, k);
  }
  return c;
}

/**
 * Genera il PDF A4 con lo stesso layout dell'originale + linea tratteggiata per il foro fotocamere.
 * @returns {Blob}
 */
export function buildPdf(art, opts = {}) {
  const { camera = true } = opts;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: 'Stampa Custodia iPhone 16 Pro Max', creator: 'Sneaker Cover' });

  // --- Intestazione
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(17, 17, 17);
  doc.text('SAGOMA DI STAMPA - IPHONE 16 PRO MAX', PAGE.w / 2, 19.1, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(85, 85, 85);
  doc.text(opts.subtitle || 'Design personalizzato abbinato alle tue scarpe', PAGE.w / 2, 24.3, { align: 'center' });
  doc.setDrawColor(34, 34, 34);
  doc.setLineWidth(0.53);
  doc.line(15, 27.6, 195, 27.6);

  // --- Box istruzioni
  doc.setFillColor(244, 245, 247);
  doc.roundedRect(20, 31.05, 170, 33.64, 1.6, 1.6, 'F');
  doc.setFillColor(243, 107, 33);
  doc.rect(20, 31.05, 1.06, 33.64, 'F');

  // icona di avviso (triangolo)
  doc.setFillColor(253, 196, 0);
  doc.triangle(24.9, 37.6, 26.85, 34.2, 28.8, 37.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(34, 34, 34);
  doc.text('!', 26.85, 37.2, { align: 'center' });

  const fs = 9.5;
  doc.setFontSize(fs);
  doc.text('Istruzioni fondamentali per la stampa corretta:', 29.5, 37.15);

  const bullets = [
    [['n', 'Nella finestra della stampante, seleziona '], ['b', '"Dimensioni reali"'], ['n', ' oppure '], ['b', '"Scala 100%"'], ['n', '.']],
    [['b', 'NON'], ['n', ' selezionare '], ['i', '"Adatta alla pagina"'], ['n', '  o '], ['i', '"Riduci/Ingrandisci"'], ['n', '.']],
    [['n', 'Ritaglia lungo le due linee tratteggiate: il contorno esterno e il foro modulo fotocamere.']],
    [['n', "Inserisci il foglio all'interno della tua custodia trasparente."]],
  ];
  const ys = [42.9, 48.7, 54.2, 59.7];
  const styleMap = { n: 'normal', b: 'bold', i: 'italic' };
  bullets.forEach((runs, i) => {
    let x = 29.53;
    doc.setFont('helvetica', 'normal');
    doc.text('\u2022', 28.3, ys[i], { align: 'center' });
    for (const [st, txt] of runs) {
      doc.setFont('helvetica', styleMap[st]);
      doc.text(txt, x, ys[i]);
      x += doc.getTextWidth(txt);
    }
  });

  // --- Grafica cover nella sagoma
  const cover = composeCover(art, opts);
  const jpg = cover.toDataURL('image/jpeg', 0.94);
  doc.addImage(jpg, 'JPEG', CUT.x, CUT.y, CUT.w, CUT.h, undefined, 'NONE');

  // --- Linea di taglio tratteggiata esterna
  doc.setDrawColor(95, 95, 95);
  doc.setLineWidth(0.32);
  doc.setLineDashPattern([1.5, 1.0], 0);
  doc.roundedRect(CUT.x, CUT.y, CUT.w, CUT.h, CUT.r, CUT.r, 'S');
  doc.setLineDashPattern([], 0);

  // --- Linea di taglio tratteggiata per il foro modulo fotocamere (vettoriale ad alto contrasto)
  if (camera) {
    const cx = CUT.x + CAMERA.x;
    const cy = CUT.y + CAMERA.y;
    // Traccia bianca sottostante per visibilità perfetta anche su grafiche scure/nere
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.75);
    doc.setLineDashPattern([], 0);
    doc.roundedRect(cx, cy, CAMERA.w, CAMERA.h, CAMERA.r, CAMERA.r, 'S');

    // Tratteggio scuro nitido sopra la traccia bianca
    doc.setDrawColor(34, 34, 34);
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([1.5, 1.0], 0);
    doc.roundedRect(cx, cy, CAMERA.w, CAMERA.h, CAMERA.r, CAMERA.r, 'S');
    doc.setLineDashPattern([], 0);
  }

  // --- Test di scala 5 cm
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(68, 68, 68);
  doc.text('Test di controllo scala (deve misurare esattamente 5 cm):', 106.25, 240.9);
  const rx = 119.65, ry = 243.01, rw = 50, rh = 10;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(rx, ry + rh, rx + rw, ry + rh);
  for (let mm = 0; mm <= 50; mm += 5) {
    const full = mm % 10 === 0;
    doc.setLineWidth(full ? 0.4 : 0.25);
    doc.line(rx + mm, full ? ry : ry + rh * 0.4, rx + mm, ry + rh);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  for (let cm = 0; cm <= 5; cm++) doc.text(String(cm), rx + cm * 10 + 0.8, ry + 2.6);

  // --- Piè di pagina
  doc.setFontSize(8);
  doc.setTextColor(170, 170, 170);
  doc.text('Dimensioni sagoma: 77.6 mm \u00d7 163.0 mm | Compatibile con iPhone 16 Pro Max',
    PAGE.w / 2, 259.5, { align: 'center' });

  return doc.output('blob');
}
