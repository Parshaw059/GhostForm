document.addEventListener("DOMContentLoaded", async () => {
  const apiKeyInput = document.getElementById("apiKey");
  const toggleKeyVisBtn = document.getElementById("toggleKeyVis");
  const saveKeyBtn = document.getElementById("saveKeyBtn");
  const keySaveMsg = document.getElementById("keySaveMsg");
  const modelSelect = document.getElementById("modelSelect");
  const fillFormBtn = document.getElementById("fillFormBtn");
  const logContainer = document.getElementById("logContainer");
  const questionCountBadge = document.getElementById("questionCountBadge");
  const statusIndicator = document.getElementById("statusIndicator");
  const statusLabel = document.getElementById("statusLabel");

  // Load saved preferences
  const prefs = await chrome.storage.local.get([
    "geminiApiKey",
    "geminiModel"
  ]);

  if (prefs.geminiApiKey) {
    apiKeyInput.value = prefs.geminiApiKey;
    keySaveMsg.textContent = "API key loaded";
    keySaveMsg.className = "feedback-msg success";
    setTimeout(() => { keySaveMsg.textContent = ""; }, 2500);
  }

  // Handle model selection
  const validModels = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
  if (prefs.geminiModel && validModels.includes(prefs.geminiModel)) {
    modelSelect.value = prefs.geminiModel;
  } else {
    modelSelect.value = "gemini-3.8-flash";
    await chrome.storage.local.set({ geminiModel: "gemini-3.8-flash" });
  }

  // Toggle API key visibility
  toggleKeyVisBtn.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyVisBtn.textContent = "🔒";
    } else {
      apiKeyInput.type = "password";
      toggleKeyVisBtn.textContent = "👁️";
    }
  });

  // Save API Key
  saveKeyBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      keySaveMsg.textContent = "Please enter an API key";
      keySaveMsg.className = "feedback-msg error";
      return;
    }
    await chrome.storage.local.set({ geminiApiKey: key });
    keySaveMsg.textContent = "Saved securely!";
    keySaveMsg.className = "feedback-msg success";
    setTimeout(() => { keySaveMsg.textContent = ""; }, 2500);
  });

  // Save model changes
  modelSelect.addEventListener("change", async () => {
    await chrome.storage.local.set({ geminiModel: modelSelect.value });
  });

  function setStatus(state, text) {
    statusIndicator.className = "status-indicator";
    if (state === "busy") statusIndicator.classList.add("busy");
    if (state === "error") statusIndicator.classList.add("error");
    statusLabel.textContent = text;
  }

  function addLog(message, type = "info") {
    const entry = document.createElement("div");
    entry.className = `log-entry log-${type}`;
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    entry.textContent = `[${time}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function clearLogs() {
    logContainer.innerHTML = "";
  }

  // Ensure content script is ready in active tab
  async function ensureContentScriptInjected(tabId) {
    try {
      const pong = await chrome.tabs.sendMessage(tabId, { action: "ping" });
      if (pong && pong.status === "pong") return true;
    } catch (e) {
      try {
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ["content/content.css"]
        });
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content/content.js"]
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
        return true;
      } catch (injectionError) {
        throw new Error("Unable to inject script into tab: " + injectionError.message);
      }
    }
    return true;
  }

  // Main Action: Solve & Auto-Fill Form
  fillFormBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      apiKeyInput.focus();
      keySaveMsg.textContent = "Please provide your Gemini API key above!";
      keySaveMsg.className = "feedback-msg error";
      addLog("Missing Gemini API Key. Paste it above and click Save.", "error");
      return;
    }

    await chrome.storage.local.set({ geminiApiKey: apiKey });

    // Check active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      addLog("Cannot detect active tab.", "error");
      return;
    }

    if (!tab.url.includes("docs.google.com/forms")) {
      addLog("Please navigate to a Google Form tab first.", "warn");
      setStatus("error", "Wrong Tab");
      return;
    }

    try {
      fillFormBtn.disabled = true;
      setStatus("busy", "Scanning...");
      clearLogs();
      addLog("Connecting to Google Form...", "info");

      await ensureContentScriptInjected(tab.id);

      // 1. Extract questions from form
      addLog("Scanning page for quiz questions...", "info");
      const extractResponse = await chrome.tabs.sendMessage(tab.id, { action: "extractQuestions" });

      if (!extractResponse || !extractResponse.success) {
        throw new Error(extractResponse?.error || "Failed to scan form questions.");
      }

      const questions = extractResponse.questions || [];
      if (questions.length === 0) {
        addLog("No questions detected on this page. Ensure you are on a live Google Form.", "warn");
        setStatus("ready", "Ready");
        fillFormBtn.disabled = false;
        return;
      }

      questionCountBadge.style.display = "inline-block";
      questionCountBadge.textContent = `${questions.length} questions`;
      addLog(`Found ${questions.length} questions. Requesting AI answers...`, "info");
      setStatus("busy", "AI Thinking...");

      // 2. Query Gemini API with resilience & fallback
      let selectedModel = modelSelect.value || "gemini-3.8-flash";
      const answers = await fetchGeminiAnswersWithResilience(apiKey, selectedModel, questions);

      addLog(`AI found answers for ${answers.length} questions!`, "success");
      setStatus("busy", "Filling Form...");

      // 3. Send answers to content script to click/type cleanly
      addLog("Filling form fields stealthily...", "info");
      const fillResponse = await chrome.tabs.sendMessage(tab.id, {
        action: "fillAnswers",
        answers: answers
      });

      if (!fillResponse || !fillResponse.success) {
        throw new Error(fillResponse?.error || "Error applying answers to form.");
      }

      const stats = fillResponse.stats || { filled: 0, total: questions.length };
      addLog(`Successfully filled ${stats.filled} of ${stats.total} questions!`, "success");
      setStatus("ready", "Done!");
    } catch (err) {
      console.error(err);
      addLog(`Error: ${err.message}`, "error");
      setStatus("error", "Error");
    } finally {
      fillFormBtn.disabled = false;
    }
  });

  // Call Gemini API with automatic retry and failover between available models
  async function fetchGeminiAnswersWithResilience(apiKey, preferredModel, questions) {
    // Model fallback sequence
    const modelCandidates = [
      preferredModel,
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-2.5-flash",
      "gemini-1.5-flash"
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let lastError = null;

    for (let i = 0; i < modelCandidates.length; i++) {
      const model = modelCandidates[i];

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (i > 0 || attempt > 1) {
            addLog(`Requesting via ${model} (attempt ${attempt})...`, "info");
          } else {
            addLog(`Requesting via ${model}...`, "info");
          }

          return await callGeminiAPI(apiKey, model, questions);
        } catch (err) {
          lastError = err;
          const msg = err.message.toLowerCase();
          const isHighDemand = msg.includes("high demand") || 
                               msg.includes("503") || 
                               msg.includes("429") || 
                               msg.includes("resourceexhausted") ||
                               msg.includes("overloaded");

          const isUnavailable = msg.includes("no longer available") || 
                                msg.includes("not found") || 
                                msg.includes("404");

          if (isHighDemand) {
            addLog(`${model} has high demand. Pausing 1.5s...`, "warn");
            await new Promise((res) => setTimeout(res, 1500));
            // Try next model if attempt 2 fails
          } else if (isUnavailable) {
            // Model doesn't exist, jump immediately to next model
            break;
          } else {
            // Unrecoverable error (e.g. invalid API key)
            throw err;
          }
        }
      }
    }

    throw lastError || new Error("All models are temporarily busy. Please wait a few seconds and try again.");
  }

  // Core Gemini API call
  async function callGeminiAPI(apiKey, model, questions) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const promptText = `
You are an expert quiz solver. You will be given questions from a Google Form quiz.
Carefully analyze each question and find the correct answer.

Here are the questions:
${JSON.stringify(questions, null, 2)}

Instructions:
1. For question type "radio" (single choice): Provide the exact matching option string in "selectedOptions" (an array with 1 item).
2. For question type "checkbox" (multiple choice/select all that apply): Provide all correct matching option strings in "selectedOptions".
3. For question type "text" (short answer / paragraph): Provide the exact, accurate, concise answer string in "textAnswer".
4. For question type "dropdown": Provide the exact matching option string in "selectedOptions".
5. Return ONLY a valid JSON object with the following structure:
{
  "answers": [
    {
      "id": 0,
      "selectedOptions": ["Exact Option String"],
      "textAnswer": ""
    }
  ]
}
`;

    const requestPayload = {
      contents: [
        {
          parts: [
            { text: promptText }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = errorData.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      throw new Error(`Gemini API error: ${msg}`);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error("No response content received from Gemini.");
    }

    try {
      let cleanJson = candidateText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }
      cleanJson = cleanJson.trim();

      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed.answers && Array.isArray(parsed.answers)) {
        return parsed.answers;
      }
      throw new Error("Unexpected JSON format from Gemini");
    } catch (parseErr) {
      console.error("Raw response:", candidateText);
      throw new Error("Failed to parse Gemini JSON answer response: " + parseErr.message);
    }
  }
});
