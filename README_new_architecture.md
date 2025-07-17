# Mwmbl Crawler Extension - New Daily Architecture

This document describes the new daily crawler architecture that has been implemented to replace the continuous query generation system.

## Overview

The extension now operates on a daily cycle with the following behavior:

1. **Daily Query Dataset Generation**: Once per day, generates a dataset of queries using the existing `queries.js` system
2. **Periodic Google Searches**: Every 10 minutes (configurable), selects a random query from the dataset and performs a Google search
3. **Data Collection**: After 10 searches (configurable), packages the query dataset and search results
4. **Backend Transmission**: Sends the collected data to a backend endpoint
5. **Daily Reset**: Stops for the day and waits for the next day to begin the cycle again
6. **Unsent Data Handling**: Checks for and attempts to send any unsent data from previous days

## Architecture Components

### Core Modules

#### 1. `src/config.js`
Central configuration file containing all configurable parameters:
- Backend endpoint URL
- Number of searches per day (default: 10)
- Search interval in minutes (default: 10)
- Default seed terms and query counts
- Timeout and retry settings

#### 2. `src/scheduler.js`
Main orchestrator that manages the daily workflow:
- `DailyScheduler` class handles the entire daily cycle
- Manages state transitions between dataset generation, searching, and data transmission
- Provides progress callbacks for UI updates

#### 3. `src/data-manager.js`
Handles all data storage and retrieval operations:
- Daily state management (new day detection, initialization)
- Query dataset storage and random selection
- Search result collection and quota tracking
- Data packaging for backend transmission
- Unsent data persistence and recovery

#### 4. `src/google-search.js`
Extracted and enhanced Google search functionality:
- `fetchGoogleResults()` - Fetches and parses Google search results
- `performGoogleSearch()` - Wrapper with retry logic and error handling
- Configurable timeouts and retry attempts

#### 5. `src/backend.js`
Backend communication with robust error handling:
- Data transmission with retry logic
- Connectivity testing
- Data validation before transmission
- Configurable endpoints and timeouts

### Updated Components

#### 6. `src/worker.js`
Updated to use the new `DailyScheduler` instead of continuous generation:
- `DailyCrawlerManager` replaces `QueryDatasetGenerator`
- Handles progress updates for both query generation and search phases
- Maintains compatibility with existing popup UI

#### 7. `src/popup/popup.js`
Enhanced to display both query generation and search progress:
- Shows query generation progress (existing functionality)
- Displays search progress with search index (e.g., "Search 3/10")
- Handles new message types from the scheduler

#### 8. `src/content.js`
Updated to use the extracted Google search module:
- Imports `fetchGoogleResults` from `google-search.js`
- Maintains existing functionality for query enhancement

## Configuration

### Backend Endpoint
Update the backend endpoint in `src/config.js`:

```javascript
export const CONFIG = {
    BACKEND_ENDPOINT: 'https://your-backend-domain.com/api/crawler-data',
    // ... other settings
};
```

### Search Parameters
Modify search behavior in `src/config.js`:

```javascript
export const CONFIG = {
    SEARCHES_PER_DAY: 10,           // Number of searches per day
    SEARCH_INTERVAL_MINUTES: 10,   // Minutes between searches
    // ... other settings
};
```

### Query Generation
Adjust query generation defaults in `src/config.js`:

```javascript
export const CONFIG = {
    DEFAULT_SEED_TERMS: ['wikipedia', 'github', 'stackoverflow', 'reddit', 'youtube'],
    DEFAULT_NUM_QUERIES: 50,
    // ... other settings
};
```

## Data Format

### Backend Data Package
The extension sends data to the backend in the following format:

```javascript
{
    "date": "2025-01-07",
    "timestamp": 1704672000000,
    "extensionVersion": "0.6.1",
    "queryDataset": [
        {
            "query": "wikipedia",
            "suggestion": "wikipedia english",
            "source_term": "wikipedia",
            "timestamp": 1704672000000
        }
        // ... more entries
    ],
    "searchResults": [
        {
            "query": "wikipedia english",
            "results": [
                {
                    "title": "Wikipedia",
                    "url": "https://en.wikipedia.org/",
                    "extract": "Wikipedia is a free online encyclopedia...",
                    "timestamp": 1704672000000
                }
                // ... more results
            ],
            "timestamp": 1704672000000,
            "duration": 1250,
            "success": true,
            "resultCount": 8,
            "searchIndex": 1
        }
        // ... more searches
    ]
}
```

## Storage Schema

The extension uses the following Chrome storage keys:

```javascript
{
    // Daily cycle management
    "current_date": "2025-01-07",           // Current day tracking
    "daily_query_dataset": [...],           // Today's query dataset
    "completed_searches": [...],             // Search results array
    "search_count": 5,                      // Current search count
    "daily_complete": false,                // Whether day is finished
    "last_search_time": 1704672000000,      // Last search timestamp
    
    // Unsent data handling
    "unsent_data": {...},                   // Data pending transmission
    
    // Configuration (existing)
    "generate_dataset": true,               // Enable/disable extension
    "seed_terms": [...],                    // Custom seed terms
    "num_queries": 50,                      // Custom query count
    
    // UI display (existing)
    "batch": [...]                          // Recent items for popup
}
```

## Daily Workflow

### 1. Extension Startup
- Check if it's a new day → Initialize new day if needed
- Check for unsent data → Attempt to send if found
- Check if daily cycle is complete → Wait for next day if complete

### 2. Query Dataset Generation
- Generate queries using existing `QueryGenerator`
- Store dataset in `daily_query_dataset`
- Progress updates sent to popup

### 3. Search Cycle
- Every 10 minutes (configurable):
  - Select random query from dataset
  - Perform Google search
  - Store results
  - Update search count
- Continue until quota reached (10 searches by default)

### 4. Data Transmission
- Package query dataset and search results
- Validate data structure
- Send to backend with retry logic
- Mark daily cycle as complete
- Store as unsent data if transmission fails

### 5. Daily Reset
- Wait for next day
- Repeat cycle

## Error Handling

### Google Search Failures
- Retry with exponential backoff
- Store failed attempts with error details
- Continue with remaining quota

### Backend Transmission Failures
- Store data as "unsent" for later retry
- Attempt to send unsent data on next startup
- Multiple retry attempts with backoff

### Extension Restart Recovery
- State persisted in Chrome storage
- Resume from current position in daily cycle
- Handle partial completions gracefully

## Development and Testing

### Testing the New Architecture
1. Enable the extension in Chrome
2. Open the popup to see progress
3. Check browser console for detailed logs
4. Monitor Chrome storage in DevTools

### Debugging
- Set `DEBUG_MODE: true` in `src/config.js`
- Check console logs for detailed workflow information
- Use Chrome DevTools → Application → Storage → Extension to inspect stored data

### Backend Development
Create an endpoint that accepts POST requests with the data format shown above. The endpoint should:
- Accept JSON data
- Validate the structure
- Store or process the query dataset and search results
- Return a success response

Example endpoint response:
```javascript
{
    "success": true,
    "message": "Data received successfully",
    "timestamp": 1704672000000,
    "dataId": "unique-identifier"
}
```

## Migration from Old System

The new architecture is designed to be backward compatible:
- Existing popup UI continues to work
- Same storage keys for configuration
- Gradual transition from continuous to daily operation

### Key Differences
- **Old**: Continuous query generation when enabled
- **New**: Daily cycle with scheduled searches
- **Old**: No Google search execution
- **New**: Automated Google searches with result collection
- **Old**: No backend transmission
- **New**: Automatic data packaging and transmission

## Troubleshooting

### Common Issues

1. **No searches happening**
   - Check if `generate_dataset` is enabled in storage
   - Verify daily cycle hasn't completed
   - Check console for error messages

2. **Backend transmission failing**
   - Verify endpoint URL in `src/config.js`
   - Check network connectivity
   - Review backend logs for errors

3. **Extension not starting**
   - Check for JavaScript errors in console
   - Verify all modules are properly imported
   - Ensure Chrome extension permissions are correct

### Reset Daily State
To reset the daily state for testing:
```javascript
// In browser console
chrome.storage.local.clear();
```

Or selectively:
```javascript
chrome.storage.local.remove([
    'current_date', 'daily_query_dataset', 'completed_searches', 
    'search_count', 'daily_complete', 'last_search_time', 'unsent_data'
]);
