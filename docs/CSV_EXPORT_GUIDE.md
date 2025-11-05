# AISIS Scraper CSV Export Reference

This document explains how the Chrome extension converts scraped datasets into a consolidated CSV file. It covers the export order, column mappings, and the formatting rules implemented in `chrome-extension/popup.js`.

## Overview

The popup exposes an **Export CSV** button that serializes everything inside `scrapingState.scrapedData`. Each dataset is converted into an uppercase section header followed by a CSV table. Sections are separated by blank lines so spreadsheet software can detect the boundaries.

## Dataset Export Order

Datasets are exported in a consistent sequence to keep related sections grouped:

1. Schedule of Classes
2. Official Curriculum
3. View Grades
4. Advisory Grades
5. Currently Enrolled
6. My Class Schedule
7. Tuition Receipt
8. Student Information
9. Program of Study
10. Hold Orders
11. Faculty Attendance
12. Any additional datasets persisted in `scrapedData`

## Column Definitions

Some datasets have bespoke column definitions to preserve the expected field ordering:

- **Schedule of Classes**: Department, Subject Code, Section, Course Title, Units, Time, Room, Instructor, Max No, Lang, Level, Free Slots, Remarks, S, P
- **Official Curriculum**: Degree Program, Degree Code, Cat No, Course Title, Units, Prerequisites, Category
- **View Grades**: School Year, Semester, Program, Course Code, Course Title, Units, Grade

If a dataset is an array but does not have a predefined mapping, the exporter inspects every object in the array and uses the union of the keys to build column headers automatically.

## Table-based Pages

Pages scraped with the generic `scrapeSimplePage` helper capture HTML tables alongside plain-text snapshots. During CSV conversion:

- Every table becomes its own section. Captions are appended to the section header when available, otherwise tables are numbered.
- A metadata block is emitted with the capture timestamp (`Captured At`).
- If a page had no detectable table rows, the exporter still serializes a **TEXT SNAPSHOT** section containing the cleaned page text.

## Value Formatting

- All cell values are wrapped in quotes with double quotes escaped (standard CSV escaping).
- Non-string values (numbers, booleans, nested objects) are stringified using `JSON.stringify` when necessary.
- Empty or missing values are rendered as `""` to keep column alignment intact.

These rules ensure that the resulting CSV can be imported into spreadsheets or databases without manual cleanup.
