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
