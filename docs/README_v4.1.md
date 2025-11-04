# AISIS Auto Scraper v4.1 - Integrated Dashboard

## 🎉 What's New in v4.1

### Major Feature: Integrated Scraper View
The scraper is now **fully integrated into the dashboard** instead of opening as a separate popup window. This provides a seamless, unified experience for managing your AISIS data.

### Key Improvements

#### 1. **Unified Interface**
- Click **"⚙️ Scraper"** button in the header to access the scraper
- Scraper view replaces the entire dashboard content (fullscreen mode)
- Scraper interface is centered at **420px width** for optimal usability
- Click **"← Back to Dashboard"** to return to the data view

#### 2. **Seamless Navigation**
- Header buttons dynamically change based on current view
- Dashboard tabs remain accessible during scraping
- All data persists across view switches
- No need to close/reopen windows

#### 3. **Enhanced Progress Visualization**
- **Rectangular progress bar** with green fill animation
- **Percentage display** centered inside the progress bar
- **Status text** showing current operation (e.g., "Scraping page 5 of 8...")
- **Real-time log updates** with color-coded messages:
  - ✓ Green for success
  - ⚠ Orange for warnings
  - Red for errors

#### 4. **Improved Workflow**
```
Dashboard → Click "Scraper" → Enter credentials → Select pages → 
Start scraping → Monitor progress → Click "Back to Dashboard" → 
View scraped data in tabs
```

## 📋 Features

### Dashboard View
- **5 Tabs**: Overview, Grades, Schedule, Student Info, Program of Study
- **Statistics Cards**: Current QPI, Cumulative GPA, Units Completed, Current Courses
- **Data Tables**: Clean, organized display of all scraped information
- **Refresh Button**: Reload data from storage without re-scraping

### Scraper View
- **Credential Management**: Save and auto-load AISIS credentials
- **Page Selection**: Choose which pages to scrape (8 options available)
- **Progress Tracking**: Visual progress bar with percentage and status
- **Debug Logs**: Real-time logging with color-coded messages
- **Pause/Resume**: Soft stop allows resuming scraping later
- **Terminate**: Hard stop to completely end scraping session

### Export Options
- **JSON**: Full structured data export
- **CSV**: Spreadsheet-compatible format
- **HAR**: HTTP Archive for network analysis
- **HTML**: Raw HTML snapshots of scraped pages
- **Logs**: Download all debug logs as text file

## 🚀 Installation

1. **Download** the extension package: `aisis_dashboard_v4.1_integrated.zip`

2. **Extract** the ZIP file to a folder on your computer

3. **Open Chrome** and navigate to `chrome://extensions/`

4. **Enable Developer Mode** (toggle in top-right corner)

5. **Click "Load unpacked"** and select the extracted folder

6. **Pin the extension** to your toolbar for easy access

## 📖 Usage Guide

### First Time Setup

1. **Click the extension icon** to open the dashboard

2. **Click "⚙️ Scraper"** button in the header

3. **Enter your AISIS credentials**:
   - Username: Your AISIS username
   - Password: Your AISIS password
   - Click **"Save Credentials"** (stored locally, never sent anywhere except AISIS)

4. **Select pages to scrape**:
   - Schedule of Classes
   - Official Curriculum
   - View Grades
   - Advisory Grades
   - Currently Enrolled Classes
   - My Class Schedule
   - Tuition Receipt
   - Student Information

5. **Click "Start Scraping"**

6. **Monitor progress**:
   - Watch the green progress bar fill up
   - Read status messages below the bar
   - Check debug logs for detailed information

7. **After completion**:
   - Click **"← Back to Dashboard"** to view your data
   - Navigate through tabs to explore different sections
   - Use export buttons if you need to save data externally

### Subsequent Uses

- Your credentials are saved, so you can start scraping immediately
- Previous data remains until you clear it or scrape again
- You can pause scraping and resume later
- Dashboard data updates automatically after scraping completes

## 🎨 Design Features

### Ateneo Blue Theme
- **Primary Color**: `#0033A0` (Ateneo Blue)
- **Font**: Inter (Google Fonts)
- **Logo**: Exact match with user's website styling
  - Font size: 1.5rem
  - Font weight: 700
  - Letter spacing: -0.05em
  - Position: top 2px

### Compact Header
- Small buttons: 4px vertical padding, 10px horizontal padding
- Font size: 12px
- Version text: 10px, positioned at top 7.3px

### Responsive Tables
- No horizontal scrolling
- Text overflow with ellipsis
- Max width: 200px per cell
- Hover effects for better readability

## 🔧 Technical Details

### Architecture
- **Manifest V3**: Modern Chrome extension format
- **Service Worker**: Background script handles all scraping logic
- **Local Storage**: All data stored in `chrome.storage.local`
- **Message Passing**: Communication between UI and background script

### Data Persistence
- Scraped data persists across browser restarts
- Logs are saved and can be restored
- Credentials are encrypted by Chrome's storage API
- Session tracking with unique IDs

### Error Handling
- **60-second timeout** per request
- **3 retry attempts** with exponential backoff
- Detailed error logging
- Graceful failure recovery

### Security
- Credentials never leave your computer (except to AISIS)
- No external servers or analytics
- All data stored locally
- No permissions beyond necessary ones

## 📦 File Structure

```
aisis_dashboard_v4.1_integrated/
├── manifest.json          # Extension configuration
├── dashboard.html         # Main UI (dashboard + scraper views)
├── dashboard.js          # Integrated JavaScript (view switching + scraping)
├── background.js         # Service worker (scraping logic)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🐛 Known Issues & Limitations

1. **AISIS Authentication**: Requires valid AISIS credentials
2. **Session Expiry**: AISIS sessions may expire during long scraping operations
3. **Data Format**: Scraped data structure depends on AISIS HTML structure
4. **Chrome Only**: Designed specifically for Chrome/Chromium browsers

## 🔄 Version History

### v4.1 (Current)
- ✨ Integrated scraper directly into dashboard
- ✨ Centered scraper view at 420px width
- ✨ Dynamic header button switching (Scraper ↔ Back to Dashboard)
- ✨ Fixed progress bar display and styling
- ✨ Improved view switching logic
- ✨ Enhanced user workflow

### v4.0
- Complete dashboard redesign with 5 tabs
- Ateneo Blue theme matching user's website
- Compact header with styled logo
- Fixed horizontal scrolling in tables
- Improved button sizing and positioning

### v3.x
- Basic scraper functionality
- Separate popup interface
- Export to JSON/CSV/HAR
- Pause/resume/terminate controls

## 💡 Tips & Tricks

1. **Save Credentials**: Always save your credentials to avoid re-entering them
2. **Select Multiple Pages**: You can scrape multiple pages in one session
3. **Monitor Logs**: Check debug logs if scraping seems stuck
4. **Pause if Needed**: Use the soft stop (pause) if you need to interrupt scraping
5. **Export Data**: Export to JSON for backup or external analysis
6. **Refresh Dashboard**: Click refresh button after scraping to ensure latest data is displayed

## 🆘 Troubleshooting

### Scraping Stuck or Slow
- Check your internet connection
- Verify AISIS is accessible
- Look at debug logs for error messages
- Try pausing and resuming

### No Data in Dashboard
- Ensure scraping completed successfully
- Click the "Refresh Data" button
- Check if you selected any pages to scrape
- Verify credentials are correct

### Progress Bar Not Showing
- Progress bar only appears after clicking "Start Scraping"
- Ensure JavaScript is enabled
- Try refreshing the extension

### Extension Not Loading
- Verify all files are in the correct folder
- Check Chrome's Developer Mode is enabled
- Look for errors in `chrome://extensions/`
- Try removing and re-adding the extension

## 📧 Support

For issues, questions, or feature requests, please contact the developer or refer to the project documentation.

## 📄 License

This extension is provided as-is for educational and personal use. Please respect Ateneo's terms of service when using this tool.

---

**Version**: 4.1  
**Last Updated**: November 2024  
**Developed for**: Ateneo Integrated Student Information System (AISIS)
