import {canVisit, parser} from "./robots";
import {getParagraphs} from "./justext";


const POST_BATCH_URL = 'https://crawler-server-oq4r5q2hsq-ue.a.run.app/batches/';
const MAX_NEW_LINKS = 20;
const MAX_STORAGE_LINKS = 5000;
const BATCH_SIZE = 20;

const MAX_URL_LENGTH = 150
const NUM_TITLE_CHARS = 65
const NUM_EXTRACT_CHARS = 155


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
  }

  async loadCuratedDomains() {
    const url = chrome.runtime.getURL('../../assets/data/hn-top-domains.json');
    const response = await fetch(url);
    const data = await response.json();
    this.curatedDomains = new Set(Object.keys(data));
    console.log("Loaded curated domains", this.curatedDomains);

    const storageLinks = await this.retrieve('links');
    console.log("Storage links", storageLinks);
    if (!storageLinks) {
      const links = {};
      for (let i=0; i<20; ++i) {
        const link = 'https://' + chooseRandom([...this.curatedDomains]);
        links[link] = 'curated';
      }
      await this.store('links', links);
    }
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
    await this.loadCuratedDomains();
    setInterval(this.runCrawlIteration.bind(this), 1000);
  }

  async runCrawlIteration() {
    console.log("Running crawl iteration");

    const links = await this.retrieve('links');
    console.log("Got links", links);
    const chosenLink = chooseRandom(Object.keys(links))
    console.log("Crawling url", chosenLink, links[chosenLink]);
    await this.crawlURL(chosenLink, links[chosenLink]);
  }

  async crawlURL(url, source) {
    if (! await this.robotsAllowed(url)) {
      return;
    }

    const response = await fetch(url);
    const responseText = response.ok ? await response.text() : null;
    if (!responseText) {
      return;
    }

    const dom = this.domParser.parseFromString(responseText, 'text/html');
    const paragraphs = getParagraphs(dom, Node.TEXT_NODE);
    const goodParagraphs = paragraphs.filter(p => p.classType === 'good');
    console.log("Got good paragraphs", goodParagraphs);

    const storageLinks = await this.retrieve('links');
    const urlDomain = getDomain(url);
    const newLinks = this.getNewLinks(goodParagraphs, urlDomain);
    console.log("Found new links", newLinks);

    if (this.curatedDomains.has(urlDomain)) {
      newLinks.forEach(link => {
        storageLinks[link] = url;
      });

      // Make sure we don't store too much
      while (storageLinks.length > MAX_STORAGE_LINKS) {
        const link = chooseRandom(storageLinks.keys());
        delete storageLinks[link];
      }
    }

    // Remove the URL we've just crawled
    delete storageLinks[url];
    await this.store('links', storageLinks);

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
    // TODO: - Check for relative links which are stored as "chrome-extension://"
    //       - Remove # fragments of links
    //       - Add in root page for URLs?
    const newLinks = new Set();
    for (let i=0; i<goodParagraphs.length; ++i) {
      const p = goodParagraphs[i];
      if (p.links.length > 0) {
        for (let j=0; j<p.links.length; ++j) {
          const link = p.links[j];
          if (link.startsWith('http') && link.length <= MAX_URL_LENGTH) {
            const linkUrl = new URL(link);
            // Only consider links to external domains
            if (linkUrl.host !== domain) {
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
    let currentResults = await this.retrieve('results');
    console.log("Got current results", currentResults);
    if (!currentResults) {
      currentResults = [];
    }

    currentResults.push(result);
    if (currentResults.length >= BATCH_SIZE) {
      let batches = await this.retrieve('batches');
      console.log("Got batches", batches);
      if (!batches) {
        batches = [];
      }
      batches.push(currentResults);
      await this.store('batches', batches);
      currentResults = [];
    }

    await this.store('results', currentResults);
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
    let batches = await this.retrieve('batches');
    if (batches && batches.length > 0) {
      const batchItems = batches.pop();
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
        await this.store('batches', batches);
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
