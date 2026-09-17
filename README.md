# ⚡ G-Filler — AI Google Form Quiz Solver Chrome Extension

**G-Filler** is a Chrome extension that scans Google Form quizzes, finds the verified answers using Google's Gemini AI, and automatically selects the choices and fills text fields in one click.

---

## 🚀 How to Install in Google Chrome

1. Open Google Chrome.
2. In the URL bar, go to: `chrome://extensions/`
3. In the top-right corner, turn on **Developer mode**.
4. In the top-left corner, click **Load unpacked**.
5. Select the folder on your Desktop:
   ```
   /Users/parshawshah/Desktop/G-Filler
   ```
6. The **G-Filler** icon (`G`) will now appear in your Chrome toolbar!
   *(Click the puzzle piece icon in Chrome toolbar to pin G-Filler for easy access).*

---

## 🔑 How to Get and Set Your Google Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and click **Get API Key** (it is free).
2. Click the **G-Filler** icon in your Chrome toolbar.
3. Paste your API key into the **Google Gemini API Key** box and click **Save**.
4. The key is securely saved in your browser's local storage.

---

## 📝 How to Use on Google Forms

1. Open any Google Form Quiz (e.g., `https://docs.google.com/forms/...`).
2. Click the **G-Filler** extension icon in your Chrome toolbar.
3. Select your preferred model (Default is **Gemini 2.0 Flash** for fast, high-accuracy answers).
4. Click **⚡ Solve & Auto-Fill Form**.
5. G-Filler will:
   - Scan the quiz questions and choices.
   - Send them to Gemini AI to deduce the correct answers.
   - Automatically click the correct radio buttons and checkboxes.
   - Type answers into short answer and paragraph fields.
   - Highlight the answered questions with a subtle badge (`✦ AI Answered`).
6. Review the answers on the page, and when you are satisfied, click **Submit** on the form.

---

## 📁 File Structure

```
G-Filler/
├── manifest.json         # Chrome Extension Manifest V3
├── popup/
│   ├── popup.html        # Clean popup user interface
│   ├── popup.css         # Styling, dark mode, animations
│   └── popup.js          # API key management, Gemini API caller & tab bridge
├── content/
│   ├── content.js        # Form DOM scanner, click simulator & text filler
│   └── content.css       # Visual answer badges & highlights
└── icons/
    ├── icon16.png        # Toolbar icon (16x16)
    ├── icon48.png        # Extension manager icon (48x48)
    └── icon128.png       # Chrome Web Store / high-res icon (128x128)
```

---

## 🛡️ Supported Question Types

- **Multiple Choice** (Radio buttons)
- **Multiple Selection** (Checkboxes)
- **Short Answer** (Text inputs)
- **Paragraphs** (Long text areas)
- **Dropdowns** (Listbox selectors)
