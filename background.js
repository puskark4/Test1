// Background service worker for IsThisSpam extension
class IsThisSpamBackground {
  constructor() {
    this.aiSession = null;
    this.modelReady = false;
    this.initializeExtension();
  }

  async initializeExtension() {
    console.log('IsThisSpam: Extension background initialized');
    
    // Listen for extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.handleFirstInstall();
      } else if (details.reason === 'update') {
        this.handleUpdate(details.previousVersion);
      }
    });

    // Initialize AI capabilities
    await this.initializeAI();

    // Set up message handlers
    this.setupMessageHandlers();
  }

  async handleFirstInstall() {
    console.log('IsThisSpam: First install detected');
    
    // Set default settings
    await chrome.storage.sync.set({
      'isthisspam_enabled': true,
      'scan_mode': 'auto', // auto, manual, smart
      'threat_threshold': 'medium', // low, medium, high
      'show_notifications': true,
      'scan_attachments': true,
      'privacy_mode': false // If true, uses local AI only
    });

    // Open welcome page
    chrome.tabs.create({
      url: 'https://isthisspam.org/welcome'
    });
  }

  async handleUpdate(previousVersion) {
    console.log(`IsThisSpam: Updated from version ${previousVersion}`);
    // Handle any migration logic here
  }

  async initializeAI() {
    try {
      // Check if Chrome's built-in AI is available
      if (typeof window !== 'undefined' && window.ai) {
        console.log('IsThisSpam: Chrome built-in AI detected');
        await this.initializeBuiltInAI();
      } else {
        console.log('IsThisSpam: Using cloud-based AI models');
        await this.initializeCloudAI();
      }
    } catch (error) {
      console.error('IsThisSpam: Failed to initialize AI:', error);
    }
  }

  async initializeBuiltInAI() {
    try {
      // Check if language model is available
      const capabilities = await ai.languageModel.capabilities();
      
      if (capabilities.available === 'readily') {
        this.aiSession = await ai.languageModel.create({
          systemPrompt: `You are an expert email security analyst. Your job is to analyze emails and detect:
1. Spam - Unwanted commercial emails
2. Scams - Fraudulent attempts to steal money or information  
3. Phishing - Attempts to steal credentials or personal information

Analyze the email content, sender information, links, and patterns. Return a JSON response with:
{
  "threat_level": "safe|low|medium|high|critical",
  "threat_type": "safe|spam|scam|phishing|malware",
  "confidence": 0.0-1.0,
  "explanation": "Brief explanation of the analysis",
  "red_flags": ["list", "of", "suspicious", "elements"],
  "recommended_action": "safe|caution|block|delete"
}`
        });
        
        this.modelReady = true;
        console.log('IsThisSpam: Built-in AI model ready');
      }
    } catch (error) {
      console.error('IsThisSpam: Built-in AI initialization failed:', error);
      await this.initializeCloudAI();
    }
  }

  async initializeCloudAI() {
    // Fallback to cloud-based AI detection
    this.modelReady = true;
    console.log('IsThisSpam: Cloud AI model ready');
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'analyzeEmail':
          this.handleEmailAnalysis(request.data, sendResponse);
          return true; // Async response

        case 'getSettings':
          this.getSettings(sendResponse);
          return true;

        case 'updateSettings':
          this.updateSettings(request.data, sendResponse);
          return true;

        case 'checkAIStatus':
          sendResponse({ ready: this.modelReady });
          break;

        default:
          console.warn('IsThisSpam: Unknown message action:', request.action);
      }
    });
  }

  async handleEmailAnalysis(emailData, sendResponse) {
    try {
      console.log('IsThisSpam: Analyzing email:', emailData.subject);
      
      const result = await this.analyzeEmailContent(emailData);
      sendResponse({ success: true, result });
    } catch (error) {
      console.error('IsThisSpam: Email analysis failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async analyzeEmailContent(emailData) {
    const settings = await chrome.storage.sync.get();
    
    if (settings.privacy_mode && this.aiSession) {
      return await this.analyzeWithBuiltInAI(emailData);
    } else {
      return await this.analyzeWithCloudAI(emailData);
    }
  }

  async analyzeWithBuiltInAI(emailData) {
    if (!this.aiSession) {
      throw new Error('AI session not available');
    }

    const prompt = `Analyze this email for spam, scams, and phishing:

Subject: ${emailData.subject || 'No subject'}
From: ${emailData.from || 'Unknown sender'}
Body: ${emailData.body || 'No content'}
Links: ${emailData.links?.join(', ') || 'None'}
Attachments: ${emailData.attachments?.join(', ') || 'None'}

Provide analysis in the specified JSON format.`;

    const response = await this.aiSession.prompt(prompt);
    return this.parseAIResponse(response);
  }

  async analyzeWithCloudAI(emailData) {
    // Use pattern matching and rule-based detection for now
    // In production, this would integrate with cloud AI services
    const analysis = this.performRuleBasedAnalysis(emailData);
    return analysis;
  }

  performRuleBasedAnalysis(emailData) {
    const redFlags = [];
    let threatLevel = 'safe';
    let threatType = 'safe';
    let confidence = 0.0;

    // Check sender reputation
    if (this.isSuspiciousSender(emailData.from)) {
      redFlags.push('Suspicious sender domain');
      threatLevel = 'medium';
      confidence += 0.3;
    }

    // Check for phishing indicators
    if (this.containsPhishingIndicators(emailData)) {
      redFlags.push('Contains phishing indicators');
      threatLevel = 'high';
      threatType = 'phishing';
      confidence += 0.4;
    }

    // Check for spam patterns
    if (this.containsSpamPatterns(emailData)) {
      redFlags.push('Contains spam patterns');
      if (threatLevel === 'safe') {
        threatLevel = 'low';
        threatType = 'spam';
      }
      confidence += 0.2;
    }

    // Check for scam indicators
    if (this.containsScamIndicators(emailData)) {
      redFlags.push('Contains scam indicators');
      threatLevel = 'critical';
      threatType = 'scam';
      confidence += 0.5;
    }

    // Check links
    if (this.hasSuspiciousLinks(emailData.links)) {
      redFlags.push('Contains suspicious links');
      threatLevel = 'high';
      confidence += 0.3;
    }

    return {
      threat_level: threatLevel,
      threat_type: threatType,
      confidence: Math.min(confidence, 1.0),
      explanation: this.generateExplanation(threatType, redFlags),
      red_flags: redFlags,
      recommended_action: this.getRecommendedAction(threatLevel)
    };
  }

  isSuspiciousSender(sender) {
    if (!sender) return true;
    
    const suspiciousDomains = [
      'tempmail', 'guerrillamail', '10minutemail', 'mailinator',
      'throwaway', 'temp-mail'
    ];
    
    const suspiciousPatterns = [
      /noreply.*@.*\.tk$/,
      /admin.*@.*\.ml$/,
      /security.*@.*\.ga$/
    ];

    return suspiciousDomains.some(domain => sender.includes(domain)) ||
           suspiciousPatterns.some(pattern => pattern.test(sender));
  }

  containsPhishingIndicators(emailData) {
    const phishingKeywords = [
      'verify your account', 'suspend your account', 'confirm your identity',
      'update payment method', 'unusual activity', 'verify now',
      'click here immediately', 'urgent action required'
    ];

    const content = `${emailData.subject} ${emailData.body}`.toLowerCase();
    return phishingKeywords.some(keyword => content.includes(keyword));
  }

  containsSpamPatterns(emailData) {
    const spamKeywords = [
      'make money fast', 'get rich quick', 'work from home',
      'free money', 'congratulations you won', 'claim your prize',
      'limited time offer', 'act now', 'no purchase necessary'
    ];

    const content = `${emailData.subject} ${emailData.body}`.toLowerCase();
    return spamKeywords.some(keyword => content.includes(keyword));
  }

  containsScamIndicators(emailData) {
    const scamKeywords = [
      'nigerian prince', 'inheritance', 'lottery winner', 'refund pending',
      'tax refund', 'government grant', 'charity donation', 'advance fee',
      'wire transfer', 'western union', 'money gram'
    ];

    const content = `${emailData.subject} ${emailData.body}`.toLowerCase();
    return scamKeywords.some(keyword => content.includes(keyword));
  }

  hasSuspiciousLinks(links) {
    if (!links || links.length === 0) return false;

    const suspiciousPatterns = [
      /bit\.ly/, /tinyurl/, /t\.co/, /goo\.gl/,
      /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/, // IP addresses
      /[a-z0-9]{10,}\.tk$/, /[a-z0-9]{10,}\.ml$/
    ];

    return links.some(link => 
      suspiciousPatterns.some(pattern => pattern.test(link))
    );
  }

  generateExplanation(threatType, redFlags) {
    const explanations = {
      'safe': 'No security threats detected in this email.',
      'spam': 'This email contains promotional content and spam indicators.',
      'phishing': 'This email may be attempting to steal your credentials or personal information.',
      'scam': 'This email appears to be a fraudulent attempt to steal money or information.',
      'malware': 'This email may contain malicious attachments or links.'
    };

    let explanation = explanations[threatType] || explanations['safe'];
    
    if (redFlags.length > 0) {
      explanation += ` Red flags detected: ${redFlags.join(', ')}.`;
    }

    return explanation;
  }

  getRecommendedAction(threatLevel) {
    const actions = {
      'safe': 'safe',
      'low': 'caution',
      'medium': 'caution',
      'high': 'block',
      'critical': 'delete'
    };

    return actions[threatLevel] || 'caution';
  }

  parseAIResponse(response) {
    try {
      // Try to extract JSON from AI response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('IsThisSpam: Failed to parse AI response:', error);
    }

    // Fallback response
    return {
      threat_level: 'medium',
      threat_type: 'unknown',
      confidence: 0.5,
      explanation: 'Unable to fully analyze email content',
      red_flags: ['Analysis incomplete'],
      recommended_action: 'caution'
    };
  }

  async getSettings(sendResponse) {
    const settings = await chrome.storage.sync.get();
    sendResponse(settings);
  }

  async updateSettings(newSettings, sendResponse) {
    await chrome.storage.sync.set(newSettings);
    sendResponse({ success: true });
  }
}

// Initialize the background service
new IsThisSpamBackground();