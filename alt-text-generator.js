/**
 * Nitro SEO Schema Builder - Alt Text Generator
 * Handles generating alt text using Gemini API's vision capabilities
 */

const AltTextGenerator = {
  elements: {},
  state: {
    queue: [],
    isProcessing: false,
    isPaused: false,
    isCancelled: false,
    results: [],
    currentIndex: 0,
    apiKey: ''
  },

  init() {
    this.cacheElements();
    this.setupEventListeners();
  },

  cacheElements() {
    this.elements = {
      // Modes
      modeSingleBtn: document.getElementById('modeSingleBtn'),
      modeScanBtn: document.getElementById('modeScanBtn'),
      modeBulkBtn: document.getElementById('modeBulkBtn'),
      
      modeSingleGroup: document.getElementById('modeSingleGroup'),
      modeScanGroup: document.getElementById('modeScanGroup'),
      modeBulkGroup: document.getElementById('modeBulkGroup'),
      
      // Inputs
      singleUrl: document.getElementById('singleImageUrl'),
      scanUrl: document.getElementById('scanPageUrl'),
      bulkUrls: document.getElementById('bulkImageUrls'),
      
      // Buttons
      generateSingleBtn: document.getElementById('generateSingleBtn'),
      scanPageBtn: document.getElementById('scanPageBtn'),
      generateBulkBtn: document.getElementById('generateBulkBtn'),
      
      // Progress & Results
      altProgressCard: document.getElementById('altProgressCard'),
      altProgressBar: document.getElementById('altProgressBar'),
      altProgressText: document.getElementById('altProgressText'),
      altCurrentUrl: document.getElementById('altCurrentUrl'),
      
      altResultsCard: document.getElementById('altResultsCard'),
      altResultsGrid: document.getElementById('altResultsGrid'),
      
      // Export
      exportCsvBtn: document.getElementById('exportCsvBtn'),
      copyAllBtn: document.getElementById('copyAllBtn'),
      altRetryFailedBtn: document.getElementById('altRetryFailedBtn'),
      
      // Controls
      altPauseBtn: document.getElementById('altPauseBtn'),
      altResumeSavedBtn: document.getElementById('altResumeSavedBtn'),
      altCancelBtn: document.getElementById('altCancelBtn'),
      altClearBtn: document.getElementById('altClearBtn')
    };
  },

  setupEventListeners() {
    // Mode Switching
    if (this.elements.modeSingleBtn) {
      this.elements.modeSingleBtn.addEventListener('click', () => this.switchMode('single'));
      this.elements.modeScanBtn.addEventListener('click', () => this.switchMode('scan'));
      this.elements.modeBulkBtn.addEventListener('click', () => this.switchMode('bulk'));
    }

    // Action Buttons
    if (this.elements.generateSingleBtn) {
      this.elements.generateSingleBtn.addEventListener('click', () => this.handleSingleUrl());
      this.elements.scanPageBtn.addEventListener('click', () => this.handleScanPage());
      this.elements.generateBulkBtn.addEventListener('click', () => this.handleBulkUrls());
    }

    // Export & Retry
    if (this.elements.exportCsvBtn) {
      this.elements.exportCsvBtn.addEventListener('click', () => this.exportCSV());
      this.elements.copyAllBtn.addEventListener('click', () => this.copyAllResults());
      this.elements.altRetryFailedBtn.addEventListener('click', () => this.retryFailed());
    }

    // Control Buttons
    if (this.elements.altPauseBtn) {
      this.elements.altPauseBtn.addEventListener('click', () => this.togglePause());
      this.elements.altResumeSavedBtn.addEventListener('click', () => this.resumeSavedRun());
      this.elements.altCancelBtn.addEventListener('click', () => this.cancelProcessing());
      this.elements.altClearBtn.addEventListener('click', () => this.clearResults());
    }

    // Attempt to load saved state
    this.loadSavedState();
  },

  switchMode(mode) {
    // Update button states
    ['Single', 'Scan', 'Bulk'].forEach(m => {
      const btn = this.elements[`mode${m}Btn`];
      const group = this.elements[`mode${m}Group`];
      if (btn && group) {
        if (m.toLowerCase() === mode) {
          btn.classList.add('active');
          group.style.display = 'block';
        } else {
          btn.classList.remove('active');
          group.style.display = 'none';
        }
      }
    });
  },

  async getApiKey() {
    const apiKeyInput = document.getElementById('apiKeyHeader') || document.getElementById('apiKey');
    let key = apiKeyInput ? apiKeyInput.value.trim() : '';
    
    if (!key) {
      const saved = await chrome.storage.local.get(['apiKey']);
      key = saved.apiKey || '';
    }
    
    this.state.apiKey = key;
    return key;
  },

  async loadSavedState() {
    try {
      const data = await chrome.storage.local.get(['altTextState']);
      if (data.altTextState && data.altTextState.queue && data.altTextState.queue.length > 0) {
        this.state.queue = data.altTextState.queue;
        this.state.results = data.altTextState.results || [];
        this.state.currentIndex = data.altTextState.currentIndex || 0;
        
        // Restore UI state
        this.elements.altResultsGrid.innerHTML = '';
        this.state.results.forEach(res => {
          this.renderResultItem(res.url, res.altText, res.isError);
        });

        if (this.state.results.length > 0 || this.state.currentIndex > 0) {
          this.elements.altResultsCard.style.display = 'block';
          this.elements.exportCsvBtn.style.display = 'inline-flex';
          this.elements.copyAllBtn.style.display = 'inline-flex';
          this.elements.altClearBtn.style.display = 'inline-flex';
          this.checkRetryButtonVisibility();
        }

        // If it wasn't finished
        if (this.state.currentIndex < this.state.queue.length) {
          this.elements.altProgressCard.style.display = 'block';
          this.elements.altPauseBtn.style.display = 'none';
          this.elements.altResumeSavedBtn.style.display = 'block';
          this.elements.altCancelBtn.style.display = 'block';
          this.elements.altCurrentUrl.textContent = 'Paused (loaded from saved state).';
          this.state.isPaused = true;
          this.updateProgress();
        }
      }
    } catch (e) {
      console.error('Failed to load saved state', e);
    }
  },

  async saveState() {
    try {
      await chrome.storage.local.set({
        altTextState: {
          queue: this.state.queue,
          results: this.state.results,
          currentIndex: this.state.currentIndex
        }
      });
    } catch (e) {
      console.error('Failed to save state', e);
    }
  },

  async clearSavedState() {
    try {
      await chrome.storage.local.remove('altTextState');
    } catch (e) {
      console.error('Failed to clear saved state', e);
    }
  },

  showError(msg) {
    const errorToast = document.getElementById('errorToast');
    const errorMessage = document.getElementById('errorMessage');
    if (errorToast && errorMessage) {
      errorMessage.textContent = msg;
      errorToast.style.display = 'flex';
      setTimeout(() => {
        errorToast.style.display = 'none';
      }, 5000);
    } else {
      alert(msg);
    }
  },

  async handleSingleUrl() {
    const url = this.elements.singleUrl.value.trim();
    if (!url) {
      this.showError('Please enter an image URL');
      return;
    }
    
    const key = await this.getApiKey();
    if (!key) {
      this.showError('Please enter your Gemini API key in the header');
      return;
    }

    this.startProcessing([url]);
  },

  async handleScanPage() {
    const pageUrl = this.elements.scanUrl.value.trim();
    if (!pageUrl) {
      this.showError('Please enter a page URL to scan');
      return;
    }

    const key = await this.getApiKey();
    if (!key) {
      this.showError('Please enter your Gemini API key in the header');
      return;
    }

    this.elements.scanPageBtn.disabled = true;
    this.elements.scanPageBtn.innerHTML = '<span class="btn-loader" style="display:inline-block; border:2px solid #fff; border-top-color:transparent; border-radius:50%; width:16px; height:16px; animation:spin 1s linear infinite;"></span> Scanning...';

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'extractImages', url: pageUrl }, (res) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else if (res && res.error) reject(new Error(res.error));
          else resolve(res);
        });
      });

      const images = response.data || [];
      if (images.length === 0) {
        this.showError('No images found on this page.');
        return;
      }

      // Filter out tiny images or trackers if needed, but for now take all valid ones
      const urls = images.map(img => img.url).filter(u => u && u.startsWith('http'));
      
      if (urls.length === 0) {
        this.showError('No valid image URLs found on this page.');
        return;
      }

      this.startProcessing(urls);
    } catch (err) {
      console.error(err);
      this.showError('Failed to scan page: ' + err.message);
    } finally {
      this.elements.scanPageBtn.disabled = false;
      this.elements.scanPageBtn.innerHTML = 'Scan & Generate';
    }
  },

  async handleBulkUrls() {
    const text = this.elements.bulkUrls.value.trim();
    if (!text) {
      this.showError('Please paste at least one image URL');
      return;
    }

    const key = await this.getApiKey();
    if (!key) {
      this.showError('Please enter your Gemini API key in the header');
      return;
    }

    const urls = text.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) {
      this.showError('No valid HTTP/HTTPS URLs found');
      return;
    }

    this.startProcessing(urls);
  },

  startProcessing(urls) {
    this.state.queue = urls;
    this.state.results = [];
    this.state.currentIndex = 0;
    this.state.isProcessing = true;
    this.state.isPaused = false;
    this.state.isCancelled = false;

    this.elements.altResultsGrid.innerHTML = '';
    this.elements.altResultsCard.style.display = 'block';
    
    this.elements.altProgressCard.style.display = 'block';
    this.elements.altPauseBtn.style.display = 'block';
    this.elements.altCancelBtn.style.display = 'block';
    this.elements.exportCsvBtn.style.display = 'none';
    this.elements.copyAllBtn.style.display = 'none';
    this.elements.altClearBtn.style.display = 'none';
    this.elements.altRetryFailedBtn.style.display = 'none';
    this.elements.altResumeSavedBtn.style.display = 'none';

    this.saveState();
    this.updateProgress();
    this.processNext();
  },

  resumeSavedRun() {
    this.state.isPaused = false;
    this.state.isCancelled = false;
    this.state.isProcessing = true;
    this.elements.altResumeSavedBtn.style.display = 'none';
    this.elements.altPauseBtn.style.display = 'block';
    this.elements.altPauseBtn.innerHTML = '<span class="btn-text">⏸ Pause</span>';
    
    this.processNext();
  },

  retryFailed() {
    const failedUrls = this.state.results.filter(r => r.isError).map(r => r.url);
    if (failedUrls.length === 0) return;

    // Filter out errors from current results and UI
    this.state.results = this.state.results.filter(r => !r.isError);
    this.elements.altResultsGrid.innerHTML = '';
    this.state.results.forEach(res => {
      this.renderResultItem(res.url, res.altText, false);
    });

    this.elements.altRetryFailedBtn.style.display = 'none';

    // Append failed to the end of the queue or just create a new queue
    // For simplicity, let's create a new queue with just the failed ones and the successes already in results
    const successUrls = this.state.results.map(r => r.url);
    this.state.queue = [...successUrls, ...failedUrls];
    this.state.currentIndex = successUrls.length; // Start right after successes
    
    this.state.isProcessing = true;
    this.state.isPaused = false;
    this.state.isCancelled = false;

    this.elements.altProgressCard.style.display = 'block';
    this.elements.altPauseBtn.style.display = 'block';
    this.elements.altCancelBtn.style.display = 'block';
    this.elements.altResumeSavedBtn.style.display = 'none';

    this.saveState();
    this.updateProgress();
    this.processNext();
  },

  async processNext() {
    if (this.state.isCancelled) return;
    if (this.state.isPaused) return;

    if (this.state.currentIndex >= this.state.queue.length) {
      this.finishProcessing();
      return;
    }

    const url = this.state.queue[this.state.currentIndex];
    this.elements.altCurrentUrl.textContent = 'Processing: ' + url;

    try {
      const altText = await this.generateAltText(this.state.apiKey, url);
      this.addResult(url, altText);
    } catch (err) {
      console.error('Error generating alt text for', url, err);
      this.addResult(url, 'ERROR: ' + err.message, true);
    }

    this.state.currentIndex++;
    this.saveState();
    this.updateProgress();
    
    // Add small delay to avoid rate limits
    setTimeout(() => this.processNext(), 1000);
  },

  async generateAltText(apiKey, imageUrl) {
    // 1. Fetch image as base64 via background script to avoid CORS
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'fetchImageAsBase64', url: imageUrl }, (res) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else if (res && res.error) reject(new Error(res.error));
        else resolve(res);
      });
    });

    const base64DataUri = response.data;
    if (!base64DataUri) {
      throw new Error('Failed to fetch image data');
    }

    // Format for Gemini API
    // data:image/jpeg;base64,....
    const match = base64DataUri.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid image data format');
    }
    
    const mimeType = match[1];
    const base64Str = match[2];

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = "Generate a highly descriptive, SEO-optimized alt text for this image. Keep it under 125 characters, focus on key visual details, and do not start with 'Image of' or 'Picture of'.";

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Str
            }
          }
        ]
      }]
    };

    const fetchResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!fetchResponse.ok) {
      const err = await fetchResponse.json().catch(() => ({}));
      throw new Error(err.error?.message || `API Error: ${fetchResponse.status}`);
    }

    const data = await fetchResponse.json();
    let altText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean up response
    altText = altText.trim().replace(/\n/g, ' ');
    
    return altText;
  },

  addResult(url, altText, isError = false) {
    this.state.results.push({ url, altText, isError });
    this.renderResultItem(url, altText, isError);
  },

  renderResultItem(url, altText, isError = false) {
    const col = document.createElement('div');
    col.className = 'alt-result-card';
    if (isError) col.classList.add('error');
    
    col.innerHTML = `
      <div class="alt-result-img">
        <img src="${url}" alt="Preview" onerror="this.src='images/placeholder.png'; this.style.opacity='0.5';" />
      </div>
      <div class="alt-result-content">
        <div class="alt-result-url" title="${url}">${url}</div>
        <textarea class="alt-result-text ${isError ? 'error-text' : ''}" ${isError ? 'readonly' : ''}>${altText}</textarea>
        <div class="alt-result-actions">
          <button class="btn-ghost btn-small copy-btn">📋 Copy</button>
        </div>
      </div>
    `;

    // Hook up copy button
    const copyBtn = col.querySelector('.copy-btn');
    const textarea = col.querySelector('.alt-result-text');
    
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(textarea.value);
      copyBtn.textContent = '✓ Copied';
      setTimeout(() => copyBtn.textContent = '📋 Copy', 2000);
    });
    
    // Update result in state if user edits
    textarea.addEventListener('change', () => {
      const idx = this.state.results.findIndex(r => r.url === url);
      if (idx !== -1) {
        this.state.results[idx].altText = textarea.value;
        this.saveState();
      }
    });

    this.elements.altResultsGrid.appendChild(col);
  },

  updateProgress() {
    const total = this.state.queue.length;
    const current = this.state.currentIndex;
    const pct = total === 0 ? 0 : Math.round((current / total) * 100);
    
    this.elements.altProgressBar.style.width = `${pct}%`;
    this.elements.altProgressText.textContent = `${current} / ${total}`;
  },

  togglePause() {
    this.state.isPaused = !this.state.isPaused;
    if (this.state.isPaused) {
      this.elements.altPauseBtn.innerHTML = '<span class="btn-text">▶ Resume</span>';
      this.elements.altCurrentUrl.textContent = 'Paused...';
    } else {
      this.elements.altPauseBtn.innerHTML = '<span class="btn-text">⏸ Pause</span>';
      this.processNext();
    }
    this.saveState();
  },

  cancelProcessing() {
    this.state.isCancelled = true;
    this.elements.altCurrentUrl.textContent = 'Cancelled.';
    this.saveState();
    this.finishProcessing();
  },

  finishProcessing() {
    this.state.isProcessing = false;
    this.elements.altPauseBtn.style.display = 'none';
    this.elements.altCancelBtn.style.display = 'none';
    
    if (this.state.results.length > 0) {
      this.elements.exportCsvBtn.style.display = 'inline-flex';
      this.elements.copyAllBtn.style.display = 'inline-flex';
      this.elements.altClearBtn.style.display = 'inline-flex';
      this.checkRetryButtonVisibility();
    }
    
    this.elements.altCurrentUrl.textContent = 'Processing complete.';
    setTimeout(() => {
      this.elements.altProgressCard.style.display = 'none';
    }, 2000);
    this.saveState();
  },

  checkRetryButtonVisibility() {
    const hasErrors = this.state.results.some(r => r.isError);
    this.elements.altRetryFailedBtn.style.display = hasErrors ? 'inline-flex' : 'none';
  },

  clearResults() {
    this.state.results = [];
    this.state.queue = [];
    this.state.currentIndex = 0;
    this.elements.altResultsGrid.innerHTML = '';
    this.elements.altResultsCard.style.display = 'none';
    this.elements.exportCsvBtn.style.display = 'none';
    this.elements.copyAllBtn.style.display = 'none';
    this.elements.altClearBtn.style.display = 'none';
    this.elements.altRetryFailedBtn.style.display = 'none';
    this.clearSavedState();
  },

  exportCSV() {
    if (this.state.results.length === 0) return;
    
    // Format: Image URL,Alt Text
    let csv = 'Image URL,Alt Text\n';
    
    this.state.results.forEach(res => {
      // Escape quotes in alt text
      const cleanAlt = res.altText.replace(/"/g, '""');
      csv += `${res.url},"${cleanAlt}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'image_alt_texts.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  },
  
  copyAllResults() {
    if (this.state.results.length === 0) return;
    let txt = '';
    this.state.results.forEach(res => {
      txt += `${res.url}\t${res.altText}\n`;
    });
    navigator.clipboard.writeText(txt);
    
    const originalText = this.elements.copyAllBtn.innerHTML;
    this.elements.copyAllBtn.innerHTML = '✓ Copied All';
    setTimeout(() => {
      this.elements.copyAllBtn.innerHTML = originalText;
    }, 2000);
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  AltTextGenerator.init();
});
