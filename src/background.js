// Background script for handling Gemini API calls and extension lifecycle
let GEMINI_API_KEY = "AIzaSyAhpPCSPoDm6MliXwHCMoRVx3lleCMp2jE"; // Default fallback key
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// Load user's custom API key on startup
async function loadUserApiKey() {
  try {
    const result = await chrome.storage.local.get(["userApiKey"]);
    if (result.userApiKey) {
      GEMINI_API_KEY = result.userApiKey;
      console.log(
        "Loaded user API key:",
        GEMINI_API_KEY.substring(0, 10) + "...",
      );
    }
  } catch (error) {
    console.error("Error loading user API key:", error);
  }
}

// Initialize API key on startup
loadUserApiKey();

// Installation handler
chrome.runtime.onInstalled.addListener(() => {
  console.log("LeetCode Focus Extension installed");

  // Initialize default settings
  chrome.storage.local.set({
    focusSettings: {
      hideSolutions: true,
      hideHints: true,
      hideDifficulty: false,
    },
    uiTheme: "dark",
    roadmapProgress: {
      "Two Sum": "completed",
      "Valid Anagram": "in-progress",
      "Group Anagrams": "not-started",
      "Top K Frequent Elements": "not-started",
    },
  });
});

// Message handler for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);

  switch (request.action) {
    case "getHint":
      handleGetHint(request.data, sendResponse);
      return true; // Keep message channel open for async response

    case "improveCode":
      handleImproveCode(request.data, sendResponse);
      return true;

    case "generateRoadmap":
      handleGenerateRoadmap(request.data, sendResponse);
      return true;

    case "applyFocusSettings":
      handleApplyFocusSettings(request.data, sendResponse);
      return true;

    case "getCurrentCode":
      handleGetCurrentCode(sendResponse);
      return true;

    case "updateApiKey":
      handleUpdateApiKey(request.data, sendResponse);
      return true;

    default:
      sendResponse({ error: "Unknown action" });
  }
});

// Get hint from Gemini API
async function handleGetHint(data, sendResponse) {
  try {
    const { problemTitle, problemDescription, userCode } = data;

    const prompt = `
You are an expert coding mentor for LeetCode problems. Analyze the user's current approach and provide a helpful hint that guides them toward the optimal solution without giving it away.

Problem: ${problemTitle}
Description: ${problemDescription || "No description provided"}
User's current code: ${userCode || "No code provided yet"}

${
  userCode
    ? "Based on their current code, provide guidance on improvements or next steps."
    : "Since no code is provided yet, give them a strong starting direction."
}

Provide a helpful hint (100 words or less) that includes:
1. **Approach**: Key algorithm or technique to use
2. **Data Structure**: Most suitable data structure
3. **Key Insight**: One crucial observation about the problem
4. **Edge Case**: Important case to handle
5. **Complexity Goal**: Target time/space complexity

Be specific and actionable. Reference Striver's A2Z DSA course concepts when applicable.

Example format:
• **Approach**: Two-pointer technique
• **Data Structure**: HashMap for O(1) lookups
• **Key Insight**: Sort first, then use pointers
• **Edge Case**: Handle duplicate values
• **Complexity Goal**: O(n) time, O(1) space
    `;

    const response = await callGeminiAPI(prompt);
    sendResponse({ success: true, data: response });
  } catch (error) {
    console.error("Error getting hint:", error);

    // Provide fallback hint with error context
    const fallbackHint = getFallbackHint(data.problemTitle);
    console.log("Using fallback hint due to API error");
    sendResponse({ success: true, data: fallbackHint });
  }
}

// Fallback hints when API fails
function getFallbackHint(problemTitle) {
  const fallbacks = {
    "Two Sum":
      "💡 **Hint**: Use a hash map to store numbers and indices. For each number, check if (target - current) exists in the map. This achieves O(n) time vs O(n²) brute force. **Edge**: Don't reuse same index. **Approach**: One-pass with complement lookup.",
    "Valid Anagram":
      "💡 **Hint**: Compare character frequencies between strings. Either sort both strings O(n log n) or use frequency counter O(n). **Edge**: Different lengths = false immediately. **Optimal**: Hash map counting.",
    "Group Anagrams":
      "💡 **Hint**: Group by 'signature' - anagrams share same sorted characters or frequency pattern. Use hash map with signature as key, array of anagrams as value. **Time**: O(n × k log k) where k=avg string length.",
    default:
      "💡 **General Hint**: Identify the core operation needed. Consider: Hash maps for O(1) lookups, two pointers for sorted arrays, stack for parentheses/nesting. **Edge cases**: Empty inputs, single elements, duplicates. **Complexity**: Aim for better than brute force.",
  };

  return fallbacks[problemTitle] || fallbacks.default;
}

// Improve code using Gemini API
async function handleImproveCode(data, sendResponse) {
  try {
    const { problemTitle, userCode, language } = data;

    if (!userCode || userCode.trim() === "") {
      sendResponse({
        success: false,
        error:
          "No code found. Please write some code in the LeetCode editor first.",
      });
      return;
    }

    const prompt = `
You are a senior software engineer conducting a code review. Analyze the user's LeetCode solution and provide optimization suggestions.

Problem: ${problemTitle}
Language: ${language || "JavaScript"}
User's Current Code:
${userCode}

Analyze their current approach and provide:

1. **Code Analysis**: What approach are they using?
2. **Optimization Opportunities**: Where can it be improved?
3. **Better Algorithm**: Suggest optimal approach from Striver's A2Z DSA patterns
4. **Optimized Implementation**: Provide clean, efficient code

Format your response as:

**Current Approach Analysis:**
[Brief analysis of their code - algorithm, time/space complexity]

**Optimization Strategy:**
• **Algorithm Change**: [specific improvement]
• **Data Structure**: [better choice if applicable]
• **Pattern Used**: [reference to common DSA pattern]

**Optimized Code:**
\`\`\`${language || "javascript"}
[complete optimized solution with comments]
\`\`\`

**Performance Improvement:**
• **Before**: Time O(...), Space O(...)
• **After**: Time O(...), Space O(...)
• **Key Benefit**: [main improvement]

**Why This Works Better:**
[2-3 sentences explaining the optimization and when to use this pattern]
    `;

    const response = await callGeminiAPI(prompt);
    sendResponse({ success: true, data: response });
  } catch (error) {
    console.error("Error improving code:", error);

    // Provide fallback improvement suggestions
    const fallbackImprovement = getFallbackImprovement(
      data.userCode,
      data.language,
    );
    console.log("Using fallback code improvement due to API error");
    sendResponse({ success: true, data: fallbackImprovement });
  }
}

// Fallback code improvements when API fails
function getFallbackImprovement(userCode, language) {
  const languageSpecific = getLanguageSpecificTips(language);

  return `
**Code Analysis (${language || "JavaScript"}):**
Your current ${language || "JavaScript"} code has potential for optimization.

**${language || "JavaScript"} Specific Optimizations:**
${languageSpecific}

**Algorithm Improvements:**
• **Time Complexity**: Replace nested loops with hash maps/sets for O(1) lookups
• **Space Complexity**: Consider in-place solutions when possible
• **Data Structures**: Choose optimal structures (HashMap vs TreeMap, Array vs LinkedList)

**Code Quality:**
• Use descriptive variable names and consistent formatting
• Handle edge cases: null/empty inputs, single elements, boundaries
• Extract helper functions for complex logic

**Performance Patterns:**
• Two-pointer technique for sorted arrays
• Sliding window for substring problems
• Dynamic programming for overlapping subproblems
• Binary search for sorted data

**Next Steps:**
1. Optimize algorithm complexity first
2. Test with edge cases thoroughly
3. Refactor for ${language || "JavaScript"} best practices

*Note: AI temporarily unavailable. Language-specific analysis based on ${language || "JavaScript"}.*
  `;
}

function getLanguageSpecificTips(language) {
  const tips = {
    javascript:
      "• Use Map/Set instead of objects for better performance\n• Prefer const/let over var\n• Use array methods like filter/map/reduce\n• Consider BigInt for large numbers",
    python:
      "• Use dict/set for O(1) operations\n• Leverage list comprehensions and generators\n• Use collections.defaultdict/Counter\n• Consider functools.lru_cache for memoization",
    java: "• Use HashMap/HashSet for optimal lookups\n• Prefer StringBuilder over string concatenation\n• Use proper generics and avoid raw types\n• Consider parallel streams for large datasets",
    cpp: "• Use unordered_map/unordered_set for O(1) operations\n• Prefer vectors over arrays when possible\n• Use auto keyword and range-based loops\n• Consider std::move for better performance",
    c: "• Use efficient data structures and avoid O(n²) algorithms\n• Minimize memory allocations in loops\n• Use bit operations for optimization\n�� Handle memory management carefully",
  };

  return tips[language?.toLowerCase()] || tips["javascript"];
}

// Generate learning roadmap
async function handleGenerateRoadmap(data, sendResponse) {
  try {
    const { skillLevel, focusAreas, timeframe, duration } = data;

    const prompt = `
Create a personalized DSA learning roadmap based on Striver's A2Z DSA Course structure from https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/.

Student Profile:
- Skill Level: ${skillLevel || "Beginner"}
- Duration: ${timeframe || "3 months"} (${duration || 3} months total)
- Focus Areas: ${focusAreas || "General DSA"}

Based on Striver's A2Z Course structure, create a detailed roadmap:

**${skillLevel} Level Roadmap (${timeframe}):**

**Phase-by-Phase Plan:**
${
  skillLevel === "Beginner"
    ? `- Phase 1 (Month 1): Learn the Basics - Arrays, Hashing, Basic Math, Recursion
- Phase 2 (Month 2): Important Sorting & Binary Search, Strings
- Phase 3 (Month 3): Linked List, Stack & Queues, Sliding Window`
    : skillLevel === "Intermediate"
      ? `- Phase 1: Trees & Graphs (Advanced), Two Pointers & Sliding Window
- Phase 2: Dynamic Programming, Greedy Algorithms
- Phase 3: Heaps, Tries, Advanced String Algorithms`
      : `- Phase 1: Advanced DP patterns, Graph algorithms (Floyd, Dijkstra)
- Phase 2: Advanced Trees (Segment trees, Fenwick), String matching
- Phase 3: System Design & Complex problem solving`
}

**Daily Practice (${skillLevel} Level):**
${
  skillLevel === "Beginner"
    ? "- Easy problems: 2-3 per day\n- Medium problems: 1 every 2 days\n- Focus: Understanding concepts first"
    : skillLevel === "Intermediate"
      ? "- Easy problems: 1-2 per day (for revision)\n- Medium problems: 2-3 per day\n- Hard problems: 1 every 2 days"
      : "- Medium problems: 2-3 per day\n- Hard problems: 2-3 per day\n- Contest participation: Weekly"
}

**Striver's A2Z Topics Sequence:**
1. Learn the Basics (Arrays, Hashing, Recursion)
2. Important Sorting Algorithms
3. Arrays Problems (Hard)
4. Binary Search
5. Strings
6. Linked List
7. Recursion & Backtracking
8. Trees
9. Graphs
10. Dynamic Programming
11. Heaps
12. Stack and Queues
13. Sliding Window & Two Pointer
14. Greedy Algorithms
15. Tries

**Monthly Goals:**
- Month 1: Complete ${skillLevel === "Beginner" ? "60-80" : skillLevel === "Intermediate" ? "80-120" : "120-150"} problems
- Month ${duration}: Master all core concepts with ${skillLevel === "Beginner" ? "150+" : skillLevel === "Intermediate" ? "300+" : "500+"} problems solved

**Resources:**
- Follow Striver's A2Z DSA Course Sheet
- Practice on LeetCode with focused topic-wise solving
- Regular revision of previously solved problems

This roadmap follows Striver's proven methodology adapted for ${skillLevel} level in ${duration} months.
    `;

    const response = await callGeminiAPI(prompt);
    sendResponse({ success: true, data: response });
  } catch (error) {
    console.error("Error generating roadmap:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Apply focus settings to active tab
async function handleApplyFocusSettings(settings, sendResponse) {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.url.includes("leetcode.com")) {
      sendResponse({
        success: false,
        error: "Please navigate to a LeetCode problem page first.",
      });
      return;
    }

    // Ensure content script is injected
    await ensureContentScriptInjected(tab.id);

    // Send settings to content script with retry
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "applyFocusSettings",
        settings: settings,
      });

      // Save settings
      await chrome.storage.local.set({ focusSettings: settings });

      sendResponse({
        success: true,
        message: "Focus settings applied successfully!",
      });
    } catch (messageError) {
      console.error("Error sending message to content script:", messageError);

      // Try to inject content script and retry
      await injectContentScript(tab.id);

      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: "applyFocusSettings",
            settings: settings,
          });
          await chrome.storage.local.set({ focusSettings: settings });
          sendResponse({
            success: true,
            message: "Focus settings applied successfully (after retry)!",
          });
        } catch (retryError) {
          sendResponse({
            success: false,
            error:
              "Could not communicate with LeetCode page. Please refresh the page and try again.",
          });
        }
      }, 1000);
    }
  } catch (error) {
    console.error("Error applying focus settings:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get current code from LeetCode editor
async function handleGetCurrentCode(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.url.includes("leetcode.com")) {
      sendResponse({
        success: false,
        error: "Please navigate to a LeetCode problem page first.",
      });
      return;
    }

    // Ensure content script is injected
    await ensureContentScriptInjected(tab.id);

    try {
      // Request current code from content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "getCurrentCode",
      });

      sendResponse(response);
    } catch (messageError) {
      console.error("Error getting current code:", messageError);

      // Try to inject content script and retry
      await injectContentScript(tab.id);

      setTimeout(async () => {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "getCurrentCode",
          });
          sendResponse(response);
        } catch (retryError) {
          // Provide fallback response
          sendResponse({
            success: true,
            data: {
              problemTitle: "Current Problem",
              problemDescription: "",
              userCode: "",
              language: "javascript",
            },
          });
        }
      }, 1000);
    }
  } catch (error) {
    console.error("Error getting current code:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Call Gemini API
async function callGeminiAPI(prompt) {
  try {
    console.log("Making API call to Gemini API...");

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
        stopSequences: [],
      },
    };

    console.log("Sending request to Gemini API...");

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log("API Response status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);

      // Try fallback API endpoint
      if (response.status === 404) {
        console.log("Trying fallback endpoint...");
        return await callGeminiFallback(prompt);
      }

      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();
    console.log("API Response received successfully");

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else if (data.error) {
      throw new Error(`API Error: ${data.error.message}`);
    } else {
      console.error("Unexpected response format:", data);
      throw new Error("Invalid response format from Gemini API");
    }
  } catch (error) {
    console.error("Gemini API call failed:", error);
    throw new Error(`Failed to get AI response: ${error.message}`);
  }
}

// Fallback API call with different endpoint
async function callGeminiFallback(prompt) {
  try {
    console.log("Trying alternative Gemini model...");

    // Try with base gemini-1.5-flash model
    const fallbackURL =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent";

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    };

    const response = await fetch(`${fallbackURL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Fallback API Error:", errorText);
      throw new Error("API temporarily unavailable");
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Invalid response format from fallback API");
    }
  } catch (error) {
    console.error("Fallback API failed:", error);
    throw new Error("API temporarily unavailable");
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  // This will be handled by the popup, but we can add additional logic here if needed
  console.log("Extension icon clicked on tab:", tab.url);
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log("LeetCode Focus Extension startup");
});

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("leetcode.com")
  ) {
    console.log("LeetCode page loaded, content script should be injected");
  }
});

// Helper function to ensure content script is injected
async function ensureContentScriptInjected(tabId) {
  try {
    // Test if content script is responsive
    await chrome.tabs.sendMessage(tabId, { action: "ping" });
  } catch (error) {
    // Content script not responsive, inject it
    await injectContentScript(tabId);
  }
}

// Helper function to inject content script
async function injectContentScript(tabId) {
  try {
    console.log("Injecting content script to tab:", tabId);

    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["src/content.js"],
    });

    // Inject the content CSS
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ["src/content.css"],
    });

    console.log("Content script injected successfully");
  } catch (error) {
    console.error("Error injecting content script:", error);
    throw error;
  }
}

// Handle API key update from user
async function handleUpdateApiKey(data, sendResponse) {
  try {
    const { apiKey } = data;

    if (!apiKey || !apiKey.startsWith("AIzaSy")) {
      sendResponse({
        success: false,
        error: "Invalid API key format",
      });
      return;
    }

    // Update the global API key
    GEMINI_API_KEY = apiKey;

    // Save to storage
    await chrome.storage.local.set({ userApiKey: apiKey });

    console.log(
      "API key updated successfully:",
      apiKey.substring(0, 10) + "...",
    );

    sendResponse({
      success: true,
      message: "API key updated successfully",
    });
  } catch (error) {
    console.error("Error updating API key:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

console.log("Background script loaded successfully");
