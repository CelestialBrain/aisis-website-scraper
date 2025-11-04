# AISIS Scraper - Complete Package

A comprehensive AISIS (Ateneo Integrated Student Information System) scraping solution with both Chrome Extension and server-side implementations.

---

## 📦 Repository Contents

### 1. Chrome Extension (`/chrome-extension`)

**AISIS Dashboard v4.1.2** - A fully functional Chrome extension for scraping and viewing AISIS data.

**Features:**
- ✅ **Dashboard View** (800×600px fixed window)
  - Overview, Grades, Schedule, Student Info, Program of Study tabs
  - Clean, professional UI matching Ateneo branding
  - Fixed 64px header with logo and navigation
  - Internal scrolling (no window resizing)

- ✅ **Scraper Popup** (420×700px separate window)
  - Credential management
  - 8 page selection options
  - Real-time progress tracking
  - Color-coded debug logs
  - Multiple export formats (JSON, CSV, HTML, HAR, Logs)

- ✅ **Reliable Scraping**
  - Session-based authentication with CSRF token handling
  - Retry logic for failed requests
  - Progress bar and status updates
  - HAR file generation for debugging
  - HTML snapshots for verification

**Installation:**
1. Extract `aisis_dashboard_v4.1.2_COMPLETE.zip`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extracted folder
6. Click the extension icon to start

**Files:**
- `manifest.json` - Extension configuration (v4.1.2)
- `dashboard.html` - Main dashboard view
- `dashboard.js` - Dashboard logic (7KB)
- `popup.html` - Scraper popup interface
- `popup.js` - Scraper UI logic (17KB)
- `background.js` - Service worker with scraping logic (41KB)
- `headers_helper.js` - HTTP headers helper
- `icons/` - Extension icons (16px, 48px, 128px)

---

### 2. Documentation (`/docs`)

Comprehensive documentation for understanding and extending the scraper.

#### Core Documentation

**README_v4.1.2.md** - Complete user guide
- Installation instructions
- Usage guide
- Feature overview
- Troubleshooting
- Technical details

**QUICK_START.md** - 5-minute setup guide
- Fast installation
- Basic usage
- Common issues

**CHANGELOG.md** - Version history
- v1.0 to v4.1.2 changes
- Feature additions
- Bug fixes
- Future plans

#### Technical Documentation

**SCRAPING_CODE.md** (69KB) - Raw scraping implementation
- Complete authentication flow
- HTTP request utilities
- HTML parsing methods
- Page scrapers for all AISIS pages
- Usage examples in JavaScript, Python, PHP

**PARSING_LOGIC.md** (85KB) - Complete parsing guide
- HTML parser implementation
- Schedule of Classes parsing (multi-step)
- Official Curriculum parsing (multi-step)
- Grades parsing
- Simple page parsing
- All regex patterns explained
- Adaptation examples for Node.js, Python, PHP

#### Version-Specific Documentation

**FIXES_v4.1.2.md** - What was fixed in v4.1.2
- Problems in v4.1.1
- Solutions implemented
- Architecture changes

**FIX_SUMMARY.md** - Quick fix summary
- Visual improvements
- Functionality restoration
- Two-file architecture

**INTEGRATION_SUMMARY.md** - Integration details
- Technical implementation
- View switching mechanism
- Data flow

**VISUAL_COMPARISON.md** - Before/after screenshots
- Layout improvements
- UI consistency

---

### 3. Server Scraper Fixes (`/server-scraper-fixes`)

**For users running server-side AISIS scrapers** (e.g., Supabase Edge Functions, Node.js servers)

#### Problem Analysis

**scraper_analysis.md** - Complete error analysis
- Error: "invalid HTTP header parsed"
- Root cause identification
- 5 critical problems explained
- Step-by-step solutions
- Testing checklist

**Key Issues Identified:**
1. ⚠️ Incomplete cookie sanitization
2. ⚠️ Cookie replacement instead of merging
3. ⚠️ No header validation
4. ⚠️ Missing debug logging
5. ⚠️ No retry strategy

#### Fixed Code

**scraper_fixes.ts** - Complete corrected implementation
- `sanitizeCookies()` - Enhanced cookie cleaning
- `mergeCookies()` - Proper cookie merging
- `validateHeaders()` - HTTP header validation
- `logCookieDetails()` - Debug logging
- `fetchWithCookieRetry()` - Retry strategy
- Updated `loginToAISIS()` - Fixed authentication
- Updated `scrapeSchedules()` - Fixed schedule scraping

**How to Use:**
1. Copy helper functions to your server code
2. Replace your `loginToAISIS` function
3. Replace your `scrapeSchedules` function
4. Test and verify logs

---

## 🚀 Quick Start

### Chrome Extension

```bash
# Extract the extension
unzip chrome-extension/aisis_dashboard_v4.1.2_COMPLETE.zip

# Load in Chrome
1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extracted folder
```

### Server-Side Scraper

```typescript
// Import fixed functions
import {
  sanitizeCookies,
  mergeCookies,
  validateHeaders,
  loginToAISIS,
  scrapeSchedules
} from './server-scraper-fixes/scraper_fixes.ts';

// Use in your code
const session = await loginToAISIS(username, password);
await scrapeSchedules(serviceClient, session, jobId, userId);
```

---

## 📚 Documentation Guide

### For Extension Users
1. Start with `docs/QUICK_START.md`
2. Read `docs/README_v4.1.2.md` for full features
3. Check `docs/CHANGELOG.md` for version history

### For Developers (Chrome Extension)
1. Read `docs/SCRAPING_CODE.md` for authentication and HTTP logic
2. Read `docs/PARSING_LOGIC.md` for HTML parsing and regex patterns
3. Review `chrome-extension/background.js` for implementation

### For Server-Side Developers
1. Read `server-scraper-fixes/scraper_analysis.md` for problem understanding
2. Copy code from `server-scraper-fixes/scraper_fixes.ts`
3. Refer to `docs/SCRAPING_CODE.md` for additional pages
4. Refer to `docs/PARSING_LOGIC.md` for parsing logic

---

## 🎯 Features Comparison

| Feature | Chrome Extension | Server-Side |
|---------|------------------|-------------|
| **Authentication** | ✅ CSRF token handling | ✅ CSRF token handling |
| **Session Management** | ✅ Cookie merging | ⚠️ Needs fix (see fixes) |
| **Retry Logic** | ✅ 3 attempts | ⚠️ Needs implementation |
| **Progress Tracking** | ✅ Real-time UI | ✅ Job status updates |
| **Debug Logs** | ✅ Color-coded | ⚠️ Needs enhancement |
| **HAR Export** | ✅ Full request/response | ❌ Not implemented |
| **HTML Snapshots** | ✅ Saved per page | ❌ Not implemented |
| **Data Export** | ✅ JSON, CSV, HTML | ✅ JSON (database) |
| **UI Dashboard** | ✅ Built-in | ❌ Separate frontend |

---

## 🔧 AISIS Pages Supported

### Chrome Extension ✅

| Page | Status | Parsing |
|------|--------|---------|
| Schedule of Classes | ✅ Working | ✅ Structured (14 fields) |
| Official Curriculum | ✅ Working | ✅ Structured (5 fields) |
| View Grades | ✅ Working | ✅ Structured (7 fields) |
| Advisory Grades | ✅ Working | ⚠️ Raw HTML |
| Enrolled Classes | ✅ Working | ⚠️ Raw HTML |
| My Class Schedule | ✅ Working | ⚠️ Raw HTML |
| Tuition Receipt | ✅ Working | ⚠️ Raw HTML |
| Student Info | ✅ Working | ⚠️ Raw HTML |
| Program of Study | ✅ Working | ⚠️ Raw HTML |
| Hold Orders | ✅ Working | ⚠️ Raw HTML |
| Faculty Attendance | ✅ Working | ⚠️ Raw HTML |

### Server-Side (After Fixes) ✅

| Page | Status | Notes |
|------|--------|-------|
| Schedule of Classes | ⚠️ Fixed | Apply fixes from `scraper_fixes.ts` |
| Official Curriculum | ✅ Working | No changes needed |
| View Grades | ✅ Working | No changes needed |
| My Schedule | ✅ Working | No changes needed |
| My Program | ✅ Working | No changes needed |
| My Grades | ✅ Working | No changes needed |
| Hold Orders | ✅ Working | No changes needed |
| Account Info | ✅ Working | No changes needed |

---

## 🐛 Known Issues & Fixes

### Chrome Extension
- ✅ **Fixed in v4.1.2**: Scraper functionality fully restored
- ✅ **Fixed in v4.1.1**: Window resizing and layout issues
- ✅ **Fixed in v4.1**: Dashboard integration

### Server-Side
- ⚠️ **"Invalid HTTP header parsed" error**: Fixed in `server-scraper-fixes/scraper_fixes.ts`
- ⚠️ **Cookie management issues**: Fixed with `mergeCookies()` and `sanitizeCookies()`
- ⚠️ **Missing validation**: Fixed with `validateHeaders()`

---

## 📖 AISIS URLs Reference

```javascript
const AISIS_URLS = {
  login: 'https://aisis.ateneo.edu/j_aisis/displayLogin.do',
  loginSubmit: 'https://aisis.ateneo.edu/j_aisis/login.do',
  welcome: 'https://aisis.ateneo.edu/j_aisis/welcome.do',
  
  // Public pages
  scheduleOfClasses: 'https://aisis.ateneo.edu/j_aisis/J_VCSC.do',
  officialCurriculum: 'https://aisis.ateneo.edu/j_aisis/J_VOFC.do',
  
  // Student pages (require authentication)
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

---

## 🎨 Design Specifications

Both implementations follow Ateneo branding:

- **Primary Color**: Ateneo Blue `hsl(228, 74%, 30%)` (#0033A0)
- **Font**: Inter from Google Fonts
- **Logo**: 1.5rem, font-weight 700, letter-spacing -0.05em
- **Spacing Rhythm**: 24 → 16 → 12 → 8px
- **Border Radius**: 8px (rounded-lg)
- **Shadows**: Subtle soft shadows

### Chrome Extension Layout
- **Dashboard**: 800×600px fixed window, 64px header
- **Scraper Popup**: 420×700px, centered content
- **Scrolling**: Internal only, thin 6px scrollbar

---

## 🔒 Security Considerations

### Chrome Extension
- Credentials stored in Chrome's local storage (encrypted by browser)
- Session cookies managed securely
- No data sent to external servers

### Server-Side
- ⚠️ Use proper encryption for credentials (not just base64)
- ✅ Validate all HTTP headers before sending
- ✅ Sanitize cookies to prevent injection
- ✅ Use environment variables for sensitive data
- ✅ Implement rate limiting (2-4 seconds between requests)

---

## 📝 License

Private repository. All rights reserved.

---

## 🤝 Contributing

This is a private repository. For issues or improvements:
1. Document the issue clearly
2. Provide error logs if applicable
3. Test fixes thoroughly before committing

---

## 📞 Support

For issues:
1. Check `docs/README_v4.1.2.md` troubleshooting section
2. Review error logs in the extension or server
3. Consult `server-scraper-fixes/scraper_analysis.md` for server errors

---

## 🎯 Roadmap

### Chrome Extension
- [ ] Add more structured parsing for simple pages
- [ ] Implement data export to CSV with custom fields
- [ ] Add filtering and search in dashboard
- [ ] Implement data comparison across semesters

### Server-Side
- [ ] Implement HAR file generation
- [ ] Add HTML snapshot saving
- [ ] Implement parallel scraping for departments
- [ ] Add webhook notifications for job completion

---

**Last Updated:** November 4, 2025  
**Current Version:** v4.1.2 (Chrome Extension)  
**Repository:** CelestialBrain/aisis-website-scraper
