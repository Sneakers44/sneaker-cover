// Client minimale per la Gemini API (generazione immagini)
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const DEFAULT_MODEL = 'gemini-2.5-flash-image';

export const STYLES = {
  pop: {
    label: 'Graphic pop (come il PDF originale)',
    prompt: `Bold flat graphic illustration reinterpreting the sneaker's design: large color-blocked shapes
that follow the shoe's panels, overlays and swooshes, with realistic material textures (suede nap, leather,
mesh) and visible stitching lines, thick dark outlines. In the center (slightly below the middle) place a
circular MagSafe-style emblem: a thick white ring split into quadrants filled with the shoe colors and a
subtle halftone/checker pattern, the shoe brand logo in a small white circle at its core, and a short
vertical white stem going down from the ring holding a small barcode label with tiny text
"DESIGNED TO PRINT".`,
  },
  texture: {
    label: 'Texture materiali (macro)',
    prompt: `Abstract macro close-up composition of the sneaker's materials: suede, leather, mesh, laces,
stitching and sole texture, arranged as an elegant artistic collage with the exact color palette of the shoe.
Rich tactile detail, soft studio lighting.`,
  },
  minimal: {
    label: 'Minimal geometrico',
    prompt: `Minimalist modern geometric poster: a few clean flat shapes and lines inspired by the sneaker's
silhouette and color blocking, generous negative space using the shoe's dominant base color, small discreet
brand logo near the bottom.`,
  },
  street: {
    label: 'Street art / graffiti',
    prompt: `Vibrant street-art graffiti wall artwork inspired by the sneaker: spray paint textures, drips,
stencil shapes of the shoe, tags and stickers, strictly using the shoe's color palette.`,
  },
};

export function buildPrompt(styleKey, extra) {
  const style = STYLES[styleKey] || STYLES.pop;
  return `You are designing a printable artwork insert for a clear iPhone 16 Pro Max case.
Use the attached photo of my sneakers as the ONLY source of inspiration: match their exact colors,
materials, patterns and branding so the phone case pairs perfectly with the shoes.

STYLE:
${style.prompt}

STRICT LAYOUT RULES:
- Vertical portrait artwork, full-bleed edge to edge, filling the whole canvas.
- Do NOT draw a phone, a phone outline, a case, device frame, camera module, lenses, borders, white margins or mockup.
- The top-left area (about the top 28% height x left 55% width) will be covered by the camera cutout:
  keep logos, faces and important details out of that zone (only background pattern there).
- Keep the main focal element centered horizontally; avoid important details within 5% of the left/right edges.
- No text other than what the style asks for. High resolution, crisp, print quality.
${extra ? `\nADDITIONAL REQUESTS FROM THE USER:\n${extra}\n` : ''}`;
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
