chrome.runtime.onInstalled.addListener(() => {
  run();
});

chrome.runtime.onStartup.addListener(() => {
  run();
});


function run() {
  crawler = new Crawler();
  crawler.setUp();
}


class Crawler {
  constructor() {
    this.curatedDomains = [];
  }

  loadCuratedDomains() {
    const url = chrome.runtime.getURL('../../assets/data/hn-top-domains.json');
    fetch(url).then(response => {
      response.json().then(data => {
        this.curatedDomains = Object.keys(data);
        console.log("Loaded curated domains", this.curatedDomains);
      });
    });
  }

  chooseDomain() {
    time = new Date().getTime();
    return this.curatedDomains[time % this.curatedDomains.length];
  }

  setUp() {
    console.log("Starting up crawler extension");
    this.loadCuratedDomains();
    setInterval(this.runCrawlIteration, 1000);
  }

  runCrawlIteration() {
    console.log("Running crawl iteration");

    chrome.storage.local.get(["links"], storageResult => {
      console.log("Got storage", storageResult);

      var links;
      if (Object.keys(storageResult).length == 0) {
        links = ['https://' + this.chooseDomain()];
      } else {
        links = storageResult.links;
      }
      console.log("Links", links);

      const chosenLink = links[links.length - 1];
      this.crawlURL(chosenLink);
    });
  }

  crawlURL(url) {
    fetch(url).then(response => {
      if (response.ok) {
        response.text().then(responseText => {
          console.log("Got response text", responseText);
        })
      } else {
        console.log("Got bad response", response);
      }
    });
  }
}
