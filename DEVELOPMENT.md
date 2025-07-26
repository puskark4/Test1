# IsThisSpam Extension - Development Guide

## 🛠️ Development Setup

### Prerequisites
- **Chrome Browser**: Version 88 or higher
- **Node.js**: Version 16 or higher (for development tools)
- **Git**: For version control
- **Text Editor**: VS Code, Sublime Text, or similar

### Project Structure
```
isthisspam-extension/
├── manifest.json          # Extension configuration
├── background.js           # Service worker (background script)
├── content-script.js       # Content script for Gmail/Outlook
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── styles.css             # Extension styles
├── icons/                 # Extension icons
│   ├── icon.svg          # Source SVG icon
│   ├── icon16.png        # 16x16 PNG icon
│   ├── icon48.png        # 48x48 PNG icon
│   └── icon128.png       # 128x128 PNG icon
├── README.md              # Project documentation
├── LICENSE                # MIT license
├── package.json           # Development dependencies
└── DEVELOPMENT.md         # This file
```

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/isthisspam/extension.git
cd isthisspam-extension
```

### 2. Install Development Dependencies
```bash
npm install
```

### 3. Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the project directory
5. The extension should now appear in your extensions list

### 4. Test the Extension
1. Open Gmail or Outlook in a new tab
2. The extension should automatically start working
3. Click the extension icon to open the popup
4. Check browser console for any errors

## 🏗️ Architecture Overview

### Extension Components

#### 1. Manifest (manifest.json)
- **Purpose**: Defines extension metadata, permissions, and configuration
- **Key Features**:
  - Manifest V3 compliance
  - Content script injection for Gmail/Outlook
  - Background service worker registration
  - Required permissions and host permissions

#### 2. Background Service Worker (background.js)
- **Purpose**: Handles extension lifecycle and AI processing
- **Key Features**:
  - Extension installation and updates
  - AI model initialization (Chrome built-in + cloud fallback)
  - Email analysis and threat detection
  - Settings management
  - Communication with content scripts

#### 3. Content Script (content-script.js)
- **Purpose**: Runs on Gmail/Outlook pages to scan emails
- **Key Features**:
  - Platform detection (Gmail vs Outlook)
  - Email extraction and parsing
  - Real-time threat indicator injection
  - Dynamic DOM observation for new emails
  - User interaction handling

#### 4. Popup Interface (popup.html + popup.js)
- **Purpose**: Extension dashboard and controls
- **Key Features**:
  - Extension status and statistics
  - Manual scanning controls
  - Settings configuration
  - Threat reports and analytics

#### 5. Styling (styles.css)
- **Purpose**: Visual design for all extension components
- **Key Features**:
  - Threat indicator styling
  - Modal and tooltip designs
  - Responsive design
  - Dark mode support
  - Accessibility features

## 🤖 AI Integration

### Chrome Built-in AI
The extension can utilize Chrome's experimental built-in AI capabilities:

```javascript
// Check if Chrome AI is available
if (window.ai && await ai.languageModel.capabilities()) {
  const session = await ai.languageModel.create({
    systemPrompt: "You are an email security expert..."
  });
  
  const analysis = await session.prompt(emailContent);
}
```

### Cloud AI Fallback
When local AI isn't available, the extension uses rule-based detection:

```javascript
// Pattern-based threat detection
const threats = {
  phishing: ['verify your account', 'suspend account'],
  spam: ['make money fast', 'limited time offer'],
  scam: ['nigerian prince', 'lottery winner']
};
```

## 📧 Email Platform Integration

### Gmail Integration
- **Selectors**: Uses Gmail's dynamic class names and aria labels
- **Email Parsing**: Extracts sender, subject, body, and attachments
- **Indicator Placement**: Positions threat indicators in email list

### Outlook Integration
- **Selectors**: Uses Outlook's data attributes and role selectors
- **Email Parsing**: Similar to Gmail with platform-specific adaptations
- **Indicator Placement**: Adapts to Outlook's interface layout

## 🔒 Security & Privacy

### Data Handling
- **Local Processing**: Preferred method using Chrome's built-in AI
- **Minimal Data**: Only processes necessary email metadata
- **No Storage**: Email content is never permanently stored
- **Encryption**: Cloud processing uses HTTPS encryption

### Permission Management
- **activeTab**: Access to current tab content
- **storage**: For settings and statistics
- **scripting**: For content script injection
- **host_permissions**: For specific email platforms

## 🧪 Testing Strategy

### Manual Testing
1. **Gmail Testing**:
   - Create test emails with known spam content
   - Verify threat indicators appear correctly
   - Test different email types (promotional, personal, etc.)

2. **Outlook Testing**:
   - Test with Outlook.com and Office 365
   - Verify proper email extraction
   - Check indicator positioning

3. **Extension Features**:
   - Test popup functionality
   - Verify settings persistence
   - Check statistics accuracy

### Automated Testing
```bash
# Run linting
npm run lint

# Run tests (when implemented)
npm test

# Build extension package
npm run package
```

## 🎨 UI/UX Guidelines

### Design Principles
- **Minimal Interference**: Don't disrupt email workflow
- **Clear Indicators**: Use universally understood symbols
- **Consistent Styling**: Match email platform aesthetics
- **Accessibility**: Support screen readers and keyboard navigation

### Color Scheme
- **Safe**: Green (#28a745)
- **Low Risk**: Yellow (#ffc107)
- **Medium Risk**: Orange (#fd7e14)
- **High Risk**: Red (#dc3545)
- **Critical**: Dark Red with animation

## 🚀 Deployment

### Development Build
```bash
# Create development package
npm run build
```

### Production Build
```bash
# Create production package
npm run package
```

### Chrome Web Store Submission
1. **Prepare Assets**:
   - High-quality screenshots
   - Detailed description
   - Privacy policy
   - Store listing images

2. **Package Extension**:
   - Remove development files
   - Optimize images
   - Validate manifest

3. **Submit for Review**:
   - Upload to Chrome Web Store
   - Fill out store listing
   - Submit for review

## 🔧 Common Development Tasks

### Adding New Threat Patterns
1. Update `background.js` threat detection patterns
2. Add corresponding test cases
3. Update documentation

### Supporting New Email Platforms
1. Add platform detection in `content-script.js`
2. Implement platform-specific selectors
3. Test email extraction and indicator placement

### Improving AI Accuracy
1. Enhance system prompts in `background.js`
2. Add more sophisticated pattern matching
3. Implement user feedback collection

## 🐛 Debugging

### Common Issues
1. **Content Script Not Loading**:
   - Check manifest permissions
   - Verify URL patterns
   - Check browser console for errors

2. **AI Analysis Failing**:
   - Verify Chrome AI availability
   - Check fallback rule-based detection
   - Monitor background script logs

3. **Indicators Not Showing**:
   - Verify email platform detection
   - Check CSS specificity conflicts
   - Validate DOM selectors

### Debug Tools
- **Chrome DevTools**: Inspect content scripts and popup
- **Extension Console**: Check background script logs
- **Network Tab**: Monitor API requests (if using cloud AI)

## 📚 Resources

### Chrome Extension Documentation
- [Chrome Extensions Overview](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)

### Email Platform APIs
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Outlook API Documentation](https://docs.microsoft.com/en-us/graph/api/overview)

### AI Integration
- [Chrome Built-in AI](https://developer.chrome.com/docs/extensions/ai)
- [Web AI APIs](https://webmachinelearning.github.io/webnn/)

## 🤝 Contributing

### Code Style
- Use ES6+ JavaScript features
- Follow consistent naming conventions
- Add comments for complex logic
- Maintain separation of concerns

### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit pull request with description

### Issue Reporting
- Use the provided issue templates
- Include reproduction steps
- Add relevant screenshots
- Specify browser and extension version

---

Happy coding! 🚀