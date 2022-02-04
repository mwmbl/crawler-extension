let value = 0;

const logListElement = document.querySelector('.log-list');

const retrieve = async (key) => {
  const promise = new Promise(resolve => {
    chrome.storage.local.get([key], resolve);
  });
  const result = await promise;
  return result[key];
}

const createLogItem = (log) => {
  const logElement = document.createElement('li');
  const time = new Date(log.timestamp);
  const hours = time.getHours()
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  console.log(time.getHours);
  logElement.textContent = `${hours}:${(minutes < 10 ? "0" : "") + minutes}:${(seconds < 10 ? "0" : "") + seconds} - ${log.url}`;
  logListElement.prepend(logElement);
}

(async () => {
  (await retrieve('logs')).forEach(log => {
    createLogItem(log);
  });
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 2. A page requested user data, respond with a copy of `user`
  if (message.type === 'start-crawl-url') {
    createLogItem(message.logs[message.logs.length - 1]);
  }
});