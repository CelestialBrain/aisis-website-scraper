// AISIS Auto Scraper - Popup Script

document.addEventListener('DOMContentLoaded', async function() {
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
    
    // Load saved credentials
    const credentials = await loadCredentials();
    if (credentials) {
        usernameInput.value = credentials.username;
        passwordInput.value = credentials.password;
    }
    
    // Check current scraping state
    const state = await getState();
    
    // Restore session ID if exists
    if (state.sessionId) {
        const sessionInfo = document.getElementById('session-info');
        const sessionIdSpan = document.getElementById('session-id');
        sessionInfo.classList.remove('hidden');
        sessionIdSpan.textContent = state.sessionId.substring(8, 20);
    }
    
    // Restore logs if exist
    if (state.logs && state.logs.length > 0) {
        logsSection.classList.remove('hidden');
        updateUI(state);
    }
    
    // Restore UI based on state
    if (state.isRunning) {
        showProgress();
        updateUI(state);
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
        updateUI(state);
    } else if (state.isCompleted || (state.scrapedData && Object.keys(state.scrapedData).length > 0)) {
        // Show export section if scraping completed or data exists
        progressSection.classList.remove('hidden');
        exportSection.classList.remove('hidden');
        stopScrapingBtn.classList.add('hidden');
        startScrapingBtn.classList.add('hidden');
        updateUI(state);
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
            const result = await sendMessage({ action: 'resumeScraping' });
            if (result.success) {
                showProgress();
                exportSection.classList.add('hidden');
                startScrapingBtn.textContent = 'Start Scraping';
                startScrapingBtn.classList.add('hidden');
                stopScrapingBtn.classList.remove('hidden');
            } else {
                alert('Failed to resume: ' + result.error);
            }
            return;
        }
        
        // Get selected pages
        const checkboxes = document.querySelectorAll('.checkbox-item input[type="checkbox"]');
        const selectedPages = {};
        let hasSelection = false;
        
        checkboxes.forEach(cb => {
            selectedPages[cb.value] = cb.checked;
            if (cb.checked) hasSelection = true;
        });
        
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
        
        const result = await sendMessage({ 
            action: 'startScraping', 
            options: { pages: selectedPages }
        });
        
        if (!result.success) {
            alert('Failed to start scraping: ' + result.error);
            hideProgress();
        }
    });
    
    stopScrapingBtn.addEventListener('click', async () => {
        const result = await sendMessage({ action: 'stopScraping' });
        if (result.success && result.paused) {
            // Show export section but keep scraping controls visible
            exportSection.classList.remove('hidden');
            stopScrapingBtn.classList.add('hidden');
            startScrapingBtn.textContent = 'Resume Scraping';
            startScrapingBtn.classList.remove('hidden');
        }
    });
    
    // Stop button in logs section
    if (stopScrapingLogsBtn && resumeScrapingLogsBtn) {
        stopScrapingLogsBtn.addEventListener('click', async () => {
            const result = await sendMessage({ action: 'stopScraping' });
            if (result.success && result.paused) {
                // Toggle buttons in logs section
                stopScrapingLogsBtn.classList.add('hidden');
                resumeScrapingLogsBtn.classList.remove('hidden');

                // Show export section and update main buttons
                exportSection.classList.remove('hidden');
                stopScrapingBtn.classList.add('hidden');
                startScrapingBtn.textContent = 'Resume Scraping';
                startScrapingBtn.classList.remove('hidden');
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
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'updateProgress') {
            updateUI(message.state);
            // Update button states based on state
            if (message.state.isPaused) {
                stopScrapingBtn.classList.add('hidden');
                startScrapingBtn.textContent = 'Resume Scraping';
                startScrapingBtn.classList.remove('hidden');
                exportSection.classList.remove('hidden');
                // Update logs section buttons
                if (stopScrapingLogsBtn && resumeScrapingLogsBtn) {
                    stopScrapingLogsBtn.classList.add('hidden');
                    resumeScrapingLogsBtn.classList.remove('hidden');
                }
            } else if (message.state.isRunning) {
                stopScrapingBtn.classList.remove('hidden');
                startScrapingBtn.classList.add('hidden');
                // Update logs section buttons
                if (stopScrapingLogsBtn && resumeScrapingLogsBtn) {
                    stopScrapingLogsBtn.classList.remove('hidden');
                    resumeScrapingLogsBtn.classList.add('hidden');
                }
            }
        } else if (message.action === 'scrapingComplete') {
            updateUI(message.state);
            hideProgress();
            showExport();
            alert('Scraping completed successfully!');
        } else if (message.action === 'scrapingError') {
            updateUI(message.state);
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
    
    function updateUI(state) {
        // Update session ID display
        const sessionInfo = document.getElementById('session-info');
        const sessionIdSpan = document.getElementById('session-id');
        if (state.sessionId) {
            sessionInfo.classList.remove('hidden');
            sessionIdSpan.textContent = state.sessionId.substring(8, 20); // Show shortened ID
        }
        
        // Update progress bar
        progressFill.style.width = state.progress + '%';
        progressFill.textContent = state.progress + '%';
        
        // Update status text
        statusText.textContent = state.currentStep;
        
        // Update time estimate
        if (state.startTime && state.progress > 0 && state.progress < 100) {
            const elapsed = Date.now() - state.startTime;
            const estimated = (elapsed / state.progress) * (100 - state.progress);
            const minutes = Math.floor(estimated / 60000);
            const seconds = Math.floor((estimated % 60000) / 1000);
            timeEstimate.textContent = `Estimated time remaining: ${minutes}m ${seconds}s`;
        } else {
            timeEstimate.textContent = '';
        }
        
        // Update logs
        if (state.logs && state.logs.length > 0) {
            logsContainer.innerHTML = state.logs.map(renderLogEntry).join('');
            logsContainer.scrollTop = logsContainer.scrollHeight;
            if (logLimitNotice) {
                logLimitNotice.classList.toggle('hidden', !state.logsTrimmed);
            }
        } else {
            logsContainer.innerHTML = '';
            if (logLimitNotice) {
                logLimitNotice.classList.add('hidden');
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
    
    function convertToCSV(data) {
        let csv = '';
        
        // Schedule of Classes
        if (data.scheduleOfClasses && data.scheduleOfClasses.length > 0) {
            csv += 'SCHEDULE OF CLASSES\n';
            csv += 'Department,Subject Code,Section,Course Title,Units,Time,Room,Instructor,Max No,Lang,Level,Free Slots,Remarks,S,P\n';
            data.scheduleOfClasses.forEach(item => {
                csv += `"${item.department || ''}","${item.subjectCode || ''}","${item.section || ''}","${item.courseTitle || ''}","${item.units || ''}","${item.time || ''}","${item.room || ''}","${item.instructor || ''}","${item.maxNo || ''}","${item.lang || ''}","${item.level || ''}","${item.freeSlots || ''}","${item.remarks || ''}","${item.s || ''}","${item.p || ''}"\n`;
            });
            csv += '\n';
        }
        
        // Official Curriculum
        if (data.officialCurriculum && data.officialCurriculum.length > 0) {
            csv += 'OFFICIAL CURRICULUM\n';
            csv += 'Degree Program,Degree Code,Cat No,Course Title,Units,Prerequisites,Category\n';
            data.officialCurriculum.forEach(item => {
                csv += `"${item.degreeProgram || ''}","${item.degreeCode || ''}","${item.catNo || ''}","${item.courseTitle || ''}","${item.units || ''}","${item.prerequisites || ''}","${item.category || ''}"\n`;
            });
            csv += '\n';
        }

        return csv || 'No data available';
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
});
