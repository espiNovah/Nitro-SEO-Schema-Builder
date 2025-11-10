// ============================================================================
// NITRO SEO SCHEMA BUILDER - Main Application
// ============================================================================

// Constants
const MAX_URLS = 20;
const MODEL = 'gemini-2.0-flash';

// State
let currentSchema = null;
let currentPageData = null;
let csvData = [];
let processingQueue = [];
let isProcessing = false;
let isPaused = false;
let isCancelled = false;
let currentIndex = 0;
let results = [];

// Schema Field Definitions
const SCHEMA_FIELDS = {
  WebPage: [
    { id: 'keywords', label: 'Keywords', type: 'text', placeholder: 'Comma-separated keywords', help: 'SEO keywords for the page' },
    { id: 'description', label: 'Description', type: 'textarea', placeholder: 'Page description', help: 'Meta description for SEO' }
  ],
  Article: [
    { id: 'headline', label: 'Headline', type: 'text', required: true },
    { id: 'author', label: 'Author Name', type: 'text', required: true },
    { id: 'datePublished', label: 'Date Published', type: 'date', required: true },
    { id: 'dateModified', label: 'Date Modified', type: 'date' },
    { id: 'image', label: 'Featured Image URL', type: 'url' },
    { id: 'description', label: 'Description', type: 'textarea' }
  ],
  Product: [
    { id: 'name', label: 'Product Name', type: 'text', required: true },
    { id: 'description', label: 'Description', type: 'textarea', required: true },
    { id: 'price', label: 'Price', type: 'number', required: true },
    { id: 'currency', label: 'Currency', type: 'text', placeholder: 'USD', required: true },
    { id: 'availability', label: 'Availability', type: 'select', options: ['InStock', 'OutOfStock', 'PreOrder'], required: true },
    { id: 'image', label: 'Product Image URL', type: 'url' },
    { id: 'brand', label: 'Brand', type: 'text' },
    { id: 'sku', label: 'SKU', type: 'text' }
  ],
  Event: [
    { id: 'name', label: 'Event Name', type: 'text', required: true },
    { id: 'startDate', label: 'Start Date', type: 'datetime-local', required: true },
    { id: 'endDate', label: 'End Date', type: 'datetime-local' },
    { id: 'location', label: 'Location Name', type: 'text', required: true },
    { id: 'address', label: 'Address', type: 'text' },
    { id: 'description', label: 'Description', type: 'textarea' },
    { id: 'image', label: 'Event Image URL', type: 'url' },
    { id: 'price', label: 'Price', type: 'number' },
    { id: 'currency', label: 'Currency', type: 'text', placeholder: 'USD' }
  ],
  HowTo: [
    { id: 'name', label: 'How-To Title', type: 'text', required: true },
    { id: 'description', label: 'Description', type: 'textarea', required: true },
    { id: 'totalTime', label: 'Total Time', type: 'text', placeholder: 'PT30M', help: 'ISO 8601 duration format' },
    { id: 'image', label: 'Image URL', type: 'url' }
  ],
  Recipe: [
    { id: 'name', label: 'Recipe Name', type: 'text', required: true },
    { id: 'description', label: 'Description', type: 'textarea', required: true },
    { id: 'prepTime', label: 'Prep Time', type: 'text', placeholder: 'PT15M' },
    { id: 'cookTime', label: 'Cook Time', type: 'text', placeholder: 'PT30M' },
    { id: 'totalTime', label: 'Total Time', type: 'text', placeholder: 'PT45M' },
    { id: 'recipeYield', label: 'Servings', type: 'text', placeholder: '4' },
    { id: 'image', label: 'Recipe Image URL', type: 'url' },
    { id: 'author', label: 'Author', type: 'text' }
  ],
  Video: [
    { id: 'name', label: 'Video Title', type: 'text', required: true },
    { id: 'description', label: 'Description', type: 'textarea', required: true },
    { id: 'thumbnailUrl', label: 'Thumbnail URL', type: 'url', required: true },
    { id: 'uploadDate', label: 'Upload Date', type: 'date', required: true },
    { id: 'duration', label: 'Duration', type: 'text', placeholder: 'PT5M30S', help: 'ISO 8601 duration format' },
    { id: 'contentUrl', label: 'Video URL', type: 'url' }
  ],
  FAQPage: [
    { id: 'description', label: 'Page Description', type: 'textarea' }
  ],
  LocalBusiness: [
    { id: 'name', label: 'Business Name', type: 'text', required: true },
    { id: 'description', label: 'Description', type: 'textarea' },
    { id: 'address', label: 'Street Address', type: 'text', required: true },
    { id: 'city', label: 'City', type: 'text', required: true },
    { id: 'state', label: 'State/Province', type: 'text', required: true },
    { id: 'postalCode', label: 'Postal Code', type: 'text', required: true },
    { id: 'country', label: 'Country', type: 'text', placeholder: 'US', required: true },
    { id: 'phone', label: 'Phone', type: 'tel' },
    { id: 'priceRange', label: 'Price Range', type: 'text', placeholder: '$$' },
    { id: 'openingHours', label: 'Opening Hours', type: 'text', placeholder: 'Mo-Fr 09:00-17:00', help: 'Comma-separated list' }
  ],
  Organization: [
    { id: 'name', label: 'Organization Name', type: 'text', required: true },
    { id: 'description', label: 'Description', type: 'textarea' },
    { id: 'url', label: 'Website URL', type: 'url' },
    { id: 'logo', label: 'Logo URL', type: 'url' },
    { id: 'contactPoint', label: 'Contact Email', type: 'email' }
  ],
  Person: [
    { id: 'name', label: 'Full Name', type: 'text', required: true },
    { id: 'jobTitle', label: 'Job Title', type: 'text' },
    { id: 'description', label: 'Description', type: 'textarea' },
    { id: 'image', label: 'Image URL', type: 'url' },
    { id: 'email', label: 'Email', type: 'email' },
    { id: 'url', label: 'Website URL', type: 'url' }
  ],
  Breadcrumbs: [
    { id: 'description', label: 'Description', type: 'textarea', help: 'Breadcrumb items will be extracted from URL structure' }
  ],
  Review: [
    { id: 'itemReviewed', label: 'Item Name', type: 'text', required: true },
    { id: 'reviewRating', label: 'Rating (1-5)', type: 'number', min: 1, max: 5, required: true },
    { id: 'author', label: 'Reviewer Name', type: 'text', required: true },
    { id: 'reviewBody', label: 'Review Text', type: 'textarea', required: true },
    { id: 'datePublished', label: 'Date Published', type: 'date' }
  ]
};

// DOM Elements
const elements = {
  // Navigation
  menuToggle: document.getElementById('menuToggle'),
  menuItems: document.querySelectorAll('.menu-item'),
  sidebar: document.querySelector('.sidebar'),
  pageTitle: document.getElementById('pageTitle'),
  pageSections: document.querySelectorAll('.page-section'),
  
  // Builder Page
  apiKey: document.getElementById('apiKey'),
  apiKeyHeader: document.getElementById('apiKeyHeader'),
  toggleKey: document.getElementById('toggleKey'),
  toggleKeyHeader: document.getElementById('toggleKeyHeader'),
  schemaType: document.getElementById('schemaType'),
  pageUrl: document.getElementById('pageUrl'),
  schemaFields: document.getElementById('schemaFields'),
  generateBtn: document.getElementById('generateBtn'),
  
  // Batch Page
  batchSchemaType: document.getElementById('batchSchemaType'),
  csvFile: document.getElementById('csvFile'),
  fileUploadArea: document.getElementById('fileUploadArea'),
  fileInfo: document.getElementById('fileInfo'),
  fileName: document.getElementById('fileName'),
  removeFile: document.getElementById('removeFile'),
  startProcessingBtn: document.getElementById('startProcessingBtn'),
  progressCard: document.getElementById('progressCard'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),
  currentUrl: document.getElementById('currentUrl'),
  pauseBtn: document.getElementById('pauseBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  startAfreshBtn: document.getElementById('startAfreshBtn'),
  resultsCard: document.getElementById('resultsCard'),
  resultsList: document.getElementById('resultsList'),
  downloadAllBtn: document.getElementById('downloadAllBtn'),
  downloadAllJsonBtn: document.getElementById('downloadAllJsonBtn'),
  
  // Modal
  resultModal: document.getElementById('resultModal'),
  closeModal: document.getElementById('closeModal'),
  resultContent: document.getElementById('resultContent'),
  copyBtn: document.getElementById('copyBtn'),
  downloadTxtBtn: document.getElementById('downloadTxtBtn'),
  downloadJsonBtn: document.getElementById('downloadJsonBtn'),
  
  // History
  historyList: document.getElementById('historyList'),
  
  // Error
  errorToast: document.getElementById('errorToast'),
  errorMessage: document.getElementById('errorMessage'),
  closeError: document.getElementById('closeError')
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initializeApp();
});

async function initializeApp() {
  // Check if critical elements are loaded
  if (!elements.resultsList) {
    console.error('resultsList element not found. Page may not be fully loaded.');
  }
  
  // Load saved API key and sync to both fields
  const saved = await chrome.storage.local.get(['apiKey']);
  if (saved.apiKey) {
    if (elements.apiKey) elements.apiKey.value = saved.apiKey;
    if (elements.apiKeyHeader) elements.apiKeyHeader.value = saved.apiKey;
  }

  // Setup navigation
  setupNavigation();
  
  // Setup schema type selector
  setupSchemaTypeSelector();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load history
  loadHistory();
  
  // Update copyright year
  const yearElement = document.getElementById('currentYear');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

function setupNavigation() {
  if (!elements.menuItems || elements.menuItems.length === 0) {
    console.error('Menu items not found');
    return;
  }
  
  elements.menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
    e.preventDefault();
      const page = item.dataset.page;
      if (page) {
        switchPage(page);
      } else {
        console.error('Menu item missing data-page attribute');
      }
    });
  });

  elements.menuToggle?.addEventListener('click', () => {
    elements.sidebar.classList.toggle('open');
  });
}

function switchPage(pageName) {
  console.log('Switching to page:', pageName);
  
  // Update active menu item
  if (elements.menuItems) {
    elements.menuItems.forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageName);
    });
  }

  // Update page sections - use direct style manipulation to override inline styles
  if (elements.pageSections && elements.pageSections.length > 0) {
    elements.pageSections.forEach(section => {
      const isTargetPage = section.id === `${pageName}Page`;
      if (isTargetPage) {
        section.style.display = 'block';
        section.classList.add('active');
        console.log('Showing page section:', section.id);
      } else {
        section.style.display = 'none';
        section.classList.remove('active');
      }
    });
  } else {
    console.error('Page sections not found');
  }

  // Update page title
  const titles = {
    builder: 'Schema Builder',
    batch: 'Batch Process',
    templates: 'Templates',
    history: 'History'
  };
  if (elements.pageTitle) {
    elements.pageTitle.textContent = titles[pageName] || 'Schema Builder';
  }
  
  // Load history when switching to history page
  if (pageName === 'history') {
    loadHistory();
  }
}

function setupSchemaTypeSelector() {
  elements.schemaType.addEventListener('change', () => {
    renderSchemaFields(elements.schemaType.value);
  });
  
  elements.batchSchemaType.addEventListener('change', () => {
    // Update batch schema type
  });

  // Initial render
  renderSchemaFields(elements.schemaType.value);
}

function renderSchemaFields(schemaType) {
  const fields = SCHEMA_FIELDS[schemaType] || [];
  const container = elements.schemaFields;
  
  if (fields.length === 0) {
    container.innerHTML = '<p class="placeholder-text">No additional fields required for this schema type</p>';
        return;
      }

  container.innerHTML = fields.map(field => {
    let inputHTML = '';
    
    if (field.type === 'textarea') {
      inputHTML = `<textarea id="field-${field.id}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}></textarea>`;
    } else if (field.type === 'select') {
      const options = field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
      inputHTML = `<select id="field-${field.id}" ${field.required ? 'required' : ''}>${options}</select>`;
    } else {
      const attrs = [
        `type="${field.type}"`,
        field.placeholder ? `placeholder="${field.placeholder}"` : '',
        field.required ? 'required' : '',
        field.min ? `min="${field.min}"` : '',
        field.max ? `max="${field.max}"` : ''
      ].filter(Boolean).join(' ');
      inputHTML = `<input id="field-${field.id}" ${attrs} />`;
    }

    return `
      <div class="schema-field">
        <label for="field-${field.id}">
          ${field.label}
          ${field.required ? '<span style="color: var(--error);">*</span>' : ''}
        </label>
        ${inputHTML}
        ${field.help ? `<div class="field-help">${field.help}</div>` : ''}
      </div>
    `;
  }).join('');
}

function setupEventListeners() {
  // API Key toggle - sync both toggles
  const toggleApiKeyVisibility = (field, toggleBtn) => {
    if (!field || !toggleBtn) return;
    const type = field.type === 'password' ? 'text' : 'password';
    field.type = type;
    const svg = toggleBtn.querySelector('svg');
    if (svg) {
      if (type === 'password') {
        // Show eye icon (visible)
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
      } else {
        // Show eye-off icon (hidden)
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
      }
    }
  };

  elements.toggleKey?.addEventListener('click', () => {
    toggleApiKeyVisibility(elements.apiKey, elements.toggleKey);
  });

  elements.toggleKeyHeader?.addEventListener('click', () => {
    toggleApiKeyVisibility(elements.apiKeyHeader, elements.toggleKeyHeader);
  });

  // Generate schema
  elements.generateBtn?.addEventListener('click', handleGenerate);

  // Save API key - sync both fields
  const syncApiKey = async (value) => {
    if (value) {
      await chrome.storage.local.set({ apiKey: value });
      // Sync to other field
      if (elements.apiKey && elements.apiKey.value !== value) {
        elements.apiKey.value = value;
      }
      if (elements.apiKeyHeader && elements.apiKeyHeader.value !== value) {
        elements.apiKeyHeader.value = value;
      }
    }
  };

  elements.apiKey?.addEventListener('input', async () => {
    await syncApiKey(elements.apiKey.value);
    updateStartButton(); // Update batch button state
  });

  elements.apiKeyHeader?.addEventListener('input', async () => {
    await syncApiKey(elements.apiKeyHeader.value);
    updateStartButton(); // Update batch button state
  });

  // File upload (batch processing)
  setupFileUpload();
  
  // Batch processing
  elements.startProcessingBtn?.addEventListener('click', startBatchProcessing);
  elements.downloadAllBtn?.addEventListener('click', downloadAllTxt);
  elements.downloadAllJsonBtn?.addEventListener('click', downloadAllJson);
  
  // Pause and Cancel buttons
  const pauseBtn = document.getElementById('pauseBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  
  pauseBtn?.addEventListener('click', () => {
    if (isPaused) {
      resumeProcessing();
    } else {
      pauseProcessing();
    }
  });
  
  cancelBtn?.addEventListener('click', () => {
    cancelProcessing();
  });
  
  // Start Afresh button
  elements.startAfreshBtn?.addEventListener('click', () => {
    startAfresh();
  });

  // Modal
  elements.closeModal?.addEventListener('click', () => {
    elements.resultModal.style.display = 'none';
  });
  elements.copyBtn?.addEventListener('click', handleCopy);
  elements.downloadTxtBtn?.addEventListener('click', handleDownloadTxt);
  elements.downloadJsonBtn?.addEventListener('click', handleDownloadJson);

  // Error toast
  elements.closeError?.addEventListener('click', () => {
    elements.errorToast.style.display = 'none';
  });

  // Close modal on outside click
  elements.resultModal?.addEventListener('click', (e) => {
    if (e.target === elements.resultModal) {
      elements.resultModal.style.display = 'none';
    }
  });
}

function setupFileUpload() {
  if (!elements.fileUploadArea) return;

  elements.fileUploadArea.addEventListener('click', () => elements.csvFile.click());
  elements.csvFile.addEventListener('change', handleFileSelect);
  
  elements.fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.fileUploadArea.classList.add('dragover');
  });

  elements.fileUploadArea.addEventListener('dragleave', () => {
    elements.fileUploadArea.classList.remove('dragover');
  });

  elements.fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.fileUploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'text/csv') {
      elements.csvFile.files = files;
      handleFileSelect({ target: elements.csvFile });
    }
  });

  elements.removeFile?.addEventListener('click', () => {
    elements.csvFile.value = '';
    csvData = [];
    elements.fileInfo.style.display = 'none';
    elements.fileUploadArea.style.display = 'block';
    updateStartButton();
  });
}


// ============================================================================
// SCHEMA GENERATION
// ============================================================================

async function handleGenerate() {
  const apiKey = (elements.apiKeyHeader?.value.trim() || elements.apiKey?.value.trim());
  const schemaType = elements.schemaType.value;
  const url = elements.pageUrl.value.trim();

  if (!apiKey) {
    showError('Please enter your Google AI Studio API key');
        return;
      }

  if (!url) {
    showError('Please enter a URL');
        return;
      }

  try {
    new URL(url);
  } catch {
    showError('Please enter a valid URL');
        return;
      }

  await chrome.storage.local.set({ apiKey });
  setLoading(true);
  hideError();

  try {
    const pageData = await extractPageContent(url);
    currentPageData = pageData;

    // Get form field values
    const fieldValues = getFieldValues(schemaType);

    const schema = await generateSchema(apiKey, url, pageData, schemaType, fieldValues);
    currentSchema = schema;

    // Save to history
    saveToHistory(url, schemaType, schema.schema, fieldValues);

    showResultModal(schema);
  } catch (error) {
    console.error('Error:', error);
    showError(error.message || 'Failed to generate schema. Please try again.');
  } finally {
    setLoading(false);
  }
}

function getFieldValues(schemaType) {
  const fields = SCHEMA_FIELDS[schemaType] || [];
  const values = {};
  
  fields.forEach(field => {
    const input = document.getElementById(`field-${field.id}`);
    if (input) {
      values[field.id] = input.value.trim();
    }
  });
  
  return values;
}

async function extractPageContent(url) {
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

async function generateSchema(apiKey, url, pageData, schemaType, fieldValues = {}) {
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const urlObj = new URL(url);
  const domain = urlObj.hostname;

  const prompt = buildPrompt(url, pageData, schemaType, domain, fieldValues);
  const systemInstruction = getSystemInstruction(schemaType);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] }
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  let jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (!jsonMatch) {
    jsonMatch = text.match(/(\{[\s\S]*\})/);
  }

  if (!jsonMatch) {
    throw new Error('Model did not return valid JSON');
  }

  const result = JSON.parse(jsonMatch[1]);
  const schemaText = result.schema_jsonld || '';

  let schemaObj;
  try {
    schemaObj = JSON.parse(schemaText);
  } catch {
    schemaObj = buildDefaultSchema(url, schemaType, pageData, fieldValues);
  }

  // Enhance schema with extracted data and field values
  schemaObj = enhanceSchema(schemaObj, url, schemaType, pageData, fieldValues, result);

  // Clean up null/undefined values
  Object.keys(schemaObj).forEach(key => {
    if (schemaObj[key] === null || schemaObj[key] === undefined || schemaObj[key] === '') {
      delete schemaObj[key];
    }
  });

  return { schema: schemaObj };
}

function buildDefaultSchema(url, schemaType, pageData, fieldValues) {
  const base = {
      '@context': 'https://schema.org',
    '@type': schemaType,
    url: url
  };

  // Add type-specific defaults
  if (schemaType === 'WebPage') {
    base.mainEntityOfPage = url;
    if (pageData && pageData.title) base.name = pageData.title;
  } else if (schemaType === 'Article') {
    if (pageData.title) base.headline = pageData.title;
    if (fieldValues.author) base.author = { '@type': 'Person', name: fieldValues.author };
    if (fieldValues.datePublished) base.datePublished = fieldValues.datePublished;
  } else if (schemaType === 'Product') {
    if (fieldValues.name) base.name = fieldValues.name;
    if (fieldValues.price) {
      base.offers = {
        '@type': 'Offer',
        price: fieldValues.price,
        priceCurrency: fieldValues.currency || 'USD',
        availability: `https://schema.org/${fieldValues.availability || 'InStock'}`
      };
    }
  }

  return base;
}

function enhanceSchema(schemaObj, url, schemaType, pageData, fieldValues, aiResult) {
  // Add common fields
  if (pageData.title && !schemaObj.name && !schemaObj.headline) {
    schemaObj.name = pageData.title;
  }

  if (aiResult.description) {
    schemaObj.description = aiResult.description;
  } else if (pageData.meta_description) {
    schemaObj.description = pageData.meta_description;
  }

  // Add publisher/logo for WebPage
  if (schemaType === 'WebPage') {
    // Add keywords if provided
    if (aiResult.keywords && Array.isArray(aiResult.keywords) && aiResult.keywords.length > 0) {
      schemaObj.keywords = aiResult.keywords.join(', ');
    }
    
    // Add about array from knowsAbout
    if (aiResult.knowsAbout && Array.isArray(aiResult.knowsAbout) && aiResult.knowsAbout.length > 0) {
      schemaObj.about = aiResult.knowsAbout.map(item => ({
        '@type': 'Thing',
        name: item.name || '',
        description: item.description || ''
      })).filter(item => item.name); // Only include items with names
    }
    
    // Add publisher
    if (aiResult.publisher) {
    schemaObj.publisher = {
      '@type': 'Organization',
        name: aiResult.publisher.name || '',
        url: aiResult.publisher.url || `https://${new URL(url).hostname}`,
        knowsAbout: aiResult.publisher.knowsAbout || []
      };
      
      const logoUrl = pageData.logo || aiResult.publisher.logo;
      if (logoUrl && logoUrl.trim()) {
        schemaObj.publisher.logo = {
          '@type': 'ImageObject',
          url: logoUrl.trim()
        };
      }
    }
  }

  // Merge field values into schema
  Object.keys(fieldValues).forEach(key => {
    if (fieldValues[key]) {
      // Map field IDs to schema properties
      const propertyMap = {
        headline: 'headline',
        author: 'author',
        datePublished: 'datePublished',
        dateModified: 'dateModified',
        image: 'image',
        thumbnailUrl: 'thumbnailUrl',
        name: 'name',
        price: 'offers.price',
        currency: 'offers.priceCurrency',
        availability: 'offers.availability',
        // ... add more mappings as needed
      };

      const prop = propertyMap[key] || key;
      if (prop.includes('.')) {
        const [parent, child] = prop.split('.');
        if (!schemaObj[parent]) schemaObj[parent] = {};
        schemaObj[parent][child] = fieldValues[key];
      } else {
        schemaObj[prop] = fieldValues[key];
      }
    }
  });

  return schemaObj;
}

function buildPrompt(url, page, schemaType, domainHint, fieldValues) {
  // Special handling for WebPage schema with keywords
  if (schemaType === 'WebPage') {
    const seedKeywords = fieldValues.keywords ? 
      (Array.isArray(fieldValues.keywords) ? fieldValues.keywords : fieldValues.keywords.split(/[,;]/).map(k => k.trim()).filter(Boolean)) : 
      [];
    
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
   - "logo": the organization's logo URL (use the logo from page metadata if available, otherwise construct a reasonable logo URL like https://domain.com/logo.png or https://domain.com/favicon.ico)
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
       "logo": {
         "@type": "ImageObject",
         "url": "https://organization-logo-url.com"
       },
       "knowsAbout": ["topic1", "topic2", "topic3"]
     }
   - 'about' array with objects in this exact format:
     {
       "@type": "Thing",
       "name": "name of entity",
       "description": "short description of entity"
     }

Return JSON with keys: description, keywords (array of strings), knowsAbout (array of objects with 'name' and 'description'), publisher (object with 'name', 'url', 'logo' (URL string), and 'knowsAbout' array of strings), schema_jsonld (string).
Only return JSON. No commentary.`;
}

  // Generic prompt for other schema types
  const fieldValuesText = Object.keys(fieldValues).length > 0 
    ? `\n\nAdditional Field Values:\n${JSON.stringify(fieldValues, null, 2)}`
    : '';

  return `URL: ${url}
Domain: ${domainHint}

Title: ${page.title || ''}
Meta Description: ${page.meta_description || ''}
H1: ${JSON.stringify(page.h1 || [])}

Extracted content (truncated):
${page.content || ''}${fieldValuesText}

Task:
Generate a valid JSON-LD schema for schema.org type "${schemaType}".

The schema must include all required properties for ${schemaType} and should be based on the page content and any provided field values.

Return JSON with keys: description, schema_jsonld (string containing the complete JSON-LD schema).

Only return JSON. No commentary.`;
}

function getSystemInstruction(schemaType) {
  if (schemaType === 'WebPage') {
    return `You are an SEO and structured data assistant. Generate valid JSON-LD schemas for schema.org WebPage type.
Create a complete, valid WebPage schema based on the provided page content.
The schema_jsonld must be valid JSON-LD that follows schema.org WebPage specifications.
Include all required properties: @context, @type, url, description, keywords, mainEntityOfPage, publisher (with logo), and about array.
The publisher must include a logo as an ImageObject with @type and url properties.
The about array must contain Thing objects with @type, name, and description properties.`;
  }
  
  return `You are an SEO and structured data assistant. Generate valid JSON-LD schemas for schema.org. 
Create a complete, valid ${schemaType} schema based on the provided page content and field values.
The schema_jsonld must be valid JSON-LD that follows schema.org specifications for ${schemaType}.
Include all required properties and relevant optional properties.`;
}

// ============================================================================
// UI HELPERS
// ============================================================================

function showResultModal(schema) {
  const schemaText = JSON.stringify(schema.schema, null, 2);
  const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;
  elements.resultContent.textContent = wrappedSchema;
  elements.resultModal.style.display = 'flex';
}

function handleCopy() {
  if (!currentSchema) return;
  const schemaText = JSON.stringify(currentSchema.schema, null, 2);
  const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;
  navigator.clipboard.writeText(wrappedSchema).then(() => {
    const originalHTML = elements.copyBtn.innerHTML;
    elements.copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 6px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Copied!';
      setTimeout(() => {
      elements.copyBtn.innerHTML = originalHTML;
      }, 2000);
  });
}

function handleDownloadTxt() {
  if (!currentSchema) return;
  const schemaText = JSON.stringify(currentSchema.schema, null, 2);
  const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;
  const content = `${elements.pageUrl.value}\n${wrappedSchema}`;
  downloadFile(content, 'schema.txt', 'text/plain');
}

function handleDownloadJson() {
  if (!currentSchema) return;
  const content = JSON.stringify(currentSchema.schema, null, 2);
  downloadFile(content, 'schema.json', 'application/json');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setLoading(loading) {
  if (elements.generateBtn) {
    elements.generateBtn.disabled = loading;
    const btnText = elements.generateBtn.querySelector('.btn-text');
    const btnLoader = elements.generateBtn.querySelector('.btn-loader');
    if (btnText && btnLoader) {
      btnText.style.display = loading ? 'none' : 'inline-block';
      btnLoader.style.display = loading ? 'inline-block' : 'none';
    }
  }
}

function showError(message) {
  if (elements.errorMessage && elements.errorToast) {
    elements.errorMessage.textContent = message;
    elements.errorToast.style.display = 'block';
    setTimeout(() => {
      elements.errorToast.style.display = 'none';
    }, 5000);
  }
}

function hideError() {
  if (elements.errorToast) {
    elements.errorToast.style.display = 'none';
  }
}

// ============================================================================
// BATCH PROCESSING (Keep existing functionality)
// ============================================================================

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.csv')) {
    showError('Please upload a CSV file');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const text = event.target.result;
      csvData = parseCSV(text);
      
      if (csvData.length === 0) {
        showError('CSV file is empty or invalid');
        return;
      }

      if (csvData.length > MAX_URLS) {
        showError(`CSV contains ${csvData.length} URLs. Maximum is ${MAX_URLS}.`);
        csvData = csvData.slice(0, MAX_URLS);
      }

      elements.fileName.textContent = `${file.name} (${csvData.length} URLs)`;
      elements.fileInfo.style.display = 'flex';
      elements.fileUploadArea.style.display = 'none';
      updateStartButton();
      hideError();
    } catch (error) {
      showError(`Error parsing CSV: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const urlIndex = headers.findIndex(h => h === 'url' || h === 'urls');
  const keywordIndex = headers.findIndex(h => 
    h.includes('keyword') || h.includes('keywords') || h.includes('primary')
  );

  if (urlIndex === -1) {
    throw new Error('CSV must have a "url" column');
  }

  const data = [];
  for (let i = 1; i < lines.length && data.length < MAX_URLS; i++) {
    const values = parseCSVLine(lines[i]);
    const url = values[urlIndex]?.trim();
    const keywords = keywordIndex !== -1 ? values[keywordIndex]?.trim() : '';

    if (url && isValidURL(url)) {
      data.push({
        url,
        keywords: keywords ? keywords.split(/[,;]/).map(k => k.trim()).filter(Boolean) : []
      });
    }
  }

  return data;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function isValidURL(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function updateStartButton() {
  const hasApiKey = (elements.apiKeyHeader?.value.trim().length > 0 || elements.apiKey?.value.trim().length > 0);
  const hasData = csvData.length > 0;
  if (elements.startProcessingBtn) {
    elements.startProcessingBtn.disabled = !hasApiKey || !hasData || isProcessing;
  }
}

async function startBatchProcessing() {
  const apiKey = (elements.apiKeyHeader?.value.trim() || elements.apiKey?.value.trim());
  const schemaType = elements.batchSchemaType.value;

  if (!apiKey) {
    showError('Please enter your API key');
    return;
  }

  if (csvData.length === 0) {
    showError('Please upload a CSV file');
    return;
  }

  await chrome.storage.local.set({ apiKey });

  // Switch to batch page first
  switchPage('batch');

  isProcessing = true;
  isPaused = false;
  isCancelled = false;
  currentIndex = 0;
  results = [];
  processingQueue = [...csvData];
  
  // Update control buttons
  updateControlButtons();
  
  // Hide configuration card, show progress and results
  const configCard = document.querySelector('#batchPage .cards-grid .card:first-of-type');
  if (configCard) {
    configCard.style.display = 'none';
  }
  
  // Show progress and results cards
  if (elements.progressCard) {
    elements.progressCard.style.display = 'block';
  } else {
    console.error('progressCard element not found');
  }
  if (elements.resultsCard) {
    elements.resultsCard.style.display = 'block';
  } else {
    console.error('resultsCard element not found');
  }
  hideError();

  // Update results subtitle
  updateResultsSubtitle();

  if (elements.resultsList) {
    elements.resultsList.innerHTML = '';
    processingQueue.forEach((item, index) => {
      addResultItem(item.url, item.keywords, index);
    });
  } else {
    console.error('resultsList element not found');
  }

  processNext(schemaType, apiKey);
}

async function processNext(schemaType, apiKey) {
  // Check if cancelled
  if (isCancelled) {
    isProcessing = false;
    isPaused = false;
    if (elements.currentUrl) elements.currentUrl.textContent = 'Processing cancelled';
    updateControlButtons();
    return;
  }
  
  // Check if paused
  if (isPaused) {
    if (elements.currentUrl) elements.currentUrl.textContent = 'Processing paused...';
    // Wait and check again
    setTimeout(() => processNext(schemaType, apiKey), 500);
    return;
  }
  
  if (currentIndex >= processingQueue.length) {
    isProcessing = false;
    isPaused = false;
    isCancelled = false; // Reset cancelled state on normal completion
    if (elements.progressBar) elements.progressBar.style.width = '100%';
    if (elements.progressText) elements.progressText.textContent = `Complete: ${processingQueue.length} / ${processingQueue.length}`;
    if (elements.currentUrl) elements.currentUrl.textContent = '';
    updateControlButtons();
    return;
  }

  const item = processingQueue[currentIndex];
  const progress = ((currentIndex + 1) / processingQueue.length) * 100;
  if (elements.progressBar) elements.progressBar.style.width = `${progress}%`;
  if (elements.progressText) elements.progressText.textContent = `${currentIndex + 1} / ${processingQueue.length}`;
  if (elements.currentUrl) elements.currentUrl.textContent = `Processing: ${item.url}`;

  updateResultItemStatus(currentIndex, 'processing');

  try {
    const pageData = await extractPageContent(item.url);
    // Pass keywords from CSV to fieldValues for WebPage schema
    const fieldValues = schemaType === 'WebPage' && item.keywords.length > 0 
      ? { keywords: item.keywords } 
      : {};
    const schema = await generateSchema(apiKey, item.url, pageData, schemaType, fieldValues);
    
    results[currentIndex] = {
      url: item.url,
      keywords: item.keywords,
      schema: schema.schema,
      success: true
    };

    updateResultItem(currentIndex, schema.schema, item.keywords);
    updateResultItemStatus(currentIndex, 'success');
    updateResultsSubtitle();
    
    // Save to history
    saveToHistory(item.url, schemaType, schema.schema, fieldValues);
  } catch (error) {
    console.error(`Error processing ${item.url}:`, error);
    let errorMessage = error.message;
    
    // Provide more helpful error messages
    if (errorMessage.includes('Timeout')) {
      errorMessage = 'Timeout: Page took too long to load. The page may be slow or have heavy JavaScript. Try retrying.';
    } else if (errorMessage.includes('Failed to fetch')) {
      errorMessage = 'Failed to fetch page. The URL may be inaccessible or blocked.';
    } else if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
      errorMessage = 'Cross-origin restriction. Cannot access this page.';
    }
    
    results[currentIndex] = {
      url: item.url,
      keywords: item.keywords,
      error: errorMessage,
      success: false
    };
    updateResultItemError(currentIndex, errorMessage);
    updateResultItemStatus(currentIndex, 'error');
    updateResultsSubtitle();
  }

  currentIndex++;
  setTimeout(() => processNext(schemaType, apiKey), 500);
}

function pauseProcessing() {
  isPaused = true;
  updateControlButtons();
  if (elements.currentUrl) {
    elements.currentUrl.textContent = 'Processing paused...';
  }
}

function resumeProcessing() {
  isPaused = false;
  updateControlButtons();
  if (elements.currentUrl && currentIndex < processingQueue.length) {
    const item = processingQueue[currentIndex];
    elements.currentUrl.textContent = `Processing: ${item.url}`;
  }
  // Resume processing
  const apiKey = (elements.apiKeyHeader?.value.trim() || elements.apiKey?.value.trim());
  const schemaType = elements.batchSchemaType.value;
  processNext(schemaType, apiKey);
}

function cancelProcessing() {
  if (confirm('Are you sure you want to cancel the batch processing? Progress will be lost.')) {
    isCancelled = true;
    isPaused = false;
    isProcessing = false;
    updateControlButtons();
    if (elements.currentUrl) {
      elements.currentUrl.textContent = 'Processing cancelled';
    }
    // Mark remaining items as cancelled
    for (let i = currentIndex; i < processingQueue.length; i++) {
      if (results[i] && !results[i].success) {
        updateResultItemStatus(i, 'error');
        const resultItem = document.querySelector(`[data-index="${i}"]`);
        if (resultItem) {
          const urlEl = resultItem.querySelector('.result-url');
          if (urlEl) {
            urlEl.textContent = 'Cancelled';
          }
        }
      }
    }
  }
}

function startAfresh() {
  // Reset all state
  isProcessing = false;
  isPaused = false;
  isCancelled = false;
  currentIndex = 0;
  results = [];
  processingQueue = [];
  
  // Clear results list
  if (elements.resultsList) {
    elements.resultsList.innerHTML = '';
  }
  
  // Reset progress
  if (elements.progressBar) {
    elements.progressBar.style.width = '0%';
  }
  if (elements.progressText) {
    elements.progressText.textContent = '0 / 0';
  }
  if (elements.currentUrl) {
    elements.currentUrl.textContent = '';
  }
  
  // Hide progress card, show configuration card
  if (elements.progressCard) {
    elements.progressCard.style.display = 'none';
  }
  if (elements.resultsCard) {
    elements.resultsCard.style.display = 'none';
  }
  
  const configCard = document.querySelector('#batchPage .cards-grid .card:first-of-type');
  if (configCard) {
    configCard.style.display = 'block';
  }
  
  // Update buttons
  updateControlButtons();
  updateStartButton();
  
  // Update results subtitle
  updateResultsSubtitle();
}

function updateControlButtons() {
  const pauseBtn = elements.pauseBtn;
  const cancelBtn = elements.cancelBtn;
  const startAfreshBtn = elements.startAfreshBtn;
  const controlsContainer = document.querySelector('.progress-controls');
  
  if (!pauseBtn || !cancelBtn || !startAfreshBtn || !controlsContainer) return;
  
  // Show/hide buttons based on processing state
  if (isProcessing && !isCancelled) {
    controlsContainer.style.display = 'flex';
    pauseBtn.style.display = 'flex';
    cancelBtn.style.display = 'flex';
    startAfreshBtn.style.display = 'none';
    
    // Update pause button text and icon
    const pauseIcon = pauseBtn.querySelector('.btn-icon svg');
    const pauseText = pauseBtn.querySelector('.btn-text');
    
    if (isPaused) {
      // Show play icon
      if (pauseIcon) {
        pauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
      }
      if (pauseText) pauseText.textContent = 'Resume';
    } else {
      // Show pause icon
      if (pauseIcon) {
        pauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
      }
      if (pauseText) pauseText.textContent = 'Pause';
    }
  } else if (isCancelled) {
    // Show Start Afresh button when cancelled
    controlsContainer.style.display = 'flex';
    pauseBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    startAfreshBtn.style.display = 'flex';
  } else {
    controlsContainer.style.display = 'none';
    pauseBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    startAfreshBtn.style.display = 'none';
  }
}

function updateResultsSubtitle() {
  const subtitle = document.getElementById('resultsSubtitle');
  if (!subtitle) return;
  
  const successful = results.filter(r => r && r.success).length;
  const total = results.length;
  const failed = results.filter(r => r && !r.success).length;
  
  if (total === 0) {
    subtitle.textContent = 'No results yet';
  } else if (isProcessing) {
    subtitle.textContent = `Processing ${currentIndex} of ${total}...`;
  } else {
    subtitle.textContent = `Showing ${total} results: ${successful} successful${failed > 0 ? `, ${failed} failed` : ''}`;
  }
}

function addResultItem(url, keywords, index) {
  const item = document.createElement('div');
  item.className = 'result-item';
  item.id = `result-${index}`;
  item.setAttribute('data-index', index);
  item.innerHTML = `
    <div class="result-item-url">${url}</div>
    <span class="result-item-status processing" id="status-${index}">Processing...</span>
    <div class="result-item-actions" id="actions-${index}" style="display: none;"></div>
    ${keywords.length > 0 ? `<div class="result-item-keywords">Keywords: ${keywords.join(', ')}</div>` : ''}
    <div class="result-item-content" id="content-${index}" style="display: none;"></div>
  `;
  elements.resultsList.appendChild(item);
}

function updateResultItemStatus(index, status) {
  const statusEl = document.getElementById(`status-${index}`);
  if (!statusEl) return;
  statusEl.className = `result-item-status ${status}`;
  if (status === 'processing') {
    statusEl.textContent = 'Processing...';
  } else if (status === 'success') {
    statusEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Success';
  } else if (status === 'error') {
    statusEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Error';
  }
}

function updateResultItem(index, schema, keywords) {
  const contentEl = document.getElementById(`content-${index}`);
  const actionsEl = document.getElementById(`actions-${index}`);
  if (!contentEl || !actionsEl) return;

  const schemaText = JSON.stringify(schema, null, 2);
  const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;
  contentEl.textContent = wrappedSchema;
  contentEl.style.display = 'block';

  // Clear and create buttons with proper event listeners
  actionsEl.innerHTML = '';
  actionsEl.style.display = 'flex';
  actionsEl.style.gap = '8px';
  
  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-secondary btn-small';
  copyBtn.title = 'Copy to clipboard';
  copyBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;
  copyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.copySchema(index);
  });
  actionsEl.appendChild(copyBtn);
  
  // Download TXT button
  const downloadTxtBtn = document.createElement('button');
  downloadTxtBtn.className = 'btn-secondary btn-small';
  downloadTxtBtn.title = 'Download as TXT';
  downloadTxtBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
    </svg>
  `;
  downloadTxtBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.downloadSchemaTxt(index);
  });
  actionsEl.appendChild(downloadTxtBtn);
  
  // Download JSON button
  const downloadJsonBtn = document.createElement('button');
  downloadJsonBtn.className = 'btn-secondary btn-small';
  downloadJsonBtn.title = 'Download as JSON';
  downloadJsonBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  `;
  downloadJsonBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.downloadSchemaJson(index);
  });
  actionsEl.appendChild(downloadJsonBtn);
}

function updateResultItemError(index, errorMsg) {
  const contentEl = document.getElementById(`content-${index}`);
  const actionsEl = document.getElementById(`actions-${index}`);
  if (!contentEl || !actionsEl) return;
  contentEl.textContent = `Error: ${errorMsg}`;
  contentEl.style.display = 'block';
  
  // Add retry button for failed items
  actionsEl.innerHTML = `
    <button class="btn-secondary btn-small btn-retry" onclick="retryFailedItem(${index})" title="Retry this item">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      <span>Retry</span>
    </button>
  `;
  actionsEl.style.display = 'flex';
}

window.copySchema = function(index) {
  if (!results[index] || !results[index].success) {
    showError('No schema available to copy');
    return;
  }
  const schemaText = JSON.stringify(results[index].schema, null, 2);
  const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;
  navigator.clipboard.writeText(wrappedSchema).then(() => {
    const resultItem = document.getElementById(`result-${index}`);
    if (resultItem) {
      const btn = resultItem.querySelector('.btn-secondary[title="Copy to clipboard"]');
    if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      setTimeout(() => {
          btn.innerHTML = originalHTML;
      }, 2000);
    }
    }
  }).catch(err => {
    console.error('Failed to copy:', err);
    showError('Failed to copy to clipboard');
  });
};

window.downloadSchemaTxt = function(index) {
  if (!results[index] || !results[index].success) {
    showError('No schema available to download');
    return;
  }
  const schemaText = JSON.stringify(results[index].schema, null, 2);
  const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;
  const content = `${results[index].url}\n${wrappedSchema}`;
  downloadFile(content, `schema-${index + 1}.txt`, 'text/plain');
};

window.downloadSchemaJson = function(index) {
  if (!results[index] || !results[index].success) {
    showError('No schema available to download');
    return;
  }
  const content = JSON.stringify(results[index].schema, null, 2);
  downloadFile(content, `schema-${index + 1}.json`, 'application/json');
};

window.retryFailedItem = async function(index) {
  // Check if item exists and failed
  if (!results[index] || results[index].success) return;
  
  const item = processingQueue[index];
  if (!item) return;
  
  // Get API key and schema type
  const apiKey = (elements.apiKeyHeader?.value.trim() || elements.apiKey?.value.trim());
  const schemaType = elements.batchSchemaType.value;
  
  if (!apiKey) {
    showError('Please enter your API key');
    return;
  }
  
  // Update UI to show retrying
  updateResultItemStatus(index, 'processing');
  const contentEl = document.getElementById(`content-${index}`);
  const actionsEl = document.getElementById(`actions-${index}`);
  if (contentEl) {
    contentEl.textContent = 'Retrying...';
    contentEl.style.display = 'block';
  }
  if (actionsEl) {
    actionsEl.style.display = 'none';
  }
  
  try {
    const pageData = await extractPageContent(item.url);
    // Pass keywords from CSV to fieldValues for WebPage schema
    const fieldValues = schemaType === 'WebPage' && item.keywords.length > 0 
      ? { keywords: item.keywords } 
      : {};
    const schema = await generateSchema(apiKey, item.url, pageData, schemaType, fieldValues);
    
    // Update result
    results[index] = {
      url: item.url,
      keywords: item.keywords,
      schema: schema.schema,
      success: true
    };
    
    updateResultItem(index, schema.schema, item.keywords);
    updateResultItemStatus(index, 'success');
    updateResultsSubtitle();
    
    // Save to history
    saveToHistory(item.url, schemaType, schema.schema, fieldValues);
  } catch (error) {
    console.error(`Error retrying ${item.url}:`, error);
    let errorMessage = error.message;
    
    // Provide more helpful error messages
    if (errorMessage.includes('Timeout')) {
      errorMessage = 'Timeout: Page took too long to load. The page may be slow or have heavy JavaScript.';
    } else if (errorMessage.includes('Failed to fetch')) {
      errorMessage = 'Failed to fetch page. The URL may be inaccessible or blocked.';
    } else if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
      errorMessage = 'Cross-origin restriction. Cannot access this page.';
    }
    
    results[index] = {
      url: item.url,
      keywords: item.keywords,
      error: errorMessage,
      success: false
    };
    updateResultItemError(index, errorMessage);
    updateResultItemStatus(index, 'error');
    updateResultsSubtitle();
  }
};

function downloadAllTxt() {
  const successful = results.filter(r => r && r.success);
  if (successful.length === 0) {
    showError('No successful results to download');
    return;
  }
  let content = '';
  successful.forEach((result, index) => {
    if (index > 0) content += '\n\n';
    const schemaText = JSON.stringify(result.schema, null, 2);
    const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;
    content += `${result.url}\n${wrappedSchema}`;
  });
  downloadFile(content, 'all-schemas.txt', 'text/plain');
}

function downloadAllJson() {
  const successful = results.filter(r => r && r.success);
  if (successful.length === 0) {
    showError('No successful results to download');
    return;
  }
  const allSchemas = successful.map(result => result.schema);
  const content = JSON.stringify(allSchemas, null, 2);
  downloadFile(content, 'all-schemas.json', 'application/json');
}

// ============================================================================
// HISTORY MANAGEMENT
// ============================================================================

async function saveToHistory(url, schemaType, schema, fieldValues = {}) {
  try {
    const historyItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      url: url,
      schemaType: schemaType,
      schema: schema,
      fieldValues: fieldValues,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    
    const result = await chrome.storage.local.get(['schemaHistory']);
    const history = result.schemaHistory || [];
    
    // Add to beginning of array (most recent first)
    history.unshift(historyItem);
    
    // Limit to last 100 items to prevent storage issues
    const maxItems = 100;
    if (history.length > maxItems) {
      history.splice(maxItems);
    }
    
    await chrome.storage.local.set({ schemaHistory: history });
  } catch (error) {
    console.error('Error saving to history:', error);
  }
}

async function loadHistory() {
  if (!elements.historyList) return;
  
  try {
    const result = await chrome.storage.local.get(['schemaHistory']);
    const history = result.schemaHistory || [];
    
    if (history.length === 0) {
      elements.historyList.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.3; margin-bottom: 16px;">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <p style="color: var(--text-secondary); font-size: 14px;">No history yet. Generate some schemas to see them here.</p>
        </div>
      `;
      return;
    }
    
    // Sort by timestamp (most recent first) - already sorted but ensure it
    const sortedHistory = history.sort((a, b) => b.timestamp - a.timestamp);
    
    elements.historyList.innerHTML = sortedHistory.map(item => {
      const date = new Date(item.timestamp);
      const formattedDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `
        <div class="history-item" data-id="${item.id}">
          <div class="history-item-main">
            <div class="history-item-header">
              <div class="history-item-url">${item.url}</div>
              <span class="history-item-type">${item.schemaType}</span>
            </div>
            <div class="history-item-meta">
              <span class="history-item-date">${formattedDate}</span>
            </div>
          </div>
          <div class="history-item-actions">
            <button class="btn-secondary btn-small" onclick="viewHistoryItem('${item.id}')" title="View schema">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button class="btn-secondary btn-small" onclick="copyHistoryItem('${item.id}')" title="Copy schema">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button class="btn-secondary btn-small" onclick="downloadHistoryItem('${item.id}')" title="Download schema">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button class="btn-secondary btn-small btn-danger" onclick="deleteHistoryItem('${item.id}')" title="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading history:', error);
    elements.historyList.innerHTML = `
      <div class="empty-state">
        <p style="color: var(--error);">Error loading history. Please try again.</p>
      </div>
    `;
  }
}

window.viewHistoryItem = async function(id) {
  try {
    const result = await chrome.storage.local.get(['schemaHistory']);
    const history = result.schemaHistory || [];
    const item = history.find(h => h.id === id);
    
    if (!item) {
      showError('History item not found');
      return;
    }
    
    currentSchema = { schema: item.schema };
    showResultModal({ schema: item.schema });
  } catch (error) {
    console.error('Error viewing history item:', error);
    showError('Failed to view history item');
  }
};

window.copyHistoryItem = async function(id) {
  try {
    const result = await chrome.storage.local.get(['schemaHistory']);
    const history = result.schemaHistory || [];
    const item = history.find(h => h.id === id);
    
    if (!item) {
      showError('History item not found');
      return;
    }
    
    const schemaText = JSON.stringify(item.schema, null, 2);
    const wrappedSchema = `<script type="application/ld+json">\n${schemaText}\n</script>`;
    await navigator.clipboard.writeText(wrappedSchema);
    
    // Show feedback
    const btn = document.querySelector(`[data-id="${id}"] .btn-secondary[onclick*="copyHistoryItem"]`);
    if (btn) {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      setTimeout(() => {
        btn.innerHTML = originalHTML;
      }, 2000);
    }
  } catch (error) {
    console.error('Error copying history item:', error);
    showError('Failed to copy schema');
  }
};

window.downloadHistoryItem = async function(id) {
  try {
    const result = await chrome.storage.local.get(['schemaHistory']);
    const history = result.schemaHistory || [];
    const item = history.find(h => h.id === id);
    
    if (!item) {
      showError('History item not found');
      return;
    }
    
    const content = JSON.stringify(item.schema, null, 2);
    const filename = `schema-${item.schemaType}-${Date.now()}.json`;
    downloadFile(content, filename, 'application/json');
  } catch (error) {
    console.error('Error downloading history item:', error);
    showError('Failed to download schema');
  }
};

window.deleteHistoryItem = async function(id) {
  if (!confirm('Are you sure you want to delete this history item?')) {
    return;
  }
  
  try {
    const result = await chrome.storage.local.get(['schemaHistory']);
    const history = result.schemaHistory || [];
    const filtered = history.filter(h => h.id !== id);
    
    await chrome.storage.local.set({ schemaHistory: filtered });
    loadHistory(); // Reload history
  } catch (error) {
    console.error('Error deleting history item:', error);
    showError('Failed to delete history item');
  }
};
