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

const extensionApi = typeof chrome !== 'undefined' ? chrome : null;

function applyExtensionVersion() {
    if (!extensionApi?.runtime?.getManifest) {
        return;
    }
    try {
        const manifest = extensionApi.runtime.getManifest();
        if (!manifest?.version) {
            return;
        }
        const versionText = `v${manifest.version}`;
        document.querySelectorAll('[data-version]').forEach((element) => {
            element.textContent = versionText;
            element.setAttribute('title', `Version ${manifest.version}`);
        });
    } catch (error) {
        console.warn('Unable to determine popup version:', error);
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    applyExtensionVersion();

    // DOM Elements
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const saveCredentialsBtn = document.getElementById('save-credentials');
    const startScrapingBtn = document.getElementById('start-scraping');
    const stopScrapingBtn = document.getElementById('stop-scraping');
    const progressSection = document.getElementById('progress-section');
    const logsSection = document.getElementById('logs-section');
    const exportSection = document.getElementById('export-section');
    const progressFill = document.getElementById('progress-fill');
    const progressValue = document.getElementById('progress-value');
    const statusText = document.getElementById('status-text');
    const timeEstimate = document.getElementById('time-estimate');
    const logsContainer = document.getElementById('logs-container');
    const logLimitNotice = document.getElementById('log-limit-notice');
    const downloadLogsBtn = document.getElementById('download-logs');
    const exportJsonBtn = document.getElementById('export-json');
    const exportCsvBtn = document.getElementById('export-csv');
    const viewDataBtn = document.getElementById('view-data');
    const stopScrapingLogsBtn = document.getElementById('stop-scraping-logs');
    const resumeScrapingLogsBtn = document.getElementById('resume-scraping-logs');
    const sessionInfo = document.getElementById('session-info');
    const sessionIdSpan = document.getElementById('session-id');
    const pageSelects = Array.from(document.querySelectorAll('.page-select'));

    const formatCookieDisplay = (value) => {
        if (!value) {
            return '';
        }
        return value.length > 32 ? `${value.slice(0, 16)}…${value.slice(-8)}` : value;
    };

    let currentWindowId = null;
    let boundsListener = null;
    const POPUP_WIDTH = 420;
    const POPUP_HEIGHT = 700;

    function enforceWindowBounds() {
        if (currentWindowId === null || !chrome?.windows?.update) {
            return;
        }
        chrome.windows.update(currentWindowId, {
            width: POPUP_WIDTH,
            height: POPUP_HEIGHT
        });
    }

    if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.getCurrent) {
        chrome.windows.getCurrent((windowInfo) => {
            if (windowInfo && typeof windowInfo.id === 'number') {
                currentWindowId = windowInfo.id;
                enforceWindowBounds();
                if (chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({ action: 'registerPopupWindow', windowId: currentWindowId });
                }
                if (chrome.windows?.onBoundsChanged && !boundsListener) {
                    boundsListener = (windowId) => {
                        if (windowId === currentWindowId) {
                            enforceWindowBounds();
                        }
                    };
                    chrome.windows.onBoundsChanged.addListener(boundsListener);
                }
            }
        });
    }

    window.addEventListener('unload', () => {
        if (boundsListener && chrome?.windows?.onBoundsChanged?.removeListener) {
            chrome.windows.onBoundsChanged.removeListener(boundsListener);
            boundsListener = null;
        }
        if (currentWindowId !== null && chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'unregisterPopupWindow', windowId: currentWindowId });
        }
    });
    
    // Load saved credentials
    const credentials = await loadCredentials();
    if (credentials) {
        usernameInput.value = credentials.username;
        passwordInput.value = credentials.password;
    }
    
    // Check current scraping state
    const state = await getState();
    const hasExistingData = state.scrapedData && Object.keys(state.scrapedData).length > 0;
    
    // Restore session cookie if available
    if (state.cookieSession) {
        sessionInfo.classList.remove('hidden');
        sessionIdSpan.textContent = formatCookieDisplay(state.cookieSession);
        sessionIdSpan.title = state.cookieSession;
    } else if (state.sessionId) {
        sessionInfo.classList.remove('hidden');
        sessionIdSpan.textContent = formatCookieDisplay(state.sessionId);
        sessionIdSpan.title = state.sessionId;
    } else if (sessionInfo) {
        sessionInfo.classList.add('hidden');
    }
    
    restoreSelectedPages(state.selectedPages);

    updateUI(state);

    // Restore UI based on state
    if (state.isRunning) {
        showProgress();
        applyControlState(state);
    } else if (state.isPaused) {
        // Show paused state with resume option
        progressSection.classList.remove('hidden');
        exportSection.classList.remove('hidden');
        stopScrapingBtn.classList.add('hidden');
        startScrapingBtn.textContent = 'Resume Scraping';
        startScrapingBtn.classList.remove('hidden');
        // Update logs section buttons
        if (stopScrapingLogsBtn && resumeScrapingLogsBtn) {
            stopScrapingLogsBtn.classList.add('hidden');
            resumeScrapingLogsBtn.classList.remove('hidden');
        }
        applyControlState(state);
    } else if (state.isCompleted || hasExistingData) {
        // Allow additional scraping runs without resetting state
        showProgress();
        exportSection.classList.remove('hidden');
        stopScrapingBtn.classList.add('hidden');
        startScrapingBtn.textContent = hasExistingData ? 'Scrape More Data' : 'Start Scraping';
        startScrapingBtn.classList.remove('hidden');
        applyControlState(state);
    } else {
        applyControlState(state);
    }
    
    // Event Listeners
    saveCredentialsBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!username || !password) {
            alert('Please enter both username and password');
            return;
        }
        
        const result = await sendMessage({ 
            action: 'saveCredentials', 
            username, 
            password 
        });
        
        if (result.success) {
            alert('Credentials saved successfully!');
            saveCredentialsBtn.textContent = '✓ Saved';
            setTimeout(() => {
                saveCredentialsBtn.textContent = 'Save Credentials';
            }, 2000);
        } else {
            alert('Failed to save credentials: ' + result.error);
        }
    });
    
    startScrapingBtn.addEventListener('click', async () => {
        // Check if this is a resume action
        if (startScrapingBtn.textContent === 'Resume Scraping') {
            const resumePromise = sendMessage({ action: 'resumeScraping' });
            const refreshedState = await getState();
            updateUI(refreshedState);
            applyControlState(refreshedState);
            const result = await resumePromise;
            if (result.success) {
                showProgress();
                exportSection.classList.add('hidden');
                startScrapingBtn.textContent = 'Start Scraping';
                startScrapingBtn.classList.add('hidden');
                stopScrapingBtn.classList.remove('hidden');
            } else {
                alert('Failed to resume: ' + result.error);
                const latest = await getState();
                updateUI(latest);
                applyControlState(latest);
            }
            return;
        }

        // Get selected pages
        const { selectedPages, hasSelection } = collectSelectedPages();

        if (!hasSelection) {
            alert('Please select at least one page to scrape');
            return;
        }

        // Check if credentials are saved
        const creds = await loadCredentials();
        if (!creds) {
            alert('Please save your credentials first');
            return;
        }

        // Start scraping
        showProgress();
        logsSection.classList.remove('hidden');

        const startPromise = sendMessage({
            action: 'startScraping',
            options: { pages: selectedPages }
        });

        const refreshedState = await getState();
        updateUI(refreshedState);
        applyControlState(refreshedState);

        const result = await startPromise;
        if (!result.success) {
            alert('Failed to start scraping: ' + result.error);
            hideProgress();
            const latest = await getState();
            updateUI(latest);
            applyControlState(latest);
        }
    });

    stopScrapingBtn.addEventListener('click', async () => {
        const stopPromise = sendMessage({ action: 'stopScraping' });
        const refreshed = await getState();
        updateUI(refreshed);
        applyControlState(refreshed);
        const result = await stopPromise;
        if (result.success && result.paused) {
            // Show export section but keep scraping controls visible
            exportSection.classList.remove('hidden');
            stopScrapingBtn.classList.add('hidden');
            startScrapingBtn.textContent = 'Resume Scraping';
            startScrapingBtn.classList.remove('hidden');
            const latest = await getState();
            updateUI(latest);
            applyControlState(latest);
        }
    });

    // Stop button in logs section
    if (stopScrapingLogsBtn && resumeScrapingLogsBtn) {
        stopScrapingLogsBtn.addEventListener('click', async () => {
            const stopPromise = sendMessage({ action: 'stopScraping' });
            const refreshed = await getState();
            updateUI(refreshed);
            applyControlState(refreshed);
            const result = await stopPromise;
            if (result.success && result.paused) {
                // Toggle buttons in logs section
                stopScrapingLogsBtn.classList.add('hidden');
                resumeScrapingLogsBtn.classList.remove('hidden');

                // Show export section and update main buttons
                exportSection.classList.remove('hidden');
                stopScrapingBtn.classList.add('hidden');
                startScrapingBtn.textContent = 'Resume Scraping';
                startScrapingBtn.classList.remove('hidden');
                const latest = await getState();
                updateUI(latest);
                applyControlState(latest);
            }
        });

        resumeScrapingLogsBtn.addEventListener('click', async () => {
            // Same as clicking main Resume button
            startScrapingBtn.click();
        });
    }
    
    downloadLogsBtn.addEventListener('click', async () => {
        const state = await getState();
        const logsText = state.logs.map(log => {
            const context = formatLogContextPlain(log.context);
            return `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}${context ? ' | ' + context : ''}`;
        }).join('\n');

        downloadFile(logsText, 'aisis_scraper_logs.txt', 'text/plain');
    });
    
    exportJsonBtn.addEventListener('click', async () => {
        const state = await getState();
        const jsonData = JSON.stringify(state.scrapedData, null, 2);
        downloadFile(jsonData, 'aisis_data.json', 'application/json');
    });
    
    exportCsvBtn.addEventListener('click', async () => {
        const state = await getState();
        const csvData = convertToCSV(state.scrapedData);
        downloadFile(csvData, 'aisis_data.csv', 'text/csv');
    });
    
    viewDataBtn.addEventListener('click', async () => {
        const state = await getState();
        const dataWindow = window.open('', '_blank');
        dataWindow.document.write('<html><head><title>AISIS Scraped Data</title>');
        dataWindow.document.write('<style>body{font-family:monospace;padding:20px;background:#f5f5f5;}pre{background:white;padding:15px;border-radius:8px;overflow:auto;}</style>');
        dataWindow.document.write('</head><body>');
        dataWindow.document.write('<h2>AISIS Scraped Data</h2>');
        dataWindow.document.write('<pre>' + JSON.stringify(state.scrapedData, null, 2) + '</pre>');
        dataWindow.document.write('</body></html>');
        dataWindow.document.close();
    });
    
    const exportHarBtn = document.getElementById('export-har');
    const exportHtmlBtn = document.getElementById('export-html');
    
    exportHarBtn.addEventListener('click', async () => {
        const result = await sendMessage({ action: 'exportHAR' });
        if (result.success) {
            const harData = JSON.stringify(result.har, null, 2);
            downloadFile(harData, 'aisis_scraper.har', 'application/json');
        }
    });
    
    exportHtmlBtn.addEventListener('click', async () => {
        const result = await sendMessage({ action: 'exportHTMLSnapshots' });
        if (result.success) {
            const htmlData = JSON.stringify(result.snapshots, null, 2);
            downloadFile(htmlData, 'aisis_html_snapshots.json', 'application/json');
        }
    });
    
    const hardStopBtn = document.getElementById('hard-stop');
    hardStopBtn.addEventListener('click', async () => {
        if (confirm('Are you sure? This will permanently stop scraping and you cannot resume.')) {
            const result = await sendMessage({ action: 'hardStopScraping' });
            if (result.success && result.terminated) {
                // Hide resume button and show only export options
                startScrapingBtn.classList.add('hidden');
                stopScrapingBtn.classList.add('hidden');
                hardStopBtn.classList.add('hidden');
                progressSection.classList.add('hidden');
            }
        }
    });
    
    const clearAllDataBtn = document.getElementById('clear-all-data');
    clearAllDataBtn.addEventListener('click', async () => {
        if (confirm('Clear ALL data (logs, session, scraped data)? This cannot be undone!')) {
            const result = await sendMessage({ action: 'clearAllData' });
            if (result.success) {
                // Reset UI to initial state
                location.reload();
            }
        }
    });
    
    const deleteLogsBtn = document.getElementById('delete-logs');
    deleteLogsBtn.addEventListener('click', async () => {
        if (confirm('Delete logs only? (Session and scraped data will be kept)')) {
            const result = await sendMessage({ action: 'deleteLogs' });
            if (result.success) {
                logsContainer.innerHTML = '';
            }
        }
    });
    
    // Listen for updates from background script
    chrome.runtime.onMessage.addListener((message) => {
        if (!message || !message.action) {
            return;
        }

        if (message.action === 'updateProgress') {
            updateUI(message.state);
            applyControlState(message.state);
        } else if (message.action === 'scrapingComplete') {
            updateUI(message.state);
            applyControlState(message.state);
            hideProgress();
            showExport();
            alert('Scraping completed successfully!');
        } else if (message.action === 'scrapingError') {
            updateUI(message.state);
            applyControlState(message.state);
            alert('Scraping failed. Check logs for details.');
        }
    });
    
    // Helper Functions
    function showProgress() {
        progressSection.classList.remove('hidden');
        logsSection.classList.remove('hidden');
    }
    
    function hideProgress() {
        progressSection.classList.add('hidden');
    }
    
    function showExport() {
        exportSection.classList.remove('hidden');
    }
    
    function updateUI(state = {}) {
        // Update session cookie display
        if (sessionInfo && sessionIdSpan) {
            if (state.cookieSession) {
                sessionInfo.classList.remove('hidden');
                sessionIdSpan.textContent = formatCookieDisplay(state.cookieSession);
                sessionIdSpan.title = state.cookieSession;
            } else if (state.sessionId) {
                sessionInfo.classList.remove('hidden');
                sessionIdSpan.textContent = formatCookieDisplay(state.sessionId);
                sessionIdSpan.title = state.sessionId;
            } else {
                sessionInfo.classList.add('hidden');
                sessionIdSpan.textContent = '';
                sessionIdSpan.removeAttribute('title');
            }
        }

        // Update progress bar
        const progressPercent = computeProgressPercent(state);
        if (progressFill) {
            progressFill.style.width = progressPercent + '%';
            progressFill.textContent = '';
        }
        if (progressValue) {
            progressValue.textContent = progressPercent + '%';
        }

        // Update status text
        statusText.textContent = state.currentStep || 'Idle';

        // Update time estimate
        if (state.startTime && progressPercent > 0 && progressPercent < 100) {
            const elapsed = Date.now() - state.startTime;
            const estimated = (elapsed / progressPercent) * (100 - progressPercent);
            const minutes = Math.floor(estimated / 60000);
            const seconds = Math.floor((estimated % 60000) / 1000);
            timeEstimate.textContent = `Estimated time remaining: ${minutes}m ${seconds}s`;
        } else {
            timeEstimate.textContent = '';
        }

        // Update logs
        const logs = Array.isArray(state.logs) ? state.logs : [];
        if (logs.length > 0) {
            logsContainer.innerHTML = logs.map(renderLogEntry).join('');
            logsContainer.scrollTop = logsContainer.scrollHeight;
            if (logLimitNotice) {
                logLimitNotice.classList.toggle('hidden', !state.logsTrimmed);
            }
            logsSection.classList.remove('hidden');
        } else {
            logsContainer.innerHTML = '';
            if (logLimitNotice) {
                logLimitNotice.classList.add('hidden');
            }
            if (!state.isRunning && !state.isPaused) {
                logsSection.classList.add('hidden');
            }
        }

    }
    
    async function loadCredentials() {
        const result = await sendMessage({ action: 'loadCredentials' });
        return result.success ? result.credentials : null;
    }
    
    async function getState() {
        const result = await sendMessage({ action: 'getState' });
        return result.state || { logs: [], scrapedData: {} };
    }
    
    function sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response || {});
            });
        });
    }
    
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Don't use saveAs to prevent popup from closing
        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: false,
            conflictAction: 'uniquify'
        }, () => {
            URL.revokeObjectURL(url);
        });
    }
    
    const DATASET_EXPORT_ORDER = [
        'scheduleOfClasses',
        'officialCurriculum',
        'grades',
        'advisoryGrades',
        'enrolledClasses',
        'classSchedule',
        'tuitionReceipt',
        'studentInfo',
        'programOfStudy',
        'holdOrders',
        'facultyAttendance'
    ];

    const DATASET_COLUMN_CONFIG = {
        scheduleOfClasses: [
            { key: 'department' },
            { key: 'subjectCode' },
            { key: 'section' },
            { key: 'courseTitle' },
            { key: 'units' },
            { key: 'time' },
            { key: 'room' },
            { key: 'instructor' },
            { key: 'maxNo', label: 'Max' },
            { key: 'lang' },
            { key: 'level' },
            { key: 'freeSlots' },
            { key: 'remarks' }
        ],
        officialCurriculum: [
            'degreeProgram',
            'degreeCode',
            'catNo',
            'courseTitle',
            'units',
            'prerequisites',
            'category'
        ],
        grades: [
            'schoolYear',
            'semester',
            'program',
            'courseCode',
            'courseTitle',
            'units',
            'grade'
        ]
    };

    function convertToCSV(data) {
        if (!data || typeof data !== 'object') {
            return 'No data available';
        }

        const sections = [];
        const handledKeys = new Set();

        const orderedKeys = DATASET_EXPORT_ORDER.filter(key => data[key] !== undefined);
        const remainingKeys = Object.keys(data).filter(key => !handledKeys.has(key) && !orderedKeys.includes(key));

        [...orderedKeys, ...remainingKeys].forEach(key => {
            handledKeys.add(key);
            const dataset = data[key];
            if (!dataset) {
                return;
            }

            const label = formatDatasetLabel(key);

            if (Array.isArray(dataset)) {
                const section = convertArrayDatasetToSection(label, dataset, DATASET_COLUMN_CONFIG[key]);
                if (section) {
                    sections.push(section);
                }
            } else if (dataset && typeof dataset === 'object') {
                const tableSections = convertTableDatasetToSections(label, dataset);
                sections.push(...tableSections);
            }
        });

        return sections.length > 0 ? sections.join('\n') : 'No data available';
    }

    function formatDatasetLabel(key) {
        if (DATASET_LABELS[key]) {
            return DATASET_LABELS[key];
        }
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, chr => chr.toUpperCase())
            .trim();
    }

    function convertArrayDatasetToSection(label, items, configuredColumns) {
        if (!Array.isArray(items) || items.length === 0) {
            return null;
        }

        const columns = getColumnsForItems(items, configuredColumns);
        if (!columns.length) {
            return null;
        }

        const headerLine = columns.map(column => escapeForCSV(column.label)).join(',');
        const dataLines = items.map(item => {
            return columns
                .map(column => escapeForCSV(item?.[column.key]))
                .join(',');
        });

        return [label.toUpperCase(), headerLine, ...dataLines, ''].join('\n');
    }

    function convertTableDatasetToSections(label, dataset) {
        const sections = [];
        if (dataset.capturedAt) {
            sections.push(createMetadataSection(label, dataset.capturedAt));
        }

        if (Array.isArray(dataset.tables) && dataset.tables.length > 0) {
            dataset.tables.forEach((table, index) => {
                const headers = (table.headers && table.headers.length > 0)
                    ? table.headers
                    : deriveHeadersFromRows(table.rows);

                const rows = Array.isArray(table.rows) ? table.rows : [];
                if (!headers.length && rows.length === 0) {
                    return;
                }

                const sectionTitle = table.caption
                    ? `${label} - ${table.caption}`
                    : `${label}${dataset.tables.length > 1 ? ` (Table ${index + 1})` : ''}`;

                const headerLine = headers.map(header => escapeForCSV(header)).join(',');
                const dataLines = rows.map(row => {
                    const normalizedRow = Array.isArray(row) ? row : [];
                    return headers
                        .map((_, columnIndex) => escapeForCSV(normalizedRow[columnIndex]))
                        .join(',');
                });

                sections.push([sectionTitle.toUpperCase(), headerLine, ...dataLines, ''].join('\n'));
            });
        } else if (dataset.text) {
            sections.push([
                `${label.toUpperCase()} TEXT SNAPSHOT`,
                'Value',
                escapeForCSV(dataset.text),
                ''
            ].join('\n'));
        }

        return sections;
    }

    function createMetadataSection(label, capturedAt) {
        return [
            `${label.toUpperCase()} METADATA`,
            'Field,Value',
            `${escapeForCSV('Captured At')},${escapeForCSV(capturedAt)}`,
            ''
        ].join('\n');
    }

    function getColumnsForItems(items, configuredColumns) {
        if (Array.isArray(configuredColumns) && configuredColumns.length > 0) {
            return configuredColumns
                .map(column => {
                    if (typeof column === 'string') {
                        return {
                            key: column,
                            label: formatColumnLabel(column)
                        };
                    }

                    if (column && typeof column === 'object' && column.key) {
                        return {
                            key: column.key,
                            label: column.label || formatColumnLabel(column.key)
                        };
                    }

                    return null;
                })
                .filter(Boolean);
        }

        const columnMap = new Map();
        items.forEach(item => {
            if (item && typeof item === 'object') {
                Object.keys(item).forEach(key => {
                    if (!columnMap.has(key)) {
                        columnMap.set(key, {
                            key,
                            label: formatColumnLabel(key)
                        });
                    }
                });
            }
        });

        return Array.from(columnMap.values());
    }

    function deriveHeadersFromRows(rows) {
        if (!Array.isArray(rows)) {
            return [];
        }
        let maxColumns = 0;
        rows.forEach(row => {
            if (Array.isArray(row)) {
                maxColumns = Math.max(maxColumns, row.length);
            }
        });
        return Array.from({ length: maxColumns }, (_, index) => `Column ${index + 1}`);
    }

    function escapeForCSV(value) {
        if (value === null || value === undefined) {
            return '""';
        }

        let stringValue;
        if (typeof value === 'string') {
            stringValue = value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            stringValue = String(value);
        } else {
            try {
                stringValue = JSON.stringify(value);
            } catch (error) {
                stringValue = String(value);
            }
        }

        stringValue = stringValue.replace(/"/g, '""');
        return `"${stringValue}"`;
    }

    function formatColumnLabel(columnKey) {
        if (!columnKey) {
            return '';
        }

        return columnKey
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, chr => chr.toUpperCase())
            .trim();
    }

    function renderLogEntry(log) {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const context = formatLogContextHTML(log.context);
        return `<div class="log-entry log-${log.type}">[${time}] ${log.message}${context}</div>`;
    }

    function formatLogContextHTML(context = {}) {
        if (!context || typeof context !== 'object') {
            return '';
        }
        const entries = Object.entries(context).filter(([, value]) => value !== undefined && value !== null);
        if (!entries.length) {
            return '';
        }
        const formatted = entries.map(([key, value]) => `${key}: ${formatContextValue(value)}`).join(' · ');
        return `<span class="log-context">${formatted}</span>`;
    }

    function formatLogContextPlain(context = {}) {
        if (!context || typeof context !== 'object') {
            return '';
        }
        const entries = Object.entries(context).filter(([, value]) => value !== undefined && value !== null);
        if (!entries.length) {
            return '';
        }
        return entries.map(([key, value]) => `${key}=${formatContextValue(value)}`).join(', ');
    }

    function formatContextValue(value) {
        if (typeof value === 'number') {
            return Number.isInteger(value) ? value : value.toFixed(2);
        }
        if (typeof value === 'string') {
            return value;
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        try {
            return JSON.stringify(value);
        } catch (error) {
            return String(value);
        }
    }

    function clampPercentage(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return 0;
        }
        return Math.min(100, Math.max(0, Math.round(numeric)));
    }

    function computeProgressPercent(state = {}) {
        const totalSteps = Number(state.totalSteps);
        const completedSteps = Number(state.completedSteps);
        const substepProgress = Number(state.substepProgress);

        if (state.isCompleted) {
            return 100;
        }

        if (!Number.isFinite(totalSteps) || totalSteps <= 0) {
            return clampPercentage(state.progress);
        }

        const normalizedCompleted = Number.isFinite(completedSteps) ? Math.max(0, completedSteps) : 0;
        const normalizedSubstep = Number.isFinite(substepProgress)
            ? Math.min(Math.max(substepProgress, 0), 0.999)
            : 0;

        const effective = Math.min(normalizedCompleted + normalizedSubstep, totalSteps);
        const percent = (effective / totalSteps) * 100;
        return clampPercentage(percent);
    }

    function collectSelectedPages() {
        const selectedPages = {};
        let hasSelection = false;

        if (!pageSelects.length) {
            return { selectedPages, hasSelection };
        }

        pageSelects.forEach((select) => {
            Array.from(select.options).forEach((option) => {
                const isSelected = Boolean(option.selected);
                selectedPages[option.value] = isSelected;
                if (isSelected) {
                    hasSelection = true;
                }
            });
        });

        return { selectedPages, hasSelection };
    }

    function restoreSelectedPages(selectedPages = null) {
        if (!pageSelects.length) {
            return;
        }

        const selection = selectedPages && typeof selectedPages === 'object' ? selectedPages : null;

        let anySelected = false;
        pageSelects.forEach((select) => {
            Array.from(select.options).forEach((option) => {
                const shouldSelect = selection && Object.prototype.hasOwnProperty.call(selection, option.value)
                    ? Boolean(selection[option.value])
                    : false;
                option.selected = shouldSelect;
                if (shouldSelect) {
                    anySelected = true;
                }
            });
        });

        if (!anySelected) {
            const defaultOption = document.querySelector('.page-select option[value="scheduleOfClasses"]');
            if (defaultOption) {
                defaultOption.selected = true;
            }
        }
    }

    function applyControlState(state = {}) {
        const isRunning = Boolean(state.isRunning);
        const isPaused = Boolean(state.isPaused);
        const isCompleted = Boolean(state.isCompleted);
        const hasData = state.scrapedData && Object.keys(state.scrapedData).length > 0;
        const hasActivity = isRunning || isPaused || isCompleted || hasData || (Array.isArray(state.logs) && state.logs.length > 0);

        if (isRunning) {
            showProgress();
            startScrapingBtn.classList.add('hidden');
            startScrapingBtn.textContent = 'Start Scraping';
            stopScrapingBtn.classList.remove('hidden');
            exportSection.classList.add('hidden');
            if (stopScrapingLogsBtn && resumeScrapingLogsBtn) {
                stopScrapingLogsBtn.classList.remove('hidden');
                resumeScrapingLogsBtn.classList.add('hidden');
            }
        } else if (isPaused) {
            showProgress();
            startScrapingBtn.textContent = 'Resume Scraping';
            startScrapingBtn.classList.remove('hidden');
            stopScrapingBtn.classList.add('hidden');
            exportSection.classList.remove('hidden');
            if (stopScrapingLogsBtn && resumeScrapingLogsBtn) {
                stopScrapingLogsBtn.classList.add('hidden');
                resumeScrapingLogsBtn.classList.remove('hidden');
            }
        } else if (isCompleted || hasData) {
            if (hasActivity) {
                showProgress();
            }
            const label = hasData ? 'Scrape More Data' : 'Start Scraping';
            startScrapingBtn.textContent = label;
            startScrapingBtn.classList.remove('hidden');
            stopScrapingBtn.classList.add('hidden');
            exportSection.classList.remove('hidden');
            if (stopScrapingLogsBtn && resumeScrapingLogsBtn) {
                stopScrapingLogsBtn.classList.add('hidden');
                resumeScrapingLogsBtn.classList.add('hidden');
            }
        } else {
            startScrapingBtn.textContent = 'Start Scraping';
            startScrapingBtn.classList.remove('hidden');
            stopScrapingBtn.classList.add('hidden');
            exportSection.classList.add('hidden');
            if (!hasActivity) {
                hideProgress();
            }
            if (stopScrapingLogsBtn && resumeScrapingLogsBtn) {
                stopScrapingLogsBtn.classList.add('hidden');
                resumeScrapingLogsBtn.classList.add('hidden');
            }
        }
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
});
