import {canVisit, parser} from "./robots";
import {getParagraphs} from "./justext";
import {retrieve, store} from "./storage";


const DOMAIN = 'https://mwmbl.org'
const CRAWLER_ONLINE_URL = DOMAIN + '/api/v1/crawler/';
const POST_BATCH_URL = DOMAIN + '/api/v1/crawler/batches/';
const POST_NEW_BATCH_URL = DOMAIN + '/api/v1/crawler/batches/new';
const NUM_SEED_DOMAINS = 100;
const MAX_LINKS = 500;
const TIMEOUT_MS = 3000;

const MAX_URL_LENGTH = 150;
const NUM_TITLE_CHARS = 65;
const NUM_EXTRACT_CHARS = 155;
const MAX_FETCH_SIZE = 1024*1024;
const BAD_URL_REGEX = /\/\/localhost\b|\.jpg$|\.png$|\.js$|\.gz$|\.zip$|\.pdf$|\.bz2$|\.ipynb$|\.py$/


onmessage = function(e) {
  console.log("Message received", e.data);
  if (e.data.type === 'start') {
      run();
  }
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
    // console.log("Error checking for online", e);
    return false;
  }
}


async function safeFetch(url) {
  const result = await fetch(url, {
    credentials: 'omit',
    headers: {
      // https://github.com/mwmbl/crawler-extension/issues/31
      'Accept-Language': 'en-GB,en-US;q=0.7,en;q=0.3'
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const reader = result.body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      let size = 0;
      while (size < MAX_FETCH_SIZE) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        controller.enqueue(value);

        size += value.length;
      }

      controller.close();
      reader.releaseLock();
    }
  });
  const options = {
    status: result.status,
    statusText: result.statusText,
    headers: result.headers,
    url: result.url,
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

    this.links = await retrieve('links');
    if (!this.links) {
      await this.seedLinks();
    }

    this.batches = await retrieve('batches') || [];
    this.results = await retrieve('results') || [];
    this.visited = new Set(await retrieve('visited') || []);
  }

  async seedLinks() {
    this.links = {};
    for (let i = 0; i < NUM_SEED_DOMAINS; ++i) {
      const link = 'https://' + chooseRandom([...this.curatedDomains]);
      this.links[link] = 'curated';
    }
    await store('links', this.links);
  }

  async setUp() {
    await this.initialize();
    while (true) {
      try {
        const crawl = await retrieve("crawl");
        if (crawl) {
          await this.runCrawlIteration();
        } else {
          // Sleep for 5s
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (e) {
        // console.log("Exception running crawl iteration", e);
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
    // console.log("Got new batch of URLs to crawl", urlsToCrawl);

    // If there are no URLs then sleep for 1 minute
    if (urlsToCrawl.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 60000));
      return;
    }

    const batchItems = [];
    for (let i=0; i<urlsToCrawl.length; ++i) {
      const crawl = await retrieve("crawl");
      if (!crawl) {
        break;
      }

      const item = await this.crawlURL(urlsToCrawl[i], 'api');
      batchItems.push(item);

      await store('batch', batchItems);

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
    let responseText;
    try {
      response = await safeFetch(url);
      responseText = response.ok ? await response.text() : null;
    } catch (e) {
      // console.log("Error fetching", url, e.name, e.message);
      return errorResult(url, e);
    }

    if (!responseText) {
      return {
        'url': url,
        'resolved_url': response.url,
        'status': response.status,
        'timestamp': Date.now(),
        'content': null,
        'error': {
          'name': 'NoResponseText',
          'message': 'No response found',
        }
      }
    }

    const dom = this.domParser.parseFromString(responseText, 'text/html');
    const paragraphs = getParagraphs(dom, Node.TEXT_NODE);
    const goodParagraphs = paragraphs.filter(p => p.classType === 'good');

    const links = this.getNewLinks(paragraphs);
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
      'resolved_url': response.url,
      'status': response.status,
      'timestamp': Date.now(),
      'content': {
        'title': title,
        'extract': extract,
        'link_details': links
      },
      'error': null
    }
  }

  getNewLinks(goodParagraphs) {
    const seenLinks = new Set();
    const links = [];
    for (let i=0; i<goodParagraphs.length; ++i) {
      const p = goodParagraphs[i];
      for (const [link, anchorText] of p.links.entries()) {
        if (link.startsWith('http') && link.length <= MAX_URL_LENGTH) {
          if (link.search(BAD_URL_REGEX) >= 0) {
            // console.log("Found bad URL", link);
            continue;
          }

          let linkUrl;
          try {
            linkUrl = new URL(link);
            linkUrl.hash = '';
            const linkType = p.classType === 'good' ? 'content' : 'nav';
            const url = linkUrl.href;
            if (!seenLinks.has(url)) {
              seenLinks.add(url);
              links.push({"url": url, "anchor_text": anchorText, "link_type": linkType});
            }
          } catch(e) {
            // We can't parse this one, just skip
          }

          if (links.length >= MAX_LINKS) {
            return links;
          }
        }
      }
    }
    return links;
  }

  async getUserId() {
    let userId = await retrieve('user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      await store('user_id', userId);
    }
    return userId;
  }

  async sendBatch(batchItems) {
    let userId = await this.getUserId();
    const batch = {
      'user_id': userId,
      'items': batchItems
    }
    // console.log("Sending batch", batch);
    const response = await fetch(POST_BATCH_URL, {
      method: 'POST',
      cache: 'no-cache',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(batch)
    });
    const result = await response.json();
    // console.log("Batch post result", result);
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

    try {
      let robotsTxt = await robotsResponse.text();
      const parsedRobots = parser(robotsTxt);
      return canVisit(url, 'Mwmbl', parsedRobots);
    } catch (e) {
      // console.log("Error retrieving robots text", e)
      return true;
    }
  }
}

let crawler = null;
function run() {
  if (crawler === null) {
    crawler = new Crawler();
    crawler.setUp();
  }
}
