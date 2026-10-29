// Client minimale per la Gemini API (generazione immagini)
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const DEFAULT_MODEL = 'gemini-2.5-flash-image';

export const STYLES = {
  pop: {
    label: 'Graphic pop (come il PDF originale)',
    prompt: `Bold flat graphic pop-art illustration reinterpreting the sneaker's design: large dynamic
color-blocked shapes inspired by the shoe's panels, overlays, stripes or swooshes, with rich tactile textures
(suede nap, leather grain, mesh weave) and crisp stitching lines, outlined in bold dark ink, extending
continuously past all four edges of the image. Slightly below the vertical center, place a bold circular
geometric badge: a thick white ring divided into quadrants filled with the shoe's colors and subtle
halftone/checker dots, with the sneaker brand logo centered in a small inner circle, and a short vertical
white tag below it featuring a tiny barcode and "DESIGNED TO PRINT".`,
  },
  texture: {
    label: 'Texture materiali (macro)',
    prompt: `Seamless full-frame macro artistic collage of the sneaker's materials: suede, leather, mesh,
laces, stitching and sole pattern, arranged edge-to-edge with the exact color palette of the shoe.
Rich tactile detail, studio lighting, filling the entire frame to all four corners.`,
  },
  minimal: {
    label: 'Minimal geometrico',
    prompt: `Minimalist modern geometric full-bleed poster: clean flat shapes and dynamic curves inspired by
the sneaker's silhouette and color blocking on a solid colored background taken from the shoe's palette,
with a small discreet brand logo in the lower half, filling 100% of the canvas edge to edge.`,
  },
  street: {
    label: 'Street art / graffiti',
    prompt: `Vibrant edge-to-edge street-art mural inspired by the sneaker: spray paint textures, drips,
stencil shapes and graphic tags strictly using the shoe's color palette, covering 100% of the wall from
corner to corner with no borders.`,
  },
};

export function buildPrompt(styleKey, extra) {
  const style = STYLES[styleKey] || STYLES.pop;
  return `Create a vertical 9:16 full-bleed rectangular graphic wallpaper artwork inspired ONLY by the sneakers
in the attached photo: match their exact colors, materials, textures, patterns and brand logo.

STYLE:
${style.prompt}

STRICT FULL-BLEED COMPOSITION RULES (CRITICAL):
- Fill 100% of the rectangular 9:16 canvas all the way into all four corners from top edge to bottom edge and left edge to right edge.
- ZERO margins, ZERO white or light-grey borders, ZERO framing, ZERO rounded corners, ZERO card/sticker/device/case outline. Colored artwork and background textures MUST touch every single pixel of the top, bottom, left and right edges.
- Keep the top-left quadrant (top 28% height x left 55% width) strictly as continuous colored background pattern without logos or focal details.
- Keep main focal elements horizontally centered in the middle/lower area. Crisp high-resolution print quality.
${extra ? `\nADDITIONAL USER INSTRUCTIONS:\n${extra}\n` : ''}`;
}

/** Elenca i modelli disponibili per la chiave che supportano la generazione di immagini. */
export async function listImageModels(apiKey) {
  const res = await fetch(`${BASE}/models?pageSize=1000&key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new Error(await errorText(res));
  const data = await res.json();
  return (data.models || [])
    .filter(m => /image/i.test(m.name) && !/imagen/i.test(m.name)
      && (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }));
}

/**
 * Genera l'immagine della cover a partire dalla foto delle sneakers.
 * @param {{apiKey:string, model:string, photo:{mime:string, base64:string}, prompt:string}} p
 * @returns {Promise<{mime:string, base64:string, text?:string}>}
 */
export async function generateCover({ apiKey, model, photo, prompt, signal }) {
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: photo.mime, data: photo.base64 } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: '9:16' },
    },
  };
  const url = `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(await errorText(res));
  const data = await res.json();

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Richiesta bloccata dal filtro di sicurezza (${data.promptFeedback.blockReason}).`);
  }
  const cand = data.candidates?.[0];
  const parts = cand?.content?.parts || [];
  const img = parts.find(p => p.inlineData || p.inline_data);
  const text = parts.filter(p => p.text).map(p => p.text).join('\n');
  if (!img) {
    throw new Error(`Il modello non ha restituito un'immagine${cand?.finishReason ? ` (${cand.finishReason})` : ''}.`
      + (text ? `\nRisposta: ${text.slice(0, 300)}` : ''));
  }
  const d = img.inlineData || img.inline_data;
  return { mime: d.mimeType || d.mime_type || 'image/png', base64: d.data, text };
}

async function errorText(res) {
  try {
    const j = await res.json();
    const msg = j.error?.message || JSON.stringify(j);
    if (res.status === 400 && /API key/i.test(msg)) return 'Chiave API non valida. Controlla le impostazioni.';
    if (res.status === 404) return `Modello non trovato: scegline un altro nelle impostazioni. (${msg})`;
    if (res.status === 429) return 'Limite di richieste raggiunto (quota). Riprova tra poco o verifica il piano della chiave.';
    return `Errore ${res.status}: ${msg}`;
  } catch {
    return `Errore ${res.status} ${res.statusText}`;
  }
}
