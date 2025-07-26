// Popup script for IsThisSpam extension
class IsThisSpamPopup {
  constructor() {
    this.currentTab = null;
    this.settings = {};
    this.stats = {};
    this.platform = 'unknown';
    
    this.initializePopup();
  }

  async initializePopup() {
    console.log('IsThisSpam: Initializing popup');
    
    // Get current tab information
    await this.getCurrentTab();
    
    // Load settings and statistics
    await this.loadData();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Update UI
    this.updateUI();
    
    // Check platform and update platform indicator
    this.detectPlatform();
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      });
      this.currentTab = tab;
      console.log('IsThisSpam: Current tab:', tab.url);
    } catch (error) {
      console.error('IsThisSpam: Error getting current tab:', error);
    }
  }

  async loadData() {
    try {
      // Load settings from background script
      const settingsResponse = await chrome.runtime.sendMessage({
        action: 'getSettings'
      });
      this.settings = settingsResponse || this.getDefaultSettings();

      // Load statistics from storage
      const result = await chrome.storage.local.get([
        'emailsScanned',
        'threatsBlocked',
        'spamCount',
        'phishingCount',
        'scamCount',
        'lastScanDate'
      ]);
      
      this.stats = {
        emailsScanned: result.emailsScanned || 0,
        threatsBlocked: result.threatsBlocked || 0,
        spamCount: result.spamCount || 0,
        phishingCount: result.phishingCount || 0,
        scamCount: result.scamCount || 0,
        lastScanDate: result.lastScanDate || new Date().toDateString()
      };

      // Reset daily stats if it's a new day
      const today = new Date().toDateString();
      if (this.stats.lastScanDate !== today) {
        this.stats.spamCount = 0;
        this.stats.phishingCount = 0;
        this.stats.scamCount = 0;
        this.stats.lastScanDate = today;
        await this.saveStats();
      }

    } catch (error) {
      console.error('IsThisSpam: Error loading data:', error);
      this.settings = this.getDefaultSettings();
      this.stats = this.getDefaultStats();
    }
  }

  getDefaultSettings() {
    return {
      isthisspam_enabled: true,
      scan_mode: 'auto',
      threat_threshold: 'medium',
      show_notifications: true,
      scan_attachments: true,
      privacy_mode: false
    };
  }

  getDefaultStats() {
    return {
      emailsScanned: 0,
      threatsBlocked: 0,
      spamCount: 0,
      phishingCount: 0,
      scamCount: 0,
      lastScanDate: new Date().toDateString()
    };
  }

  setupEventListeners() {
    // Toggle switch for enabling/disabling extension
    const toggleSwitch = document.getElementById('toggleSwitch');
    toggleSwitch.addEventListener('click', () => this.toggleExtension());

    // Scan now button
    const scanNowBtn = document.getElementById('scanNowBtn');
    scanNowBtn.addEventListener('click', () => this.scanCurrentPage());

    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn.addEventListener('click', () => this.openSettings());

    // Report button
    const reportBtn = document.getElementById('reportBtn');
    reportBtn.addEventListener('click', () => this.openReport());

    // Footer links
    document.getElementById('helpLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.openExternalLink('https://isthisspam.org/help');
    });

    document.getElementById('privacyLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.openExternalLink('https://isthisspam.org/privacy');
    });

    document.getElementById('websiteLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.openExternalLink('https://isthisspam.org');
    });
  }

  updateUI() {
    // Update status indicator
    this.updateStatusIndicator();
    
    // Update statistics
    this.updateStatistics();
    
    // Update platform indicator
    this.updatePlatformIndicator();
  }

  updateStatusIndicator() {
    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusSubtitle = document.getElementById('statusSubtitle');
    const toggleSwitch = document.getElementById('toggleSwitch');

    if (this.settings.isthisspam_enabled) {
      statusIcon.className = 'status-icon active';
      statusIcon.textContent = '🛡️';
      statusTitle.textContent = 'Protection Active';
      statusSubtitle.textContent = 'Scanning emails in real-time';
      toggleSwitch.classList.add('active');
    } else {
      statusIcon.className = 'status-icon inactive';
      statusIcon.textContent = '⚠️';
      statusTitle.textContent = 'Protection Disabled';
      statusSubtitle.textContent = 'Click to enable email scanning';
      toggleSwitch.classList.remove('active');
    }
  }

  updateStatistics() {
    document.getElementById('emailsScanned').textContent = this.formatNumber(this.stats.emailsScanned);
    document.getElementById('threatsBlocked').textContent = this.formatNumber(this.stats.threatsBlocked);
    document.getElementById('spamCount').textContent = this.stats.spamCount;
    document.getElementById('phishingCount').textContent = this.stats.phishingCount;
    document.getElementById('scamCount').textContent = this.stats.scamCount;
  }

  updatePlatformIndicator() {
    const platformText = document.getElementById('platformText');
    
    if (!this.currentTab) {
      platformText.textContent = 'No active tab detected';
      return;
    }

    const url = this.currentTab.url;
    
    if (url.includes('mail.google.com')) {
      this.platform = 'gmail';
      platformText.textContent = 'Gmail detected - Protection active';
      platformText.style.color = '#28a745';
    } else if (url.includes('outlook')) {
      this.platform = 'outlook';
      platformText.textContent = 'Outlook detected - Protection active';
      platformText.style.color = '#28a745';
    } else {
      this.platform = 'unknown';
      platformText.textContent = 'Not on supported email platform';
      platformText.style.color = '#666';
    }
  }

  detectPlatform() {
    if (!this.currentTab) return;
    
    const url = this.currentTab.url;
    const platformIndicator = document.getElementById('platformIndicator');
    const scanNowBtn = document.getElementById('scanNowBtn');
    
    if (url.includes('mail.google.com') || url.includes('outlook')) {
      platformIndicator.style.display = 'flex';
      scanNowBtn.disabled = false;
    } else {
      scanNowBtn.disabled = true;
      scanNowBtn.textContent = '🔍 Email platform not detected';
    }
  }

  async toggleExtension() {
    try {
      this.settings.isthisspam_enabled = !this.settings.isthisspam_enabled;
      
      // Update settings in background script
      await chrome.runtime.sendMessage({
        action: 'updateSettings',
        data: this.settings
      });

      // Update UI
      this.updateStatusIndicator();
      
      // Show notification
      this.showNotification(
        this.settings.isthisspam_enabled ? 
        'IsThisSpam protection enabled' : 
        'IsThisSpam protection disabled',
        this.settings.isthisspam_enabled ? 'success' : 'info'
      );

      // Notify content script of settings change
      if (this.currentTab && this.currentTab.id) {
        chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'updateSettings',
          settings: this.settings
        }).catch(() => {
          // Content script might not be loaded, ignore error
        });
      }

    } catch (error) {
      console.error('IsThisSpam: Error toggling extension:', error);
      this.showNotification('Error updating settings', 'error');
    }
  }

  async scanCurrentPage() {
    if (!this.currentTab || !this.currentTab.id) {
      this.showNotification('No active tab to scan', 'error');
      return;
    }

    if (!this.settings.isthisspam_enabled) {
      this.showNotification('Please enable IsThisSpam first', 'error');
      return;
    }

    try {
      // Show loading state
      this.showLoading(true);
      
      // Trigger rescan in content script
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'rescanEmails'
      });

      // Update statistics (simulated for demo)
      this.stats.emailsScanned += Math.floor(Math.random() * 5) + 1;
      await this.saveStats();
      this.updateStatistics();

      this.showLoading(false);
      this.showNotification('Email scan completed', 'success');

    } catch (error) {
      console.error('IsThisSpam: Error scanning page:', error);
      this.showLoading(false);
      this.showNotification('Error scanning emails. Please refresh the page.', 'error');
    }
  }

  openSettings() {
    // Create a simple settings dialog
    const settingsHtml = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; border-radius: 12px; padding: 24px; max-width: 320px; width: 90%;">
          <h3 style="margin: 0 0 16px 0; color: #333;">Settings</h3>
          
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="settingNotifications" ${this.settings.show_notifications ? 'checked' : ''}>
              Show notifications
            </label>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="settingScanAttachments" ${this.settings.scan_attachments ? 'checked' : ''}>
              Scan attachments
            </label>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="settingPrivacyMode" ${this.settings.privacy_mode ? 'checked' : ''}>
              Privacy mode (local AI only)
            </label>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 4px; font-size: 14px; color: #666;">
              Threat sensitivity:
            </label>
            <select id="settingThreatThreshold" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              <option value="low" ${this.settings.threat_threshold === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${this.settings.threat_threshold === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${this.settings.threat_threshold === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>
          
          <div style="display: flex; gap: 8px;">
            <button id="saveSettings" style="flex: 1; background: #007bff; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Save</button>
            <button id="cancelSettings" style="flex: 1; background: #6c757d; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Cancel</button>
          </div>
        </div>
      </div>
    `;

    const settingsModal = document.createElement('div');
    settingsModal.innerHTML = settingsHtml;
    document.body.appendChild(settingsModal);

    // Setup event listeners for settings modal
    document.getElementById('saveSettings').addEventListener('click', async () => {
      try {
        // Get updated settings
        this.settings.show_notifications = document.getElementById('settingNotifications').checked;
        this.settings.scan_attachments = document.getElementById('settingScanAttachments').checked;
        this.settings.privacy_mode = document.getElementById('settingPrivacyMode').checked;
        this.settings.threat_threshold = document.getElementById('settingThreatThreshold').value;

        // Save to background script
        await chrome.runtime.sendMessage({
          action: 'updateSettings',
          data: this.settings
        });

        settingsModal.remove();
        this.showNotification('Settings saved successfully', 'success');
      } catch (error) {
        console.error('IsThisSpam: Error saving settings:', error);
        this.showNotification('Error saving settings', 'error');
      }
    });

    document.getElementById('cancelSettings').addEventListener('click', () => {
      settingsModal.remove();
    });
  }

  openReport() {
    // Generate and display a simple report
    const reportData = {
      emailsScanned: this.stats.emailsScanned,
      threatsBlocked: this.stats.threatsBlocked,
      spamBlocked: this.stats.spamCount,
      phishingBlocked: this.stats.phishingCount,
      scamsBlocked: this.stats.scamCount,
      protectionRate: this.stats.emailsScanned > 0 ? 
        ((this.stats.threatsBlocked / this.stats.emailsScanned) * 100).toFixed(1) : 0,
      date: new Date().toLocaleDateString()
    };

    const reportHtml = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; border-radius: 12px; padding: 24px; max-width: 400px; width: 90%; max-height: 80vh; overflow-y: auto;">
          <h3 style="margin: 0 0 16px 0; color: #333;">Security Report</h3>
          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Generated on ${reportData.date}</p>
          
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #007bff;">${reportData.emailsScanned}</div>
                <div style="font-size: 12px; color: #666;">Emails Scanned</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${reportData.threatsBlocked}</div>
                <div style="font-size: 12px; color: #666;">Threats Blocked</div>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <h4 style="font-size: 14px; margin-bottom: 8px; color: #333;">Threat Breakdown</h4>
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
              <span style="font-size: 14px;">Spam:</span>
              <span style="font-weight: bold; color: #ffc107;">${reportData.spamBlocked}</span>
            </div>
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
              <span style="font-size: 14px;">Phishing:</span>
              <span style="font-weight: bold; color: #dc3545;">${reportData.phishingBlocked}</span>
            </div>
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
              <span style="font-size: 14px;">Scams:</span>
              <span style="font-weight: bold; color: #dc3545;">${reportData.scamsBlocked}</span>
            </div>
          </div>

          <div style="background: #e7f3ff; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
            <div style="font-size: 14px; color: #0066cc;">
              <strong>Protection Rate: ${reportData.protectionRate}%</strong>
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">
              Percentage of emails that contained threats
            </div>
          </div>

          <button id="closeReport" style="width: 100%; background: #007bff; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Close Report</button>
        </div>
      </div>
    `;

    const reportModal = document.createElement('div');
    reportModal.innerHTML = reportHtml;
    document.body.appendChild(reportModal);

    document.getElementById('closeReport').addEventListener('click', () => {
      reportModal.remove();
    });
  }

  showLoading(show) {
    const loadingState = document.getElementById('loadingState');
    const mainContent = document.querySelector('.main-content');
    
    if (show) {
      loadingState.classList.add('active');
      mainContent.style.display = 'none';
    } else {
      loadingState.classList.remove('active');
      mainContent.style.display = 'block';
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');

    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  async saveStats() {
    try {
      await chrome.storage.local.set({
        emailsScanned: this.stats.emailsScanned,
        threatsBlocked: this.stats.threatsBlocked,
        spamCount: this.stats.spamCount,
        phishingCount: this.stats.phishingCount,
        scamCount: this.stats.scamCount,
        lastScanDate: this.stats.lastScanDate
      });
    } catch (error) {
      console.error('IsThisSpam: Error saving stats:', error);
    }
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  openExternalLink(url) {
    chrome.tabs.create({ url });
    window.close();
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new IsThisSpamPopup();
});