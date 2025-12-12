// Configuration
const CONFIG = {
  extractionTimeout: 30000, // 30 seconds
  maxLoadAttempts: 60,      // 30 seconds max (60 * 500ms)
  checkInterval: 500,       // Check every 500ms
  initialDelay: 1000,       // Initial delay before checking page load
  dynamicContentDelay: 2000 // Additional delay for dynamic content
};

// Blocked URL patterns
const BLOCKED_URL_PATTERNS = [
  'chrome://*',
  'chrome-extension://*',
  'moz-extension://*',
  'edge://*',
  'about:*',
  'file://*'
];

// Background service worker for Nitro SEO Schema Builder

/**
 * Check if a URL is blocked
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL is blocked
 */
function isUrlBlocked(url) {
  if (!url) return true;
  return BLOCKED_URL_PATTERNS.some(pattern => 
    new RegExp(`^${pattern.replace(/\*/g, '.*')}`).test(url)
  );
}

/**
 * Create a promise that resolves after a delay
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle extension icon click to open new tab
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html'),
    active: true
  }).catch(error => {
    console.error('Failed to create new tab:', error);
  });
});

// Handle messages from content scripts and popup
const messageHandlers = {
  async fetchPage(url) {
    try {
      const data = await fetchPage(url);
      return { data };
    } catch (error) {
      console.error('Error in fetchPage handler:', error);
      return { error: error.message };
    }
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action && messageHandlers[request.action]) {
    const handler = messageHandlers[request.action];
    handler(request.url || request.data)
      .then(sendResponse)
      .catch(error => ({
        error: error.message || 'An unknown error occurred'
      }));
    return true; // Keep the message channel open for async response
  }
  return false;
});

/**
 * Safely remove a tab by ID
 * @param {number} tabId - The ID of the tab to remove
 * @returns {Promise<void>}
 */
async function safeRemoveTab(tabId) {
  if (!tabId) return;
  
  try {
    await new Promise((resolve) => {
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          // Ignore errors about non-existent tabs
          if (!chrome.runtime.lastError.message.includes('No tab with id')) {
            console.warn('Error removing tab:', chrome.runtime.lastError);
          }
        }
        resolve();
      });
    });
  } catch (error) {
    console.warn('Error in safeRemoveTab:', error);
  }
}

/**
 * Extract content from the current tab
 * @param {number} tabId - The ID of the tab to extract content from
 * @returns {Promise<Object>} The extracted content
 */
async function extractContent(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractContentFromDOM
    });
    
    if (!result?.result) {
      throw new Error('No content was extracted from the page');
    }
    
    return result.result;
  } catch (error) {
    console.error('Content extraction failed:', error);
    throw new Error(`Failed to extract content: ${error.message}`);
  }
}

/**
 * Wait for a tab to finish loading
 * @param {number} tabId - The ID of the tab to wait for
 * @returns {Promise<boolean>} True if the page loaded successfully, false if timed out
 */
async function waitForPageLoad(tabId) {
  let attempts = 0;
  
  while (attempts < CONFIG.maxLoadAttempts) {
    const tab = await new Promise(resolve => {
      chrome.tabs.get(tabId, tab => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(tab);
        }
      });
    });
    
    if (!tab) {
      throw new Error('Tab was closed before loading completed');
    }
    
    if (tab.status === 'complete') {
      // Additional delay for dynamic content
      await delay(CONFIG.dynamicContentDelay);
      return true;
    }
    
    attempts++;
    await delay(CONFIG.checkInterval);
  }
  
  return false;
}

/**
 * Fetch page content by creating a hidden tab and extracting content
 * @param {string} url - The URL to fetch content from
 * @returns {Promise<Object>} The extracted page content
 */
async function fetchPage(url) {
  if (isUrlBlocked(url)) {
    throw new Error('Access to this URL type is not allowed');
  }

  let tabId;
  let timeoutId;
  
  try {
    // Create a new tab
    const tab = await new Promise((resolve, reject) => {
      chrome.tabs.create({ url, active: false }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(tab);
        }
      });
    });
    
    tabId = tab.id;
    
    // Wait for page to load with timeout
    const pageLoaded = await Promise.race([
      waitForPageLoad(tabId),
      delay(CONFIG.extractionTimeout).then(() => false)
    ]);
    
    if (!pageLoaded) {
      console.warn(`Page ${url} took too long to load, attempting extraction anyway...`);
    }
    
    // Extract content with timeout
    const content = await Promise.race([
      extractContent(tabId),
      delay(CONFIG.extractionTimeout).then(() => {
        throw new Error('Content extraction timed out');
      })
    ]);
    
    return content;
    
  } catch (error) {
    console.error('Error in fetchPage:', error);
    throw error;
    
  } finally {
    // Cleanup
    if (timeoutId) clearTimeout(timeoutId);
    if (tabId) await safeRemoveTab(tabId);
  }
}

// Function to extract content from DOM (injected into page)
// Function to extract content from DOM (injected into page)
function extractContentFromDOM() {
  // Remove navigation and footer elements
  const selectorsToRemove = [
    'nav', 'header', 'footer',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '.nav', '.navbar', '.navigation', '.menu', '.header', '.footer',
    '#nav', '#navbar', '#navigation', '#menu', '#header', '#footer',
    '.site-header', '.site-footer', '.page-header', '.page-footer',
    '.main-navigation', '.primary-navigation', '.secondary-navigation',
    '.sidebar', '.widget', '.cookie-banner', '.cookie-notice',
    '[class*="cookie"]', '[id*="cookie"]',
    '.breadcrumb', '.breadcrumbs'
  ];

  const clone = document.cloneNode(true);
  selectorsToRemove.forEach(selector => {
    try {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    } catch (e) {
      // Ignore selector errors
    }
  });

  // Extract content
  const title = clone.querySelector('title')?.textContent?.trim() || '';
  const metaDesc = clone.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
  const h1s = Array.from(clone.querySelectorAll('h1')).map(h => h.textContent.trim()).filter(Boolean);

  // Extract dates
  const datePublished = clone.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
                       clone.querySelector('meta[name="datePublished"]')?.getAttribute('content') ||
                       clone.querySelector('time[itemprop="datePublished"]')?.getAttribute('datetime');
                       
  const dateModified = clone.querySelector('meta[property="article:modified_time"]')?.getAttribute('content') ||
                      clone.querySelector('meta[name="dateModified"]')?.getAttribute('content') ||
                      clone.querySelector('time[itemprop="dateModified"]')?.getAttribute('datetime');

  // Extract author
  const author = clone.querySelector('meta[name="author"]')?.getAttribute('content') ||
                clone.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
                clone.querySelector('[rel="author"]')?.textContent?.trim();

  // Get main content
  const mainContent = clone.querySelector('main') || clone.querySelector('article') || clone.querySelector('[role="main"]') || clone.body;
  const textContent = mainContent.textContent || '';
  const cleanedText = textContent.replace(/\s+/g, ' ').trim().substring(0, 50000);

  // Extract FAQs from JSON-LD and DOM
  const faqs = [];
  const jsonLdScripts = clone.querySelectorAll('script[type="application/ld+json"]');
  
  // Extract logo - be more specific to avoid article images
  let logo = '';
  
  // 1. Try JSON-LD Organization logo first (most accurate)
  jsonLdScripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      items.forEach(item => {
        if (item['@type'] === 'Organization' && item.logo) {
          if (typeof item.logo === 'string') {
            logo = item.logo;
          } else if (item.logo.url) {
            logo = item.logo.url;
          }
        }
      });
    } catch (e) {
      // Ignore
    }
  });

  // 2. Try specific logo classes/IDs if no JSON-LD logo
  if (!logo) {
    const logoImg = clone.querySelector('.logo img, #logo img, img[alt*="logo" i], img[class*="logo" i]');
    if (logoImg) logo = logoImg.src;
  }

  // 3. Try favicon/apple-touch-icon as fallback (better than random article image)
  if (!logo) {
    const appleIcon = clone.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');
    if (appleIcon) logo = appleIcon;
  }
  
  if (!logo) {
    const favicon = clone.querySelector('link[rel="icon"]')?.getAttribute('href') || 
                   clone.querySelector('link[rel="shortcut icon"]')?.getAttribute('href');
    if (favicon) logo = favicon;
  }

  // Make logo absolute URL if relative
  if (logo && !logo.startsWith('http')) {
    try {
      const baseUrl = new URL(window.location.href);
      logo = new URL(logo, baseUrl).href;
    } catch (e) {
      // Ignore URL parsing errors
    }
  }

  // Extract FAQs from JSON-LD (FAQPage schema)
  jsonLdScripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      items.forEach(item => {
        if (item['@type'] === 'FAQPage' && item.mainEntity) {
          const questions = Array.isArray(item.mainEntity) ? item.mainEntity : [item.mainEntity];
          questions.forEach(q => {
            const name = q.name && typeof q.name === 'string' ? q.name.trim() : '';
            const answerText = q.acceptedAnswer?.text && typeof q.acceptedAnswer.text === 'string'
              ? q.acceptedAnswer.text.trim()
              : '';

            if (name && answerText) {
              faqs.push({ question: name, answer: answerText });
            }
          });
        }
      });
    } catch (e) {
      // Ignore invalid JSON
    }
  });

  // Extract FAQs from DOM if none found in JSON-LD
  if (faqs.length === 0) {
    // 1) <details><summary> pattern
    clone.querySelectorAll('details').forEach(details => {
      const summary = details.querySelector('summary');
      if (summary) {
        const q = summary.textContent.trim();
        const a = details.textContent.replace(summary.textContent, '').trim();
        if (q && a) {
          faqs.push({ question: q, answer: a });
        }
      }
    });
  }

  // 2) Common FAQ containers with heading + following content
  if (faqs.length === 0) {
    const candidateContainers = Array.from(
      clone.querySelectorAll(
        '.faq, .faqs, .faq-section, .faq-accordion, [id*="faq" i], [class*="faq" i], .accordion, .accordion-item'
      )
    );

    if (candidateContainers.length > 0) {
      // Prefer containers with nearby headings mentioning FAQ / Frequently Asked Questions
      const scored = candidateContainers.map(container => {
        let score = 0;

        // Look at previous sibling heading
        const prev = container.previousElementSibling;
        const prevText = (prev && /H[1-6]/.test(prev.tagName)) ? (prev.textContent || '').toLowerCase() : '';
        if (prevText.includes('faq') || prevText.includes('frequently asked')) {
          score += 3;
        }

        // Also scan headings inside the container
        const innerHeading = container.querySelector('h2, h3, h4, h5, h6');
        const innerText = innerHeading?.textContent?.toLowerCase() || '';
        if (innerText.includes('faq') || innerText.includes('frequently asked')) {
          score += 2;
        }

        return { container, baseScore: score };
      });

      let bestFaqs = [];
      let bestScore = 0;

      scored.forEach(entry => {
        const { container, baseScore } = entry;

        const questionNodes = Array.from(
          container.querySelectorAll('h2, h3, h4, .question, .faq-question, [role="tab"]')
        );

        const localFaqs = [];

        questionNodes.forEach(qNode => {
          const qTextRaw = (qNode.textContent || '').trim();
          if (!qTextRaw) return;

          // Basic heuristic: treat as question if ends with ? or contains interrogative word
          const lower = qTextRaw.toLowerCase();
          const looksLikeQuestion =
            qTextRaw.endsWith('?') ||
            /\b(what|how|why|when|where|who|which|can|do|does|is|are|should)\b/.test(lower);

          if (!looksLikeQuestion) return;

          let answer = '';
          let next = qNode.nextElementSibling;

          while (next && !questionNodes.includes(next)) {
            const text = (next.textContent || '').trim();
            if (text) {
              answer += (answer ? ' ' : '') + text;
            }
            next = next.nextElementSibling;
          }

          const aText = answer.trim();
          // Require a reasonably sized answer to avoid noise
          if (aText && aText.length > 20) {
            localFaqs.push({ question: qTextRaw, answer: aText });
          }
        });

        if (localFaqs.length > 0) {
          const totalScore = baseScore + localFaqs.length; // favor containers with more Q&A
          if (totalScore > bestScore) {
            bestScore = totalScore;
            bestFaqs = localFaqs;
          }
        }
      });

      if (bestFaqs.length > 0) {
        bestFaqs.slice(0, 20).forEach(f => faqs.push(f));
      }
    }
  }

  return {
    title,
    meta_description: metaDesc,
    h1: h1s,
    content: cleanedText,
    faqs,
    logo: logo || '',
    author,
    datePublished,
    dateModified
  };
}


