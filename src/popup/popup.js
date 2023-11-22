let value = 0;

const logListElement = document.querySelector('.log-list');

const retrieve = async (key) => {
  const promise = new Promise(resolve => {
    chrome.storage.local.get([key], resolve);
  });
  const result = await promise;
  return result[key];
}

const store = async (key, value) => {
  await chrome.storage.local.set({[key]: value});
}

// TODO: create different types of elements based on the result


const getItemPrefix = (item) => {
  let prefix = '❌';
  if (item.status >= 200 && item.status < 300) {
    prefix = '✅';
  } else if (item.error !== null && item.error.name === 'RobotsDenied') {
    prefix = '🤖';
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
  const linkElement = document.createElement('a');
  linkElement.href = item.url;
  linkElement.innerText = (item.content === null || !item.content.title) ? item.url : item.content.title;
  const prefix = getItemPrefix(item);
  logElement.textContent = `${hours}:${(minutes < 10 ? "0" : "") + minutes}:${(seconds < 10 ? "0" : "") + seconds} ${prefix} `;
  logElement.appendChild(linkElement);
  logListElement.prepend(logElement);
}

(async () => {
  const batch = await retrieve('batch');
  if (batch === undefined) {
    return;
  }
  batch.forEach(item => {
    createLogItem(item);
  });
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 2. A page requested user data, respond with a copy of `user`
  if (message.type === 'finish-crawl-url') {
    createLogItem(message.item);
  }
});

// Add a handler to the checkbox and store the preference in storage
const crawlToggle = document.querySelector('#crawl');
const googleToggle = document.querySelector('#google');

function getToggleHandler(toggle, key) {
  return async (e) => {
    const enabled = toggle.checked;
    await store(key, enabled);
    console.log("Stored value", key, enabled);
  }
}

function initializeToggle(element, key, defaultValue) {
  // If there is nothing in storage, default to true
  retrieve(key).then(value => {
    if (value === undefined) {
      value = defaultValue;
      store(key, value).then(() => {
        element.checked = value;
      });
    } else {
      element.checked = value;
    }

    // Wait 100 milliseconds then enable the animation
    setTimeout(() => {
      element.nextElementSibling.classList.add('initialized');
    }, 100);
  });
}

console.log("Initializing toggles");

crawlToggle.addEventListener('change', getToggleHandler(crawlToggle, 'crawl'));
googleToggle.addEventListener('change', getToggleHandler(googleToggle, 'google'));

initializeToggle(crawlToggle, 'crawl', true);
initializeToggle(googleToggle, 'google', false);
