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

function getChromeApi() {
    return typeof chrome !== 'undefined' ? chrome : null;
}

const extensionApi = getChromeApi();

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
        console.warn('Unable to determine extension version:', error);
    }
}

function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
        if (!extensionApi?.runtime?.sendMessage) {
            resolve(null);
            return;
        }

        try {
            extensionApi.runtime.sendMessage(message, (response) => {
                const runtimeError = extensionApi.runtime.lastError;
                if (runtimeError) {
                    reject(new Error(runtimeError.message));
                    return;
                }
                resolve(response);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Open scraper popup
document.getElementById('scraper-btn').addEventListener('click', async () => {
    const popupUrl = extensionApi?.runtime?.getURL ? extensionApi.runtime.getURL('popup.html') : 'popup.html';

    if (extensionApi?.runtime?.sendMessage) {
        try {
            const response = await sendRuntimeMessage({ action: 'openScraperPopup' });
            if (response?.success) {
                return;
            }
        } catch (error) {
            console.warn('Fallback to manual popup open due to error:', error);
        }
    }

    if (extensionApi?.windows?.create) {
        extensionApi.windows.create({
            url: popupUrl,
            type: 'popup',
            width: 420,
            height: 700
        });
        return;
    }

    if (extensionApi?.tabs?.create) {
        extensionApi.tabs.create({ url: popupUrl });
        return;
    }

    window.open(popupUrl, '_blank', 'width=420,height=700');
});

// Refresh data
document.getElementById('refresh-btn').addEventListener('click', async () => {
    await loadDashboardData();
});

const downloadMenu = document.getElementById('download-menu');
const downloadMenuPanel = document.getElementById('download-menu-panel');
const downloadBtn = document.getElementById('download-btn');
const downloadActions = document.querySelectorAll('[data-download]');
let isDownloadMenuOpen = false;

function toggleDownloadMenu(forceOpen) {
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !isDownloadMenuOpen;
    isDownloadMenuOpen = shouldOpen;
    if (downloadMenuPanel) {
        downloadMenuPanel.classList.toggle('hidden', !shouldOpen);
    }
    if (downloadMenu) {
        downloadMenu.classList.toggle('open', shouldOpen);
    }
}

function closeDownloadMenu() {
    if (isDownloadMenuOpen) {
        toggleDownloadMenu(false);
    }
}

downloadBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleDownloadMenu();
});

downloadActions.forEach((button) => {
    button.addEventListener('click', async (event) => {
        const action = button.dataset.download;
        closeDownloadMenu();
        if (action) {
            await handleDownloadAction(action);
        }
    });
});

document.addEventListener('click', (event) => {
    if (!isDownloadMenuOpen) {
        return;
    }
    if (downloadMenu && !downloadMenu.contains(event.target)) {
        closeDownloadMenu();
    }
});

// Load dashboard data from storage
let latestState = null;

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}

function sanitizeSimpleDataset(dataset) {
    if (!dataset || !isPlainObject(dataset)) {
        return null;
    }
    return dataset;
}

function deriveClassSchedule(dataset) {
    if (Array.isArray(dataset)) {
        return dataset;
    }

    const structured = sanitizeSimpleDataset(dataset);
    if (!structured) {
        return [];
    }

    const tables = Array.isArray(structured.tables) ? structured.tables : [];
    if (!tables.length) {
        return [];
    }

    const targetTable = tables.find((table) => {
        const headers = Array.isArray(table.headers) ? table.headers.map(header => header.toLowerCase()) : [];
        return headers.some((header) => header.includes('course') || header.includes('schedule'));
    }) || tables[0];

    const headers = Array.isArray(targetTable.headers) ? targetTable.headers.map(header => header.toLowerCase()) : [];
    const rows = Array.isArray(targetTable.rows) ? targetTable.rows : [];

    const findIndex = (keywords) => headers.findIndex((header) => keywords.some(keyword => header.includes(keyword)));
    const courseIndex = findIndex(['course', 'subject']);
    const sectionIndex = findIndex(['section']);
    const scheduleIndex = findIndex(['schedule', 'time']);
    const roomIndex = findIndex(['room', 'venue']);
    const instructorIndex = findIndex(['instructor', 'faculty']);

    const readCell = (row, index) => {
        if (!Array.isArray(row) || index < 0 || index >= row.length) {
            return '';
        }
        const value = row[index];
        return typeof value === 'string' ? value : String(value ?? '');
    };

    return rows.map((row) => ({
        courseCode: readCell(row, courseIndex) || '--',
        section: readCell(row, sectionIndex) || '--',
        schedule: readCell(row, scheduleIndex) || '--',
        room: readCell(row, roomIndex) || '--',
        instructor: readCell(row, instructorIndex) || '--'
    })).filter((entry) => Object.values(entry).some(value => value && value !== '--'));
}

function getWeeklyScheduleFromDataset(dataset) {
    if (!dataset || !isPlainObject(dataset)) {
        return null;
    }
    const schedule = dataset.weeklySchedule;
    if (!schedule || !Array.isArray(schedule.days) || !Array.isArray(schedule.slots)) {
        return null;
    }
    return schedule;
}

function formatScheduleEventTime(event) {
    if (!event) {
        return '';
    }
    if (event.timeLabel) {
        return event.timeLabel;
    }
    if (event.startTime && event.endTime) {
        return `${event.startTime} - ${event.endTime}`;
    }
    return '';
}

function convertWeeklyScheduleToRows(schedule) {
    if (!schedule || !Array.isArray(schedule.events)) {
        return [];
    }
    return schedule.events.map((event) => ({
        courseCode: event.courseCode || event.summary || '--',
        section: event.section || '--',
        schedule: `${event.dayLabel || ''} ${formatScheduleEventTime(event)}`.trim(),
        room: event.room || '--',
        instructor: event.instructor || '--'
    }));
}

function renderScheduleEntry(event) {
    const parts = [];
    const time = formatScheduleEventTime(event);
    if (time) {
        parts.push(`<div class="schedule-entry-time">${escapeHtml(time)}</div>`);
    }

    const codeLabel = event.courseCode || event.summary || 'Class';
    parts.push(`<div class="schedule-entry-code">${escapeHtml(codeLabel)}</div>`);

    if (event.courseTitle && event.courseTitle !== codeLabel) {
        parts.push(`<div class="schedule-entry-title">${escapeHtml(event.courseTitle)}</div>`);
    }

    const metaPieces = [];
    if (event.section) {
        metaPieces.push(`Section ${event.section}`);
    }
    if (event.mode) {
        metaPieces.push(event.mode);
    }
    if (metaPieces.length) {
        parts.push(`<div class="schedule-entry-meta">${escapeHtml(metaPieces.join(' • '))}</div>`);
    }

    if (event.room) {
        parts.push(`<div class="schedule-entry-meta">${escapeHtml(event.room)}</div>`);
    }
    if (event.instructor) {
        parts.push(`<div class="schedule-entry-meta">${escapeHtml(event.instructor)}</div>`);
    }

    const notes = Array.isArray(event.details) ? event.details.filter(Boolean) : [];
    if (notes.length) {
        parts.push(`<div class="schedule-entry-notes">${notes.map(note => escapeHtml(note)).join('<br>')}</div>`);
    }

    return `<div class="schedule-entry">${parts.join('')}</div>`;
}

function renderWeeklySchedule(schedule, capturedAt) {
    const container = document.getElementById('weekly-schedule-container');
    const meta = document.getElementById('weekly-schedule-meta');
    if (!container || !meta) {
        return;
    }

    if (!schedule || !Array.isArray(schedule.days) || schedule.days.length === 0) {
        container.innerHTML = buildEmptyState({
            icon: '🗓️',
            title: 'No Weekly Schedule',
            description: 'Scrape the My Class Schedule page to visualize your timetable.'
        });
        meta.textContent = '';
        return;
    }

    const days = schedule.days;
    const slots = Array.isArray(schedule.slots)
        ? schedule.slots.filter(slot => Array.isArray(slot.entries)
            && slot.entries.some(entry => days.some(day => entry.dayKey === day.key)))
        : [];

    if (!slots.length) {
        container.innerHTML = buildEmptyState({
            icon: '🗓️',
            title: 'No Weekly Schedule',
            description: 'Scrape the My Class Schedule page to visualize your timetable.'
        });
        meta.textContent = '';
        return;
    }

    const headerCells = days.map(day => `<th>${escapeHtml(day.label)}</th>`).join('');

    const bodyRows = slots.map(slot => {
        const rowCells = days.map(day => {
            const entries = Array.isArray(slot.entries)
                ? slot.entries.filter(entry => entry.dayKey === day.key)
                : [];
            if (!entries.length) {
                return '<td></td>';
            }
            const entryHtml = entries.map(renderScheduleEntry).join('');
            return `<td>${entryHtml}</td>`;
        }).join('');

        return `
            <tr>
                <th class="weekly-schedule-time">${escapeHtml(slot.label || slot.rawLabel || '')}</th>
                ${rowCells}
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="weekly-schedule-scroll">
            <table class="weekly-schedule-table">
                <thead>
                    <tr>
                        <th class="weekly-schedule-time">Time</th>
                        ${headerCells}
                    </tr>
                </thead>
                <tbody>
                    ${bodyRows}
                </tbody>
            </table>
        </div>
    `;

    const totalEvents = schedule.eventCount || (Array.isArray(schedule.events) ? schedule.events.length : 0);
    const metaParts = [];
    if (totalEvents) {
        metaParts.push(`${totalEvents.toLocaleString()} block${totalEvents === 1 ? '' : 's'}`);
    }
    if (Array.isArray(schedule.days) && schedule.days.length) {
        metaParts.push(`${schedule.days.length} day${schedule.days.length === 1 ? '' : 's'}`);
    }
    const timestamp = capturedAt || schedule.generatedAt;
    if (timestamp) {
        metaParts.push(`Captured ${escapeHtml(formatRelativeTime(timestamp))}`);
    }
    meta.textContent = metaParts.join(' • ');
}

async function loadDashboardData() {
    try {
        if (!extensionApi?.storage?.local) {
            return;
        }

        const result = await new Promise((resolve) => {
            extensionApi.storage.local.get(['scrapingState'], resolve);
        });
        const state = result?.scrapingState || {};
        applyDashboardState(state);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function applyDashboardState(state = {}) {
    latestState = state;
    const data = isPlainObject(state.scrapedData) ? state.scrapedData : {};

    renderOperationalStatus(state);
    renderMetrics(state.metrics || {});
    renderLogs(state.logs || [], state.logsTrimmed);
    renderErrors(state.errors || []);
    renderDatasetProgress(state.datasetProgress || {});

    loadOverviewStats(data, state);
    loadGrades(data.grades || []);

    const classScheduleDataset = isPlainObject(data.classSchedule) ? data.classSchedule : null;
    const weeklySchedule = getWeeklyScheduleFromDataset(classScheduleDataset);
    renderWeeklySchedule(weeklySchedule, classScheduleDataset?.capturedAt);

    const classScheduleRows = Array.isArray(data.schedule)
        ? data.schedule
        : weeklySchedule
            ? convertWeeklyScheduleToRows(weeklySchedule)
            : deriveClassSchedule(classScheduleDataset);
    loadSchedule(classScheduleRows);
    renderScheduleOfClasses(Array.isArray(data.scheduleOfClasses) ? data.scheduleOfClasses : []);
    renderCurriculum(Array.isArray(data.officialCurriculum) ? data.officialCurriculum : [], state.datasetProgress?.officialCurriculum);

    renderGenericTables(data.advisoryGrades, 'advisory-tables', {
        icon: '🗂️',
        title: 'No Advisory Grades',
        description: 'Scrape the Advisory Grades page to populate this section.'
    });

    renderGenericTables(data.enrolledClasses, 'enrolled-tables', {
        icon: '📝',
        title: 'No Enrollment Records',
        description: 'Run the scraper with Currently Enrolled Classes selected.'
    });

    renderGenericTables(data.classSchedule, 'class-schedule-tables', {
        icon: '🗂️',
        title: 'No Class Schedule Data',
        description: 'Scrape the My Class Schedule page to view this section.'
    });

    loadStudentInfo(data.studentInfo || null);
    loadProgramOfStudy(data.programOfStudy || null);

    renderGenericTables(data.tuitionReceipt, 'tuition-tables', {
        icon: '💳',
        title: 'No Tuition Data',
        description: 'Scrape the Tuition Receipt page to populate this table.'
    });

    renderGenericTables(data.holdOrders, 'hold-tables', {
        icon: '⛔',
        title: 'No Hold Orders',
        description: 'Scrape the Hold Orders page to view holds here.'
    });

    renderGenericTables(data.facultyAttendance, 'faculty-tables', {
        icon: '🎓',
        title: 'No Faculty Records',
        description: 'Scrape the Faculty Attendance page to populate this table.'
    });
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
    renderGenericTables(studentInfo, 'student-info-content', {
        icon: '👤',
        title: 'No Student Data',
        description: 'Run the scraper to view your information'
    });
}

// Load program of study
function loadProgramOfStudy(programData) {
    renderGenericTables(programData, 'program-content', {
        icon: '🎓',
        title: 'No Program Data',
        description: 'Run the scraper to view your program of study'
    });
}

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    applyExtensionVersion();
    loadDashboardData();
});

if (extensionApi?.storage?.onChanged) {
    extensionApi.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.scrapingState) {
            return;
        }
        const newValue = changes.scrapingState.newValue;
        if (newValue) {
            applyDashboardState(newValue);
        }
    });
}

if (extensionApi?.runtime?.onMessage) {
    extensionApi.runtime.onMessage.addListener((message) => {
        if (!message || !message.action) {
            return;
        }

        if (message.state && (
            message.action === 'updateProgress' ||
            message.action === 'scrapingComplete' ||
            message.action === 'scrapingError'
        )) {
            applyDashboardState(message.state);
        }
    });
}

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
        if (state.cookieSession) {
            const cookie = state.cookieSession;
            const shortCookie = cookie.length > 24
                ? `${cookie.slice(0, 12)}…${cookie.slice(-6)}`
                : cookie;
            sessionIdEl.textContent = shortCookie;
            sessionIdEl.setAttribute('title', cookie);
        } else if (state.sessionId) {
            const fallback = state.sessionId.length > 24
                ? `${state.sessionId.slice(0, 12)}…${state.sessionId.slice(-6)}`
                : state.sessionId;
            sessionIdEl.textContent = fallback;
            sessionIdEl.setAttribute('title', state.sessionId);
        } else {
            sessionIdEl.textContent = '—';
            sessionIdEl.removeAttribute('title');
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

function formatDatasetName(key) {
    if (!key) {
        return 'Dataset';
    }
    if (DATASET_LABELS[key]) {
        return DATASET_LABELS[key];
    }
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, chr => chr.toUpperCase())
        .trim();
}

function buildEmptyState(config = {}) {
    const icon = config.icon || 'ℹ️';
    const title = config.title || 'No Data';
    const description = config.description || '';
    return `
        <div class="empty-state">
            <div class="empty-state-icon">${escapeHtml(icon)}</div>
            <div class="empty-state-title">${escapeHtml(title)}</div>
            ${description ? `<div class="empty-state-description">${escapeHtml(description)}</div>` : ''}
        </div>
    `;
}

function renderDatasetProgress(progressMap) {
    const grid = document.getElementById('dataset-progress-grid');
    const footnote = document.getElementById('dataset-progress-footnote');

    if (!grid) {
        return;
    }

    const entries = Object.entries(progressMap || {}).filter(([, value]) => value && typeof value === 'object');

    if (entries.length === 0) {
        grid.innerHTML = buildEmptyState({
            icon: '📈',
            title: 'No Dataset Activity',
            description: 'Run the scraper to track scraping progress across datasets.'
        });
        if (footnote) {
            footnote.textContent = '';
        }
        return;
    }

    entries.sort(([, a], [, b]) => {
        const labelA = (a.label || '').toString().toLowerCase();
        const labelB = (b.label || '').toString().toLowerCase();
        return labelA.localeCompare(labelB);
    });

    const cards = entries.map(([key, info]) => {
        const label = info.label || formatDatasetName(key);
        const total = Number.isFinite(info.total) ? info.total : 0;
        const completed = Number.isFinite(info.completed) ? info.completed : 0;
        const percent = total > 0
            ? Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
            : (completed > 0 ? 100 : 0);

        const metaParts = [];
        if (Number.isFinite(info.items) && info.items > 0) {
            metaParts.push(`${info.items.toLocaleString()} items`);
        }
        if (total > 0) {
            metaParts.push(`${completed}/${total} steps`);
        }
        if (info.detail) {
            metaParts.push(info.detail);
        }
        const meta = metaParts.join(' • ');

        const updatedText = info.updatedAt ? formatRelativeTime(info.updatedAt) : '—';
        const updatedTitle = info.updatedAt ? formatTimestamp(info.updatedAt) : '';

        return `
            <div class="dataset-progress-card">
                <div class="dataset-progress-header">
                    <span>${escapeHtml(label)}</span>
                    <span class="section-subtitle" title="${escapeHtml(updatedTitle)}">${escapeHtml(updatedText)}</span>
                </div>
                <div class="dataset-progress-meta">${escapeHtml(meta)}</div>
                <div class="dataset-progress-bar">
                    <div class="dataset-progress-fill" style="width: ${percent}%;"></div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = cards.join('');

    if (footnote) {
        footnote.textContent = `Tracking ${entries.length} dataset${entries.length === 1 ? '' : 's'}.`;
    }
}

function renderCurriculum(curriculumData, progress = {}) {
    const container = document.getElementById('curriculum-groups');
    const programCountEl = document.getElementById('curriculum-program-count');
    const courseCountEl = document.getElementById('curriculum-course-count');
    const updatedEl = document.getElementById('curriculum-updated');

    if (!container) {
        return;
    }

    const entries = Array.isArray(curriculumData) ? curriculumData : [];
    const groupsMap = new Map();

    entries.forEach(course => {
        const programName = course.degreeProgram || 'Program';
        const degreeCode = course.degreeCode || '';
        const key = `${programName}__${degreeCode}`;

        if (!groupsMap.has(key)) {
            groupsMap.set(key, {
                program: programName,
                code: degreeCode,
                courses: []
            });
        }

        groupsMap.get(key).courses.push(course);
    });

    const groups = Array.from(groupsMap.values()).sort((a, b) => a.program.localeCompare(b.program));

    if (programCountEl) {
        programCountEl.textContent = groups.length.toLocaleString();
    }

    if (courseCountEl) {
        courseCountEl.textContent = entries.length.toLocaleString();
    }

    if (updatedEl) {
        if (progress.updatedAt) {
            updatedEl.textContent = formatRelativeTime(progress.updatedAt);
            updatedEl.title = formatTimestamp(progress.updatedAt);
        } else {
            updatedEl.textContent = '—';
            updatedEl.removeAttribute('title');
        }
    }

    if (groups.length === 0) {
        container.innerHTML = buildEmptyState({
            icon: '📚',
            title: 'No Curriculum Data',
            description: 'Run the scraper with Official Curriculum selected.'
        });
        return;
    }

    const sections = groups.map((group, index) => {
        const summaryMeta = [];
        if (group.code) {
            summaryMeta.push(group.code);
        }
        summaryMeta.push(`${group.courses.length.toLocaleString()} courses`);

        const summary = `
            <summary>
                ${escapeHtml(group.program)}
                <span class="section-subtitle">${escapeHtml(summaryMeta.join(' • '))}</span>
            </summary>
        `;

        const rows = group.courses.map(course => `
            <tr>
                <td>${escapeHtml(course.catNo || '')}</td>
                <td>${escapeHtml(course.courseTitle || '')}</td>
                <td>${escapeHtml(course.units || '')}</td>
                <td>${escapeHtml(course.prerequisites || '')}</td>
                <td>${escapeHtml(course.category || '')}</td>
            </tr>
        `).join('');

        return `
            <details ${index < 3 ? 'open' : ''}>
                ${summary}
                <div class="generic-table-body">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Cat No</th>
                                <th>Course Title</th>
                                <th>Units</th>
                                <th>Prerequisites</th>
                                <th>Category</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </details>
        `;
    });

    container.innerHTML = sections.join('');
}

function renderScheduleOfClasses(classes) {
    const tbody = document.getElementById('schedule-of-classes-body');
    if (!tbody) {
        return;
    }

    if (!Array.isArray(classes) || classes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13">
                    <div class="empty-state">
                        <div class="empty-state-icon">🗓️</div>
                        <div class="empty-state-title">No Schedule of Classes</div>
                        <div class="empty-state-description">Scrape the Schedule of Classes page to populate this table.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const limit = 500;
    const subset = classes.slice(0, limit);
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    subset.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(item.department || '')}</td>
            <td>${escapeHtml(item.subjectCode || '')}</td>
            <td>${escapeHtml(item.section || '')}</td>
            <td>${escapeHtml(item.courseTitle || '')}</td>
            <td>${escapeHtml(item.units || '')}</td>
            <td>${escapeHtml(item.time || '')}</td>
            <td>${escapeHtml(item.room || '')}</td>
            <td>${escapeHtml(item.instructor || '')}</td>
            <td>${escapeHtml(item.maxNo || '')}</td>
            <td>${escapeHtml(item.lang || '')}</td>
            <td>${escapeHtml(item.level || '')}</td>
            <td>${escapeHtml(item.freeSlots || '')}</td>
            <td>${escapeHtml(item.remarks || '')}</td>
        `;
        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);

    if (classes.length > limit) {
        const noteRow = document.createElement('tr');
        noteRow.innerHTML = `
            <td colspan="13" style="font-size: 12px; color: hsl(var(--muted-foreground)); text-align: center; padding: 12px 8px;">
                Showing ${limit.toLocaleString()} of ${classes.length.toLocaleString()} classes. Export data from the popup for the full list.
            </td>
        `;
        tbody.appendChild(noteRow);
    }
}

function renderGenericTables(dataset, containerId, emptyConfig) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    const structured = sanitizeSimpleDataset(dataset);
    if (!structured) {
        container.innerHTML = buildEmptyState(emptyConfig);
        return;
    }

    const tables = Array.isArray(structured.tables) ? structured.tables : [];
    const text = typeof structured.text === 'string' ? structured.text.trim() : '';
    const capturedAt = structured.capturedAt;

    if (!tables.length && !text) {
        container.innerHTML = buildEmptyState(emptyConfig);
        return;
    }

    const sections = [];
    tables.forEach((table, index) => {
        sections.push(renderGenericTable(table, index, capturedAt));
    });

    if (!tables.length && text) {
        sections.push(renderGenericTextBlock(text, capturedAt));
    }

    if (tables.length && text) {
        sections.push(renderGenericTextBlock(text, capturedAt));
    }

    container.innerHTML = sections.join('');
}

function renderGenericTable(table, index, capturedAt) {
    const headers = Array.isArray(table.headers) && table.headers.length
        ? table.headers
        : (Array.isArray(table.rows) && table.rows.length
            ? table.rows[0].map((_, idx) => `Column ${idx + 1}`)
            : []);
    const rows = Array.isArray(table.rows) ? table.rows : [];
    const rowMarkup = rows.length
        ? rows.map(row => {
            const cells = headers.length
                ? headers.map((_, idx) => escapeHtml(row[idx] || ''))
                : row.map(cell => escapeHtml(cell || ''));
            return `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
        }).join('')
        : `<tr><td colspan="${Math.max(headers.length, 1)}" style="text-align: center; color: hsl(var(--muted-foreground));">No rows</td></tr>`;

    const caption = table.caption || `Table ${index + 1}`;
    const metaParts = [];
    if (rows.length) {
        metaParts.push(`${rows.length.toLocaleString()} rows`);
    }
    if (capturedAt) {
        metaParts.push(`Captured ${escapeHtml(formatRelativeTime(capturedAt))}`);
    }
    const meta = metaParts.join(' • ');

    return `
        <div class="generic-table">
            <div class="generic-table-header">
                <span>${escapeHtml(caption)}</span>
                <span>${meta}</span>
            </div>
            <div class="generic-table-body">
                <table class="data-table">
                    <thead>
                        <tr>${headers.length ? headers.map(header => `<th>${escapeHtml(header)}</th>`).join('') : '<th>Value</th>'}</tr>
                    </thead>
                    <tbody>
                        ${rowMarkup}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderGenericTextBlock(text, capturedAt) {
    const meta = capturedAt ? `Captured ${escapeHtml(formatRelativeTime(capturedAt))}` : '';

    return `
        <div class="generic-table">
            <div class="generic-table-header">
                <span>Captured Content</span>
                <span>${meta}</span>
            </div>
            <div class="generic-table-body">
                <pre>${escapeHtml(text)}</pre>
            </div>
        </div>
    `;
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
        { key: 'time', label: 'Schedule' },
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
        } else if (isPlainObject(dataset)) {
            const tableSections = convertTableDatasetToSections(label, dataset);
            sections.push(...tableSections);
        }
    });

    return sections.length > 0 ? sections.join('\n') : 'No data available';
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
                : (Array.isArray(table.rows) && table.rows.length
                    ? table.rows[0].map((_, idx) => `Column ${idx + 1}`)
                    : []);
            const rows = Array.isArray(table.rows) ? table.rows : [];
            const headerLine = headers.map(escapeForCSV).join(',');
            const rowLines = rows.map(row => row.map(cell => escapeForCSV(cell)).join(','));
            sections.push([`${label.toUpperCase()} - TABLE ${index + 1}`, headerLine, ...rowLines, ''].join('\n'));
        });
    }

    if (!dataset.tables?.length && dataset.text) {
        sections.push(`${label.toUpperCase()}\n${escapeForCSV(dataset.text)}\n`);
    }

    return sections;
}

function getColumnsForItems(items, configuredColumns) {
    if (Array.isArray(configuredColumns) && configuredColumns.length) {
        return configuredColumns.map(column => (
            typeof column === 'string'
                ? { key: column, label: formatDatasetLabel(column) }
                : { key: column.key, label: column.label || formatDatasetLabel(column.key) }
        ));
    }

    const firstItem = items.find(item => item && typeof item === 'object');
    if (!firstItem) {
        return [];
    }

    return Object.keys(firstItem).map(key => ({ key, label: formatDatasetLabel(key) }));
}

function escapeForCSV(value) {
    return escapeCsvValue(value ?? '');
}

function createMetadataSection(label, capturedAt) {
    const lines = [`${label.toUpperCase()} - METADATA`];
    if (capturedAt) {
        lines.push(`Captured,${escapeForCSV(formatTimestamp(capturedAt))}`);
    }
    lines.push('');
    return lines.join('\n');
}

function escapeCsvValue(value) {
    const stringValue = typeof value === 'string' ? value : String(value ?? '');
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function formatLogsForDownload(logs = []) {
    if (!Array.isArray(logs) || logs.length === 0) {
        return 'No logs available';
    }
    return logs
        .map(log => {
            const timestamp = log.timestamp || new Date().toISOString();
            const type = (log.type || 'info').toUpperCase();
            const context = log.context ? JSON.stringify(log.context) : '';
            return `[${timestamp}] [${type}] ${log.message || ''} ${context}`.trim();
        })
        .join('\n');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    if (extensionApi?.downloads?.download) {
        extensionApi.downloads.download({
            url,
            filename,
            saveAs: false,
            conflictAction: 'uniquify'
        }, () => {
            URL.revokeObjectURL(url);
        });
        return;
    }

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

async function getLatestStateSnapshot() {
    if (latestState) {
        return latestState;
    }
    if (!extensionApi?.storage?.local) {
        return {};
    }
    const result = await new Promise((resolve) => {
        extensionApi.storage.local.get(['scrapingState'], resolve);
    });
    return result?.scrapingState || {};
}

async function downloadJsonData() {
    const state = await getLatestStateSnapshot();
    const jsonData = JSON.stringify(state.scrapedData || {}, null, 2);
    downloadFile(jsonData, 'aisis_data.json', 'application/json');
}

async function downloadCsvData() {
    const state = await getLatestStateSnapshot();
    const csvData = convertToCSV(state.scrapedData || {});
    downloadFile(csvData, 'aisis_data.csv', 'text/csv');
}

async function downloadLogsFile() {
    const state = await getLatestStateSnapshot();
    const logsText = formatLogsForDownload(state.logs || []);
    downloadFile(logsText, 'aisis_scraper_logs.txt', 'text/plain');
}

async function downloadHarFile() {
    try {
        const response = await sendRuntimeMessage({ action: 'exportHAR' });
        if (response?.success) {
            const harData = JSON.stringify(response.har, null, 2);
            downloadFile(harData, 'aisis_scraper.har', 'application/json');
        }
    } catch (error) {
        console.error('Failed to export HAR:', error);
    }
}

async function downloadHtmlSnapshots() {
    try {
        const response = await sendRuntimeMessage({ action: 'exportHTMLSnapshots' });
        if (response?.success) {
            const htmlData = JSON.stringify(response.snapshots, null, 2);
            downloadFile(htmlData, 'aisis_html_snapshots.json', 'application/json');
        }
    } catch (error) {
        console.error('Failed to export HTML snapshots:', error);
    }
}

async function downloadClassScheduleJson() {
    const state = await getLatestStateSnapshot();
    const dataset = state.scrapedData?.classSchedule;
    const schedule = getWeeklyScheduleFromDataset(dataset);
    if (!schedule) {
        const placeholder = {
            message: 'No class schedule data available.',
            generatedAt: new Date().toISOString()
        };
        downloadFile(JSON.stringify(placeholder, null, 2), 'class_schedule.json', 'application/json');
        return;
    }

    const capturedAt = dataset?.capturedAt || schedule.generatedAt || new Date().toISOString();
    const payload = {
        generatedAt: capturedAt,
        days: schedule.days || [],
        slots: schedule.slots || [],
        events: schedule.events || []
    };

    downloadFile(JSON.stringify(payload, null, 2), 'class_schedule.json', 'application/json');
}

async function handleDownloadAction(action) {
    const handlers = {
        json: downloadJsonData,
        classScheduleJson: downloadClassScheduleJson,
        csv: downloadCsvData,
        logs: downloadLogsFile,
        har: downloadHarFile,
        html: downloadHtmlSnapshots
    };

    const handler = handlers[action];
    if (handler) {
        try {
            await handler();
        } catch (error) {
            console.error(`Download action failed for ${action}:`, error);
        }
    }
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
