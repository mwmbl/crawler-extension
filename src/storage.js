const defaultValues = {
  'generate_dataset': true,
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

/**
 * Get or generate user ID for backend requests
 * @returns {Promise<string>} User ID
 */
export const getUserId = async () => {
  let userId = await retrieve('user_id');
  if (!userId) {
    userId = crypto.randomUUID();
    await store('user_id', userId);
  }
  return userId;
}
