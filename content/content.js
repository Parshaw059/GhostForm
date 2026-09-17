(() => {
  // Prevent duplicate script execution
  if (window.__g_filler_injected) return;
  window.__g_filler_injected = true;

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
      sendResponse({ status: "pong" });
      return true;
    }

    if (request.action === "extractQuestions") {
      try {
        const questions = scanGoogleFormQuestions();
        sendResponse({ success: true, questions });
      } catch (err) {
        console.error("[G-Filler] Error extracting questions:", err);
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (request.action === "fillAnswers") {
      try {
        const stats = applyAnswersToForm(request.answers);
        sendResponse({ success: true, stats });
      } catch (err) {
        console.error("[G-Filler] Error filling answers:", err);
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }
  });

  /**
   * Scans the active Google Form DOM and extracts all questions with their types and choices.
   */
  function scanGoogleFormQuestions() {
    const containerCandidates = Array.from(
      document.querySelectorAll('div[role="listitem"], div.Qr7Oae, div.geS5n')
    );

    // Filter to top-level question blocks that have actual inputs or options
    const questionContainers = containerCandidates.filter((container) => {
      const hasHeading = container.querySelector('[role="heading"], .M7eMe, .m7Wbe');
      const hasInputs = container.querySelector(
        '[role="radio"], [role="checkbox"], [role="listbox"], input.whsOnd, input[type="text"], textarea.KHxj8b, textarea'
      );
      return hasHeading && hasInputs;
    });

    // Remove nested child containers if parent was already selected
    const distinctContainers = [];
    for (const c of questionContainers) {
      if (!distinctContainers.some((existing) => existing.contains(c) || c.contains(existing))) {
        distinctContainers.push(c);
      }
    }

    const questions = [];

    distinctContainers.forEach((container, index) => {
      // Mark container with internal ID
      container.setAttribute("data-g-filler-id", index.toString());

      // 1. Extract Question Title
      const titleElem = container.querySelector('[role="heading"], .M7eMe, .m7Wbe');
      let questionTitle = titleElem ? titleElem.innerText.trim() : `Question ${index + 1}`;
      // Remove trailing asterisks (required marker)
      questionTitle = questionTitle.replace(/\s*\*\s*$/, "").trim();

      // Check for description / subtext
      const descElem = container.querySelector('.g4EkG, .b3idid');
      if (descElem && descElem.innerText.trim()) {
        questionTitle += ` (${descElem.innerText.trim()})`;
      }

      // 2. Identify Question Type and Choices
      const radios = Array.from(container.querySelectorAll('[role="radio"]'));
      const checkboxes = Array.from(container.querySelectorAll('[role="checkbox"]'));
      const listbox = container.querySelector('[role="listbox"]');
      const textInput = container.querySelector('input.whsOnd, input[type="text"]');
      const textarea = container.querySelector('textarea.KHxj8b, textarea');

      let type = "text";
      let options = [];

      if (radios.length > 0) {
        type = "radio";
        options = radios.map((r) => extractOptionText(r, container));
      } else if (checkboxes.length > 0) {
        type = "checkbox";
        options = checkboxes.map((cb) => extractOptionText(cb, container));
      } else if (listbox) {
        type = "dropdown";
        options = Array.from(container.querySelectorAll('[role="option"]')).map((opt) => opt.innerText.trim());
      } else if (textarea) {
        type = "text";
      } else if (textInput) {
        type = "text";
      }

      questions.push({
        id: index,
        question: questionTitle,
        type: type,
        options: options
      });
    });

    return questions;
  }

  /**
   * Helper to extract option label text for radio/checkbox
   */
  function extractOptionText(optionElem, container) {
    const ariaLabel = optionElem.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    const dataVal = optionElem.getAttribute("data-value");
    if (dataVal && dataVal.trim()) return dataVal.trim();

    const parentContainer = optionElem.closest(".docssharedWizToggleLabeledContainer, label, .oy8Du");
    if (parentContainer) {
      const labelSpan = parentContainer.querySelector(".aDTYNe, .YEVLvd, .d7L4fc, .OIC90c, span.dir-ltr");
      if (labelSpan && labelSpan.innerText.trim()) {
        return labelSpan.innerText.trim();
      }
      return parentContainer.innerText.trim();
    }

    return optionElem.innerText.trim() || "Option";
  }

  /**
   * Applies the AI-generated answers back to the Google Form DOM elements invisibly.
   * Does NOT add any AI badges or visible notifications.
   */
  function applyAnswersToForm(answers) {
    let filledCount = 0;
    const totalCount = answers.length;

    // Remove any previously injected badges if present
    document.querySelectorAll(".g-filler-badge").forEach((el) => el.remove());
    document.querySelectorAll(".g-filler-highlight").forEach((el) => el.classList.remove("g-filler-highlight"));
    document.querySelectorAll(".g-filler-selected-option").forEach((el) => el.classList.remove("g-filler-selected-option"));

    answers.forEach((ans) => {
      const qId = ans.id;
      const container = document.querySelector(`[data-g-filler-id="${qId}"]`);
      if (!container) return;

      let success = false;

      // Handle Radio Buttons
      const radios = Array.from(container.querySelectorAll('[role="radio"]'));
      if (radios.length > 0 && ans.selectedOptions && ans.selectedOptions.length > 0) {
        const targetOptionText = ans.selectedOptions[0];
        const matchedRadio = findBestMatchingOption(radios, container, targetOptionText);
        if (matchedRadio) {
          triggerClick(matchedRadio);
          success = true;
        }
      }

      // Handle Checkboxes
      const checkboxes = Array.from(container.querySelectorAll('[role="checkbox"]'));
      if (checkboxes.length > 0 && ans.selectedOptions && ans.selectedOptions.length > 0) {
        ans.selectedOptions.forEach((optText) => {
          const matchedCb = findBestMatchingOption(checkboxes, container, optText);
          if (matchedCb) {
            const isChecked = matchedCb.getAttribute("aria-checked") === "true";
            if (!isChecked) {
              triggerClick(matchedCb);
            }
            success = true;
          }
        });
      }

      // Handle Text Inputs (Short answer or paragraph)
      const textInput = container.querySelector('input.whsOnd, input[type="text"]');
      const textarea = container.querySelector('textarea.KHxj8b, textarea');
      const textVal = ans.textAnswer || (ans.selectedOptions && ans.selectedOptions.length > 0 ? ans.selectedOptions[0] : "");

      if (textarea && textVal) {
        setTextValue(textarea, textVal);
        success = true;
      } else if (textInput && textVal) {
        setTextValue(textInput, textVal);
        success = true;
      }

      if (success) {
        filledCount++;
      }
    });

    return { total: totalCount, filled: filledCount };
  }

  /**
   * Helper: Matches AI choice string with the form element options
   */
  function findBestMatchingOption(elements, container, targetText) {
    if (!targetText) return null;
    const cleanTarget = targetText.toLowerCase().trim();

    // 1. Exact match
    for (const el of elements) {
      const optText = extractOptionText(el, container).toLowerCase().trim();
      if (optText === cleanTarget) return el;
    }

    // 2. Contains match (e.g. "A) Option Name" vs "Option Name")
    for (const el of elements) {
      const optText = extractOptionText(el, container).toLowerCase().trim();
      const strippedOpt = optText.replace(/^[a-z0-9][\.\)\-\:]\s*/i, "").trim();
      const strippedTarget = cleanTarget.replace(/^[a-z0-9][\.\)\-\:]\s*/i, "").trim();

      if (strippedOpt === strippedTarget) return el;
      if (strippedOpt && strippedTarget && (strippedOpt.includes(strippedTarget) || strippedTarget.includes(strippedOpt))) {
        return el;
      }
    }

    // 3. Fallback: Letter prefix matching (e.g. target is "A" and option starts with "A)")
    if (/^[a-d]$/i.test(cleanTarget)) {
      const index = cleanTarget.charCodeAt(0) - 97;
      if (elements[index]) return elements[index];
    }

    return null;
  }

  /**
   * Simulates genuine user clicks naturally without modifying styling
   */
  function triggerClick(element) {
    if (!element) return;
    const target = element.closest(".docssharedWizToggleLabeledContainer") || element;

    const eventOptions = { bubbles: true, cancelable: true, view: window };
    target.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
    target.dispatchEvent(new MouseEvent("mousedown", eventOptions));
    target.dispatchEvent(new PointerEvent("pointerup", eventOptions));
    target.dispatchEvent(new MouseEvent("mouseup", eventOptions));
    target.dispatchEvent(new MouseEvent("click", eventOptions));

    if (typeof target.click === "function") {
      target.click();
    }
  }

  /**
   * Sets text value and dispatches input/change events that Google Forms requires
   */
  function setTextValue(inputEl, text) {
    if (!inputEl) return;
    inputEl.focus();

    const prototype = inputEl instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(inputEl, text);
    } else {
      inputEl.value = text;
    }

    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    inputEl.blur();
  }
})();
