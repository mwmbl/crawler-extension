/**
 * Google Autocomplete Query Generator
 * JavaScript version of the Python query generation system
 */

// Configuration
const SEED_TERMS = new Set(['wikipedia']);
const NUM_QUERIES = 10; // Reduced for testing
const GOOGLE_SUGGEST_ENDPOINT = 'https://suggestqueries.google.com/complete/search';

/**
 * Add suggestion words to terms set for future queries
 * @param {Array} suggestions - Array of suggestion strings
 * @param {Set} terms - Set to add words to
 */
export function addSuggestionWordsToTerms(suggestions, terms) {
    for (const suggestion of suggestions) {
        const words = suggestion.toLowerCase().split(/\s+/);
        for (const word of words) {
            if (word.length > 1) { // Skip single characters
                terms.add(word);
            }
        }
    }
}

/**
 * Extract random sample of terms from dataset suggestions
 * @param {Array} dataset - Dataset with suggestion entries
 * @param {number} sampleSize - Number of terms to sample (default 50)
 * @returns {Array} Array of sampled terms
 */
export function extractSeedTermsFromDataset(dataset, sampleSize = 50) {
    if (!dataset || dataset.length === 0) {
        return [];
    }

    // Extract all unique suggestions from the dataset
    const allSuggestions = [...new Set(dataset.map(item => item.suggestion))];
    
    if (allSuggestions.length === 0) {
        return [];
    }

    // Use the same logic as addSuggestionWordsToTerms
    const terms = new Set();
    addSuggestionWordsToTerms(allSuggestions, terms);

    // Convert to array and shuffle
    const wordsArray = Array.from(terms);
    
    if (wordsArray.length === 0) {
        return [];
    }

    // Shuffle the array using Fisher-Yates algorithm
    for (let i = wordsArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wordsArray[i], wordsArray[j]] = [wordsArray[j], wordsArray[i]];
    }

    // Take up to sampleSize random terms
    return wordsArray.slice(0, Math.min(sampleSize, wordsArray.length));
}

class QueryGenerator {
    constructor(seedTerms = SEED_TERMS, numQueries = NUM_QUERIES, progressCallback = null) {
        this.seedTerms = new Set(seedTerms);
        this.numQueries = numQueries;
        this.dataset = [];
        this.doneQueries = new Set();
        this.terms = new Set(seedTerms);
        this.random = Math.random; // Simple random for now
        this.progressCallback = progressCallback;
    }

    /**
     * Retrieve suggestions from Google's autocomplete API
     */
    async retrieveSuggestions(query) {
        try {
            const url = `${GOOGLE_SUGGEST_ENDPOINT}?client=chrome&q=${encodeURIComponent(query)}&hl=en&gl=gb`;
            
            // Note: This might face CORS issues in browser. In extension context, this should work.
            const response = await fetch(url, {
                credentials: 'omit',
                mode: 'cors',
                headers: {
                    'Accept-Language': 'en-GB,en;q=0.9'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            
            // Google returns JSONP format, we need to extract the JSON
            // Format is typically: ["query",["suggestion1","suggestion2",...]]
            const jsonMatch = text.match(/\[.*\]/);
            if (!jsonMatch) {
                throw new Error('Invalid response format');
            }
            
            const data = JSON.parse(jsonMatch[0]);
            const suggestions = data[1] || [];
            
            console.log(`Got ${suggestions.length} suggestions for "${query}":`, suggestions);
            return suggestions;
            
        } catch (error) {
            console.error(`Error getting suggestions for "${query}":`, error);
            return [];
        }
    }

    /**
     * Query type: return full term
     */
    fullTerm(term) {
        return term;
    }

    /**
     * Query type: return first two characters
     */
    firstTwoCharacters(term) {
        return term.substring(0, 2);
    }

    /**
     * Choose random item from array
     */
    chooseRandom(array) {
        return array[Math.floor(this.random() * array.length)];
    }

    /**
     * Create the dataset by iteratively expanding queries
     */
    async createDataset() {
        console.log(`Starting dataset creation with ${this.terms.size} seed terms`);
        console.log('Seed terms:', Array.from(this.terms));
        
        while (this.doneQueries.size < this.numQueries) {
            // Choose random term and query type
            const term = this.chooseRandom(Array.from(this.terms));
            const queryType = this.chooseRandom([this.fullTerm, this.firstTwoCharacters]);
            const query = queryType.call(this, term);

            // Skip if already done
            if (this.doneQueries.has(query)) {
                continue;
            }

            console.log(`\nProcessing query ${this.doneQueries.size + 1}/${this.numQueries}: "${query}"`);

            try {
                const suggestions = await this.retrieveSuggestions(query);
                
                // Add to dataset
                for (const suggestion of suggestions) {
                    this.dataset.push({
                        query: query,
                        suggestion: suggestion,
                        source_term: term,
                        timestamp: Date.now()
                    });
                }

                // Mark as done
                this.doneQueries.add(query);

                // Add suggestion words to terms for future queries
                addSuggestionWordsToTerms(suggestions, this.terms);

                console.log(`Added ${suggestions.length} suggestions. Total terms: ${this.terms.size}`);

                // Call progress callback if provided
                if (this.progressCallback) {
                    this.progressCallback({
                        query: query,
                        suggestions: suggestions,
                        current: this.doneQueries.size,
                        total: this.numQueries,
                        totalTerms: this.terms.size,
                        totalDatasetEntries: this.dataset.length,
                        sourceTerm: term
                    });
                }

                // Small delay to be respectful to Google's servers
                await this.delay(100);

            } catch (error) {
                console.error(`Error processing query "${query}":`, error);
                
                // Call progress callback for errors too
                if (this.progressCallback) {
                    this.progressCallback({
                        query: query,
                        suggestions: [],
                        current: this.doneQueries.size,
                        total: this.numQueries,
                        totalTerms: this.terms.size,
                        totalDatasetEntries: this.dataset.length,
                        sourceTerm: term,
                        error: error
                    });
                }
                break;
            }
        }

        console.log(`\nDataset creation complete!`);
        console.log(`Total queries processed: ${this.doneQueries.size}`);
        console.log(`Total dataset entries: ${this.dataset.length}`);
        console.log(`Final term count: ${this.terms.size}`);

        return this.dataset;
    }

    /**
     * Simple delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Save dataset to JSON (for testing)
     */
    saveDataset(filename = 'queries_dataset.json') {
        const dataStr = JSON.stringify(this.dataset, null, 2);
        
        // In browser environment, we can create a download
        if (typeof window !== 'undefined') {
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } else {
            // In Node.js environment
            const fs = require('fs');
            fs.writeFileSync(filename, dataStr);
        }
        
        console.log(`Dataset saved to ${filename}`);
    }

    /**
     * Get statistics about the dataset
     */
    getStats() {
        const uniqueQueries = new Set(this.dataset.map(item => item.query)).size;
        const uniqueSuggestions = new Set(this.dataset.map(item => item.suggestion)).size;
        
        return {
            totalEntries: this.dataset.length,
            uniqueQueries: uniqueQueries,
            uniqueSuggestions: uniqueSuggestions,
            totalTerms: this.terms.size,
            processedQueries: this.doneQueries.size
        };
    }
}

/**
 * Main function to run the query generation
 */
async function run() {
    console.log('Starting Google Autocomplete Query Generator...');
    
    const generator = new QueryGenerator();
    
    try {
        const dataset = await generator.createDataset();
        
        // Show statistics
        const stats = generator.getStats();
        console.log('\n=== Final Statistics ===');
        console.log(`Total dataset entries: ${stats.totalEntries}`);
        console.log(`Unique queries: ${stats.uniqueQueries}`);
        console.log(`Unique suggestions: ${stats.uniqueSuggestions}`);
        console.log(`Total terms collected: ${stats.totalTerms}`);
        
        // Save the dataset
        generator.saveDataset();
        
        return dataset;
        
    } catch (error) {
        console.error('Error running query generator:', error);
    }
}

// Export for use in other modules (ES6 and CommonJS)
export { QueryGenerator, run };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QueryGenerator, run, addSuggestionWordsToTerms, extractSeedTermsFromDataset };
}

// Auto-run if this is the main script
if (typeof window !== 'undefined' && window.location) {
    // Browser environment - don't auto-run, let user trigger it
    window.QueryGenerator = QueryGenerator;
    window.runQueryGenerator = run;
} else if (typeof require !== 'undefined' && require.main === module) {
    // Node.js environment - auto-run
    run();
}
