// Popup script for LeetCode Focus Extension
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Popup loaded");

  // Initialize popup
  await initializePopup();
  setupEventListeners();
  loadSettings();
});

// AI Provider configurations
const AI_PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    models: ["gemini-1.5-flash", "gemini-1.5-pro"],
    apiKeyPrefix: "AIzaSy",
    helpUrl: "https://makersuite.google.com/app/apikey",
    helpText: "Get your free API key from Google AI Studio"
  }
};

let currentProvider = "gemini";
let currentModel = "gemini-1.5-flash";
let chatHistory = [];

// Initialize popup state
async function initializePopup() {
  try {
    // Check if we're on a LeetCode page
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.url.includes("leetcode.com")) {
      showMessage(
        "Please navigate to a LeetCode problem page to use all features.",
        "info",
      );
    } else {
      // We're on LeetCode, track progress automatically
      setTimeout(() => {
        updateLearningProgress();
      }, 2000); // Wait a bit for page to fully load
    }
  } catch (error) {
    console.error("Error initializing popup:", error);
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Tab switching functionality
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchTab(tab.getAttribute("data-tab"));
    });
  });

  // AI Provider and Model selection
  document
    .getElementById("ai-provider-select")
    .addEventListener("change", handleProviderChange);
  document
    .getElementById("ai-model-select")
    .addEventListener("change", handleModelChange);

  // AI Assistant buttons
  document
    .getElementById("get-hint-btn")
    .addEventListener("click", handleGetHint);
  document
    .getElementById("improve-code-btn")
    .addEventListener("click", handleImproveCode);

  // Chatbot functionality
  document
    .getElementById("chat-send-btn")
    .addEventListener("click", handleSendChatMessage);
  document
    .getElementById("chat-input")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendChatMessage();
      }
    });

  // Chat suggestions
  document.querySelectorAll(".suggestion-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.getElementById("chat-input").value = chip.getAttribute("data-suggestion");
      handleSendChatMessage();
    });
  });

  // Focus Mode button
  document
    .getElementById("apply-focus-btn")
    .addEventListener("click", handleApplyFocusSettings);

  // Roadmap buttons
  document
    .getElementById("generate-roadmap-btn")
    .addEventListener("click", handleGenerateRoadmap);
  document
    .getElementById("select-topic-btn")
    .addEventListener("click", handleSelectTopic);

  // Theme selector
  document
    .getElementById("theme-select")
    .addEventListener("change", handleThemeChange);

  // API key save button
  document
    .getElementById("save-api-key-btn")
    .addEventListener("click", handleSaveApiKey);
}

// Switch between tabs
function switchTab(tabId) {
  // Remove active class from all tabs
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".content-section").forEach((section) => {
    section.classList.remove("active");
  });

  // Add active class to clicked tab and corresponding section
  document.querySelector(`[data-tab="${tabId}"]`).classList.add("active");
  document.getElementById(`${tabId}-section`).classList.add("active");
}

// Load saved settings
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get([
      "focusSettings",
      "uiTheme",
      "userApiKey",
      "aiProvider",
      "aiModel",
      "chatHistory"
    ]);
    // Fallback to localStorage if extension storage has no API key yet
    if (!result.userApiKey) {
      const localKey = localStorage.getItem('userApiKey');
      if (localKey) {
        result.userApiKey = localKey;
      }
    }
    
    if (result.focusSettings) {
      const settings = result.focusSettings;
      document.getElementById("hide-solutions").checked =
        settings.hideSolutions ?? true;
      document.getElementById("hide-hints").checked =
        settings.hideHints ?? true;
      document.getElementById("hide-difficulty").checked =
        settings.hideDifficulty ?? false;
    }

    // Load and apply theme
    const theme = result.uiTheme || "dark";
    document.getElementById("theme-select").value = theme;
    applyTheme(theme);

    // Load AI provider and model settings
    currentProvider = result.aiProvider || "gemini";
    currentModel = result.aiModel || "gemini-1.5-flash";
    
    document.getElementById("ai-provider-select").value = currentProvider;
    updateModelOptions();
    document.getElementById("ai-model-select").value = currentModel;
    updateApiKeyHelp();

    // Load and display API key status
    updateApiKeyStatus(result.userApiKey);

    // Load chat history
    if (result.chatHistory) {
      chatHistory = result.chatHistory;
      renderChatHistory();
    }

    // Update chat status
    updateChatStatus(result.userApiKey);
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

// Update chat status indicator
function updateChatStatus(apiKey) {
  const statusIndicator = document.getElementById("chat-status-indicator");
  const statusText = document.getElementById("chat-status-text");
  
  if (apiKey && apiKey.length > 10) {
    statusIndicator.className = "status-indicator online";
    statusText.innerHTML = `Ready to chat with ${AI_PROVIDERS[currentProvider].name}`;
  } else {
    statusIndicator.className = "status-indicator offline";
    statusText.innerHTML = "Please configure API key above";
  }
}

// Handle AI provider change
async function handleProviderChange() {
  const providerSelect = document.getElementById("ai-provider-select");
  currentProvider = providerSelect.value;
  
  updateModelOptions();
  updateApiKeyHelp();
  
  // Update chat status with current API key
  const result = await chrome.storage.local.get(["userApiKey"]);
  updateChatStatus(result.userApiKey);
  
  // Save provider selection
  await chrome.storage.local.set({ aiProvider: currentProvider });
  
  // Update backend settings
  await sendMessage({
    action: "updateAISettings",
    data: { provider: currentProvider, model: currentModel }
  });
  
  console.log("AI provider changed to:", currentProvider);
}

// Handle AI model change
async function handleModelChange() {
  const modelSelect = document.getElementById("ai-model-select");
  currentModel = modelSelect.value;
  
  // Save model selection
  await chrome.storage.local.set({ aiModel: currentModel });
  
  // Update backend settings
  await sendMessage({
    action: "updateAISettings",
    data: { provider: currentProvider, model: currentModel }
  });
  
  console.log("AI model changed to:", currentModel);
}

// Update model dropdown based on selected provider
function updateModelOptions() {
  const modelSelect = document.getElementById("ai-model-select");
  const provider = AI_PROVIDERS[currentProvider];
  
  modelSelect.innerHTML = "";
  provider.models.forEach(model => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  });
  
  // Set default model for the provider
  currentModel = provider.models[0];
  modelSelect.value = currentModel;
}

// Update API key help text based on selected provider
function updateApiKeyHelp() {
  const provider = AI_PROVIDERS[currentProvider];
  const helpText = document.getElementById("api-help-text");
  const helpLink = document.getElementById("api-help-link");
  
  helpText.textContent = provider.helpText;
  helpLink.href = provider.helpUrl;
}

// Handle Get Hint button click
async function handleGetHint() {
  const button = document.getElementById("get-hint-btn");
  const responseDiv = document.getElementById("hint-response");

  try {
    // Disable button and show loading
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting Smart Hint...';
    showLoader();

    // Get hint preferences
    const includeApproach = document.getElementById("hint-include-approach").checked;
    const includeEdgeCases = document.getElementById("hint-include-edge-cases").checked;
    const includeComplexity = document.getElementById("hint-include-complexity").checked;

    // Get current problem info and code
    const problemData = await getCurrentProblemData();

    // Send request to background script with enhanced options
    const response = await sendMessage({
      action: "getHint",
      data: {
        ...problemData,
        provider: currentProvider,
        model: currentModel,
        hintOptions: {
          includeApproach,
          includeEdgeCases,
          includeComplexity
        }
      },
    });

    hideLoader();

    if (response.success) {
      responseDiv.innerHTML = `
        <div class="smart-hint-response">
          <div class="hint-header">
            <i class="fas fa-lightbulb"></i>
            <h4>Smart Hint for "${problemData.problemTitle}"</h4>
            <span class="ai-badge">${AI_PROVIDERS[currentProvider].name}</span>
          </div>
          <div class="hint-content">
            ${formatEnhancedHintResponse(response.data, {
              includeApproach,
              includeEdgeCases,
              includeComplexity
            })}
          </div>
        </div>
      `;
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    hideLoader();
    console.error("Error getting hint:", error);
    responseDiv.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <h4>Error Getting Hint</h4>
        <p>${error.message}</p>
        <p class="error-suggestion">Try checking your API key or switching to a different AI provider.</p>
      </div>
    `;
  } finally {
    // Re-enable button
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-bolt"></i> Get Smart Hint';
  }
}

// Handle chat message sending
async function handleSendChatMessage() {
  const chatInput = document.getElementById("chat-input");
  const sendButton = document.getElementById("chat-send-btn");
  const message = chatInput.value.trim();

  if (!message) return;

  // Check if API key is configured
  const result = await chrome.storage.local.get(["userApiKey"]);
  if (!result.userApiKey) {
    addChatMessage("⚠️ Please configure your API key first. Go to the AI Provider & Model section above to add your API key.", 'ai');
    return;
  }

  try {
    // Disable input and button
    chatInput.disabled = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    // Add user message to chat
    addChatMessage(message, 'user');
    chatInput.value = '';

    // Get current problem context (includes detected language)
    const problemData = await getCurrentProblemData();

    // Derive a lightweight intent so background can tailor prompt further
    const intent = detectUserIntent(message);

    // Append quick inline meta so model stays concise & language‑aware
    const enrichedMessage = `${message}\n\n[INTENT:${intent}|LANG:${problemData.language || 'javascript'}|FORMAT:CONCISE_SNIPPETS]`;

    // Send to AI
    const response = await sendMessage({
      action: "chatMessage",
      data: {
        message: enrichedMessage,
        chatHistory,
        problemData,
        provider: currentProvider,
        model: currentModel,
        intent,
        language: problemData.language || 'javascript'
      }
    });

    if (response.success) {
      // Enforce client-side snippet limiting as final safeguard
      const sanitized = limitAISnippets(response.data);
      addChatMessage(sanitized, 'ai');
    } else {
      // Provide specific error feedback
      let errorMessage = "I'm having trouble connecting. ";
      if (response.error && response.error.includes("API key")) {
        errorMessage += "Please check your API key configuration above.";
      } else if (response.error && response.error.includes("quota")) {
        errorMessage += "It looks like you've reached your API quota. Please check your account or try a different provider.";
      } else if (response.error && response.error.includes("network")) {
        errorMessage += "There seems to be a network issue. Please try again in a moment.";
      } else {
        errorMessage += "Please try again or switch to a different AI provider in the settings above.";
      }
      addChatMessage(errorMessage, 'ai');
    }

  } catch (error) {
    console.error("Error sending chat message:", error);
    addChatMessage("I'm experiencing technical difficulties. Please check your internet connection and API configuration, then try again.", 'ai');
  } finally {
    // Re-enable input and button
    chatInput.disabled = false;
    sendButton.disabled = false;
    sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
    chatInput.focus();
  }
}

// Heuristic user intent detection
function detectUserIntent(text) {
  const t = text.toLowerCase();
  if (/(optimi[zs]e|improv|refactor)/.test(t)) return 'IMPROVE_CODE';
  if (/(complexity|big ?o|time|space)/.test(t)) return 'ASK_COMPLEXITY';
  if (/(edge case|edgecase|corner case)/.test(t)) return 'ASK_EDGE_CASES';
  if (/(approach|strategy|how to start)/.test(t)) return 'ASK_APPROACH';
  if (/(why.*fail|bug|error|wrong)/.test(t)) return 'DEBUGGING';
  if (/(example|test case)/.test(t)) return 'ASK_EXAMPLES';
  return 'GENERAL_HELP';
}

// Trim / limit large code blocks & remove full solutions (extra safety in UI layer)
function limitAISnippets(text) {
  // Collapse long fenced code blocks (>12 lines)
  return text.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, body) => {
    const lines = body.trim().split(/\n/);
    if (lines.length > 12) {
      return '```' + (lang || '') + '\n' + lines.slice(0,6).join('\n') + '\n// ... snippet trimmed (focus on key logic)\n```';
    }
    return m;
  }).replace(/class\s+\w+[\s\S]{40,}?\{/g, '// Class definition trimmed').replace(/function\s+\w+\s*\([^)]*\)\s*{[\s\S]{80,}?}/g, '// Function body trimmed for brevity');
}

// Add message to chat UI and history
function addChatMessage(message, sender) {
  const chatMessages = document.getElementById("chat-messages");
  
  // Create message object
  const messageObj = {
    content: message,
    sender: sender,
    timestamp: new Date().toISOString()
  };

  // Add to chat history
  chatHistory.push(messageObj);
  
  // Keep only last 20 messages to prevent memory issues
  if (chatHistory.length > 20) {
    chatHistory = chatHistory.slice(-20);
  }

  // Save to storage
  chrome.storage.local.set({ chatHistory });

  // Create HTML element
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${sender}-message`;
  
  messageDiv.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-${sender === 'ai' ? 'robot' : 'user'}"></i>
    </div>
    <div class="message-content">
      ${formatChatMessage(message)}
    </div>
  `;

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Render existing chat history
function renderChatHistory() {
  const chatMessages = document.getElementById("chat-messages");
  
  // Clear existing messages except welcome message
  const welcomeMessage = chatMessages.querySelector('.ai-message');
  chatMessages.innerHTML = '';
  if (welcomeMessage) {
    chatMessages.appendChild(welcomeMessage);
  }

  // Render chat history
  chatHistory.forEach(msg => {
    if (msg.sender && msg.content) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `chat-message ${msg.sender}-message`;
      
      messageDiv.innerHTML = `
        <div class="message-avatar">
          <i class="fas fa-${msg.sender === 'ai' ? 'robot' : 'user'}"></i>
        </div>
        <div class="message-content">
          ${formatChatMessage(msg.content)}
        </div>
      `;

      chatMessages.appendChild(messageDiv);
    }
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Format chat message content
function formatChatMessage(content) {
  // Enhanced formatting for better AI chat responses
  let formatted = content
    // Handle code blocks with language specification
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<div class="code-block-container">
        ${lang ? `<div class="code-language">${lang}</div>` : ''}
        <pre class="code-block ${lang || 'text'}"><code>${code.trim()}</code></pre>
      </div>`;
    })
    // Handle inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Handle headers
    .replace(/^### (.*$)/gm, '<h4 class="chat-subheader">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 class="chat-header">$1</h3>')
    .replace(/^# (.*$)/gm, '<h2 class="chat-main-header">$1</h2>')
    // Handle emoji sections (🎯, ⚠️, 📊, etc.)
    .replace(/^[🎯⚠️📊💡🔍📝💻🚀⭐🧑‍🏫👨‍💻]\s*\*\*(.*?)\*\*:?\s*/gm, (match, text) => {
      const emoji = match.charAt(0);
      return `<div class="chat-section"><span class="chat-emoji">${emoji}</span><strong class="chat-section-title">${text}</strong></div><div class="chat-content">`;
    })
    // Close chat content divs
    .replace(/(<div class="chat-content">[\s\S]*?)(?=<div class="chat-section">|$)/g, '$1</div>')
    // Handle bold text
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="chat-bold">$1</strong>')
    // Handle italic text
    .replace(/\*([^*]+)\*/g, '<em class="chat-italic">$1</em>')
    // Handle bullet points with improved styling
    .replace(/^[-•]\s*(.+)/gm, '<li class="chat-bullet">$1</li>')
    // Wrap consecutive li elements in ul
    .replace(/(<li class="chat-bullet">.*<\/li>)+/gs, '<ul class="chat-list">$&</ul>')
    // Handle numbered lists
    .replace(/^\d+\.\s*(.+)/gm, '<li class="chat-numbered">$1</li>')
    .replace(/(<li class="chat-numbered">.*<\/li>)+/gs, '<ol class="chat-numbered-list">$&</ol>')
    // Handle complexity mentions
    .replace(/(\*\*Time\*\*:\s*[^<\n]+)(?:<br>)?(\*\*Space\*\*:\s*[^<\n]+)/g, 
      '<div class="chat-complexity"><span class="time-complexity">$1</span><br><span class="space-complexity">$2</span></div>')
    // Handle encouragement
    .replace(/(💪|🎉|✨|🌟)\s*\*\*([^*]+)\*\*(.*?)$/gm,
      '<div class="chat-encouragement"><span class="encourage-emoji">$1</span><strong>$2</strong>$3</div>')
    // Handle line breaks
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  return `<div class="enhanced-chat-content">${formatted}</div>`;
}

// Format enhanced hint response
function formatEnhancedHintResponse(content, options) {
  // Enhanced formatting for better AI responses
  let formatted = content
    // Bold formatting
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic formatting
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Inline code formatting
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Code blocks with syntax highlighting
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre class="code-block ${lang || 'text'}"><code>${code.trim()}</code></pre>`;
    })
    // Headers
    .replace(/^### (.*$)/gm, '<h4 class="hint-subheader">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 class="hint-header">$1</h3>')
    .replace(/^# (.*$)/gm, '<h2 class="hint-main-header">$1</h2>')
    // Emoji bullets and improved list formatting
    .replace(/^[🎯⚠️📊💡🔍📝💻🚀⭐]\s*\*\*(.*?)\*\*:?\s*/gm, (match, text) => {
      const emoji = match.charAt(0);
      return `<div class="hint-section"><span class="hint-emoji">${emoji}</span><strong class="hint-section-title">${text}</strong></div><div class="hint-content">`;
    })
    // Close hint content divs (this is a bit hacky but works for the structure)
    .replace(/(<div class="hint-content">[\s\S]*?)(?=<div class="hint-section">|$)/g, '$1</div>')
    // Regular bullet points
    .replace(/^[-•]\s*(.+)/gm, '<li class="hint-bullet">$1</li>')
    // Wrap consecutive li elements in ul
    .replace(/(<li class="hint-bullet">.*<\/li>)+/gs, '<ul class="hint-list">$&</ul>')
    // Line breaks
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  
  // Add special styling for complexity analysis
  formatted = formatted.replace(
    /(\*\*Time\*\*:\s*[^<]+)(?:<br>)?(\*\*Space\*\*:\s*[^<]+)/g,
    '<div class="complexity-analysis"><span class="time-complexity">$1</span><br><span class="space-complexity">$2</span></div>'
  );
  
  // Add encouraging conclusion styling
  formatted = formatted.replace(
    /(💪|🎉|✨|🌟)\s*\*\*([^*]+)\*\*(.*?)$/gm,
    '<div class="encouragement"><span class="encourage-emoji">$1</span><strong>$2</strong>$3</div>'
  );
  
  return `<div class="enhanced-hint-content">${formatted}</div>`;
}

// Handle Improve Code button click
async function handleImproveCode() {
  const button = document.getElementById("improve-code-btn");
  const codeBlock = document.getElementById("code-sample");

  try {
    // Disable button and show loading
    button.disabled = true;
    button.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Improving Code...';
    showLoader();

    // Get current problem and code
    const problemData = await getCurrentProblemData();

    if (!problemData.userCode || problemData.userCode.trim() === "") {
      throw new Error(
        "No code found. Please write some code in the LeetCode editor first.",
      );
    }

    // Send request to background script with new AI settings
    const response = await sendMessage({
      action: "improveCode",
      data: {
        ...problemData,
        provider: currentProvider,
        model: currentModel
      },
    });

    hideLoader();

    if (response.success) {
      const improvedCode = extractCodeFromResponse(response.data);
      codeBlock.innerHTML = `
        <div class="code-improvement">
          <p><strong>🚀 Code Optimization for "${problemData.problemTitle}":</strong></p>
          ${improvedCode ? `<pre class="improved-code-block"><code>${improvedCode}</code></pre>` : ""}
          <div class="improvement-explanation">
            ${formatAIResponse(response.data)}
          </div>
        </div>
      `;

      // Add revert button
      addRevertButton(codeBlock, problemData.userCode);

      // Show success message
      showMessage("✅ Code optimization suggestions generated!", "success");
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    hideLoader();
    console.error("Error improving code:", error);
    codeBlock.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        Error: ${error.message}
      </div>
    `;
  } finally {
    // Re-enable button
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-magic"></i> Improve Code';
  }
}

// Handle Apply Focus Settings button click
async function handleApplyFocusSettings() {
  const button = document.getElementById("apply-focus-btn");

  try {
    // Disable button temporarily
    button.disabled = true;
    button.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Applying Settings...';

    // Get current settings
    const settings = {
      hideSolutions: document.getElementById("hide-solutions").checked,
      hideHints: document.getElementById("hide-hints").checked,
      hideDifficulty: document.getElementById("hide-difficulty").checked,
    };

    // Send to background script
    const response = await sendMessage({
      action: "applyFocusSettings",
      data: settings,
    });

    if (response.success) {
      showMessage("Focus settings applied successfully!", "success");
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("Error applying focus settings:", error);
    showMessage(`Error: ${error.message}`, "error");
  } finally {
    // Re-enable button
    button.disabled = false;
    button.innerHTML =
      '<i class="fas fa-check-circle"></i> Apply Focus Settings';
  }
}

// Handle Generate Roadmap button click
async function handleGenerateRoadmap() {
  const button = document.getElementById("generate-roadmap-btn");
  const roadmapList = document.getElementById("roadmap-progress");

  try {
    button.disabled = true;
    button.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Generating Roadmap...';
    showLoader();

    // Get user inputs for roadmap generation
    const skillLevel = document.getElementById("skill-level").value;
    const duration = document.getElementById("duration").value;

    const roadmapData = {
      skillLevel: skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1),
      focusAreas: "Arrays, Trees, Dynamic Programming, System Design",
      timeframe: `${duration} ${duration === "1" ? "month" : "months"}`,
      duration: parseInt(duration),
    };

    const response = await sendMessage({
      action: "generateRoadmap",
      data: roadmapData,
    });

    hideLoader();

    if (response.success) {
      // Extract only sequence of questions & topics from AI response
      const minimal = extractRoadmapSequence(response.data);
      roadmapList.innerHTML = minimal.map((item, idx)=>`
        <li>
          <span style="font-weight:600;color:#4facfe;">${idx+1}.</span>
          <div style="margin-left:6px;">
            <div style="font-size:13px;">${item.question}</div>
            <div style="font-size:11px;color:#9bb3c9;">Topics: ${item.topics.join(', ') || 'General'}</div>
          </div>
        </li>`).join('');

      // Show success message
      showMessage(
        `✅ Roadmap generated for ${skillLevel} level (${duration} months)!`,
        "success",
      );
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    hideLoader();
    console.error("Error generating roadmap:", error);
    showMessage(`Error: ${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-magic"></i> Generate AI Roadmap';
  }
}

// Extract minimal roadmap (sequence + topics) from raw AI response text
function extractRoadmapSequence(text) {
  if (!text) return [];
  const lines = text.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  const items = [];
  const lineRegex = /^(?:\d+\.|-)?\s*(?:Q:?\s*)?(.+?)(?:\s*[-–]\s*(Topics?|Focus):\s*(.+))?$/i;
  lines.forEach(l=>{
    const m = l.match(lineRegex);
    if (!m) return;
    let question = m[1].replace(/\*|\(|\)|\[|\]/g,'').trim();
    if (question.length > 120) question = question.slice(0,117)+'…';
    const topicsRaw = (m[3]||'').split(/[,\/]/).map(t=>t.trim()).filter(t=>t && t.length<40);
    // Heuristic: ignore lines that are headings
    if (/roadmap|month|week|goal/i.test(question) && topicsRaw.length===0) return;
    // Basic de-dup by question start
    if (!items.some(i=>i.question.toLowerCase().startsWith(question.toLowerCase().slice(0,20)))) {
      items.push({question, topics: topicsRaw.slice(0,4)});
    }
  });
  return items.slice(0,40); // cap length
}

// Handle Select Topic button click
async function handleSelectTopic() {
  try {
    showMessage("Starting Arrays & Hashing learning path...", "info");

    // Record learning path start
    await recordLearningPathEvent("start", "Arrays & Hashing");

    // Update progress tracking
    await updateLearningProgress();

    // Navigate to first problem or show learning path
    showLearningPath();
  } catch (error) {
    console.error("Error starting learning path:", error);
    showMessage("Error starting learning path. Please try again.", "error");
  }
}

// Record learning path events for analytics
async function recordLearningPathEvent(eventType, topic, problemData = null) {
  try {
    const eventData = {
      timestamp: new Date().toISOString(),
      eventType: eventType, // 'start', 'problem_solved', 'progress_update'
      topic: topic,
      problemData: problemData,
      sessionId: await getOrCreateSessionId(),
    };

    // Get existing learning data
    const result = await chrome.storage.local.get(["learningData"]);
    const learningData = result.learningData || [];

    // Add new event
    learningData.push(eventData);

    // Keep only last 1000 events to prevent storage bloat
    if (learningData.length > 1000) {
      learningData.splice(0, learningData.length - 1000);
    }

    // Save back to storage
    await chrome.storage.local.set({ learningData: learningData });

    console.log("Learning event recorded:", eventData);
  } catch (error) {
    console.error("Error recording learning event:", error);
  }
}

// Get or create session ID for tracking
async function getOrCreateSessionId() {
  try {
    const result = await chrome.storage.local.get(["sessionId"]);

    if (result.sessionId) {
      return result.sessionId;
    }

    // Create new session ID
    const sessionId =
      "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    await chrome.storage.local.set({ sessionId: sessionId });
    return sessionId;
  } catch (error) {
    console.error("Error managing session ID:", error);
    return "session_fallback_" + Date.now();
  }
}

// Update learning progress based on current problem
async function updateLearningProgress() {
  try {
    // Get current problem data
    const problemData = await getCurrentProblemData();

    if (
      problemData.problemTitle &&
      problemData.problemTitle !== "Unknown Problem"
    ) {
      // Check if this is a solved problem (basic heuristic)
      const isSolved = await checkIfProblemSolved(problemData);

      if (isSolved) {
        // Record problem solved
        await recordLearningPathEvent("problem_solved", "Current Session", {
          title: problemData.problemTitle,
          language: problemData.language,
          codeLength: problemData.userCode.length,
        });

        // Update problem status in storage
        await updateProblemStatus(problemData.problemTitle, "completed");

        showMessage(
          `Problem "${problemData.problemTitle}" marked as completed!`,
          "success",
        );
      }
    }
  } catch (error) {
    console.error("Error updating learning progress:", error);
  }
}

// Check if problem appears to be solved (heuristic)
async function checkIfProblemSolved(problemData) {
  // Simple heuristics to detect if problem is likely solved
  const hasCode =
    problemData.userCode && problemData.userCode.trim().length > 50;
  const hasReturnStatement =
    problemData.userCode && problemData.userCode.includes("return");
  const hasControlFlow =
    problemData.userCode &&
    (problemData.userCode.includes("if") ||
      problemData.userCode.includes("for") ||
      problemData.userCode.includes("while"));

  // More sophisticated check could involve running test cases
  return hasCode && hasReturnStatement && hasControlFlow;
}

// Update problem status in storage
async function updateProblemStatus(problemTitle, status) {
  try {
    const result = await chrome.storage.local.get(["problemProgress"]);
    const problemProgress = result.problemProgress || {};

    problemProgress[problemTitle] = {
      status: status,
      completedAt: new Date().toISOString(),
      attempts: (problemProgress[problemTitle]?.attempts || 0) + 1,
    };

    await chrome.storage.local.set({ problemProgress: problemProgress });
  } catch (error) {
    console.error("Error updating problem status:", error);
  }
}

// Show learning path interface
function showLearningPath() {
  try {
    const roadmapList = document.getElementById("roadmap-progress");

    if (roadmapList) {
      // Add learning path guidance
      const learningPathHTML = `
        <li style="background: rgba(79, 172, 254, 0.1); border-left-color: #4facfe;">
          <i class="fas fa-play"></i>
          <div>
            <strong>Arrays & Hashing Learning Path Started</strong>
            <div class="status-indicator">
              <span class="status-dot in-progress"></span>
              Active Path
            </div>
            <p style="font-size: 12px; margin-top: 8px; color: #a0b3d0;">
              Next: Solve Two Sum problem. Your progress will be automatically tracked.
            </p>
          </div>
        </li>
      `;

      roadmapList.insertAdjacentHTML("afterbegin", learningPathHTML);
    } else {
      console.warn("Roadmap progress list not found");
    }
  } catch (error) {
    console.error("Error showing learning path:", error);
  }
}

// Get current problem data from LeetCode page
async function getCurrentProblemData() {
  try {
    const response = await sendMessage({ action: "getCurrentCode" });

    if (response.success) {
      const data = response.data || {};
      // Update detected language badge
      try {
        const badge = document.getElementById('detected-language-value');
        if (badge && data.language) badge.textContent = data.language;
      } catch(e) {}
      return data;
    } else {
      // Fallback data if content script fails
      return {
        problemTitle: "Current Problem",
        problemDescription: "",
        userCode: "",
        language: "javascript",
      };
    }
  } catch (error) {
    console.error("Error getting current problem data:", error);
    return {
      problemTitle: "Unknown Problem",
      problemDescription: "",
      userCode: "",
      language: "javascript",
    };
  }
}

// Send message to background script
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: chrome.runtime.lastError.message,
        });
      } else {
        resolve(response);
      }
    });
  });
}

// Show loading spinner
function showLoader() {
  document.getElementById("loader").style.display = "block";
}

// Hide loading spinner
function hideLoader() {
  document.getElementById("loader").style.display = "none";
}

// Show message to user
function showMessage(message, type = "info") {
  try {
    // Create message element
    const messageEl = document.createElement("div");
    messageEl.className = `${type}-message`;
    messageEl.innerHTML = `
      <i class="fas fa-${getIconForType(type)}"></i>
      ${message}
    `;

    // Insert at top of active content section with null checks
    const activeSection = document.querySelector(".content-section.active");
    if (activeSection) {
      activeSection.insertBefore(messageEl, activeSection.firstChild);
    } else {
      // Fallback: append to container if active section not found
      const container = document.querySelector(".container");
      if (container) {
        container.appendChild(messageEl);
      } else {
        console.warn("No suitable container found for message");
        return;
      }
    }

    // Remove after 5 seconds
    setTimeout(() => {
      if (messageEl && messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 5000);
  } catch (error) {
    console.error("Error showing message:", error);
  }
}

// Get icon for message type
function getIconForType(type) {
  switch (type) {
    case "success":
      return "check-circle";
    case "error":
      return "exclamation-triangle";
    case "info":
    default:
      return "info-circle";
  }
}

// Format AI response for display with better formatting
function formatAIResponse(response) {
  // Enhanced formatting for AI responses
  return response
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold text
    .replace(/\* /g, "• ") // Convert asterisks to bullet points
    .replace(/- /g, "• ") // Convert dashes to bullet points
    .replace(/\n\n/g, "</p><p>") // Double newlines to paragraphs
    .replace(/\n/g, "<br>") // Single newlines to line breaks
    .replace(
      /• (.*?)(<br>|$)/g,
      "<div style='margin-left: 15px; margin-bottom: 5px;'>• $1</div>",
    ); // Style bullet points
}

// Extract code from AI response
function extractCodeFromResponse(response) {
  // Look for code blocks in the response
  const codeMatch = response.match(/```[\s\S]*?```/);
  if (codeMatch) {
    return codeMatch[0].replace(/```\w*\n?/g, "").replace(/```/g, "");
  }
  return null;
}

// Add revert button for code improvements
function addRevertButton(container, originalCode) {
  try {
    if (!container) {
      console.warn("Cannot add revert button: container is null");
      return;
    }

    const revertBtn = document.createElement("button");
    revertBtn.className = "btn secondary";
    revertBtn.style.marginTop = "10px";
    revertBtn.innerHTML = '<i class="fas fa-undo"></i> Revert to Original';

    revertBtn.addEventListener("click", function () {
      if (container) {
        container.innerHTML = `<p>${originalCode || "Your code will appear here..."}</p>`;
      }
    });

    container.appendChild(revertBtn);
  } catch (error) {
    console.error("Error adding revert button:", error);
  }
}

// Handle theme change
async function handleThemeChange() {
  const themeSelect = document.getElementById("theme-select");
  const selectedTheme = themeSelect.value;

  try {
    // Save theme preference
    await chrome.storage.local.set({ uiTheme: selectedTheme });

    // Apply theme immediately
    applyTheme(selectedTheme);

    console.log("Theme changed to:", selectedTheme);
  } catch (error) {
    console.error("Error changing theme:", error);
  }
}

// Apply theme to popup UI
function applyTheme(theme) {
  const body = document.body;

  if (theme === "light") {
    body.classList.add("light-theme");
    body.classList.remove("dark-theme");
  } else {
    body.classList.add("dark-theme");
    body.classList.remove("light-theme");
  }

  console.log("Applied theme:", theme);
}

// Handle API key save
async function handleSaveApiKey() {
  const apiKeyInput = document.getElementById("api-key-input");
  const saveButton = document.getElementById("save-api-key-btn");
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showMessage("Please enter a valid API key", "error");
    return;
  }

  // Validate API key format based on provider
  const provider = AI_PROVIDERS[currentProvider];
  if (!apiKey.startsWith(provider.apiKeyPrefix)) {
    showMessage(`Invalid API key format for ${provider.name}. Key should start with "${provider.apiKeyPrefix}"`, "error");
    return;
  }

  if (apiKey.length < 20) {
    showMessage("API key appears to be too short. Please check your key.", "error");
    return;
  }

  try {
    // Disable button temporarily
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    // Save API key to storage
    await chrome.storage.local.set({ userApiKey: apiKey });

    // Update backend with new API key
    const response = await sendMessage({
      action: "updateApiKey",
      data: { apiKey: apiKey },
    });

    if (response.success) {
      showMessage(`API key saved successfully for ${provider.name}!`, "success");
      updateApiKeyStatus(apiKey);
      updateChatStatus(apiKey);
      apiKeyInput.value = ""; // Clear input for security
  // Also persist to localStorage per user request
  try { localStorage.setItem('userApiKey', apiKey); } catch(e) { console.warn('localStorage set failed', e); }
    } else {
      throw new Error(response.error || "Failed to update API key");
    }
  } catch (error) {
    console.error("Error saving API key:", error);
    showMessage(`Error saving API key: ${error.message}`, "error");
  } finally {
    // Re-enable button
    saveButton.disabled = false;
    saveButton.innerHTML = '<i class="fas fa-save"></i> Save Key';
  }
}

// Update API key status display
function updateApiKeyStatus(apiKey) {
  const statusElement = document.getElementById("api-key-status");
  const statusText = statusElement.querySelector(".status-text");

  if (apiKey && apiKey.length > 10) {
    statusElement.className = "api-key-status configured";
    statusText.innerHTML = `
      <i class="fas fa-check-circle"></i>
      API key configured (${apiKey.substring(0, 8)}...${apiKey.slice(-4)})
    `;
  } else {
    statusElement.className = "api-key-status not-configured";
    statusText.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      No API key configured
    `;
  }
}

// Error handling for popup
window.addEventListener("error", (event) => {
  console.error("Popup error:", event.error);
  // Show user-friendly error message for critical errors
  if (
    event.error &&
    event.error.message &&
    event.error.message.includes("Cannot read properties of null")
  ) {
    showMessage("Extension reloaded. Please try your action again.", "info");
  }
});

// Handle unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  event.preventDefault(); // Prevent the default browser error handling
});

console.log("Popup script loaded successfully");
