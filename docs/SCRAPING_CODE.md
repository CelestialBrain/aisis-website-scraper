# AISIS Scraping Code - Raw Implementation

This document contains the core scraping logic extracted from the AISIS Dashboard Chrome Extension. This code can be adapted for server-side scraping or integrated into other applications.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [HTTP Request Utilities](#http-request-utilities)
4. [HTML Parsing](#html-parsing)
5. [Page Scrapers](#page-scrapers)
6. [Data Extraction](#data-extraction)
7. [Complete Code](#complete-code)

---

## Overview

### Architecture

The scraper uses a **session-based authentication** approach:

1. **GET** login page → Extract CSRF token (`rnd`)
2. **POST** credentials → Establish authenticated session
3. **GET** target pages → Scrape data using session cookies
4. **Parse** HTML → Extract structured data

### Key Features

- **Session management** with cookies
- **CSRF token extraction** from login page
- **Retry logic** for failed requests
- **HTML parsing** without DOM (service worker compatible)
- **HAR file generation** for debugging
- **Progress tracking** and logging

### Technologies

- **Fetch API** for HTTP requests
- **URLSearchParams** for form data
- **Regex** for HTML parsing (no DOMParser in service workers)
- **Chrome Storage API** for persistence

---

## Authentication Flow

### Step 1: Get Login Page

```javascript
// Fetch the login page to acquire session cookies and CSRF token
async function getLoginPage() {
  const response = await fetch('https://aisis.ateneo.edu/j_aisis/displayLogin.do', {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    },
    credentials: 'include' // Important: Include cookies
  });
  
  if (!response.ok) {
    throw new Error(`Failed to load login page: ${response.status}`);
  }
  
  const html = await response.text();
  return html;
}
```

### Step 2: Extract CSRF Token

```javascript
// Parse HTML to extract the 'rnd' token (CSRF protection)
function extractRndToken(html) {
  // Look for: <input type="hidden" name="rnd" value="...">
  const rndMatch = html.match(/<input[^>]*name=["']rnd["'][^>]*value=["']([^"']+)["']/i);
  
  if (rndMatch && rndMatch[1]) {
    return rndMatch[1];
  }
  
  // Alternative pattern
  const altMatch = html.match(/<input[^>]*value=["']([^"']+)["'][^>]*name=["']rnd["']/i);
  if (altMatch && altMatch[1]) {
    return altMatch[1];
  }
  
  return ''; // Token may not always be present
}
```

### Step 3: Submit Login Credentials

```javascript
// Submit username and password to authenticate
async function login(username, password) {
  // Step 1: Get login page
  const loginPageHTML = await getLoginPage();
  
  // Step 2: Extract CSRF token
  const rndToken = extractRndToken(loginPageHTML);
  
  // Step 3: Prepare form data
  const formData = new URLSearchParams();
  formData.append('userName', username);
  formData.append('password', password);
  formData.append('command', 'login');
  formData.append('submit', 'Sign in');
  
  if (rndToken) {
    formData.append('rnd', rndToken);
  }
  
  // Step 4: Submit login
  const response = await fetch('https://aisis.ateneo.edu/j_aisis/login.do', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Origin': 'https://aisis.ateneo.edu',
      'Referer': 'https://aisis.ateneo.edu/j_aisis/displayLogin.do',
      'Connection': 'keep-alive'
    },
    body: formData,
    credentials: 'include', // Important: Maintain session cookies
    redirect: 'follow'
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }
  
  const responseText = await response.text();
  
  // Step 5: Verify login success
  if (responseText.includes('welcome') || response.url.includes('welcome.do')) {
    console.log('Login successful!');
    return true;
  } else if (responseText.includes('error') || responseText.includes('invalid')) {
    throw new Error('Invalid credentials');
  } else {
    throw new Error('Login verification failed');
  }
}
```

### Login with Retry Logic

```javascript
// Login with automatic retry on failure
async function loginWithRetry(username, password, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${maxRetries}...`);
        await sleep(2000); // Wait 2 seconds before retry
      }
      
      const success = await login(username, password);
      if (success) {
        return true;
      }
    } catch (error) {
      console.error(`Login attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt === maxRetries - 1) {
        throw new Error(`Login failed after ${maxRetries} attempts: ${error.message}`);
      }
    }
  }
  
  return false;
}

// Utility: Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## HTTP Request Utilities

### Fetch with Timeout

```javascript
// Fetch with timeout to prevent hanging requests
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}
```

### Fetch Authenticated Page

```javascript
// Fetch a page using the authenticated session
async function fetchAuthenticatedPage(url) {
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      'Referer': 'https://aisis.ateneo.edu/j_aisis/welcome.do'
    },
    credentials: 'include' // Use session cookies
  }, 30000);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  
  const html = await response.text();
  return html;
}
```

---

## HTML Parsing

Since the Chrome Extension runs in a service worker (where `DOMParser` is not available), we use regex-based parsing. For server-side implementations, you can use libraries like `cheerio` (Node.js) or `BeautifulSoup` (Python).

### Regex-Based Parser (Service Worker Compatible)

```javascript
// Parse HTML using regex (no DOM required)
function parseHTML(htmlString) {
  return {
    // Find first element matching selector
    querySelector: (selector) => {
      // Handle input[name="..."] selector
      const inputMatch = selector.match(/input\[name=["']([^"']+)["']\]/);
      if (inputMatch) {
        const name = inputMatch[1];
        const regex = new RegExp(
          `<input[^>]*name=["']${name}["'][^>]*value=["']([^"']+)["']`,
          'i'
        );
        const match = htmlString.match(regex);
        if (match) {
          return { value: match[1] };
        }
        
        // Try alternative pattern
        const altRegex = new RegExp(
          `<input[^>]*value=["']([^"']+)["'][^>]*name=["']${name}["']`,
          'i'
        );
        const altMatch = htmlString.match(altRegex);
        if (altMatch) {
          return { value: altMatch[1] };
        }
      }
      
      return null;
    },
    
    // Find all elements matching selector
    querySelectorAll: (selector) => {
      const results = [];
      
      // Handle table row selector
      if (selector === 'tr' || selector === 'table tr') {
        const regex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let match;
        
        while ((match = regex.exec(htmlString)) !== null) {
          results.push({
            innerHTML: match[1],
            textContent: match[1].replace(/<[^>]+>/g, '').trim()
          });
        }
      }
      
      return results;
    },
    
    // Get inner HTML
    get innerHTML() {
      return htmlString;
    },
    
    // Get text content
    get textContent() {
      return htmlString.replace(/<[^>]+>/g, '').trim();
    }
  };
}
```

### Extract Table Data

```javascript
// Extract data from HTML table
function extractTableData(html) {
  const rows = [];
  
  // Find all table rows
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHTML = trMatch[1];
    const cells = [];
    
    // Find all cells (td or th)
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch;
    
    while ((tdMatch = tdRegex.exec(rowHTML)) !== null) {
      const cellHTML = tdMatch[1];
      // Remove HTML tags and clean whitespace
      const cellText = cellHTML
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      cells.push(cellText);
    }
    
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  
  return rows;
}
```

---

## Page Scrapers

### AISIS Page URLs

```javascript
const AISIS_URLS = {
  login: 'https://aisis.ateneo.edu/j_aisis/displayLogin.do',
  loginSubmit: 'https://aisis.ateneo.edu/j_aisis/login.do',
  welcome: 'https://aisis.ateneo.edu/j_aisis/welcome.do',
  
  // Student pages
  scheduleOfClasses: 'https://aisis.ateneo.edu/j_aisis/J_VSOC.do',
  officialCurriculum: 'https://aisis.ateneo.edu/j_aisis/J_VOFC.do',
  viewGrades: 'https://aisis.ateneo.edu/j_aisis/J_VGRD.do',
  advisoryGrades: 'https://aisis.ateneo.edu/j_aisis/J_VADGR.do',
  enrolledClasses: 'https://aisis.ateneo.edu/j_aisis/J_VCEC.do',
  classSchedule: 'https://aisis.ateneo.edu/j_aisis/J_VMCS.do',
  tuitionReceipt: 'https://aisis.ateneo.edu/j_aisis/J_PTR.do',
  studentInfo: 'https://aisis.ateneo.edu/j_aisis/J_STUD_INFO.do',
  programOfStudy: 'https://aisis.ateneo.edu/j_aisis/J_VIPS.do',
  holdOrders: 'https://aisis.ateneo.edu/j_aisis/J_VHOR.do',
  facultyAttendance: 'https://aisis.ateneo.edu/j_aisis/J_IFAT.do'
};
```

### Generic Page Scraper

```javascript
// Scrape a simple page (just fetch HTML)
async function scrapeSimplePage(url, pageName) {
  console.log(`Scraping ${pageName}...`);
  
  try {
    const html = await fetchAuthenticatedPage(url);
    console.log(`Successfully scraped ${pageName} (${html.length} bytes)`);
    
    return {
      pageName: pageName,
      url: url,
      html: html,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Failed to scrape ${pageName}:`, error.message);
    throw error;
  }
}
```

### Scrape Grades

```javascript
// Scrape and parse grades page
async function scrapeGrades() {
  console.log('Scraping grades...');
  
  const html = await fetchAuthenticatedPage(AISIS_URLS.viewGrades);
  const tableData = extractTableData(html);
  
  // Parse grades from table
  const grades = [];
  
  // Skip header row (index 0)
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    
    if (row.length >= 6) {
      grades.push({
        schoolYear: row[0] || '',
        semester: row[1] || '',
        courseCode: row[2] || '',
        courseTitle: row[3] || '',
        units: row[4] || '',
        grade: row[5] || ''
      });
    }
  }
  
  console.log(`Extracted ${grades.length} grade entries`);
  
  return {
    pageName: 'Grades',
    url: AISIS_URLS.viewGrades,
    data: grades,
    timestamp: new Date().toISOString()
  };
}
```

### Scrape Schedule

```javascript
// Scrape and parse class schedule
async function scrapeSchedule() {
  console.log('Scraping class schedule...');
  
  const html = await fetchAuthenticatedPage(AISIS_URLS.classSchedule);
  const tableData = extractTableData(html);
  
  // Parse schedule from table
  const schedule = [];
  
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    
    if (row.length >= 5) {
      schedule.push({
        courseCode: row[0] || '',
        section: row[1] || '',
        schedule: row[2] || '',
        room: row[3] || '',
        instructor: row[4] || ''
      });
    }
  }
  
  console.log(`Extracted ${schedule.length} schedule entries`);
  
  return {
    pageName: 'Class Schedule',
    url: AISIS_URLS.classSchedule,
    data: schedule,
    timestamp: new Date().toISOString()
  };
}
```

### Scrape Student Information

```javascript
// Scrape student information page
async function scrapeStudentInfo() {
  console.log('Scraping student information...');
  
  const html = await fetchAuthenticatedPage(AISIS_URLS.studentInfo);
  
  // Extract student info using regex
  const studentInfo = {};
  
  // Extract student ID
  const idMatch = html.match(/Student\s*ID[:\s]*([0-9]+)/i);
  if (idMatch) {
    studentInfo.studentId = idMatch[1];
  }
  
  // Extract name
  const nameMatch = html.match(/Name[:\s]*([A-Za-z\s,]+)/i);
  if (nameMatch) {
    studentInfo.name = nameMatch[1].trim();
  }
  
  // Extract program
  const programMatch = html.match(/Program[:\s]*([A-Za-z\s]+)/i);
  if (programMatch) {
    studentInfo.program = programMatch[1].trim();
  }
  
  console.log('Student info extracted:', studentInfo);
  
  return {
    pageName: 'Student Information',
    url: AISIS_URLS.studentInfo,
    data: studentInfo,
    timestamp: new Date().toISOString()
  };
}
```

---

## Data Extraction

### Complete Scraping Flow

```javascript
// Main scraping function
async function scrapeAllPages(username, password, selectedPages) {
  const results = {
    success: false,
    data: {},
    errors: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    // Step 1: Login
    console.log('Logging in...');
    await loginWithRetry(username, password);
    console.log('Login successful');
    
    // Step 2: Scrape selected pages
    const scrapers = {
      'grades': scrapeGrades,
      'schedule': scrapeSchedule,
      'studentInfo': scrapeStudentInfo,
      'scheduleOfClasses': () => scrapeSimplePage(AISIS_URLS.scheduleOfClasses, 'Schedule of Classes'),
      'officialCurriculum': () => scrapeSimplePage(AISIS_URLS.officialCurriculum, 'Official Curriculum'),
      'advisoryGrades': () => scrapeSimplePage(AISIS_URLS.advisoryGrades, 'Advisory Grades'),
      'enrolledClasses': () => scrapeSimplePage(AISIS_URLS.enrolledClasses, 'Enrolled Classes'),
      'tuitionReceipt': () => scrapeSimplePage(AISIS_URLS.tuitionReceipt, 'Tuition Receipt'),
      'programOfStudy': () => scrapeSimplePage(AISIS_URLS.programOfStudy, 'Program of Study'),
      'holdOrders': () => scrapeSimplePage(AISIS_URLS.holdOrders, 'Hold Orders'),
      'facultyAttendance': () => scrapeSimplePage(AISIS_URLS.facultyAttendance, 'Faculty Attendance')
    };
    
    // Scrape each selected page
    for (const pageName of selectedPages) {
      if (scrapers[pageName]) {
        try {
          console.log(`Scraping ${pageName}...`);
          const result = await scrapers[pageName]();
          results.data[pageName] = result;
          console.log(`✓ ${pageName} scraped successfully`);
        } catch (error) {
          console.error(`✗ Failed to scrape ${pageName}:`, error.message);
          results.errors.push({
            page: pageName,
            error: error.message
          });
        }
        
        // Wait between requests to avoid rate limiting
        await sleep(1000);
      }
    }
    
    results.success = true;
    console.log('Scraping completed');
    
  } catch (error) {
    console.error('Scraping failed:', error.message);
    results.errors.push({
      page: 'login',
      error: error.message
    });
  }
  
  return results;
}
```

### Usage Example

```javascript
// Example usage
async function main() {
  const username = '254880';
  const password = 'your_password';
  const selectedPages = ['grades', 'schedule', 'studentInfo'];
  
  try {
    const results = await scrapeAllPages(username, password, selectedPages);
    
    console.log('Scraping Results:');
    console.log('Success:', results.success);
    console.log('Data:', JSON.stringify(results.data, null, 2));
    console.log('Errors:', results.errors);
    
    // Save to file or database
    // await saveToFile('aisis_data.json', results);
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the scraper
main();
```

---

## Complete Code

Below is the complete, standalone scraping code that can be used in Node.js or adapted for other environments.

```javascript
/**
 * AISIS Web Scraper
 * Standalone version for server-side use
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const AISIS_URLS = {
  login: 'https://aisis.ateneo.edu/j_aisis/displayLogin.do',
  loginSubmit: 'https://aisis.ateneo.edu/j_aisis/login.do',
  welcome: 'https://aisis.ateneo.edu/j_aisis/welcome.do',
  viewGrades: 'https://aisis.ateneo.edu/j_aisis/J_VGRD.do',
  classSchedule: 'https://aisis.ateneo.edu/j_aisis/J_VMCS.do',
  studentInfo: 'https://aisis.ateneo.edu/j_aisis/J_STUD_INFO.do',
  scheduleOfClasses: 'https://aisis.ateneo.edu/j_aisis/J_VSOC.do',
  officialCurriculum: 'https://aisis.ateneo.edu/j_aisis/J_VOFC.do',
  advisoryGrades: 'https://aisis.ateneo.edu/j_aisis/J_VADGR.do',
  enrolledClasses: 'https://aisis.ateneo.edu/j_aisis/J_VCEC.do',
  tuitionReceipt: 'https://aisis.ateneo.edu/j_aisis/J_PTR.do',
  programOfStudy: 'https://aisis.ateneo.edu/j_aisis/J_VIPS.do'
};

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive'
};

// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

function extractRndToken(html) {
  const patterns = [
    /<input[^>]*name=["']rnd["'][^>]*value=["']([^"']+)["']/i,
    /<input[^>]*value=["']([^"']+)["'][^>]*name=["']rnd["']/i
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return '';
}

function extractTableData(html) {
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHTML = trMatch[1];
    const cells = [];
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch;
    
    while ((tdMatch = tdRegex.exec(rowHTML)) !== null) {
      const cellText = tdMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(cellText);
    }
    
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  
  return rows;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function login(username, password) {
  console.log('Fetching login page...');
  
  // Step 1: Get login page
  const loginPageResponse = await fetchWithTimeout(AISIS_URLS.login, {
    method: 'GET',
    headers: REQUEST_HEADERS,
    credentials: 'include'
  });
  
  if (!loginPageResponse.ok) {
    throw new Error(`Failed to load login page: ${loginPageResponse.status}`);
  }
  
  const loginPageHTML = await loginPageResponse.text();
  
  // Step 2: Extract CSRF token
  const rndToken = extractRndToken(loginPageHTML);
  console.log('CSRF token extracted:', rndToken ? 'Yes' : 'No');
  
  // Step 3: Prepare form data
  const formData = new URLSearchParams();
  formData.append('userName', username);
  formData.append('password', password);
  formData.append('command', 'login');
  formData.append('submit', 'Sign in');
  if (rndToken) {
    formData.append('rnd', rndToken);
  }
  
  console.log('Submitting credentials...');
  
  // Step 4: Submit login
  const loginResponse = await fetchWithTimeout(AISIS_URLS.loginSubmit, {
    method: 'POST',
    headers: {
      ...REQUEST_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://aisis.ateneo.edu',
      'Referer': AISIS_URLS.login
    },
    body: formData,
    credentials: 'include',
    redirect: 'follow'
  });
  
  if (!loginResponse.ok) {
    throw new Error(`Login failed: ${loginResponse.status}`);
  }
  
  const responseText = await loginResponse.text();
  
  // Step 5: Verify login
  if (responseText.includes('welcome') || loginResponse.url.includes('welcome.do')) {
    console.log('✓ Login successful');
    return true;
  } else if (responseText.includes('error') || responseText.includes('invalid')) {
    throw new Error('Invalid credentials');
  } else {
    throw new Error('Login verification failed');
  }
}

async function loginWithRetry(username, password, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${maxRetries}...`);
        await sleep(2000);
      }
      
      const success = await login(username, password);
      if (success) return true;
      
    } catch (error) {
      console.error(`Login attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt === maxRetries - 1) {
        throw new Error(`Login failed after ${maxRetries} attempts: ${error.message}`);
      }
    }
  }
  
  return false;
}

// ============================================================================
// PAGE SCRAPERS
// ============================================================================

async function fetchAuthenticatedPage(url) {
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      ...REQUEST_HEADERS,
      'Referer': AISIS_URLS.welcome
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  
  return await response.text();
}

async function scrapeGrades() {
  console.log('Scraping grades...');
  const html = await fetchAuthenticatedPage(AISIS_URLS.viewGrades);
  const tableData = extractTableData(html);
  
  const grades = [];
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    if (row.length >= 6) {
      grades.push({
        schoolYear: row[0] || '',
        semester: row[1] || '',
        courseCode: row[2] || '',
        courseTitle: row[3] || '',
        units: row[4] || '',
        grade: row[5] || ''
      });
    }
  }
  
  console.log(`✓ Extracted ${grades.length} grade entries`);
  return { data: grades, html };
}

async function scrapeSchedule() {
  console.log('Scraping class schedule...');
  const html = await fetchAuthenticatedPage(AISIS_URLS.classSchedule);
  const tableData = extractTableData(html);
  
  const schedule = [];
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    if (row.length >= 5) {
      schedule.push({
        courseCode: row[0] || '',
        section: row[1] || '',
        schedule: row[2] || '',
        room: row[3] || '',
        instructor: row[4] || ''
      });
    }
  }
  
  console.log(`✓ Extracted ${schedule.length} schedule entries`);
  return { data: schedule, html };
}

async function scrapeStudentInfo() {
  console.log('Scraping student information...');
  const html = await fetchAuthenticatedPage(AISIS_URLS.studentInfo);
  
  const studentInfo = {};
  
  const idMatch = html.match(/Student\s*ID[:\s]*([0-9]+)/i);
  if (idMatch) studentInfo.studentId = idMatch[1];
  
  const nameMatch = html.match(/Name[:\s]*([A-Za-z\s,]+)/i);
  if (nameMatch) studentInfo.name = nameMatch[1].trim();
  
  const programMatch = html.match(/Program[:\s]*([A-Za-z\s]+)/i);
  if (programMatch) studentInfo.program = programMatch[1].trim();
  
  console.log('✓ Student info extracted');
  return { data: studentInfo, html };
}

async function scrapeSimplePage(url, pageName) {
  console.log(`Scraping ${pageName}...`);
  const html = await fetchAuthenticatedPage(url);
  console.log(`✓ ${pageName} scraped (${html.length} bytes)`);
  return { html };
}

// ============================================================================
// MAIN SCRAPER
// ============================================================================

async function scrapeAllPages(username, password, selectedPages = []) {
  const results = {
    success: false,
    data: {},
    errors: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    // Login
    await loginWithRetry(username, password);
    
    // Define scrapers
    const scrapers = {
      'grades': scrapeGrades,
      'schedule': scrapeSchedule,
      'studentInfo': scrapeStudentInfo,
      'scheduleOfClasses': () => scrapeSimplePage(AISIS_URLS.scheduleOfClasses, 'Schedule of Classes'),
      'officialCurriculum': () => scrapeSimplePage(AISIS_URLS.officialCurriculum, 'Official Curriculum'),
      'advisoryGrades': () => scrapeSimplePage(AISIS_URLS.advisoryGrades, 'Advisory Grades'),
      'enrolledClasses': () => scrapeSimplePage(AISIS_URLS.enrolledClasses, 'Enrolled Classes'),
      'tuitionReceipt': () => scrapeSimplePage(AISIS_URLS.tuitionReceipt, 'Tuition Receipt'),
      'programOfStudy': () => scrapeSimplePage(AISIS_URLS.programOfStudy, 'Program of Study')
    };
    
    // If no pages selected, scrape all
    const pagesToScrape = selectedPages.length > 0 ? selectedPages : Object.keys(scrapers);
    
    // Scrape each page
    for (const pageName of pagesToScrape) {
      if (scrapers[pageName]) {
        try {
          const result = await scrapers[pageName]();
          results.data[pageName] = result;
        } catch (error) {
          console.error(`✗ Failed to scrape ${pageName}:`, error.message);
          results.errors.push({ page: pageName, error: error.message });
        }
        
        // Wait between requests
        await sleep(1000);
      }
    }
    
    results.success = true;
    console.log('\n✓ Scraping completed successfully');
    
  } catch (error) {
    console.error('\n✗ Scraping failed:', error.message);
    results.errors.push({ page: 'login', error: error.message });
  }
  
  return results;
}

// ============================================================================
// EXPORT
// ============================================================================

// For Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    scrapeAllPages,
    scrapeGrades,
    scrapeSchedule,
    scrapeStudentInfo,
    login,
    AISIS_URLS
  };
}

// For browser/extension
if (typeof window !== 'undefined') {
  window.AISISScraper = {
    scrapeAllPages,
    scrapeGrades,
    scrapeSchedule,
    scrapeStudentInfo,
    login,
    AISIS_URLS
  };
}
```

---

## Usage Examples

### Node.js Example

```javascript
const AISISScraper = require('./aisis-scraper');

async function main() {
  const username = '254880';
  const password = 'your_password';
  const pages = ['grades', 'schedule', 'studentInfo'];
  
  const results = await AISISScraper.scrapeAllPages(username, password, pages);
  
  console.log('Results:', JSON.stringify(results, null, 2));
  
  // Save to file
  const fs = require('fs');
  fs.writeFileSync('aisis_data.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
```

### Python Equivalent (using requests + BeautifulSoup)

```python
import requests
from bs4 import BeautifulSoup
import time

class AISISScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def login(self, username, password):
        # Get login page
        login_page = self.session.get('https://aisis.ateneo.edu/j_aisis/displayLogin.do')
        soup = BeautifulSoup(login_page.text, 'html.parser')
        
        # Extract CSRF token
        rnd_input = soup.find('input', {'name': 'rnd'})
        rnd_token = rnd_input['value'] if rnd_input else ''
        
        # Submit login
        login_data = {
            'userName': username,
            'password': password,
            'command': 'login',
            'submit': 'Sign in'
        }
        if rnd_token:
            login_data['rnd'] = rnd_token
        
        response = self.session.post(
            'https://aisis.ateneo.edu/j_aisis/login.do',
            data=login_data
        )
        
        return 'welcome' in response.text
    
    def scrape_grades(self):
        response = self.session.get('https://aisis.ateneo.edu/j_aisis/J_VGRD.do')
        soup = BeautifulSoup(response.text, 'html.parser')
        
        grades = []
        table = soup.find('table')
        
        if table:
            rows = table.find_all('tr')[1:]  # Skip header
            for row in rows:
                cells = row.find_all('td')
                if len(cells) >= 6:
                    grades.append({
                        'schoolYear': cells[0].text.strip(),
                        'semester': cells[1].text.strip(),
                        'courseCode': cells[2].text.strip(),
                        'courseTitle': cells[3].text.strip(),
                        'units': cells[4].text.strip(),
                        'grade': cells[5].text.strip()
                    })
        
        return grades

# Usage
scraper = AISISScraper()
scraper.login('254880', 'your_password')
grades = scraper.scrape_grades()
print(grades)
```

---

## Notes for Website AI Integration

### Key Points

1. **Session Management**: The scraper maintains an authenticated session using cookies. Make sure your implementation preserves cookies across requests.

2. **CSRF Protection**: AISIS uses a `rnd` token for CSRF protection. Always extract this from the login page and include it in the login POST request.

3. **Rate Limiting**: Add delays (`sleep(1000)`) between requests to avoid overwhelming the server.

4. **Error Handling**: Implement retry logic for network failures and authentication errors.

5. **HTML Parsing**: The provided code uses regex for parsing (service worker compatible). For server-side implementations, use proper HTML parsers like `cheerio` (Node.js) or `BeautifulSoup` (Python).

### Adaptation Tips

- **For Node.js**: Use `node-fetch` or `axios` for HTTP requests, `cheerio` for HTML parsing
- **For Python**: Use `requests` for HTTP, `BeautifulSoup` for HTML parsing
- **For PHP**: Use `cURL` for HTTP, `DOMDocument` for HTML parsing
- **For Java**: Use `HttpClient` for HTTP, `Jsoup` for HTML parsing

### Security Considerations

- **Never log passwords** in production
- **Store credentials securely** (use environment variables or encrypted storage)
- **Use HTTPS** for all requests
- **Respect robots.txt** and terms of service
- **Implement rate limiting** to avoid server overload

---

**End of Document**
