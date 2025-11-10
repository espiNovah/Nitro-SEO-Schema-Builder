// Background service worker for Nitro SEO Schema Builder

// Handle extension icon click to open new tab
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html'),
    active: true
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchPage') {
    fetchPage(request.url)
      .then(data => sendResponse({ data }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function fetchPage(url) {
  // Use tab-based approach to bypass CORS
  // Create a hidden tab, extract content, then close it
  return new Promise((resolve, reject) => {
    chrome.tabs.create({
      url: url,
      active: false
    }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      // Wait for page to load, then extract content
      const tabId = tab.id;
      
      const extractContent = () => {
        // Set a timeout for the extraction itself
        const extractionTimeout = setTimeout(() => {
          chrome.tabs.remove(tabId, () => {
            if (chrome.runtime.lastError) {
              // Tab might already be closed
            }
          });
          reject(new Error('Timeout: Content extraction took too long'));
        }, 10000); // 10 second timeout for extraction
        
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: extractContentFromDOM
        }, (results) => {
          clearTimeout(extractionTimeout);
          
          // Close the tab
          chrome.tabs.remove(tabId, () => {
            if (chrome.runtime.lastError) {
              // Tab might already be closed, continue anyway
            }
          });

          if (chrome.runtime.lastError) {
            reject(new Error(`Failed to extract content: ${chrome.runtime.lastError.message}`));
          } else if (results && results[0] && results[0].result) {
            resolve(results[0].result);
          } else {
            reject(new Error('Failed to extract page content'));
          }
        });
      };

      // Wait for page to load
      let checkAttempts = 0;
      const maxAttempts = 120; // 60 seconds max (120 * 500ms)
      let timeoutId = null;
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };
      
      const checkComplete = () => {
        checkAttempts++;
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            cleanup();
            chrome.tabs.remove(tabId);
            reject(new Error('Tab was closed before content could be extracted'));
            return;
          }

          // Check if URL is blocked (chrome://, extension://, etc.)
          if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://'))) {
            cleanup();
            chrome.tabs.remove(tabId);
            reject(new Error('Cannot access this URL type (chrome:// or extension pages are not allowed)'));
            return;
          }

          if (tab.status === 'complete') {
            cleanup();
            // Give it a moment for dynamic content to load
            // Some pages load content via JavaScript after page load
            setTimeout(() => {
              extractContent();
            }, 2000); // Increased wait time for dynamic content
          } else if (checkAttempts < maxAttempts) {
            // Check again in 500ms
            timeoutId = setTimeout(checkComplete, 500);
          } else {
            // Timeout - try to extract anyway in case page is partially loaded
            cleanup();
            console.warn(`Page ${url} took too long to load, attempting extraction anyway...`);
            setTimeout(() => {
              extractContent();
            }, 1000);
          }
        });
      };

      // Start checking after a short delay
      timeoutId = setTimeout(checkComplete, 1000);
    });
  });
}

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

  // Get main content
  const mainContent = clone.querySelector('main') || clone.querySelector('article') || clone.querySelector('[role="main"]') || clone.body;
  const textContent = mainContent.textContent || '';
  const cleanedText = textContent.replace(/\s+/g, ' ').trim().substring(0, 50000);

  // Extract FAQs from JSON-LD
  const faqs = [];
  const jsonLdScripts = clone.querySelectorAll('script[type="application/ld+json"]');
  
  // Extract logo from various meta tags
  let logo = '';
  // Try Open Graph image
  const ogImage = clone.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (ogImage) logo = ogImage;
  // Try Twitter image
  if (!logo) {
    const twitterImage = clone.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || 
                        clone.querySelector('meta[property="twitter:image"]')?.getAttribute('content');
    if (twitterImage) logo = twitterImage;
  }
  // Try Apple touch icon
  if (!logo) {
    const appleIcon = clone.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');
    if (appleIcon) logo = appleIcon;
  }
  // Try favicon
  if (!logo) {
    const favicon = clone.querySelector('link[rel="icon"]')?.getAttribute('href') || 
                   clone.querySelector('link[rel="shortcut icon"]')?.getAttribute('href');
    if (favicon) logo = favicon;
  }
  // Try logo in JSON-LD
  if (!logo) {
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
  jsonLdScripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      items.forEach(item => {
        if (item['@type'] === 'FAQPage' && item.mainEntity) {
          const questions = Array.isArray(item.mainEntity) ? item.mainEntity : [item.mainEntity];
          questions.forEach(q => {
            if (q.name && q.acceptedAnswer?.text) {
              faqs.push([q.name, q.acceptedAnswer.text]);
            }
          });
        }
      });
    } catch (e) {
      // Ignore invalid JSON
    }
  });

  // Extract FAQs from DOM
  if (faqs.length === 0) {
    clone.querySelectorAll('details').forEach(details => {
      const summary = details.querySelector('summary');
      if (summary) {
        const q = summary.textContent.trim();
        const a = details.textContent.replace(q, '').trim();
        if (q && a) faqs.push([q, a]);
      }
    });
  }

  return {
    title,
    meta_description: metaDesc,
    h1: h1s,
    content: cleanedText,
    faqs,
    logo: logo || ''
  };
}


