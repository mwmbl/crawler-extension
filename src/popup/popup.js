import {retrieve, store} from "~/storage";

let value = 0;

const logListElement = document.querySelector('.log-list');

// TODO: create different types of elements based on the result


const getItemPrefix = (item) => {
  let prefix = '❌';
  if (item.status >= 200 && item.status < 300) {
    prefix = '✅';
  } else if (item.error !== null && item.error.name === 'NetworkError') {
    prefix = '🌐';
  } else if (item.error !== null && item.error.name === 'AbortError') {
    prefix = '⏰';
  } else if (item.status === 404) {
    prefix = '😵';
  }

  if (item.status !== null) {
    prefix += ' ' + item.status;
  }
  return prefix;
}



const createLogItem = (item) => {
  const logElement = document.createElement('li');
  logElement.classList.add(item.error !== null ? 'result-bad' : 'result-good');
  const time = new Date(item.timestamp);
  const hours = time.getHours()
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  
  const prefix = getItemPrefix(item);
  
  // Handle different types of items
  if (item.query) {
    const queryText = item.query;
    
    if (item.searchIndex !== undefined) {
      // This is a search result item
      const resultCount = item.resultCount || 0;
      const searchIndex = item.searchIndex;
      logElement.textContent = `${hours}:${(minutes < 10 ? "0" : "") + minutes}:${(seconds < 10 ? "0" : "") + seconds} ${prefix} Search ${searchIndex}/10: "${queryText}" (${resultCount} results)`;
    } else {
      // This is a query generation item
      const suggestionCount = item.suggestions ? item.suggestions.length : 0;
      logElement.textContent = `${hours}:${(minutes < 10 ? "0" : "") + minutes}:${(seconds < 10 ? "0" : "") + seconds} ${prefix} Query: "${queryText}" (${suggestionCount} suggestions)`;
    }
  } else {
    // This is a URL item (legacy)
    const linkElement = document.createElement('a');
    linkElement.href = item.url;
    linkElement.innerText = (item.content === null || !item.content.title) ? item.url : item.content.title;
    logElement.textContent = `${hours}:${(minutes < 10 ? "0" : "") + minutes}:${(seconds < 10 ? "0" : "") + seconds} ${prefix} `;
    logElement.appendChild(linkElement);
  }
  
  logListElement.prepend(logElement);
}

(async () => {
  // Load from event_history
  let events = await retrieve('event_history');
  
  if (!events || events.length === 0) {
    return;
  }
  
  // Display the most recent events (up to 20)
  // Reverse the order so most recent items appear at the top
  const recentEvents = events.slice(0, 20);
  recentEvents.reverse().forEach(item => {
    createLogItem(item);
  });
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle various message types
  if (message.type === 'finish-crawl-url' || 
      message.type === 'finish-query-generation' || 
      message.type === 'finish-search') {
    createLogItem(message.item);
  } else if (message.type === 'crawler-progress') {
    // Handle general crawler progress updates
    console.log('Crawler progress:', message.progressType, message.data);
  }
});

// Add a handler to the checkbox and store the preference in storage
const queryToggle = document.querySelector('#crawl'); // Reusing the crawl toggle for queries
const googleToggle = document.querySelector('#google');

function getToggleHandler(toggle, key) {
  return async (e) => {
    const enabled = toggle.checked;
    await store(key, enabled);
    console.log("Stored value", key, enabled);
  }
}

function initializeToggle(element, key) {
  // If there is nothing in storage, default to true
  retrieve(key).then(value => {
    element.checked = value;      

    // Wait 100 milliseconds then enable the animation
    setTimeout(() => {
      element.nextElementSibling.classList.add('initialized');
    }, 100);
  });
}

console.log("Initializing toggles");

queryToggle.addEventListener('change', getToggleHandler(queryToggle, 'generate_dataset'));
googleToggle.addEventListener('change', getToggleHandler(googleToggle, 'google'));

initializeToggle(queryToggle, 'generate_dataset');
initializeToggle(googleToggle, 'google');
