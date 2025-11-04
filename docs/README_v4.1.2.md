# AISIS Dashboard v4.1.2 - Complete & Working

## 🎉 Overview

**AISIS Dashboard v4.1.2** is the fully functional version that combines:
- ✅ Fixed 800×600px dashboard window with 64px header
- ✅ Working scraper functionality with all features intact
- ✅ Separate 420px popup window for scraping
- ✅ Progress tracking, debug logs, and multiple export formats

This version restores the **reliable scraper functionality** from your working build while implementing the **fixed window layout** you requested.

---

## 🚀 What's New in v4.1.2

### Fixed Dashboard Layout
The main dashboard now has a **fixed 800×600px window** that never resizes:
- **64px header** with consistent padding (24px horizontal)
- **Internal scrolling** with thin 6px scrollbar
- **Logo and version** always in the same position
- **No window resizing** when switching tabs

### Restored Scraper Functionality
The scraper is now in a **separate popup window** (420px × 700px) with:
- **Full credential management** (save/load AISIS username & password)
- **Page selection checkboxes** (8 different AISIS pages)
- **Progress tracking** with percentage bar and status text
- **Color-coded debug logs** (success, warning, error)
- **Multiple export formats** (JSON, CSV, HTML, HAR, logs)
- **Control buttons** (Stop, Resume, Delete Logs, Terminate, Clear All)

### Architecture
- **dashboard.html** - Main dashboard view (800×600px, fixed)
- **popup.html** - Scraper interface (420px × 700px, separate window)
- **dashboard.js** - Dashboard logic (7KB)
- **popup.js** - Scraper UI logic (17KB)
- **background.js** - Service worker for scraping (41KB)
- **headers_helper.js** - HTTP headers helper (863 bytes)

---

## 📦 Installation

### Method 1: Load Unpacked Extension (Recommended for Development)

1. **Extract the ZIP file** to a folder on your computer
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select the extracted folder
6. The extension icon will appear in your Chrome toolbar

### Method 2: Pin the Extension

After installation:
1. Click the **puzzle icon** (Extensions) in Chrome toolbar
2. Find **"AISIS Dashboard"**
3. Click the **pin icon** to keep it visible

---

## 🎯 Usage

### Step 1: Open the Dashboard
Click the AISIS Dashboard extension icon in your Chrome toolbar. The **800×600px dashboard** will open showing:
- **Header**: Logo "(a) v4.1.2" with Refresh Data and Scraper buttons
- **Tabs**: Overview, Grades, Schedule, Student Info, Program of Study
- **Empty state**: "No Data Available - Run the scraper to fetch your AISIS data"

### Step 2: Open the Scraper
Click the **"⚙️ Scraper"** button in the dashboard header. A **separate 420px × 700px popup window** will open with the scraper interface.

### Step 3: Enter Credentials
In the scraper popup:
1. Enter your **AISIS username** (e.g., 254880)
2. Enter your **AISIS password**
3. Click **"Save Credentials"** (stored securely in Chrome local storage)

### Step 4: Select Pages to Scrape
Check the pages you want to scrape:
- ☑️ Schedule of Classes
- ☑️ Official Curriculum
- ☑️ View Grades
- ☑️ Advisory Grades
- ☑️ Currently Enrolled Classes
- ☑️ Tuition Receipt
- ☑️ Student Information

### Step 5: Start Scraping
1. Click **"Start Scraping"**
2. Watch the **progress bar** (e.g., "65% - Scraping page 5 of 8...")
3. Monitor **debug logs** in real-time (color-coded by type)
4. Use **Stop** button to pause, **Resume** to continue

### Step 6: Export Data
Once scraping is complete, use the export buttons:
- **Export JSON** - Download all data as JSON file
- **Export CSV** - Download grades as CSV spreadsheet
- **View Data** - Open dashboard to view formatted data
- **Download Logs** - Save debug logs as text file
- **Export HAR** - Download HTTP Archive for debugging
- **Export HTML** - Save scraped HTML pages

### Step 7: View in Dashboard
Click **"View Data"** or close the scraper popup and click **"🔄 Refresh Data"** in the dashboard. Your data will be displayed in organized tabs.

---

## 🎨 Design Specifications

### Dashboard Window
```
Size: 800px × 600px (fixed, no resizing)
├─ Header: 64px (fixed height)
│  ├─ Padding: 0 24px
│  ├─ Logo: (a) v4.1.2
│  └─ Buttons: Refresh Data, Scraper
└─ Content: 536px (scrollable)
   ├─ Tabs: 5 tabs (Overview, Grades, Schedule, Student Info, Program)
   ├─ Stats: 4 cards (QPI, GPA, Units, Courses)
   └─ Tables: Data tables with ellipsis overflow
```

### Scraper Popup
```
Size: 420px × 700px (separate window)
├─ Header: (a) v4.0
├─ Credentials: Username, Password, Save button
├─ Page Selection: 8 checkboxes
├─ Start Button: Blue Ateneo color
├─ Progress Bar: 32px height, blue fill, white text
├─ Status Text: Below progress bar
├─ Debug Logs: 200px max-height, scrollable
├─ Control Buttons: Stop, Delete Logs
├─ Export Section: 6 buttons (2 columns)
└─ Action Buttons: Terminate, Clear All
```

### Color Palette
- **Ateneo Blue**: `hsl(228, 74%, 30%)` - Primary color
- **Background**: `hsl(0, 0%, 100%)` - White
- **Foreground**: `hsl(220, 90%, 8%)` - Dark text
- **Muted**: `hsl(220, 14%, 96%)` - Light gray
- **Border**: `hsl(220, 13%, 91%)` - Borders
- **Success**: `hsl(142, 76%, 36%)` - Green logs
- **Warning**: `hsl(38, 92%, 50%)` - Orange logs
- **Danger**: `hsl(0, 84%, 60%)` - Red buttons

### Typography
- **Font Family**: Inter (from Google Fonts)
- **Logo**: 1.5rem, font-weight 700, letter-spacing -0.05em
- **Version**: 10px, uppercase, letter-spacing 0.05em
- **Body**: 14px, line-height 1.5
- **Buttons**: 13px, font-weight 500

---

## 🔧 Features

### Dashboard Features
- **Tab Navigation**: Switch between 5 different data views
- **Stats Cards**: Display QPI, GPA, Units Completed, Current Courses
- **Data Tables**: Organized display of grades, schedule, student info
- **Refresh Data**: Reload data from storage
- **Fixed Window**: No resizing, internal scrolling only
- **Responsive Layout**: Adapts to content while maintaining fixed size

### Scraper Features
- **Credential Storage**: Securely save AISIS username & password
- **Multi-Page Scraping**: Select up to 8 different AISIS pages
- **Progress Tracking**: Real-time progress bar with percentage
- **Status Updates**: "Scraping page X of Y..." text
- **Debug Logs**: Color-coded logs (info, success, warning, error)
- **Pause/Resume**: Stop scraping and resume later
- **Export Options**: JSON, CSV, HTML, HAR, logs
- **Error Handling**: Graceful error messages and recovery
- **Session Management**: Maintains login state across scrapes

### Export Formats
1. **JSON** - Complete data structure for programmatic use
2. **CSV** - Grades data in spreadsheet format
3. **HTML** - Raw HTML pages from AISIS
4. **HAR** - HTTP Archive for network debugging
5. **Logs** - Debug logs as text file

---

## 📊 Data Structure

### Scraped Data Format
```json
{
  "scrapedData": {
    "grades": [
      {
        "schoolYear": "2024-2025",
        "semester": "1",
        "courseCode": "CS 101",
        "courseTitle": "Introduction to Computer Science",
        "units": "3",
        "grade": "1.25"
      }
    ],
    "schedule": [
      {
        "courseCode": "CS 101",
        "section": "A",
        "schedule": "MWF 10:00-11:00",
        "room": "SEC-A201",
        "instructor": "Dr. Smith"
      }
    ],
    "studentInfo": {
      "studentId": "254880",
      "name": "Juan Dela Cruz",
      "program": "BS Computer Science"
    },
    "programOfStudy": {
      "text": "Program curriculum details..."
    }
  },
  "timestamp": "2025-11-03T01:36:00.000Z",
  "version": "4.1.2"
}
```

---

## 🐛 Troubleshooting

### Dashboard Not Opening
- **Check extension is enabled**: Go to `chrome://extensions/` and ensure AISIS Dashboard is enabled
- **Reload extension**: Click the refresh icon on the extension card
- **Check console**: Right-click extension icon → Inspect popup → Console tab

### Scraper Popup Not Opening
- **Check popup blocker**: Ensure Chrome allows popups for the extension
- **Verify manifest**: Make sure `popup.html` exists in the extension folder
- **Check permissions**: Extension needs `storage` and `downloads` permissions

### Scraping Fails
- **Verify credentials**: Make sure username and password are correct
- **Check AISIS status**: Ensure AISIS website is accessible
- **Review logs**: Check debug logs for error messages
- **Clear data**: Click "Clear All Data & Start Fresh" and try again

### Data Not Loading in Dashboard
- **Click Refresh**: Use the "🔄 Refresh Data" button
- **Check storage**: Open DevTools → Application → Storage → Local Storage
- **Verify scraping completed**: Ensure scraper finished successfully

### Progress Bar Not Updating
- **Check background script**: Go to `chrome://extensions/` → Details → Inspect views: service worker
- **Review console logs**: Look for errors in the service worker console
- **Restart scraping**: Stop and start the scraping process again

---

## 🔒 Privacy & Security

### Data Storage
- **Local only**: All data stored in Chrome local storage (never sent to external servers)
- **Credentials**: Username and password encrypted by Chrome's storage API
- **No tracking**: Extension does not collect analytics or usage data

### Permissions
- **storage**: Required to save credentials and scraped data
- **downloads**: Required to export data as files
- **host_permissions**: Required to access AISIS website for scraping

### Security Best Practices
- **Use strong passwords**: Your AISIS password is stored locally but should still be strong
- **Keep extension updated**: Always use the latest version for security fixes
- **Review permissions**: Check what permissions the extension requests

---

## 📝 Changelog

### v4.1.2 (2025-11-03) - Current Version
**Fixed**:
- ✅ Restored full scraper functionality from working build
- ✅ Fixed dashboard window to 800×600px (no resizing)
- ✅ Implemented 64px header with consistent padding
- ✅ Added internal scrolling with thin 6px scrollbar
- ✅ Separated dashboard and scraper into two files
- ✅ Maintained 420px scraper popup window

**Architecture**:
- Dashboard: 800×600px fixed window (dashboard.html)
- Scraper: 420px × 700px popup window (popup.html)
- Separate JS files for better organization

### v4.1.1 (2025-11-03)
**Attempted**:
- Integrated scraper into dashboard as fullscreen view
- Added view switching between dashboard and scraper
- Centered scraper at 420px width

**Issues**:
- ❌ Scraper functionality broke during integration
- ❌ Debug logs, buttons, and reliability issues

### v4.1.0 (2025-11-02)
**Added**:
- Initial integration attempt
- Fixed window size concept
- Header consistency improvements

### v4.0 (2025-11-02) - Working Base Version
**Features**:
- Fully functional scraper in separate popup
- Dashboard with tabs and data display
- Progress tracking and debug logs
- Multiple export formats
- Credential management

---

## 🎯 Best Practices

### For Users
1. **Save credentials** before starting to scrape
2. **Select only needed pages** to reduce scraping time
3. **Monitor logs** for errors or warnings
4. **Export data regularly** as backup
5. **Clear old data** before new scraping session

### For Developers
1. **Keep files separated** (dashboard.html vs popup.html)
2. **Use consistent naming** for IDs and classes
3. **Follow design system** (24→16→12→8px spacing)
4. **Test in Chrome** before deploying
5. **Version control** all changes

---

## 🚀 Future Enhancements

### Planned Features
- **Auto-refresh**: Automatically refresh data every X hours
- **Data comparison**: Compare grades across semesters
- **GPA calculator**: Calculate QPI and GPA from grades
- **Export to PDF**: Generate formatted PDF reports
- **Dark mode**: Toggle between light and dark themes
- **Notifications**: Alert when new grades are posted

### Under Consideration
- **Cloud sync**: Optional cloud backup of data
- **Mobile app**: Companion mobile application
- **API integration**: RESTful API for external access
- **Advanced filtering**: Filter and sort data tables
- **Charts & graphs**: Visual representation of grades

---

## 📞 Support

For issues, questions, or feature requests:
- **GitHub Issues**: (if repository is public)
- **Email**: (your support email)
- **Documentation**: This README file

---

## 📄 License

This extension is provided as-is for educational and personal use. Not affiliated with Ateneo de Manila University or AISIS.

---

## 🙏 Credits

- **Design System**: Based on Ateneo branding guidelines
- **Font**: Inter by Rasmus Andersson (Google Fonts)
- **Icons**: Unicode emoji characters
- **Framework**: Vanilla JavaScript (no dependencies)

---

**Version**: 4.1.2  
**Last Updated**: November 3, 2025  
**Status**: ✅ Fully Functional & Tested
