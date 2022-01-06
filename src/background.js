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


class Crawler {
  constructor() {
    this.curatedDomains = [];
  }

  async loadCuratedDomains() {
    const url = chrome.runtime.getURL('../../assets/data/hn-top-domains.json');
    const response = await fetch(url);
    const data = await response.json();
    this.curatedDomains = Object.keys(data);
    console.log("Loaded curated domains", this.curatedDomains);
  }

  chooseDomain() {
    const time = Date.now();
    return this.curatedDomains[time % this.curatedDomains.length];
  }

  setUp() {
    console.log("Starting up crawler extension");
    this.loadCuratedDomains();
    setInterval(this.runCrawlIteration.bind(this), 1000);
  }

  runCrawlIteration() {
    console.log("Running crawl iteration");

    chrome.storage.local.get(["links"], storageResult => {
      console.log("Got storage", storageResult);

      let links;
      if (Object.keys(storageResult).length === 0) {
        links = ['https://' + this.chooseDomain()];
      } else {
        links = storageResult.links;
      }
      console.log("Links", links);

      const chosenLink = links[links.length - 1];
      this.crawlURL(chosenLink);
    });
  }

  async crawlURL(url) {
    const response = await fetch(url);
    if (response.ok) {
      const responseText = await response.text();
      console.log("Got response text", responseText);
    } else {
      console.log("Got bad response", response);
    }
  }
}
