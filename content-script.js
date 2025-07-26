// Content script for IsThisSpam extension - runs on Gmail and Outlook
class IsThisSpamContentScript {
  constructor() {
    this.isInitialized = false;
    this.emailCache = new Map();
    this.currentPlatform = this.detectPlatform();
    this.observers = [];
    this.threatIndicators = new Map();
    
    console.log(`IsThisSpam: Content script loaded for ${this.currentPlatform}`);
    this.initialize();
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('mail.google.com')) {
      return 'gmail';
    } else if (hostname.includes('outlook')) {
      return 'outlook';
    }
    return 'unknown';
  }

  async initialize() {
    if (this.isInitialized) return;

    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async setup() {
    console.log('IsThisSpam: Setting up content script');
    
    // Check if extension is enabled
    const settings = await this.getSettings();
    if (!settings.isthisspam_enabled) {
      console.log('IsThisSpam: Extension disabled');
      return;
    }

    this.isInitialized = true;
    
    // Set up platform-specific handlers
    if (this.currentPlatform === 'gmail') {
      this.setupGmail();
    } else if (this.currentPlatform === 'outlook') {
      this.setupOutlook();
    }

    // Set up message listener for communication with background script
    this.setupMessageListener();
  }

  setupGmail() {
    console.log('IsThisSpam: Setting up Gmail integration');
    
    // Gmail uses dynamic content, so we need to watch for changes
    this.observeGmailChanges();
    
    // Initial scan of visible emails
    this.scanGmailEmails();
  }

  setupOutlook() {
    console.log('IsThisSpam: Setting up Outlook integration');
    
    // Outlook also uses dynamic content
    this.observeOutlookChanges();
    
    // Initial scan of visible emails
    this.scanOutlookEmails();
  }

  observeGmailChanges() {
    // Watch for changes in the email list
    const emailListObserver = new MutationObserver((mutations) => {
      let hasNewEmails = false;
      
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if this is an email row
              if (node.matches('[role="main"] [role="listitem"]') ||
                  node.querySelector('[role="main"] [role="listitem"]')) {
                hasNewEmails = true;
              }
            }
          });
        }
      });
      
      if (hasNewEmails) {
        setTimeout(() => this.scanGmailEmails(), 500);
      }
    });

    // Start observing the main content area
    const mainContent = document.querySelector('[role="main"]');
    if (mainContent) {
      emailListObserver.observe(mainContent, {
        childList: true,
        subtree: true
      });
      this.observers.push(emailListObserver);
    }

    // Watch for email opens
    const emailViewObserver = new MutationObserver(() => {
      this.scanOpenGmailEmail();
    });

    // Observe the entire document for email view changes
    emailViewObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'style']
    });
    this.observers.push(emailViewObserver);
  }

  observeOutlookChanges() {
    // Watch for changes in Outlook email list
    const observer = new MutationObserver((mutations) => {
      let hasNewEmails = false;
      
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE &&
                (node.classList.contains('_2V') || // Email item class
                 node.querySelector('[role="listitem"]'))) {
              hasNewEmails = true;
            }
          });
        }
      });
      
      if (hasNewEmails) {
        setTimeout(() => this.scanOutlookEmails(), 500);
      }
    });

    // Find the email list container
    const emailContainer = document.querySelector('[role="main"]') ||
                          document.querySelector('[data-app-section="MailModule"]');
    
    if (emailContainer) {
      observer.observe(emailContainer, {
        childList: true,
        subtree: true
      });
      this.observers.push(observer);
    }
  }

  async scanGmailEmails() {
    console.log('IsThisSpam: Scanning Gmail emails');
    
    // Find email rows in Gmail
    const emailRows = document.querySelectorAll('[role="main"] [role="listitem"]');
    
    for (const row of emailRows) {
      if (!row.dataset.isthisspamScanned) {
        await this.analyzeGmailEmailRow(row);
        row.dataset.isthisspamScanned = 'true';
      }
    }
  }

  async scanOutlookEmails() {
    console.log('IsThisSpam: Scanning Outlook emails');
    
    // Find email rows in Outlook
    const emailRows = document.querySelectorAll('[role="listitem"]');
    
    for (const row of emailRows) {
      if (!row.dataset.isthisspamScanned &&
          row.querySelector('[data-convid]')) {
        await this.analyzeOutlookEmailRow(row);
        row.dataset.isthisspamScanned = 'true';
      }
    }
  }

  async scanOpenGmailEmail() {
    // Check if there's an open email view
    const emailView = document.querySelector('[role="main"] [role="region"]');
    if (!emailView || emailView.dataset.isthisspamScanned) return;

    const emailData = this.extractGmailEmailData(emailView);
    if (emailData) {
      const analysis = await this.analyzeEmail(emailData);
      this.displayThreatIndicator(emailView, analysis, 'gmail-open');
      emailView.dataset.isthisspamScanned = 'true';
    }
  }

  async analyzeGmailEmailRow(row) {
    const emailData = this.extractGmailRowData(row);
    if (!emailData) return;

    const analysis = await this.analyzeEmail(emailData);
    this.displayThreatIndicator(row, analysis, 'gmail-row');
  }

  async analyzeOutlookEmailRow(row) {
    const emailData = this.extractOutlookRowData(row);
    if (!emailData) return;

    const analysis = await this.analyzeEmail(emailData);
    this.displayThreatIndicator(row, analysis, 'outlook-row');
  }

  extractGmailRowData(row) {
    try {
      // Extract sender
      const senderElement = row.querySelector('[email]');
      const sender = senderElement?.getAttribute('email') || 
                    senderElement?.textContent?.trim();

      // Extract subject
      const subjectElement = row.querySelector('[data-legacy-thread-id] span[id]');
      const subject = subjectElement?.textContent?.trim();

      // Extract snippet/preview
      const snippetElement = row.querySelector('.y2 span');
      const snippet = snippetElement?.textContent?.trim();

      return {
        from: sender,
        subject: subject,
        body: snippet,
        links: this.extractLinks(row),
        platform: 'gmail'
      };
    } catch (error) {
      console.error('IsThisSpam: Error extracting Gmail row data:', error);
      return null;
    }
  }

  extractGmailEmailData(emailView) {
    try {
      // Extract sender from open email
      const senderElement = emailView.querySelector('[email]');
      const sender = senderElement?.getAttribute('email');

      // Extract subject
      const subjectElement = emailView.querySelector('h2');
      const subject = subjectElement?.textContent?.trim();

      // Extract body content
      const bodyElement = emailView.querySelector('[role="listitem"] [dir="ltr"]');
      const body = bodyElement?.textContent?.trim();

      // Extract attachments
      const attachments = Array.from(emailView.querySelectorAll('[role="button"][aria-label*="attachment"]'))
        .map(el => el.getAttribute('aria-label'));

      return {
        from: sender,
        subject: subject,
        body: body,
        links: this.extractLinks(emailView),
        attachments: attachments,
        platform: 'gmail'
      };
    } catch (error) {
      console.error('IsThisSpam: Error extracting Gmail email data:', error);
      return null;
    }
  }

  extractOutlookRowData(row) {
    try {
      // Extract sender
      const senderElement = row.querySelector('[title*="@"]');
      const sender = senderElement?.getAttribute('title') ||
                    senderElement?.textContent?.trim();

      // Extract subject
      const subjectElement = row.querySelector('[data-convid] span');
      const subject = subjectElement?.textContent?.trim();

      // Extract preview text
      const previewElement = row.querySelector('.sjmr9c span');
      const preview = previewElement?.textContent?.trim();

      return {
        from: sender,
        subject: subject,
        body: preview,
        links: this.extractLinks(row),
        platform: 'outlook'
      };
    } catch (error) {
      console.error('IsThisSpam: Error extracting Outlook row data:', error);
      return null;
    }
  }

  extractLinks(element) {
    const links = Array.from(element.querySelectorAll('a[href]'))
      .map(link => link.href)
      .filter(href => href && !href.startsWith('javascript:'))
      .slice(0, 10); // Limit to first 10 links

    return links;
  }

  async analyzeEmail(emailData) {
    // Check cache first
    const cacheKey = `${emailData.from}-${emailData.subject}`;
    if (this.emailCache.has(cacheKey)) {
      return this.emailCache.get(cacheKey);
    }

    try {
      // Send to background script for analysis
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeEmail',
        data: emailData
      });

      if (response.success) {
        // Cache the result
        this.emailCache.set(cacheKey, response.result);
        return response.result;
      } else {
        console.error('IsThisSpam: Analysis failed:', response.error);
        return this.createSafeAnalysis();
      }
    } catch (error) {
      console.error('IsThisSpam: Error communicating with background script:', error);
      return this.createSafeAnalysis();
    }
  }

  createSafeAnalysis() {
    return {
      threat_level: 'safe',
      threat_type: 'safe',
      confidence: 0.0,
      explanation: 'Analysis not available',
      red_flags: [],
      recommended_action: 'safe'
    };
  }

  displayThreatIndicator(element, analysis, context) {
    // Don't show indicator for safe emails unless explicitly configured
    if (analysis.threat_level === 'safe' && analysis.confidence < 0.1) {
      return;
    }

    // Remove existing indicator
    const existingIndicator = element.querySelector('.isthisspam-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Create new threat indicator
    const indicator = document.createElement('div');
    indicator.className = `isthisspam-indicator ${analysis.threat_level} ${context}`;
    indicator.dataset.threatLevel = analysis.threat_level;
    indicator.dataset.threatType = analysis.threat_type;
    
    // Set indicator content based on threat level
    const { icon, text, color } = this.getThreatIndicatorStyle(analysis);
    
    indicator.innerHTML = `
      <div class="isthisspam-icon" style="color: ${color}">${icon}</div>
      <div class="isthisspam-text">${text}</div>
      <div class="isthisspam-tooltip">
        <div class="isthisspam-tooltip-content">
          <strong>${analysis.threat_type.toUpperCase()}</strong>
          <p>${analysis.explanation}</p>
          ${analysis.red_flags.length > 0 ? 
            `<ul>${analysis.red_flags.map(flag => `<li>${flag}</li>`).join('')}</ul>` : 
            ''}
          <p><strong>Confidence:</strong> ${Math.round(analysis.confidence * 100)}%</p>
          <p><strong>Recommended Action:</strong> ${analysis.recommended_action}</p>
        </div>
      </div>
    `;

    // Position and style based on context
    if (context.includes('row')) {
      indicator.style.cssText = `
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 1000;
      `;
      element.style.position = 'relative';
    } else if (context.includes('open')) {
      indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 12px;
      `;
    }

    element.appendChild(indicator);
    
    // Store reference for cleanup
    this.threatIndicators.set(element, indicator);

    // Add click handler for more details
    indicator.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showDetailedAnalysis(analysis);
    });
  }

  getThreatIndicatorStyle(analysis) {
    const styles = {
      'safe': {
        icon: '✓',
        text: 'Safe',
        color: '#28a745'
      },
      'low': {
        icon: '⚠',
        text: 'Low Risk',
        color: '#ffc107'
      },
      'medium': {
        icon: '⚠',
        text: 'Caution',
        color: '#fd7e14'
      },
      'high': {
        icon: '⚠',
        text: 'High Risk',
        color: '#dc3545'
      },
      'critical': {
        icon: '🛑',
        text: 'DANGER',
        color: '#dc3545'
      }
    };

    return styles[analysis.threat_level] || styles['medium'];
  }

  showDetailedAnalysis(analysis) {
    // Create modal with detailed analysis
    const modal = document.createElement('div');
    modal.className = 'isthisspam-modal';
    modal.innerHTML = `
      <div class="isthisspam-modal-content">
        <div class="isthisspam-modal-header">
          <h3>IsThisSpam Security Analysis</h3>
          <button class="isthisspam-close">&times;</button>
        </div>
        <div class="isthisspam-modal-body">
          <div class="threat-level ${analysis.threat_level}">
            <strong>Threat Level: ${analysis.threat_level.toUpperCase()}</strong>
          </div>
          <div class="threat-type">
            <strong>Type: ${analysis.threat_type}</strong>
          </div>
          <div class="confidence">
            <strong>Confidence: ${Math.round(analysis.confidence * 100)}%</strong>
          </div>
          <div class="explanation">
            <h4>Analysis:</h4>
            <p>${analysis.explanation}</p>
          </div>
          ${analysis.red_flags.length > 0 ? `
            <div class="red-flags">
              <h4>Red Flags Detected:</h4>
              <ul>
                ${analysis.red_flags.map(flag => `<li>${flag}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          <div class="recommendation">
            <h4>Recommended Action:</h4>
            <p>${this.getActionDescription(analysis.recommended_action)}</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeBtn = modal.querySelector('.isthisspam-close');
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Auto-close after 10 seconds
    setTimeout(() => {
      if (modal.parentNode) modal.remove();
    }, 10000);
  }

  getActionDescription(action) {
    const descriptions = {
      'safe': 'This email appears safe to interact with.',
      'caution': 'Exercise caution. Verify sender identity before clicking links or downloading attachments.',
      'block': 'Consider blocking this sender. Do not click links or download attachments.',
      'delete': 'Delete this email immediately. Do not interact with its content.'
    };

    return descriptions[action] || descriptions['caution'];
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'rescanEmails':
          this.rescanAllEmails();
          sendResponse({ success: true });
          break;
        
        case 'updateSettings':
          this.handleSettingsUpdate(request.settings);
          sendResponse({ success: true });
          break;
      }
    });
  }

  async rescanAllEmails() {
    console.log('IsThisSpam: Rescanning all emails');
    
    // Clear cache and indicators
    this.emailCache.clear();
    this.clearAllThreatIndicators();
    
    // Reset scan flags
    document.querySelectorAll('[data-isthisspam-scanned]').forEach(el => {
      delete el.dataset.isthisspamScanned;
    });
    
    // Rescan based on platform
    if (this.currentPlatform === 'gmail') {
      await this.scanGmailEmails();
    } else if (this.currentPlatform === 'outlook') {
      await this.scanOutlookEmails();
    }
  }

  clearAllThreatIndicators() {
    document.querySelectorAll('.isthisspam-indicator').forEach(indicator => {
      indicator.remove();
    });
    this.threatIndicators.clear();
  }

  handleSettingsUpdate(newSettings) {
    console.log('IsThisSpam: Settings updated', newSettings);
    
    if (!newSettings.isthisspam_enabled) {
      this.clearAllThreatIndicators();
    } else {
      this.rescanAllEmails();
    }
  }

  async getSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getSettings'
      });
      return response || {};
    } catch (error) {
      console.error('IsThisSpam: Failed to get settings:', error);
      return {};
    }
  }

  // Cleanup when page unloads
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.clearAllThreatIndicators();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new IsThisSpamContentScript();
  });
} else {
  new IsThisSpamContentScript();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.isThisSpamContentScript) {
    window.isThisSpamContentScript.cleanup();
  }
});