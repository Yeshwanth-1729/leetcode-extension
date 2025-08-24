// Content script for LeetCode DOM manipulation
console.log("LeetCode Focus content script loaded");

// Store removed elements for restoration
let removedElements = new Map();
let focusObserver = null;
let currentSettings = null;

// Wait for page to be fully loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeContentScript);
} else {
  initializeContentScript();
}

function initializeContentScript() {
  console.log("Initializing LeetCode Focus content script");

  // Setup message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);

    try {
      switch (request.action) {
        case "ping":
          sendResponse({ success: true, message: "Content script is alive" });
          break;

        case "applyFocusSettings":
          applyFocusSettings(request.settings);
          sendResponse({ success: true, message: "Focus settings applied" });
          break;

        case "getCurrentCode":
          const codeData = getCurrentCodeAndProblem();
          sendResponse({ success: true, data: codeData });
          break;

        default:
          sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ success: false, error: error.message });
    }

    // Return true to indicate we'll send a response asynchronously
    return true;
  });

  // DON'T auto-apply focus settings on page load
  // Only apply when user explicitly activates them via the Apply button
  setTimeout(() => {
    try {
      // Monitor for dynamic content changes
      observePageChanges();

      // Setup problem navigation detection
      setupProblemNavigationDetection();

      console.log(
        "Content script setup completed - Focus mode will only activate when user clicks Apply",
      );
    } catch (error) {
      console.error("Error in delayed initialization:", error);
    }
  }, 2000);

  console.log("Content script initialized successfully");
}

// Get current code and problem information
function getCurrentCodeAndProblem() {
  try {
    console.log("Extracting comprehensive code and problem data...");

    // Get problem title with more specific selectors
    const titleSelectors = [
      'a[class*="text-title-large"]', // More specific for title links
      ".text-title-large",
      '[data-cy="question-title"]',
      ".css-v3d350",
      "h4",
      ".question-title",
      'h1[class*="title"]',
      '[class*="question"] h1',
      '[class*="question"] h2',
      '.elfjS [class*="text-title"]',
      'div[data-cy="question-title"]',
    ];

    let problemTitle = "Unknown Problem";
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        problemTitle = element.textContent.trim();
        break;
      }
    }

    console.log("Problem title found:", problemTitle);

    // Get problem description with enhanced selectors and better extraction
    const descriptionSelectors = [
      '[data-track-load="description_content"]',
      '.elfjS [class*="markdown"]',
      ".content__u3I1 .question-content",
      ".question-content",
      '[class*="question-content"]',
      '[class*="description"]',
      ".markdown-body",
      'div[class*="markdown"]',
    ];

    let problemDescription = "No description available";
    let fullDescription = "";
    for (const selector of descriptionSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        fullDescription = element.textContent.trim();
        // Extract a more comprehensive description but keep it manageable
        problemDescription = extractEnhancedDescription(fullDescription);
        break;
      }
    }

    // Extract problem difficulty
    let difficulty = "Unknown";
    const difficultySelectors = [
      '.text-difficulty-easy',
      '.text-difficulty-medium', 
      '.text-difficulty-hard',
      '[class*="difficulty"]',
      '.label-difficulty'
    ];
    
    for (const selector of difficultySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        difficulty = element.textContent.trim();
        break;
      }
    }

    // Extract problem tags/topics
    let tags = [];
    const tagSelectors = [
      '.topic-tag',
      '[class*="tag"]',
      '.badge',
      'a[href*="/tag/"]'
    ];
    
    tagSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const tagText = el.textContent.trim();
        if (tagText && !tags.includes(tagText) && tagText.length < 30) {
          tags.push(tagText);
        }
      });
    });

    // Get examples from the problem description
    const examples = extractExamples(fullDescription);

    console.log("Enhanced problem data found:", {
      title: problemTitle,
      difficulty,
      tags: tags.slice(0, 5), // Limit to 5 most relevant tags
      exampleCount: examples.length
    });

    // Get user's current code from Monaco editor
    let userCode = "";
    let language = "javascript";

    // Try to get code from Monaco editor using multiple methods
    userCode = extractUserCodeFromMonaco();

    if (!userCode || userCode.trim() === "") {
      console.log("Monaco extraction failed, trying alternative methods...");
      userCode = extractCodeFromAlternativeMethods();
    }

    // Get selected language with enhanced detection
    const languageSelectors = [
      '[data-cy="lang-select"] .ant-select-selection-item',
      ".ant-select-selection-item",
      ".language-picker",
      '[class*="language"] select option[selected]',
      '[class*="lang"] .selected',
      'button[class*="language"][class*="active"]',
    ];

    for (const selector of languageSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        language = normalizeLanguageName(element.textContent.toLowerCase().trim());
        break;
      }
    }

    // Clean up the code
    userCode = cleanCodeText(userCode);

    console.log("Final comprehensive extracted data:", {
      problemTitle,
      userCodeLength: userCode.length,
      language,
      difficulty,
      tagCount: tags.length,
      codePreview: userCode.substring(0, 100) + "...",
    });

    return {
      problemTitle,
      problemDescription,
      fullDescription: fullDescription.substring(0, 1500), // More context for AI
      userCode,
      language,
      difficulty,
      tags: tags.slice(0, 5),
      examples,
      constraints: extractConstraints(fullDescription),
      followUp: extractFollowUp(fullDescription)
    };
  } catch (error) {
    console.error("Error getting current code and problem:", error);
    return {
      problemTitle: "Unknown Problem",
      problemDescription: "",
      fullDescription: "",
      userCode: "",
      language: "javascript",
      difficulty: "Unknown",
      tags: [],
      examples: [],
      constraints: "",
      followUp: ""
    };
  }
}

// Extract user code from Monaco editor (primary method)
function extractUserCodeFromMonaco() {
  try {
    console.log("Attempting to extract code from Monaco editor...");

    // Method 1: Try to access Monaco editor instance directly
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      console.log("Found Monaco editors:", editors.length);

      for (const editor of editors) {
        const model = editor.getModel();
        if (model) {
          const code = model.getValue();
          if (code && code.trim() && !code.includes("// @lc code=start")) {
            console.log(
              "Code extracted from Monaco instance:",
              code.substring(0, 100) + "...",
            );
            return code;
          }
        }
      }
    }

    // Method 2: Extract from the specific view-lines structure provided by user
    const viewLines = document.querySelector(
      '.view-lines[role="presentation"]',
    );
    if (viewLines) {
      console.log("Found view-lines element with role='presentation'");

      const lines = viewLines.querySelectorAll(".view-line");
      if (lines.length > 0) {
        const code = Array.from(lines)
          .map((line) => {
            // Extract text from the complex span structure
            return extractTextFromViewLine(line);
          })
          .join("\n");

        if (code && code.trim()) {
          console.log(
            "Code extracted from view-lines:",
            code.substring(0, 100) + "...",
          );
          return code;
        }
      }
    }

    // Method 3: Extract from DOM elements using more specific selectors
    const monacoSelectors = [
      ".monaco-editor .view-lines",
      ".monaco-editor textarea",
      "[class*='monaco'] .view-lines",
      ".editor-scrollable .view-lines",
      ".overflow-guard .view-lines",
    ];

    for (const selector of monacoSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log("Found Monaco element:", selector);

        if (element.tagName === "TEXTAREA") {
          const code = element.value;
          if (code && code.trim()) {
            console.log("Code from textarea:", code.substring(0, 100) + "...");
            return code;
          }
        } else {
          const lines = element.querySelectorAll(".view-line");
          if (lines.length > 0) {
            const code = Array.from(lines)
              .map((line) => {
                return getLineText(line);
              })
              .join("\n");

            if (code && code.trim()) {
              console.log(
                "Code from view-lines:",
                code.substring(0, 100) + "...",
              );
              return code;
            }
          }
        }
      }
    }

    // Method 4: Try to find the hidden textarea that Monaco uses
    const hiddenTextareas = document.querySelectorAll(
      'textarea[class*="monaco"], textarea[style*="position: absolute"]',
    );
    for (const textarea of hiddenTextareas) {
      if (textarea.value && textarea.value.trim()) {
        console.log(
          "Code from hidden textarea:",
          textarea.value.substring(0, 100) + "...",
        );
        return textarea.value;
      }
    }

    return "";
  } catch (error) {
    console.error("Error extracting code from Monaco:", error);
    return "";
  }
}

// Extract text from view-line element based on the user's structure
function extractTextFromViewLine(lineElement) {
  try {
    // The user showed this structure:
    // <div style="top:8px;height:18px;" class="view-line">
    //   <span><span class="mtk4">class</span><span class="mtk1">&nbsp;</span>...

    const spans = lineElement.querySelectorAll('span[class^="mtk"]');
    let lineText = "";

    spans.forEach((span) => {
      const text = span.textContent;
      if (text === "&nbsp;") {
        lineText += " ";
      } else {
        lineText += text;
      }
    });

    // If no mtk spans found, fall back to simple text content
    if (!lineText && lineElement.textContent) {
      lineText = lineElement.textContent;
    }

    return lineText;
  } catch (error) {
    console.error("Error extracting text from view line:", error);
    return lineElement.textContent || "";
  }
}

// Get text from Monaco view-line element
function getLineText(lineElement) {
  try {
    // Monaco uses complex span structures, get the actual text content
    const textNodes = [];
    const walker = document.createTreeWalker(
      lineElement,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );

    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim()) {
        textNodes.push(node.textContent);
      }
    }

    return textNodes.join("");
  } catch (error) {
    // Fallback to simple textContent
    return lineElement.textContent || "";
  }
}

// Alternative code extraction methods
function extractCodeFromAlternativeMethods() {
  try {
    console.log("Trying alternative code extraction methods...");

    // Method 1: Look for any textarea in the editor area
    const editorTextareas = document.querySelectorAll(
      'div[class*="editor"] textarea, div[class*="code"] textarea',
    );
    for (const textarea of editorTextareas) {
      if (textarea.value && textarea.value.trim()) {
        console.log("Found code in editor textarea");
        return textarea.value;
      }
    }

    // Method 2: CodeMirror fallback
    const codeMirrorElement = document.querySelector(".CodeMirror-code");
    if (codeMirrorElement) {
      const lines = codeMirrorElement.querySelectorAll(".CodeMirror-line");
      const code = Array.from(lines)
        .map((line) => line.textContent)
        .join("\n");
      if (code && code.trim()) {
        console.log("Found code in CodeMirror");
        return code;
      }
    }

    // Method 3: Look for any pre or code elements that might contain user code
    const codeElements = document.querySelectorAll(
      'pre, code, [class*="code"]',
    );
    for (const element of codeElements) {
      const text = element.textContent;
      if (
        text &&
        text.trim() &&
        text.includes("function") &&
        text.length > 50
      ) {
        console.log("Found code in code element");
        return text;
      }
    }

    return "";
  } catch (error) {
    console.error("Error in alternative code extraction:", error);
    return "";
  }
}

// Clean extracted code text
function cleanCodeText(code) {
  return code
    .replace(/\u00A0/g, " ")
    .replace(/\u200B/g, "")
    .replace(/^\s*[\r\n]/gm, "\n")
    .trim();
}

// Apply focus settings to remove/show elements - ONLY when user clicks Apply button
function applyFocusSettings(settings) {
  console.log(
    "🎯 User clicked Apply Focus Settings button - applying settings:",
    settings,
  );
  currentSettings = settings;

  // Restore previously removed elements first
  restoreRemovedElements();

  // Wait a bit for elements to load, then apply new settings
  setTimeout(() => {
    applyFocusRules(settings);
  }, 500);

  // Store settings
  chrome.storage.local.set({ focusSettings: settings });

  console.log(
    "✅ Focus settings applied successfully - activated by user action",
  );
}

// Apply focus rules by removing elements
function applyFocusRules(settings) {
  console.log("Applying focus rules with settings:", settings);
  const elementsToRemove = [];

  if (settings.hideSolutions) {
    console.log("🔍 Searching for Solutions elements to remove...");

    // Find solutions tab using more specific methods
    const solutionsElements = findSolutionsElements();
    console.log(
      `Found ${solutionsElements.length} solutions elements:`,
      solutionsElements,
    );

    solutionsElements.forEach((element, index) => {
      if (!isAlreadyMarkedForRemoval(element, elementsToRemove)) {
        elementsToRemove.push({
          element: element,
          type: "solutions",
          parent: element.parentNode,
          nextSibling: element.nextSibling,
          originalSelector: "solutions-search",
        });
        console.log(
          `✅ Marked Solutions element ${index + 1} for removal:`,
          element,
        );
        console.log(`   Element classes:`, element.className);
        console.log(`   Element text:`, element.textContent?.trim());
      }
    });
  }

  if (settings.hideHints) {
    console.log("💡 Searching for Hint elements to remove...");

    const hintElements = findHintElements();
    console.log(`Found ${hintElements.length} hint elements:`, hintElements);

    hintElements.forEach((element, index) => {
      if (!isAlreadyMarkedForRemoval(element, elementsToRemove)) {
        elementsToRemove.push({
          element: element,
          type: "hints",
          parent: element.parentNode,
          nextSibling: element.nextSibling,
          originalSelector: "hint-search",
        });
        console.log(
          `✅ Marked Hint element ${index + 1} for removal:`,
          element,
        );
        console.log(`   Element classes:`, element.className);
        console.log(`   Element text:`, element.textContent?.trim());
      }
    });
  }

  if (settings.hideDifficulty) {
    console.log("⭐ Searching for Difficulty elements to remove...");

    const difficultyElements = findDifficultyElements();
    console.log(
      `Found ${difficultyElements.length} difficulty elements:`,
      difficultyElements,
    );

    difficultyElements.forEach((element, index) => {
      if (!isAlreadyMarkedForRemoval(element, elementsToRemove)) {
        elementsToRemove.push({
          element: element,
          type: "difficulty",
          parent: element.parentNode,
          nextSibling: element.nextSibling,
          originalSelector: "difficulty-search",
        });
        console.log(
          `✅ Marked Difficulty element ${index + 1} for removal:`,
          element,
        );
        console.log(`   Element classes:`, element.className);
        console.log(`   Element text:`, element.textContent?.trim());
      }
    });
  }

  // Tags handling removed as per user request

  // Discussions handling removed as per user request

  // Remove elements and store them for restoration
  elementsToRemove.forEach((item) => {
    try {
      if (
        item &&
        item.element &&
        item.element.parentNode &&
        document.body &&
        document.body.contains &&
        document.body.contains(item.element)
      ) {
        const key = `${item.type}_${Date.now()}_${Math.random()}`;
        removedElements.set(key, item);
        item.element.remove();
        console.log(`Removed ${item.type} element:`, item.element);
      }
    } catch (error) {
      console.error(`Error removing ${item.type} element:`, error);
    }
  });

  // Apply dark mode safely
  if (settings.enableDarkMode) {
    applyDarkModeStyles();
  } else {
    removeDarkModeStyles();
  }

  console.log(
    `Focus mode applied: removed ${elementsToRemove.length} elements`,
  );
  showFocusIndicator();
}

// Find solutions elements using exact selectors provided by user
function findSolutionsElements() {
  const elements = [];

  // Method 1: Target the exact solutions tab structure provided by user
  // <div data-layout-path="/ts0/tb2" class="flexlayout__tab_button flexlayout__tab_button_top flexlayout__tab_button--unselected">
  const solutionsTabs = document.querySelectorAll(
    'div[class*="flexlayout__tab_button"]',
  );

  for (const tab of solutionsTabs) {
    // Check if this tab contains the solutions content with exact structure matching
    const solutionsDiv = tab.querySelector("#solutions_tab");
    const hasFlaskIcon = tab.querySelector('svg[data-icon="flask"]');
    const hasSolutionsText =
      tab.textContent && tab.textContent.includes("Solutions");
    const hasFlaskClass =
      tab.querySelector(".fa-flask") || tab.innerHTML.includes("fa-flask");

    if (solutionsDiv || hasFlaskIcon || (hasSolutionsText && hasFlaskClass)) {
      elements.push(tab);
      console.log("Found solutions tab (exact structure):", tab);
    }
  }

  // Method 2: Direct targeting by data-layout-path for solutions
  const solutionsByPath = document.querySelectorAll(
    'div[data-layout-path*="tb"][class*="flexlayout__tab_button"]',
  );
  for (const tab of solutionsByPath) {
    if (
      tab.querySelector("#solutions_tab") ||
      tab.textContent.includes("Solutions")
    ) {
      if (!elements.includes(tab)) {
        elements.push(tab);
      }
    }
  }

  // Method 3: Target by specific flask icon with Solutions text
  const flaskElements = document.querySelectorAll(
    'svg.fa-flask, svg[data-icon="flask"]',
  );
  for (const flask of flaskElements) {
    const tabContainer = flask.closest('div[class*="flexlayout__tab_button"]');
    if (tabContainer && tabContainer.textContent.includes("Solutions")) {
      if (!elements.includes(tabContainer)) {
        elements.push(tabContainer);
      }
    }
  }

  return elements;
}

// Find hint elements using exact selectors provided by user
function findHintElements() {
  const elements = [];

  // Method 1: Target the exact hint structure provided by user
  // <div class="relative inline-flex items-center justify-center text-caption px-2 py-1 gap-1 rounded-full bg-fill-secondary cursor-pointer...">
  const hintElements = document.querySelectorAll(
    'div[class*="relative"][class*="inline-flex"][class*="rounded-full"]',
  );

  for (const element of hintElements) {
    const hasLightbulbIcon =
      element.querySelector('svg[data-icon="lightbulb"]') ||
      element.querySelector("svg.fa-lightbulb") ||
      element.innerHTML.includes("fa-lightbulb");
    const hasHintText =
      element.textContent && element.textContent.trim() === "Hint";
    const hasSecondaryFill = element.className.includes("bg-fill-secondary");
    const hasCursorPointer = element.className.includes("cursor-pointer");

    if (
      (hasLightbulbIcon || hasHintText) &&
      (hasSecondaryFill || hasCursorPointer)
    ) {
      elements.push(element);
      console.log("Found hint element (exact structure):", element);
    }
  }

  // Method 2: Direct targeting by lightbulb icon
  const lightbulbElements = document.querySelectorAll(
    'svg[data-icon="lightbulb"], svg.fa-lightbulb',
  );
  for (const lightbulb of lightbulbElements) {
    const hintContainer =
      lightbulb.closest('div[class*="rounded-full"]') ||
      lightbulb.closest('div[class*="cursor-pointer"]');
    if (hintContainer && hintContainer.textContent.includes("Hint")) {
      if (!elements.includes(hintContainer)) {
        elements.push(hintContainer);
      }
    }
  }

  // Method 3: Target by exact class combinations
  const exactHintSelectors = [
    'div[class*="text-caption"][class*="rounded-full"][class*="bg-fill-secondary"]',
    'div[class*="inline-flex"][class*="cursor-pointer"][class*="transition-colors"]',
  ];

  for (const selector of exactHintSelectors) {
    try {
      const candidateElements = document.querySelectorAll(selector);
      for (const element of candidateElements) {
        if (element.textContent && element.textContent.includes("Hint")) {
          if (!elements.includes(element)) {
            elements.push(element);
          }
        }
      }
    } catch (e) {
      console.warn("Selector failed:", selector, e);
    }
  }

  return elements;
}

// Find difficulty elements using exact selectors provided by user
function findDifficultyElements() {
  const elements = [];

  // Method 1: Target the exact difficulty structure provided by user
  // <div class="relative inline-flex items-center justify-center text-caption px-2 py-1 gap-1 rounded-full bg-fill-secondary text-difficulty-easy dark:text-difficulty-easy">Easy</div>
  const difficultyTexts = ["Easy", "Medium", "Hard"];

  // Target elements with exact difficulty class patterns
  const difficultyElements = document.querySelectorAll(
    'div[class*="text-difficulty"]',
  );
  for (const element of difficultyElements) {
    const text = element.textContent?.trim();
    if (difficultyTexts.includes(text)) {
      elements.push(element);
      console.log("Found difficulty element (exact structure):", element);
    }
  }

  // Method 2: Target by exact class combination from user's HTML
  const exactDifficultyElements = document.querySelectorAll(
    'div[class*="relative"][class*="inline-flex"][class*="text-caption"][class*="rounded-full"][class*="bg-fill-secondary"]',
  );
  for (const element of exactDifficultyElements) {
    const text = element.textContent?.trim();
    if (difficultyTexts.includes(text)) {
      if (!elements.includes(element)) {
        elements.push(element);
      }
    }
  }

  // Method 3: Search for rounded elements containing only difficulty text
  const roundedElements = document.querySelectorAll(
    'div[class*="rounded-full"]',
  );
  for (const element of roundedElements) {
    const text = element.textContent?.trim();
    if (difficultyTexts.includes(text) && text.length <= 8) {
      // Exact match, not containing other text
      const hasCorrectClasses =
        element.className.includes("text-caption") ||
        element.className.includes("inline-flex") ||
        element.className.includes("bg-fill-secondary");
      if (hasCorrectClasses && !elements.includes(element)) {
        elements.push(element);
      }
    }
  }

  return elements;
}

// Find tag elements
function findTagElements() {
  const elements = [];

  // Look for topic tags specifically
  const tagSelectors = [
    ".topic-tag",
    ".ant-tag",
    '[class*="tag"]',
    '[class*="topic"]',
  ];

  tagSelectors.forEach((selector) => {
    try {
      const tagElements = document.querySelectorAll(selector);
      tagElements.forEach((element) => {
        const text = element.textContent?.trim();
        if (
          text &&
          text.length < 50 &&
          text.match(/^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/)
        ) {
          elements.push(element);
        }
      });
    } catch (e) {
      // Ignore selector errors
    }
  });

  return elements;
}

// Find discussion elements - ULTRA CONSERVATIVE approach to prevent page breakage
function findDiscussionElements() {
  const elements = [];
  const addedElements = new Set();

  console.log(
    "Searching for discussion elements (ultra-conservative approach)...",
  );

  // Helper function to check if element is absolutely safe to remove
  function isSafeToRemove(element) {
    if (!element) return false;

    const tagName = element.tagName ? element.tagName.toLowerCase() : "";
    const elementId = element.id || "";
    const elementClasses = element.className || "";
    const text = element.textContent || "";

    // NEVER remove these critical elements
    const criticalTags = [
      "html",
      "head",
      "body",
      "script",
      "style",
      "link",
      "meta",
      "title",
    ];
    const criticalIds = ["__next", "qd-content", "root"];
    const criticalClasses = [
      "flexlayout__layout",
      "flexlayout__tab",
      "flexlayout__",
      "h-[100vh]",
      "bg-sd-background-gray",
      "flex-col",
      "overflow-x-auto",
      "flex-grow",
      "overflow-y-hidden",
      "relative",
      "flex",
      "h-full",
      "w-full",
    ];

    // Block if it's a critical element
    if (
      criticalTags.includes(tagName) ||
      criticalIds.includes(elementId) ||
      element === document.documentElement ||
      element === document.body ||
      element === document.head
    ) {
      return false;
    }

    // Block if it has critical classes
    if (criticalClasses.some((cls) => elementClasses.includes(cls))) {
      return false;
    }

    // Block if text is too long (might be important content)
    if (text.length > 500) {
      return false;
    }

    // Block if element contains the code editor or main content
    if (
      element.querySelector(".cm-editor") ||
      element.querySelector(".monaco-editor") ||
      element.querySelector("[data-layout-path]") ||
      elementClasses.includes("monaco")
    ) {
      return false;
    }

    return true;
  }

  // Helper function to safely add element
  function safeAddElement(element, description) {
    if (!element || addedElements.has(element) || !isSafeToRemove(element)) {
      if (element && !isSafeToRemove(element)) {
        console.log(
          `❌ BLOCKED unsafe element (${description}):`,
          element.tagName,
          element.className,
        );
      }
      return;
    }

    elements.push(element);
    addedElements.add(element);
    console.log(`✅ Safe discussion element (${description}):`, element);
  }

  // Only target very specific discussion elements that are safe to remove

  // Method 1: Target the discussion tab button only (user provided exact structure)
  const discussionTabs = document.querySelectorAll(
    "div.group.flex.cursor-pointer.items-center.transition-colors.text-label-2",
  );

  for (const tab of discussionTabs) {
    const text = tab.textContent?.trim() || "";
    // Only if it's exactly "Discussion (number)" and small
    if (text.match(/^Discussion\s*\(\d+\)$/) && text.length < 20) {
      safeAddElement(tab, "discussion tab button");
    }
  }

  // Method 2: Target individual discussion posts (very conservative)
  const discussionPosts = document.querySelectorAll(
    'div[class*="border-sd-border"][class*="border-b"][class*="px-1"][class*="py-1"]',
  );

  for (const post of discussionPosts) {
    const text = post.textContent || "";
    // Only target small individual discussion posts
    if (text.length < 800 && text.length > 10) {
      safeAddElement(post, "individual discussion post");
    }
  }

  // Method 3: Target discussion rules box specifically
  const discussionRulesBoxes = document.querySelectorAll(
    'div[class*="w-full"][class*="border"][class*="p-4"]',
  );

  for (const box of discussionRulesBoxes) {
    const text = box.textContent || "";
    if (text.includes("Discussion Rules") && text.length < 500) {
      safeAddElement(box, "discussion rules box");
    }
  }

  console.log(`Found ${elements.length} discussion elements (safe method)`);
  return elements;
}

// Helper function to check if element is already marked for removal
function isAlreadyMarkedForRemoval(element, elementsToRemove) {
  return elementsToRemove.some((item) => item.element === element);
}

// Restore removed elements
function restoreRemovedElements() {
  console.log(`Restoring ${removedElements.size} removed elements`);
  let restoredCount = 0;

  removedElements.forEach((item, key) => {
    try {
      if (item.parent && item.element) {
        // Check if parent still exists in DOM
        if (document.body && document.body.contains(item.parent)) {
          if (item.nextSibling && item.parent.contains(item.nextSibling)) {
            item.parent.insertBefore(item.element, item.nextSibling);
          } else if (item.parent) {
            item.parent.appendChild(item.element);
          }
          console.log(
            `Restored ${item.type} element (${item.originalSelector}):`,
            item.element,
          );
          restoredCount++;
        } else {
          console.warn(`Parent no longer exists for ${item.type} element`);
        }
      }
    } catch (error) {
      console.error("Error restoring element:", error, item);
    }
  });

  removedElements.clear();
  hideFocusIndicator();

  console.log(`Successfully restored ${restoredCount} elements`);
  showRestorationMessage(restoredCount);
}

// Show restoration message
function showRestorationMessage(count) {
  try {
    if (!document.body) {
      console.warn("Document body not available for restoration message");
      return;
    }

    const message = document.createElement("div");
    message.innerHTML = `✅ Restored ${count} elements`;
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(90deg, #00c9a7, #4facfe);
      color: white;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      animation: leetcode-focus-slideIn 0.5s ease-out;
    `;

    if (document.body) {
      document.body.appendChild(message);
    }

    setTimeout(() => {
      if (message.parentNode) {
        message.style.animation =
          "leetcode-focus-slideOut 0.5s ease-in forwards";
        setTimeout(() => {
          if (message.parentNode) {
            message.remove();
          }
        }, 500);
      }
    }, 2000);
  } catch (error) {
    console.error("Error showing restoration message:", error);
  }
}

// Apply dark mode styles
function applyDarkModeStyles() {
  try {
    const darkModeStyle = document.getElementById("leetcode-focus-dark-mode");
    if (!darkModeStyle && document.head) {
      const style = document.createElement("style");
      style.id = "leetcode-focus-dark-mode";
      style.textContent = `
        body, html {
          background-color: #1a1a1a !important;
          color: #e0e0e0 !important;
        }
        
        [class*="bg-white"], [class*="bg-gray-50"], .ant-layout {
          background-color: #1a1a1a !important;
        }
        
        [class*="bg-gray-100"], .ant-card {
          background-color: #2d2d2d !important;
        }
        
        [class*="text-gray-900"], [class*="text-black"] {
          color: #e0e0e0 !important;
        }
        
        .monaco-editor {
          background-color: #1e1e1e !important;
        }
        
        .monaco-editor .view-lines {
          color: #d4d4d4 !important;
        }
      `;
      if (document.head) {
        document.head.appendChild(style);
      } else {
        console.warn("Cannot apply dark mode styles: document.head is null");
      }
    }
  } catch (error) {
    console.error("Error applying dark mode styles:", error);
  }
}

// Remove dark mode styles
function removeDarkModeStyles() {
  try {
    const darkModeStyle = document.getElementById("leetcode-focus-dark-mode");
    if (darkModeStyle) {
      darkModeStyle.remove();
    }
  } catch (error) {
    console.error("Error removing dark mode styles:", error);
  }
}

// Show focus mode indicator
function showFocusIndicator() {
  try {
    hideFocusIndicator(); // Remove existing first

    if (!document.body) {
      // Retry after a short delay if body is not ready
      setTimeout(() => {
        if (document.body) {
          showFocusIndicator();
        }
      }, 100);
      return;
    }

    const indicator = document.createElement("div");
    indicator.id = "leetcode-focus-indicator";
    indicator.innerHTML = "🎯 Focus Mode Active";
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(90deg, #4facfe, #00f2fe);
      color: #0f172a;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      animation: leetcode-focus-slideIn 0.5s ease-out;
    `;

    // Add animation styles
    if (
      !document.getElementById("leetcode-focus-animations") &&
      document.head
    ) {
      const animationStyle = document.createElement("style");
      animationStyle.id = "leetcode-focus-animations";
      animationStyle.textContent = `
        @keyframes leetcode-focus-slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(animationStyle);
    }

    if (document.body) {
      document.body.appendChild(indicator);
    }
  } catch (error) {
    console.error("Error showing focus indicator:", error);
  }
}

function hideFocusIndicator() {
  try {
    const indicator = document.getElementById("leetcode-focus-indicator");
    if (indicator) {
      indicator.remove();
    }
  } catch (error) {
    console.error("Error hiding focus indicator:", error);
  }
}

// Observe page changes to reapply settings when needed
function observePageChanges() {
  if (focusObserver) {
    focusObserver.disconnect();
  }

  focusObserver = new MutationObserver((mutations) => {
    let shouldReapply = false;

    mutations.forEach((mutation) => {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        // Check if significant content was added
        Array.from(mutation.addedNodes).forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this looks like a tab or major UI component
            if (
              node.classList?.contains("flexlayout__tab_button") ||
              node.classList?.contains("tab") ||
              node.textContent?.includes("Solutions") ||
              node.textContent?.includes("Hint")
            ) {
              shouldReapply = true;
            }
          }
        });
      }
    });

    if (shouldReapply && currentSettings) {
      console.log("Page content changed, reapplying focus settings");
      setTimeout(() => {
        applyFocusRules(currentSettings);
      }, 1000);
    }
  });

  if (document.body) {
    focusObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

// Setup problem navigation detection and auto-reload
function setupProblemNavigationDetection() {
  let currentProblemUrl = window.location.href;
  let lastProblemTitle = getCurrentProblemTitle();

  console.log("Setting up problem navigation detection");
  console.log("Current problem:", lastProblemTitle);
  console.log("Current URL:", currentProblemUrl);

  // Method 1: URL change detection
  const urlObserver = new MutationObserver(() => {
    const newUrl = window.location.href;
    if (newUrl !== currentProblemUrl && newUrl.includes("/problems/")) {
      const newProblemTitle = getCurrentProblemTitle();
      if (newProblemTitle && newProblemTitle !== lastProblemTitle) {
        console.log("Problem navigation detected!");
        console.log("Previous problem:", lastProblemTitle);
        console.log("New problem:", newProblemTitle);

        // Show notification before reload
        showProblemChangeNotification(newProblemTitle);

        // Reload page after short delay
        setTimeout(() => {
          console.log("Reloading page for new problem...");
          window.location.reload();
        }, 1500);
      }
    }
  });

  // Observe title changes
  const titleElement = document.querySelector("title");
  if (titleElement) {
    urlObserver.observe(titleElement, { childList: true, subtree: true });
  }

  // Method 2: Monitor navigation events
  let navigationTimer;

  // Listen for popstate events (back/forward navigation)
  window.addEventListener("popstate", () => {
    clearTimeout(navigationTimer);
    navigationTimer = setTimeout(checkForProblemChange, 1000);
  });

  // Listen for pushstate/replacestate (programmatic navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    clearTimeout(navigationTimer);
    navigationTimer = setTimeout(checkForProblemChange, 1000);
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    clearTimeout(navigationTimer);
    navigationTimer = setTimeout(checkForProblemChange, 1000);
  };

  function checkForProblemChange() {
    const newUrl = window.location.href;
    const newProblemTitle = getCurrentProblemTitle();

    if (
      newUrl !== currentProblemUrl &&
      newUrl.includes("/problems/") &&
      newProblemTitle &&
      newProblemTitle !== lastProblemTitle
    ) {
      console.log("Problem change detected via navigation!");
      console.log("Previous:", lastProblemTitle);
      console.log("New:", newProblemTitle);

      currentProblemUrl = newUrl;
      lastProblemTitle = newProblemTitle;

      showProblemChangeNotification(newProblemTitle);

      setTimeout(() => {
        console.log("Reloading page for new problem...");
        window.location.reload();
      }, 1500);
    }
  }
}

// Get current problem title for comparison
function getCurrentProblemTitle() {
  const titleSelectors = [
    '[data-cy="question-title"]',
    ".text-title-large",
    ".css-v3d350",
    "h1",
    ".question-title",
    'h1[class*="title"]',
    '[class*="question"] h1',
    '[class*="question"] h2',
  ];

  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      return element.textContent.trim();
    }
  }

  // Fallback: extract from URL
  const urlMatch = window.location.pathname.match(/\/problems\/([^\/]+)/);
  return urlMatch ? urlMatch[1].replace(/-/g, " ") : null;
}

// Show notification when problem changes
function showProblemChangeNotification(newProblem) {
  // Remove existing notification
  const existingNotification = document.getElementById(
    "leetcode-focus-problem-change-notification",
  );
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement("div");
  notification.id = "leetcode-focus-problem-change-notification";
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <i class="fas fa-sync-alt fa-spin"></i>
      <span>Problem changed to "${newProblem}" - Reloading page...</span>
    </div>
  `;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(90deg, #4facfe, #00f2fe);
    color: #0f172a;
    padding: 15px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    animation: leetcode-focus-slideIn 0.5s ease-out;
    max-width: 350px;
  `;

  document.body.appendChild(notification);
}

console.log("LeetCode Focus content script initialized successfully");

// Enhanced helper functions for better data extraction

// Extract enhanced description with key information
function extractEnhancedDescription(fullText) {
  if (!fullText) return "No description available";
  
  // Try to extract the core problem statement (usually first paragraph)
  const lines = fullText.split('\n').filter(line => line.trim());
  let description = lines.slice(0, 3).join(' ').trim();
  
  // Limit length but ensure we get meaningful content
  if (description.length > 800) {
    description = description.substring(0, 800) + "...";
  }
  
  return description || fullText.substring(0, 500);
}

// Extract examples from problem description
function extractExamples(fullText) {
  if (!fullText) return [];
  
  const examples = [];
  const exampleRegex = /Example\s*\d*:?\s*([\s\S]*?)(?=Example\s*\d|Constraints|Note:|$)/gi;
  let match;
  
  while ((match = exampleRegex.exec(fullText)) !== null && examples.length < 3) {
    const exampleText = match[1].trim();
    if (exampleText.length > 10 && exampleText.length < 500) {
      examples.push(exampleText);
    }
  }
  
  return examples;
}

// Extract constraints from problem description
function extractConstraints(fullText) {
  if (!fullText) return "";
  
  const constraintMatch = fullText.match(/Constraints?:?\s*([\s\S]*?)(?=Follow[- ]?up|Note:|Example|$)/i);
  if (constraintMatch) {
    return constraintMatch[1].trim().substring(0, 300);
  }
  
  return "";
}

// Extract follow-up questions
function extractFollowUp(fullText) {
  if (!fullText) return "";
  
  const followUpMatch = fullText.match(/Follow[- ]?up:?\s*([\s\S]*?)(?=Note:|Example|$)/i);
  if (followUpMatch) {
    return followUpMatch[1].trim().substring(0, 200);
  }
  
  return "";
}

// Normalize language names for consistency
function normalizeLanguageName(lang) {
  const languageMap = {
    'javascript': 'javascript',
    'js': 'javascript', 
    'python': 'python',
    'python3': 'python',
    'java': 'java',
    'c++': 'cpp',
    'cpp': 'cpp',
    'c': 'c',
    'csharp': 'csharp',
    'c#': 'csharp',
    'go': 'go',
    'golang': 'go',
    'rust': 'rust',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'scala': 'scala',
    'ruby': 'ruby',
    'php': 'php',
    'typescript': 'typescript',
    'ts': 'typescript'
  };
  
  return languageMap[lang] || lang;
}
