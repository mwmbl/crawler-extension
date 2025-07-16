/**
 * Daily Scheduler Module
 * Manages daily cycles, timing, and orchestrates the crawler workflow
 */

import { QueryGenerator } from "./queries.js";
import { performGoogleSearch } from "./google-search.js";
import { 
    isNewDay, 
    initializeNewDay, 
    storeDailyQueryDataset, 
    getRandomQuery,
    addSearchResult,
    isDailyQuotaComplete,
    markDailyComplete,
    isDailyComplete,
    canPerformNextSearch,
    getTimeUntilNextSearch,
    packageDataForBackend,
    storeUnsentData,
    hasUnsentData,
    getUnsentData,
    clearUnsentData,
    getStatusSummary
} from "./data-manager.js";
import { transmitCrawlerData} from "./backend.js";
import { retrieve, store } from "./storage.js";
import { CONFIG } from "./config.js";

/**
 * Main Daily Scheduler Class
 * Orchestrates the entire daily workflow
 */
export class DailyScheduler {
    constructor() {
        this.isRunning = false;
        this.searchTimer = null;
        this.statusCheckTimer = null;
        this.progressCallback = null;
    }

    /**
     * Set progress callback for UI updates
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    /**
     * Send progress update to UI
     */
    sendProgressUpdate(type, data) {
        if (this.progressCallback) {
            this.progressCallback({
                type: type,
                data: data,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Start the daily scheduler
     */
    async start() {
        if (this.isRunning) {
            console.log('Daily scheduler is already running');
            return;
        }

        this.isRunning = true;
        console.log('Starting Daily Scheduler...');

        try {
            // Check if extension is enabled for query generation
            const generateQueries = await retrieve("generate_dataset");
            if (!generateQueries) {
                console.log('Query generation is disabled');
                this.isRunning = false;
                return;
            }

            await this.runDailyCycle();
        } catch (error) {
            console.error('Error in daily scheduler:', error);
            this.isRunning = false;
        }
    }

    /**
     * Stop the daily scheduler
     */
    stop() {
        console.log('Stopping Daily Scheduler...');
        this.isRunning = false;
        
        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
            this.searchTimer = null;
        }
        
        if (this.statusCheckTimer) {
            clearTimeout(this.statusCheckTimer);
            this.statusCheckTimer = null;
        }
    }

    /**
     * Main daily cycle logic
     */
    async runDailyCycle() {
        while (this.isRunning) {
            try {
                // Check if we need to start a new day
                if (await isNewDay()) {
                    console.log('New day detected, initializing...');
                    await this.handleNewDay();
                }

                // Check for unsent data from previous day
                if (await hasUnsentData()) {
                    console.log('Found unsent data from previous day');
                    await this.handleUnsentData();
                }

                // Check if daily cycle is complete
                if (await isDailyComplete()) {
                    console.log('Daily cycle is complete, waiting for next day...');
                    await this.waitForNextDay();
                    continue;
                }

                // Generate daily query dataset if needed
                const dataset = await retrieve('daily_query_dataset');
                if (!dataset || dataset.length === 0) {
                    console.log('Generating daily query dataset...');
                    await this.generateDailyQueryDataset();
                }

                // Start search cycle
                await this.runSearchCycle();

            } catch (error) {
                console.error('Error in daily cycle:', error);
                await this.delay(60000); // Wait 1 minute before retrying
            }
        }
    }

    /**
     * Handle new day initialization
     */
    async handleNewDay() {
        await initializeNewDay();
        this.sendProgressUpdate('new-day', {
            message: 'New day initialized, starting fresh cycle'
        });
    }

    /**
     * Handle unsent data from previous day
     */
    async handleUnsentData() {
        try {
            const unsentData = await getUnsentData();
            if (!unsentData) return;

            console.log('Attempting to send unsent data...');
            this.sendProgressUpdate('sending-unsent', {
                message: 'Sending unsent data from previous day'
            });

            const result = await transmitCrawlerData(unsentData);
            
            if (result.success) {
                await clearUnsentData();
                console.log('Successfully sent unsent data');
                this.sendProgressUpdate('unsent-sent', {
                    message: 'Unsent data successfully transmitted'
                });
            } else {
                console.warn('Failed to send unsent data, will retry later');
                this.sendProgressUpdate('unsent-failed', {
                    message: 'Failed to send unsent data, will retry later',
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Error handling unsent data:', error);
        }
    }

    /**
     * Generate daily query dataset
     */
    async generateDailyQueryDataset() {
        try {
            this.sendProgressUpdate('generating-dataset', {
                message: 'Generating daily query dataset...'
            });

            // Get configuration from storage or use defaults from config
            const storedSeedTerms = await retrieve('seed_terms');
            const seedTerms = storedSeedTerms || CONFIG.DEFAULT_SEED_TERMS;
            
            const storedNumQueries = await retrieve('num_queries');
            const numQueries = storedNumQueries || CONFIG.DEFAULT_NUM_QUERIES;

            // Create progress callback for query generation
            const queryProgressCallback = (progressData) => {
                this.sendProgressUpdate('query-generation-progress', {
                    query: progressData.query,
                    current: progressData.current,
                    total: progressData.total,
                    suggestions: progressData.suggestions.length,
                    error: progressData.error
                });
            };

            // Generate the dataset
            const queryGenerator = new QueryGenerator(seedTerms, numQueries, queryProgressCallback);
            const dataset = await queryGenerator.createDataset();

            // Store the dataset
            await storeDailyQueryDataset(dataset);

            console.log(`Daily query dataset generated: ${dataset.length} entries`);
            this.sendProgressUpdate('dataset-complete', {
                message: `Daily query dataset generated with ${dataset.length} entries`,
                datasetSize: dataset.length
            });

        } catch (error) {
            console.error('Error generating daily query dataset:', error);
            this.sendProgressUpdate('dataset-error', {
                message: 'Error generating daily query dataset',
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Run the search cycle (configurable searches with configurable intervals)
     */
    async runSearchCycle() {
        while (this.isRunning && !(await isDailyQuotaComplete()) && !(await isDailyComplete())) {
            try {
                // Check if we can perform the next search
                if (await canPerformNextSearch()) {
                    await this.performSingleSearch();
                    
                    // Check if we've completed the quota
                    if (await isDailyQuotaComplete()) {
                        await this.completeDailyQuota();
                        break;
                    }
                }

                // Wait for next search opportunity
                const timeUntilNext = await getTimeUntilNextSearch();
                if (timeUntilNext > 0) {
                    console.log(`Waiting ${Math.round(timeUntilNext / 1000)}s until next search...`);
                    await this.delay(Math.min(timeUntilNext, 60000)); // Check every minute max
                }

            } catch (error) {
                console.error('Error in search cycle:', error);
                await this.delay(60000); // Wait 1 minute before retrying
            }
        }
    }

    /**
     * Perform a single Google search
     */
    async performSingleSearch() {
        try {
            // Get a random query from the dataset
            const query = await getRandomQuery();
            
            console.log(`Performing Google search for: "${query}"`);
            this.sendProgressUpdate('search-start', {
                query: query,
                message: `Searching Google for: "${query}"`
            });

            // Perform the search
            const searchResult = await performGoogleSearch(query);
            
            // Add the result to storage
            const searchIndex = await addSearchResult(searchResult);
            
            console.log(`Search ${searchIndex}/${CONFIG.SEARCHES_PER_DAY} completed for "${query}" - ${searchResult.success ? 'Success' : 'Failed'}`);
            
            this.sendProgressUpdate('search-complete', {
                query: query,
                searchIndex: searchIndex,
                success: searchResult.success,
                resultCount: searchResult.resultCount,
                error: searchResult.error,
                message: `Search ${searchIndex}/${CONFIG.SEARCHES_PER_DAY} completed`
            });

        } catch (error) {
            console.error('Error performing single search:', error);
            this.sendProgressUpdate('search-error', {
                message: 'Error performing search',
                error: error.message
            });
        }
    }

    /**
     * Complete the daily quota and send data to backend
     */
    async completeDailyQuota() {
        try {
            console.log('Daily search quota completed, preparing data for backend...');
            this.sendProgressUpdate('quota-complete', {
                message: 'Daily search quota completed, preparing data...'
            });

            // Package data for backend
            const packagedData = await packageDataForBackend();
            
            // Send to backend
            this.sendProgressUpdate('sending-backend', {
                message: 'Sending data to backend...'
            });

            const result = await transmitCrawlerData(packagedData);
            
            if (result.success) {
                console.log('Successfully sent data to backend');
                await markDailyComplete();
                
                this.sendProgressUpdate('backend-success', {
                    message: 'Data successfully sent to backend',
                    dataSize: result.dataSize,
                    duration: result.duration
                });
            } else {
                console.error('Failed to send data to backend:', result.error);
                
                // Store as unsent data for later retry
                await storeUnsentData(packagedData);
                await markDailyComplete(); // Still mark as complete to avoid regenerating
                
                this.sendProgressUpdate('backend-failed', {
                    message: 'Failed to send data to backend, stored for later retry',
                    error: result.error
                });
            }

        } catch (error) {
            console.error('Error completing daily quota:', error);
            this.sendProgressUpdate('quota-error', {
                message: 'Error completing daily quota',
                error: error.message
            });
        }
    }

    /**
     * Wait for the next day
     */
    async waitForNextDay() {
        // Check every hour if it's a new day
        const oneHour = 60 * 60 * 1000;
        
        while (this.isRunning && !(await isNewDay())) {
            await this.delay(oneHour);
        }
    }

    /**
     * Get current status
     */
    async getStatus() {
        return await getStatusSummary();
    }

    /**
     * Simple delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
export const dailyScheduler = new DailyScheduler();
