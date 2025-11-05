# AISIS Dashboard Chrome Extension Overview

## Purpose and Capabilities
- Automates logging into the AISIS portal, navigating pages, and collecting student data such as grades, schedules, student information, and program of study.
- Provides a popup workflow for saving credentials, selecting which pages to scrape, and exporting collected results to text, JSON, or CSV formats.
- Offers a dashboard view to visualise the previously scraped data, including summaries of coursework, schedules, and profile details.

## Key Components
- **Manifest** – Declares a Manifest V3 extension with a background service worker (`background.js`), dashboard popup (`dashboard.html`), and the permissions required to scrape `https://aisis.ateneo.edu`.【F:chrome-extension/manifest.json†L1-L25】
- **Background Service Worker** – Maintains global scraping state, persists it to `chrome.storage.local`, and streams progress updates back to the UI. It also records HAR traces and HTML snapshots for debugging, manages credential storage, and performs all AISIS HTTP requests with adaptive rate-limiting and retry logic.【F:chrome-extension/background.js†L4-L346】【F:chrome-extension/background.js†L348-L400】
- **Popup UI (`popup.html`/`popup.js`)** – Lets users save their credentials (Base64-encoded before storage), configure which portal pages to scrape, start/pause/resume the scraper, and export logs or data through the Downloads API.【F:chrome-extension/popup.js†L3-L199】
- **Dashboard (`dashboard.html`/`dashboard.js`)** – Reads the cached scraping payload from storage and renders multiple tabs (Overview, Grades, Schedule, Student Info, Program of Study) with computed statistics and empty states if data is missing.【F:chrome-extension/dashboard.js†L1-L106】

## Data Handling Notes
- Credentials are only obfuscated via Base64 before being persisted to `chrome.storage.local`; this is not strong encryption and should be treated as sensitive data at rest.【F:chrome-extension/background.js†L112-L139】
- Each network request is wrapped so the extension can pause when it detects slow responses, helping to avoid rate limiting. Full request and response bodies are captured in HAR entries and stored alongside HTML snapshots inside the scraper state.【F:chrome-extension/background.js†L64-L109】【F:chrome-extension/background.js†L260-L346】
- The popup UI exposes downloads for the HAR-backed logs and scraped datasets, meaning data remains on the client but can be exported manually.【F:chrome-extension/popup.js†L185-L199】

## Operational Flow
1. User saves credentials in the popup (stored locally in obfuscated form).【F:chrome-extension/popup.js†L22-L95】
2. User selects target pages and starts scraping; the background worker logs progress, tracks session IDs, and fetches AISIS content via `fetchWithHAR` while handling rate limiting.【F:chrome-extension/background.js†L4-L346】【F:chrome-extension/popup.js†L97-L177】
3. When scraping is stopped or completed, the popup enables export buttons and the dashboard reads the cached dataset for visualisation.【F:chrome-extension/popup.js†L150-L199】【F:chrome-extension/dashboard.js†L26-L106】

## Security and Maintenance Considerations
- Because credentials are stored with reversible Base64 encoding, deployments should consider hardening this storage (e.g., using `chrome.storage.session`, adding user prompts, or avoiding persistence entirely).【F:chrome-extension/background.js†L112-L139】
- HAR and HTML snapshot retention can accumulate large volumes of personally identifiable information; provide a way to purge or redact this data when no longer needed.【F:chrome-extension/background.js†L58-L109】
- Monitor for upstream AISIS HTML changes. The service worker uses regex-based parsing due to MV3 restrictions; brittle selectors may require updates if portal markup changes.【F:chrome-extension/background.js†L146-L258】
