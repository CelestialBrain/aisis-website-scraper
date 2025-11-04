/**
 * AISIS Scraper - Fixed Helper Functions
 * 
 * This file contains corrected versions of the helper functions
 * to fix the "invalid HTTP header parsed" error.
 */

// ============================================================================
// COOKIE MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Sanitize cookie string to ensure it's valid for HTTP headers
 * 
 * Fixes:
 * - Removes control characters (\r, \n, \t, \0)
 * - Removes non-ASCII characters
 * - Removes empty cookies
 * - Removes duplicate cookies (keeps last occurrence)
 * - Ensures proper formatting
 */
function sanitizeCookies(cookieString: string): string {
  if (!cookieString || cookieString.trim().length === 0) {
    return '';
  }

  return cookieString
    // Remove all whitespace control characters
    .replace(/[\r\n\t\0]/g, '')
    // Remove any non-ASCII characters
    .replace(/[^\x20-\x7E]/g, '')
    // Split into individual cookies
    .split(';')
    // Trim each cookie
    .map(c => c.trim())
    // Remove empty cookies and cookies without '='
    .filter(c => c.length > 0 && c.includes('='))
    // Remove duplicate cookies (keep last occurrence)
    .reduce((acc: string[], cookie: string) => {
      const [name] = cookie.split('=');
      const existingIndex = acc.findIndex(c => c.startsWith(name + '='));
      if (existingIndex >= 0) {
        acc[existingIndex] = cookie; // Replace with newer value
      } else {
        acc.push(cookie);
      }
      return acc;
    }, [])
    // Join back with proper separator
    .join('; ')
    // Final trim
    .trim();
}

/**
 * Merge new cookies with existing cookies
 * 
 * This properly handles cookie updates by:
 * - Parsing existing cookies into a map
 * - Updating/adding new cookies
 * - Returning a properly formatted cookie string
 */
function mergeCookies(existingCookies: string, newCookies: string[]): string {
  const cookieMap = new Map<string, string>();
  
  // Parse existing cookies
  if (existingCookies && existingCookies.trim().length > 0) {
    existingCookies.split(';').forEach(cookie => {
      const trimmed = cookie.trim();
      if (trimmed.length === 0) return;
      
      const [name, ...valueParts] = trimmed.split('=');
      if (name && name.trim().length > 0) {
        cookieMap.set(name.trim(), valueParts.join('='));
      }
    });
  }
  
  // Add/update with new cookies
  newCookies.forEach(cookieHeader => {
    // Extract just the cookie part (before first semicolon)
    const cookie = cookieHeader.split(';')[0].trim();
    if (cookie.length === 0) return;
    
    const [name, ...valueParts] = cookie.split('=');
    if (name && name.trim().length > 0) {
      cookieMap.set(name.trim(), valueParts.join('='));
    }
  });
  
  // Convert back to cookie string
  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * Extract cookies from Response headers
 * 
 * Safely extracts Set-Cookie headers and returns them as an array
 */
function extractCookiesFromResponse(response: Response): string[] {
  try {
    const setCookieHeaders = response.headers.getSetCookie();
    return setCookieHeaders.filter(c => c && c.trim().length > 0);
  } catch (error) {
    console.error('Error extracting cookies:', error);
    return [];
  }
}

// ============================================================================
// HEADER VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate HTTP headers to ensure they're properly formatted
 * 
 * Checks for:
 * - Control characters (\r, \n, \0)
 * - Non-ASCII characters
 * - Excessive length (>8KB per header)
 */
function validateHeaders(headers: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue; // Skip undefined/null headers
    
    // Check for invalid control characters
    if (/[\r\n\0]/.test(value)) {
      console.error(`[HEADER VALIDATION] Invalid header "${key}": contains control characters`);
      console.error(`  Value: ${value.substring(0, 100)}...`);
      return false;
    }
    
    // Check for non-ASCII characters
    if (!/^[\x20-\x7E]*$/.test(value)) {
      console.error(`[HEADER VALIDATION] Invalid header "${key}": contains non-ASCII characters`);
      console.error(`  Value: ${value.substring(0, 100)}...`);
      return false;
    }
    
    // Check length (8KB limit per header)
    if (value.length > 8192) {
      console.error(`[HEADER VALIDATION] Invalid header "${key}": exceeds 8KB limit (${value.length} bytes)`);
      return false;
    }
  }
  
  return true;
}

/**
 * Log detailed cookie information for debugging
 */
function logCookieDetails(cookies: string, prefix: string = '[COOKIES]') {
  if (!cookies) {
    console.log(`${prefix} No cookies`);
    return;
  }

  const cookieArray = cookies.split(';').map(c => c.trim()).filter(c => c.length > 0);
  const cookieNames = cookieArray.map(c => c.split('=')[0]);
  
  console.log(`${prefix} Details:`);
  console.log(`  - Total length: ${cookies.length} chars`);
  console.log(`  - Cookie count: ${cookieArray.length}`);
  console.log(`  - Cookie names: ${cookieNames.join(', ')}`);
  console.log(`  - Contains newlines: ${/[\r\n]/.test(cookies)}`);
  console.log(`  - Contains null bytes: ${/\0/.test(cookies)}`);
  console.log(`  - Is ASCII: ${/^[\x20-\x7E; ]*$/.test(cookies)}`);
  
  // Log individual cookies (truncated)
  cookieArray.forEach((cookie, i) => {
    const [name, value] = cookie.split('=');
    const truncatedValue = value && value.length > 50 ? value.substring(0, 50) + '...' : value;
    console.log(`  ${i + 1}. ${name}=${truncatedValue}`);
  });
}

// ============================================================================
// FETCH WITH RETRY STRATEGIES
// ============================================================================

/**
 * Fetch with cookie retry strategy
 * 
 * Attempts multiple strategies if the initial request fails:
 * 1. Use full cookies
 * 2. Use only JSESSIONID (minimal cookies)
 * 3. Try without cookies (last resort)
 */
async function fetchWithCookieRetry(
  url: string, 
  options: any, 
  maxAttempts: number = 3,
  timeout: number = 30000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[FETCH RETRY] Attempt ${attempt}/${maxAttempts} for ${url}`);
      
      let modifiedOptions = { ...options };
      
      // Attempt 1: Use cookies as-is (already sanitized)
      if (attempt === 1) {
        console.log(`[FETCH RETRY] Using full cookies (${options.headers?.Cookie?.length || 0} chars)`);
      }
      
      // Attempt 2: Use only JSESSIONID
      else if (attempt === 2) {
        console.log('[FETCH RETRY] Trying with minimal cookies (JSESSIONID only)');
        const jsessionMatch = options.headers?.Cookie?.match(/JSESSIONID=[^;]+/);
        if (jsessionMatch) {
          modifiedOptions = {
            ...options,
            headers: {
              ...options.headers,
              Cookie: jsessionMatch[0]
            }
          };
          console.log(`[FETCH RETRY] Using JSESSIONID: ${jsessionMatch[0]}`);
        } else {
          console.log('[FETCH RETRY] No JSESSIONID found, skipping attempt 2');
          continue;
        }
      }
      
      // Attempt 3: No cookies (will likely fail auth, but worth trying)
      else if (attempt === 3) {
        console.log('[FETCH RETRY] Trying without cookies (last resort)');
        modifiedOptions = {
          ...options,
          headers: {
            ...options.headers,
            Cookie: undefined
          }
        };
      }
      
      // Validate headers before sending
      if (modifiedOptions.headers && !validateHeaders(modifiedOptions.headers)) {
        throw new Error(`Header validation failed on attempt ${attempt}`);
      }
      
      // Execute fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          ...modifiedOptions,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log(`[FETCH RETRY] Success on attempt ${attempt}: ${response.status}`);
        return response;
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
      
    } catch (error) {
      lastError = error as Error;
      console.error(`[FETCH RETRY] Attempt ${attempt} failed:`, error);
      
      if (attempt < maxAttempts) {
        const delayMs = 1000 * attempt; // Exponential backoff
        console.log(`[FETCH RETRY] Waiting ${delayMs}ms before retry...`);
        await delay(delayMs);
      }
    }
  }
  
  throw lastError || new Error('All fetch attempts failed');
}

/**
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// UPDATED LOGIN FUNCTION
// ============================================================================

/**
 * Login to AISIS with improved cookie handling
 */
async function loginToAISIS(username: string, password: string): Promise<AISISSession | null> {
  try {
    console.log('=== Starting AISIS Login ===');
    
    const AISIS_BASE_URL = 'https://aisis.ateneo.edu/j_aisis';
    const REQUEST_TIMEOUT = 30000;
    
    // Step 1: Fetch login page to get rnd token
    console.log('[LOGIN] Step 1: Fetching login page...');
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), REQUEST_TIMEOUT);
    
    const loginPageResponse = await fetch(`${AISIS_BASE_URL}/displayLogin.do`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller1.signal
    });
    clearTimeout(timeoutId1);

    if (!loginPageResponse.ok) {
      console.error('[LOGIN] Login page fetch failed:', loginPageResponse.status);
      return null;
    }

    const loginPageHtml = await loginPageResponse.text();
    console.log(`[LOGIN] Received ${loginPageHtml.length} bytes from login page`);

    // Extract rnd token
    const rndMatch = loginPageHtml.match(/name="rnd"\s+value="([^"]+)"/);
    if (!rndMatch) {
      console.error('[LOGIN] Could not find rnd token');
      console.error('[LOGIN] HTML sample:', loginPageHtml.substring(0, 500));
      return null;
    }
    const rndToken = rndMatch[1];
    console.log('[LOGIN] Extracted rnd token');

    // Get cookies from login page - USE MERGE
    let cookies = mergeCookies('', extractCookiesFromResponse(loginPageResponse));
    console.log('[LOGIN] Initial cookies obtained');
    logCookieDetails(cookies, '[LOGIN COOKIES]');

    // Step 2: Submit login credentials
    console.log('[LOGIN] Step 2: Submitting credentials...');
    const formData = new URLSearchParams({
      userName: username,
      password: password,
      command: 'login',
      submit: 'Sign in',
      rnd: rndToken
    });

    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), REQUEST_TIMEOUT);

    const loginResponse = await fetch(`${AISIS_BASE_URL}/login.do`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: formData.toString(),
      signal: controller2.signal
    });
    clearTimeout(timeoutId2);

    console.log('[LOGIN] Login response status:', loginResponse.status);

    // Update cookies - USE MERGE
    cookies = mergeCookies(cookies, extractCookiesFromResponse(loginResponse));
    console.log('[LOGIN] Cookies updated after login');
    logCookieDetails(cookies, '[LOGIN COOKIES AFTER]');

    // Verify login success
    const loginResponseText = await loginResponse.text();
    console.log(`[LOGIN] Login response: ${loginResponseText.length} bytes`);

    // Check for error indicators
    if (loginResponseText.toLowerCase().includes('invalid') || 
        loginResponseText.toLowerCase().includes('incorrect') ||
        loginResponseText.toLowerCase().includes('failed') ||
        loginResponseText.toLowerCase().includes('error')) {
      console.error('[LOGIN] Login failed - response indicates error');
      console.error('[LOGIN] Response snippet:', loginResponseText.substring(0, 500));
      return null;
    }

    // Check for success indicators
    if (!loginResponseText.toLowerCase().includes('welcome') && 
        !loginResponse.url.includes('welcome.do') &&
        !loginResponseText.includes('J_VOFC.do')) {
      console.error('[LOGIN] Login verification failed - no success indicators found');
      return null;
    }

    console.log('[LOGIN] Login success verified');

    // Sanitize final cookies
    const sanitizedCookies = sanitizeCookies(cookies);
    console.log('[LOGIN] Cookies sanitized');
    logCookieDetails(sanitizedCookies, '[LOGIN FINAL COOKIES]');
    
    // Validate cookies
    if (!validateHeaders({ 'Cookie': sanitizedCookies })) {
      console.error('[LOGIN] Cookie validation failed');
      return null;
    }
    console.log('[LOGIN] Cookie validation passed');

    // Extract JSESSIONID
    const sessionMatch = sanitizedCookies.match(/JSESSIONID=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : `session_${Date.now()}`;
    
    console.log('=== Login Successful ===');
    console.log(`[LOGIN] Session ID: ${sessionId}`);
    console.log(`[LOGIN] Cookie length: ${sanitizedCookies.length} chars`);

    return {
      cookies: sanitizedCookies,
      sessionId
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[LOGIN] Request timed out');
      return null;
    }
    console.error('[LOGIN] Error:', error);
    return null;
  }
}

// ============================================================================
// UPDATED SCHEDULE SCRAPING FUNCTION
// ============================================================================

/**
 * Scrape schedules with improved error handling
 */
async function scrapeSchedules(
  serviceClient: any,
  session: AISISSession,
  jobId: string,
  userId: string
) {
  try {
    console.log('=== Starting Schedule Scrape ===');
    await recordLog(serviceClient, jobId, 'info', 'Starting schedule scraping');
    
    const AISIS_BASE_URL = 'https://aisis.ateneo.edu/j_aisis';
    const scheduleUrl = `${AISIS_BASE_URL}/J_VCSC.do`;
    
    // Validate cookies before using
    console.log('[SCHEDULE] Validating cookies...');
    if (!validateHeaders({ 'Cookie': session.cookies })) {
      throw new Error('Invalid cookies detected before schedule scraping');
    }
    console.log('[SCHEDULE] Cookie validation passed');
    
    // Log cookie details
    logCookieDetails(session.cookies, '[SCHEDULE COOKIES]');
    
    await recordLog(serviceClient, jobId, 'debug', 'Cookie details', {
      cookieLength: session.cookies.length,
      cookieCount: session.cookies.split(';').length,
      cookieNames: session.cookies.split(';').map(c => c.split('=')[0].trim())
    });
    
    console.log(`[SCHEDULE] Fetching: ${scheduleUrl}`);
    await recordLog(serviceClient, jobId, 'info', `Fetching schedule page: ${scheduleUrl}`);
    
    // Use fetchWithCookieRetry for resilience
    const response = await fetchWithCookieRetry(scheduleUrl, {
      method: 'GET',
      headers: {
        'Cookie': session.cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `${AISIS_BASE_URL}/welcome.do`
      }
    });

    const html = await response.text();
    console.log(`[SCHEDULE] Success: ${response.status} (${html.length} bytes)`);
    await recordLog(serviceClient, jobId, 'info', `Loaded schedule page (${html.length} bytes)`, {
      status: response.status,
      size: html.length
    });
    
    // Parse department/college options from the initial page
    const departments = parseSelectOptions(html, 'deptCode');
    
    console.log(`[SCHEDULE] Found ${departments.length} departments`);
    await recordLog(serviceClient, jobId, 'info', `Found ${departments.length} departments`, { 
      departmentCount: departments.length,
      departments: departments.slice(0, 10).map(d => ({ value: d.value, text: d.text }))
    });
    
    if (departments.length === 0) {
      console.error('[SCHEDULE] No departments found - HTML sample:', html.substring(0, 500));
      await recordLog(serviceClient, jobId, 'error', 'No departments found in schedule page', { 
        htmlSample: html.substring(0, 500),
        responseStatus: response.status,
        url: scheduleUrl
      });
      return;
    }

    // Continue with rest of scraping logic...
    // (The rest of the function remains the same)
    
  } catch (error) {
    console.error('[SCHEDULE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    await recordLog(serviceClient, jobId, 'error', `Schedule scraping failed: ${errorMessage}`, {
      error: errorMessage,
      stack: errorStack
    });
    
    throw new Error(`Schedule scraping failed: ${errorMessage}`);
  }
}

// ============================================================================
// HELPER FUNCTION STUBS (implement as needed)
// ============================================================================

interface AISISSession {
  cookies: string;
  sessionId: string;
}

async function recordLog(serviceClient: any, jobId: string, level: string, message: string, metadata?: any) {
  // Implementation depends on your logging system
  console.log(`[${level.toUpperCase()}] ${message}`, metadata || '');
}

function parseSelectOptions(html: string, selectName: string): Array<{ value: string; text: string }> {
  // Implementation depends on your HTML parsing logic
  // This is a placeholder
  return [];
}

// ============================================================================
// EXPORT
// ============================================================================

export {
  sanitizeCookies,
  mergeCookies,
  extractCookiesFromResponse,
  validateHeaders,
  logCookieDetails,
  fetchWithCookieRetry,
  delay,
  loginToAISIS,
  scrapeSchedules
};
