// Fixed focus mode function that only targets actual tabs on problem pages
function applyFocusRules(settings) {
  console.log("Applying focus rules with settings:", settings);
  const elementsToRemove = [];

  // Only apply focus mode on actual problem pages, not on problems list
  const isOnProblemPage =
    window.location.pathname.includes("/problems/") &&
    window.location.pathname.split("/").length > 3;

  if (!isOnProblemPage) {
    console.log("Not on a specific problem page, skipping focus mode");
    return;
  }

  if (settings.hideSolutions) {
    console.log("Removing Solutions tab...");

    // Valid selectors only - no :has() or :contains()
    const solutionsSelectors = [
      "#solutions_tab",
      '[id*="solutions_tab"]',
      '[data-cy="solutions-tab"]',
      '[data-layout-path*="solutions"]',
      '[data-icon="flask"]',
      ".fa-flask",
    ];

    // First pass: Use valid CSS selectors
    solutionsSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          let tabElement = findActualTab(element);
          if (
            tabElement &&
            !isAlreadyMarkedForRemoval(tabElement, elementsToRemove)
          ) {
            elementsToRemove.push({
              element: tabElement,
              type: "solutions",
              parent: tabElement.parentNode,
              nextSibling: tabElement.nextSibling,
              originalSelector: selector,
            });
            console.log("Found Solutions tab:", tabElement);
          }
        });
      } catch (e) {
        console.log("Selector failed:", selector, e);
      }
    });

    // Second pass: Find tabs with "Solutions" text (manual search)
    const tabElements = document.querySelectorAll(
      '.flexlayout__tab_button, .ant-tabs-tab, [role="tab"]',
    );
    tabElements.forEach((element) => {
      const text = element.textContent.trim();
      if (
        text === "Solutions" &&
        !isAlreadyMarkedForRemoval(element, elementsToRemove)
      ) {
        elementsToRemove.push({
          element: element,
          type: "solutions",
          parent: element.parentNode,
          nextSibling: element.nextSibling,
          originalSelector: "text-search",
        });
        console.log("Found Solutions tab via text:", element);
      }
    });
  }

  if (settings.hideHints) {
    console.log("Removing Hints tab...");

    const hintsSelectors = [
      '[data-cy="hints-tab"]',
      '[data-track-load="hints"]',
      '[data-icon="lightbulb"]',
      ".fa-lightbulb",
    ];

    hintsSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          let tabElement = findActualTab(element);
          if (
            tabElement &&
            !isAlreadyMarkedForRemoval(tabElement, elementsToRemove)
          ) {
            elementsToRemove.push({
              element: tabElement,
              type: "hints",
              parent: tabElement.parentNode,
              nextSibling: tabElement.nextSibling,
              originalSelector: selector,
            });
          }
        });
      } catch (e) {
        console.log("Hints selector failed:", selector);
      }
    });

    // Find hints tabs by text
    const tabElements = document.querySelectorAll(
      '.flexlayout__tab_button, .ant-tabs-tab, [role="tab"]',
    );
    tabElements.forEach((element) => {
      const text = element.textContent.trim();
      if (
        text === "Hints" &&
        !isAlreadyMarkedForRemoval(element, elementsToRemove)
      ) {
        elementsToRemove.push({
          element: element,
          type: "hints",
          parent: element.parentNode,
          nextSibling: element.nextSibling,
          originalSelector: "text-search",
        });
      }
    });
  }

  if (settings.hideDifficulty) {
    console.log("Removing Difficulty indicators...");

    // Only remove difficulty from the current problem, not from lists
    const difficultySelectors = [
      '[data-cy="question-difficulty"]',
      ".text-sd-easy",
      ".text-sd-medium",
      ".text-sd-hard",
    ];

    difficultySelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          // Only remove if it's in the problem description area, not in lists
          const isInProblemArea =
            element.closest('[data-cy="question-title"]') ||
            element.closest(".question-content") ||
            element.closest('[class*="question"]');

          if (
            isInProblemArea &&
            !isAlreadyMarkedForRemoval(element, elementsToRemove)
          ) {
            elementsToRemove.push({
              element: element,
              type: "difficulty",
              parent: element.parentNode,
              nextSibling: element.nextSibling,
              originalSelector: selector,
            });
          }
        });
      } catch (e) {
        console.log("Difficulty selector failed:", selector);
      }
    });
  }

  if (settings.hideTags) {
    console.log("Removing problem tags...");

    const tagsSelectors = ['[data-cy="topic-tags"]', ".topic-tag", ".ant-tag"];

    tagsSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          if (!isAlreadyMarkedForRemoval(element, elementsToRemove)) {
            elementsToRemove.push({
              element: element,
              type: "tags",
              parent: element.parentNode,
              nextSibling: element.nextSibling,
              originalSelector: selector,
            });
          }
        });
      } catch (e) {
        console.log("Tags selector failed:", selector);
      }
    });
  }

  // Remove elements and store them for restoration
  elementsToRemove.forEach((item) => {
    if (item.element && item.element.parentNode) {
      const key = `${item.type}_${Date.now()}_${Math.random()}`;
      removedElements.set(key, item);
      item.element.remove();
      console.log(`Removed ${item.type} element:`, item.element);
    }
  });

  // Apply dark mode
  if (settings.enableDarkMode) {
    document.body.classList.add("leetcode-focus-dark-mode");
    applyDarkModeStyles();
  } else {
    document.body.classList.remove("leetcode-focus-dark-mode");
    removeDarkModeStyles();
  }

  console.log(
    `Focus mode applied: removed ${elementsToRemove.length} elements`,
  );
  if (elementsToRemove.length > 0) {
    showFocusIndicator();
  }
}

// Helper function to find the actual tab container (more precise)
function findActualTab(element) {
  let current = element;
  let attempts = 0;

  while (current && attempts < 5) {
    // Check if this element IS a tab
    if (
      current.classList.contains("flexlayout__tab_button") ||
      current.classList.contains("ant-tabs-tab") ||
      current.getAttribute("role") === "tab"
    ) {
      return current;
    }

    // Check if parent is a tab
    if (current.parentElement) {
      const parent = current.parentElement;
      if (
        parent.classList.contains("flexlayout__tab_button") ||
        parent.classList.contains("ant-tabs-tab") ||
        parent.getAttribute("role") === "tab"
      ) {
        return parent;
      }
    }

    current = current.parentElement;
    attempts++;
  }

  // If no tab container found, return the original element if it looks like a tab
  if (element.textContent && element.textContent.trim().length < 20) {
    return element;
  }

  return null;
}

// Helper function to check if element is already marked for removal
function isAlreadyMarkedForRemoval(element, elementsToRemove) {
  return elementsToRemove.some((item) => item.element === element);
}
