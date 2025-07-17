/**
 * Search Module - SearXNG implementation
 * Handles fetching and parsing search results from random SearXNG instances
 */

import { CONFIG } from "./config.js";

// Cache for instances to avoid fetching on every request
let instancesCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch SearXNG instances from searx.space
 * @returns {Promise<Array>} Array of instance URLs
 */
async function fetchSearXNGInstances() {
    const now = Date.now();
    
    // Return cached instances if still valid
    if (instancesCache && (now - cacheTimestamp) < CACHE_DURATION) {
        return instancesCache;
    }
    
    try {
        const response = await fetch('https://searx.space/data/instances.json', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const instances = Object.keys(data.instances || {});
        
        // Filter and get top 20 instances (they should be ordered by reliability)
        const workingInstances = instances
            .filter(url => {
                const instance = data.instances[url];
                return instance && 
                       instance.http && 
                       instance.http.status_code === 200 &&
                       !instance.network_type || instance.network_type === 'normal';
            })
            .slice(0, 20);
        
        instancesCache = workingInstances;
        cacheTimestamp = now;
        
        console.log(`Loaded ${workingInstances.length} SearXNG instances`);
        return workingInstances;
        
    } catch (error) {
        console.error('Error fetching SearXNG instances:', error);
        
        // Fallback to some known instances if fetch fails
        const fallbackInstances = [
            'https://baresearch.org/',
            'https://copp.gg/',
            'https://darmarit.org/searx/',
            'https://etsi.me/',
            'https://fairsuch.net/'
        ];
        
        instancesCache = fallbackInstances;
        cacheTimestamp = now;
        return fallbackInstances;
    }
}

/**
 * Select a random SearXNG instance
 * @returns {Promise<string>} Random instance URL
 */
async function getRandomInstance() {
    const instances = await fetchSearXNGInstances();
    const randomIndex = Math.floor(Math.random() * instances.length);
    return instances[randomIndex];
}

/**
 * Parse HTML search results from SearXNG
 * @param {string} html - HTML content from SearXNG
 * @returns {Array} Array of search results
 */
function parseSearchResults(html) {
    const results = [];
    
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        
        // SearXNG uses .result class for search results
        const resultElements = doc.querySelectorAll('.result');
        
        for (const result of resultElements) {
            try {
                // Extract title
                const titleElement = result.querySelector('h3 a, .result-title a, h3');
                const title = titleElement ? titleElement.textContent.trim() : '';
                
                if (!title) continue;
                
                // Extract URL
                const urlElement = result.querySelector('h3 a, .result-title a');
                const url = urlElement ? urlElement.href : '';
                
                if (!url || url.includes('javascript:')) continue;
                
                // Extract content/snippet
                const contentElement = result.querySelector('.result-content, .content, p');
                const content = contentElement ? contentElement.textContent.trim() : '';
                
                // Look for thumbnail
                let thumbnail = null;
                const imgElement = result.querySelector('img[src]');
                if (imgElement?.src && !imgElement.src.includes('data:image/gif')) {
                    thumbnail = imgElement.src;
                }
                
                results.push({
                    title: title,
                    url: url,
                    extract: content,
                    thumbnail: thumbnail,
                    timestamp: Date.now()
                });
                
            } catch (error) {
                console.warn('Error parsing individual search result:', error);
                continue;
            }
        }
        
    } catch (error) {
        console.error('Error parsing search results HTML:', error);
    }
    
    return results;
}

/**
 * Fetch search results using SearXNG
 * @param {string} query - The search query
 * @param {number} start - Starting result index (ignored, only first page)
 * @returns {Promise<Array>} Array of search results
 */
export async function fetchSearchResults(query, start = 0) {
    console.log("Fetching SearXNG results for:", query);
    
    try {
        const instanceUrl = await getRandomInstance();
        console.log("Using SearXNG instance:", instanceUrl);
        
        // Build search URL - most SearXNG instances use /search endpoint
        const searchUrl = new URL(instanceUrl);
        searchUrl.searchParams.set('q', query);
        searchUrl.searchParams.set('engines', 'google');
        searchUrl.searchParams.set('language', 'en');
        
        const headers = new Headers({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });
        
        const options = {
            method: 'GET',
            headers: headers,
            credentials: 'omit',
            signal: AbortSignal.timeout(CONFIG.GOOGLE_SEARCH_TIMEOUT || 15000)
        };
        
        const response = await fetch(searchUrl.toString(), options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        const results = parseSearchResults(html);
        
        console.log(`Successfully parsed ${results.length} SearXNG search results for "${query}"`);
        
        return results;
        
    } catch (error) {
        console.error(`Error fetching SearXNG results for "${query}":`, error);
        throw error;
    }
}

/**
 * Perform a search using SearXNG
 * @param {string} query - The search query
 * @param {number} start - Starting result index (ignored, only first page)
 * @returns {Promise<Object>} Search result object with query, results, and metadata
 */
export async function performSearch(query, start = 0) {
    try {
        const startTime = Date.now();
        const results = await fetchSearchResults(query, start);
        const endTime = Date.now();
        
        return {
            query: query,
            results: results,
            timestamp: startTime,
            duration: endTime - startTime,
            success: true,
            resultCount: results.length,
            start: 0 // Always first page
        };
        
    } catch (error) {
        console.error(`SearXNG search failed for "${query}":`, error.message);
        
        return {
            query: query,
            results: [],
            timestamp: Date.now(),
            duration: 0,
            success: false,
            error: {
                name: error?.name || 'UnknownError',
                message: error?.message || 'Unknown error occurred'
            },
            resultCount: 0,
            start: 0
        };
    }
}

// Legacy function names for backward compatibility
export const fetchGoogleResults = fetchSearchResults;
export const performGoogleSearch = performSearch;
