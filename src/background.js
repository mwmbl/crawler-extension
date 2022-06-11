import {canVisit, parser} from "./robots";
import {getParagraphs} from "./justext";


const DOMAIN = 'https://api.crawler.mwmbl.org'
const CRAWLER_ONLINE_URL = DOMAIN;
const POST_BATCH_URL = DOMAIN + '/batches/';
const POST_NEW_BATCH_URL = DOMAIN + '/batches/new';
const NUM_SEED_DOMAINS = 100;
const MAX_NEW_LINKS = 30;
const TIMEOUT_MS = 3000;

const MAX_URL_LENGTH = 150;
const NUM_TITLE_CHARS = 65;
const NUM_EXTRACT_CHARS = 155;
const MAX_FETCH_SIZE = 1024*1024;
const BAD_URL_REGEX = /\/\/localhost\b|\.jpg$|\.png$|\.js$|\.gz$|\.zip$|\.pdf$|\.bz2$|\.ipynb$|\.py$/


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


function run() {
  const crawler = new Crawler();
  crawler.setUp();
}


function chooseRandom(array) {
  const d = Math.floor(Math.random()*array.length);
  return array[d];
}


async function isOnline() {
  try {
    const response = await fetch(CRAWLER_ONLINE_URL);
    return response.status === 200;
  } catch (e) {
    console.log("Error checking for online", e);
    return false;
  }
}


async function safeFetch(url) {
  const result = await fetch(url, {credentials: 'omit', signal: AbortSignal.timeout(TIMEOUT_MS)});
  const reader = result.body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      let size = 0;
      let completed = false;
      while (size < MAX_FETCH_SIZE) {
        const { done, value } = await reader.read();

        if (done) {
          completed = true;
          break;
        }

        controller.enqueue(value);

        size += value.length;
      }

      controller.close();
      reader.releaseLock();

      if (!completed) {
        console.log("Truncated stream when fetching URL", url);
      }
    }
  });
  const options = {
    status: result.status,
    statusText: result.statusText,
    headers: result.headers
  }
  return new Response(stream, options);
}


function errorResult(url, e) {
  return {
    'url': url,
    'status': null,
    'timestamp': Date.now(),
    'content': null,
    'error': {
      'name': e.name,
      'message': e.message,
    }
  };
}

class Crawler {
  constructor() {
    this.curatedDomains = [];
    this.domParser = new DOMParser();
    this.links = {};
    this.results = [];
    this.batches = [];
    this.visited = new Set();
  }

  async initialize() {
    const url = chrome.runtime.getURL('../../hn-top-domains.json');
    const response = await fetch(url);
    const data = await response.json();
    this.curatedDomains = new Set(Object.keys(data));
    // console.log("Loaded curated domains", this.curatedDomains);

    this.links = await this.retrieve('links');
    console.log("Storage links", this.links);
    if (!this.links) {
      await this.seedLinks();
    }

    this.batches = await this.retrieve('batches') || [];
    this.results = await this.retrieve('results') || [];
    this.visited = new Set(await this.retrieve('visited') || []);
  }

  async seedLinks() {
    this.links = {};
    for (let i = 0; i < NUM_SEED_DOMAINS; ++i) {
      const link = 'https://' + chooseRandom([...this.curatedDomains]);
      this.links[link] = 'curated';
    }
    await this.store('links', this.links);
  }

  async retrieve(key) {
    const promise = new Promise(resolve => {
      chrome.storage.local.get([key], resolve);
    });
    const result = await promise;
    return result[key];
  }

  async store(key, value) {
    await chrome.storage.local.set({[key]: value});
  }

  async setUp() {
    console.log("Starting up crawler extension");
    await this.initialize();
    while (true) {
      try {
        await this.runCrawlIteration();
      } catch (e) {
        console.log("Exception running crawl iteration", e);
      }
    }
  }

  async runCrawlIteration() {
    const onlineStatus = await isOnline();

    if (!onlineStatus) {
      return;
    }

    let userId = await this.getUserId();
    const response = await fetch(POST_NEW_BATCH_URL, {
        method: 'POST',
        cache: 'no-cache',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({user_id: userId})
      });
    const urlsToCrawl = await response.json();
    console.log("Got new batch of URLs to crawl", urlsToCrawl);

    const batchItems = [];
    for (let i=0; i<urlsToCrawl.length; ++i) {
      const item = await this.crawlURL(urlsToCrawl[i], 'api');
      batchItems.push(item);

      await this.store('batch', batchItems);

      chrome.runtime.sendMessage({
        type: 'finish-crawl-url',
        item
      });
    }

    await this.sendBatch(batchItems);
  }

  getUniqueDomains() {
    const domains = new Set();
    for (const url in this.links) {
      try {
        const domain = new URL(url).host;
        domains.add(domain);
      } catch (e) {
        // console.log("Found bad link", url);
        delete this.links[url];
      }
    }
    return domains;
  }

  async crawlURL(url) {
    if (! await this.robotsAllowed(url)) {
      return {
        'url': url,
        'status': null,
        'timestamp': Date.now(),
        'content': null,
        'error': {
          'name': 'RobotsDenied',
          'message': 'Robots do not allow this URL',
        }
      }
    }

    let response;
    try {
      response = await safeFetch(url);
    } catch (e) {
      console.log("Error fetching", url, e.name, e.message);
      return errorResult(url, e);
    }

    const responseText = response.ok ? await response.text() : null;
    if (!responseText) {
      return {
        'url': url,
        'status': response.status,
        'timestamp': Date.now(),
        'content': null,
        'error': {
          'name': 'NoResponseText',
          'message': 'Robots do not allow this URL',
        }
      }
    }

    const dom = this.domParser.parseFromString(responseText, 'text/html');
    const paragraphs = getParagraphs(dom, Node.TEXT_NODE);
    const goodParagraphs = paragraphs.filter(p => p.classType === 'good');

    let urlDomain;
    try {
      urlDomain = new URL(url).host;
    } catch(e) {
      // console.log("Unable to parse URL to get domain", url);
      return errorResult(url, e);
    }

    const newLinks = this.getNewLinks(goodParagraphs, urlDomain);
    if (newLinks.size > 0) {
      // console.log("Found new links from", url, newLinks);
    }

    let extract = '';
    for (let i = 0; i < goodParagraphs.length; ++i) {
      extract += ' ' + goodParagraphs[i].getText();
      if (extract.length > NUM_EXTRACT_CHARS) {
        break;
      }
    }

    extract = extract.trim()
    if (extract.length > NUM_EXTRACT_CHARS) {
      extract = extract.substring(0, NUM_EXTRACT_CHARS - 1) + '…';
    }

    let title = dom.title.trim();
    if (title.length > NUM_TITLE_CHARS) {
      title = title.substr(0, NUM_TITLE_CHARS - 1) + '…';
    }

    return {
      'url': url,
      'status': response.status,
      'timestamp': Date.now(),
      'content': {
        'title': title,
        'extract': extract,
        'links': [...newLinks]
      },
      'error': null
    }
  }

  getNewLinks(goodParagraphs, domain) {
    const sourceIsCurated = this.curatedDomains.has(domain);
    const newLinks = new Set();
    for (let i=0; i<goodParagraphs.length; ++i) {
      const p = goodParagraphs[i];
      if (p.links.length > 0) {
        for (let j=0; j<p.links.length; ++j) {
          const link = p.links[j];
          if (link.startsWith('http') && link.length <= MAX_URL_LENGTH) {
            if (link.search(BAD_URL_REGEX) >= 0) {
              // console.log("Found bad URL", link);
              continue;
            }

            let linkUrl;
            try {
              linkUrl = new URL(link);
            } catch(e) {
              continue;
            }

            // Only consider links to external domains
            // We can take any link from curated domains, and any link to curated domains
            if (linkUrl.host !== domain && (sourceIsCurated || this.curatedDomains.has(linkUrl.host))) {
              // Remove the hash fragment
              linkUrl.hash = '';
              newLinks.add(linkUrl.href);

              if (newLinks.size >= MAX_NEW_LINKS) {
                return newLinks;
              }
            }
          }
        }
      }
    }
    return newLinks;
  }

  async getUserId() {
    let userId = await this.retrieve('user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      await this.store('user_id', userId);
    }
    return userId;
  }

  async sendBatch(batchItems) {
    let userId = await this.getUserId();
    const batch = {
      'user_id': userId,
      'items': batchItems
    }
    console.log("Sending batch", batch);
    const response = await fetch(POST_BATCH_URL, {
      method: 'POST',
      cache: 'no-cache',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(batch)
    });
    const result = await response.json();
    console.log("Batch post result", result);
  }

  async robotsAllowed(url) {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      // console.log("Unable to parse URL to get robots.txt", e);
      return false;
    }

    // Always allow the root domain
    if (parsedUrl.pathname === '/') {
      return true;
    }

    const robotsUrl = parsedUrl.protocol + '//' + parsedUrl.host + '/robots.txt'
    let robotsResponse;
    try {
      robotsResponse = await safeFetch(robotsUrl);
    } catch (error) {
      // console.log("Error fetching robots", error);
      return true;
    }

    if (!robotsResponse.ok) {
      // console.log("Bad response", robotsResponse);
      return true;
    }

    let robotsTxt = await robotsResponse.text();
    const parsedRobots = parser(robotsTxt);
    // console.log("Parsed robots", parsedRobots);

    // console.log("Visit allowed", visitAllowed);
    return canVisit(url, 'Mwmbl', parsedRobots);
  }
}
