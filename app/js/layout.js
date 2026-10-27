// Layout di stampa: replica 1:1 il PDF "Stampa_Cover_iPhone_16_Pro_Max.pdf"
// Tutte le misure sono in millimetri su foglio A4 verticale.

export const PAGE = { w: 210, h: 297 };

// Sagoma (linea di taglio tratteggiata) – identica all'originale
export const CUT = { x: 27.2, y: 73.95, w: 77.6, h: 163.0, r: 12 };

// Guida modulo fotocamere iPhone 16 Pro Max (relativa all'angolo in alto a
// sinistra della sagoma, vista posteriore). Modifica qui se serve affinare il foro.
export const CAMERA = {
  x: 5.2, y: 5.5, w: 38.2, h: 38.7, r: 6.5,
  // cerchi in coordinate frazionarie del modulo (cx, cy, r rispetto alla larghezza)
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
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Compone la grafica della cover (ritagliata nella sagoma) su un canvas a 300 dpi.
 * @param {HTMLImageElement|ImageBitmap} art immagine generata
 * @param {{zoom:number, offX:number, offY:number, camera:boolean, scale?:number}} opts
 *   zoom >= 1, offX/offY in [-1, 1] (spostamento relativo dell'inquadratura)
 */
export function composeCover(art, opts = {}) {
  const { zoom = 1, offX = 0, offY = 0, camera = true, scale = 1 } = opts;
  const k = PX_PER_MM * scale;
  const W = Math.round(CUT.w * k);
  const H = Math.round(CUT.h * k);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  // fondo bianco anche fuori dagli angoli arrotondati (il JPEG non ha trasparenza)
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  roundRectPath(ctx, 0, 0, W, H, CUT.r * k);
  ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // object-fit: cover + zoom + spostamento
  const iw = art.naturalWidth || art.width;
  const ih = art.naturalHeight || art.height;
  const s = Math.max(W / iw, H / ih) * zoom;
  const dw = iw * s, dh = ih * s;
  const dx = (W - dw) / 2 + offX * (dw - W) / 2;
  const dy = (H - dh) / 2 + offY * (dh - H) / 2;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(art, dx, dy, dw, dh);

  if (camera) drawCamera(ctx, k);
  ctx.restore();
  return c;
}

function drawCamera(ctx, k) {
  const x = CAMERA.x * k, y = CAMERA.y * k, w = CAMERA.w * k, h = CAMERA.h * k;
  const lw = Math.max(1, 0.25 * k);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 0.8 * k;
  roundRectPath(ctx, x, y, w, h, CAMERA.r * k);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = lw;
  roundRectPath(ctx, x, y, w, h, CAMERA.r * k);
  ctx.stroke();
  // bordo interno sottile come nell'originale
  const inset = 0.6 * k;
  ctx.lineWidth = lw * 0.6;
  roundRectPath(ctx, x + inset, y + inset, w - 2 * inset, h - 2 * inset, Math.max(0, CAMERA.r * k - inset));
  ctx.stroke();

  for (const hole of CAMERA.holes) {
    const cx = x + hole.cx * w, cy = y + hole.cy * h, r = hole.r * w;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (hole.ring) {
      ctx.lineWidth = lw * 0.6;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Anteprima con linea tratteggiata (solo schermo). */
export function previewCanvas(art, opts) {
  const cover = composeCover(art, { ...opts, scale: 0.5 });
  const k = PX_PER_MM * 0.5;
  const pad = Math.round(3 * k);
  const c = document.createElement('canvas');
  c.width = cover.width + pad * 2;
  c.height = cover.height + pad * 2;
  const ctx = c.getContext('2d');
  ctx.drawImage(cover, pad, pad);
  ctx.setLineDash([1.2 * k, 0.8 * k]);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = Math.max(1, 0.27 * k);
  roundRectPath(ctx, pad, pad, cover.width, cover.height, CUT.r * k);
  ctx.stroke();
  return c;
}

/**
 * Genera il PDF A4 con lo stesso layout dell'originale.
 * @returns {Blob}
 */
export function buildPdf(art, opts) {
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
    [['b', 'NON'], ['n', ' selezionare '], ['i', '"Adatta alla pagina"'], ['n', ' o '], ['i', '"Riduci/Ingrandisci"'], ['n', '.']],
    [['n', 'Ritaglia lungo la linea tratteggiata esterna ed effettua il foro per il modulo fotocamere.']],
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
  const jpg = cover.toDataURL('image/jpeg', 0.93);
  doc.addImage(jpg, 'JPEG', CUT.x, CUT.y, CUT.w, CUT.h, undefined, 'NONE');

  // linea di taglio tratteggiata
  doc.setDrawColor(136, 136, 136);
  doc.setLineWidth(0.27);
  doc.setLineDashPattern([1.2, 0.8], 0);
  doc.roundedRect(CUT.x, CUT.y, CUT.w, CUT.h, CUT.r, CUT.r, 'S');
  doc.setLineDashPattern([], 0);

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
