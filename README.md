# 👻 GhostForm — Stealth AI Quiz Solver Chrome Extension

**GhostForm** is an intelligent, stealthy Chrome extension that scans Google Form quizzes, finds the verified answers using Google's Gemini AI, and automatically selects choices and fills fields naturally without leaving any traces or AI indicators.

---

## 🚀 How to Install in Google Chrome

1. Open Google Chrome.
2. In the URL bar, go to: `chrome://extensions/`
3. In the top-right corner, turn on **Developer mode**.
4. In the top-left corner, click **Load unpacked**.
5. Select the folder on your Desktop:
   ```
   /Users/parshawshah/Desktop/GhostForm
   ```
6. The **GhostForm** icon (`👻`) will appear in your Chrome toolbar!
   *(Click the puzzle piece icon in your Chrome toolbar to pin GhostForm for easy access).*

---

## 🔑 How to Set Your Google Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and click **Create API Key** (it's 100% free).
2. Click the **GhostForm** icon in your Chrome toolbar.
3. Paste your key into the **Google Gemini API Key** box and click **Save**.
4. The key is stored securely in your browser's local storage.

---

## 📝 How to Use on Google Forms

1. Open any Google Form Quiz (e.g., `https://docs.google.com/forms/...`).
2. Click the **GhostForm** extension icon in your Chrome toolbar.
3. Choose your AI model (defaults to the latest **Gemini 3.8 Flash**).
4. Click **⚡ Solve & Auto-Fill Form**.
5. **GhostForm** will:
   - Scan questions and choices across the quiz.
   - Request high-confidence answers from Google Gemini AI.
   - Auto-retry and failover across available models if servers report high demand.
   - Click options and type text answers naturally.
   - **Stealth Mode**: Zero badges, borders, or indicators are left on the form.
6. Review the answers on the page, and when you are ready, click **Submit**.

---

## 🛡️ Supported Question Types

- **Multiple Choice** (Radio buttons)
- **Multiple Selection** (Checkboxes)
- **Short Answer** (Text inputs)
- **Paragraphs** (Long text areas)
- **Dropdowns** (Listbox selectors)

---

## 📁 File Structure

```
GhostForm/
├── manifest.json         # Chrome Extension Manifest V3
├── popup/
│   ├── popup.html        # Clean popup user interface
│   ├── popup.css         # Styling, dark mode, animations
│   └── popup.js          # API key manager, Gemini caller & resilient failover
├── content/
│   ├── content.js        # Stealth form DOM scanner & click simulator
│   └── content.css       # Stealth mode styles
└── icons/
    ├── icon16.png        # Toolbar icon (16x16)
    ├── icon48.png        # Extension manager icon (48x48)
    └── icon128.png       # Chrome Web Store / high-res icon (128x128)
```
