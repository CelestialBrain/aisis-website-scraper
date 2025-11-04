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
        
        if (!state.scrapedData) {
            console.log('No scraped data available');
            return;
        }
        
        const data = state.scrapedData;
        
        // Load overview stats
        loadOverviewStats(data);
        
        // Load grades
        if (data.grades) {
            loadGrades(data.grades);
        }
        
        // Load schedule
        if (data.schedule) {
            loadSchedule(data.schedule);
        }
        
        // Load student info
        if (data.studentInfo) {
            loadStudentInfo(data.studentInfo);
        }
        
        // Load program of study
        if (data.programOfStudy) {
            loadProgramOfStudy(data.programOfStudy);
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Load overview statistics
function loadOverviewStats(data) {
    // Calculate current QPI (from grades data)
    if (data.grades && data.grades.length > 0) {
        const currentYear = '2025-2026';
        const currentSem = '1';
        const currentCourses = data.grades.filter(g => 
            g.schoolYear === currentYear && g.semester === currentSem
        );
        
        document.getElementById('current-courses').textContent = currentCourses.length;
        document.getElementById('units-completed').textContent = 
            currentCourses.reduce((sum, c) => sum + (parseInt(c.units) || 0), 0);
        
        // Load current courses table
        const tbody = document.getElementById('current-courses-body');
        tbody.innerHTML = '';
        
        currentCourses.forEach(course => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${course.courseCode || '--'}</td>
                <td>${course.courseTitle || '--'}</td>
                <td>${course.units || '--'}</td>
                <td><span class="badge badge-warning">Ongoing</span></td>
            `;
            tbody.appendChild(row);
        });
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
        const gradeBadge = gradeValue === '--' ? 
            '<span class="badge badge-warning">Ongoing</span>' : 
            gradeValue;
        
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
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.courseCode || '--'}</td>
            <td>${item.section || '--'}</td>
            <td>${item.schedule || '--'}</td>
            <td>${item.room || '--'}</td>
            <td>${item.instructor || '--'}</td>
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
