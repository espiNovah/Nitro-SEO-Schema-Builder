// Cache DOM elements
const elements = {
  apiKeyInput: document.getElementById('apiKey'),
  toggleKeyBtn: document.getElementById('toggleKey'),
  keywordsInput: document.getElementById('keywords'),
  urlInput: document.getElementById('url'),
  useCurrentPageBtn: document.getElementById('useCurrentPage'),
  includePreviewCheckbox: document.getElementById('includePreview'),
  generateBtn: document.getElementById('generateBtn'),
  resultCard: document.getElementById('resultCard'),
  errorCard: document.getElementById('errorCard'),
  errorMessage: document.getElementById('errorMessage'),
  resultContent: document.getElementById('resultContent'),
  copyBtn: document.getElementById('copyBtn'),
  downloadTxtBtn: document.getElementById('downloadTxtBtn'),
  downloadJsonBtn: document.getElementById('downloadJsonBtn'),
  btnText: document.querySelector('.btn-text'),
  btnLoader: document.querySelector('.btn-loader')
};

// State management
const state = {
  currentSchema: null,
  currentPageData: null
};

// Initialize extension
const init = async () => {
  try {
    // Load saved API key
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (apiKey) elements.apiKeyInput.value = apiKey;

    // Set current page URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) elements.urlInput.value = tab.url;

    setupEventListeners();
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize extension');
  }
};

// Set up event listeners
const setupEventListeners = () => {
  // Toggle API key visibility
  elements.toggleKeyBtn.addEventListener('click', () => {
    const { apiKeyInput, toggleKeyBtn } = elements;
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleKeyBtn.textContent = isPassword ? '🙈' : '👁️';
  });

  // Use current page URL
  elements.useCurrentPageBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) elements.urlInput.value = tab.url;
    } catch (error) {
      console.error('Error getting current page URL:', error);
    }
  });

  // Save API key on blur
  elements.apiKeyInput.addEventListener('blur', async () => {
    if (elements.apiKeyInput.value) {
      await chrome.storage.local.set({ apiKey: elements.apiKeyInput.value });
    }
  });

  // Main action buttons
  elements.generateBtn.addEventListener('click', handleGenerate);
  elements.copyBtn.addEventListener('click', handleCopy);
  elements.downloadTxtBtn.addEventListener('click', handleDownloadTxt);
  elements.downloadJsonBtn.addEventListener('click', handleDownloadJson);
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

const handleGenerate = async () => {
  const { apiKeyInput, keywordsInput, urlInput, includePreviewCheckbox } = elements;
  const apiKey = apiKeyInput.value.trim();
  const keywords = keywordsInput.value.trim();
  const url = urlInput.value.trim();
  const includePreview = includePreviewCheckbox.checked;

  // Input validation
  if (!apiKey) return showError('Please enter your Google AI Studio API key');
  if (!url) return showError('Please enter a URL');

  try {
    new URL(url); // Validate URL format
  } catch {
    return showError('Please enter a valid URL');
  }

  // Save API key and prepare UI
  await chrome.storage.local.set({ apiKey });
  setLoading(true);
  hideError();
  hideResult();

  try {
    const pageData = await extractPageContent(url);
    state.currentPageData = pageData;
    state.currentSchema = await generateSchema(apiKey, url, pageData, keywords);
    showResult(state.currentSchema, includePreview ? pageData : null);
  } catch (error) {
    console.error('Schema generation failed:', error);
    showError(error.message || 'Failed to generate schema. Please try again.');
  } finally {
    setLoading(false);
  }
};

const extractPageContent = async (url) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isCurrentPage = tab?.url === url;

    if (isCurrentPage) {
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractContentFromDOM
        });
        return result.result;
      } catch (error) {
        console.warn('Content script injection failed, falling back to background fetch');
        return fetchPageContent(url);
      }
    }
    return fetchPageContent(url);
  } catch (error) {
    console.error('Error extracting page content:', error);
    throw new Error('Failed to extract content from the page');
  }
};

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

const generateSchema = async (apiKey, url, pageData, seedKeywords) => {
  console.log('generateSchema called with:', { url, seedKeywords }); // Debug log
  const MODEL = 'gemini-2.5-flash';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  try {
    console.log('Starting API call...'); // Debug log
    const domain = new URL(url).hostname;
    const keywords = seedKeywords ? seedKeywords.split(/[,;]/).map(k => k.trim()).filter(Boolean) : [];
    console.log('Processed keywords:', keywords); // Debug log
    const prompt = buildPrompt(url, pageData, keywords, domain);
    console.log('Page data being sent to AI:', {
      title: pageData.title,
      meta_description: pageData.meta_description,
      h1: pageData.h1,
      content_length: pageData.content?.length || 0
    }); // Debug log
    console.log('Generated prompt length:', prompt.length); // Debug log

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        systemInstruction: {
          parts: [{
            text: "You are an SEO and structured data assistant. Generate valid JSON-LD schemas for schema.org WebPage type. Create a complete, valid WebPage schema based on the provided page content. The schema_jsonld must be valid JSON-LD that follows schema.org WebPage specifications. Include all required properties: @context, @type, url, description, keywords, mainEntityOfPage, publisher (with logo), and about array. For keywords: Include a mix of the provided seed keywords (if any) with new relevant ones. Avoid near-duplicates and keep them page-specific."
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
    console.log('Raw AI Response:', text); // Debug log
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || text.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) throw new Error('Model did not return valid JSON');
    const result = JSON.parse(jsonMatch[1]);
    console.log('Parsed Result:', result); // Debug log
    console.log('Parsed Result keywords:', result.keywords); // Debug log

    // Process schema
    const schemaText = result.schema_jsonld || '';
    let schemaObj;

    try {
      schemaObj = JSON.parse(schemaText);
    } catch {
      schemaObj = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        url,
        mainEntityOfPage: url,
        ...(pageData.title && { name: pageData.title })
      };
    }

    // Update schema with final values
    console.log('Result keywords:', result.keywords); // Debug log
    console.log('Schema keywords:', schemaObj.keywords); // Debug log

    // Always override keywords with the result keywords
    const processedKeywords = Array.isArray(result.keywords)
      ? result.keywords.map(k => String(k).trim()).filter(k => k).join(', ')
      : (result.keywords || '');

    const finalSchema = {
      ...schemaObj,
      url,
      mainEntityOfPage: url,
      ...(pageData.title && { name: pageData.title }),
      description: result.description || '',
      keywords: processedKeywords // Always use processed keywords
    };
    console.log('Final keywords:', finalSchema.keywords); // Debug log

    // Add publisher if available
    if (result.publisher) {
      finalSchema.publisher = {
        '@type': 'Organization',
        name: result.publisher.name || '',
        url: result.publisher.url || `https://${domain}`,
        knowsAbout: result.publisher.knowsAbout || []
      };
    }

    // Add knowsAbout if available
    if (result.knowsAbout?.length > 0) {
      finalSchema.about = result.knowsAbout
        .map(entity => ({
          '@type': 'Thing',
          name: entity.name || '',
          description: entity.description || ''
        }))
        .filter(e => e.name);
    }

    // Clean up null/undefined/empty values (but keep keywords even if empty)
    Object.keys(finalSchema).forEach(key => {
      if (key !== 'keywords' && (finalSchema[key] === null || finalSchema[key] === undefined || finalSchema[key] === '')) {
        delete finalSchema[key];
      }
    });

    return {
      schema: finalSchema,
      description: result.description || '',
      keywords: result.keywords || [],
      knowsAbout: result.knowsAbout || [],
      publisher: result.publisher
    };
  } catch (error) {
    console.error('Schema generation error:', error);
    throw new Error(`Failed to generate schema: ${error.message}`);
  }
};

const buildPrompt = (url, page, seedKeywords, domainHint) => {
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
};

// UI Helpers
const showResult = (schema, pageData) => {
  try {
    const { resultContent, resultCard, urlInput } = elements;

    // Get keywords from the schema itself
    const schemaKeywords = schema.schema.keywords || schema.keywords || '';

    const schemaText = JSON.stringify(schema.schema, null, 2);
    const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;

    let displayText = wrappedSchema;
    if (pageData) {
      const preview = `URL: ${urlInput.value}\n\n${wrappedSchema}\n\n---\n\nPage Preview:\nTitle: ${pageData.title || 'N/A'}\nMeta: ${pageData.meta_description || 'N/A'}\nH1: ${pageData.h1?.join(', ') || 'N/A'}\nKeywords: ${schemaKeywords}\n\nContent: ${pageData.content?.substring(0, 500) || 'No content extracted'}...`;
      displayText = preview;
    }

    resultContent.textContent = displayText;
    resultCard.style.display = 'block';
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    console.error('Error displaying result:', error);
    showError('Failed to display results');
  }
};

const hideResult = () => {
  elements.resultCard.style.display = 'none';
};

const showError = (message) => {
  elements.errorMessage.textContent = message;
  elements.errorCard.style.display = 'block';
  elements.errorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.errorCard.style.display = 'none';
  }, 5000);
};

const hideError = () => {
  elements.errorCard.style.display = 'none';
};

const setLoading = (loading) => {
  const { generateBtn, btnText, btnLoader } = elements;
  generateBtn.disabled = loading;
  btnText.style.display = loading ? 'none' : 'inline-block';
  btnLoader.style.display = loading ? 'inline-block' : 'none';
  generateBtn.classList.toggle('loading', loading);
};

// File handling utilities
const handleCopy = async () => {
  if (!state.currentSchema?.schema) return;

  try {
    const schemaText = JSON.stringify(state.currentSchema.schema, null, 2);
    const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;

    await navigator.clipboard.writeText(wrappedSchema);

    const originalText = elements.copyBtn.textContent;
    elements.copyBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      elements.copyBtn.textContent = originalText;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    showError('Failed to copy to clipboard');
  }
};

const downloadFile = (content, filename, type) => {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Download failed:', error);
    showError('Failed to download file');
  }
};

const handleDownloadTxt = () => {
  if (!state.currentSchema?.schema) return;

  const schemaText = JSON.stringify(state.currentSchema.schema, null, 2);
  const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;
  const content = `${elements.urlInput.value}\n${wrappedSchema}`;

  downloadFile(content, 'schema.txt', 'text/plain');
};

const handleDownloadJson = () => {
  if (!state.currentSchema?.schema) return;

  const content = JSON.stringify(state.currentSchema.schema, null, 2);
  downloadFile(content, 'schema.json', 'application/json');
};

