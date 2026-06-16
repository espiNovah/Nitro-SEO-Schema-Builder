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
  },
  async extractImages(url) {
    try {
      const data = await extractPageImages(url);
      return { data };
    } catch (error) {
      console.error('Error in extractImages handler:', error);
      return { error: error.message };
    }
  },
  async fetchImageAsBase64(url) {
    try {
      const data = await fetchImageAsBase64Helper(url);
      return { data };
    } catch (error) {
      console.error('Error in fetchImageAsBase64 handler:', error);
      return { error: error.message };
    }
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action && messageHandlers[request.action]) {
    const handler = messageHandlers[request.action];
    handler(request.url || request.data)
      .then(res => sendResponse(res))
      .catch(error => {
        sendResponse({ error: error.message || 'An unknown error occurred' });
      });
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
    // Primary extraction: structured DOM parsing
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractContentFromDOM
    });

    if (result?.result && result.result.content) {
      return result.result;
    }

    // Fallback: grab everything visible on the page as raw text
    console.warn('Primary extraction returned no content, falling back to full page text...');
    const [fallbackResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const title = document.title || '';
        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()).filter(Boolean);

        // Grab all visible text from the page
        const rawText = (document.body?.innerText || document.documentElement?.innerText || document.documentElement?.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 50000);

        return {
          title,
          meta_description: metaDesc,
          h1: h1s,
          content: rawText,
          faqs: [],
          logo: '',
          author: '',
          datePublished: null,
          dateModified: null
        };
      }
    });

    if (fallbackResult?.result?.content) {
      return fallbackResult.result;
    }

    // Last resort: return whatever structured data we have even if content is empty
    if (result?.result) {
      return result.result;
    }

    throw new Error('No content was extracted from the page');
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

/**
 * Fetch an image and convert it to a base64 data URI
 * @param {string} url - The URL of the image
 * @returns {Promise<string>} The base64 data URI
 */
async function fetchImageAsBase64Helper(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const mimeType = response.headers.get('Content-Type') || 'image/jpeg';
    
    // Convert buffer to base64 using chunking to avoid call stack limits and slow loops
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192;
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    const base64 = btoa(binary);
    
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error fetching image ${url}:`, error);
    throw error;
  }
}

/**
 * Extract images from a page by creating a hidden tab
 * @param {string} url - The URL to extract images from
 * @returns {Promise<Array>} Array of image objects {url, alt}
 */
async function extractPageImages(url) {
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

    // Extract images with timeout
    const images = await Promise.race([
      (async () => {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const imgs = Array.from(document.querySelectorAll('img'));
            return imgs.map(img => ({
              url: img.src,
              alt: img.alt || ''
            })).filter(img => img.url && !img.url.startsWith('data:'));
          }
        });
        return result?.result || [];
      })(),
      delay(CONFIG.extractionTimeout).then(() => {
        throw new Error('Image extraction timed out');
      })
    ]);

    return images;

  } catch (error) {
    console.error('Error in extractPageImages:', error);
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
  try {
  // Remove navigation and footer elements
  const selectorsToRemove = [
    'nav', 'header', 'footer', 'script', 'style', 'noscript',
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

  // Extract FAQs from JSON-LD BEFORE removing script tags
  const faqs = [];
  const jsonLdScripts = clone.querySelectorAll('script[type="application/ld+json"]');

  jsonLdScripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      items.forEach(item => {
        // Handle @graph structure
        const graphItems = item['@graph'] ? item['@graph'] : [item];
        graphItems.forEach(entry => {
          if (entry['@type'] === 'FAQPage' && entry.mainEntity) {
            const questions = Array.isArray(entry.mainEntity) ? entry.mainEntity : [entry.mainEntity];
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
      });
    } catch (e) {
      // Ignore invalid JSON
    }
  });

  // Now remove navigation and footer elements for cleaner text content
  selectorsToRemove.forEach(selector => {
    try {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    } catch (e) {
      // Ignore selector errors
    }
  });

  // Helper function to get clean text from an element (skip script/style tags)
  function getCleanText(element) {
    if (!element) return '';

    // Clone the element to avoid modifying the original
    const tempClone = element.cloneNode(true);

    // Remove script and style tags
    tempClone.querySelectorAll('script, style, noscript').forEach(el => el.remove());

    // Get text and clean it up
    const text = (tempClone.textContent || '').trim();

    // Remove excessive whitespace
    return text.replace(/\s+/g, ' ').trim();
  }

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

  // Get main content — fall back progressively to ensure we always get something
  const mainContent = clone.querySelector('main') ||
    clone.querySelector('article') ||
    clone.querySelector('[role="main"]') ||
    clone.querySelector('#content') ||
    clone.querySelector('.content') ||
    clone.body ||
    clone.documentElement;

  // Prefer innerText (respects display:none) but fall back to textContent
  const rawText = mainContent
    ? (mainContent.innerText || mainContent.textContent || '')
    : (document.body?.innerText || document.documentElement?.innerText || document.documentElement?.textContent || '');
  const cleanedText = rawText.replace(/\s+/g, ' ').trim().substring(0, 50000);

  // Extract logo - be more specific to avoid article images
  let logo = '';

  // Use the jsonLdScripts we already found before removal
  jsonLdScripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      items.forEach(item => {
        // Also check inside @graph
        const checkItems = item['@graph'] ? item['@graph'] : [item];
        checkItems.forEach(entry => {
          if (entry['@type'] === 'Organization' && entry.logo) {
            if (typeof entry.logo === 'string') {
              logo = entry.logo;
            } else if (entry.logo.url) {
              logo = entry.logo.url;
            }
          }
        });
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
        // Improved answer extraction: look for a panel/content div first
        const panel = details.querySelector('.cc-accordion-item__panel, .accordion-item__content, .faq-answer, .answer');
        let a = '';
        if (panel) {
          a = panel.textContent.trim();
        } else {
          a = details.textContent.replace(summary.textContent, '').trim();
        }

        if (q && a && a.length > 10) {
          faqs.push({ question: q, answer: a });
        }
      }
    });
  }

  // 2) Q: and A: text pattern (common in product pages)
  if (faqs.length === 0) {
    // Get main content text
    const mainContent = clone.querySelector('main') || clone.querySelector('article') || clone.querySelector('[role="main"]') || clone.body;
    const textContent = mainContent.textContent || '';

    // Match Q: ... A: ... patterns (more robust regex)
    // This pattern handles multi-line questions and answers
    const qaPattern = /Q:\s*(.+?)\s*A:\s*(.+?)(?=\s*Q:|$)/gis;
    let match;

    while ((match = qaPattern.exec(textContent)) !== null) {
      const question = match[1].trim();
      let answer = match[2].trim();

      // Clean up the answer - remove excessive whitespace
      answer = answer.replace(/\s+/g, ' ').trim();

      // Limit answer length to prevent capturing unrelated content
      // Most FAQ answers are under 1000 characters
      if (answer.length > 1000) {
        // Try to find a natural break point (period followed by capital letter or common section markers)
        const sentences = answer.match(/[^.!?]+[.!?]+/g);
        if (sentences && sentences.length > 0) {
          // Take first few sentences that total less than 1000 chars
          let truncated = '';
          for (const sentence of sentences) {
            if ((truncated + sentence).length < 1000) {
              truncated += sentence;
            } else {
              break;
            }
          }
          if (truncated) {
            answer = truncated.trim();
          }
        }
      }

      if (question && answer && answer.length > 20 && answer.length < 2000) {
        faqs.push({ question, answer });
      }
    }
  }

  // 3) Common FAQ containers with heading + following content
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

  // 4) Fallback: Look for sections with "FAQ" or "Frequently Asked Questions" headings
  if (faqs.length === 0) {
    const allHeadings = Array.from(clone.querySelectorAll('h1, h2, h3, h4, h5, h6'));

    // Find headings that mention FAQ or Frequently Asked Questions
    const faqHeadings = allHeadings.filter(h => {
      const text = (h.textContent || '').toLowerCase().trim();
      return text === 'faqs' ||
        text === 'faq' ||
        text === 'frequently asked questions' ||
        text.includes('frequently asked') ||
        (text.includes('faq') && text.length < 30); // Avoid false positives
    });

    if (faqHeadings.length > 0) {
      // For each FAQ section heading, extract questions that follow
      faqHeadings.forEach(faqHeading => {
        let current = faqHeading.nextElementSibling;
        const faqHeadingLevel = parseInt(faqHeading.tagName.substring(1)); // e.g., 2 for H2

        // Collect all content until we hit a heading of equal or higher level
        while (current) {
          // Stop if we hit a heading of same or higher level (e.g., another H2 if we started with H2)
          if (/H[1-6]/.test(current.tagName)) {
            const currentLevel = parseInt(current.tagName.substring(1));
            if (currentLevel <= faqHeadingLevel) break;

            // This is a sub-heading (e.g., H3 under H2) - check if it's a question
            const qText = (current.textContent || '').trim();
            const lower = qText.toLowerCase();
            const looksLikeQuestion =
              qText.endsWith('?') ||
              /\b(what|how|why|when|where|who|which|can|do|does|is|are|should|i'm)\b/.test(lower);

            if (looksLikeQuestion) {
              // Get answer from following siblings
              let answer = '';
              let next = current.nextElementSibling;
              let siblingCount = 0;

              while (next && siblingCount < 5) {
                // Stop at next heading
                if (/H[1-6]/.test(next.tagName)) break;

                // Skip script and style elements
                if (next.tagName === 'SCRIPT' || next.tagName === 'STYLE' || next.tagName === 'NOSCRIPT') {
                  next = next.nextElementSibling;
                  siblingCount++;
                  continue;
                }

                const text = getCleanText(next);
                if (text) {
                  answer += (answer ? ' ' : '') + text;
                }
                next = next.nextElementSibling;
                siblingCount++;
              }

              const aText = answer.trim();
              if (aText && aText.length > 20) {
                faqs.push({ question: qText, answer: aText });
              }
            }
          }

          current = current.nextElementSibling;
        }
      });
    }
  }

  // 5) Fallback: scan all H3 headings on the page for questions
  if (faqs.length === 0) {
    const allH3s = Array.from(clone.querySelectorAll('h3'));

    allH3s.forEach(h3 => {
      const qText = (h3.textContent || '').trim();
      if (!qText) return;

      // Check if it looks like a question
      const lower = qText.toLowerCase();
      const looksLikeQuestion =
        qText.endsWith('?') ||
        /\b(what|how|why|when|where|who|which|can|do|does|is|are|should|i'm)\b/.test(lower);

      if (!looksLikeQuestion) return;

      // Get the answer from following siblings
      let answer = '';
      let next = h3.nextElementSibling;
      let siblingCount = 0;

      while (next && siblingCount < 5) {
        // Stop at next heading
        if (/H[1-6]/.test(next.tagName)) break;

        // Skip script and style elements
        if (next.tagName === 'SCRIPT' || next.tagName === 'STYLE' || next.tagName === 'NOSCRIPT') {
          next = next.nextElementSibling;
          siblingCount++;
          continue;
        }

        const text = getCleanText(next);
        if (text) {
          answer += (answer ? ' ' : '') + text;
        }
        next = next.nextElementSibling;
        siblingCount++;
      }

      const aText = answer.trim();
      if (aText && aText.length > 20) {
        faqs.push({ question: qText, answer: aText });
      }
    });
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

  } catch (domError) {
    // Absolute last resort — return raw page text so the caller always gets something
    console.warn('extractContentFromDOM threw, using raw innerText fallback:', domError);
    try {
      const rawFallback = (document.body?.innerText ||
        document.documentElement?.innerText ||
        document.documentElement?.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50000);
      return {
        title: document.title || '',
        meta_description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()).filter(Boolean),
        content: rawFallback,
        faqs: [],
        logo: '',
        author: '',
        datePublished: null,
        dateModified: null
      };
    } catch (e) {
      return null; // Signal to caller that nothing could be extracted
    }
  }
}


