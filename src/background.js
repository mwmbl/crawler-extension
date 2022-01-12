import {canVisit, parser} from "./robots";
import {getParagraphs} from "./justext";


const MAX_STORAGE_LINKS = 100;
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
    setInterval(this.runCrawlIteration.bind(this), 5000);
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

    const urlDomain = new URL(url).host;
    if (this.curatedDomains.has(urlDomain)) {
      const newLinks = new Set();
      goodParagraphs.forEach(p => {
        console.log("Paragraph links", p.links);
        if (p.links.length > 0) {
          newLinks.add(...p.links);
        }
      });
      console.log("Found new links", newLinks);

      newLinks.forEach(link => {
        // TODO: - Check for relative links which are stored as "chrome-extension://"
        //       - Remove # fragments of links
        //       - Add in root page for URLs?
        //       - Somehow balance links so that we don't bias towards pages with more links
        //       - Perhaps take the first n links on the page
        if (link.startsWith('http') && link.length <= MAX_URL_LENGTH) {
          console.log("Adding link", link);
          storageLinks[link] = url;
        }
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
        'url': url,
        'source': source,
        'title': title,
        'extract': extract,
      }
      await this.recordNewResult(result);
    }
  }

  async recordNewResult(result) {
    console.log("Recording new result", result);
    let currentResults = this.retrieve('results');
    if (!currentResults) {
      currentResults = [];
    }

    currentResults.push(result);
    if (currentResults.length >= BATCH_SIZE) {
      let batches = await this.retrieve('batches');
      batches.push(currentResults);
      await this.store('batches', batches);
      currentResults = [];
    }

    await this.store('results', currentResults);
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
