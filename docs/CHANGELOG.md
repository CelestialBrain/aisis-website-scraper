# AISIS Dashboard - Changelog

## [4.1] - 2024-11-02

### ✨ Added
- **Integrated Scraper View**: Scraper is now embedded directly into the dashboard instead of opening as a separate popup
- **View Switching System**: Seamless navigation between Dashboard and Scraper views
- **Dynamic Header Buttons**: Buttons change based on current view (Scraper ↔ Back to Dashboard)
- **Centered Scraper Layout**: Scraper interface centered at 420px width for optimal usability
- **Enhanced Progress Bar**: Rectangular progress bar with green fill, percentage display, and status text

### 🔧 Changed
- Merged `popup.js` functionality into `dashboard.js` for unified codebase
- Updated `dashboard.html` to include both dashboard and scraper views
- Improved JavaScript architecture with view management system
- Refactored button visibility logic for cleaner state management

### 🐛 Fixed
- Progress bar now displays correctly with proper styling
- View switching maintains state across transitions
- Header button visibility properly toggles between views
- All scraper functionality works in integrated mode

### 📚 Documentation
- Added comprehensive README_v4.1.md
- Created QUICK_START.md for new users
- Included detailed troubleshooting section

---

## [4.0] - 2024-11-01

### ✨ Added
- **Complete Dashboard Redesign**: Transformed from simple scraper to full-featured dashboard
- **5 Dashboard Tabs**: Overview, Grades, Schedule, Student Info, Program of Study
- **Statistics Cards**: Display QPI, GPA, Units Completed, Current Courses
- **Data Tables**: Clean, organized presentation of scraped data
- **Ateneo Blue Theme**: Professional styling matching user's website
- **Styled Logo**: Exact match with website branding (1.5rem, -0.05em letter-spacing)

### 🔧 Changed
- Updated header design with compact buttons (4px/10px padding, 12px font)
- Improved version positioning (10px font, top 7.3px)
- Enhanced table styling with no horizontal scrolling (max-width 200px, ellipsis)
- Refined color scheme using HSL variables

### 🐛 Fixed
- Horizontal scrolling in tables eliminated
- Button sizing made more compact
- Logo positioning matches website exactly
- Version text alignment corrected

---

## [3.x] - 2024-10-30

### ✨ Added
- **Core Scraping Functionality**: Automated data extraction from AISIS
- **Authentication System**: Login with AISIS credentials
- **Page Selection**: Choose which pages to scrape (8 options)
- **Progress Tracking**: Real-time progress updates
- **Debug Logging**: Detailed logs with color coding
- **Pause/Resume**: Soft stop functionality
- **Terminate**: Hard stop option
- **Export Features**: JSON, CSV, HAR, HTML exports

### 🔧 Changed
- Increased timeout from 30s to 60s
- Implemented 3 retry attempts with exponential backoff
- Improved error handling and recovery

### 🐛 Fixed
- Timeout issues with slow AISIS responses
- Retry logic for failed requests
- Stop/resume button states
- Session tracking

---

## [2.x] - 2024-10-25

### ✨ Added
- Basic scraper with single-page support
- Simple popup interface
- JSON export

---

## [1.0] - 2024-10-20

### ✨ Added
- Initial release
- Proof of concept scraper
- Manual data extraction

---

## Version Numbering

- **Major version (X.0)**: Complete redesigns or major architectural changes
- **Minor version (x.Y)**: New features or significant improvements
- **Patch version (x.x.Z)**: Bug fixes and minor tweaks

## Future Plans

### Planned for v4.2
- [ ] Automatic data refresh on dashboard load
- [ ] Better error messages for users
- [ ] Export to PDF format
- [ ] Data visualization charts
- [ ] Filter and search functionality in tables

### Planned for v5.0
- [ ] Multiple user profiles
- [ ] Data comparison across semesters
- [ ] GPA calculator
- [ ] Course planning tools
- [ ] Notification system for grade updates

### Under Consideration
- [ ] Dark mode theme
- [ ] Customizable dashboard layouts
- [ ] Integration with Google Calendar
- [ ] Mobile companion app
- [ ] Cloud sync (optional)

---

**Current Version**: 4.1  
**Release Date**: November 2, 2024  
**Status**: Stable
