import {retrieve, store} from "./storage";
import {QueryGenerator} from "./queries.js";

onmessage = function(e) {
  console.log("Message received", e.data);
  if (e.data.type === 'start') {
      run();
  }
}

class QueryDatasetGenerator {
  constructor() {
    this.queryGenerator = null;
    this.isRunning = false;
  }

  async setUp() {
    while (true) {
      try {
        const generateQueries = await retrieve("generate_queries");
        if (generateQueries && !this.isRunning) {
          await this.runQueryGeneration();
        } else {
          // Sleep for 5s
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (e) {
        console.log("Exception running query generation", e);
        this.isRunning = false;
      }
    }
  }

  async runQueryGeneration() {
    this.isRunning = true;
    console.log("Starting query dataset generation...");

    try {
      // Get seed terms from storage or use defaults
      const storedSeedTerms = await retrieve('seed_terms');
      const seedTerms = storedSeedTerms || ['wikipedia', 'github', 'stackoverflow', 'reddit', 'youtube', 'amazon', 'google', 'facebook'];
      
      // Get number of queries from storage or use default
      const storedNumQueries = await retrieve('num_queries');
      const numQueries = storedNumQueries || 50;
      
      // Create progress callback function
      const progressCallback = (progressData) => {
        // Send progress update to popup with actual suggestions
        chrome.runtime.sendMessage({
          type: 'finish-query-generation',
          item: {
            query: progressData.query,
            timestamp: Date.now(),
            status: progressData.error ? null : (progressData.suggestions.length > 0 ? 200 : 404),
            suggestions: progressData.suggestions,
            error: progressData.error ? {
              name: progressData.error.name,
              message: progressData.error.message
            } : null
          },
          progress: {
            current: progressData.current,
            total: progressData.total,
            totalSuggestions: progressData.suggestions.length,
            totalTerms: progressData.totalTerms,
            totalDatasetEntries: progressData.totalDatasetEntries
          }
        });
      };

      // Create QueryGenerator with progress callback
      this.queryGenerator = new QueryGenerator(seedTerms, numQueries, progressCallback);

      // Run the dataset creation
      const dataset = await this.queryGenerator.createDataset();
      
      // Store the final dataset
      await store('query_dataset', dataset);
      await store('batch', dataset.slice(-10)); // Store last 10 for popup display
      
      console.log(`Query generation complete! Generated ${dataset.length} total entries.`);

    } catch (error) {
      console.error("Error during query generation:", error);
    } finally {
      this.isRunning = false;
    }
  }
}

let queryGenerator = null;
function run() {
  if (queryGenerator === null) {
    queryGenerator = new QueryDatasetGenerator();
    queryGenerator.setUp();
  }
}
