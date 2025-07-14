/**
 * Backend Communication Module
 * Handles HTTP requests to the backend for data transmission
 */

import { retrieve } from "./storage.js";
import { CONFIG } from "./config.js";

// Backend configuration from config.js
const BACKEND_CONFIG = {
    endpoint: CONFIG.BACKEND_ENDPOINT,
    timeout: CONFIG.BACKEND_TIMEOUT,
    maxRetries: CONFIG.MAX_RETRIES
};

/**
 * Send data to the backend with retry logic
 * @param {Object} data - The data package to send
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Object>} Response object with success status and details
 */
export async function sendDataToBackend(data, maxRetries = BACKEND_CONFIG.maxRetries) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempting to send data to backend (attempt ${attempt}/${maxRetries})`);
            
            const response = await fetch(BACKEND_CONFIG.endpoint, {
                method: 'POST',
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(BACKEND_CONFIG.timeout)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
            }
            
            const responseData = await response.json();
            
            console.log('Successfully sent data to backend:', {
                status: response.status,
                dataSize: JSON.stringify(data).length,
                searches: data.searchResults.totalSearches,
                datasetEntries: data.queryDataset.totalEntries
            });
            
            return {
                success: true,
                status: response.status,
                data: responseData,
                attempt: attempt,
                timestamp: Date.now()
            };
            
        } catch (error) {
            lastError = error;
            console.warn(`Backend transmission attempt ${attempt}/${maxRetries} failed:`, error.message);
            
            if (attempt < maxRetries) {
                // Wait before retrying (exponential backoff)
                const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // All attempts failed
    console.error('Failed to send data to backend after all retry attempts:', lastError);
    
    return {
        success: false,
        error: {
            name: lastError.name,
            message: lastError.message
        },
        attempt: maxRetries,
        timestamp: Date.now()
    };
}

/**
 * Test backend connectivity
 * @returns {Promise<Object>} Test result with connectivity status
 */
export async function testBackendConnectivity() {
    try {
        console.log('Testing backend connectivity...');
        
        const testData = {
            test: true,
            timestamp: Date.now(),
            message: 'Connectivity test from Mwmbl Crawler Extension'
        };
        
        const response = await fetch(BACKEND_CONFIG.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mwmbl-Crawler-Extension/0.6.1'
            },
            body: JSON.stringify(testData),
            signal: AbortSignal.timeout(10000) // Shorter timeout for test
        });
        
        const isConnected = response.ok;
        
        return {
            connected: isConnected,
            status: response.status,
            statusText: response.statusText,
            timestamp: Date.now()
        };
        
    } catch (error) {
        console.warn('Backend connectivity test failed:', error.message);
        
        return {
            connected: false,
            error: {
                name: error.name,
                message: error.message
            },
            timestamp: Date.now()
        };
    }
}

/**
 * Get backend configuration
 * @returns {Object} Current backend configuration
 */
export function getBackendConfig() {
    return { ...BACKEND_CONFIG };
}

/**
 * Update backend endpoint (useful for development/testing)
 * @param {string} newEndpoint - New backend endpoint URL
 */
export function setBackendEndpoint(newEndpoint) {
    BACKEND_CONFIG.endpoint = newEndpoint;
    console.log(`Backend endpoint updated to: ${newEndpoint}`);
}

/**
 * Send data with additional metadata and error handling
 * @param {Object} data - The data package to send
 * @returns {Promise<Object>} Enhanced response with additional metadata
 */
export async function transmitCrawlerData(data) {
    const startTime = Date.now();
        
    try {
        const result = await sendDataToBackend(data);
        const endTime = Date.now();
        
        return {
            ...result,
            duration: endTime - startTime,
            dataSize: JSON.stringify(data).length,
            compressionRatio: JSON.stringify(data).length / JSON.stringify(data).length
        };
        
    } catch (error) {
        const endTime = Date.now();
        
        return {
            success: false,
            duration: endTime - startTime,
            error: {
                name: error.name,
                message: error.message
            },
            timestamp: endTime
        };
    }
}

/**
 * Validate data before transmission
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result
 */
export function validateDataForTransmission(data) {
    const errors = [];
    const warnings = [];
    
    // Check required fields
    if (!data.date) errors.push('Missing date field');
    if (!data.timestamp) errors.push('Missing timestamp field');
    if (!data.queryDataset) errors.push('Missing queryDataset field');
    if (!data.searchResults) errors.push('Missing searchResults field');
    if (!data.metadata) errors.push('Missing metadata field');
    
    // Check data quality
    if (data.queryDataset && data.queryDataset.totalEntries === 0) {
        warnings.push('Query dataset is empty');
    }
    
    if (data.searchResults && data.searchResults.totalSearches === 0) {
        warnings.push('No search results to transmit');
    }
    
    if (data.searchResults && data.searchResults.failedSearches > data.searchResults.successfulSearches) {
        warnings.push('More failed searches than successful ones');
    }
    
    // Check data size (warn if too large)
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 1024 * 1024) { // 1MB
        warnings.push(`Data size is large: ${Math.round(dataSize / 1024)}KB`);
    }
    
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        dataSize,
        timestamp: Date.now()
    };
}
