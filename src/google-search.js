/**
 * Google Search Module
 * Handles fetching and parsing Google search results
 */

import { CONFIG } from "./config.js";

function querySelectorInnerText(result, selector) {
    const element = result.querySelector(selector);
    return element ? element.innerText : null;
}

function querySelectorHref(result, selector) {
    const element = result.querySelector(selector);
    return element ? element.href : null;
}

/**
 * Fetch Google search results for a given query
 * @param {string} query - The search query
 * @returns {Promise<Array>} Array of search results with title, url, and extract
 */
export async function fetchGoogleResults(query) {
    // Construct URL to query Google
    const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
    console.log("Fetching Google results for:", query);

    // Fetch the URL with headers to specify UK origin
    const headers = new Headers();
    headers.append('Accept-Language', 'en-GB,en-US;q=0.7,en;q=0.3');
    headers.append('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    const options = {
        headers: headers,
        credentials: 'omit',
        signal: AbortSignal.timeout(CONFIG.GOOGLE_SEARCH_TIMEOUT)
    };

    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        const results = doc.querySelectorAll('.g');

        console.log(`Found ${results.length} Google search results for "${query}"`);

        // Collect results
        const resultArray = [];
        for (let i = 0; i < results.length; ++i) {
            const result = results[i];
            const title = querySelectorInnerText(result, '.DKV0Md');
            const url = querySelectorHref(result, '.yuRUbf a');
            
            if (!url || !title) {
                continue;
            }
            
            const extract = querySelectorInnerText(result, '.VwiC3b');
            
            resultArray.push({
                'title': title,
                'url': url,
                'extract': extract,
                'timestamp': Date.now()
            });
        }

        return resultArray;
        
    } catch (error) {
        console.error(`Error fetching Google results for "${query}":`, error);
        throw error;
    }
}

/**
 * Perform a Google search with retry logic and rate limiting
 * @param {string} query - The search query
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Object>} Search result object with query, results, and metadata
 */
export async function performGoogleSearch(query, maxRetries = CONFIG.MAX_RETRIES) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const startTime = Date.now();
            const results = await fetchGoogleResults(query);
            const endTime = Date.now();
            
            return {
                query: query,
                results: results,
                timestamp: startTime,
                duration: endTime - startTime,
                success: true,
                attempt: attempt,
                resultCount: results.length
            };
            
        } catch (error) {
            lastError = error;
            console.warn(`Google search attempt ${attempt}/${maxRetries} failed for "${query}":`, error.message);
            
            if (attempt < maxRetries) {
                // Wait before retrying (exponential backoff)
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // All attempts failed
    return {
        query: query,
        results: [],
        timestamp: Date.now(),
        duration: 0,
        success: false,
        error: {
            name: lastError.name,
            message: lastError.message
        },
        attempt: maxRetries,
        resultCount: 0
    };
}
