# LeetCode Focus - Chrome Extension

A powerful Chrome extension that enhances your LeetCode experience with AI-powered hints, code improvements, focus mode, and personalized learning roadmaps.

## 🚀 Features

### 🤖 AI Assistant

- **Get Hints**: Receive AI-powered hints without spoiling the solution
- **Improve Code**: Get suggestions to optimize your code for performance and readability
- **Smart Analysis**: Edge case detection and complexity analysis

### 🎯 Focus Mode

- **Hide Distractions**: Remove solutions tab, hints, tags, and difficulty levels
- **Dark Mode**: Enhanced dark theme for better coding experience
- **Customizable**: Choose what to hide based on your preferences

### 🗺️ Learning Roadmap

- **AI-Generated Roadmaps**: Personalized learning paths based on your goals
- **Progress Tracking**: Monitor your problem-solving journey
- **Structured Learning**: Organized topics from beginner to advanced

## 📦 Installation

### Load as Unpacked Extension

1. **Download/Clone the Extension**

   ```bash
   git clone <repository-url>
   cd leetcode-focus-extension
   ```

2. **Open Chrome Extensions**

   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load Extension**

   - Click "Load unpacked"
   - Select the `leetcode-focus-extension` folder
   - The extension should now appear in your extensions list

4. **Pin Extension**
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "LeetCode Focus" for easy access

## 🔧 Setup

### Gemini API Key

The extension comes pre-configured with a Gemini API key. If you want to use your own:

1. Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Open `src/background.js`
3. Replace the `GEMINI_API_KEY` constant with your key

### Permissions

The extension requires these permissions:

- `activeTab`: To interact with LeetCode pages
- `storage`: To save your preferences
- `scripting`: To inject focus mode styles
- Access to `leetcode.com` and Gemini API

## 📖 Usage

### Using the Extension

1. **Navigate to LeetCode**

   - Go to any LeetCode problem page
   - Click the extension icon in the toolbar

2. **AI Assistant Tab**

   - **Get Hint**: Click to receive a helpful hint for the current problem
   - **Improve Code**: Get AI suggestions to optimize your solution

3. **Focus Mode Tab**

   - Toggle options to hide distracting elements
   - Enable dark mode for better focus
   - Click "Apply Focus Settings" to activate

4. **Roadmap Tab**
   - Generate personalized learning roadmaps
   - Track your progress on different topics
   - Access structured learning paths

### Tips for Best Experience

- Write some code before using "Improve Code" feature
- Use Focus Mode to minimize distractions during practice
- Generate roadmaps based on your current skill level
- Save your focus preferences for consistent experience

## 🛠️ Development

### Project Structure

```
leetcode-focus-extension/
├── manifest.json          # Extension configuration
├── icons/                 # Extension icons (placeholder)
├── src/
│   ├── popup.html         # Extension popup interface
│   ├── popup.js           # Popup functionality
│   ├── styles.css         # Popup styling
│   ├── background.js      # Service worker & API calls
│   ├── content.js         # LeetCode page manipulation
│   └── content.css        # Content styling
└── README.md             # This file
```

### Key Components

1. **Manifest V3** (`manifest.json`)

   - Extension permissions and configuration
   - Service worker registration
   - Content script injection

2. **Popup Interface** (`popup.html`, `popup.js`, `styles.css`)

   - Beautiful glassmorphic UI with three tabs
   - Tab switching and user interactions
   - Communication with background script

3. **Background Script** (`background.js`)

   - Handles Gemini API integration
   - Manages extension settings
   - Coordinates between popup and content scripts

4. **Content Script** (`content.js`, `content.css`)
   - DOM manipulation on LeetCode pages
   - Code extraction from editors
   - Focus mode implementation

### API Integration

The extension uses Google's Gemini Pro API for AI features:

- Hint generation
- Code improvement suggestions
- Learning roadmap creation

## 🔒 Privacy & Security

- No user code is stored externally
- All AI processing happens via direct API calls
- Extension settings stored locally in Chrome
- Gemini API key handled securely in background script

## 🐛 Troubleshooting

### Common Issues

1. **Extension not working on LeetCode**

   - Ensure you're on a LeetCode problem page
   - Check if extension is enabled
   - Refresh the page and try again

2. **AI features not responding**

   - Check your internet connection
   - Verify Gemini API key is valid
   - Check browser console for errors

3. **Focus mode not applying**
   - Make sure you're on a LeetCode problem page
   - Try refreshing the page after applying settings
   - Check if other extensions are conflicting

### Debug Mode

Open Chrome DevTools and check:

- Console tab for error messages
- Network tab for failed API requests
- Extensions tab for permission issues

## 📝 License

This project is for educational purposes. Please ensure you comply with LeetCode's terms of service and Google's API usage policies.

## 🤝 Contributing

Feel free to contribute by:

- Reporting bugs
- Suggesting new features
- Improving documentation
- Submitting pull requests

## 📧 Support

For issues or questions:

1. Check the troubleshooting section
2. Review browser console errors
3. Open an issue with detailed information

---

**Happy Coding! 🎯**
