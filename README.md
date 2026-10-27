# Sneaker Cover 👟📱

Un'applicazione web (PWA) progettata per creare e stampare in automatico le cover in carta abbinate alle tue sneakers per **iPhone 16 Pro Max**, replicando al 100% le misure e il layout del file `Stampa_Cover_iPhone_16_Pro_Max.pdf`.

---

## 🎯 Caratteristiche

1. **Scatto o Selezione Foto**: Scatta una foto delle tue scarpe direttamente dal telefono o selezionala dalla galleria.
2. **Generazione AI con Gemini**:
   - Stile predefinito **Graphic pop** ispirato alla grafica del PDF originale (linee pulite, blocchi di colore, badge stile MagSafe con logo della marca e barcode).
   - Stili alternativi: **Texture materiali**, **Minimal geometrico**, **Street art**.
   - Input opzionale per personalizzazioni testuali aggiuntive.
3. **Misure e Taglio al Millimetro (iPhone 16 Pro Max)**:
   - Foglio A4 a scala reale 100%.
   - Sagoma: **77.6 mm × 163.0 mm** con raggio d'angolo di 12 mm.
   - Posizione precisa della fotocamera: offset di 5.2 mm x 5.5 mm con guida per il taglio delle lenti, flash, LiDAR e microfono.
   - Righello di verifica a 5 cm per controllare la calibrazione della stampante.
4. **Regolazione Inquadratura**: Zoom e pan orizzontale/verticale prima di stampare.
5. **Storico Locale**: Salva le ultime cover generate direttamente sul browser (IndexedDB).
6. **PWA (Progressive Web App)**: Installabile sulla schermata Home dell'iPhone ("Aggiungi a schermata Home").

---

## 🚀 Come avviarla

### Opzione 1: Doppio clic o terminale su Mac

Esegui il file `start.sh` nella cartella:

```bash
cd /Users/francobiasi/Library/CloudStorage/OneDrive-Samsonite/Desktop/cover
./start.sh
```

Ti mostrerà:
- L'indirizzo da aprire su Mac: `http://localhost:8765`
- L'indirizzo da aprire su iPhone (collegato alla stessa rete Wi-Fi del Mac): `http://<IL_TUO_IP>:8765`

---

## 🔑 Configurazione Chiave API Gemini

Alla prima apertura:
1. Clicca sull'icona delle impostazioni ⚙️ in alto a destra.
2. Inserisci la tua **Gemini API Key** (puoi ottenerla gratis da [Google AI Studio](https://aistudio.google.com/apikey)).
3. La chiave rimarrà memorizzata in locale nel tuo browser.
4. Puoi scegliere il modello preferito (es. `gemini-2.5-flash-image` o `gemini-3-pro-image-preview`).
