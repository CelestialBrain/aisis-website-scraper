# AISIS Scraper Analysis - Problems & Solutions

## Error Summary

**Error Message:**
```
Schedule scraping failed: error sending request from 10.32.37.198:49048 for https://aisis.ateneo.edu/j_aisis/J_VCSC.do (3.37.242.73:443): client error (SendRequest): invalid HTTP header parsed
```

**Error Type:** HTTP Header Parsing Error  
**Location:** `scrapeSchedules` function, line 929 (initial GET request)  
**Root Cause:** Invalid or malformed HTTP headers being sent to AISIS

---

## Identified Problems

### Problem 1: Cookie Sanitization Incomplete ⚠️

**Location:** Lines 920-922, 294-299, 332-336

**Issue:**
While the code attempts to sanitize cookies by removing `\r\n` characters, there are **other potential issues**:

1. **Multiple semicolons**: Cookie joining with `'; '` can create `;;` if there are empty cookies
2. **Leading/trailing semicolons**: Can cause `; cookie1=value` or `cookie1=value;`
3. **Duplicate cookies**: Multiple `JSESSIONID` or other cookies
4. **Special characters**: Cookies might contain characters that need escaping
5. **Cookie length**: Very long cookie strings might exceed header size limits

**Current Code:**
```typescript
const sanitizedCookies = session.cookies
  .replace(/[\r\n]/g, '')
  .trim();
```

**Problem:** This only removes newlines, but doesn't handle:
- Empty cookie values
- Duplicate semicolons
- Invalid cookie formats

---

### Problem 2: Missing Header Validation ⚠️

**Location:** Lines 931-935

**Issue:**
The code doesn't validate that headers are properly formatted before sending. HTTP headers must:
- Not contain newlines (`\r` or `\n`)
- Not contain null bytes (`\0`)
- Be valid ASCII characters
- Not exceed length limits (typically 8KB per header)

**Current Code:**
```typescript
headers: {
  'Cookie': sanitizedCookies,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': `${AISIS_BASE_URL}/welcome.do`
}
```

**Problem:** No validation that `sanitizedCookies` is a valid HTTP header value.

---

### Problem 3: Cookie Extraction Logic Issues ⚠️

**Location:** Lines 294-299, 330-337

**Issue:**
The cookie extraction uses `getSetCookie()` and joins them, but:

1. **Overwrites cookies**: Each response completely replaces cookies instead of merging
2. **Loses path/domain info**: Only takes the first part before `;`
3. **No deduplication**: Duplicate cookies can accumulate

**Current Code:**
```typescript
const setCookieHeaders = loginPageResponse.headers.getSetCookie();
let cookies = setCookieHeaders
  .map(c => c.split(';')[0].trim())
  .filter(c => c.length > 0)
  .join('; ')
  .replace(/[\r\n]/g, '');
```

**Problem:** 
- If a cookie is set multiple times, all instances are included
- No merging with existing cookies (just replacement)

---

### Problem 4: Missing Error Details ⚠️

**Location:** Lines 929-936

**Issue:**
When the fetch fails, there's no logging of:
- The actual cookie string being sent
- Cookie length
- Individual cookie values
- Header validation results

This makes debugging impossible.

---

### Problem 5: Incorrect URL (Minor) ⚠️

**Location:** Line 917

**Issue:**
The code uses `J_VCSC.do` but the comment mentions `J_VSOC.do`. While `J_VCSC.do` is correct, the inconsistency suggests confusion.

**Current Code:**
```typescript
// Use correct endpoint: J_VCSC.do (not J_VSOC.do)
const scheduleUrl = `${AISIS_BASE_URL}/J_VCSC.do`;
```

**Note:** This is actually correct, but the comment indicates previous confusion.

---

## Root Cause Analysis

### Most Likely Cause: Malformed Cookie Header

The error "invalid HTTP header parsed" indicates that the HTTP request contains a header that violates HTTP/1.1 specifications. Given that:

1. Login succeeds (so basic cookie handling works)
2. Error occurs on the first schedule request
3. Error is specifically about header parsing

**The most likely issue is:**

The cookie string contains **invalid characters** or **formatting issues** that become problematic when used in subsequent requests.

### Possible Scenarios:

1. **Newlines in cookies**: Despite sanitization, some `\r\n` might remain
2. **Null bytes**: Cookie values might contain `\0`
3. **Non-ASCII characters**: Cookies might have UTF-8 or other encodings
4. **Excessive length**: Cookie header exceeds 8KB limit
5. **Malformed cookie values**: Values with unescaped special characters

---

## Solutions

### Solution 1: Enhanced Cookie Sanitization ✅

Replace the simple sanitization with comprehensive cleaning:

```typescript
function sanitizeCookies(cookieString: string): string {
  return cookieString
    // Remove all whitespace control characters
    .replace(/[\r\n\t\0]/g, '')
    // Remove any non-ASCII characters
    .replace(/[^\x20-\x7E]/g, '')
    // Split into individual cookies
    .split(';')
    // Trim each cookie
    .map(c => c.trim())
    // Remove empty cookies
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
```

**Usage:**
```typescript
const sanitizedCookies = sanitizeCookies(session.cookies);
```

---

### Solution 2: Cookie Merging (Not Replacement) ✅

Instead of replacing cookies, merge them:

```typescript
function mergeCookies(existingCookies: string, newCookies: string[]): string {
  const cookieMap = new Map<string, string>();
  
  // Parse existing cookies
  if (existingCookies) {
    existingCookies.split(';').forEach(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name) {
        cookieMap.set(name, valueParts.join('='));
      }
    });
  }
  
  // Add/update with new cookies
  newCookies.forEach(cookieHeader => {
    const cookie = cookieHeader.split(';')[0].trim();
    const [name, ...valueParts] = cookie.split('=');
    if (name) {
      cookieMap.set(name, valueParts.join('='));
    }
  });
  
  // Convert back to cookie string
  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}
```

**Usage in loginToAISIS:**
```typescript
// After login page
let cookies = mergeCookies('', loginPageResponse.headers.getSetCookie());

// After login response
cookies = mergeCookies(cookies, loginResponse.headers.getSetCookie());
```

---

### Solution 3: Header Validation ✅

Add validation before sending requests:

```typescript
function validateHeaders(headers: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(headers)) {
    // Check for invalid characters
    if (/[\r\n\0]/.test(value)) {
      console.error(`Invalid header ${key}: contains control characters`);
      return false;
    }
    
    // Check for non-ASCII
    if (!/^[\x20-\x7E]*$/.test(value)) {
      console.error(`Invalid header ${key}: contains non-ASCII characters`);
      return false;
    }
    
    // Check length (8KB limit per header)
    if (value.length > 8192) {
      console.error(`Invalid header ${key}: exceeds 8KB limit (${value.length} bytes)`);
      return false;
    }
  }
  
  return true;
}
```

**Usage:**
```typescript
const headers = {
  'Cookie': sanitizedCookies,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': `${AISIS_BASE_URL}/welcome.do`
};

if (!validateHeaders(headers)) {
  throw new Error('Invalid HTTP headers detected');
}

const response = await fetchWithTimeout(scheduleUrl, {
  method: 'GET',
  headers
});
```

---

### Solution 4: Enhanced Logging ✅

Add detailed logging before the failing request:

```typescript
console.log('[SCHEDULE] Cookie validation:');
console.log(`  - Length: ${sanitizedCookies.length} chars`);
console.log(`  - Contains newlines: ${/[\r\n]/.test(sanitizedCookies)}`);
console.log(`  - Contains null bytes: ${/\0/.test(sanitizedCookies)}`);
console.log(`  - Is ASCII: ${/^[\x20-\x7E; ]*$/.test(sanitizedCookies)}`);
console.log(`  - Cookie count: ${sanitizedCookies.split(';').length}`);
console.log(`  - Cookies: ${sanitizedCookies.split(';').map(c => c.split('=')[0].trim()).join(', ')}`);

await recordLog(serviceClient, jobId, 'debug', 'Cookie details', {
  cookieLength: sanitizedCookies.length,
  cookieCount: sanitizedCookies.split(';').length,
  cookieNames: sanitizedCookies.split(';').map(c => c.split('=')[0].trim())
});
```

---

### Solution 5: Fallback Strategy ✅

If cookie sanitization fails, try alternative approaches:

```typescript
async function fetchWithCookieRetry(url: string, options: any, maxAttempts = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Attempt 1: Use cookies as-is
      if (attempt === 1) {
        return await fetchWithTimeout(url, options);
      }
      
      // Attempt 2: Use only JSESSIONID
      if (attempt === 2) {
        const jsessionMatch = options.headers.Cookie.match(/JSESSIONID=[^;]+/);
        if (jsessionMatch) {
          const minimalOptions = {
            ...options,
            headers: {
              ...options.headers,
              Cookie: jsessionMatch[0]
            }
          };
          return await fetchWithTimeout(url, minimalOptions);
        }
      }
      
      // Attempt 3: No cookies (will likely fail, but worth trying)
      if (attempt === 3) {
        const noCookieOptions = {
          ...options,
          headers: {
            ...options.headers,
            Cookie: undefined
          }
        };
        return await fetchWithTimeout(url, noCookieOptions);
      }
      
    } catch (error) {
      lastError = error as Error;
      console.error(`Fetch attempt ${attempt} failed:`, error);
      
      if (attempt < maxAttempts) {
        await delay(1000 * attempt); // Exponential backoff
      }
    }
  }
  
  throw lastError || new Error('All fetch attempts failed');
}
```

---

## Recommended Implementation

### Step 1: Update loginToAISIS function

```typescript
async function loginToAISIS(username: string, password: string): Promise<AISISSession | null> {
  try {
    console.log('=== Starting AISIS Login ===');
    
    // Step 1: Fetch login page
    const loginPageResponse = await fetchWithTimeout(`${AISIS_BASE_URL}/displayLogin.do`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!loginPageResponse.ok) {
      console.error('Login page fetch failed:', loginPageResponse.status);
      return null;
    }

    const loginPageHtml = await loginPageResponse.text();
    
    // Extract rnd token
    const rndMatch = loginPageHtml.match(/name="rnd"\s+value="([^"]+)"/);
    if (!rndMatch) {
      console.error('Could not find rnd token');
      return null;
    }
    const rndToken = rndMatch[1];

    // Get cookies from login page - USE MERGE
    let cookies = mergeCookies('', loginPageResponse.headers.getSetCookie());
    console.log('Initial cookies obtained:', cookies.split(';').map(c => c.split('=')[0].trim()).join(', '));

    // Step 2: Submit login credentials
    const formData = new URLSearchParams({
      userName: username,
      password: password,
      command: 'login',
      submit: 'Sign in',
      rnd: rndToken
    });

    const loginResponse = await fetchWithTimeout(`${AISIS_BASE_URL}/login.do`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: formData.toString()
    });

    // Update cookies - USE MERGE
    cookies = mergeCookies(cookies, loginResponse.headers.getSetCookie());
    console.log('Cookies after login:', cookies.split(';').map(c => c.split('=')[0].trim()).join(', '));

    // Verify login
    const loginResponseText = await loginResponse.text();
    
    if (loginResponseText.toLowerCase().includes('invalid') || 
        loginResponseText.toLowerCase().includes('error')) {
      console.error('Login failed');
      return null;
    }

    if (!loginResponseText.toLowerCase().includes('welcome') && 
        !loginResponse.url.includes('welcome.do')) {
      console.error('Login verification failed');
      return null;
    }

    // Sanitize final cookies
    const sanitizedCookies = sanitizeCookies(cookies);
    
    // Validate cookies
    if (!validateHeaders({ 'Cookie': sanitizedCookies })) {
      console.error('Cookie validation failed');
      return null;
    }

    const sessionMatch = sanitizedCookies.match(/JSESSIONID=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : `session_${Date.now()}`;
    
    console.log('=== Login Successful ===');
    console.log(`Session ID: ${sessionId}`);
    console.log(`Cookie length: ${sanitizedCookies.length} chars`);

    return {
      cookies: sanitizedCookies,
      sessionId
    };
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}
```

### Step 2: Update scrapeSchedules function

```typescript
async function scrapeSchedules(
  serviceClient: any,
  session: AISISSession,
  jobId: string,
  userId: string
) {
  try {
    console.log('=== Starting Schedule Scrape ===');
    await recordLog(serviceClient, jobId, 'info', 'Starting schedule scraping');
    
    const scheduleUrl = `${AISIS_BASE_URL}/J_VCSC.do`;
    
    // Validate cookies before using
    if (!validateHeaders({ 'Cookie': session.cookies })) {
      throw new Error('Invalid cookies detected before schedule scraping');
    }
    
    // Log cookie details
    console.log('[SCHEDULE] Cookie validation:');
    console.log(`  - Length: ${session.cookies.length} chars`);
    console.log(`  - Cookie count: ${session.cookies.split(';').length}`);
    console.log(`  - Cookie names: ${session.cookies.split(';').map(c => c.split('=')[0].trim()).join(', ')}`);
    
    await recordLog(serviceClient, jobId, 'debug', 'Cookie details', {
      cookieLength: session.cookies.length,
      cookieCount: session.cookies.split(';').length,
      cookieNames: session.cookies.split(';').map(c => c.split('=')[0].trim())
    });
    
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
    console.log(`[SCHEDULE] Initial page: ${response.status} (${html.length} bytes)`);
    
    // Continue with parsing...
    const departments = parseSelectOptions(html, 'deptCode');
    
    // ... rest of the function
    
  } catch (error) {
    console.error('[SCHEDULE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await recordLog(serviceClient, jobId, 'error', `Schedule scraping failed: ${errorMessage}`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`Schedule scraping failed: ${errorMessage}`);
  }
}
```

---

## Summary of Changes

### Critical Fixes:
1. ✅ **Enhanced cookie sanitization** - Remove all control characters, non-ASCII, duplicates
2. ✅ **Cookie merging** - Properly merge cookies instead of replacing
3. ✅ **Header validation** - Validate all headers before sending
4. ✅ **Enhanced logging** - Log cookie details for debugging
5. ✅ **Retry strategy** - Fallback to minimal cookies if full cookies fail

### Expected Results:
- **No more "invalid HTTP header" errors**
- **Proper cookie management across requests**
- **Better debugging information**
- **More resilient scraping**

---

## Testing Checklist

After implementing fixes:

1. ✅ Login succeeds
2. ✅ Cookies are properly sanitized
3. ✅ No control characters in cookies
4. ✅ Cookie length is reasonable (<8KB)
5. ✅ Schedule page loads successfully
6. ✅ Departments are parsed
7. ✅ Schedule data is scraped

---

**End of Analysis**
