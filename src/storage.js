const defaultValues = {
  'crawl': true,
  'google': false,
}


export const retrieve = async (key) => {
  const promise = new Promise(resolve => {
    chrome.storage.local.get([key], resolve);
  });
  const result = await promise;

  if (result[key] === undefined) {
    return defaultValues[key];
  }

  return result[key];
}
export const store = async (key, value) => {
  await chrome.storage.local.set({[key]: value});
}