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
let latestState = null;

async function loadDashboardData() {
    try {
        const result = await chrome.storage.local.get(['scrapingState']);
        const state = result.scrapingState || {};
        applyDashboardState(state);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function applyDashboardState(state = {}) {
    latestState = state;
    const data = state.scrapedData || {};

    renderOperationalStatus(state);
    renderMetrics(state.metrics || {});
    renderLogs(state.logs || [], state.logsTrimmed);
    renderErrors(state.errors || []);
    renderDatasetProgress(state.datasetProgress || {});

    loadOverviewStats(data, state);
    loadGrades(data.grades || []);

    const classScheduleRows = Array.isArray(data.schedule)
        ? data.schedule
        : deriveClassSchedule(data.classSchedule);
    loadSchedule(classScheduleRows);
    renderScheduleOfClasses(data.scheduleOfClasses || []);
    renderCurriculum(data.officialCurriculum || [], state.datasetProgress?.officialCurriculum);

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
    loadDashboardData();
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.scrapingState) {
        return;
    }
    const newValue = changes.scrapingState.newValue;
    if (newValue) {
        applyDashboardState(newValue);
    }
});

chrome.runtime.onMessage.addListener((message) => {
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

function renderDatasetProgress(progressMap = {}) {
    const container = document.getElementById('dataset-progress-overview');
    if (!container) {
        return;
    }

    const entries = Object.entries(progressMap).filter(([, value]) => value && typeof value === 'object');

    if (!entries.length) {
        container.innerHTML = buildEmptyState({
            icon: '📡',
            title: 'No Active Runs',
            description: 'Start the scraper to watch dataset progress updates in real-time.'
        });
        return;
    }

    const cards = entries
        .sort((a, b) => {
            const labelA = (a[1].label || formatDatasetName(a[0])).toLowerCase();
            const labelB = (b[1].label || formatDatasetName(b[0])).toLowerCase();
            return labelA.localeCompare(labelB);
        })
        .map(([key, value]) => {
            const completed = Number(value.completed) || 0;
            const total = Number(value.total) || 0;
            const displayTotal = total || Math.max(completed, 1);
            const percent = displayTotal > 0 ? Math.min(100, Math.round((completed / displayTotal) * 100)) : 0;
            const items = Number(value.items) || 0;
            const detail = value.detail ? escapeHtml(String(value.detail)) : '';
            const updated = value.updatedAt ? formatRelativeTime(value.updatedAt) : null;
            const label = value.label || formatDatasetName(key);
            const metaParts = [];
            if (items) {
                metaParts.push(`${items.toLocaleString()} items`);
            }
            if (updated) {
                metaParts.push(`Updated ${escapeHtml(updated)}`);
            }
            const meta = metaParts.join(' • ');

            return `
                <div class="dataset-progress-card">
                    <div class="dataset-progress-header">
                        <span>${escapeHtml(label)}</span>
                        <span>${completed.toLocaleString()}/${displayTotal.toLocaleString()}</span>
                    </div>
                    <div class="dataset-progress-bar">
                        <div class="dataset-progress-fill" style="width: ${percent}%;"></div>
                    </div>
                    <div class="dataset-progress-meta">${meta || 'No metrics yet'}</div>
                    ${detail ? `<div class="dataset-progress-footnote">${detail}</div>` : ''}
                </div>
            `;
        })
        .join('');

    container.innerHTML = cards;
}

function renderCurriculum(courses, progressInfo) {
    const container = document.getElementById('curriculum-groups');
    const emptyState = document.getElementById('curriculum-empty');
    const programCountEl = document.getElementById('curriculum-program-count');
    const courseCountEl = document.getElementById('curriculum-course-count');
    const updatedEl = document.getElementById('curriculum-updated');

    if (!container) {
        return;
    }

    if (!Array.isArray(courses) || courses.length === 0) {
        container.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
        }
        if (programCountEl) {
            programCountEl.textContent = '0';
        }
        if (courseCountEl) {
            courseCountEl.textContent = '0';
        }
        if (updatedEl) {
            updatedEl.textContent = progressInfo && progressInfo.updatedAt
                ? formatRelativeTime(progressInfo.updatedAt)
                : '—';
        }
        return;
    }

    if (emptyState) {
        emptyState.classList.add('hidden');
    }

    const grouped = courses.reduce((acc, course) => {
        const code = course.degreeCode || 'Unknown';
        if (!acc[code]) {
            acc[code] = {
                name: course.degreeProgram || formatDatasetName(code),
                courses: []
            };
        }
        acc[code].courses.push(course);
        return acc;
    }, {});

    const entries = Object.entries(grouped).sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (programCountEl) {
        programCountEl.textContent = entries.length.toLocaleString();
    }
    if (courseCountEl) {
        const totalCourses = courses.length;
        courseCountEl.textContent = totalCourses.toLocaleString();
    }
    if (updatedEl) {
        updatedEl.textContent = progressInfo && progressInfo.updatedAt
            ? formatRelativeTime(progressInfo.updatedAt)
            : '—';
    }

    const sections = entries.map(([code, group], index) => {
        const header = `
            <summary>${escapeHtml(group.name)} • ${group.courses.length.toLocaleString()} courses</summary>
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
                ${header}
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
    }).join('');

    container.innerHTML = sections;
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

    const tables = dataset && Array.isArray(dataset.tables) ? dataset.tables : [];
    const text = dataset && typeof dataset.text === 'string' ? dataset.text.trim() : '';
    const capturedAt = dataset && dataset.capturedAt;

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
                <span>Details</span>
                <span>${meta}</span>
            </div>
            <div class="generic-table-body">
                <pre>${escapeHtml(text)}</pre>
            </div>
        </div>
    `;
}

function deriveClassSchedule(dataset) {
    if (!dataset || !Array.isArray(dataset.tables) || dataset.tables.length === 0) {
        return [];
    }

    const table = dataset.tables[0];
    const rows = Array.isArray(table.rows) ? table.rows : [];

    return rows.map(row => ({
        courseCode: row[0] || '',
        section: row[1] || '',
        schedule: row[2] || row[3] || '',
        room: row[3] || row[4] || '',
        instructor: row[4] || row[5] || ''
    }));
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
