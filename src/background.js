import {canVisit, parser} from "./robots";
import {getParagraphs} from "./justext";

chrome.runtime.onInstalled.addListener(() => {
  run();
});


chrome.runtime.onStartup.addListener(() => {
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

    const storageLinks = await this.getLinks();
    console.log("Storage links", storageLinks);
    if (!storageLinks) {
      const links = {};
      for (let i=0; i<20; ++i) {
        const link = 'https://' + chooseRandom([...this.curatedDomains]);
        links[link] = 'curated';
      }
      await this.setLinks(links);
    }
  }

  async getLinks() {
    const promise = new Promise(resolve => {
      chrome.storage.local.get(["links"], resolve);
    });
    const result = await promise;
    return result["links"];
  }

  async setLinks(links) {
    await chrome.storage.local.set({links: links});
  }

  async setUp() {
    console.log("Starting up crawler extension");
    await this.loadCuratedDomains();
    setInterval(this.runCrawlIteration.bind(this), 5000);
  }

  async runCrawlIteration() {
    console.log("Running crawl iteration");

    const links = await this.getLinks();
    console.log("Got links", links);
    const chosenLink = chooseRandom(Object.keys(links))
    await this.crawlURL(chosenLink);
  }

  async crawlURL(url) {
    console.log("Crawling url", url);
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

    const urlDomain = new URL(url).host;
    if (this.curatedDomains.has(urlDomain)) {
      const links = new Set();
      goodParagraphs.forEach(p => {
        links.add(...p.links);
      });
      console.log("Found new links", links);
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
