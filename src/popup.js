// Popup script for LeetCode Focus Extension
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Popup loaded");

  // Initialize popup
  await initializePopup();
  setupEventListeners();
  loadSettings();
});

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

  // AI Assistant buttons
  document
    .getElementById("get-hint-btn")
    .addEventListener("click", handleGetHint);
  document
    .getElementById("improve-code-btn")
    .addEventListener("click", handleImproveCode);

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
    ]);
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

    // Load and display API key status
    updateApiKeyStatus(result.userApiKey);
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

// Handle Get Hint button click
async function handleGetHint() {
  const button = document.getElementById("get-hint-btn");
  const responseDiv = document.getElementById("hint-response");

  try {
    // Disable button and show loading
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting Hint...';
    showLoader();

    // Get current problem info and code
    const problemData = await getCurrentProblemData();

    // Send request to background script
    const response = await sendMessage({
      action: "getHint",
      data: problemData,
    });

    hideLoader();

    if (response.success) {
      responseDiv.innerHTML = `
        <div style="background: rgba(34, 197, 94, 0.1); border-left: 3px solid #22c55e; padding: 15px; border-radius: 8px; margin-top: 10px;">
          <p><strong>💡 AI Hint for "${problemData.problemTitle}":</strong></p>
          <div style="margin-top: 10px; font-size: 13px; line-height: 1.5;">${formatAIResponse(response.data)}</div>
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
        Error: ${error.message}
      </div>
    `;
  } finally {
    // Re-enable button
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-bolt"></i> Get Hint';
  }
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

    // Send request to background script
    const response = await sendMessage({
      action: "improveCode",
      data: problemData,
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
      // Update roadmap display with better formatting
      roadmapList.innerHTML = `
        <li>
          <i class="fas fa-map-signs"></i>
          <div>
            <strong>🎯 Your Personalized ${skillLevel} Roadmap (${duration} ${duration === "1" ? "month" : "months"})</strong>
            <div class="ai-response" style="margin-top: 10px; padding: 15px; background: rgba(79, 172, 254, 0.1); border-radius: 8px; border-left: 3px solid #4facfe;">
              <div style="white-space: pre-line; font-size: 13px; line-height: 1.5;">${formatAIResponse(response.data)}</div>
            </div>
          </div>
        </li>
      `;

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
      return response.data;
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

  if (!apiKey.startsWith("AIzaSy") || apiKey.length < 30) {
    showMessage("Invalid API key format. Please check your key.", "error");
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
      showMessage("API key saved successfully!", "success");
      updateApiKeyStatus(apiKey);
      apiKeyInput.value = ""; // Clear input for security
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
