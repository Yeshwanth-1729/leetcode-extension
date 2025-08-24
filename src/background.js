// Background script for handling Gemini API and extension lifecycle
let GEMINI_API_KEY = "AIzaSyAhpPCSPoDm6MliXwHCMoRVx3lleCMp2jE"; // Default fallback key
let USER_API_KEY = "";
let CURRENT_PROVIDER = "gemini";
let CURRENT_MODEL = "gemini-1.5-flash";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

// Load user's custom settings on startup
async function loadUserSettings() {
  try {
    const result = await chrome.storage.local.get([
      "userApiKey", 
      "aiProvider", 
      "aiModel"
    ]);
    
    if (result.userApiKey) {
      USER_API_KEY = result.userApiKey;
      console.log("Loaded user API key");
    }
    
    CURRENT_PROVIDER = result.aiProvider || "gemini";
    CURRENT_MODEL = result.aiModel || "gemini-1.5-flash";
    
    console.log(`AI Provider: ${CURRENT_PROVIDER}, Model: ${CURRENT_MODEL}`);
  } catch (error) {
    console.error("Error loading user settings:", error);
  }
}

// Initialize settings on startup
loadUserSettings();

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

    case "chatMessage":
      handleChatMessage(request.data, sendResponse);
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

    case "updateAISettings":
      handleUpdateAISettings(request.data, sendResponse);
      return true;

    default:
      sendResponse({ error: "Unknown action" });
  }
});

// Get hint from AI API
async function handleGetHint(data, sendResponse) {
  try {
    const { problemTitle, problemDescription, userCode, provider, model, hintOptions } = data;
    
    const prompt = createHintPrompt(problemTitle, problemDescription, userCode, hintOptions);
    
    const apiKey = USER_API_KEY || GEMINI_API_KEY;
    const response = await callGeminiAPI(prompt, model || CURRENT_MODEL, apiKey);
    
    console.log("Hint generated successfully");
    sendResponse({ success: true, data: response });
  } catch (error) {
    console.error("Error getting hint:", error);
    
    // Provide fallback hint with language info
    const language = data.language || "javascript";
    const difficulty = data.difficulty || "Unknown";
    const fallbackHint = getFallbackHint(data.problemTitle, data.userCode, difficulty, language);
    console.log("Using fallback hint due to API error");
    sendResponse({ success: true, data: fallbackHint });
  }
}

// Handle chat messages
async function handleChatMessage(data, sendResponse) {
  try {
    const { message, chatHistory, problemData, provider, model, intent } = data;
    
    // Validate inputs
    if (!message || message.trim() === "") {
      sendResponse({ 
        success: false, 
        error: "Please enter a message to send." 
      });
      return;
    }

    // Check if API key is available
    const apiKey = USER_API_KEY || GEMINI_API_KEY;
    if (!apiKey) {
      sendResponse({ 
        success: false, 
        error: "No API key configured for Gemini. Please add your API key in the settings." 
      });
      return;
    }
    
    const prompt = createChatPrompt(message, chatHistory, problemData, intent);
    
    const response = await callGeminiAPI(prompt, model || CURRENT_MODEL, apiKey);
    
    console.log("Chat response generated successfully");
    sendResponse({ success: true, data: response });
  } catch (error) {
    console.error("Error generating chat response:", error);
    
    // Provide specific error messages based on error type
    let errorMessage = "I'm having trouble responding right now. ";
    
    if (error.message.includes("API key")) {
      errorMessage = "There's an issue with your API key. Please check that it's correctly configured in the settings above.";
    } else if (error.message.includes("quota") || error.message.includes("limit")) {
      errorMessage = "It looks like you've reached your API usage limit. Please check your account or try switching to a different provider.";
    } else if (error.message.includes("network") || error.message.includes("fetch")) {
      errorMessage = "I'm having trouble connecting to the AI service. Please check your internet connection and try again.";
    } else if (error.message.includes("Invalid response")) {
      errorMessage = "I received an unexpected response from the AI service. Please try rephrasing your question or try again.";
    } else {
      errorMessage += "Please try again in a moment.";
    }
    
    sendResponse({ 
      success: false, 
      error: errorMessage
    });
  }
}

// Call Gemini API
async function callGeminiAPI(prompt, model, apiKey) {
  console.log("Making API call to Gemini API...");
  
  if (!apiKey) {
    throw new Error("No API key provided for Gemini API");
  }

  const url = `${GEMINI_API_BASE_URL}${model}:generateContent?key=${apiKey}`;
  
  console.log("Sending request to Gemini API...");
  
  // Optimized configuration for concise, specific responses
  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.2,        // Even lower for more focused responses
      topK: 15,               // More selective for conciseness
      topP: 0.7,              // Conservative sampling for specificity
      maxOutputTokens: 800,   // Reduced for concise responses
      candidateCount: 1,
      stopSequences: ["```\n\n", "Complete solution:", "Full code:"]  // Stop before full solutions
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH", 
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("Invalid response format from Gemini API");
    }

    let responseText = data.candidates[0].content.parts[0].text;
    
    // Filter out full solutions and keep only hints/snippets
    responseText = filterResponseForConciseness(responseText);
    
    return responseText;
  } catch (error) {
    console.log("Gemini API call failed:", error);
    throw new Error(`Failed to get AI response: ${error.message}`);
  }
}

// Create enhanced hint prompt
function createHintPrompt(problemTitle, problemDescription, userCode, hintOptions) {
  const { includeApproach, includeEdgeCases, includeComplexity } = hintOptions || {};
  
  // Extract additional context if available (enhanced from content script)
  const problemData = typeof problemDescription === 'object' ? problemDescription : { problemDescription };
  const description = problemData.problemDescription || problemDescription || "No description provided";
  const difficulty = problemData.difficulty || "Unknown";
  const tags = problemData.tags || [];
  const language = problemData.language || "javascript";
  
  let prompt = `You are a concise coding mentor. Provide SPECIFIC, SHORT guidance without full solutions.

**PROBLEM:** ${problemTitle} (${difficulty})
**LANGUAGE:** ${language}
**TOPICS:** ${tags.length > 0 ? tags.slice(0,3).join(', ') : 'General'}

**STUDENT CODE:**
${userCode ? `\`\`\`${language}\n${userCode}\n\`\`\`` : "No code yet"}

**INSTRUCTIONS:**
- Be CONCISE (under 150 words total)
- Use ${language} syntax for any code snippets
- Show ONLY key snippets, NOT full solutions
- Be specific about the approach
- No lengthy explanations`;

  if (includeApproach) {
    prompt += `\n- 🎯 **Approach**: State the optimal technique for ${difficulty} level`;
  }

  if (includeEdgeCases) {
    prompt += `\n- ⚠️ **Edge Cases**: List 2-3 critical cases to test`;
  }

  if (includeComplexity) {
    prompt += `\n- 📊 **Complexity**: State target O() time & space briefly`;
  }

  prompt += `

**RESPONSE FORMAT:**
- Use bullet points
- Include ${language} code snippets (3-5 lines max)
- End with one encouraging line
- NO complete functions or full solutions

**EXAMPLE SNIPPET FORMAT:**
\`\`\`${language}
// Just the key logic, not full function
if (nums[i] + nums[j] === target) return [i, j];
\`\`\`

Provide your concise, specific hint now:`;

  return prompt;
}

// Create chat prompt with context (revised: conversational; only add code when explicitly requested)
function createChatPrompt(message, chatHistory, problemData, intent) {
  const cleanedMessage = message.replace(/\[INTENT:[^\]]+\]/g, '').trim();
  const title = problemData?.problemTitle || "LeetCode Problem";
  const difficulty = problemData?.difficulty || "Unknown";
  const language = problemData?.language || problemData?.lang || "javascript";
  const code = problemData?.userCode;
  const tags = problemData?.tags || [];

  const isGreeting = /^\s*(hi|hello|hey|hola|yo|sup)\b/i.test(cleanedMessage);
  const codeKeywords = /(code|snippet|example|implement|function|solution|show|demo|sample|write)/i;
  const needsCode = codeKeywords.test(cleanedMessage) || ['IMPROVE_CODE','ASK_EXAMPLES'].includes(intent);

  let prompt = `You are a friendly, concise coding mentor.\n\nPROBLEM: ${title} (${difficulty})\nLANGUAGE: ${language}\nTOPICS: ${tags.slice(0,2).join(', ') || 'General'}\n\nSTUDENT_CODE:\n${code ? `\`\`\`${language}\n${code}\n\`\`\`` : 'No code yet'}\n\nRECENT_CHAT:`;

  const recentHistory = (chatHistory || []).slice(-3);
  if (recentHistory.length === 0) {
    prompt += `\n(First user interaction)`;
  } else {
    recentHistory.forEach((msg) => {
      const role = msg.sender === 'user' ? 'Student' : 'Mentor';
      prompt += `\n${role}: ${msg.content}`;
    });
  }

  prompt += `\n\nUSER_MESSAGE: "${cleanedMessage}"\n`;

  if (isGreeting) {
    prompt += `\nThe user greeted you. Reply with: a warm brief greeting (<25 words), a motivational nudge, and ONE clarifying question. DO NOT include code.`;
  } else if (!needsCode) {
    prompt += `\nUser did NOT clearly request code. Provide <=75 word conversational guidance (approach, concept, or clarification). NO code. End with ONE focused follow-up question.`;
  } else {
    prompt += `\nUser wants code help. Provide at most ONE ${language} snippet (2-5 lines) of ONLY core logic (no full function/class). Total words <=85. If snippet unnecessary, skip it and state what to try.`;
  }

  prompt += `\nRules:\n- Never give full solution\n- Ask for missing detail if ambiguous\n- No boilerplate or imports\n- Be supportive & specific\n\nRespond now:`;
  return prompt;
}

// Handle updating AI settings
async function handleUpdateAISettings(data, sendResponse) {
  try {
    const { provider, model } = data;
    
    CURRENT_PROVIDER = provider;
    CURRENT_MODEL = model;
    
    await chrome.storage.local.set({ 
      aiProvider: provider, 
      aiModel: model 
    });
    
    console.log(`AI settings updated: ${provider} - ${model}`);
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error updating AI settings:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Fallback hints when API fails
function getFallbackHint(problemTitle, userCode, difficulty = "Unknown", language = "javascript") {
  // Concise fallback hints with language-specific snippets
  const conciseFallbacks = {
    "Two Sum": {
      hint: "🎯 Use hash map for O(1) lookups",
      snippet: `// ${language} snippet\nif (map.has(target - nums[i])) return [map.get(target - nums[i]), i];`,
      complexity: "O(n) time, O(n) space",
      pattern: "Hash Map Complement"
    },
    "Valid Anagram": {
      hint: "🎯 Compare character frequencies",
      snippet: language === "python" ? "# Count chars\nfrom collections import Counter\nreturn Counter(s) == Counter(t)" : "// Count chars\nlet count = {};\nfor (let char of s) count[char] = (count[char] || 0) + 1;",
      complexity: "O(n) time, O(1) space",
      pattern: "Frequency Counter"
    },
    "Group Anagrams": {
      hint: "🎯 Group by sorted string signature",
      snippet: language === "python" ? "# Group by key\nkey = ''.join(sorted(word))\ngroups[key].append(word)" : "// Group by key\nconst key = word.split('').sort().join('');\ngroups[key].push(word);",
      complexity: "O(n*k log k) time",
      pattern: "Hash Map Grouping"
    },
    "Valid Parentheses": {
      hint: "🎯 Use stack for bracket matching",
      snippet: language === "python" ? "# Stack matching\nif char in '([{': stack.append(char)\nelif not stack or not matches(stack.pop(), char): return False" : "// Stack matching\nif ('([{'.includes(char)) stack.push(char);\nelse if (!stack.length || !matches(stack.pop(), char)) return false;",
      complexity: "O(n) time, O(n) space",
      pattern: "Stack Matching"
    },
    "Best Time to Buy and Sell Stock": {
      hint: "🎯 Track min price and max profit",
      snippet: language === "python" ? "# One pass\nmin_price = min(min_price, price)\nmax_profit = max(max_profit, price - min_price)" : "// One pass\nminPrice = Math.min(minPrice, price);\nmaxProfit = Math.max(maxProfit, price - minPrice);",
      complexity: "O(n) time, O(1) space",
      pattern: "Dynamic Programming"
    },
    "Maximum Subarray": {
      hint: "🎯 Kadane's Algorithm",
      snippet: language === "python" ? "# Kadane's\ncurrent_sum = max(num, current_sum + num)\nmax_sum = max(max_sum, current_sum)" : "// Kadane's\ncurrentSum = Math.max(num, currentSum + num);\nmaxSum = Math.max(maxSum, currentSum);",
      complexity: "O(n) time, O(1) space",
      pattern: "Kadane's Algorithm"
    },
    "Contains Duplicate": {
      hint: "🎯 Use Set for O(1) duplicate check",
      snippet: language === "python" ? "# Set check\nif num in seen: return True\nseen.add(num)" : "// Set check\nif (seen.has(num)) return true;\nseen.add(num);",
      complexity: "O(n) time, O(n) space",
      pattern: "Hash Set"
    }
  };

  const specificHint = conciseFallbacks[problemTitle];
  if (specificHint) {
    return `**${problemTitle}** (${difficulty})

${specificHint.hint}

\`\`\`${language}
${specificHint.snippet}
\`\`\`

**⚡ Complexity:** ${specificHint.complexity}
**🎯 Pattern:** ${specificHint.pattern}

✅ **Next:** Test with edge cases!`;
  }

  // Generate concise pattern-based hint
  let patternHint = generateConcisePatternHint(problemTitle, language, difficulty);
  
  return `**${problemTitle}** (${difficulty})

${patternHint}

✅ **Remember:** Start simple, then optimize!`;
}

// Generate concise hints based on problem patterns
function generateConcisePatternHint(problemTitle, language, difficulty) {
  const title = problemTitle.toLowerCase();
  
  if (title.includes('sum') || title.includes('target')) {
    const snippet = language === "python" ? "target_map[target - num] = i" : "targetMap.set(target - num, i);";
    return `🎯 **Target Sum:** Use hash map\n\`\`\`${language}\n${snippet}\n\`\`\`\n**Time:** O(n) vs O(n²) brute force`;
  }
  
  if (title.includes('anagram') || title.includes('frequency')) {
    const snippet = language === "python" ? "char_count[char] = char_count.get(char, 0) + 1" : "charCount[char] = (charCount[char] || 0) + 1;";
    return `🎯 **Frequency:** Count characters\n\`\`\`${language}\n${snippet}\n\`\`\``;
  }
  
  if (title.includes('parentheses') || title.includes('bracket')) {
    const snippet = language === "python" ? "stack.append(char) if char in '([{' else stack.pop()" : "char === '([{' ? stack.push(char) : stack.pop();";
    return `🎯 **Matching:** Use stack\n\`\`\`${language}\n${snippet}\n\`\`\``;
  }
  
  if (title.includes('array') || title.includes('subarray')) {
    return `🎯 **Array:** Consider sliding window or two pointers\n**Optimization:** Single pass solution?`;
  }
  
  if (title.includes('tree') || title.includes('binary')) {
    const snippet = language === "python" ? "def dfs(node):\n    if not node: return\n    # process node" : "function dfs(node) {\n    if (!node) return;\n    // process node\n}";
    return `🎯 **Tree:** DFS or BFS\n\`\`\`${language}\n${snippet}\n\`\`\``;
  }
  
  if (title.includes('linked') || title.includes('list')) {
    const snippet = language === "python" ? "slow, fast = head, head\nwhile fast and fast.next:" : "let slow = head, fast = head;\nwhile (fast && fast.next) {";
    return `🎯 **Linked List:** Two pointers\n\`\`\`${language}\n${snippet}\n\`\`\``;
  }
  
  // Default concise hint based on difficulty
  const complexityGuide = {
    "Easy": "O(n) or O(n log n) solutions",
    "Medium": "Combine 2 techniques (DP, graphs)",
    "Hard": "Advanced algorithms, edge cases"
  };
  
  return `🎯 **${difficulty} Strategy:** ${complexityGuide[difficulty] || "Hash maps, two pointers, or basic algorithms"}`;
}

// Handle API key updates
async function handleUpdateApiKey(data, sendResponse) {
  try {
    const { apiKey } = data;
    
    USER_API_KEY = apiKey;
    await chrome.storage.local.set({ userApiKey: apiKey });
    
    console.log("API key updated successfully");
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error updating API key:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Improve code using Gemini API
async function handleImproveCode(data, sendResponse) {
  try {
    const { problemTitle, userCode, language, provider, model } = data;

    if (!userCode || userCode.trim() === "") {
      sendResponse({
        success: false,
        error:
          "No code found. Please write some code in the LeetCode editor first.",
      });
      return;
    }

    const prompt = `
You are an expert coding mentor. Analyze and improve the provided code for this LeetCode problem.

Problem: ${problemTitle}
Language: ${language || "JavaScript"}
Current Code:
\`\`\`${language || "javascript"}
${userCode}
\`\`\`

Please provide:

**Code Analysis:**
• Current approach and complexity
• Identify inefficiencies or issues

**Optimization Strategy:**
• Algorithm improvements (if any)
• Better data structures (if applicable)
• Reference to common DSA patterns

**Optimized Code:**
\`\`\`${language || "javascript"}
[Provide complete optimized solution with clear comments]
\`\`\`

**Performance Improvement:**
• Before: Time O(...), Space O(...)
• After: Time O(...), Space O(...)
• Key benefits of the optimization

**Explanation:**
2-3 sentences explaining why this optimization works better and when to use this pattern.

Keep the response practical and educational. Focus on the most impactful improvements.
    `;

    const apiKey = USER_API_KEY || GEMINI_API_KEY;
    const response = await callGeminiAPI(prompt, model || CURRENT_MODEL, apiKey);
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
    const { skillLevel, focusAreas, timeframe, duration, model } = data;

    // Check if API key is available
    const apiKey = USER_API_KEY || GEMINI_API_KEY;
    if (!apiKey) {
      sendResponse({ 
        success: false, 
        error: "No API key configured for Gemini. Please add your API key in the settings." 
      });
      return;
    }

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

    const response = await callGeminiAPI(prompt, model || CURRENT_MODEL, apiKey);
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

// Filter AI responses to ensure conciseness and prevent full solutions
function filterResponseForConciseness(responseText) {
  // Remove complete function implementations
  let filtered = responseText;
  
  // Remove full function definitions (common patterns)
  filtered = filtered.replace(/function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?}(?=\n|$)/g, '// Full function removed - use snippets below');
  filtered = filtered.replace(/def\s+\w+\s*\([^)]*\):[\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '# Full function removed - use snippets below');
  filtered = filtered.replace(/class\s+\w+[\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '// Full class removed - focus on key logic');
  
  // Remove excessively long code blocks (>10 lines)
  filtered = filtered.replace(/```[\w]*\n((?:.*\n){11,})```/g, (match, codeContent) => {
    const lines = codeContent.trim().split('\n');
    if (lines.length > 10) {
      return '```\n// Code snippet too long - showing key parts:\n' + lines.slice(0, 5).join('\n') + '\n// ... (focus on the approach above)\n```';
    }
    return match;
  });
  
  // Limit overall response length (conciseness requirement)
  if (filtered.length > 1000) {
    const sentences = filtered.split(/[.!?]+/);
    let truncated = sentences.slice(0, 8).join('. ') + '.';
    if (truncated.length > 800) {
      truncated = truncated.substring(0, 800) + '...';
    }
    return truncated + '\n\n✅ **Keep it simple and test your approach!**';
  }
  
  // Add concise reminder if response seems too detailed
  if (filtered.length > 600) {
    filtered += '\n\n💡 **Remember**: Start with this approach, then implement step by step!';
  }
  
  return filtered;
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

    // Save to extension storage
    await chrome.storage.local.set({ userApiKey: apiKey });
    // Mirror to localStorage in active tab (fire-and-forget)
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (k) => { try { localStorage.setItem('userApiKey', k); } catch(e) {} },
            args: [apiKey]
          });
        }
      });
    } catch(e) { console.warn('Mirroring API key to page localStorage failed', e); }

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
