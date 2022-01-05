let color = '#3aa757';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ color });
  console.log('Default background color set to %cbanana', `color: ${color}`);
  setUp();
});

chrome.runtime.onStartup.addListener(() => {
  setUp();
});


function setUp() {
    console.log("Starting up crawler extension");
//    chrome.alarms.onAlarm.addListener(runCrawlIteration);
//    chrome.alarms.create("crawlAlarm", {delayInMinutes: 1.0/60, periodInMinutes: 0.1});
    setInterval(runCrawlIteration, 1000);
}


function runCrawlIteration() {
  console.log("Running crawl iteration");
}
