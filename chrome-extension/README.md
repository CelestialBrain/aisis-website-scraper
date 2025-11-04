# AISIS Dashboard Chrome Extension v4.1.2

A Chrome extension for scraping and viewing AISIS data with a professional dashboard interface.

## Installation

1. **Download the extension files** (this folder)
2. Open Chrome and go to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top right)
4. Click **"Load unpacked"**
5. Select this `chrome-extension` folder
6. The extension icon will appear in your toolbar

## Files

- `manifest.json` - Extension configuration (v4.1.2)
- `dashboard.html` - Main dashboard view (800×600px)
- `dashboard.js` - Dashboard logic and data loading
- `popup.html` - Scraper popup interface (420×700px)
- `popup.js` - Scraper UI logic and controls
- `background.js` - Service worker with scraping logic
- `headers_helper.js` - HTTP headers helper
- `icons/` - Extension icons (16px, 48px, 128px)

## Usage

### 1. Open Dashboard
Click the extension icon in your toolbar to open the dashboard.

### 2. Start Scraping
Click the **"⚙️ Scraper"** button in the dashboard header to open the scraper popup.

### 3. Enter Credentials
- Enter your AISIS username
- Enter your AISIS password
- Click **"Save Credentials"**

### 4. Select Pages
Check the pages you want to scrape:
- Schedule of Classes
- Official Curriculum
- View Grades
- Advisory Grades
- Currently Enrolled Classes
- My Class Schedule
- Tuition Receipt
- Student Information

### 5. Scrape Data
Click **"Start Scraping"** and watch the progress bar.

### 6. View Results
- Click **"View Data"** to see results in the dashboard
- Or click **"← Back to Dashboard"** in the header

## Features

### Dashboard (800×600px)
- **Overview Tab**: Quick stats (QPI, GPA, Units, Courses)
- **Grades Tab**: All grades with filtering
- **Schedule Tab**: Class schedule
- **Student Info Tab**: Personal information
- **Program of Study Tab**: Curriculum progress

### Scraper Popup (420×700px)
- **Credential Management**: Save and load credentials
- **Page Selection**: 8 different AISIS pages
- **Progress Tracking**: Real-time progress bar
- **Debug Logs**: Color-coded logs (info, success, warning, error)
- **Export Options**: JSON, CSV, View Data, Download Logs, HAR, HTML
- **Control Buttons**: Stop, Resume, Terminate, Clear All Data

## Troubleshooting

### Extension doesn't load
- Make sure you selected the correct folder
- Check that all files are present
- Reload the extension in `chrome://extensions/`

### Login fails
- Verify your AISIS credentials are correct
- Check your internet connection
- Try logging in to AISIS website first

### Scraping fails
- Check the debug logs for error messages
- Try scraping one page at a time
- Clear all data and try again

### No data in dashboard
- Make sure you clicked "View Data" after scraping
- Check that scraping completed successfully
- Try refreshing the dashboard

## Design Specifications

- **Window Size**: 800×600px (dashboard), 420×700px (scraper)
- **Header Height**: 64px
- **Primary Color**: Ateneo Blue `#0033A0`
- **Font**: Inter from Google Fonts
- **Spacing**: 24 → 16 → 12 → 8px rhythm
- **Border Radius**: 8px
- **Scrolling**: Internal only, thin 6px scrollbar

## Version History

See `/docs/CHANGELOG.md` for complete version history.

**v4.1.2** (Current)
- Fixed scraper functionality
- Restored all features from working build
- Two-file architecture (dashboard.html + popup.html)

**v4.1.1**
- Fixed window sizing (800×600px)
- Fixed header consistency (64px)
- Centered scraper layout (420px)
- Internal scrolling only

**v4.1**
- Integrated scraper into dashboard
- Fixed layout and styling

## Support

For issues, see:
- `/docs/README_v4.1.2.md` - Complete user guide
- `/docs/QUICK_START.md` - Quick setup guide
- Main repository README for troubleshooting

## License

Private repository. All rights reserved.
