# Mwmbl crawler extension - crawl the web from Firefox

Have you ever wanted to crawl the web? What could beat the excitement of discovering new things on the internets? It's never been easier: now you can crawl from the comfort of your favourite browser! At the same time you will be participating in building an [open source, non-profit search engine](https://mwmbl.org).

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


How to build
------------

Run `npm run build` in the root directory. The extension will be created in the `dist` folder.
