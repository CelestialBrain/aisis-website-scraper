'''
# AISIS Auto Scraper (v2.0)

This advanced Chrome extension automates the entire process of scraping data from the AISIS website. It provides a user-friendly interface to save your credentials, select the pages you want to scrape, monitor the progress in real-time, and export the data in multiple formats.

## 1. Features

*   **Credential Storage**: Securely save your AISIS username and password for automatic login.
*   **Selective Scraping**: Use checkboxes to choose exactly which pages you want to scrape.
*   **Background Operation**: The scraper runs in the background, so you can continue to use your browser.
*   **Real-Time Progress**: A progress bar, step-by-step status updates, and a time estimate keep you informed.
*   **Automatic Option Detection**: The scraper automatically finds all departments and degree programs, so you don't have to.
*   **Rate Limiting**: A built-in delay between requests prevents the server from being overloaded.
*   **Multiple Export Formats**: Download your data as a structured JSON file, a spreadsheet-friendly CSV file, or view it directly in a new tab.
*   **Debug Logging**: View and download detailed logs to troubleshoot any issues.

## 2. Installation Guide

1.  **Download and Unzip**: Download the `aisis_scraper_advanced.zip` file and unzip it. You will have a folder named `aisis_scraper_advanced`.
2.  **Open Chrome Extensions**: Open your Chrome browser and navigate to `chrome://extensions`.
3.  **Enable Developer Mode**: In the top-right corner, toggle the **Developer mode** switch to the "on" position.
4.  **Load Unpacked**: Click the **Load unpacked** button.
5.  **Select Folder**: Navigate to and select the `aisis_scraper_advanced` folder.

The **AISIS Auto Scraper** icon should now appear in your browser's toolbar.

## 3. Usage Instructions

### Step 1: Save Your Credentials

1.  Click the extension icon to open the popup.
2.  In the **Credentials** section, enter your AISIS username and password.
3.  Click the **Save Credentials** button. You only need to do this once.

### Step 2: Start Scraping

1.  In the **Select Pages to Scrape** section, check the boxes for the pages you want to scrape (e.g., "Schedule of Classes", "Official Curriculum").
2.  Click the **Start Scraping** button.

### Step 3: Monitor Progress

*   The popup will switch to the **Scraping Progress** view.
*   You can monitor the progress bar, the current step, and the estimated time remaining.
*   The **Debug Logs** section will show a detailed, real-time log of the scraping process.
*   You can close the popup, and the scraping will continue in the background. Re-open it at any time to check the status.

### Step 4: Export Your Data

*   Once scraping is complete, you will see an **Export Data** section.
*   Click **JSON** to download a structured JSON file.
*   Click **CSV** to download a spreadsheet-compatible CSV file.
*   Click **View** to open the raw data in a new browser tab.

## 4. Troubleshooting

*   If you encounter any errors, the **Debug Logs** section is the best place to look. You can download the logs for a more detailed analysis.
*   If the scraper gets stuck, you can use the **Stop Scraping** button to reset it.
*   Ensure your credentials are correct. If you change your AISIS password, you must re-save it in the extension.
'''
