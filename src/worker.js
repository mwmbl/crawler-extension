import { retrieve, store } from "./storage.js";
import { dailyScheduler } from "./scheduler.js";

onmessage = function(e) {
  console.log("Message received", e.data);
  if (e.data.type === 'start') {
      run();
  }
}

class DailyCrawlerManager {
  constructor() {
    this.isRunning = false;
  }

  async setUp() {
    while (true) {
      try {
        const generateQueries = await retrieve("generate_dataset");
        if (generateQueries && !this.isRunning) {
          await this.startDailyScheduler();
        } else {
          // Sleep for 30s when disabled
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      } catch (e) {
        console.log("Exception running daily crawler:", e);
        this.isRunning = false;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
  }

  async startDailyScheduler() {
    if (this.isRunning) {
      console.log("Daily scheduler is already running");
      return;
    }

    this.isRunning = true;
    console.log("Starting daily crawler scheduler...");

    try {
      // Set up progress callback for UI updates
      dailyScheduler.setProgressCallback((progressData) => {
        this.sendProgressUpdate(progressData);
      });

      // Start the daily scheduler
      await dailyScheduler.start();
      
    } catch (error) {
      console.error("Error in daily scheduler:", error);
    } finally {
      this.isRunning = false;
    }
  }

  async sendProgressUpdate(progressData) {
    try {
      let eventItem = null;
      
      // Handle different types of progress updates
      switch (progressData.type) {
        case 'query-generation-progress':
          eventItem = {
            query: progressData.data.query,
            timestamp: progressData.timestamp,
            status: progressData.data.error ? null : (progressData.data.suggestions > 0 ? 200 : 404),
            suggestions: new Array(progressData.data.suggestions).fill('suggestion'), // Placeholder
            error: progressData.data.error ? {
              name: 'QueryError',
              message: progressData.data.error
            } : null
          };
          
          // Send query generation progress (compatible with existing popup)
          chrome.runtime.sendMessage({
            type: 'finish-query-generation',
            item: eventItem,
            progress: {
              current: progressData.data.current,
              total: progressData.data.total,
              totalSuggestions: progressData.data.suggestions,
              totalTerms: 0,
              totalDatasetEntries: 0
            }
          });
          break;

        case 'search-complete':
          eventItem = {
            query: progressData.data.query,
            timestamp: progressData.timestamp,
            status: progressData.data.success ? 200 : 500,
            searchIndex: progressData.data.searchIndex,
            resultCount: progressData.data.resultCount,
            error: progressData.data.error || null
          };
          
          // Send search completion update
          chrome.runtime.sendMessage({
            type: 'finish-search',
            item: eventItem
          });
          break;

        case 'dataset-complete':
          // Dataset processing complete
          break;

        default:
          // Send generic progress update
          chrome.runtime.sendMessage({
            type: 'crawler-progress',
            progressType: progressData.type,
            data: progressData.data,
            timestamp: progressData.timestamp
          });
      }
      
      // Store individual events persistently for popup display
      if (eventItem) {
        await this.addEventToHistory(eventItem);
      }
    } catch (error) {
      console.error('Error sending progress update:', error);
    }
  }

  async addEventToHistory(eventItem) {
    try {
      // Get existing event history
      const eventHistory = await retrieve('event_history') || [];
      
      // Add new event to the beginning of the array
      eventHistory.unshift(eventItem);
      
      // Keep only the last 50 events to prevent storage bloat
      const trimmedHistory = eventHistory.slice(0, 50);
      
      // Store the updated history
      await store('event_history', trimmedHistory);
    } catch (error) {
      console.error('Error adding event to history:', error);
    }
  }


  stop() {
    console.log("Stopping daily crawler manager...");
    this.isRunning = false;
    dailyScheduler.stop();
  }
}

let crawlerManager = null;
function run() {
  if (crawlerManager === null) {
    crawlerManager = new DailyCrawlerManager();
    crawlerManager.setUp();
  }
}
