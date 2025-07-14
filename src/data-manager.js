/**
 * Data Manager Module
 * Handles query datasets, search results, and data packaging for backend transmission
 */

import { retrieve, store } from "./storage.js";
import { CONFIG } from "./config.js";

/**
 * Get the current date string in YYYY-MM-DD format
 */
function getCurrentDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

/**
 * Check if we're in a new day and need to reset
 */
export async function isNewDay() {
    const currentDate = getCurrentDateString();
    const storedDate = await retrieve('current_date');
    return currentDate !== storedDate;
}

/**
 * Initialize a new day's data structure
 */
export async function initializeNewDay() {
    const currentDate = getCurrentDateString();
    
    await store('current_date', currentDate);
    await store('daily_query_dataset', []);
    await store('completed_searches', []);
    await store('search_count', 0);
    await store('daily_complete', false);
    await store('last_search_time', null);
    
    console.log(`Initialized new day: ${currentDate}`);
}

/**
 * Store the daily query dataset
 */
export async function storeDailyQueryDataset(dataset) {
    await store('daily_query_dataset', dataset);
    console.log(`Stored daily query dataset with ${dataset.length} entries`);
}

/**
 * Get the daily query dataset
 */
export async function getDailyQueryDataset() {
    return await retrieve('daily_query_dataset') || [];
}

/**
 * Get a random query from the daily dataset
 */
export async function getRandomQuery() {
    const dataset = await getDailyQueryDataset();
    
    if (dataset.length === 0) {
        throw new Error('No queries available in daily dataset');
    }
    
    // Get unique queries (suggestions) from the dataset
    const uniqueQueries = [...new Set(dataset.map(item => item.suggestion))];
    
    if (uniqueQueries.length === 0) {
        throw new Error('No valid queries found in dataset');
    }
    
    const randomIndex = Math.floor(Math.random() * uniqueQueries.length);
    return uniqueQueries[randomIndex];
}

/**
 * Add a completed search result
 */
export async function addSearchResult(searchResult) {
    const completedSearches = await retrieve('completed_searches') || [];
    const searchCount = await retrieve('search_count') || 0;
    
    completedSearches.push({
        ...searchResult,
        searchIndex: searchCount + 1
    });
    
    await store('completed_searches', completedSearches);
    await store('search_count', searchCount + 1);
    await store('last_search_time', Date.now());
    
    console.log(`Added search result ${searchCount + 1}/${CONFIG.SEARCHES_PER_DAY} for query: "${searchResult.query}"`);
    
    return searchCount + 1;
}

/**
 * Check if we've completed the daily quota of searches
 */
export async function isDailyQuotaComplete() {
    const searchCount = await retrieve('search_count') || 0;
    return searchCount >= CONFIG.SEARCHES_PER_DAY;
}

/**
 * Mark the daily cycle as complete
 */
export async function markDailyComplete() {
    await store('daily_complete', true);
    console.log('Daily search cycle marked as complete');
}

/**
 * Check if the daily cycle is complete
 */
export async function isDailyComplete() {
    return await retrieve('daily_complete') || false;
}

/**
 * Get the current search count
 */
export async function getSearchCount() {
    return await retrieve('search_count') || 0;
}

/**
 * Get the last search time
 */
export async function getLastSearchTime() {
    return await retrieve('last_search_time');
}

/**
 * Check if enough time has passed since the last search
 */
export async function canPerformNextSearch() {
    const lastSearchTime = await getLastSearchTime();
    
    if (!lastSearchTime) {
        return true; // No previous search, can start
    }
    
    const intervalMs = CONFIG.SEARCH_INTERVAL_MINUTES * 60 * 1000;
    const timeSinceLastSearch = Date.now() - lastSearchTime;
    
    return timeSinceLastSearch >= intervalMs;
}

/**
 * Get time until next search is allowed (in milliseconds)
 */
export async function getTimeUntilNextSearch() {
    const lastSearchTime = await getLastSearchTime();
    
    if (!lastSearchTime) {
        return 0; // Can search immediately
    }
    
    const intervalMs = CONFIG.SEARCH_INTERVAL_MINUTES * 60 * 1000;
    const timeSinceLastSearch = Date.now() - lastSearchTime;
    const timeRemaining = intervalMs - timeSinceLastSearch;
    
    return Math.max(0, timeRemaining);
}

/**
 * Package data for backend transmission
 */
export async function packageDataForBackend() {
    const currentDate = await retrieve('current_date');
    const dailyQueryDataset = await getDailyQueryDataset();
    const completedSearches = await retrieve('completed_searches') || [];
    const searchCount = await getSearchCount();
    
    // Get version dynamically from manifest
    const extensionVersion = browser.runtime.getManifest().version;
    
    const packagedData = {
        date: currentDate,
        timestamp: Date.now(),
        extensionVersion: extensionVersion,
        queryDataset:  dailyQueryDataset,
        searchResults:  completedSearches,
    };
    
    console.log(`Packaged data for backend: ${searchCount} searches, ${dailyQueryDataset.length} dataset entries`);
    return packagedData;
}

/**
 * Store unsent data for later transmission
 */
export async function storeUnsentData(data) {
    await store('unsent_data', data);
    console.log('Stored unsent data for later transmission');
}

/**
 * Get unsent data from previous day
 */
export async function getUnsentData() {
    return await retrieve('unsent_data');
}

/**
 * Clear unsent data after successful transmission
 */
export async function clearUnsentData() {
    await store('unsent_data', null);
    console.log('Cleared unsent data after successful transmission');
}

/**
 * Check if there's unsent data from previous day
 */
export async function hasUnsentData() {
    const unsentData = await getUnsentData();
    return unsentData !== null && unsentData !== undefined;
}

/**
 * Get current status summary
 */
export async function getStatusSummary() {
    const currentDate = await retrieve('current_date');
    const searchCount = await getSearchCount();
    const dailyComplete = await isDailyComplete();
    const lastSearchTime = await getLastSearchTime();
    const canSearch = await canPerformNextSearch();
    const timeUntilNext = await getTimeUntilNextSearch();
    const hasUnsent = await hasUnsentData();
    
    return {
        currentDate,
        searchCount,
        dailyComplete,
        lastSearchTime,
        canPerformNextSearch: canSearch,
        timeUntilNextSearchMs: timeUntilNext,
        hasUnsentData: hasUnsent,
        status: dailyComplete ? 'complete' : (searchCount === 0 ? 'ready' : 'active')
    };
}
