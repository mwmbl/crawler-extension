import {canVisit, parser} from "./robots";
import {getParagraphs} from "./justext";


const POST_BATCH_URL = 'https://crawler-server-oq4r5q2hsq-ue.a.run.app/batches/';
const MAX_NEW_LINKS = 20;
const MAX_STORAGE_LINKS = 5000;
const BATCH_SIZE = 20;

const MAX_URL_LENGTH = 150
const NUM_TITLE_CHARS = 65
const NUM_EXTRACT_CHARS = 155
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


function getDomain(url) {
  const urlDomain = new URL(url).host;
  return urlDomain;
}

class Crawler {
  constructor() {
    this.curatedDomains = [];
    this.domParser = new DOMParser();
    this.links = {};
    this.results = [];
    this.batches = [];
  }

  async initialize() {
    const url = chrome.runtime.getURL('../../assets/data/hn-top-domains.json');
    const response = await fetch(url);
    const data = await response.json();
    this.curatedDomains = new Set(Object.keys(data));
    console.log("Loaded curated domains", this.curatedDomains);

    this.links = await this.retrieve('links');
    console.log("Storage links", this.links);
    if (!this.links) {
      this.links = {};
      for (let i=0; i<20; ++i) {
        const link = 'https://' + chooseRandom([...this.curatedDomains]);
        this.links[link] = 'curated';
      }
      await this.store('links', this.links);
    }

    this.batches = await this.retrieve('batches');
    this.results = await this.retrieve('results');
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
    setInterval(this.runCrawlIteration.bind(this), 1000);
  }

  async runCrawlIteration() {
    console.log("Running crawl iteration");
    const chosenLink = chooseRandom(Object.keys(this.links))
    console.log("Crawling url", chosenLink, this.links[chosenLink]);
    await this.crawlURL(chosenLink, this.links[chosenLink]);

    // Remove the URL we've just crawled
    delete this.links[chosenLink];
    await this.store('links', this.links);
  }

  async crawlURL(url, source) {
    if (! await this.robotsAllowed(url)) {
      return;
    }

    let response;
    try {
      response = await fetch(url);
    } catch (e) {
      console.log("Error fetching", url, e);
      return;
    }

    const responseText = response.ok ? await response.text() : null;
    if (!responseText) {
      return;
    }

    const dom = this.domParser.parseFromString(responseText, 'text/html');
    const paragraphs = getParagraphs(dom, Node.TEXT_NODE);
    const goodParagraphs = paragraphs.filter(p => p.classType === 'good');

    const urlDomain = getDomain(url);
    const newLinks = this.getNewLinks(goodParagraphs, urlDomain);
    if (newLinks.size > 0) {
      console.log("Found new links from", url, newLinks);
    }

    newLinks.forEach(link => {
      this.links[link] = url;
    });

    // Make sure we don't store too much
    while (this.links.length > MAX_STORAGE_LINKS) {
      const link = chooseRandom(this.links.keys());
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
              console.log("Found bad URL", link);
              continue;
            }
            const linkUrl = new URL(link);
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

  async recordNewResult(result) {
    console.log("Recording new result", result);
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
      console.log("Sending batch with first item", Date.now(), batchItems[0]['url'])
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
      console.log("Batch post result", result);
      if (result['status'] === 'ok') {
        await this.store('batches', this.batches);
      } else {
        // Saving the batch failed, so put it back on our list
        this.batches.push(batchItems);
      }
    }
  }

  async robotsAllowed(url) {
    const parsedUrl = new URL(url);
    const robotsUrl = parsedUrl.protocol + '//' + parsedUrl.host + '/robots.txt'
    let robotsResponse;
    try {
      robotsResponse = await fetch(robotsUrl);
    } catch (error) {
      console.log("Error fetching robots", error);
      return true;
    }

    if (!robotsResponse.ok) {
      console.log("Bad response", robotsResponse);
      return true;
    }

    let robotsTxt = await robotsResponse.text();
    const parsedRobots = parser(robotsTxt);
    console.log("Parsed robots", parsedRobots);

    const visitAllowed = canVisit(url, 'Mwmbl', parsedRobots);
    console.log("Visit allowed", visitAllowed);
    return visitAllowed;
  }
}
