// AISIS Auto Scraper - Enhanced Background Script with HAR Capture
// This version includes comprehensive debugging and HAR file generation

const DATASET_LABELS = {
  officialCurriculum: 'Curriculum',
  scheduleOfClasses: 'Schedule of Classes',
  grades: 'View Grades',
  advisoryGrades: 'Advisory Grades',
  enrolledClasses: 'Currently Enrolled',
  classSchedule: 'My Class Schedule',
  tuitionReceipt: 'Tuition Receipt',
  studentInfo: 'Student Information',
  programOfStudy: 'Program of Study',
  holdOrders: 'Hold Orders',
  facultyAttendance: 'Faculty Attendance'
};

const LOG_HISTORY_LIMIT = 500;
const DEFAULT_FETCH_TIMEOUT_MS = 90_000; // 90s timeout to tolerate slow AISIS responses
const MAX_HAR_ENTRIES = 200;
const MAX_HAR_BODY_LENGTH = 200_000; // Limit HAR bodies to ~200 KB to avoid excessive storage use
const MAX_HTML_SNAPSHOTS = 20;
const MAX_HTML_SNAPSHOT_SIZE = 250_000; // Limit HTML snapshots to ~250 KB each

const DEFAULT_METRICS = {
  totalRequests: 0,
  totalResponseTimeMs: 0,
  avgResponseMs: 0,
  bytesDownloaded: 0,
  slowResponses: 0,
  lastResponseMs: 0,
  lastStatus: null,
  lastRequestUrl: null,
  lastRequestMethod: null,
  lastRequestAt: null
};

function createInitialState(overrides = {}) {
  return {
    isRunning: false,
    isPaused: false,
    isCompleted: false,
    sessionId: null,
    progress: 0,
    currentStep: '',
    currentPage: '',
    totalSteps: 0,
    completedSteps: 0,
    startTime: null,
    logs: [],
    scrapedData: {},
    errors: [],
    debugMode: false,
    harEntries: [],
    htmlSnapshotOrder: [],
    htmlSnapshots: {},
    metrics: { ...DEFAULT_METRICS },
    logsTrimmed: false,
    lastUpdated: null,
    startedAt: null,
    completedAt: null,
    lastLogAt: null,
    selectedPages: null,
    ...overrides,
    metrics: { ...DEFAULT_METRICS, ...(overrides.metrics || {}) }
  };
}

// Global state
let scrapingState = createInitialState();

// Generate session ID
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDatasetLabel(key) {
  if (!key) {
    return 'Dataset';
  }
  if (DATASET_LABELS[key]) {
    return DATASET_LABELS[key];
  }
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, chr => chr.toUpperCase())
    .trim();
}

function updateDatasetProgress(key, updates = {}) {
  if (!key) {
    return;
  }

  if (!scrapingState.datasetProgress) {
    scrapingState.datasetProgress = {};
  }

  const existing = scrapingState.datasetProgress[key] || {};
  scrapingState.datasetProgress[key] = {
    label: updates.label || existing.label || formatDatasetLabel(key),
    completed: updates.completed !== undefined ? updates.completed : existing.completed || 0,
    total: updates.total !== undefined ? updates.total : existing.total || 0,
    items: updates.items !== undefined ? updates.items : existing.items || 0,
    detail: updates.detail !== undefined ? updates.detail : existing.detail || null,
    updatedAt: new Date().toISOString()
  };
}

function normalizePageSelection(pages = {}) {
  return {
    scheduleOfClasses: Boolean(pages.scheduleOfClasses || pages.schedule),
    officialCurriculum: Boolean(pages.officialCurriculum || pages.curriculum),
    grades: Boolean(pages.grades || pages.viewGrades),
    advisoryGrades: Boolean(pages.advisoryGrades || pages.advisory),
    enrolledClasses: Boolean(pages.enrolledClasses || pages.currentlyEnrolled),
    classSchedule: Boolean(pages.classSchedule || pages.myClassSchedule),
    tuitionReceipt: Boolean(pages.tuitionReceipt || pages.receipts),
    studentInfo: Boolean(pages.studentInfo || pages.profile),
    programOfStudy: Boolean(pages.programOfStudy || pages.program),
    holdOrders: Boolean(pages.holdOrders || pages.holds),
    facultyAttendance: Boolean(pages.facultyAttendance || pages.faculty)
  };
}

function stripHtml(value = '') {
  return value
    .replace(/<br\s*\/>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTablesFromHTML(html) {
  const tables = [];
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHTML = tableMatch[0];
    const captionMatch = tableHTML.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    const caption = captionMatch ? stripHtml(captionMatch[1]) : null;

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const parsedRows = [];
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableHTML)) !== null) {
      const rowHTML = rowMatch[1];
      const cellRegex = /<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi;
      const cells = [];
      let cellMatch;
      let isHeaderRow = false;

      while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
        const cellType = (cellMatch[1] || '').toLowerCase();
        if (cellType === 'th') {
          isHeaderRow = true;
        }
        cells.push(stripHtml(cellMatch[2] || ''));
      }

      if (cells.length) {
        parsedRows.push({ cells, isHeaderRow });
      }
    }

    if (parsedRows.length === 0) {
      continue;
    }

    const headerEntry = parsedRows.find(row => row.isHeaderRow) || parsedRows[0];
    const headers = headerEntry.cells;
    const dataRows = parsedRows.filter(row => row !== headerEntry).map(row => row.cells);

    tables.push({
      caption,
      headers,
      rows: dataRows,
      totalRows: dataRows.length
    });
  }

  return tables;
}

// Load persisted state on startup
chrome.storage.local.get('scrapingState', (result) => {
  if (result.scrapingState) {
    scrapingState = createInitialState({
      ...result.scrapingState,
      logs: Array.isArray(result.scrapingState.logs) ? result.scrapingState.logs.slice(-LOG_HISTORY_LIMIT) : [],
      scrapedData: result.scrapingState.scrapedData || {},
      errors: Array.isArray(result.scrapingState.errors) ? result.scrapingState.errors : [],
      harEntries: Array.isArray(result.scrapingState.harEntries) ? result.scrapingState.harEntries : [],
      htmlSnapshots: result.scrapingState.htmlSnapshots || {},
      logsTrimmed:
        Array.isArray(result.scrapingState.logs) && result.scrapingState.logs.length > LOG_HISTORY_LIMIT
          ? true
          : result.scrapingState.logsTrimmed || false
    });
    scrapingState.isRunning = false;
  }
});

// Persist state to storage
function persistState() {
  scrapingState.lastUpdated = new Date().toISOString();
  chrome.storage.local.set({ scrapingState: scrapingState });
}

// Utility: Add log entry
function addLog(message, type = 'info', context = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, message, type, context };
  scrapingState.logs.push(logEntry);
  scrapingState.lastLogAt = timestamp;
  if (scrapingState.logs.length > LOG_HISTORY_LIMIT) {
    scrapingState.logs = scrapingState.logs.slice(-LOG_HISTORY_LIMIT);
    scrapingState.logsTrimmed = true;
  }
  console.log(`[${type.toUpperCase()}] ${message}` + (Object.keys(context || {}).length ? ` ${JSON.stringify(context)}` : ''));

  // Persist state
  persistState();

  // Send update to popup
  chrome.runtime.sendMessage({ 
    action: 'updateProgress', 
    state: scrapingState 
  }).catch(() => {}); // Ignore if popup is closed
}

// Utility: Save HTML snapshot for debugging
function saveHTMLSnapshot(pageName, html) {
  if (!pageName || typeof html !== 'string') {
    return;
  }

  const shouldCapture =
    scrapingState.debugMode ||
    scrapingState.htmlSnapshotOrder.length < MAX_HTML_SNAPSHOTS ||
    scrapingState.htmlSnapshotOrder.includes(pageName);

  if (!shouldCapture) {
    return;
  }

  const truncatedHtml = html.length > MAX_HTML_SNAPSHOT_SIZE
    ? `${html.slice(0, MAX_HTML_SNAPSHOT_SIZE)}\n<!-- truncated -->`
    : html;

  scrapingState.htmlSnapshots[pageName] = {
    timestamp: new Date().toISOString(),
    html: truncatedHtml,
    length: html.length
  };

  const existingIndex = scrapingState.htmlSnapshotOrder.indexOf(pageName);
  if (existingIndex !== -1) {
    scrapingState.htmlSnapshotOrder.splice(existingIndex, 1);
  }
  scrapingState.htmlSnapshotOrder.push(pageName);

  while (scrapingState.htmlSnapshotOrder.length > MAX_HTML_SNAPSHOTS) {
    const removed = scrapingState.htmlSnapshotOrder.shift();
    if (removed && scrapingState.htmlSnapshots[removed]) {
      delete scrapingState.htmlSnapshots[removed];
    }
  }

  addLog(`Saved HTML snapshot for ${pageName} (${html.length} bytes)`, 'debug');
}

// Utility: Add HAR entry
function addHAREntry(
  url,
  method,
  requestHeaders,
  requestBody,
  responseStatus,
  responseStatusText,
  responseHeaders,
  responseBody,
  timing
) {
    const entry = {
      startedDateTime: new Date().toISOString(),
      time: timing || 0,
    request: {
      method: method,
      url: url,
      headers: requestHeaders || [],
      postData: requestBody ? {
        mimeType: 'application/x-www-form-urlencoded',
        text: requestBody
      } : undefined
    },
    response: {
      status: responseStatus,
      statusText: responseStatusText || null,
      headers: responseHeaders || [],
      content: {
        size: responseBody ? responseBody.length : 0,
        mimeType: 'text/html',
        text: responseBody
          ? (responseBody.length > MAX_HAR_BODY_LENGTH
              ? `${responseBody.slice(0, MAX_HAR_BODY_LENGTH)}\n/* truncated */`
              : responseBody)
          : ''
      }
    }
  };

  scrapingState.harEntries.push(entry);
  if (scrapingState.harEntries.length > MAX_HAR_ENTRIES) {
    scrapingState.harEntries = scrapingState.harEntries.slice(-MAX_HAR_ENTRIES);
  }
  addLog(`HAR entry added: ${method} ${url} (${responseStatus})`, 'debug');
}

// Utility: Generate HAR file
function generateHAR() {
  return {
    log: {
      version: '1.2',
      creator: {
        name: 'AISIS Auto Scraper',
        version: '2.1'
      },
      entries: scrapingState.harEntries
    }
  };
}

// Utility: Simple encryption for credentials (Base64 - not secure, but better than plaintext)
function encryptCredentials(username, password) {
  return btoa(JSON.stringify({ username, password }));
}

function decryptCredentials(encrypted) {
  try {
    return JSON.parse(atob(encrypted));
  } catch (e) {
    return null;
  }
}

// Save credentials to storage
async function saveCredentials(username, password) {
  const encrypted = encryptCredentials(username, password);
  await chrome.storage.local.set({ credentials: encrypted });
  addLog('Credentials saved successfully', 'success');
}

// Load credentials from storage
async function loadCredentials() {
  const result = await chrome.storage.local.get('credentials');
  if (result.credentials) {
    return decryptCredentials(result.credentials);
  }
  return null;
}

// Utility: Delay function for rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function recordRequestMetrics({ url, method, status, responseTime, bytes }) {
  if (!scrapingState.metrics) {
    scrapingState.metrics = { ...DEFAULT_METRICS };
  }

  const metrics = scrapingState.metrics;
  metrics.totalRequests += 1;
  metrics.totalResponseTimeMs += responseTime;
  metrics.avgResponseMs = Math.round(metrics.totalResponseTimeMs / metrics.totalRequests);
  metrics.bytesDownloaded += bytes;
  metrics.lastResponseMs = responseTime;
  metrics.lastStatus = status;
  metrics.lastRequestUrl = url;
  metrics.lastRequestMethod = method;
  metrics.lastRequestAt = new Date().toISOString();
  if (responseTime > 5000) {
    metrics.slowResponses += 1;
  }

  persistState();
}

// Utility: Parse HTML response (service worker compatible) - ENHANCED VERSION
function parseHTML(htmlString) {
  // Since DOMParser is not available in service workers, we'll use regex and string methods
  return {
    querySelector: (selector) => {
      // Handle input[name="..."] selector
      const inputMatch = selector.match(/input\[name="([^"]+)"\]/);
      if (inputMatch) {
        const name = inputMatch[1];
        // Try multiple patterns for input fields
        const patterns = [
          new RegExp(`<input[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["']`, 'i'),
          new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i')
        ];
        
        for (const regex of patterns) {
          const match = htmlString.match(regex);
          if (match) return { value: match[1] };
        }
        return null;
      }
      
      // Handle select[name="..."] selector - ENHANCED
      const selectMatch = selector.match(/select\[name="([^"]+)"\]/);
      if (selectMatch) {
        const name = selectMatch[1];
        // More flexible regex that handles various HTML formatting
        const patterns = [
          new RegExp(`<select[^>]*name=["']${name}["'][^>]*>([\\s\\S]*?)<\\/select>`, 'i'),
          new RegExp(`<select[^>]*name=${name}[^>]*>([\\s\\S]*?)<\\/select>`, 'i')
        ];
        
        for (const regex of patterns) {
          const match = htmlString.match(regex);
          if (match) {
            const selectContent = match[1];
            return {
              querySelectorAll: (optionSelector) => {
                const options = [];
                // Enhanced option regex that handles various formats
                const optionPatterns = [
                  /<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)<\/option>/gi,
                  /<option[^>]*value=([^\s>]+)[^>]*>([^<]*)<\/option>/gi,
                  /<option[^>]*>([^<]*)<\/option>/gi
                ];
                
                for (const optionRegex of optionPatterns) {
                  let optionMatch;
                  const tempRegex = new RegExp(optionRegex.source, optionRegex.flags);
                  while ((optionMatch = tempRegex.exec(selectContent)) !== null) {
                    const value = optionMatch[1] || optionMatch[2] || '';
                    const text = optionMatch[2] || optionMatch[1] || '';
                    if (value && text) {
                      options.push({ value: value.trim(), textContent: text.trim() });
                    }
                  }
                  if (options.length > 0) break;
                }
                
                return options;
              },
              querySelector: (selectedOption) => {
                const selectedRegex = /<option[^>]*selected[^>]*value=["']([^"']*)["']/i;
                const selectedMatch = selectContent.match(selectedRegex);
                return selectedMatch ? { value: selectedMatch[1] } : null;
              }
            };
          }
        }
        return null;
      }
      
      // Handle table selector
      if (selector.includes('table')) {
        const tableRegex = /<table[^>]*>([\\s\\S]*?)<\/table>/i;
        const tableMatch = htmlString.match(tableRegex);
        if (tableMatch) {
          return {
            querySelectorAll: (rowSelector) => {
              if (rowSelector === 'tr') {
                const rows = [];
                const rowRegex = /<tr[^>]*>([\\s\\S]*?)<\/tr>/gi;
                let rowMatch;
                while ((rowMatch = rowRegex.exec(tableMatch[1])) !== null) {
                  rows.push({
                    querySelectorAll: (cellSelector) => {
                      const cells = [];
                      const cellRegex = /<td[^>]*>([\\s\\S]*?)<\/td>/gi;
                      let cellMatch;
                      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
                        cells.push({ textContent: cellMatch[1].replace(/<[^>]*>/g, '').trim() });
                      }
                      return cells;
                    }
                  });
                }
                return rows;
              }
              return [];
            }
          };
        }
      }
      
      return null;
    },
    body: {
      textContent: htmlString.replace(/<[^>]*>/g, '').trim()
    },
    // Add method to get raw HTML for debugging
    getRawHTML: () => htmlString
  };
}

// Track request timing for adaptive rate limiting
let lastRequestTime = 0;
let consecutiveSlowRequests = 0;

// Enhanced fetch wrapper with HAR capture with timeout
async function fetchWithHAR(url, options = {}) {
  const startTime = Date.now();
  const method = options.method || 'GET';
  addLog(`Fetching: ${method} ${url}`, 'debug', { url, method });

  // Add timeout to fetch (defaults to 90 seconds for slow AISIS server)
  const timeout = options.timeout || DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Adaptive rate limiting: detect slowdowns
    if (responseTime > 5000) { // If response took more than 5 seconds
      consecutiveSlowRequests++;
      addLog(
        `⚠️ Slow response: ${responseTime}ms (${consecutiveSlowRequests} consecutive slow requests)`,
        'warning',
        { url, method, responseTime, consecutiveSlowRequests }
      );

      if (consecutiveSlowRequests >= 3) {
        // Three consecutive slow requests = likely being rate limited
        const pauseDuration = 45000 + Math.random() * 15000; // 45-60 seconds
        addLog(
          `⏸️ Rate limit detected! Pausing for ${Math.round(pauseDuration/1000)}s...`,
          'warning',
          { url, method, pauseDuration, responseTime }
        );
        scrapingState.currentStep = `⏸️ Paused to avoid rate limiting (${Math.round(pauseDuration/1000)}s)`;
        updateProgress();
        await delay(pauseDuration);
        consecutiveSlowRequests = 0; // Reset counter after pause
        addLog('▶️ Resuming scraping...', 'info', { url, method });
      }
    } else if (responseTime < 2000) {
      // Fast response = reset slow request counter
      consecutiveSlowRequests = 0;
    }

    const responseText = await response.text();
    recordRequestMetrics({
      url,
      method,
      status: response.status,
      responseTime,
      bytes: responseText.length
    });

    // Convert headers to array format for HAR
    const requestHeaders = [];
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        requestHeaders.push({ name: key, value: value });
      }
    }
    
    const responseHeaders = [];
    response.headers.forEach((value, key) => {
      responseHeaders.push({ name: key, value: value });
    });
    
    // Add to HAR
    addHAREntry(
      url,
      options.method || 'GET',
      requestHeaders,
      options.body ? options.body.toString() : null,
      response.status,
      response.statusText,
      responseHeaders,
      responseText,
      responseTime
    );
    
    // Return a response-like object with the text
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      headers: response.headers,
      text: async () => responseText
    };
    
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      addLog(
        `⏱️ Request timeout after ${timeout / 1000}s: ${url}`,
        'error',
        { url, method, timeoutMs: timeout, timeoutSeconds: timeout / 1000 }
      );
      recordRequestMetrics({
        url,
        method,
        status: 'timeout',
        responseTime: timeout,
        bytes: 0
      });
      throw new Error(`Request timeout after ${timeout / 1000}s`);
    }
    addLog(`❌ Fetch error for ${url}: ${error.message}`, 'error', { url, method });
    recordRequestMetrics({
      url,
      method,
      status: 'error',
      responseTime: Date.now() - startTime,
      bytes: 0
    });
    throw error;
  }
}

// Rest of the background.js code will be appended...
// Login to AISIS with retry logic
async function login(username, password, retryCount = 0) {
  const maxRetries = 3;
  scrapingState.currentPage = 'login';
  addLog('Starting login process...', 'info', { step: 'login', attempt: retryCount + 1 });

  try {
    // Step 1: Get login page to acquire cookies
    if (retryCount > 0) {
      addLog(`Retry attempt ${retryCount}/${maxRetries}...`, 'warning', { step: 'login', attempt: retryCount + 1 });
    }
    addLog('Fetching login page...', 'info', { step: 'login', page: 'displayLogin.do' });
    addLog('Sending GET request to displayLogin.do', 'debug', { step: 'login', page: 'displayLogin.do' });
    
    const loginPageResponse = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/displayLogin.do', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      credentials: 'include'
    });
    
    addLog(`Login page response: ${loginPageResponse.status} ${loginPageResponse.statusText}`, 'debug', {
      step: 'login',
      page: 'displayLogin.do',
      status: loginPageResponse.status
    });
    
    if (!loginPageResponse.ok) {
      throw new Error(`Failed to load login page: ${loginPageResponse.status}`);
    }
    
    addLog('Parsing login page HTML...', 'debug', { step: 'login' });
    const loginPageHTML = await loginPageResponse.text();
    addLog(`Received ${loginPageHTML.length} bytes of HTML`, 'debug', { step: 'login', bytes: loginPageHTML.length });
    saveHTMLSnapshot('login_page', loginPageHTML);
    const doc = parseHTML(loginPageHTML);
    
    // Try to extract 'rnd' token if it exists
    let rndToken = '';
    const rndInput = doc.querySelector('input[name="rnd"]');
    if (rndInput) {
      rndToken = rndInput.value;
      addLog(`Extracted rnd token: ${rndToken.substring(0, 10)}...`, 'debug', { step: 'login' });
    } else {
      addLog('No rnd token found in login page', 'debug', { step: 'login' });
    }

    // Step 2: Submit login credentials
    addLog('Submitting credentials...', 'info', { step: 'login' });
    const formData = new URLSearchParams();
    formData.append('userName', username);
    formData.append('password', password);
    formData.append('command', 'login');
    formData.append('submit', 'Sign in');
    if (rndToken) {
      formData.append('rnd', rndToken);
    }
    
    addLog('Sending POST request to login.do...', 'debug', { step: 'login', page: 'login.do' });
    const loginResponse = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/login.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://aisis.ateneo.edu',
        'Referer': 'https://aisis.ateneo.edu/j_aisis/displayLogin.do',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1'
      },
      body: formData,
      credentials: 'include',
      redirect: 'follow'
    });
    
    addLog(`Login response: ${loginResponse.status} ${loginResponse.statusText}`, 'debug', {
      step: 'login',
      page: 'login.do',
      status: loginResponse.status
    });
    addLog(`Redirected to: ${loginResponse.url}`, 'debug', { step: 'login', page: 'login.do' });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    addLog('Reading login response...', 'debug', { step: 'login' });
    const responseText = await loginResponse.text();
    addLog(`Received ${responseText.length} bytes`, 'debug', { step: 'login', bytes: responseText.length });
    saveHTMLSnapshot('login_response', responseText);
    
    // Check if login was successful (look for welcome page or specific content)
    if (responseText.includes('welcome') || loginResponse.url.includes('welcome.do')) {
      addLog('Login successful!', 'success', { step: 'login' });
      return true;
    } else {
      throw new Error('Login failed: Invalid credentials or unexpected response');
    }
    
  } catch (error) {
    addLog(`Login error: ${error.message}`, 'error', { step: 'login', error: error.message });
    
    // Retry logic with exponential backoff
    if (retryCount < maxRetries && (error.message.includes('timeout') || error.message.includes('network'))) {
      const backoffDelay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
      addLog(`⏳ Waiting ${backoffDelay/1000}s before retry...`, 'warning', { step: 'login', backoffDelay });
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return await login(username, password, retryCount + 1);
    }
    
    scrapingState.errors.push({ step: 'login', error: error.message });
    return false;
  }
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveCredentials') {
    saveCredentials(request.username, request.password)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'loadCredentials') {
    loadCredentials()
      .then(creds => sendResponse({ success: true, credentials: creds }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'startScraping') {
    startScraping(request.options)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getState') {
    sendResponse({ state: scrapingState });
    return true;
  }
  
  if (request.action === 'stopScraping') {
    if (!scrapingState.isPaused) {
      scrapingState.isRunning = false;
      scrapingState.isPaused = true;
      addLog('⏸️ Scraping paused - you can resume or export data', 'warning');
      persistState();
    }
    sendResponse({ success: true, paused: true });
    return true;
  }
  
  if (request.action === 'hardStopScraping') {
    scrapingState.isRunning = false;
    scrapingState.isPaused = false;
    scrapingState.isCompleted = true;
    addLog('Scraping terminated - cannot resume', 'error');
    sendResponse({ success: true, terminated: true });
    return true;
  }
  
  if (request.action === 'resumeScraping') {
    if (scrapingState.isPaused) {
      scrapingState.isRunning = true;
      scrapingState.isPaused = false;
      addLog('Resuming scraping...', 'info');
      // Resume from where we left off
      if (scrapingState.currentPage === 'scheduleOfClasses') {
        continueScheduleScraping();
      } else if (scrapingState.currentPage === 'officialCurriculum') {
        continueCurriculumScraping();
      }
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Not in paused state' });
    }
    return true;
  }
  
  if (request.action === 'exportHAR') {
    const har = generateHAR();
    sendResponse({ success: true, har: har });
    return true;
  }
  
  if (request.action === 'exportHTMLSnapshots') {
    sendResponse({ success: true, snapshots: scrapingState.htmlSnapshots });
    return true;
  }
  
  if (request.action === 'deleteLogs') {
    // Only clear logs, keep session and data
    scrapingState.logs = [];
    scrapingState.logsTrimmed = false;
    scrapingState.lastLogAt = null;
    persistState();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'clearLogs') {
    scrapingState.logs = [];
    scrapingState.harEntries = [];
    scrapingState.htmlSnapshots = {};
    scrapingState.logsTrimmed = false;
    scrapingState.lastLogAt = null;
    persistState();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'clearAllData') {
    // Reset everything to initial state
    scrapingState = createInitialState();
    persistState();
    sendResponse({ success: true });
    return true;
  }
});

// ============================================================================
// SCRAPING ENGINE
// ============================================================================

// Main scraping orchestrator
async function startScraping(options) {
  if (scrapingState.isRunning) {
    addLog('Scraping already in progress', 'warning');
    return;
  }

  // Generate or keep existing session ID
  const sessionId = scrapingState.sessionId || generateSessionId();

  const pages = normalizePageSelection((options && options.pages) || {});
  const selectedPageKeys = Object.keys(pages).filter(key => pages[key]);

  // Reset state
  scrapingState = createInitialState({
    isRunning: true,
    sessionId: sessionId,
    progress: 0,
    currentStep: 'Initializing...',
    currentPage: 'initializing',
    totalSteps: 0,
    completedSteps: 0,
    startTime: Date.now(),
    startedAt: new Date().toISOString(),
    scrapedData: {},
    errors: [],
    harEntries: [],
    htmlSnapshots: {},
    selectedPages: options.pages
  });

  addLog('=== AISIS Scraping Started ===', 'info', { sessionId, step: 'bootstrap' });
  addLog(
    `Selected pages: ${Object.keys(options.pages).filter(k => options.pages[k]).join(', ')}`,
    'info',
    { step: 'bootstrap', pages: options.pages }
  );
  
  try {
    // Step 1: Login
    scrapingState.currentStep = 'Logging in...';
    const credentials = await loadCredentials();
    
    if (!credentials) {
      throw new Error('No credentials found. Please save your credentials first.');
    }
    
    const loginSuccess = await login(credentials.username, credentials.password);
    if (!loginSuccess) {
      throw new Error('Login failed. Please check your credentials.');
    }
    
    scrapingState.completedSteps++;
    updateProgress();
    
    // Calculate total steps
    scrapingState.totalSteps = selectedPageKeys.length + 1; // +1 for login

    // Step 2: Scrape selected pages
    if (pages.scheduleOfClasses) {
      await scrapeScheduleOfClasses();
    }

    if (pages.officialCurriculum) {
      await scrapeOfficialCurriculum();
    }

    if (pages.grades) {
      await scrapeGrades();
    }

    if (pages.advisoryGrades) {
      await scrapeAdvisoryGrades();
    }

    if (pages.enrolledClasses) {
      await scrapeEnrolledClasses();
    }

    if (pages.classSchedule) {
      await scrapeClassSchedule();
    }

    if (pages.tuitionReceipt) {
      await scrapeTuitionReceipt();
    }

    if (pages.studentInfo) {
      await scrapeStudentInfo();
    }

    if (pages.programOfStudy) {
      await scrapeProgramOfStudy();
    }

    if (pages.holdOrders) {
      await scrapeHoldOrders();
    }

    if (pages.facultyAttendance) {
      await scrapeFacultyAttendance();
    }
    
    // Scraping complete
    scrapingState.isRunning = false;
    scrapingState.isCompleted = true;
    scrapingState.isPaused = false;
    scrapingState.progress = 100;
    scrapingState.currentStep = 'Scraping complete!';
    scrapingState.completedAt = new Date().toISOString();
    addLog('=== Scraping Completed Successfully ===', 'success', { sessionId, step: 'complete' });

    // Persist final state
    persistState();
    
    // Send final update
    chrome.runtime.sendMessage({ 
      action: 'scrapingComplete', 
      state: scrapingState 
    }).catch(() => {});
    
  } catch (error) {
    scrapingState.isRunning = false;
    scrapingState.currentStep = `Error: ${error.message}`;
    scrapingState.completedAt = new Date().toISOString();
    addLog(`Fatal error: ${error.message}`, 'error', { step: 'main', sessionId, error: error.message });
    scrapingState.errors.push({ step: 'main', error: error.message });

    chrome.runtime.sendMessage({
      action: 'scrapingError', 
      state: scrapingState 
    }).catch(() => {});
  }
}

// Update progress percentage
function updateProgress() {
  if (scrapingState.totalSteps > 0) {
    scrapingState.progress = Math.round((scrapingState.completedSteps / scrapingState.totalSteps) * 100);
  }
  
  // Send update to popup
  chrome.runtime.sendMessage({
    action: 'updateProgress',
    state: scrapingState
  }).catch(() => {});
  
  // Persist state
  persistState();
}

// Scrape Schedule of Classes
async function scrapeScheduleOfClasses() {
  scrapingState.currentPage = 'scheduleOfClasses';
  scrapingState.currentStep = 'Scraping Schedule of Classes...';
  addLog('Starting Schedule of Classes scrape', 'info', { step: 'scheduleOfClasses' });
  
  try {
    // Step 1: Load the page to get available departments
    const pageResponse = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/J_VCSC.do', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://aisis.ateneo.edu/j_aisis/welcome.do',
        'Connection': 'keep-alive'
      },
      credentials: 'include'
    });
    
    if (!pageResponse.ok) {
      throw new Error(`Failed to load J_VCSC.do: ${pageResponse.status}`);
    }
    
    const pageHTML = await pageResponse.text();
    const doc = parseHTML(pageHTML);
    
    // Extract department codes from dropdown
    const deptSelect = doc.querySelector('select[name="deptCode"]');
    const departments = [];
    
    if (deptSelect) {
      const options = deptSelect.querySelectorAll('option');
      options.forEach(opt => {
        const value = opt.value;
        if (value && value !== 'ALL' && value !== '') {
          departments.push(value);
        }
      });
      addLog(`Found ${departments.length} departments`, 'info', { step: 'scheduleOfClasses' });
    } else {
      addLog('Could not find department dropdown', 'warning', { step: 'scheduleOfClasses' });
    }
    
    // Extract applicable period (semester)
    let applicablePeriod = '2025-1'; // Default
    const periodSelect = doc.querySelector('select[name="applicablePeriod"]');
    if (periodSelect) {
      const selectedOption = periodSelect.querySelector('option[selected]');
      if (selectedOption) {
        applicablePeriod = selectedOption.value;
      }
    }
    
    addLog(`Using period: ${applicablePeriod}`, 'info', { step: 'scheduleOfClasses', period: applicablePeriod });
    
    // Step 2: Scrape each department
    scrapingState.scrapedData.scheduleOfClasses = [];
    updateDatasetProgress('scheduleOfClasses', {
      label: formatDatasetLabel('scheduleOfClasses'),
      completed: 0,
      total: departments.length,
      items: 0
    });
    updateProgress();
    
    for (let i = 0; i < departments.length; i++) {
      if (!scrapingState.isRunning) {
        addLog('Scraping stopped by user', 'warning', { step: 'scheduleOfClasses' });
        break;
      }

      const dept = departments[i];
      scrapingState.currentStep = `Scraping ${dept} schedule (${i + 1}/${departments.length})...`;
      addLog(`Fetching schedule for department: ${dept}`, 'info', {
        step: 'scheduleOfClasses',
        department: dept,
        index: i + 1,
        total: departments.length
      });
      
      try {
        const formData = new URLSearchParams();
        formData.append('applicablePeriod', applicablePeriod);
        formData.append('command', 'displayResults');
        formData.append('deptCode', dept);
        formData.append('subjCode', 'ALL');
        
        const response = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/J_VCSC.do', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://aisis.ateneo.edu',
          'Referer': 'https://aisis.ateneo.edu/j_aisis/J_VCSC.do',
          'Connection': 'keep-alive'
        },
        body: formData,
        credentials: 'include'
      });
      
        if (response.ok) {
          const html = await response.text();
          saveHTMLSnapshot(`schedule_${dept}`, html);
          const scheduleDoc = parseHTML(html);
          
          // Parse the schedule table - find the correct table by looking for "Subject Code" header
          const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
          let tableMatch;
          let dataTable = null;
          
          while ((tableMatch = tableRegex.exec(html)) !== null) {
            const tableHTML = tableMatch[0];
            // Check if this table contains "Subject Code" header
            if (/Subject Code/i.test(tableHTML)) {
              dataTable = tableHTML;
              break;
            }
          }
          
          if (dataTable) {
            // Extract rows from the data table
            const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
            let rowMatch;
            let classCount = 0;
            let isFirstRow = true;
            
            while ((rowMatch = rowRegex.exec(dataTable)) !== null) {
              if (isFirstRow) {
                isFirstRow = false;
                continue; // Skip header row
              }
              
              const rowHTML = rowMatch[1];
              const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
              const cells = [];
              let cellMatch;
              
              while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
                const cellContent = cellMatch[1].replace(/<[^>]*>/g, '').trim();
                cells.push(cellContent);
              }
              
              // Expected columns: Subject Code, Section, Course Title, Units, Time, Room, Instructor, Max No, Lang, Level, Free Slots, Remarks, S, P
              if (cells.length >= 7) {
                const classData = {
                  department: dept,
                  subjectCode: cells[0] || '',
                  section: cells[1] || '',
                  courseTitle: cells[2] || '',
                  units: cells[3] || '',
                  time: cells[4] || '',
                  room: cells[5] || '',
                  instructor: cells[6] || '',
                  maxNo: cells[7] || '',
                  lang: cells[8] || '',
                  level: cells[9] || '',
                  freeSlots: cells[10] || '',
                  remarks: cells[11] || '',
                  s: cells[12] || '',
                  p: cells[13] || ''
                };
                scrapingState.scrapedData.scheduleOfClasses.push(classData);
                classCount++;
              }
            }
            
            addLog(`Scraped ${classCount} classes from ${dept}`, 'success', {
              step: 'scheduleOfClasses',
              department: dept,
              items: classCount
            });
          } else {
            addLog(`No schedule table found for ${dept}`, 'warning', { step: 'scheduleOfClasses', department: dept });
          }
        } else {
          addLog(`Failed to fetch ${dept}: ${response.status}`, 'error', {
            step: 'scheduleOfClasses',
            department: dept,
            status: response.status
          });
        }
      } catch (deptError) {
        addLog(`Error processing ${dept}: ${deptError.message}`, 'error', {
          step: 'scheduleOfClasses',
          department: dept,
          error: deptError.message
        });
        scrapingState.errors.push({ step: `schedule_${dept}`, error: deptError.message });
        updateDatasetProgress('scheduleOfClasses', {
          completed: i + 1,
          total: departments.length,
          items: scrapingState.scrapedData.scheduleOfClasses.length,
          detail: `${dept} (error)`
        });
        updateProgress();
      }
      
      // Rate limiting: wait 2-4 seconds between requests to avoid throttling
      await delay(2000 + Math.random() * 2000);
    }
    
    addLog(`Total classes scraped: ${scrapingState.scrapedData.scheduleOfClasses.length}`, 'success', {
      step: 'scheduleOfClasses',
      total: scrapingState.scrapedData.scheduleOfClasses.length
    });
    scrapingState.completedSteps++;
    updateProgress();

  } catch (error) {
    addLog(`Error scraping schedule: ${error.message}`, 'error', { step: 'scheduleOfClasses', error: error.message });
    scrapingState.errors.push({ step: 'scheduleOfClasses', error: error.message });
  }
}

// Scrape Official Curriculum
async function scrapeOfficialCurriculum() {
  scrapingState.currentPage = 'officialCurriculum';
  scrapingState.currentStep = 'Scraping Official Curriculum...';
  addLog('Starting Official Curriculum scrape', 'info', { step: 'officialCurriculum' });
  
  try {
    // Step 1: Load the page to get available degree codes
    const pageResponse = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/J_VOFC.do', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://aisis.ateneo.edu/j_aisis/welcome.do',
        'Connection': 'keep-alive'
      },
      credentials: 'include'
    });
    
    if (!pageResponse.ok) {
      throw new Error(`Failed to load J_VOFC.do: ${pageResponse.status}`);
    }
    
    const pageHTML = await pageResponse.text();
    const doc = parseHTML(pageHTML);
    
    // Extract degree codes from dropdown
    const degSelect = doc.querySelector('select[name="degCode"]');
    const degreeCodes = [];
    
    if (degSelect) {
      const options = degSelect.querySelectorAll('option');
      options.forEach(opt => {
        const value = opt.value;
        if (value && value !== '') {
          degreeCodes.push({ code: value, name: opt.textContent.trim() });
        }
      });
      addLog(`Found ${degreeCodes.length} degree programs`, 'info', { step: 'officialCurriculum' });
    } else {
      addLog('Could not find degree code dropdown', 'warning', { step: 'officialCurriculum' });
    }
    
    // Step 2: Scrape each degree program
    scrapingState.scrapedData.officialCurriculum = [];
    updateDatasetProgress('officialCurriculum', {
      label: formatDatasetLabel('officialCurriculum'),
      completed: 0,
      total: degreeCodes.length,
      items: 0
    });
    updateProgress();
    
    for (let i = 0; i < degreeCodes.length; i++) {
      if (!scrapingState.isRunning) {
        addLog('Scraping stopped by user', 'warning', { step: 'officialCurriculum' });
        break;
      }

      const degree = degreeCodes[i];
      scrapingState.currentStep = `Scraping ${degree.name} (${i + 1}/${degreeCodes.length})...`;
      addLog(`Fetching curriculum for: ${degree.name}`, 'info', {
        step: 'officialCurriculum',
        degree: degree.code,
        name: degree.name,
        index: i + 1,
        total: degreeCodes.length
      });
      
      const formData = new URLSearchParams();
      formData.append('degCode', degree.code);
      
      const response = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/J_VOFC.do', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://aisis.ateneo.edu',
          'Referer': 'https://aisis.ateneo.edu/j_aisis/J_VOFC.do',
          'Connection': 'keep-alive'
        },
        body: formData,
        credentials: 'include'
      });
      
      try {
        if (response.ok) {
          const html = await response.text();
          if (scrapingState.debugMode || i < 5) {
            saveHTMLSnapshot(`curriculum_${degree.code}`, html);
          }
          
          // Parse the curriculum table - find tables with "Course Title" header
          const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
          let tableMatch;
          let courseCount = 0;
          
          while ((tableMatch = tableRegex.exec(html)) !== null) {
            const tableHTML = tableMatch[0];
            
            // Check if this table contains "Course Title"
            if (/Course Title/i.test(tableHTML)) {
              // Extract rows from this table
              const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
              let rowMatch;
              let isHeaderRow = true;
              let columnHeaderRow = true; // The first data row is actually column headers
              
              while ((rowMatch = rowRegex.exec(tableHTML)) !== null) {
                if (isHeaderRow) {
                  isHeaderRow = false;
                  continue; // Skip the semester header row
                }
                
                if (columnHeaderRow) {
                  columnHeaderRow = false;
                  continue; // Skip the column header row (Cat No, Course Title, etc.)
                }
                
                const rowHTML = rowMatch[1];
                const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
                const cells = [];
                let cellMatch;
                
                while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
                  const cellContent = cellMatch[1].replace(/<[^>]*>/g, '').trim();
                  cells.push(cellContent);
                }
                
                // Expected columns: Cat No, Course Title, Units, Prerequisites, Category
                if (cells.length >= 2) {
                  const courseData = {
                    degreeProgram: degree.name,
                    degreeCode: degree.code,
                    catNo: cells[0] || '',
                    courseTitle: cells[1] || '',
                    units: cells[2] || '',
                    prerequisites: cells[3] || '',
                    category: cells[4] || ''
                  };
                  scrapingState.scrapedData.officialCurriculum.push(courseData);
                  courseCount++;
                }
              }
            }
          }
          
          if (courseCount > 0) {
            addLog(`Scraped ${courseCount} courses from ${degree.name}`, 'success', {
              step: 'officialCurriculum',
              degree: degree.code,
              name: degree.name,
              items: courseCount
            });
          } else {
            addLog(`No curriculum table found for ${degree.name}`, 'warning', {
              step: 'officialCurriculum',
              degree: degree.code,
              name: degree.name
            });
          }
        } else {
          addLog(`Failed to fetch ${degree.name}: ${response.status}`, 'error', {
            step: 'officialCurriculum',
            degree: degree.code,
            name: degree.name,
            status: response.status
          });
        }
      } catch (degError) {
        addLog(`Error processing ${degree.name}: ${degError.message}`, 'error', {
          step: 'officialCurriculum',
          degree: degree.code,
          name: degree.name,
          error: degError.message
        });
        scrapingState.errors.push({ step: `curriculum_${degree.code}`, error: degError.message });
        updateDatasetProgress('officialCurriculum', {
          completed: i + 1,
          total: degreeCodes.length,
          items: scrapingState.scrapedData.officialCurriculum.length,
          detail: `${degree.name} (error)`
        });
        updateProgress();
      }
      
      // Rate limiting: wait 2-4 seconds between requests to avoid throttling
      await delay(2000 + Math.random() * 2000);
    }
    
    addLog(`Total courses scraped: ${scrapingState.scrapedData.officialCurriculum.length}`, 'success', {
      step: 'officialCurriculum',
      total: scrapingState.scrapedData.officialCurriculum.length
    });
    scrapingState.completedSteps++;
    updateProgress();

  } catch (error) {
    addLog(`Error scraping curriculum: ${error.message}`, 'error', { step: 'officialCurriculum', error: error.message });
    scrapingState.errors.push({ step: 'officialCurriculum', error: error.message });
  }
}

// Simple GET page scrapers
async function scrapeSimplePage(url, pageName, dataKey) {
  scrapingState.currentPage = dataKey;
  scrapingState.currentStep = `Scraping ${pageName}...`;
  addLog(`Starting ${pageName} scrape`, 'info', { step: dataKey, pageName, url });
  
  try {
    const response = await fetchWithHAR(url, { 
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://aisis.ateneo.edu/j_aisis/welcome.do',
        'Connection': 'keep-alive'
      },
      credentials: 'include' 
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load ${pageName}: ${response.status}`);
    }
    
    const html = await response.text();
    if (scrapingState.debugMode) {
      saveHTMLSnapshot(dataKey, html);
    }

    const tables = extractTablesFromHTML(html);
    const totalRows = tables.reduce((sum, table) => sum + (table.totalRows || 0), 0);
    const truncatedHtml = html.length > MAX_HTML_SNAPSHOT_SIZE
      ? `${html.slice(0, MAX_HTML_SNAPSHOT_SIZE)}\n<!-- truncated -->`
      : html;

    scrapingState.scrapedData[dataKey] = {
      html: truncatedHtml,
      text: stripHtml(html),
      tables,
      capturedAt: new Date().toISOString()
    };
    
    addLog(`${pageName} scraped successfully`, 'success', { step: dataKey, pageName });
    scrapingState.completedSteps++;
    updateProgress();

    await delay(1000);

  } catch (error) {
    addLog(`Error scraping ${pageName}: ${error.message}`, 'error', { step: dataKey, pageName, error: error.message });
    scrapingState.errors.push({ step: dataKey, error: error.message });
    updateDatasetProgress(dataKey, {
      label: pageName,
      completed: 0,
      total: 1,
      items: 0,
      detail: `Error: ${error.message}`
    });
    updateProgress();
  }
}

// Individual page scrapers
async function scrapeGrades() {
  const dataKey = 'grades';
  scrapingState.currentPage = dataKey;
  addLog('Fetching grades page...', 'info', { step: dataKey });
  
  try {
    const response = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/J_VG.do');
    const html = await response.text();
    
    // Parse grades from HTML table
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('table tr');
    
    const grades = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td.text02');
      if (cells.length >= 6) {
        grades.push({
          schoolYear: cells[0]?.textContent.trim() || '',
          semester: cells[1]?.textContent.trim() || '',
          program: cells[2]?.textContent.trim() || '',
          courseCode: cells[3]?.textContent.trim() || '',
          courseTitle: cells[4]?.textContent.trim() || '',
          units: cells[5]?.textContent.trim() || '',
          grade: cells[6]?.textContent.trim() || ''
        });
      }
    });
    
    scrapingState.scrapedData[dataKey] = grades;
    addLog(`Scraped ${grades.length} grade entries`, 'success', { step: dataKey, total: grades.length });
    updateProgress();
  } catch (error) {
    addLog(`Error scraping grades: ${error.message}`, 'error', { step: dataKey, error: error.message });
    scrapingState.errors.push({ step: dataKey, error: error.message });
  }
}

async function scrapeAdvisoryGrades() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_VADGR.do', 'Advisory Grades', 'advisoryGrades');
}

async function scrapeEnrolledClasses() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_VCEC.do', 'Enrolled Classes', 'enrolledClasses');
}

async function scrapeClassSchedule() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_VMCS.do', 'Class Schedule', 'classSchedule');
}

async function scrapeTuitionReceipt() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_PTR.do', 'Tuition Receipt', 'tuitionReceipt');
}

async function scrapeStudentInfo() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_STUD_INFO.do', 'Student Info', 'studentInfo');
}

async function scrapeProgramOfStudy() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_VIPS.do', 'Program of Study', 'programOfStudy');
}

async function scrapeHoldOrders() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_VHOR.do', 'Hold Orders', 'holdOrders');
}

async function scrapeFacultyAttendance() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_IFAT.do', 'Faculty Attendance', 'facultyAttendance');
}
