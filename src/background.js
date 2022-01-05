chrome.runtime.onInstalled.addListener(() => {
  setUp();
});

chrome.runtime.onStartup.addListener(() => {
  setUp();
});


const Crawler = (() => {
  var curatedDomains = [];

  return {
    loadCuratedDomains: (() => {
      const url = chrome.runtime.getURL('../../assets/data/hn-top-domains.json');
      fetch(url).then(response => {
        response.json().then(data => {
          curatedDomains = Object.keys(data);
          console.log("Loaded curated domains", curatedDomains);
        });
      });
    }),

    chooseDomain: (() => {
      time = new Date().getTime();
      return curatedDomains[time % curatedDomains.length];
    })
  }

})();

function setUp() {
    console.log("Starting up crawler extension");
    Crawler.loadCuratedDomains();
    setInterval(runCrawlIteration, 1000);
}


function runCrawlIteration() {
  console.log("Running crawl iteration");

  chrome.storage.local.get(["links"], storageResult => {
    console.log("Got storage", storageResult);

    var links;
    if (Object.keys(storageResult).length == 0) {
      links = ['https://' + Crawler.chooseDomain()];
    } else {
      links = storageResult.links;
    }
    console.log("Links", links);

  });

}
