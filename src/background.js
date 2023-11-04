


chrome.runtime.onInstalled.addListener(() => {
  console.log("Installed");
  run();
});


chrome.runtime.onStartup.addListener(() => {
  console.log("Startup");
  run();
});


// TODO: this isn't being fired when the extension is enabled
chrome.management.onEnabled.addListener(() => {
  console.log("Enabled");
  run();
});

let worker = null;
function run() {
  // Create the worker if it's null
    if (!worker) {
        console.log("Starting worker");
        worker = new Worker('worker.js');
    }
    worker.postMessage({type: 'start'});
}

