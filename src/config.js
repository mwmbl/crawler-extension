/**
 * Configuration file for the Mwmbl Crawler Extension
 * Modify these settings as needed
 */

export const CONFIG = {
    // Backend endpoint - replace with your actual backend URL when ready
    BACKEND_ENDPOINT: 'https://your-backend-domain.com/api/crawler-data',
    
    // Search configuration
    SEARCHES_PER_DAY: 10,
    SEARCH_INTERVAL_MINUTES: 10,
    
    // Query generation configuration
    DEFAULT_SEED_TERMS: ['wikipedia', 'github', 'stackoverflow', 'reddit', 'youtube'],
    DEFAULT_NUM_QUERIES: 50,
    
    // Retry configuration
    MAX_RETRIES: 3,
    RETRY_DELAY_BASE: 2000, // Base delay in milliseconds for exponential backoff
    
    // Timeout configuration
    GOOGLE_SEARCH_TIMEOUT: 10000, // 10 seconds
    BACKEND_TIMEOUT: 30000, // 30 seconds
    
    // Development/debugging
    DEBUG_MODE: false,
    LOG_LEVEL: 'info' // 'debug', 'info', 'warn', 'error'
};

/**
 * Update backend endpoint
 * @param {string} newEndpoint - New backend endpoint URL
 */
export function setBackendEndpoint(newEndpoint) {
    CONFIG.BACKEND_ENDPOINT = newEndpoint;
    console.log(`Backend endpoint updated to: ${newEndpoint}`);
}

/**
 * Get current configuration
 * @returns {Object} Current configuration object
 */
export function getConfig() {
    return { ...CONFIG };
}

/**
 * Update configuration values
 * @param {Object} updates - Configuration updates
 */
export function updateConfig(updates) {
    Object.assign(CONFIG, updates);
    console.log('Configuration updated:', updates);
}
