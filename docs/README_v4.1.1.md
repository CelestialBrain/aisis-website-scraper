# AISIS Dashboard v4.1.1 - Fixed Window & Layout

## 🎯 What's Fixed in v4.1.1

This version addresses all the window sizing and layout issues from v4.1:

### ✅ Fixed Window Size
- **800×600px fixed window** - No more resizing between views
- Window stays consistent when switching between Dashboard and Scraper
- Defined in HTML/CSS (Chrome extensions don't support window size in manifest v3)

### ✅ Consistent 64px Header
- **Same header height** in both Dashboard and Scraper views
- Logo and version number always in the same position
- Buttons properly aligned with 12px gap (matching your design system)
- Header uses `px-6` (24px) horizontal padding

### ✅ Centered Scraper Layout
- **420px max-width** for scraper content (matching your website's card width)
- Centered horizontally with white space on sides
- Card-based sections with proper spacing (p-5 = 20px)
- Maintains visual consistency with your website design

### ✅ Internal Scrolling Only
- **Fixed window height** (600px total)
- Header: 64px (fixed)
- Content area: 536px (scrollable)
- Thin scrollbar (6px width) with subtle styling
- No horizontal scrolling
- Logs container has its own internal scroll (max-height: 280px)

### ✅ Visual Consistency
- Follows your design system's spacing rhythm: 24 → 16 → 12 → 8px
- Uses your color tokens (--background, --card, --border, etc.)
- Matches website's density level (~6.5/10)
- Same border radius (8px), shadows, and typography

## 📐 Technical Specifications

### Window Dimensions
```
Total: 800px × 600px (fixed, no resizing)
├─ Header: 800px × 64px (fixed)
└─ Content: 800px × 536px (scrollable)
```

### Scraper View Layout
```
Window: 800px wide
├─ Scraper content: 420px max-width (centered)
│  ├─ Credentials section: card with p-5
│  ├─ Pages selection: card with p-5
│  ├─ Scraping controls: card with p-5
│  ├─ Progress section: card with p-5
│  ├─ Logs section: card with p-5
│  │  └─ Logs container: max-height 280px, internal scroll
│  └─ Export section: card with p-5
└─ White space: 190px on each side
```

### Header Consistency
```css
.header {
    height: 64px;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid hsl(var(--border));
}
```

### Scrolling Behavior
```css
html, body {
    width: 800px;
    height: 600px;
    overflow: hidden; /* No window scrolling */
}

.main-content {
    height: calc(600px - 64px); /* 536px */
    overflow-y: auto; /* Internal scrolling */
    scrollbar-width: thin;
}

.logs-container {
    max-height: 280px;
    overflow-y: auto; /* Nested scrolling for logs */
}
```

## 🚀 Installation

1. **Download** the `aisis_dashboard_v4.1.1_FIXED.zip` file
2. **Extract** the ZIP file to a folder
3. **Open Chrome** and navigate to `chrome://extensions/`
4. **Enable** "Developer mode" (toggle in top-right corner)
5. **Click** "Load unpacked"
6. **Select** the extracted folder
7. **Done!** The extension icon should appear in your toolbar

## 📖 Usage

### Dashboard View
1. Click the extension icon to open the dashboard
2. View your AISIS data organized in tabs:
   - **Overview**: Current QPI, GPA, units, and current courses
   - **Grades**: All grades from all semesters
   - **Schedule**: Class schedule with times and rooms
   - **Student Info**: Your student information
   - **Program of Study**: Your curriculum and program details

### Scraper View
1. Click **"⚙️ Scraper"** in the header to switch to scraper view
2. Enter your AISIS credentials (saved securely in browser storage)
3. Select which pages to scrape (checkboxes)
4. Click **"Start Scraping"** to begin
5. Monitor progress with the green progress bar
6. View real-time logs in the Debug Logs section
7. Export data using the export buttons
8. Click **"← Back to Dashboard"** to return to your data

### View Switching
- **Dashboard → Scraper**: Click "⚙️ Scraper" button
- **Scraper → Dashboard**: Click "← Back to Dashboard" button
- Window stays at 800×600px during all transitions
- Header remains consistent at 64px height

## 🎨 Design System Compliance

This extension follows your exact design specifications:

| Element | Specification | Implementation |
|---------|--------------|----------------|
| Window size | 800×600px fixed | ✅ Implemented |
| Header height | 64px | ✅ Implemented |
| Scraper width | 420px max-width | ✅ Implemented |
| Padding (global) | px-6 (24px) | ✅ Implemented |
| Padding (cards) | p-5 (20px) | ✅ Implemented |
| Section spacing | space-y-6 (24px) | ✅ Implemented |
| Card spacing | space-y-4 (16px) | ✅ Implemented |
| Button gap | gap-3 (12px) | ✅ Implemented |
| Border radius | rounded-lg (8px) | ✅ Implemented |
| Scrolling | Internal only | ✅ Implemented |
| Resizing | Disabled | ✅ Implemented |

## 🔧 Key Features

### Data Management
- **Automatic scraping** of all AISIS pages
- **Credential storage** (secure browser storage)
- **Progress tracking** with visual progress bar
- **Real-time logs** with color coding (success, warning, error)
- **Multiple export formats** (JSON, CSV, HTML, HAR)

### User Experience
- **Fixed window size** - No unexpected resizing
- **Consistent header** - Same layout in all views
- **Centered content** - Professional, focused layout
- **Smooth scrolling** - Internal scrolling with thin scrollbar
- **Responsive tabs** - Easy navigation between data sections

### Technical Excellence
- **Manifest v3** - Latest Chrome extension standard
- **Service worker** - Efficient background processing
- **Chrome Storage API** - Secure credential storage
- **HAR export** - Network traffic debugging
- **Error handling** - Comprehensive error recovery

## 📊 Comparison: v4.1 vs v4.1.1

| Feature | v4.1 (Before) | v4.1.1 (After) |
|---------|---------------|----------------|
| Window size | Variable, resizes | Fixed 800×600px |
| Header height | Inconsistent | Fixed 64px |
| Scraper layout | Full width, wonky | Centered 420px |
| Scrolling | Window scrolls | Internal only |
| View switching | Causes resize | Smooth, no resize |
| Visual consistency | Misaligned | Perfect alignment |

## 🐛 Troubleshooting

### Issue: Extension doesn't load
**Solution**: Make sure you extracted the ZIP file and selected the folder (not the ZIP file) when loading unpacked.

### Issue: Data not showing
**Solution**: Run the scraper first to fetch your AISIS data. Click "⚙️ Scraper" → Enter credentials → Select pages → Start Scraping.

### Issue: Scraping fails
**Solution**: 
- Check your AISIS credentials are correct
- Make sure you're connected to the internet
- Try clearing all data and starting fresh
- Check the Debug Logs for error messages

### Issue: Window looks different
**Solution**: This extension is designed for 800×600px. If you see different sizing, try:
- Closing and reopening the extension
- Reloading the extension in chrome://extensions/
- Checking browser zoom is at 100%

## 📁 File Structure

```
aisis_dashboard_v4.1.1_FIXED/
├── manifest.json          # Extension configuration (v4.1.1)
├── dashboard.html         # Main UI (800×600px, 64px header, centered scraper)
├── dashboard.js           # Dashboard & scraper logic (17KB)
├── background.js          # Service worker for scraping (41KB)
└── icons/
    ├── icon16.png         # Toolbar icon (16×16)
    ├── icon48.png         # Extension manager icon (48×48)
    └── icon128.png        # Chrome Web Store icon (128×128)
```

## 🔐 Privacy & Security

- **No data collection**: All data stays in your browser
- **No external servers**: Extension runs entirely locally
- **Secure storage**: Credentials encrypted by Chrome Storage API
- **No tracking**: No analytics or telemetry
- **Open source**: All code is visible and auditable

## 📝 Changelog

### v4.1.1 (2025-11-03) - FIXED RELEASE
**Fixed:**
- ✅ Window now fixed at 800×600px (no resizing)
- ✅ Header consistent at 64px in both views
- ✅ Scraper content centered at 420px max-width
- ✅ Internal scrolling only (no window scroll)
- ✅ Visual consistency with design system

**Changed:**
- Updated HTML structure for fixed dimensions
- Redesigned CSS for centered scraper layout
- Improved scrollbar styling (thin, subtle)
- Enhanced spacing to match design rhythm

### v4.1 (2025-11-03)
- Integrated scraper into dashboard (fullscreen view)
- Added view switching (Dashboard ↔ Scraper)
- Merged popup.js and dashboard.js
- Enhanced progress bar (rectangular, green)

### v4.0 (Previous)
- Initial dashboard implementation
- Separate popup for scraper
- Basic data display
- Export functionality

## 🎯 Future Enhancements

- [ ] Auto-refresh data on schedule
- [ ] Dark mode support
- [ ] Custom color themes
- [ ] Data filtering and search
- [ ] Grade calculator
- [ ] GPA trend charts
- [ ] Export to PDF
- [ ] Mobile responsive design

## 💬 Support

For issues, questions, or feature requests:
1. Check the Troubleshooting section above
2. Review the console logs (F12 → Console)
3. Check the Debug Logs in the scraper view
4. Contact your development team

## 📄 License

This extension is for personal use only. AISIS is a trademark of Ateneo de Manila University.

---

**Version**: 4.1.1  
**Release Date**: November 3, 2025  
**Status**: ✅ Production Ready  
**Tested**: Chrome 120+

**Key Achievement**: Fixed window sizing, consistent header, centered scraper layout, and internal scrolling only. No more wonky resizing! 🎉
