import {canVisit, parser} from "./robots";
import {getParagraphs} from "./justext";


const CRAWLER_ONLINE_URL = 'https://api.crawler.mwmbl.org';
const POST_BATCH_URL = 'https://api.crawler.mwmbl.org/batches/';
const NUM_SEED_DOMAINS = 100;
const MAX_NEW_LINKS = 30;
const MAX_STORAGE_LINKS = 5000;
const BATCH_SIZE = 20;
const MIN_UNIQUE_DOMAINS = 10;
const MAX_VISITED = 10000;

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
  const result = await fetch(url, {credentials: 'omit'});
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
  return new Response(stream);
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
      await this.runCrawlIteration();
    }
  }

  async runCrawlIteration() {
    const onlineStatus = await isOnline();

    if (!onlineStatus) {
      return;
    }

    // TODO: Check the number of unique domains. If we don't have enough, scrap what's there and seed again.
    //       This prevents getting stuck in a loop of two domains pointing at each other.
    const uniqueDomains = this.getUniqueDomains();
    if (uniqueDomains.size <= MIN_UNIQUE_DOMAINS) {
      // console.log("Run out of links, seeding again", uniqueDomains);
      await this.seedLinks();
    }

    // console.log("Choosing URL, num links:", Object.keys(this.links).length)
    const chosenLink = chooseRandom(Object.keys(this.links))
    // console.log("Crawling url", chosenLink, this.links[chosenLink]);

    const log = {
      timestamp: Date.now(),
      url: chosenLink
    }

    let logs = await this.retrieve('logs');
    logs = logs ? [...logs.slice(-9), log] : [log];

    await this.store('logs', logs);

    chrome.runtime.sendMessage({
      type: 'start-crawl-url',
      logs,
    });

    // Remember what we crawl so we don't crawl it again
    this.visited.add(chosenLink);

    await this.crawlURL(chosenLink, this.links[chosenLink]);

    // Remove the URL we've just crawled
    delete this.links[chosenLink];
    await this.store('links', this.links);

    if (this.visited.size > MAX_VISITED) {
      const randomVisited = chooseRandom([...this.visited]);
      this.visited.delete(randomVisited);
    }
    // console.log("Visited", this.visited);
    await this.store('visited', [...this.visited]);
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

  async crawlURL(url, source) {
    if (! await this.robotsAllowed(url)) {
      return;
    }

    let response;
    try {
      response = await safeFetch(url);
    } catch (e) {
      // console.log("Error fetching", url, e);
      return;
    }

    const responseText = response.ok ? await response.text() : null;
    if (!responseText) {
      return;
    }

    const dom = this.domParser.parseFromString(responseText, 'text/html');
    const paragraphs = getParagraphs(dom, Node.TEXT_NODE);
    const goodParagraphs = paragraphs.filter(p => p.classType === 'good');

    let urlDomain;
    try {
      urlDomain = new URL(url).host;
    } catch(e) {
      // console.log("Unable to parse URL to get domain", url);
      return;
    }

    const newLinks = this.getNewLinks(goodParagraphs, urlDomain);
    if (newLinks.size > 0) {
      // console.log("Found new links from", url, newLinks);
    }

    newLinks.forEach(link => {
      if (!this.visited.has(link)) {
        this.links[link] = url;
      }
    });

    // Make sure we don't store too much
    while (Object.keys(this.links).length > MAX_STORAGE_LINKS) {
      const link = chooseRandom(Object.keys(this.links));
      delete this.links[link];
    }

    if (dom.title && goodParagraphs.length > 0) {
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

      const result = {
        'timestamp': Date.now(),
        'source': source,
        'url': url,
        'title': title,
        'extract': extract,
        'links': [...newLinks]
      }
      await this.recordNewResult(result);
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
              // console.log("Unable to parse URL", e);
              continue;
            }

            // Only consider links to external domains
            // We can take any link from curated domains, and any link to curated domains
            if (linkUrl.host !== domain && (sourceIsCurated || this.curatedDomains.has(linkUrl.host))) {
              // Remove the hash fragment
              linkUrl.hash = '';
              newLinks.add(linkUrl.href);

              // Add the root URL, but only if there isn't already a version with '/' on the end
              const rootUrl = linkUrl.protocol + '//' + linkUrl.host;
              const rootUrlWithSlash = rootUrl + '/';
              if (!newLinks.has(rootUrlWithSlash) && !(rootUrlWithSlash in this.links)) {
                newLinks.add(rootUrl);
              }

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

  async recordNewResult(result) {
    // console.log("Recording new result", result);
    this.results.push(result);
    if (this.results.length >= BATCH_SIZE) {
      this.batches.push(this.results);
      this.results = [];
    }

    await this.store('batches', this.batches);
    await this.store('results', this.results);
    await this.sendBatch();
  }

  async getUserId() {
    let userId = await this.retrieve('user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      await this.store('user_id', userId);
    }
    return userId;
  }

  async sendBatch() {
    if (this.batches.length > 0) {
      const batchItems = this.batches.pop();
      // console.log("Sending batch with first item", Date.now(), batchItems[0]['url'])
      let userId = await this.getUserId();
      const batch = {
        'user_id': userId,
        'items': batchItems
      }
      const response = await fetch(POST_BATCH_URL, {
        method: 'POST',
        // mode: 'cors',
        cache: 'no-cache',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(batch)
      });
      const result = await response.json();
      // console.log("Batch post result", result);
      if (result['status'] === 'ok') {
        await this.store('batches', this.batches);
      } else {
        // Saving the batch failed, so put it back on our list
        this.batches.push(batchItems);
      }
    }
  }

  async robotsAllowed(url) {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      // console.log("Unable to parse URL to get robots.txt", e);
      return false;
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

    const visitAllowed = canVisit(url, 'Mwmbl', parsedRobots);
    // console.log("Visit allowed", visitAllowed);
    return visitAllowed;
  }
}
