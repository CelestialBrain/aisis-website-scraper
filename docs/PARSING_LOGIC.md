# AISIS Parsing Logic - Complete Regex Patterns & Extraction Methods

This document contains **all the parsing logic and regex patterns** used to extract structured data from AISIS HTML pages after scraping.

---

## Table of Contents

1. [HTML Parser Implementation](#html-parser-implementation)
2. [Schedule of Classes Parsing](#schedule-of-classes-parsing)
3. [Official Curriculum Parsing](#official-curriculum-parsing)
4. [Grades Parsing](#grades-parsing)
5. [Simple Page Parsing](#simple-page-parsing)
6. [Complete Regex Reference](#complete-regex-reference)

---

## HTML Parser Implementation

### Core parseHTML Function

Since the extension runs in a Chrome service worker (where `DOMParser` is not available), all parsing is done using **regex patterns**.

```javascript
function parseHTML(htmlString) {
  return {
    // Query selector for input fields
    querySelector: (selector) => {
      // Handle input[name="..."] selector
      const inputMatch = selector.match(/input\[name="([^"]+)"\]/);
      if (inputMatch) {
        const name = inputMatch[1];
        
        // Pattern 1: <input name="..." value="...">
        const pattern1 = new RegExp(
          `<input[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["']`,
          'i'
        );
        
        // Pattern 2: <input value="..." name="...">
        const pattern2 = new RegExp(
          `<input[^>]*value=["']([^"']*)["'][^>]*name=["']${name}["']`,
          'i'
        );
        
        for (const regex of [pattern1, pattern2]) {
          const match = htmlString.match(regex);
          if (match) return { value: match[1] };
        }
        
        return null;
      }
      
      // Handle select[name="..."] selector
      const selectMatch = selector.match(/select\[name="([^"]+)"\]/);
      if (selectMatch) {
        const name = selectMatch[1];
        
        // Pattern 1: <select name="...">...</select>
        const pattern1 = new RegExp(
          `<select[^>]*name=["']${name}["'][^>]*>([\\s\\S]*?)<\\/select>`,
          'i'
        );
        
        // Pattern 2: <select name=...>...</select> (no quotes)
        const pattern2 = new RegExp(
          `<select[^>]*name=${name}[^>]*>([\\s\\S]*?)<\\/select>`,
          'i'
        );
        
        for (const regex of [pattern1, pattern2]) {
          const match = htmlString.match(regex);
          if (match) {
            const selectContent = match[1];
            
            return {
              // Get all options
              querySelectorAll: (optionSelector) => {
                const options = [];
                
                // Option Pattern 1: <option value="...">text</option>
                const optionPattern1 = /<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)<\/option>/gi;
                
                // Option Pattern 2: <option value=...>text</option> (no quotes)
                const optionPattern2 = /<option[^>]*value=([^\s>]+)[^>]*>([^<]*)<\/option>/gi;
                
                // Option Pattern 3: <option>text</option> (no value)
                const optionPattern3 = /<option[^>]*>([^<]*)<\/option>/gi;
                
                for (const optionRegex of [optionPattern1, optionPattern2, optionPattern3]) {
                  let optionMatch;
                  const tempRegex = new RegExp(optionRegex.source, optionRegex.flags);
                  
                  while ((optionMatch = tempRegex.exec(selectContent)) !== null) {
                    const value = optionMatch[1] || optionMatch[2] || '';
                    const text = optionMatch[2] || optionMatch[1] || '';
                    
                    if (value && text) {
                      options.push({ 
                        value: value.trim(), 
                        textContent: text.trim() 
                      });
                    }
                  }
                  
                  if (options.length > 0) break;
                }
                
                return options;
              },
              
              // Get selected option
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
        const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/i;
        const tableMatch = htmlString.match(tableRegex);
        
        if (tableMatch) {
          return {
            querySelectorAll: (rowSelector) => {
              if (rowSelector === 'tr') {
                const rows = [];
                const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
                let rowMatch;
                
                while ((rowMatch = rowRegex.exec(tableMatch[1])) !== null) {
                  rows.push({
                    querySelectorAll: (cellSelector) => {
                      const cells = [];
                      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
                      let cellMatch;
                      
                      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
                        // Remove HTML tags and clean text
                        const cleanText = cellMatch[1]
                          .replace(/<[^>]*>/g, '')
                          .trim();
                        
                        cells.push({ textContent: cleanText });
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
    
    getRawHTML: () => htmlString
  };
}
```

### Key Regex Patterns

#### 1. Input Field Extraction
```javascript
// Pattern: <input name="rnd" value="abc123">
/<input[^>]*name=["']rnd["'][^>]*value=["']([^"']*)["']/i

// Pattern: <input value="abc123" name="rnd">
/<input[^>]*value=["']([^"']*)["'][^>]*name=["']rnd["']/i
```

#### 2. Select Dropdown Extraction
```javascript
// Pattern: <select name="deptCode">...</select>
/<select[^>]*name=["']deptCode["'][^>]*>([\s\S]*?)<\/select>/i

// Option Pattern: <option value="CS">Computer Science</option>
/<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)<\/option>/gi
```

#### 3. Table Extraction
```javascript
// Pattern: <table>...</table>
/<table[^>]*>([\s\S]*?)<\/table>/i

// Row Pattern: <tr>...</tr>
/<tr[^>]*>([\s\S]*?)<\/tr>/gi

// Cell Pattern: <td>...</td>
/<td[^>]*>([\s\S]*?)<\/td>/gi
```

---

## Schedule of Classes Parsing

### Page: J_VCSC.do (Schedule of Classes)

This page requires **multi-step scraping**:
1. GET initial page → Extract department codes from dropdown
2. POST for each department → Extract class schedule table

### Step 1: Extract Department Codes

```javascript
// Fetch the initial page
const response = await fetch('https://aisis.ateneo.edu/j_aisis/J_VCSC.do');
const html = await response.text();
const doc = parseHTML(html);

// Extract department dropdown
const deptSelect = doc.querySelector('select[name="deptCode"]');
const departments = [];

if (deptSelect) {
  const options = deptSelect.querySelectorAll('option');
  options.forEach(opt => {
    const value = opt.value;
    // Skip "ALL" and empty values
    if (value && value !== 'ALL' && value !== '') {
      departments.push(value);
    }
  });
}

// Result: ['CS', 'MATH', 'ENGG', 'PHYS', ...]
```

**Regex Used:**
```javascript
// Find select element with name="deptCode"
/<select[^>]*name=["']deptCode["'][^>]*>([\s\S]*?)<\/select>/i

// Extract all option values
/<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)<\/option>/gi
```

### Step 2: Extract Applicable Period (Semester)

```javascript
// Extract semester dropdown
const periodSelect = doc.querySelector('select[name="applicablePeriod"]');
let applicablePeriod = '2025-1'; // Default

if (periodSelect) {
  const selectedOption = periodSelect.querySelector('option[selected]');
  if (selectedOption) {
    applicablePeriod = selectedOption.value;
  }
}

// Result: "2025-1" (Year-Semester)
```

**Regex Used:**
```javascript
// Find selected option
/<option[^>]*selected[^>]*value=["']([^"']*)["']/i
```

### Step 3: Scrape Each Department

```javascript
// For each department, POST to get schedule
for (const dept of departments) {
  const formData = new URLSearchParams();
  formData.append('applicablePeriod', applicablePeriod);
  formData.append('command', 'displayResults');
  formData.append('deptCode', dept);
  formData.append('subjCode', 'ALL');
  
  const response = await fetch('https://aisis.ateneo.edu/j_aisis/J_VCSC.do', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData
  });
  
  const html = await response.text();
  
  // Parse the schedule table...
}
```

### Step 4: Parse Schedule Table

```javascript
// Find the correct table by looking for "Subject Code" header
const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
let tableMatch;
let dataTable = null;

while ((tableMatch = tableRegex.exec(html)) !== null) {
  const tableHTML = tableMatch[0];
  
  // Check if this table contains "Subject Code" header
  if (/Subject Code/i.test(tableHTML)) {
    dataTable = tableHTML;
    break;
  }
}

if (dataTable) {
  // Extract rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  let isFirstRow = true;
  const classes = [];
  
  while ((rowMatch = rowRegex.exec(dataTable)) !== null) {
    if (isFirstRow) {
      isFirstRow = false;
      continue; // Skip header row
    }
    
    const rowHTML = rowMatch[1];
    
    // Extract cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
      // Remove HTML tags and clean text
      const cellContent = cellMatch[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      cells.push(cellContent);
    }
    
    // Expected columns: Subject Code, Section, Course Title, Units, Time, Room, Instructor, Max No, Lang, Level, Free Slots, Remarks, S, P
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
      
      classes.push(classData);
    }
  }
}
```

**Regex Patterns Used:**

```javascript
// 1. Find all tables
/<table[^>]*>([\s\S]*?)<\/table>/gi

// 2. Check if table contains "Subject Code" header
/Subject Code/i

// 3. Extract all rows
/<tr[^>]*>([\s\S]*?)<\/tr>/gi

// 4. Extract all cells
/<td[^>]*>([\s\S]*?)<\/td>/gi

// 5. Clean cell content (remove HTML tags)
/<[^>]*>/g

// 6. Replace &nbsp; with space
/&nbsp;/g

// 7. Normalize whitespace
/\s+/g
```

### Output Format

```json
{
  "scheduleOfClasses": [
    {
      "department": "CS",
      "subjectCode": "CS 11",
      "section": "A",
      "courseTitle": "Introduction to Computer Science",
      "units": "3",
      "time": "MWF 10:00-11:00",
      "room": "SEC-A201",
      "instructor": "Dr. Smith, John",
      "maxNo": "40",
      "lang": "EN",
      "level": "UG",
      "freeSlots": "5",
      "remarks": "",
      "s": "",
      "p": ""
    }
  ]
}
```

---

## Official Curriculum Parsing

### Page: J_VOFC.do (Official Curriculum)

Similar to Schedule of Classes, this requires multi-step scraping:
1. GET initial page → Extract degree codes from dropdown
2. POST for each degree → Extract curriculum table

### Step 1: Extract Degree Codes

```javascript
const response = await fetch('https://aisis.ateneo.edu/j_aisis/J_VOFC.do');
const html = await response.text();
const doc = parseHTML(html);

// Extract degree codes from dropdown
const degSelect = doc.querySelector('select[name="degCode"]');
const degreeCodes = [];

if (degSelect) {
  const options = degSelect.querySelectorAll('option');
  options.forEach(opt => {
    const value = opt.value;
    if (value && value !== '') {
      degreeCodes.push({ 
        code: value, 
        name: opt.textContent.trim() 
      });
    }
  });
}

// Result: [
//   { code: 'BS-CS', name: 'BS Computer Science' },
//   { code: 'BS-MATH', name: 'BS Mathematics' },
//   ...
// ]
```

**Regex Used:**
```javascript
// Find select element with name="degCode"
/<select[^>]*name=["']degCode["'][^>]*>([\s\S]*?)<\/select>/i

// Extract all options
/<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)<\/option>/gi
```

### Step 2: Scrape Each Degree Program

```javascript
for (const degree of degreeCodes) {
  const formData = new URLSearchParams();
  formData.append('degCode', degree.code);
  
  const response = await fetch('https://aisis.ateneo.edu/j_aisis/J_VOFC.do', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData
  });
  
  const html = await response.text();
  
  // Parse curriculum table...
}
```

### Step 3: Parse Curriculum Table

```javascript
// Find tables with "Course Title" header
const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
let tableMatch;
const courses = [];

while ((tableMatch = tableRegex.exec(html)) !== null) {
  const tableHTML = tableMatch[0];
  
  // Check if this table contains "Course Title"
  if (/Course Title/i.test(tableHTML)) {
    // Extract rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let isHeaderRow = true;
    let columnHeaderRow = true;
    
    while ((rowMatch = rowRegex.exec(tableHTML)) !== null) {
      if (isHeaderRow) {
        isHeaderRow = false;
        continue; // Skip semester header row
      }
      
      if (columnHeaderRow) {
        columnHeaderRow = false;
        continue; // Skip column header row (Cat No, Course Title, etc.)
      }
      
      const rowHTML = rowMatch[1];
      
      // Extract cells
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
        const cellContent = cellMatch[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        cells.push(cellContent);
      }
      
      // Expected columns: Cat No, Course Title, Units, Prerequisites, Category
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
        
        courses.push(courseData);
      }
    }
  }
}
```

**Regex Patterns Used:**

```javascript
// 1. Find all tables
/<table[^>]*>([\s\S]*?)<\/table>/gi

// 2. Check if table contains "Course Title"
/Course Title/i

// 3. Extract all rows
/<tr[^>]*>([\s\S]*?)<\/tr>/gi

// 4. Extract all cells
/<td[^>]*>([\s\S]*?)<\/td>/gi

// 5. Clean cell content
/<[^>]*>/g
/&nbsp;/g
/\s+/g
```

### Output Format

```json
{
  "officialCurriculum": [
    {
      "degreeProgram": "BS Computer Science",
      "degreeCode": "BS-CS",
      "catNo": "CS 11",
      "courseTitle": "Introduction to Computer Science",
      "units": "3",
      "prerequisites": "None",
      "category": "Major"
    }
  ]
}
```

---

## Grades Parsing

### Page: J_VG.do (View Grades)

**Note:** The code shows `DOMParser` usage, but this is likely a mistake since service workers don't support it. The actual implementation should use regex like other pages.

### Regex-Based Parsing (Corrected)

```javascript
async function scrapeGrades() {
  const response = await fetch('https://aisis.ateneo.edu/j_aisis/J_VG.do');
  const html = await response.text();
  
  // Find the grades table
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  let gradesTable = null;
  
  // Look for table with "School Year" or "Grade" header
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHTML = tableMatch[0];
    if (/School Year/i.test(tableHTML) || /Grade/i.test(tableHTML)) {
      gradesTable = tableHTML;
      break;
    }
  }
  
  const grades = [];
  
  if (gradesTable) {
    // Extract rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let isFirstRow = true;
    
    while ((rowMatch = rowRegex.exec(gradesTable)) !== null) {
      if (isFirstRow) {
        isFirstRow = false;
        continue; // Skip header
      }
      
      const rowHTML = rowMatch[1];
      
      // Extract cells with class="text02" (AISIS-specific)
      const cellRegex = /<td[^>]*class=["']text02["'][^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
        const cellContent = cellMatch[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        cells.push(cellContent);
      }
      
      // Expected columns: School Year, Semester, Program, Course Code, Course Title, Units, Grade
      if (cells.length >= 6) {
        grades.push({
          schoolYear: cells[0] || '',
          semester: cells[1] || '',
          program: cells[2] || '',
          courseCode: cells[3] || '',
          courseTitle: cells[4] || '',
          units: cells[5] || '',
          grade: cells[6] || ''
        });
      }
    }
  }
  
  return grades;
}
```

**Regex Patterns Used:**

```javascript
// 1. Find all tables
/<table[^>]*>([\s\S]*?)<\/table>/gi

// 2. Check if table contains "School Year" or "Grade"
/School Year/i
/Grade/i

// 3. Extract all rows
/<tr[^>]*>([\s\S]*?)<\/tr>/gi

// 4. Extract cells with class="text02" (AISIS-specific styling)
/<td[^>]*class=["']text02["'][^>]*>([\s\S]*?)<\/td>/gi

// 5. Clean cell content
/<[^>]*>/g
/&nbsp;/g
/\s+/g
```

### Output Format

```json
{
  "grades": [
    {
      "schoolYear": "2024-2025",
      "semester": "1",
      "program": "BS-CS",
      "courseCode": "CS 11",
      "courseTitle": "Introduction to Computer Science",
      "units": "3",
      "grade": "1.25"
    }
  ]
}
```

---

## Simple Page Parsing

For pages that don't require structured parsing, the scraper just stores the raw HTML and text content.

### Pages Using Simple Parsing

- **Advisory Grades** (J_VADGR.do)
- **Enrolled Classes** (J_VCEC.do)
- **Class Schedule** (J_VMCS.do)
- **Tuition Receipt** (J_PTR.do)
- **Student Info** (J_STUD_INFO.do)
- **Program of Study** (J_VIPS.do)
- **Hold Orders** (J_VHOR.do)
- **Faculty Attendance** (J_IFAT.do)

### Implementation

```javascript
async function scrapeSimplePage(url, pageName, dataKey) {
  const response = await fetch(url);
  const html = await response.text();
  const doc = parseHTML(html);
  
  // Store raw HTML and text content
  const data = {
    html: html,
    text: doc.body.textContent.trim()
  };
  
  return data;
}
```

**Regex Used:**

```javascript
// Extract all text content (remove HTML tags)
/<[^>]*>/g
```

### Output Format

```json
{
  "studentInfo": {
    "html": "<html>...</html>",
    "text": "Student ID: 254880\nName: Juan Dela Cruz\nProgram: BS Computer Science\n..."
  }
}
```

### Advanced Parsing for Student Info (Optional)

If you want to extract structured data from Student Info page:

```javascript
async function scrapeStudentInfo() {
  const response = await fetch('https://aisis.ateneo.edu/j_aisis/J_STUD_INFO.do');
  const html = await response.text();
  
  const studentInfo = {};
  
  // Extract Student ID
  const idMatch = html.match(/Student\s*ID[:\s]*([0-9]+)/i);
  if (idMatch) {
    studentInfo.studentId = idMatch[1];
  }
  
  // Extract Name
  const nameMatch = html.match(/Name[:\s]*([A-Za-z\s,]+)/i);
  if (nameMatch) {
    studentInfo.name = nameMatch[1].trim();
  }
  
  // Extract Program
  const programMatch = html.match(/Program[:\s]*([A-Za-z\s]+)/i);
  if (programMatch) {
    studentInfo.program = programMatch[1].trim();
  }
  
  // Extract Email
  const emailMatch = html.match(/Email[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    studentInfo.email = emailMatch[1];
  }
  
  return studentInfo;
}
```

**Regex Patterns Used:**

```javascript
// 1. Student ID (numbers only)
/Student\s*ID[:\s]*([0-9]+)/i

// 2. Name (letters, spaces, commas)
/Name[:\s]*([A-Za-z\s,]+)/i

// 3. Program (letters and spaces)
/Program[:\s]*([A-Za-z\s]+)/i

// 4. Email (standard email pattern)
/Email[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
```

---

## Complete Regex Reference

### Authentication

```javascript
// Extract CSRF token (rnd)
/<input[^>]*name=["']rnd["'][^>]*value=["']([^"']*)["']/i
/<input[^>]*value=["']([^"']*)["'][^>]*name=["']rnd["']/i

// Check for successful login
/welcome/i
/error/i
/invalid/i
```

### Form Elements

```javascript
// Input fields
/<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/i

// Select dropdowns
/<select[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/i

// Option elements
/<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)<\/option>/gi

// Selected option
/<option[^>]*selected[^>]*value=["']([^"']*)["']/i
```

### Tables

```javascript
// Find table
/<table[^>]*>([\s\S]*?)<\/table>/gi

// Find rows
/<tr[^>]*>([\s\S]*?)<\/tr>/gi

// Find cells (td)
/<td[^>]*>([\s\S]*?)<\/td>/gi

// Find header cells (th)
/<th[^>]*>([\s\S]*?)<\/th>/gi

// Find cells with specific class
/<td[^>]*class=["']text02["'][^>]*>([\s\S]*?)<\/td>/gi
```

### Content Cleaning

```javascript
// Remove all HTML tags
/<[^>]*>/g

// Replace &nbsp; with space
/&nbsp;/g

// Normalize whitespace (multiple spaces to single space)
/\s+/g

// Remove leading/trailing whitespace (use .trim())
```

### Text Extraction

```javascript
// Extract student ID
/Student\s*ID[:\s]*([0-9]+)/i

// Extract name
/Name[:\s]*([A-Za-z\s,]+)/i

// Extract program
/Program[:\s]*([A-Za-z\s]+)/i

// Extract email
/Email[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i

// Extract phone number
/Phone[:\s]*([0-9\-\+\(\)\s]+)/i
```

### Table Header Detection

```javascript
// Check if table contains specific header
/Subject Code/i
/Course Title/i
/School Year/i
/Grade/i
```

---

## Summary of Parsing Strategies

### 1. Schedule of Classes
- **Strategy**: Multi-step (GET dropdown → POST each department)
- **Key Regex**: Table finder, row extractor, cell extractor
- **Output**: Array of class objects with 14 fields

### 2. Official Curriculum
- **Strategy**: Multi-step (GET dropdown → POST each degree)
- **Key Regex**: Table finder, row extractor, cell extractor
- **Output**: Array of course objects with 5 fields

### 3. Grades
- **Strategy**: Single GET, find table with "Grade" header
- **Key Regex**: Table finder, row extractor, cell extractor with class="text02"
- **Output**: Array of grade objects with 7 fields

### 4. Simple Pages
- **Strategy**: Single GET, store raw HTML and text
- **Key Regex**: Remove HTML tags to get plain text
- **Output**: Object with `html` and `text` fields

---

## Tips for Adapting to Other Languages

### Python (BeautifulSoup)

```python
from bs4 import BeautifulSoup

html = response.text
soup = BeautifulSoup(html, 'html.parser')

# Find table
table = soup.find('table')

# Find all rows
rows = table.find_all('tr')

# Extract cells
for row in rows[1:]:  # Skip header
    cells = row.find_all('td')
    data = [cell.get_text(strip=True) for cell in cells]
```

### Node.js (Cheerio)

```javascript
const cheerio = require('cheerio');

const $ = cheerio.load(html);

// Find table
const table = $('table');

// Find all rows
const rows = table.find('tr');

// Extract cells
rows.slice(1).each((i, row) => {  // Skip header
  const cells = $(row).find('td');
  const data = cells.map((j, cell) => $(cell).text().trim()).get();
});
```

### PHP (DOMDocument)

```php
$dom = new DOMDocument();
@$dom->loadHTML($html);

// Find table
$tables = $dom->getElementsByTagName('table');
$table = $tables->item(0);

// Find all rows
$rows = $table->getElementsByTagName('tr');

// Extract cells
for ($i = 1; $i < $rows->length; $i++) {  // Skip header
    $cells = $rows->item($i)->getElementsByTagName('td');
    $data = [];
    foreach ($cells as $cell) {
        $data[] = trim($cell->textContent);
    }
}
```

---

**End of Document**
