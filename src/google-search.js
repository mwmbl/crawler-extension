
/**
 * Google Search Module - SearXNG-inspired implementation
 * Handles fetching and parsing Google search results using techniques from SearXNG
 */

import { CONFIG } from "./config.js";



// Detect if Google is showing CAPTCHA or sorry page
function detectGoogleSorry(response, text) {
    if (response.url.includes('sorry.google.com') || 
        response.url.includes('/sorry') ||
        text.includes('unusual traffic') ||
        text.includes('captcha')) {
        throw new Error('Google CAPTCHA detected - search blocked');
    }
}

// Extract text content from element, handling nested elements
function extractText(element) {
    if (!element) return '';
    
    // Remove script tags and their content
    const scripts = element.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // Get text content and clean it up
    return element.textContent?.trim().replace(/\s+/g, ' ') || '';
}

// Parse search results using SearXNG-inspired selectors
function parseSearchResults(doc) {
    const results = [];
    
    // Try multiple selectors that Google uses for search results
    const resultSelectors = [
        'div[jscontroller*="SC7lYd"]',  // SearXNG selector
        '.g',                          // Traditional selector
        '[data-ved]',                  // Alternative selector
        '.tF2Cxc'                      // Another common selector
    ];
    
    let resultElements = [];
    for (const selector of resultSelectors) {
        resultElements = doc.querySelectorAll(selector);
        if (resultElements.length > 0) {
            console.log(`Found ${resultElements.length} results using selector: ${selector}`);
            break;
        }
    }
    
    for (const result of resultElements) {
        try {
            // Try multiple title selectors
            const titleSelectors = ['h3', '.DKV0Md', '.LC20lb', '[role="heading"]'];
            let titleElement = null;
            let title = '';
            
            for (const selector of titleSelectors) {
                titleElement = result.querySelector(selector);
                if (titleElement) {
                    title = extractText(titleElement);
                    if (title) break;
                }
            }
            
            if (!title) continue;
            
            // Try multiple URL selectors
            const urlSelectors = ['a[href]', '.yuRUbf a', 'h3 a', '[data-ved] a'];
            let url = '';
            
            for (const selector of urlSelectors) {
                const urlElement = result.querySelector(selector);
                if (urlElement?.href && !urlElement.href.includes('google.com')) {
                    url = urlElement.href;
                    break;
                }
            }
            
            if (!url) continue;
            
            // Try multiple content/snippet selectors
            const contentSelectors = [
                'div[data-sncf="1"]',  // SearXNG selector
                '.VwiC3b',             // Common snippet selector
                '.s3v9rd',             // Alternative snippet
                '.st',                 // Classic snippet
                '[data-content-feature="1"]'
            ];
            
            let content = '';
            for (const selector of contentSelectors) {
                const contentElement = result.querySelector(selector);
                if (contentElement) {
                    content = extractText(contentElement);
                    if (content) break;
                }
            }
            
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
            console.warn('Error parsing search result:', error);
            continue;
        }
    }
    
    return results;
}

/**
 * Fetch Google search results using SearXNG-inspired approach
 * @param {string} query - The search query
 * @param {number} start - Starting result index (for pagination)
 * @returns {Promise<Array>} Array of search results
 */
export async function fetchGoogleResults(query, start = 0) {
    console.log("Fetching Google results for:", query);
    
    // Build search URL with SearXNG-inspired parameters
    const params = new URLSearchParams({
        q: query,
        hl: 'en-GB',           // Interface language
        lr: 'lang_en',         // Language restrict
        ie: 'utf8',            // Input encoding
        oe: 'utf8',            // Output encoding
        start: start.toString(),
        filter: '0',           // No filtering
        asearch: 'arc',        // Use arc search
    });
    
    const url = `https://www.google.com/search?${params.toString()}`;
    
    // Headers inspired by SearXNG
    const headers = new Headers({
        'Accept': '*/*',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
    });
    
    const options = {
        method: 'GET',
        headers: headers,
        credentials: 'omit',
        signal: AbortSignal.timeout(CONFIG.GOOGLE_SEARCH_TIMEOUT || 10000)
    };

    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        
        // Check for Google sorry/CAPTCHA page
        detectGoogleSorry(response, text);
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        
        const results = parseSearchResults(doc);
        
        console.log(`Successfully parsed ${results.length} Google search results for "${query}"`);
        
        return results;
        
    } catch (error) {
        console.error(`Error fetching Google results for "${query}":`, error);
        throw error;
    }
}

/**
 * Perform a Google search
 * @param {string} query - The search query
 * @param {number} start - Starting result index for pagination
 * @returns {Promise<Object>} Search result object with query, results, and metadata
 */
export async function performGoogleSearch(query, start = 0) {
    try {
        const startTime = Date.now();
        const results = await fetchGoogleResults(query, start);
        const endTime = Date.now();
        
        return {
            query: query,
            results: results,
            timestamp: startTime,
            duration: endTime - startTime,
            success: true,
            resultCount: results.length,
            start: start
        };
        
    } catch (error) {
        console.error(`Google search failed for "${query}":`, error.message);
        
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
            start: start
        };
    }
}

/**
 * Perform multiple pages of Google search results
 * @param {string} query - The search query
 * @param {number} maxPages - Maximum number of pages to fetch
 * @returns {Promise<Object>} Combined search results from all pages
 */
export async function performMultiPageGoogleSearch(query, maxPages = 3) {
    const allResults = [];
    let totalDuration = 0;
    let successfulPages = 0;
    const errors = [];
    
    for (let page = 0; page < maxPages; page++) {
        const start = page * 10; // Google shows 10 results per page
        
        try {
            console.log(`Fetching page ${page + 1}/${maxPages} for query: "${query}"`);
            const pageResult = await performGoogleSearch(query, start);
            
            if (pageResult.success && pageResult.results.length > 0) {
                allResults.push(...pageResult.results);
                totalDuration += pageResult.duration;
                successfulPages++;
            } else if (!pageResult.success) {
                errors.push({
                    page: page + 1,
                    error: pageResult.error
                });
                
                // If we hit a CAPTCHA, stop trying more pages
                if (pageResult.error.message.includes('CAPTCHA')) {
                    console.warn('CAPTCHA detected, stopping multi-page search');
                    break;
                }
            }
            
            // Add delay between pages to be respectful
            if (page < maxPages - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            }
            
        } catch (error) {
            console.error(`Error on page ${page + 1}:`, error);
            errors.push({
                page: page + 1,
                error: { name: error.name, message: error.message }
            });
        }
    }
    
    return {
        query: query,
        results: allResults,
        timestamp: Date.now(),
        duration: totalDuration,
        success: allResults.length > 0,
        resultCount: allResults.length,
        pagesRequested: maxPages,
        pagesSuccessful: successfulPages,
        errors: errors
    };
}
