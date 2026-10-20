# PixelAudit2Prompt

**PixelAudit2Prompt** is a 100% pixel-accurate Visual Regression, Layout QA, and Prompt Generation developer tool. It compares a Designer's reference export (Figma 1x / 2x Retina) against a live front-end implementation (via zero-config Playwright browser automation or manual paste), pinpoints discrepancies using `pixelmatch` and Google Gemini Vision AI, maps visual coordinates directly to live DOM elements, and compiles a structured prompt ready to paste into Cursor or Antigravity IDE to automatically fix the code.

---

## Architecture & Features

### 1. Dual Input Engine (Design + Implementation)
- **Design Reference:** Drag & Drop, file upload, or global <kbd>Ctrl</kbd>+<kbd>V</kbd> paste. Preserves true `naturalWidth` and `naturalHeight`.
- **Implementation Slot:**
  - **One-Click Automated Capture (<kbd>R</kbd>):** Calls `POST /api/capture` via our custom Vite Playwright middleware.
  - **Auto-Sync with Design:** Automatically computes target viewport based on Design Scale (e.g. 2x Retina export -> 50% CSS viewport @ 2x DPR).
  - Manual paste or image upload also supported.

### 2. Zero-Config Vite Playwright Middleware (`vite.config.ts`)
- Runs natively on `pnpm dev` without requiring a separate Express server process.
- **Browser Singleton:** Chromium instance kept warm in memory (< 500ms captures with isolated per-request `BrowserContext`).
- **100% Deterministic Rendering:** Waits for `networkidle`, `document.fonts.ready`, injects scrollbar neutralization styles (`::-webkit-scrollbar { display: none !important; }`), and disables CSS animations.
- **Live DOM Telemetry (`domMap`):** Extracts visible element bounding boxes, tag names, classes, text snippets, and computed styles (padding, margin, gap, typography, colours, border-radius, flex alignment).

### 3. Five Inspection Modes
1. **[1] Auto Pixel Diff (`pixelmatch`):** Neon magenta diff overlay with real-time threshold slider and live `Match Score: XX.XX%` badge.
2. **[2] Onion Skin:** Overlays Design over Implementation with an opacity slider and optional `mix-blend-mode: difference`.
3. **[3] Blink / Strobe (<kbd>Space</kbd>):** Hold Spacebar to instantaneously alternate between Design and Implementation with zero transition lag.
4. **[4] Split Curtain Slider:** Interactive draggable split bar showing Design on the left and Implementation on the right.
5. **[5] Synced Side-by-Side:** Mirrored pan/zoom with synchronized laser crosshair.

### 4. Precision Measurement & Calibration
- **Pixel-Grid Zoom & Pan:** Smooth pan and zoom from 25% to 800%. Automatically toggles `image-rendering: pixelated` at 200%+ for razor-sharp pixel boundaries.
- **Sub-Pixel Calibration:** Offset X / Offset Y controls with 1px step and Arrow Key nudging (<kbd>Shift</kbd> for 10px).
- **Pixel Loupe & HUD Bar:** 9×9 dual magnifier, exact (X, Y) coordinates, Design vs. Implementation HEX color swatches, and live hovered DOM tag badge.
- **Interactive Ruler (<kbd>M</kbd>):** Click and drag to measure exact ΔX, ΔY, and Euclidean distance in px.
- **Smart Bounding Box Annotations (<kbd>A</kbd>):** Draw numbered boxes (#1, #2...) over bugs with automatic DOM cross-referencing and sampled HEX colors.

### 5. AI Vision Auto-Audit (@google/genai)
- Supports `gemini-2.5-pro` and `gemini-2.5-flash`.
- Sends (1) Design reference, (2) Implementation screenshot, and (3) `pixelmatch` diff overlay composite to Gemini.
- Enforces Structured Outputs (`responseSchema`) with normalized bounding boxes `[ymin, xmin, ymax, xmax]`, categories, and actionable CSS fixes.
- Converts normalized boxes to exact image pixels and cross-references them with the Playwright `domMap`.

### 6. AI Prompt Compiler & Export Actions
- Generates a ready-to-paste structured Markdown prompt for Cursor / Antigravity IDE detailing project notes, match score, and numbered issues with exact CSS diffs and instructions.
- **Copy Prompt to Clipboard** button.
- **Download Annotated Comparison PNG:** composite 1:1 image with numbered red bounding boxes.
- **Download Prompt `.md`** file.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| <kbd>1</kbd> | Pixel Diff mode |
| <kbd>2</kbd> | Onion Skin mode |
| <kbd>3</kbd> | Blink mode |
| <kbd>4</kbd> | Split Curtain mode |
| <kbd>5</kbd> | Side-by-Side mode |
| <kbd>Space</kbd> | Hold in Blink mode to view Design |
| <kbd>V</kbd> | Inspect / Pan tool |
| <kbd>M</kbd> | Ruler measurement tool |
| <kbd>A</kbd> | Draw annotation box tool |
| <kbd>R</kbd> | Capture localhost |
| <kbd>G</kbd> | Trigger Gemini AI Vision audit |
| <kbd>F</kbd> | Fit viewport to content |
| <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> | Nudge Implementation offset (1px, or 10px with <kbd>Shift</kbd>) |
| <kbd>Ctrl</kbd> + <kbd>V</kbd> | Paste image from clipboard |
| <kbd>Esc</kbd> | Cancel measurement or deselect issue |

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start Vite dev server with Playwright capture middleware
pnpm dev
```

Visit `http://localhost:5173/` in your browser. Click **"Try the demo scenario"** to immediately test all features without needing external files!
