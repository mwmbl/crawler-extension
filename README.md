# An open source web crawler for the Mwmbl non-profit search engine - Firefox extension

This is the next component in the [Mwmbl](https://mwmbl.org) non-profit search engine (see [discussion on Hacker News from December 2021](https://news.ycombinator.com/item?id=29690877)) project: a distributed crawler where the clients run in volunteer's browsers. This repo is for the Firefox extension, see also the [Crawler server](https://github.com/mwmbl/crawler-server), which is implemented in Python.

Why?
----

Our goal is to eventually build a search engine that can compete with commercial ones. Since we don't have very much money, we have to build things differently from commercial search engines. In particular, crawling the web is costly. That's why we are asking you to help us. If many people contribute a small amount of CPU and bandwidth, we can, in time, compete at a very low cost.

Screenshot
----------

![mwmbl-crawler-extension](https://user-images.githubusercontent.com/1283077/173198684-99886fa6-ed70-4df6-aa93-a09c58786b84.png)


What it does
------------

The pages crawled are determined by a central server at `api.crawler.mwmbl.org`. They are restricted to a [curated set of domains](https://github.com/mwmbl/mwmbl/blob/master/mwmbl/tinysearchengine/hn_top_domains_filtered.py) (currently determined by analysing Hacker News votes) and pages linked from those domains.

The URLs to crawl are returned in batches from the central server. The browser extension then crawls each URL in turn. We currently use a single thread as we want to make use of minimal CPU and bandwidth of our supporters.

For each URL, it first checks if downloading is allowed by `robots.txt`. If it is, it then downloads the URL and attempts to extract the title and the beginning of the body text. An attempt is made to exclude boilerplate, but this is not 100% effective. The results are batched up and the completed batch is then sent to the central server.

The batches are stored in long term storage (currently Backblaze) for later indexing. Currently indexing is a manual process, so you won't necessarily see pages you've crawled in search results any time soon.

What do the emojis mean?
------------------------

When you click the Mwmbl icon, you can get a view into what's happening with the crawler process. Emojis are used as a shorthand for various errors/issues encountered:

 - 🤖 means the URL was blocked by `robots.txt`
 - ⏰ means the page timed out (we allow 3s for the page to load)
 - 😵 means we got a 404 (with a plan to extend this to 4xx)
 - ❌ means some other kind of error
 - ✅ means we got a 2xx result.


Installation
------------

Currently only Firefox is supported. Either install from [Mozilla add-ons](https://addons.mozilla.org/en-GB/firefox/addon/mwmbl-web-crawler/) or follow instructions below to build, then install by going to `about:debugging` select "This Firefox" then "Load Temporary Add-on".


How to deploy/customise your own crawler
----------------------------------------

If you want to run your own crawler you will first need to deploy the crawler server. This will run happily on Google Cloud Run. You will also need a Backblaze or AWS account for storing the crawled batches. Change this line in `background.js`:

```
const DOMAIN = 'https://api.crawler.mwmbl.org'
```

to point to your crawler server instance. If you want to customize the curated domains (these influence the type of pages crawled) then you can edit the `hn-top-domains.json` file.


How to build
------------
```
git clone https://github.com/mwmbl/crawler-extension.git
cd crawler-extension
npm install
npm run build
```
The extension will be created in the `dist` folder.
