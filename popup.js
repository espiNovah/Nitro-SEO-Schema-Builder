// DOM Elements
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKey');
const keywordsInput = document.getElementById('keywords');
const urlInput = document.getElementById('url');
const useCurrentPageBtn = document.getElementById('useCurrentPage');
const includePreviewCheckbox = document.getElementById('includePreview');
const generateBtn = document.getElementById('generateBtn');
const resultCard = document.getElementById('resultCard');
const errorCard = document.getElementById('errorCard');
const errorMessage = document.getElementById('errorMessage');
const resultContent = document.getElementById('resultContent');
const copyBtn = document.getElementById('copyBtn');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');

// State
let currentSchema = null;
let currentPageData = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved API key
  const saved = await chrome.storage.local.get(['apiKey']);
  if (saved.apiKey) {
    apiKeyInput.value = saved.apiKey;
  }

  // Get current page URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    urlInput.value = tab.url;
  }

  // Event Listeners
  toggleKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
    toggleKeyBtn.textContent = type === 'password' ? '👁️' : '🙈';
  });

  useCurrentPageBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      urlInput.value = tab.url;
    }
  });

  generateBtn.addEventListener('click', handleGenerate);
  copyBtn.addEventListener('click', handleCopy);
  downloadTxtBtn.addEventListener('click', handleDownloadTxt);
  downloadJsonBtn.addEventListener('click', handleDownloadJson);

  // Save API key on change
  apiKeyInput.addEventListener('blur', async () => {
    if (apiKeyInput.value) {
      await chrome.storage.local.set({ apiKey: apiKeyInput.value });
    }
  });
});

async function handleGenerate() {
  const apiKey = apiKeyInput.value.trim();
  const keywords = keywordsInput.value.trim();
  const url = urlInput.value.trim();
  const includePreview = includePreviewCheckbox.checked;

  // Validation
  if (!apiKey) {
    showError('Please enter your Google AI Studio API key');
    return;
  }

  if (!url) {
    showError('Please enter a URL');
    return;
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    showError('Please enter a valid URL');
    return;
  }

  // Save API key
  await chrome.storage.local.set({ apiKey });

  // Show loading state
  setLoading(true);
  hideError();
  hideResult();

  try {
    // Extract page content
    const pageData = await extractPageContent(url);
    currentPageData = pageData;

    // Generate schema
    const schema = await generateSchema(apiKey, url, pageData, keywords);
    currentSchema = schema;

    // Display result
    showResult(schema, includePreview ? pageData : null);
  } catch (error) {
    console.error('Error:', error);
    showError(error.message || 'Failed to generate schema. Please try again.');
  } finally {
    setLoading(false);
  }
}

async function extractPageContent(url) {
  // Check if URL is current page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isCurrentPage = tab && tab.url === url;

  if (isCurrentPage) {
    // Inject content script and extract
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractContentFromDOM
      });
      return results[0].result;
    } catch (error) {
      // Fallback: fetch the page
      return await fetchPageContent(url);
    }
  } else {
    // Fetch the page
    return await fetchPageContent(url);
  }
}

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
    clone.querySelectorAll(selector).forEach(el => el.remove());
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
    faqs
  };
}

async function fetchPageContent(url) {
  // Use background script to fetch (to avoid CORS)
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'fetchPage', url },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.data);
        }
      }
    );
  });
}

async function generateSchema(apiKey, url, pageData, seedKeywords) {
  const MODEL = 'gemini-2.5-flash';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  // Parse domain
  const urlObj = new URL(url);
  const domain = urlObj.hostname;

  // Parse seed keywords
  const keywords = seedKeywords
    ? seedKeywords.split(/[,;]/).map(k => k.trim()).filter(Boolean)
    : [];

  // Build prompt
  const prompt = buildPrompt(url, pageData, keywords, domain);

  // Call Gemini API
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      systemInstruction: {
        parts: [{
          text: "You are an SEO and structured data assistant. Given a page's extracted content and seed keywords, write a concise WebPage JSON-LD that includes: description, keywords, and knowsAbout. Return JSON with fields: description, keywords (array), knowsAbout (array of objects with 'name' and 'description'), publisher (object with 'name', 'url', and 'knowsAbout' array of strings), and schema_jsonld (string). The schema_jsonld must be valid JSON-LD for schema.org WebPage. The description must reflect the page. Mix the seed keywords with new relevant ones. Avoid near-duplicates and keep them page-specific."
        }]
      }
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON from response
  let jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (!jsonMatch) {
    jsonMatch = text.match(/(\{[\s\S]*\})/);
  }

  if (!jsonMatch) {
    throw new Error('Model did not return valid JSON');
  }

  const result = JSON.parse(jsonMatch[1]);

  // Build final schema
  const schemaText = result.schema_jsonld || '';
  let schemaObj;

  try {
    schemaObj = JSON.parse(schemaText);
  } catch {
    // Build schema from scratch
    schemaObj = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: url,
      mainEntityOfPage: url
    };
  }

  // Update schema with final values
  schemaObj.url = url;
  schemaObj.mainEntityOfPage = url;
  if (pageData.title) schemaObj.name = pageData.title;
  schemaObj.description = result.description || '';
  schemaObj.keywords = result.keywords?.join(', ') || '';

  if (result.publisher) {
    schemaObj.publisher = {
      '@type': 'Organization',
      name: result.publisher.name || '',
      url: result.publisher.url || `https://${domain}`,
      knowsAbout: result.publisher.knowsAbout || []
    };
  }

  if (result.knowsAbout && result.knowsAbout.length > 0) {
    schemaObj.about = result.knowsAbout.map(entity => ({
      '@type': 'Thing',
      name: entity.name || '',
      description: entity.description || ''
    })).filter(e => e.name);
  }

  // Remove null/undefined values
  Object.keys(schemaObj).forEach(key => {
    if (schemaObj[key] === null || schemaObj[key] === undefined || schemaObj[key] === '') {
      delete schemaObj[key];
    }
  });

  return {
    schema: schemaObj,
    description: result.description || '',
    keywords: result.keywords || [],
    knowsAbout: result.knowsAbout || [],
    publisher: result.publisher
  };
}

function buildPrompt(url, page, seedKeywords, domainHint) {
  return `URL: ${url}
Domain: ${domainHint}

Title: ${page.title || ''}
Meta Description: ${page.meta_description || ''}
H1: ${JSON.stringify(page.h1 || [])}

Extracted content (truncated):
${page.content || ''}

Seed keywords:
${JSON.stringify(seedKeywords)}

Task:
1) Write a one paragraph description of the page that fits the content.
2) Propose a clean list of 5 to 20 page-specific keywords. Include some of the seed keywords if relevant.
3) Propose a focused 'knowsAbout' list of 3 to 12 entities or topics. Each entity should have:
   - "name": the name of the entity
   - "description": a short 1-sentence description of the entity
4) Identify the publisher/organization from the domain and content. Create a publisher object with:
   - "name": the organization/brand name
   - "url": the organization's homepage URL
   - "knowsAbout": 3-8 topics/areas the organization specializes in (simple strings, no descriptions)
5) Produce a JSON-LD for schema.org 'WebPage' with:
   - '@context'
   - '@type': 'WebPage'
   - 'url'
   - 'name' if clear
   - 'description' from step 1
   - 'keywords' as a comma separated string from step 2
   - 'mainEntityOfPage' set to the URL
   - 'publisher' object in this exact format:
     {
       "@type": "Organization",
       "name": "Organization Name",
       "url": "https://organization-url.com",
       "knowsAbout": ["topic1", "topic2", "topic3"]
     }
   - 'about' array with objects in this exact format:
     {
       "@type": "Thing",
       "name": "name of entity",
       "description": "short description of entity"
     }

Return JSON with keys: description, keywords (array of strings), knowsAbout (array of objects with 'name' and 'description'), publisher (object with 'name', 'url', and 'knowsAbout' array of strings), schema_jsonld (string).
Only return JSON. No commentary.`;
}

function showResult(schema, pageData) {
  const schemaText = JSON.stringify(schema.schema, null, 2);
  const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;

  let displayText = wrappedSchema;
  if (pageData) {
    displayText = `URL: ${urlInput.value}\n\n${wrappedSchema}\n\n---\n\nPage Preview:\nTitle: ${pageData.title}\nMeta: ${pageData.meta_description}\nH1: ${pageData.h1.join(', ')}\n\nContent: ${pageData.content.substring(0, 500)}...`;
  }

  resultContent.textContent = displayText;
  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideResult() {
  resultCard.style.display = 'none';
}

function showError(message) {
  errorMessage.textContent = message;
  errorCard.style.display = 'block';
  errorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  errorCard.style.display = 'none';
}

function setLoading(loading) {
  generateBtn.disabled = loading;
  const btnText = generateBtn.querySelector('.btn-text');
  const btnLoader = generateBtn.querySelector('.btn-loader');
  
  if (loading) {
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    generateBtn.classList.add('loading');
  } else {
    btnText.style.display = 'inline-block';
    btnLoader.style.display = 'none';
    generateBtn.classList.remove('loading');
  }
}

function handleCopy() {
  if (!currentSchema) return;

  const schemaText = JSON.stringify(currentSchema.schema, null, 2);
  const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;

  navigator.clipboard.writeText(wrappedSchema).then(() => {
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy';
    }, 2000);
  });
}

function handleDownloadTxt() {
  if (!currentSchema) return;

  const schemaText = JSON.stringify(currentSchema.schema, null, 2);
  const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;
  const content = `${urlInput.value}\n${wrappedSchema}`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'schema.txt';
  a.click();
  URL.revokeObjectURL(url);
}

function handleDownloadJson() {
  if (!currentSchema) return;

  const content = JSON.stringify(currentSchema.schema, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'schema.json';
  a.click();
  URL.revokeObjectURL(url);
}

