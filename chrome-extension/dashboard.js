// Dashboard JavaScript

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update active tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// Open scraper popup
document.getElementById('scraper-btn').addEventListener('click', () => {
    chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 420,
        height: 700
    });
});

// Refresh data
document.getElementById('refresh-btn').addEventListener('click', async () => {
    await loadDashboardData();
});

// Load dashboard data from storage
async function loadDashboardData() {
    try {
        const result = await chrome.storage.local.get(['scrapingState']);
        const state = result.scrapingState || {};
        const data = state.scrapedData || {};

        renderOperationalStatus(state);
        renderMetrics(state.metrics || {});
        renderLogs(state.logs || [], state.logsTrimmed);
        renderErrors(state.errors || []);

        // Load overview stats
        loadOverviewStats(data, state);

        // Load grades
        loadGrades(data.grades || []);

        // Load schedule (prefer detailed scheduleOfClasses if available)
        loadSchedule(data.scheduleOfClasses || data.schedule || []);

        // Load student info
        loadStudentInfo(data.studentInfo || null);

        // Load program of study
        loadProgramOfStudy(data.programOfStudy || null);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Load overview statistics
function loadOverviewStats(data, state) {
    const grades = Array.isArray(data.grades) ? data.grades : [];
    const latestTerm = determineLatestTerm(grades);
    const currentTermLabel = document.getElementById('current-term-label');
    const currentCoursesCount = document.getElementById('current-courses');
    const unitsCompletedEl = document.getElementById('units-completed');
    const currentCoursesBody = document.getElementById('current-courses-body');
    const currentQPIEl = document.getElementById('current-qpi');
    const cumulativeGpaEl = document.getElementById('cumulative-gpa');

    if (currentCoursesBody) {
        currentCoursesBody.innerHTML = '';
    }

    if (currentTermLabel) {
        currentTermLabel.textContent = latestTerm ? `${latestTerm.schoolYear} • ${latestTerm.semester}` : 'No recent term detected';
    }

    const currentTermCourses = latestTerm
        ? grades.filter(grade => grade.schoolYear === latestTerm.schoolYear && grade.semester === latestTerm.semester)
        : [];

    const numericCurrentGrades = currentTermCourses.filter(g => isNumericGrade(g.grade));
    const numericAllGrades = grades.filter(g => isNumericGrade(g.grade));

    if (currentCoursesCount) {
        currentCoursesCount.textContent = currentTermCourses.length;
    }

    if (unitsCompletedEl) {
        const completedUnits = numericAllGrades.reduce((sum, course) => sum + (parseFloat(course.units) || 0), 0);
        unitsCompletedEl.textContent = completedUnits ? completedUnits.toFixed(1).replace(/\.0$/, '') : '0';
    }

    if (currentQPIEl) {
        const currentAverage = computeWeightedAverage(numericCurrentGrades);
        currentQPIEl.textContent = currentAverage !== null ? currentAverage.toFixed(2) : '--';
    }

    if (cumulativeGpaEl) {
        const cumulativeAverage = computeWeightedAverage(numericAllGrades);
        cumulativeGpaEl.textContent = cumulativeAverage !== null ? cumulativeAverage.toFixed(2) : '--';
    }

    if (currentCoursesBody) {
        if (currentTermCourses.length === 0) {
            currentCoursesBody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="empty-state">
                            <div class="empty-state-icon">📚</div>
                            <div class="empty-state-title">No Data Available</div>
                            <div class="empty-state-description">Run the scraper to fetch your AISIS data</div>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            currentTermCourses.forEach(course => {
                const row = document.createElement('tr');
                const gradeBadge = isNumericGrade(course.grade)
                    ? `<span class="badge badge-success">${course.grade}</span>`
                    : '<span class="badge badge-warning">Ongoing</span>';
                row.innerHTML = `
                    <td>${course.courseCode || '--'}</td>
                    <td>${course.courseTitle || '--'}</td>
                    <td>${course.units || '--'}</td>
                    <td>${gradeBadge}</td>
                `;
                currentCoursesBody.appendChild(row);
            });
        }
    }
}

// Load grades data
function loadGrades(grades) {
    const tbody = document.getElementById('grades-body');
    tbody.innerHTML = '';
    
    if (!grades || grades.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <div class="empty-state-title">No Grades Data</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    grades.forEach(grade => {
        const row = document.createElement('tr');
        const gradeValue = grade.grade || '--';
        const gradeBadge = isNumericGrade(gradeValue)
            ? `<span class="badge badge-success">${gradeValue}</span>`
            : gradeValue === '--'
                ? '<span class="badge badge-warning">Ongoing</span>'
                : `<span class="badge badge-warning">${gradeValue}</span>`;

        row.innerHTML = `
            <td>${grade.schoolYear || '--'}</td>
            <td>${grade.semester || '--'}</td>
            <td>${grade.courseCode || '--'}</td>
            <td>${grade.courseTitle || '--'}</td>
            <td>${grade.units || '--'}</td>
            <td>${gradeBadge}</td>
        `;
        tbody.appendChild(row);
    });
}

// Load schedule data
function loadSchedule(schedule) {
    const tbody = document.getElementById('schedule-body');
    tbody.innerHTML = '';

    if (!schedule || schedule.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <div class="empty-state-icon">📅</div>
                        <div class="empty-state-title">No Schedule Data</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    schedule.forEach(item => {
        const courseCode = item.courseCode || item.subjectCode || '--';
        const scheduleText = item.schedule || item.time || '--';
        const room = item.room || item.venue || '--';
        const instructor = item.instructor || item.faculty || '--';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${courseCode}</td>
            <td>${item.section || '--'}</td>
            <td>${scheduleText}</td>
            <td>${room}</td>
            <td>${instructor}</td>
        `;
        tbody.appendChild(row);
    });
}

// Load student info
function loadStudentInfo(studentInfo) {
    const content = document.getElementById('student-info-content');
    
    if (!studentInfo || typeof studentInfo !== 'object') {
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👤</div>
                <div class="empty-state-title">No Student Data</div>
            </div>
        `;
        return;
    }
    
    content.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Student ID</div>
            <div style="font-size: 16px; font-weight: 600; margin-top: 4px;">${studentInfo.studentId || '--'}</div>
        </div>
        <div class="stat-card" style="margin-top: 16px;">
            <div class="stat-label">Name</div>
            <div style="font-size: 16px; font-weight: 600; margin-top: 4px;">${studentInfo.name || '--'}</div>
        </div>
        <div class="stat-card" style="margin-top: 16px;">
            <div class="stat-label">Program</div>
            <div style="font-size: 16px; font-weight: 600; margin-top: 4px;">${studentInfo.program || '--'}</div>
        </div>
    `;
}

// Load program of study
function loadProgramOfStudy(programData) {
    const content = document.getElementById('program-content');

    if (!programData) {
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎓</div>
                <div class="empty-state-title">No Program Data</div>
            </div>
        `;
        return;
    }
    
    content.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Program Details</div>
            <div style="font-size: 14px; margin-top: 8px; line-height: 1.6;">${programData.text || 'No data available'}</div>
        </div>
    `;
}

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
});

function renderOperationalStatus(state) {
    const lastScrapeEl = document.getElementById('last-scrape');
    const dataAgeEl = document.getElementById('data-age-label');
    const sessionSummaryEl = document.getElementById('session-summary');
    const sessionIdEl = document.getElementById('session-id-display');
    const stepsCompletedEl = document.getElementById('steps-completed');
    const stepsTotalEl = document.getElementById('steps-total');
    const errorCountEl = document.getElementById('error-count');
    const errorSummaryEl = document.getElementById('error-summary');
    const lastLogMessageEl = document.getElementById('last-log-message');
    const lastLogTimeEl = document.getElementById('last-log-time');

    const status = state.isRunning
        ? 'Running'
        : state.isPaused
            ? 'Paused'
            : state.isCompleted
                ? 'Completed'
                : 'Idle';

    if (sessionSummaryEl) {
        sessionSummaryEl.textContent = status;
    }

    if (sessionIdEl) {
        if (state.sessionId) {
            const shortId = state.sessionId.length > 10 ? `${state.sessionId.slice(0, 10)}…` : state.sessionId;
            sessionIdEl.textContent = `#${shortId}`;
        } else {
            sessionIdEl.textContent = '—';
        }
    }

    if (stepsCompletedEl) {
        stepsCompletedEl.textContent = state.completedSteps || 0;
    }

    if (stepsTotalEl) {
        stepsTotalEl.textContent = state.totalSteps ? `${state.completedSteps || 0} of ${state.totalSteps}` : 'No plan yet';
    }

    const errors = Array.isArray(state.errors) ? state.errors : [];
    if (errorCountEl) {
        errorCountEl.textContent = errors.length || 0;
    }

    if (errorSummaryEl) {
        errorSummaryEl.textContent = errors.length > 0
            ? errors[errors.length - 1].error || 'Unknown issue'
            : 'No issues detected';
    }

    const lastCompleted = state.completedAt || null;
    const lastUpdated = state.lastUpdated || null;
    const referenceTime = lastCompleted || lastUpdated || state.startedAt;

    if (lastScrapeEl) {
        lastScrapeEl.textContent = referenceTime ? formatTimestamp(referenceTime) : 'Never';
    }

    if (dataAgeEl) {
        dataAgeEl.textContent = referenceTime ? `Updated ${formatRelativeTime(referenceTime)}` : 'No runs yet';
    }

    const logs = Array.isArray(state.logs) ? state.logs : [];
    const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

    if (lastLogMessageEl) {
        lastLogMessageEl.textContent = lastLog ? lastLog.message : 'No activity yet';
    }

    if (lastLogTimeEl) {
        lastLogTimeEl.textContent = lastLog ? formatRelativeTime(lastLog.timestamp) : '—';
    }
}

function renderMetrics(metrics) {
    const totalRequestsEl = document.getElementById('metric-total-requests');
    const avgResponseEl = document.getElementById('metric-avg-response');
    const slowResponsesEl = document.getElementById('metric-slow-responses');
    const bytesEl = document.getElementById('metric-bytes');
    const lastStatusEl = document.getElementById('metric-last-status');
    const lastRequestEl = document.getElementById('metric-last-request');

    if (totalRequestsEl) {
        totalRequestsEl.textContent = metrics.totalRequests || 0;
    }

    if (avgResponseEl) {
        avgResponseEl.textContent = metrics.totalRequests
            ? `${metrics.avgResponseMs} ms`
            : '--';
    }

    if (slowResponsesEl) {
        slowResponsesEl.textContent = metrics.slowResponses || 0;
    }

    if (bytesEl) {
        bytesEl.textContent = formatBytes(metrics.bytesDownloaded);
    }

    if (lastStatusEl) {
        lastStatusEl.textContent = metrics.lastStatus
            ? `${metrics.lastStatus}${metrics.lastRequestMethod ? ` · ${metrics.lastRequestMethod}` : ''}`
            : '--';
    }

    if (lastRequestEl) {
        if (metrics.lastRequestAt) {
            const relative = formatRelativeTime(metrics.lastRequestAt);
            const summary = summarizeUrl(metrics.lastRequestUrl);
            lastRequestEl.textContent = summary ? `${relative} • ${summary}` : relative;
        } else {
            lastRequestEl.textContent = '--';
        }
    }
}

function renderLogs(logs, trimmed) {
    const feed = document.getElementById('logs-feed');
    const emptyState = document.getElementById('logs-empty');
    const footnote = document.getElementById('logs-footnote');
    if (!feed) {
        return;
    }

    if (!Array.isArray(logs) || logs.length === 0) {
        feed.innerHTML = '';
        feed.classList.add('hidden');
        if (emptyState) {
            emptyState.classList.remove('hidden');
        }
        if (footnote) {
            footnote.classList.add('hidden');
        }
        return;
    }

    if (emptyState) {
        emptyState.classList.add('hidden');
    }

    const LOG_DISPLAY_LIMIT = 200;
    const recentLogs = logs.slice(-LOG_DISPLAY_LIMIT).reverse();
    feed.innerHTML = recentLogs.map(renderLogItem).join('');
    feed.classList.remove('hidden');

    if (footnote) {
        const truncated = trimmed || logs.length > LOG_DISPLAY_LIMIT;
        footnote.textContent = truncated
            ? `Showing ${recentLogs.length} of ${logs.length} events.`
            : `Showing ${recentLogs.length} events.`;
        footnote.classList.toggle('hidden', !truncated);
    }
}

function renderErrors(errors) {
    const container = document.getElementById('error-list');
    if (!container) {
        return;
    }

    if (!Array.isArray(errors) || errors.length === 0) {
        container.innerHTML = '<li class="error-empty">No errors recorded</li>';
        return;
    }

    const recentErrors = errors.slice(-5).reverse();
    container.innerHTML = recentErrors.map(error => `
        <li class="error-item">
            <span class="error-step">${escapeHtml(error.step || 'Unknown')}</span>
            <span class="error-message">${escapeHtml(error.error || 'Unknown error')}</span>
        </li>
    `).join('');
}

function determineLatestTerm(grades) {
    if (!Array.isArray(grades) || grades.length === 0) {
        return null;
    }

    const ranked = grades
        .map(grade => ({
            schoolYear: grade.schoolYear,
            semester: grade.semester,
            rank: getTermRank(grade.schoolYear, grade.semester)
        }))
        .filter(item => item.rank !== null);

    if (ranked.length === 0) {
        return null;
    }

    ranked.sort((a, b) => b.rank - a.rank);
    return {
        schoolYear: ranked[0].schoolYear,
        semester: ranked[0].semester
    };
}

function computeWeightedAverage(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return null;
    }

    let totalUnits = 0;
    let totalPoints = 0;

    entries.forEach(entry => {
        const units = parseFloat(entry.units);
        const grade = parseFloat(entry.grade);
        if (!Number.isNaN(units) && units > 0 && !Number.isNaN(grade)) {
            totalUnits += units;
            totalPoints += units * grade;
        }
    });

    if (totalUnits === 0) {
        return null;
    }

    return totalPoints / totalUnits;
}

function isNumericGrade(value) {
    if (value === undefined || value === null) {
        return false;
    }
    const number = parseFloat(value);
    return !Number.isNaN(number);
}

function renderLogItem(log) {
    const level = formatLogLevel(log.type);
    const timestamp = formatTimestamp(log.timestamp);
    const relative = formatRelativeTime(log.timestamp);
    const context = formatLogContext(log.context);
    return `
        <div class="log-item log-${log.type || 'info'}">
            <div class="log-meta">
                <span class="log-level">${escapeHtml(level)}</span>
                <span class="log-time" title="${escapeHtml(timestamp)}">${escapeHtml(relative)}</span>
            </div>
            <div class="log-message">${escapeHtml(log.message || '')}</div>
            ${context}
        </div>
    `;
}

function formatLogContext(context = {}) {
    if (!context || typeof context !== 'object') {
        return '';
    }
    const entries = Object.entries(context).filter(([, value]) => value !== undefined && value !== null);
    if (!entries.length) {
        return '';
    }
    const formatted = entries.map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(formatContextValue(value))}`).join(' · ');
    return `<div class="log-context">${formatted}</div>`;
}

function formatLogLevel(type) {
    switch ((type || '').toLowerCase()) {
        case 'error':
            return 'Error';
        case 'warning':
            return 'Warning';
        case 'success':
            return 'Success';
        case 'debug':
            return 'Debug';
        default:
            return 'Info';
    }
}

function getTermRank(schoolYear, semester) {
    if (!schoolYear) {
        return null;
    }
    const yearStart = parseInt(String(schoolYear).split('-')[0], 10);
    if (Number.isNaN(yearStart)) {
        return null;
    }
    const semesterOrder = (semester || '').toString().toLowerCase();
    const semesterRank = semesterOrder === '1'
        ? 1
        : semesterOrder === '2'
            ? 2
            : semesterOrder.includes('inter')
                ? 3
                : 0;
    return yearStart * 10 + semesterRank;
}

function formatRelativeTime(isoString) {
    if (!isoString) {
        return '—';
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 60000) {
        return 'just now';
    }
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

function formatTimestamp(isoString) {
    if (!isoString) {
        return '—';
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }
    return date.toLocaleString();
}

function formatBytes(bytes) {
    if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes <= 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    let value = bytes;
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index++;
    }
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function summarizeUrl(url) {
    if (!url) {
        return '';
    }
    try {
        const parsed = new URL(url);
        const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
        return `${parsed.hostname}${path}`;
    } catch (error) {
        return url.length > 40 ? `${url.slice(0, 37)}…` : url;
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatContextValue(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    return String(value);
}
