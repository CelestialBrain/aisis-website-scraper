// AISIS Auto Scraper - Enhanced Background Script with HAR Capture
// This version includes comprehensive debugging and HAR file generation

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

const LOG_HISTORY_LIMIT = 500;
const DEFAULT_FETCH_TIMEOUT_MS = 90_000; // 90s timeout to tolerate slow AISIS responses
const MAX_HAR_ENTRIES = 200;
const MAX_HAR_BODY_LENGTH = 200_000; // Limit HAR bodies to ~200 KB to avoid excessive storage use
const MAX_HTML_SNAPSHOTS = 20;
const MAX_HTML_SNAPSHOT_SIZE = 250_000; // Limit HTML snapshots to ~250 KB each
const POPUP_DIMENSIONS = Object.freeze({ width: 520, height: 760 });

const NAVIGATION_PATTERNS = [
  /home\s*:\s*sign\s*out/i,
  /student information system/i,
  /official curriculum view/i,
  /class schedules? view/i,
  /view student grades/i,
  /class schedule view/i,
  /curriculum view/i,
  /aisis main/i
];

const DAY_LABELS = {
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  weds: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday',
  sun: 'Sunday',
  sunday: 'Sunday'
};

const DEFAULT_METRICS = {
  totalRequests: 0,
  totalResponseTimeMs: 0,
  avgResponseMs: 0,
  bytesDownloaded: 0,
  slowResponses: 0,
  lastResponseMs: 0,
  lastStatus: null,
  lastRequestUrl: null,
  lastRequestMethod: null,
  lastRequestAt: null
};

function createInitialState(overrides = {}) {
  return {
    isRunning: false,
    isPaused: false,
    isCompleted: false,
    sessionId: null,
    cookieSession: null,
    progress: 0,
    currentStep: '',
    currentPage: '',
    totalSteps: 0,
    completedSteps: 0,
    activeDataset: null,
    substepProgress: 0,
    startTime: null,
    logs: [],
    scrapedData: {},
    errors: [],
    debugMode: false,
    harEntries: [],
    htmlSnapshotOrder: [],
    htmlSnapshots: {},
    metrics: { ...DEFAULT_METRICS },
    logsTrimmed: false,
    lastUpdated: null,
    startedAt: null,
    completedAt: null,
    lastLogAt: null,
    selectedPages: null,
    checkpoints: {},
    pageOrder: [],
    currentDatasetIndex: 0,
    pauseRequested: false,
    datasetProgress: {},
    ...overrides,
    metrics: { ...DEFAULT_METRICS, ...(overrides.metrics || {}) }
  };
}

// Global state
let scrapingState = createInitialState();
let popupWindowId = null;
let enforcePopupBoundsTimer = null;

// Generate session ID
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDatasetLabel(key) {
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

function updateDatasetProgress(key, updates = {}) {
  if (!key) {
    return;
  }

  if (!scrapingState.datasetProgress) {
    scrapingState.datasetProgress = {};
  }

  const existing = scrapingState.datasetProgress[key] || {};
  scrapingState.datasetProgress[key] = {
    label: updates.label || existing.label || formatDatasetLabel(key),
    completed: updates.completed !== undefined ? updates.completed : existing.completed || 0,
    total: updates.total !== undefined ? updates.total : existing.total || 0,
    items: updates.items !== undefined ? updates.items : existing.items || 0,
    detail: updates.detail !== undefined ? updates.detail : existing.detail || null,
    updatedAt: new Date().toISOString()
  };
}

function normalizePageSelection(pages = {}) {
  return {
    scheduleOfClasses: Boolean(pages.scheduleOfClasses || pages.schedule),
    officialCurriculum: Boolean(pages.officialCurriculum || pages.curriculum),
    grades: Boolean(pages.grades || pages.viewGrades),
    advisoryGrades: Boolean(pages.advisoryGrades || pages.advisory),
    enrolledClasses: Boolean(pages.enrolledClasses || pages.currentlyEnrolled),
    classSchedule: Boolean(pages.classSchedule || pages.myClassSchedule),
    tuitionReceipt: Boolean(pages.tuitionReceipt || pages.receipts),
    studentInfo: Boolean(pages.studentInfo || pages.profile),
    programOfStudy: Boolean(pages.programOfStudy || pages.program),
    holdOrders: Boolean(pages.holdOrders || pages.holds),
    facultyAttendance: Boolean(pages.facultyAttendance || pages.faculty)
  };
}

function stripHtml(value = '') {
  return value
    .replace(/<br\s*\/>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTablesFromHTML(html) {
  const tables = [];
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHTML = tableMatch[0];
    const captionMatch = tableHTML.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    const caption = captionMatch ? stripHtml(captionMatch[1]) : null;

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const parsedRows = [];
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableHTML)) !== null) {
      const rowHTML = rowMatch[1];
      const cellRegex = /<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi;
      const cells = [];
      let cellMatch;
      let isHeaderRow = false;

      while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
        const cellType = (cellMatch[1] || '').toLowerCase();
        if (cellType === 'th') {
          isHeaderRow = true;
        }
        cells.push(stripHtml(cellMatch[2] || ''));
      }

      if (cells.length) {
        parsedRows.push({ cells, isHeaderRow });
      }
    }

    if (parsedRows.length === 0) {
      continue;
    }

    const headerEntry = parsedRows.find(row => row.isHeaderRow) || parsedRows[0];
    const headers = headerEntry.cells;
    const dataRows = parsedRows.filter(row => row !== headerEntry).map(row => row.cells);

    tables.push({
      caption,
      headers,
      rows: dataRows,
      totalRows: dataRows.length
    });
  }

  return tables;
}

function cleanCellText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  const stringValue = String(value)
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ');
  const lines = stringValue
    .split('\n')
    .map(line => line.trim())
    .filter((line, index, array) => line.length > 0 || (index > 0 && array[index - 1].length > 0));
  return lines.join('\n').trim();
}

function normalizeTable(table) {
  if (!table || typeof table !== 'object') {
    return null;
  }
  const headers = Array.isArray(table.headers)
    ? table.headers.map(header => cleanCellText(header)).filter(Boolean)
    : [];
  const rows = Array.isArray(table.rows)
    ? table.rows
        .map(row => Array.isArray(row) ? row.map(cell => cleanCellText(cell)) : [])
        .filter(row => row.some(cell => cell && cell.length > 0))
    : [];

  return {
    caption: table.caption || null,
    headers,
    rows,
    totalRows: rows.length
  };
}

function isLikelyNavigationTable(table) {
  if (!table) {
    return true;
  }
  const rows = Array.isArray(table.rows) ? table.rows : [];
  if (!rows.length) {
    return true;
  }
  const combinedHeader = Array.isArray(table.headers) ? table.headers.join(' ') : '';
  const combinedCells = rows.flat().join(' ');
  const combinedText = `${combinedHeader} ${combinedCells}`.trim();
  if (!combinedText) {
    return true;
  }
  if (rows.length <= 3) {
    return NAVIGATION_PATTERNS.some(pattern => pattern.test(combinedText));
  }
  return false;
}

function sanitizeTablesForDataset(dataKey, tables) {
  if (!Array.isArray(tables)) {
    return [];
  }
  return tables
    .map(table => normalizeTable(table))
    .filter(table => table && (!isLikelyNavigationTable(table) || table.totalRows > 3));
}

function sanitizePageText(dataKey, text) {
  if (!text) {
    return '';
  }
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !NAVIGATION_PATTERNS.some(pattern => pattern.test(line)));
  return lines.join('\n');
}

function splitScheduleEntries(cellText) {
  if (!cellText) {
    return [];
  }
  const normalized = cellText.replace(/\r/g, '').trim();
  if (!normalized) {
    return [];
  }
  const doubleBreaks = normalized.split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
  if (doubleBreaks.length > 1) {
    return doubleBreaks;
  }
  const lines = normalized.split('\n');
  const entries = [];
  let buffer = [];
  lines.forEach(line => {
    const isCourseHeader = /^[A-Za-z]{2,}\s*\d+[A-Za-z0-9]*/.test(line);
    if (isCourseHeader && buffer.length) {
      entries.push(buffer.join('\n').trim());
      buffer = [line];
    } else {
      buffer.push(line);
    }
  });
  if (buffer.length) {
    entries.push(buffer.join('\n').trim());
  }
  return entries.filter(Boolean);
}

function parseTimeComponent(value, meridiemHint = null) {
  if (!value) {
    return null;
  }
  let text = String(value).trim();
  if (!text) {
    return null;
  }
  let meridiem = null;
  const meridiemMatch = text.match(/(am|pm)$/i);
  if (meridiemMatch) {
    meridiem = meridiemMatch[1].toLowerCase();
    text = text.slice(0, meridiemMatch.index).trim();
  } else if (meridiemHint) {
    meridiem = meridiemHint;
  }
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) {
    return null;
  }
  let hours;
  let minutes;
  if (digits.length <= 2) {
    hours = parseInt(digits, 10);
    minutes = 0;
  } else if (digits.length === 3) {
    hours = parseInt(digits.slice(0, 1), 10);
    minutes = parseInt(digits.slice(1), 10);
  } else {
    hours = parseInt(digits.slice(0, digits.length - 2), 10);
    minutes = parseInt(digits.slice(-2), 10);
  }
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  if (minutes < 0 || minutes > 59) {
    return null;
  }
  if (meridiem) {
    if (meridiem === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0;
    }
  }
  return { hours, minutes };
}

function parseTimeRangeLabel(label) {
  if (!label) {
    return null;
  }
  const sanitized = String(label).replace(/–|—/g, '-');
  const parts = sanitized.split(/-|to/i).map(part => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const endMatch = parts[parts.length - 1].match(/(am|pm)$/i);
  const meridiemHint = endMatch ? endMatch[1].toLowerCase() : null;
  const start = parseTimeComponent(parts[0], meridiemHint);
  const end = parseTimeComponent(parts[parts.length - 1], meridiemHint);
  if (!start || !end) {
    return null;
  }
  const startTime = `${String(start.hours).padStart(2, '0')}:${String(start.minutes).padStart(2, '0')}`;
  const endTime = `${String(end.hours).padStart(2, '0')}:${String(end.minutes).padStart(2, '0')}`;
  return { start: startTime, end: endTime };
}

function formatTimeRangeLabel(range, fallback = '') {
  if (!range || !range.start || !range.end) {
    return fallback;
  }
  return `${range.start} - ${range.end}`;
}

function computeDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) {
    return null;
  }
  const [startHours, startMinutes] = startTime.split(':').map(part => parseInt(part, 10));
  const [endHours, endMinutes] = endTime.split(':').map(part => parseInt(part, 10));
  if ([startHours, startMinutes, endHours, endMinutes].some(value => Number.isNaN(value))) {
    return null;
  }
  const startTotal = startHours * 60 + startMinutes;
  let endTotal = endHours * 60 + endMinutes;
  if (endTotal < startTotal) {
    endTotal += 24 * 60;
  }
  return endTotal - startTotal;
}

function parseScheduleBlock(block, context) {
  if (!block) {
    return null;
  }
  const cleaned = block.replace(/\r/g, '').trim();
  if (!cleaned) {
    return null;
  }
  const lines = cleaned.split('\n').map(line => line.trim()).filter(Boolean);
  if (!lines.length) {
    return null;
  }
  const firstLine = lines[0];
  const courseMatch = firstLine.match(/^([A-Za-z]{2,}\s*\d+[A-Za-z0-9]*)/);
  const sectionMatch = firstLine.match(/sec(?:tion)?[-\s]*([A-Za-z0-9]+)/i);
  const modeMatch = firstLine.match(/\(([^)]+)\)/);
  const courseCode = courseMatch ? courseMatch[1].replace(/\s+/g, ' ').toUpperCase() : null;
  const section = sectionMatch ? sectionMatch[1].toUpperCase() : null;

  const remaining = lines.slice(1);
  let courseTitle = null;
  let instructor = null;
  let room = null;
  const extraDetails = [];

  remaining.forEach(line => {
    if (!instructor && /,/.test(line) && /[A-Za-z]/.test(line)) {
      instructor = line;
      return;
    }
    if (!room && /(?:room|rm|avr|hall|lab|sec|fully|onsite|online|hyflex|hybrid|campus)/i.test(line)) {
      room = line;
      return;
    }
    if (!courseTitle) {
      courseTitle = line;
      return;
    }
    extraDetails.push(line);
  });

  if (!room) {
    const candidate = remaining.find(line => !/,/.test(line));
    if (candidate) {
      room = candidate;
    }
  }

  const durationMinutes = computeDurationMinutes(context.startTime, context.endTime);

  return {
    id: `event_${context.tableIndex}_${context.slotIndex}_${context.entryIndex}_${context.dayKey}`,
    dayKey: context.dayKey,
    dayLabel: context.dayLabel,
    startTime: context.startTime,
    endTime: context.endTime,
    timeLabel: formatTimeRangeLabel({ start: context.startTime, end: context.endTime }, context.timeLabel),
    durationMinutes,
    summary: firstLine,
    courseCode,
    section,
    courseTitle,
    mode: modeMatch ? modeMatch[1] : null,
    room: room || null,
    instructor: instructor || null,
    details: extraDetails,
    lines,
    raw: cleaned,
    occurrence: {
      day: context.dayLabel,
      dayKey: context.dayKey,
      startTime: context.startTime,
      endTime: context.endTime,
      durationMinutes
    }
  };
}

function buildWeeklySchedule(tables) {
  if (!Array.isArray(tables) || tables.length === 0) {
    return null;
  }

  let scheduleTable = null;
  let scheduleTableIndex = -1;
  for (let index = 0; index < tables.length; index += 1) {
    const table = tables[index];
    if (!table) {
      continue;
    }
    const headers = Array.isArray(table.headers) ? table.headers : [];
    if (!headers.length || headers.length < 2) {
      continue;
    }
    const timeHeader = headers[0] || '';
    const hasTimeHeader = /time/i.test(timeHeader) || /\d{3,4}/.test(timeHeader);
    const dayColumns = headers.slice(1).filter(Boolean).map(header => {
      const key = String(header).toLowerCase().replace(/[^a-z]/g, '');
      return { header, key, label: DAY_LABELS[key] };
    });
    const hasValidDay = dayColumns.some(column => Boolean(column.label));
    if (hasTimeHeader && hasValidDay) {
      scheduleTable = table;
      scheduleTableIndex = index;
      break;
    }
  }

  if (!scheduleTable) {
    return null;
  }

  const headers = Array.isArray(scheduleTable.headers) ? scheduleTable.headers : [];
  const dayColumns = headers
    .map((header, index) => {
      if (index === 0) {
        return null;
      }
      const key = String(header).toLowerCase().replace(/[^a-z]/g, '');
      const label = DAY_LABELS[key];
      if (!label) {
        return null;
      }
      return { index, key: key || `day${index}`, label };
    })
    .filter(Boolean);

  if (!dayColumns.length) {
    return null;
  }

  const dayOrder = dayColumns.reduce((acc, column, idx) => {
    acc[column.key] = idx;
    return acc;
  }, {});

  const rows = Array.isArray(scheduleTable.rows) ? scheduleTable.rows : [];
  const slots = [];
  const events = [];

  rows.forEach((row, rowIndex) => {
    if (!Array.isArray(row) || row.length === 0) {
      return;
    }
    const timeLabel = row[0] || headers[0] || '';
    const timeRange = parseTimeRangeLabel(timeLabel);
    if (!timeRange) {
      return;
    }
    const slot = {
      index: rowIndex,
      rawLabel: timeLabel,
      label: formatTimeRangeLabel(timeRange, timeLabel),
      startTime: timeRange.start,
      endTime: timeRange.end,
      entries: []
    };

    dayColumns.forEach((column) => {
      const cellText = row[column.index] || '';
      const trimmed = typeof cellText === 'string' ? cellText.trim() : '';
      if (!trimmed) {
        return;
      }
      const blocks = splitScheduleEntries(trimmed);
      const segments = blocks.length ? blocks : [trimmed];
      segments.forEach((segment, entryIndex) => {
        const event = parseScheduleBlock(segment, {
          dayKey: column.key,
          dayLabel: column.label,
          timeLabel,
          startTime: timeRange.start,
          endTime: timeRange.end,
          slotIndex: rowIndex,
          tableIndex: scheduleTableIndex,
          entryIndex
        });
        if (event) {
          events.push(event);
          slot.entries.push(event);
        }
      });
    });

    slot.entryCount = slot.entries.length;
    slots.push(slot);
  });

  if (!events.length) {
    return null;
  }

  events.sort((a, b) => {
    const dayDiff = (dayOrder[a.dayKey] ?? 0) - (dayOrder[b.dayKey] ?? 0);
    if (dayDiff !== 0) {
      return dayDiff;
    }
    return (a.startTime || '').localeCompare(b.startTime || '');
  });

  return {
    days: dayColumns.map(column => ({ key: column.key, label: column.label })),
    slots,
    events,
    eventCount: events.length
  };
}

function updateCookieSession() {
  return new Promise((resolve) => {
    if (!chrome.cookies || typeof chrome.cookies.get !== 'function') {
      resolve(null);
      return;
    }

    chrome.cookies.get({ url: 'https://aisis.ateneo.edu/', name: 'JSESSIONID' }, (cookie) => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to read AISIS session cookie:', chrome.runtime.lastError.message);
        resolve(null);
        return;
      }

      const value = cookie?.value || null;
      scrapingState.cookieSession = value;
      persistState();
      resolve(value);
    });
  });
}

// Load persisted state on startup
chrome.storage.local.get('scrapingState', (result) => {
  if (result.scrapingState) {
    scrapingState = createInitialState({
      ...result.scrapingState,
      logs: Array.isArray(result.scrapingState.logs) ? result.scrapingState.logs.slice(-LOG_HISTORY_LIMIT) : [],
      scrapedData: result.scrapingState.scrapedData || {},
      errors: Array.isArray(result.scrapingState.errors) ? result.scrapingState.errors : [],
      harEntries: Array.isArray(result.scrapingState.harEntries) ? result.scrapingState.harEntries : [],
      htmlSnapshots: result.scrapingState.htmlSnapshots || {},
      logsTrimmed:
        Array.isArray(result.scrapingState.logs) && result.scrapingState.logs.length > LOG_HISTORY_LIMIT
          ? true
          : result.scrapingState.logsTrimmed || false
    });
    scrapingState.isRunning = false;
  }
});

// Persist state to storage
function persistState() {
  scrapingState.lastUpdated = new Date().toISOString();
  chrome.storage.local.set({ scrapingState: scrapingState });
}

function ensureCheckpointContainer() {
  if (!scrapingState.checkpoints || typeof scrapingState.checkpoints !== 'object') {
    scrapingState.checkpoints = {};
  }
}

function setCheckpoint(datasetKey, data = {}) {
  if (!datasetKey) {
    return;
  }
  ensureCheckpointContainer();
  scrapingState.checkpoints[datasetKey] = {
    ...data,
    recordedAt: new Date().toISOString()
  };
}

function getCheckpoint(datasetKey) {
  return scrapingState.checkpoints?.[datasetKey] || null;
}

function clearCheckpoint(datasetKey) {
  if (!datasetKey || !scrapingState.checkpoints) {
    return;
  }
  delete scrapingState.checkpoints[datasetKey];
}

function isPauseActive() {
  return Boolean(scrapingState.pauseRequested || scrapingState.isPaused);
}

function enforcePopupBounds(windowId, immediate = false) {
  if (!windowId) {
    return;
  }

  const applyBounds = () => {
    chrome.windows.get(windowId, { populate: false }, (win) => {
      if (chrome.runtime.lastError || !win) {
        return;
      }

      const desiredWidth = POPUP_DIMENSIONS.width;
      const desiredHeight = POPUP_DIMENSIONS.height;

      const needsUpdate =
        win.state !== 'normal' ||
        typeof win.width === 'number' && win.width !== desiredWidth ||
        typeof win.height === 'number' && win.height !== desiredHeight;

      if (!needsUpdate) {
        return;
      }

      chrome.windows.update(windowId, {
        width: desiredWidth,
        height: desiredHeight,
        state: 'normal'
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to enforce popup bounds:', chrome.runtime.lastError.message);
        }
      });
    });
  };

  if (immediate) {
    applyBounds();
    return;
  }

  if (enforcePopupBoundsTimer) {
    clearTimeout(enforcePopupBoundsTimer);
  }

  enforcePopupBoundsTimer = setTimeout(applyBounds, 50);
}

function handleOpenScraperPopup(sendResponse) {
  const popupUrl = chrome.runtime.getURL('popup.html');

  const finalizeResponse = (payload) => {
    try {
      sendResponse(payload);
    } catch (error) {
      console.warn('Failed to respond to popup request:', error);
    }
  };

  const createWindow = () => {
    chrome.windows.create(
      {
        url: popupUrl,
        type: 'popup',
        width: POPUP_DIMENSIONS.width,
        height: POPUP_DIMENSIONS.height,
        focused: true
      },
      (newWindow) => {
        if (chrome.runtime.lastError || !newWindow) {
          finalizeResponse({
            success: false,
            error: chrome.runtime.lastError?.message || 'Unable to open scraper popup'
          });
          return;
        }

        popupWindowId = newWindow.id;
        enforcePopupBounds(newWindow.id, true);
        finalizeResponse({ success: true, created: true, windowId: newWindow.id });
      }
    );
  };

  const focusExisting = (windowId) => {
    chrome.windows.update(windowId, { focused: true, state: 'normal' }, () => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to focus popup window:', chrome.runtime.lastError.message);
        popupWindowId = null;
        createWindow();
        return;
      }
      enforcePopupBounds(windowId);
      finalizeResponse({ success: true, created: false, windowId });
    });
  };

  if (popupWindowId) {
    chrome.windows.get(popupWindowId, { populate: false }, (existingWindow) => {
      if (chrome.runtime.lastError || !existingWindow) {
        popupWindowId = null;
        createWindow();
        return;
      }
      focusExisting(existingWindow.id);
    });
    return;
  }

  createWindow();
}

chrome.windows.onRemoved.addListener((removedWindowId) => {
  if (popupWindowId === removedWindowId) {
    popupWindowId = null;
    if (enforcePopupBoundsTimer) {
      clearTimeout(enforcePopupBoundsTimer);
      enforcePopupBoundsTimer = null;
    }
  }
});

chrome.windows.onBoundsChanged.addListener((changedWindowId) => {
  if (changedWindowId === popupWindowId) {
    enforcePopupBounds(changedWindowId);
  }
});

// Utility: Add log entry
function addLog(message, type = 'info', context = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, message, type, context };
  scrapingState.logs.push(logEntry);
  scrapingState.lastLogAt = timestamp;
  if (scrapingState.logs.length > LOG_HISTORY_LIMIT) {
    scrapingState.logs = scrapingState.logs.slice(-LOG_HISTORY_LIMIT);
    scrapingState.logsTrimmed = true;
  }
  console.log(`[${type.toUpperCase()}] ${message}` + (Object.keys(context || {}).length ? ` ${JSON.stringify(context)}` : ''));

  // Persist state
  persistState();

  // Send update to popup
  chrome.runtime.sendMessage({ 
    action: 'updateProgress', 
    state: scrapingState 
  }).catch(() => {}); // Ignore if popup is closed
}

// Utility: Save HTML snapshot for debugging
function saveHTMLSnapshot(pageName, html) {
  if (!pageName || typeof html !== 'string') {
    return;
  }

  const shouldCapture =
    scrapingState.debugMode ||
    scrapingState.htmlSnapshotOrder.length < MAX_HTML_SNAPSHOTS ||
    scrapingState.htmlSnapshotOrder.includes(pageName);

  if (!shouldCapture) {
    return;
  }

  const truncatedHtml = html.length > MAX_HTML_SNAPSHOT_SIZE
    ? `${html.slice(0, MAX_HTML_SNAPSHOT_SIZE)}\n<!-- truncated -->`
    : html;

  scrapingState.htmlSnapshots[pageName] = {
    timestamp: new Date().toISOString(),
    html: truncatedHtml,
    length: html.length
  };

  const existingIndex = scrapingState.htmlSnapshotOrder.indexOf(pageName);
  if (existingIndex !== -1) {
    scrapingState.htmlSnapshotOrder.splice(existingIndex, 1);
  }
  scrapingState.htmlSnapshotOrder.push(pageName);

  while (scrapingState.htmlSnapshotOrder.length > MAX_HTML_SNAPSHOTS) {
    const removed = scrapingState.htmlSnapshotOrder.shift();
    if (removed && scrapingState.htmlSnapshots[removed]) {
      delete scrapingState.htmlSnapshots[removed];
    }
  }

  addLog(`Saved HTML snapshot for ${pageName} (${html.length} bytes)`, 'debug');
}

// Utility: Add HAR entry
function addHAREntry(
  url,
  method,
  requestHeaders,
  requestBody,
  responseStatus,
  responseStatusText,
  responseHeaders,
  responseBody,
  timing
) {
    const entry = {
      startedDateTime: new Date().toISOString(),
      time: timing || 0,
    request: {
      method: method,
      url: url,
      headers: requestHeaders || [],
      postData: requestBody ? {
        mimeType: 'application/x-www-form-urlencoded',
        text: requestBody
      } : undefined
    },
    response: {
      status: responseStatus,
      statusText: responseStatusText || null,
      headers: responseHeaders || [],
      content: {
        size: responseBody ? responseBody.length : 0,
        mimeType: 'text/html',
        text: responseBody
          ? (responseBody.length > MAX_HAR_BODY_LENGTH
              ? `${responseBody.slice(0, MAX_HAR_BODY_LENGTH)}\n/* truncated */`
              : responseBody)
          : ''
      }
    }
  };

  scrapingState.harEntries.push(entry);
  if (scrapingState.harEntries.length > MAX_HAR_ENTRIES) {
    scrapingState.harEntries = scrapingState.harEntries.slice(-MAX_HAR_ENTRIES);
  }
  addLog(`HAR entry added: ${method} ${url} (${responseStatus})`, 'debug');
}

// Utility: Generate HAR file
function generateHAR() {
  return {
    log: {
      version: '1.2',
      creator: {
        name: 'AISIS Auto Scraper',
        version: '2.1'
      },
      entries: scrapingState.harEntries
    }
  };
}

// Utility: Simple encryption for credentials (Base64 - not secure, but better than plaintext)
function encryptCredentials(username, password) {
  return btoa(JSON.stringify({ username, password }));
}

function decryptCredentials(encrypted) {
  try {
    return JSON.parse(atob(encrypted));
  } catch (e) {
    return null;
  }
}

// Save credentials to storage
async function saveCredentials(username, password) {
  const encrypted = encryptCredentials(username, password);
  await chrome.storage.local.set({ credentials: encrypted });
  addLog('Credentials saved successfully', 'success');
}

// Load credentials from storage
async function loadCredentials() {
  const result = await chrome.storage.local.get('credentials');
  if (result.credentials) {
    return decryptCredentials(result.credentials);
  }
  return null;
}

// Utility: Delay function for rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function recordRequestMetrics({ url, method, status, responseTime, bytes }) {
  if (!scrapingState.metrics) {
    scrapingState.metrics = { ...DEFAULT_METRICS };
  }

  const metrics = scrapingState.metrics;
  metrics.totalRequests += 1;
  metrics.totalResponseTimeMs += responseTime;
  metrics.avgResponseMs = Math.round(metrics.totalResponseTimeMs / metrics.totalRequests);
  metrics.bytesDownloaded += bytes;
  metrics.lastResponseMs = responseTime;
  metrics.lastStatus = status;
  metrics.lastRequestUrl = url;
  metrics.lastRequestMethod = method;
  metrics.lastRequestAt = new Date().toISOString();
  if (responseTime > 5000) {
    metrics.slowResponses += 1;
  }

  persistState();
}

// Utility: Parse HTML response (service worker compatible) - ENHANCED VERSION
function parseHTML(htmlString) {
  // Since DOMParser is not available in service workers, we'll use regex and string methods
  return {
    querySelector: (selector) => {
      // Handle input[name="..."] selector
      const inputMatch = selector.match(/input\[name="([^"]+)"\]/);
      if (inputMatch) {
        const name = inputMatch[1];
        // Try multiple patterns for input fields
        const patterns = [
          new RegExp(`<input[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["']`, 'i'),
          new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i')
        ];
        
        for (const regex of patterns) {
          const match = htmlString.match(regex);
          if (match) return { value: match[1] };
        }
        return null;
      }
      
      // Handle select[name="..."] selector - ENHANCED
      const selectMatch = selector.match(/select\[name="([^"]+)"\]/);
      if (selectMatch) {
        const name = selectMatch[1];
        // More flexible regex that handles various HTML formatting
        const patterns = [
          new RegExp(`<select[^>]*name=["']${name}["'][^>]*>([\\s\\S]*?)<\\/select>`, 'i'),
          new RegExp(`<select[^>]*name=${name}[^>]*>([\\s\\S]*?)<\\/select>`, 'i')
        ];
        
        for (const regex of patterns) {
          const match = htmlString.match(regex);
          if (match) {
            const selectContent = match[1];
            return {
              querySelectorAll: (optionSelector) => {
                const options = [];
                // Enhanced option regex that handles various formats
                const optionPatterns = [
                  /<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)<\/option>/gi,
                  /<option[^>]*value=([^\s>]+)[^>]*>([^<]*)<\/option>/gi,
                  /<option[^>]*>([^<]*)<\/option>/gi
                ];
                
                for (const optionRegex of optionPatterns) {
                  let optionMatch;
                  const tempRegex = new RegExp(optionRegex.source, optionRegex.flags);
                  while ((optionMatch = tempRegex.exec(selectContent)) !== null) {
                    const value = optionMatch[1] || optionMatch[2] || '';
                    const text = optionMatch[2] || optionMatch[1] || '';
                    if (value && text) {
                      options.push({ value: value.trim(), textContent: text.trim() });
                    }
                  }
                  if (options.length > 0) break;
                }
                
                return options;
              },
              querySelector: (selectedOption) => {
                const selectedRegex = /<option[^>]*selected[^>]*value=["']([^"']*)["']/i;
                const selectedMatch = selectContent.match(selectedRegex);
                return selectedMatch ? { value: selectedMatch[1] } : null;
              }
            };
          }
        }
        return null;
      }
      
      // Handle table selector
      if (selector.includes('table')) {
        const tableRegex = /<table[^>]*>([\\s\\S]*?)<\/table>/i;
        const tableMatch = htmlString.match(tableRegex);
        if (tableMatch) {
          return {
            querySelectorAll: (rowSelector) => {
              if (rowSelector === 'tr') {
                const rows = [];
                const rowRegex = /<tr[^>]*>([\\s\\S]*?)<\/tr>/gi;
                let rowMatch;
                while ((rowMatch = rowRegex.exec(tableMatch[1])) !== null) {
                  rows.push({
                    querySelectorAll: (cellSelector) => {
                      const cells = [];
                      const cellRegex = /<td[^>]*>([\\s\\S]*?)<\/td>/gi;
                      let cellMatch;
                      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
                        cells.push({ textContent: cellMatch[1].replace(/<[^>]*>/g, '').trim() });
                      }
                      return cells;
                    }
                  });
                }
                return rows;
              }
              return [];
            }
          };
        }
      }
      
      return null;
    },
    body: {
      textContent: htmlString.replace(/<[^>]*>/g, '').trim()
    },
    // Add method to get raw HTML for debugging
    getRawHTML: () => htmlString
  };
}

// Track request timing for adaptive rate limiting
let lastRequestTime = 0;
let consecutiveSlowRequests = 0;

// Enhanced fetch wrapper with HAR capture with timeout
async function fetchWithHAR(url, options = {}) {
  const startTime = Date.now();
  const method = options.method || 'GET';
  addLog(`Fetching: ${method} ${url}`, 'debug', { url, method });

  // Add timeout to fetch (defaults to 90 seconds for slow AISIS server)
  const timeout = options.timeout || DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Adaptive rate limiting: detect slowdowns
    if (responseTime > 5000) { // If response took more than 5 seconds
      consecutiveSlowRequests++;
      addLog(
        `⚠️ Slow response: ${responseTime}ms (${consecutiveSlowRequests} consecutive slow requests)`,
        'warning',
        { url, method, responseTime, consecutiveSlowRequests }
      );

      if (consecutiveSlowRequests >= 3) {
        // Three consecutive slow requests = likely being rate limited
        const pauseDuration = 45000 + Math.random() * 15000; // 45-60 seconds
        addLog(
          `⏸️ Rate limit detected! Pausing for ${Math.round(pauseDuration/1000)}s...`,
          'warning',
          { url, method, pauseDuration, responseTime }
        );
        scrapingState.currentStep = `⏸️ Paused to avoid rate limiting (${Math.round(pauseDuration/1000)}s)`;
        updateProgress();
        await delay(pauseDuration);
        consecutiveSlowRequests = 0; // Reset counter after pause
        addLog('▶️ Resuming scraping...', 'info', { url, method });
      }
    } else if (responseTime < 2000) {
      // Fast response = reset slow request counter
      consecutiveSlowRequests = 0;
    }

    const responseText = await response.text();
    recordRequestMetrics({
      url,
      method,
      status: response.status,
      responseTime,
      bytes: responseText.length
    });

    // Convert headers to array format for HAR
    const requestHeaders = [];
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        requestHeaders.push({ name: key, value: value });
      }
    }
    
    const responseHeaders = [];
    response.headers.forEach((value, key) => {
      responseHeaders.push({ name: key, value: value });
    });
    
    // Add to HAR
    addHAREntry(
      url,
      options.method || 'GET',
      requestHeaders,
      options.body ? options.body.toString() : null,
      response.status,
      response.statusText,
      responseHeaders,
      responseText,
      responseTime
    );
    
    // Return a response-like object with the text
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      headers: response.headers,
      text: async () => responseText
    };
    
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      addLog(
        `⏱️ Request timeout after ${timeout / 1000}s: ${url}`,
        'error',
        { url, method, timeoutMs: timeout, timeoutSeconds: timeout / 1000 }
      );
      recordRequestMetrics({
        url,
        method,
        status: 'timeout',
        responseTime: timeout,
        bytes: 0
      });
      throw new Error(`Request timeout after ${timeout / 1000}s`);
    }
    addLog(`❌ Fetch error for ${url}: ${error.message}`, 'error', { url, method });
    recordRequestMetrics({
      url,
      method,
      status: 'error',
      responseTime: Date.now() - startTime,
      bytes: 0
    });
    throw error;
  }
}

// Rest of the background.js code will be appended...
// Login to AISIS with retry logic
async function login(username, password, retryCount = 0) {
  const maxRetries = 3;
  scrapingState.currentPage = 'login';
  addLog('Starting login process...', 'info', { step: 'login', attempt: retryCount + 1 });

  try {
    // Step 1: Get login page to acquire cookies
    if (retryCount > 0) {
      addLog(`Retry attempt ${retryCount}/${maxRetries}...`, 'warning', { step: 'login', attempt: retryCount + 1 });
    }
    addLog('Fetching login page...', 'info', { step: 'login', page: 'displayLogin.do' });
    addLog('Sending GET request to displayLogin.do', 'debug', { step: 'login', page: 'displayLogin.do' });
    
    const loginPageResponse = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/displayLogin.do', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      credentials: 'include'
    });
    
    addLog(`Login page response: ${loginPageResponse.status} ${loginPageResponse.statusText}`, 'debug', {
      step: 'login',
      page: 'displayLogin.do',
      status: loginPageResponse.status
    });
    
    if (!loginPageResponse.ok) {
      throw new Error(`Failed to load login page: ${loginPageResponse.status}`);
    }
    
    addLog('Parsing login page HTML...', 'debug', { step: 'login' });
    const loginPageHTML = await loginPageResponse.text();
    addLog(`Received ${loginPageHTML.length} bytes of HTML`, 'debug', { step: 'login', bytes: loginPageHTML.length });
    saveHTMLSnapshot('login_page', loginPageHTML);
    const doc = parseHTML(loginPageHTML);
    
    // Try to extract 'rnd' token if it exists
    let rndToken = '';
    const rndInput = doc.querySelector('input[name="rnd"]');
    if (rndInput) {
      rndToken = rndInput.value;
      addLog(`Extracted rnd token: ${rndToken.substring(0, 10)}...`, 'debug', { step: 'login' });
    } else {
      addLog('No rnd token found in login page', 'debug', { step: 'login' });
    }

    // Step 2: Submit login credentials
    addLog('Submitting credentials...', 'info', { step: 'login' });
    const formData = new URLSearchParams();
    formData.append('userName', username);
    formData.append('password', password);
    formData.append('command', 'login');
    formData.append('submit', 'Sign in');
    if (rndToken) {
      formData.append('rnd', rndToken);
    }
    
    addLog('Sending POST request to login.do...', 'debug', { step: 'login', page: 'login.do' });
    const loginResponse = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/login.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://aisis.ateneo.edu',
        'Referer': 'https://aisis.ateneo.edu/j_aisis/displayLogin.do',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1'
      },
      body: formData,
      credentials: 'include',
      redirect: 'follow'
    });
    
    addLog(`Login response: ${loginResponse.status} ${loginResponse.statusText}`, 'debug', {
      step: 'login',
      page: 'login.do',
      status: loginResponse.status
    });
    addLog(`Redirected to: ${loginResponse.url}`, 'debug', { step: 'login', page: 'login.do' });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    addLog('Reading login response...', 'debug', { step: 'login' });
    const responseText = await loginResponse.text();
    addLog(`Received ${responseText.length} bytes`, 'debug', { step: 'login', bytes: responseText.length });
    saveHTMLSnapshot('login_response', responseText);
    
    // Check if login was successful (look for welcome page or specific content)
    if (responseText.includes('welcome') || loginResponse.url.includes('welcome.do')) {
      addLog('Login successful!', 'success', { step: 'login' });
      await updateCookieSession();
      return true;
    } else {
      throw new Error('Login failed: Invalid credentials or unexpected response');
    }
    
  } catch (error) {
    addLog(`Login error: ${error.message}`, 'error', { step: 'login', error: error.message });
    
    // Retry logic with exponential backoff
    if (retryCount < maxRetries && (error.message.includes('timeout') || error.message.includes('network'))) {
      const backoffDelay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
      addLog(`⏳ Waiting ${backoffDelay/1000}s before retry...`, 'warning', { step: 'login', backoffDelay });
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return await login(username, password, retryCount + 1);
    }
    
    scrapingState.errors.push({ step: 'login', error: error.message });
    return false;
  }
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveCredentials') {
    saveCredentials(request.username, request.password)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'loadCredentials') {
    loadCredentials()
      .then(creds => sendResponse({ success: true, credentials: creds }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'startScraping') {
    startScraping(request.options)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getState') {
    sendResponse({ state: scrapingState });
    return true;
  }

  if (request.action === 'openScraperPopup') {
    handleOpenScraperPopup(sendResponse);
    return true;
  }

  if (request.action === 'registerPopupWindow') {
    if (typeof request.windowId === 'number') {
      popupWindowId = request.windowId;
    }
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'unregisterPopupWindow') {
    if (typeof request.windowId === 'number' && popupWindowId === request.windowId) {
      popupWindowId = null;
    }
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'stopScraping') {
    scrapingState.pauseRequested = true;
    if (!scrapingState.isPaused) {
      scrapingState.isRunning = false;
      scrapingState.isPaused = true;
      scrapingState.currentStep = 'Pause requested...';
      addLog('⏸️ Scraping paused - you can resume or export data', 'warning');
    }
    updateProgress();
    sendResponse({ success: true, paused: true });
    return true;
  }

  if (request.action === 'hardStopScraping') {
    scrapingState.isRunning = false;
    scrapingState.isPaused = false;
    scrapingState.isCompleted = true;
    scrapingState.activeDataset = null;
    scrapingState.substepProgress = 0;
    scrapingState.pauseRequested = false;
    scrapingState.checkpoints = {};
    scrapingState.pageOrder = [];
    scrapingState.currentDatasetIndex = 0;
    addLog('Scraping terminated - cannot resume', 'error');
    updateProgress();
    sendResponse({ success: true, terminated: true });
    return true;
  }

  if (request.action === 'resumeScraping') {
    if (scrapingState.isPaused) {
      scrapingState.isRunning = true;
      scrapingState.isPaused = false;
      scrapingState.pauseRequested = false;
      addLog('Resuming scraping...', 'info');
      updateProgress();
      resumeScrapingFromCheckpoint()
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          scrapingState.isRunning = false;
          scrapingState.isPaused = true;
          scrapingState.pauseRequested = false;
          scrapingState.currentStep = `Error: ${error.message}`;
          scrapingState.errors.push({ step: 'resume', error: error.message });
          updateProgress();
          sendResponse({ success: false, error: error.message });
        });
    } else {
      sendResponse({ success: false, error: 'Not in paused state' });
    }
    return true;
  }
  
  if (request.action === 'exportHAR') {
    const har = generateHAR();
    sendResponse({ success: true, har: har });
    return true;
  }
  
  if (request.action === 'exportHTMLSnapshots') {
    sendResponse({ success: true, snapshots: scrapingState.htmlSnapshots });
    return true;
  }
  
  if (request.action === 'deleteLogs') {
    // Only clear logs, keep session and data
    scrapingState.logs = [];
    scrapingState.logsTrimmed = false;
    scrapingState.lastLogAt = null;
    persistState();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'clearLogs') {
    scrapingState.logs = [];
    scrapingState.harEntries = [];
    scrapingState.htmlSnapshots = {};
    scrapingState.logsTrimmed = false;
    scrapingState.lastLogAt = null;
    persistState();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'clearAllData') {
    // Reset everything to initial state
    scrapingState = createInitialState();
    persistState();
    sendResponse({ success: true });
    return true;
  }
});

// ============================================================================
// SCRAPING ENGINE
// ============================================================================

async function runScraperForPage(pageKey, options = {}) {
  switch (pageKey) {
    case 'scheduleOfClasses':
      return await scrapeScheduleOfClasses(options);
    case 'officialCurriculum':
      return await scrapeOfficialCurriculum(options);
    case 'grades':
      await scrapeGrades();
      return 'completed';
    case 'advisoryGrades':
      await scrapeAdvisoryGrades();
      return 'completed';
    case 'enrolledClasses':
      await scrapeEnrolledClasses();
      return 'completed';
    case 'classSchedule':
      await scrapeClassSchedule();
      return 'completed';
    case 'tuitionReceipt':
      await scrapeTuitionReceipt();
      return 'completed';
    case 'studentInfo':
      await scrapeStudentInfo();
      return 'completed';
    case 'programOfStudy':
      await scrapeProgramOfStudy();
      return 'completed';
    case 'holdOrders':
      await scrapeHoldOrders();
      return 'completed';
    case 'facultyAttendance':
      await scrapeFacultyAttendance();
      return 'completed';
    default:
      return 'completed';
  }
}

async function runScrapingPipeline(startIndex = 0, { resume = false } = {}) {
  const order = Array.isArray(scrapingState.pageOrder) ? scrapingState.pageOrder : [];
  if (!order.length) {
    return 'completed';
  }

  if (startIndex >= order.length) {
    return 'completed';
  }

  const initialIndex = Math.max(0, startIndex);

  for (let index = initialIndex; index < order.length; index++) {
    if (isPauseActive()) {
      scrapingState.isRunning = false;
      scrapingState.isPaused = true;
      scrapingState.currentDatasetIndex = index;
      return 'paused';
    }

    const pageKey = order[index];
    scrapingState.currentDatasetIndex = index;
    const result = await runScraperForPage(pageKey, { resume: resume && index === initialIndex });

    if (result === 'paused') {
      scrapingState.currentDatasetIndex = index;
      return 'paused';
    }

    scrapingState.currentDatasetIndex = index + 1;

    if (isPauseActive()) {
      scrapingState.isRunning = false;
      scrapingState.isPaused = true;
      return 'paused';
    }
  }

  return 'completed';
}

// Main scraping orchestrator
async function startScraping(options) {
  if (scrapingState.isRunning) {
    addLog('Scraping already in progress', 'warning');
    return;
  }

  // Generate or keep existing session ID
  const sessionId = scrapingState.sessionId || generateSessionId();

  const preservedScrapedData = scrapingState.scrapedData || {};
  const preservedDatasetProgress = scrapingState.datasetProgress || {};
  const preservedHtmlSnapshots = scrapingState.htmlSnapshots || {};
  const preservedHtmlSnapshotOrder = Array.isArray(scrapingState.htmlSnapshotOrder)
    ? scrapingState.htmlSnapshotOrder
    : [];
  const preservedHarEntries = Array.isArray(scrapingState.harEntries) ? scrapingState.harEntries : [];
  const preservedMetrics = scrapingState.metrics || { ...DEFAULT_METRICS };
  const preservedCookieSession = scrapingState.cookieSession || null;

  const rawPages = (options && options.pages) || {};
  const pages = normalizePageSelection(rawPages);
  const selectedPageKeys = Object.keys(pages).filter(key => pages[key]);
  const totalSteps = Math.max(1, selectedPageKeys.length + 1);

  // Reset state
  scrapingState = createInitialState({
    isRunning: true,
    isPaused: false,
    pauseRequested: false,
    sessionId: sessionId,
    progress: 0,
    currentStep: 'Initializing...',
    currentPage: 'initializing',
    totalSteps: totalSteps,
    completedSteps: 0,
    activeDataset: null,
    substepProgress: 0,
    startTime: Date.now(),
    startedAt: new Date().toISOString(),
    scrapedData: preservedScrapedData,
    datasetProgress: preservedDatasetProgress,
    errors: [],
    harEntries: preservedHarEntries,
    htmlSnapshots: preservedHtmlSnapshots,
    htmlSnapshotOrder: preservedHtmlSnapshotOrder,
    selectedPages: pages,
    pageOrder: selectedPageKeys,
    checkpoints: {},
    currentDatasetIndex: 0,
    metrics: preservedMetrics,
    cookieSession: preservedCookieSession
  });

  updateProgress();

  addLog('=== AISIS Scraping Started ===', 'info', { sessionId, step: 'bootstrap' });
  addLog(
    `Selected pages: ${Object.keys(rawPages).filter(k => rawPages[k]).join(', ')}`,
    'info',
    { step: 'bootstrap', pages: rawPages }
  );

  try {
    // Step 1: Login
    scrapingState.currentStep = 'Logging in...';
    const credentials = await loadCredentials();
    
    if (!credentials) {
      throw new Error('No credentials found. Please save your credentials first.');
    }
    
    const loginSuccess = await login(credentials.username, credentials.password);
    if (!loginSuccess) {
      throw new Error('Login failed. Please check your credentials.');
    }
    
    scrapingState.substepProgress = 0;
    scrapingState.completedSteps++;
    updateProgress();

    scrapingState.pauseRequested = false;
    const pipelineResult = await runScrapingPipeline(0, { resume: false });

    if (pipelineResult === 'paused') {
      scrapingState.isRunning = false;
      scrapingState.isPaused = true;
      scrapingState.currentStep = scrapingState.currentStep || 'Scraping paused';
      updateProgress();
      return;
    }

    await finalizeScrapingSuccess(sessionId);

  } catch (error) {
    scrapingState.isRunning = false;
    scrapingState.currentStep = `Error: ${error.message}`;
    scrapingState.completedAt = new Date().toISOString();
    addLog(`Fatal error: ${error.message}`, 'error', { step: 'main', sessionId, error: error.message });
    scrapingState.errors.push({ step: 'main', error: error.message });

    chrome.runtime.sendMessage({
      action: 'scrapingError', 
      state: scrapingState 
    }).catch(() => {});
  }
}

async function finalizeScrapingSuccess(sessionId) {
  const resolvedSessionId = sessionId || scrapingState.sessionId;
  scrapingState.isRunning = false;
  scrapingState.isCompleted = true;
  scrapingState.isPaused = false;
  scrapingState.pauseRequested = false;
  scrapingState.progress = 100;
  scrapingState.activeDataset = null;
  scrapingState.substepProgress = 0;
  scrapingState.currentStep = 'Scraping complete!';
  scrapingState.completedAt = new Date().toISOString();
  addLog('=== Scraping Completed Successfully ===', 'success', { sessionId: resolvedSessionId, step: 'complete' });

  persistState();

  chrome.runtime.sendMessage({
    action: 'scrapingComplete',
    state: scrapingState
  }).catch(() => {});
}

async function resumeScrapingFromCheckpoint() {
  const order = Array.isArray(scrapingState.pageOrder) ? scrapingState.pageOrder : [];
  if (!order.length) {
    addLog('No scraping plan available to resume', 'warning', { step: 'resume' });
    scrapingState.isRunning = false;
    scrapingState.isPaused = true;
    scrapingState.pauseRequested = false;
    updateProgress();
    return 'paused';
  }

  let startIndex = Number.isFinite(scrapingState.currentDatasetIndex)
    ? Math.max(0, scrapingState.currentDatasetIndex)
    : 0;

  if (startIndex >= order.length) {
    await finalizeScrapingSuccess(scrapingState.sessionId);
    return 'completed';
  }

  const result = await runScrapingPipeline(startIndex, { resume: true });

  if (result === 'completed') {
    await finalizeScrapingSuccess(scrapingState.sessionId);
  } else if (result === 'paused') {
    scrapingState.isRunning = false;
    scrapingState.isPaused = true;
    scrapingState.pauseRequested = false;
    scrapingState.currentStep = scrapingState.currentStep || 'Scraping paused';
    updateProgress();
  }

  return result;
}

// Update progress percentage
function updateProgress() {
  const totalSteps = scrapingState.totalSteps || 0;
  if (totalSteps > 0) {
    const clampedSubstep = Math.min(Math.max(scrapingState.substepProgress || 0, 0), 0.999);
    const effectiveCompleted = Math.min(
      scrapingState.completedSteps + clampedSubstep,
      totalSteps
    );
    let computed = Math.round((effectiveCompleted / totalSteps) * 100);
    if (scrapingState.isCompleted || scrapingState.completedSteps >= totalSteps) {
      computed = 100;
    }
    scrapingState.progress = Math.min(Math.max(computed, 0), 100);
  } else {
    scrapingState.progress = 0;
  }

  // Send update to popup
  chrome.runtime.sendMessage({
    action: 'updateProgress',
    state: scrapingState
  }).catch(() => {});
  
  // Persist state
  persistState();
}

// Scrape Schedule of Classes
async function scrapeScheduleOfClasses({ resume = false } = {}) {
  const datasetKey = 'scheduleOfClasses';
  const datasetLabel = formatDatasetLabel(datasetKey);
  scrapingState.currentPage = datasetKey;
  scrapingState.activeDataset = datasetKey;
  scrapingState.currentStep = 'Scraping Schedule of Classes...';
  addLog('Starting Schedule of Classes scrape', 'info', { step: datasetKey });
  
  try {
    // Step 1: Load the page to get available departments
    const pageResponse = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/J_VCSC.do', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://aisis.ateneo.edu/j_aisis/welcome.do',
        'Connection': 'keep-alive'
      },
      credentials: 'include'
    });
    
    if (!pageResponse.ok) {
      throw new Error(`Failed to load J_VCSC.do: ${pageResponse.status}`);
    }
    
    const pageHTML = await pageResponse.text();
    const doc = parseHTML(pageHTML);
    
    // Extract department codes from dropdown
    const deptSelect = doc.querySelector('select[name="deptCode"]');
    const departments = [];
    
    if (deptSelect) {
      const options = deptSelect.querySelectorAll('option');
      options.forEach(opt => {
        const value = opt.value;
        if (value && value !== 'ALL' && value !== '') {
          departments.push(value);
        }
      });
      addLog(`Found ${departments.length} departments`, 'info', { step: datasetKey });
    } else {
      addLog('Could not find department dropdown', 'warning', { step: datasetKey });
    }
    
    // Extract applicable period (semester)
    let applicablePeriod = '2025-1'; // Default
    const periodSelect = doc.querySelector('select[name="applicablePeriod"]');
    if (periodSelect) {
      const selectedOption = periodSelect.querySelector('option[selected]');
      if (selectedOption) {
        applicablePeriod = selectedOption.value;
      }
    }
    
    addLog(`Using period: ${applicablePeriod}`, 'info', { step: datasetKey, period: applicablePeriod });
    

    // Step 2: Scrape each department
    const checkpoint = getCheckpoint(datasetKey);
    const isResuming = resume && checkpoint && Number.isFinite(checkpoint.departmentIndex);
    const startIndex = isResuming
      ? Math.min(Math.max(checkpoint.departmentIndex, 0), departments.length)
      : 0;

    if (!Array.isArray(scrapingState.scrapedData.scheduleOfClasses)) {
      scrapingState.scrapedData.scheduleOfClasses = [];
    }

    if (!isResuming) {
      scrapingState.scrapedData.scheduleOfClasses = [];
      clearCheckpoint(datasetKey);
    }

    const totalDepartments = Math.max(departments.length, 1);
    const initialCompleted = Math.min(startIndex, departments.length);
    scrapingState.substepProgress = totalDepartments
      ? Math.min(initialCompleted / totalDepartments, 0.999)
      : 0;

    updateDatasetProgress(datasetKey, {
      label: datasetLabel,
      completed: initialCompleted,
      total: departments.length,
      items: scrapingState.scrapedData.scheduleOfClasses.length,
      detail:
        initialCompleted >= departments.length
          ? 'Up to date'
          : (departments[initialCompleted] ? `Next: ${departments[initialCompleted]}` : null)
    });
    updateProgress();

    for (let i = startIndex; i < departments.length; i++) {
      if (isPauseActive()) {
        const pendingDept = departments[i];
        setCheckpoint(datasetKey, { departmentIndex: i });
        updateDatasetProgress(datasetKey, {
          label: datasetLabel,
          completed: i,
          total: departments.length,
          items: scrapingState.scrapedData.scheduleOfClasses.length,
          detail: pendingDept ? `${pendingDept} (paused)` : 'Paused'
        });
        scrapingState.currentStep = pendingDept
          ? `Paused before ${pendingDept}`
          : 'Scraping paused';
        updateProgress();
        return 'paused';
      }

      const dept = departments[i];
      scrapingState.currentStep = `Scraping ${dept} schedule (${i + 1}/${departments.length})...`;
      addLog(`Fetching schedule for department: ${dept}`, 'info', {
        step: datasetKey,
        department: dept,
        index: i + 1,
        total: departments.length
      });

      scrapingState.scrapedData.scheduleOfClasses = scrapingState.scrapedData.scheduleOfClasses.filter(
        (entry) => entry && entry.department !== dept
      );

      let detailLabel = dept;

      try {
        const formData = new URLSearchParams();
        formData.append('applicablePeriod', applicablePeriod);
        formData.append('command', 'displayResults');
        formData.append('deptCode', dept);
        formData.append('subjCode', 'ALL');

        const response = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/J_VCSC.do', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://aisis.ateneo.edu',
            'Referer': 'https://aisis.ateneo.edu/j_aisis/J_VCSC.do',
            'Connection': 'keep-alive'
          },
          body: formData,
          credentials: 'include'
        });

        if (response.ok) {
          const html = await response.text();
          saveHTMLSnapshot(`schedule_${dept}`, html);

          const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
          let tableMatch;
          let dataTable = null;

          while ((tableMatch = tableRegex.exec(html)) !== null) {
            const tableHTML = tableMatch[0];
            if (/Subject Code/i.test(tableHTML)) {
              dataTable = tableHTML;
              break;
            }
          }

          if (dataTable) {
            const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
            let rowMatch;
            let classCount = 0;
            let isFirstRow = true;

            while ((rowMatch = rowRegex.exec(dataTable)) !== null) {
              if (isFirstRow) {
                isFirstRow = false;
                continue;
              }

              const rowHTML = rowMatch[1];
              const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
              const cells = [];
              let cellMatch;

              while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
                const cellContent = cellMatch[1].replace(/<[^>]*>/g, '').trim();
                cells.push(cellContent);
              }

              if (cells.length >= 7) {
                const classData = {
                  department: dept,
                  subjectCode: cells[0] || '',
                  section: cells[1] || '',
                  courseTitle: cells[2] || '',
                  units: cells[3] || '',
                  time: cells[4] || '',
                  room: cells[5] || '',
                  instructor: cells[6] || '',
                  maxNo: cells[7] || '',
                  lang: cells[8] || '',
                  level: cells[9] || '',
                  freeSlots: cells[10] || '',
                  remarks: cells[11] || '',
                  s: cells[12] || '',
                  p: cells[13] || ''
                };
                scrapingState.scrapedData.scheduleOfClasses.push(classData);
                classCount++;
              }
            }

            addLog(`Scraped ${classCount} classes from ${dept}`, 'success', {
              step: datasetKey,
              department: dept,
              items: classCount
            });
            if (classCount === 0) {
              detailLabel = `${dept} (no data)`;
            }
          } else {
            addLog(`No schedule table found for ${dept}`, 'warning', { step: datasetKey, department: dept });
            detailLabel = `${dept} (no data)`;
          }
        } else {
          addLog(`Failed to fetch ${dept}: ${response.status}`, 'error', {
            step: datasetKey,
            department: dept,
            status: response.status
          });
          detailLabel = `${dept} (failed)`;
        }
      } catch (deptError) {
        detailLabel = `${dept} (error)`;
        addLog(`Error processing ${dept}: ${deptError.message}`, 'error', {
          step: datasetKey,
          department: dept,
          error: deptError.message
        });
        scrapingState.errors.push({ step: `schedule_${dept}`, error: deptError.message });
      }

      const completedCount = i + 1;
      setCheckpoint(datasetKey, { departmentIndex: completedCount });
      updateDatasetProgress(datasetKey, {
        label: datasetLabel,
        completed: completedCount,
        total: departments.length,
        items: scrapingState.scrapedData.scheduleOfClasses.length,
        detail: detailLabel
      });
      scrapingState.substepProgress = Math.min(completedCount / totalDepartments, 0.999);

      updateProgress();

      if (completedCount < departments.length && !isPauseActive()) {
        // Rate limiting: wait 2-4 seconds between requests to avoid throttling
        await delay(2000 + Math.random() * 2000);
      }
    }

    clearCheckpoint(datasetKey);

    addLog(`Total classes scraped: ${scrapingState.scrapedData.scheduleOfClasses.length}`, 'success', {
      step: datasetKey,
      total: scrapingState.scrapedData.scheduleOfClasses.length
    });
    scrapingState.activeDataset = null;
    scrapingState.substepProgress = 0;
    scrapingState.completedSteps++;
    updateDatasetProgress(datasetKey, {
      label: datasetLabel,
      completed: departments.length,
      total: departments.length,
      items: scrapingState.scrapedData.scheduleOfClasses.length,
      detail: 'Completed'
    });
    updateProgress();
  } catch (error) {
    addLog(`Error scraping schedule: ${error.message}`, 'error', { step: datasetKey, error: error.message });
    scrapingState.errors.push({ step: datasetKey, error: error.message });
    scrapingState.activeDataset = null;
    scrapingState.substepProgress = 0;
    updateProgress();
  }
}

// Scrape Official Curriculum
async function scrapeOfficialCurriculum({ resume = false } = {}) {
  const datasetKey = 'officialCurriculum';
  const datasetLabel = formatDatasetLabel(datasetKey);
  scrapingState.currentPage = datasetKey;
  scrapingState.activeDataset = datasetKey;
  scrapingState.currentStep = 'Scraping Official Curriculum...';
  addLog('Starting Official Curriculum scrape', 'info', { step: datasetKey });
  
  try {
    // Step 1: Load the page to get available degree codes
    const pageResponse = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/J_VOFC.do', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://aisis.ateneo.edu/j_aisis/welcome.do',
        'Connection': 'keep-alive'
      },
      credentials: 'include'
    });
    
    if (!pageResponse.ok) {
      throw new Error(`Failed to load J_VOFC.do: ${pageResponse.status}`);
    }
    
    const pageHTML = await pageResponse.text();
    const doc = parseHTML(pageHTML);
    
    // Extract degree codes from dropdown
    const degSelect = doc.querySelector('select[name="degCode"]');
    const degreeCodes = [];
    
    if (degSelect) {
      const options = degSelect.querySelectorAll('option');
      options.forEach(opt => {
        const value = opt.value;
        if (value && value !== '') {
          degreeCodes.push({ code: value, name: opt.textContent.trim() });
        }
      });
      addLog(`Found ${degreeCodes.length} degree programs`, 'info', { step: datasetKey });
    } else {
      addLog('Could not find degree code dropdown', 'warning', { step: datasetKey });
    }

    // Step 2: Scrape each degree program
    const checkpoint = getCheckpoint(datasetKey);
    const isResuming = resume && checkpoint && Number.isFinite(checkpoint.programIndex);
    const startIndex = isResuming
      ? Math.min(Math.max(checkpoint.programIndex, 0), degreeCodes.length)
      : 0;

    if (!Array.isArray(scrapingState.scrapedData.officialCurriculum)) {
      scrapingState.scrapedData.officialCurriculum = [];
    }

    if (!isResuming) {
      scrapingState.scrapedData.officialCurriculum = [];
      clearCheckpoint(datasetKey);
    }

    scrapingState.substepProgress = 0;
    const totalPrograms = Math.max(degreeCodes.length, 1);
    const initialCompleted = Math.min(startIndex, degreeCodes.length);
    scrapingState.substepProgress = totalPrograms
      ? Math.min(initialCompleted / totalPrograms, 0.999)
      : 0;

    updateDatasetProgress(datasetKey, {
      label: datasetLabel,
      completed: initialCompleted,
      total: degreeCodes.length,
      items: scrapingState.scrapedData.officialCurriculum.length,
      detail:
        initialCompleted >= degreeCodes.length
          ? 'Up to date'
          : (degreeCodes[initialCompleted] ? `Next: ${degreeCodes[initialCompleted].name}` : null)
    });
    updateProgress();

    for (let i = startIndex; i < degreeCodes.length; i++) {
      if (isPauseActive()) {
        const pendingProgram = degreeCodes[i];
        setCheckpoint(datasetKey, { programIndex: i });
        updateDatasetProgress(datasetKey, {
          label: datasetLabel,
          completed: i,
          total: degreeCodes.length,
          items: scrapingState.scrapedData.officialCurriculum.length,
          detail: pendingProgram ? `${pendingProgram.name} (paused)` : 'Paused'
        });
        scrapingState.currentStep = pendingProgram
          ? `Paused before ${pendingProgram.name}`
          : 'Scraping paused';
        updateProgress();
        return 'paused';
      }

      const degree = degreeCodes[i];
      scrapingState.currentStep = `Scraping ${degree.name} (${i + 1}/${degreeCodes.length})...`;
      addLog(`Fetching curriculum for: ${degree.name}`, 'info', {
        step: datasetKey,
        degree: degree.code,
        name: degree.name,
        index: i + 1,
        total: degreeCodes.length
      });

      scrapingState.scrapedData.officialCurriculum = scrapingState.scrapedData.officialCurriculum.filter(
        (entry) => entry && entry.degreeCode !== degree.code
      );

      const formData = new URLSearchParams();
      formData.append('degCode', degree.code);

      const response = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/J_VOFC.do', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://aisis.ateneo.edu',
          'Referer': 'https://aisis.ateneo.edu/j_aisis/J_VOFC.do',
          'Connection': 'keep-alive'
        },
        body: formData,
        credentials: 'include'
      });

      let detailLabel = degree.name;

      try {
        if (response.ok) {
          const html = await response.text();
          if (scrapingState.debugMode || i < 5) {
            saveHTMLSnapshot(`curriculum_${degree.code}`, html);
          }

          const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
          let tableMatch;
          let courseCount = 0;

          while ((tableMatch = tableRegex.exec(html)) !== null) {
            const tableHTML = tableMatch[0];

            if (/Course Title/i.test(tableHTML)) {
              const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
              let rowMatch;
              let isHeaderRow = true;
              let columnHeaderRow = true;

              while ((rowMatch = rowRegex.exec(tableHTML)) !== null) {
                if (isHeaderRow) {
                  isHeaderRow = false;
                  continue;
                }

                if (columnHeaderRow) {
                  columnHeaderRow = false;
                  continue;
                }

                const rowHTML = rowMatch[1];
                const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
                const cells = [];
                let cellMatch;

                while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
                  const cellContent = cellMatch[1].replace(/<[^>]*>/g, '').trim();
                  cells.push(cellContent);
                }

                if (cells.length >= 2) {
                  const courseData = {
                    degreeProgram: degree.name,
                    degreeCode: degree.code,
                    catNo: cells[0] || '',
                    courseTitle: cells[1] || '',
                    units: cells[2] || '',
                    prerequisites: cells[3] || '',
                    category: cells[4] || ''
                  };
                  scrapingState.scrapedData.officialCurriculum.push(courseData);
                  courseCount++;
                }
              }
            }
          }

          if (courseCount > 0) {
            addLog(`Scraped ${courseCount} courses from ${degree.name}`, 'success', {
              step: datasetKey,
              degree: degree.code,
              name: degree.name,
              items: courseCount
            });
          } else {
            addLog(`No curriculum table found for ${degree.name}`, 'warning', {
              step: datasetKey,
              degree: degree.code,
              name: degree.name
            });
            detailLabel = `${degree.name} (no data)`;
          }
        } else {
          addLog(`Failed to fetch ${degree.name}: ${response.status}`, 'error', {
            step: datasetKey,
            degree: degree.code,
            name: degree.name,
            status: response.status
          });
          detailLabel = `${degree.name} (failed)`;
        }
      } catch (degError) {
        detailLabel = `${degree.name} (error)`;
        addLog(`Error processing ${degree.name}: ${degError.message}`, 'error', {
          step: datasetKey,
          degree: degree.code,
          name: degree.name,
          error: degError.message
        });
        scrapingState.errors.push({ step: `curriculum_${degree.code}`, error: degError.message });
      }

      const completedCount = i + 1;
      setCheckpoint(datasetKey, { programIndex: completedCount });
      updateDatasetProgress(datasetKey, {
        label: datasetLabel,
        completed: completedCount,
        total: degreeCodes.length,
        items: scrapingState.scrapedData.officialCurriculum.length,
        detail: detailLabel
      });
      scrapingState.substepProgress = Math.min(completedCount / totalPrograms, 0.999);

      updateProgress();

      if (completedCount < degreeCodes.length && !isPauseActive()) {
        await delay(2000 + Math.random() * 2000);
      }
    }

    clearCheckpoint(datasetKey);

    addLog(`Total courses scraped: ${scrapingState.scrapedData.officialCurriculum.length}`, 'success', {
      step: datasetKey,
      total: scrapingState.scrapedData.officialCurriculum.length
    });
    scrapingState.activeDataset = null;
    scrapingState.substepProgress = 0;
    scrapingState.completedSteps++;
    updateDatasetProgress(datasetKey, {
      label: datasetLabel,
      completed: degreeCodes.length,
      total: degreeCodes.length,
      items: scrapingState.scrapedData.officialCurriculum.length,
      detail: 'Completed'
    });
    updateProgress();
  } catch (error) {
    addLog(`Error scraping curriculum: ${error.message}`, 'error', { step: datasetKey, error: error.message });
    scrapingState.errors.push({ step: datasetKey, error: error.message });
    scrapingState.activeDataset = null;
    scrapingState.substepProgress = 0;
    updateProgress();
  }
}

// Simple GET page scrapers
async function scrapeSimplePage(url, pageName, dataKey) {
  scrapingState.currentPage = dataKey;
  scrapingState.currentStep = `Scraping ${pageName}...`;
  addLog(`Starting ${pageName} scrape`, 'info', { step: dataKey, pageName, url });

  scrapingState.activeDataset = dataKey;
  scrapingState.substepProgress = 0;
  updateDatasetProgress(dataKey, {
    label: pageName,
    completed: 0,
    total: 1,
    items: 0
  });
  updateProgress();
  
  try {
    const response = await fetchWithHAR(url, { 
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://aisis.ateneo.edu/j_aisis/welcome.do',
        'Connection': 'keep-alive'
      },
      credentials: 'include' 
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load ${pageName}: ${response.status}`);
    }
    
    const html = await response.text();
    if (scrapingState.debugMode) {
      saveHTMLSnapshot(dataKey, html);
    }

    const tables = extractTablesFromHTML(html);
    const sanitizedTables = sanitizeTablesForDataset(dataKey, tables);
    const sanitizedText = sanitizePageText(dataKey, stripHtml(html));
    const truncatedHtml = html.length > MAX_HTML_SNAPSHOT_SIZE
      ? `${html.slice(0, MAX_HTML_SNAPSHOT_SIZE)}\n<!-- truncated -->`
      : html;

    const capturedAt = new Date().toISOString();
    const datasetPayload = {
      html: truncatedHtml,
      text: sanitizedText,
      tables: sanitizedTables,
      capturedAt
    };

    let detail = 'No rows detected';
    let items = sanitizedTables.reduce((sum, table) => sum + (table.totalRows || 0), 0);

    if (dataKey === 'classSchedule') {
      const weeklySchedule = buildWeeklySchedule(sanitizedTables);
      if (weeklySchedule) {
        weeklySchedule.generatedAt = capturedAt;
        datasetPayload.weeklySchedule = weeklySchedule;
        items = weeklySchedule.eventCount || items;
        if (weeklySchedule.eventCount) {
          detail = `${weeklySchedule.eventCount} scheduled block${weeklySchedule.eventCount === 1 ? '' : 's'}`;
        }
      }
    }

    if (!datasetPayload.weeklySchedule) {
      detail = items > 0 ? `${items} row${items === 1 ? '' : 's'}` : 'No rows detected';
    }

    scrapingState.scrapedData[dataKey] = datasetPayload;

    updateDatasetProgress(dataKey, {
      label: pageName,
      completed: 1,
      total: 1,
      items,
      detail
    });
    addLog(`${pageName} scraped successfully`, 'success', { step: dataKey, pageName });
    scrapingState.activeDataset = null;
    scrapingState.substepProgress = 0;
    scrapingState.completedSteps++;
    updateProgress();

    await delay(1000);

  } catch (error) {
    addLog(`Error scraping ${pageName}: ${error.message}`, 'error', { step: dataKey, pageName, error: error.message });
    scrapingState.errors.push({ step: dataKey, error: error.message });
    scrapingState.activeDataset = null;
    scrapingState.substepProgress = 0;
    updateDatasetProgress(dataKey, {
      label: pageName,
      completed: 0,
      total: 1,
      items: 0,
      detail: `Error: ${error.message}`
    });
    updateProgress();
  }
}

// Individual page scrapers
async function scrapeGrades() {
  const dataKey = 'grades';
  scrapingState.currentPage = dataKey;
  addLog('Fetching grades page...', 'info', { step: dataKey });

  scrapingState.activeDataset = dataKey;
  scrapingState.substepProgress = 0;
  updateDatasetProgress(dataKey, {
    label: formatDatasetLabel(dataKey),
    completed: 0,
    total: 1,
    items: 0
  });
  updateProgress();

  try {
    const response = await fetchWithHAR('https://aisis.ateneo.edu/j_aisis/J_VG.do');
    const html = await response.text();
    
    // Parse grades from HTML table
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('table tr');
    
    const grades = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td.text02');
      if (cells.length >= 6) {
        grades.push({
          schoolYear: cells[0]?.textContent.trim() || '',
          semester: cells[1]?.textContent.trim() || '',
          program: cells[2]?.textContent.trim() || '',
          courseCode: cells[3]?.textContent.trim() || '',
          courseTitle: cells[4]?.textContent.trim() || '',
          units: cells[5]?.textContent.trim() || '',
          grade: cells[6]?.textContent.trim() || ''
        });
      }
    });

    scrapingState.scrapedData[dataKey] = grades;
    updateDatasetProgress(dataKey, {
      label: formatDatasetLabel(dataKey),
      completed: 1,
      total: 1,
      items: grades.length,
      detail: grades.length > 0 ? `${grades.length} entries` : 'No entries detected'
    });
    addLog(`Scraped ${grades.length} grade entries`, 'success', { step: dataKey, total: grades.length });
    scrapingState.activeDataset = null;
    scrapingState.substepProgress = 0;
    scrapingState.completedSteps++;
    updateProgress();
  } catch (error) {
    addLog(`Error scraping grades: ${error.message}`, 'error', { step: dataKey, error: error.message });
    scrapingState.errors.push({ step: dataKey, error: error.message });
    scrapingState.activeDataset = null;
    scrapingState.substepProgress = 0;
    updateDatasetProgress(dataKey, {
      label: formatDatasetLabel(dataKey),
      completed: 0,
      total: 1,
      items: 0,
      detail: `Error: ${error.message}`
    });
    updateProgress();
  }
}

async function scrapeAdvisoryGrades() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_VADGR.do', 'Advisory Grades', 'advisoryGrades');
}

async function scrapeEnrolledClasses() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_VCEC.do', 'Enrolled Classes', 'enrolledClasses');
}

async function scrapeClassSchedule() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_VMCS.do', 'Class Schedule', 'classSchedule');
}

async function scrapeTuitionReceipt() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_PTR.do', 'Tuition Receipt', 'tuitionReceipt');
}

async function scrapeStudentInfo() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_STUD_INFO.do', 'Student Info', 'studentInfo');
}

async function scrapeProgramOfStudy() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_VIPS.do', 'Program of Study', 'programOfStudy');
}

async function scrapeHoldOrders() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_VHOR.do', 'Hold Orders', 'holdOrders');
}

async function scrapeFacultyAttendance() {
  await scrapeSimplePage('https://aisis.ateneo.edu/j_aisis/J_IFAT.do', 'Faculty Attendance', 'facultyAttendance');
}
