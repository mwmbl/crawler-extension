import { fetchGoogleResults } from './google-search.js';
import { retrieve } from './storage.js';

const QUERY_URL = 'https://mwmbl.org/app/home?';

function encodeParametersFromResultArray(q, results) {
    const params = new URLSearchParams();
    params.append('q', q);
    params.append('enhanced', 'google');
    for (let i = 0; i < results.length; ++i) {
        const result = results[i];
        params.append('title', result.title);
        params.append('url', result.url);
        params.append('extract', result.extract);
    }
    return params;
}

async function enhanceQuery() {
    const crawl = await retrieve('google');
    if (!crawl) {
        console.log("Enhanced query not enabled")
        return;
    }

    // Parse the query string and assign parameters to `params` object
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    console.log("Query", q);
    const results = await fetchGoogleResults(q);
    console.log("Results", results);
    const parameters = encodeParametersFromResultArray(q, results);
    console.log("Parameters", parameters.toString());
    const url = QUERY_URL + parameters.toString();

    // Add a header for the HX-Current-URL header
    const headers = new Headers();
    headers.append('HX-Current-URL', window.location.href);

    // Fetch with the headers
    const response = await fetch(url, {
        headers: headers,
    });

    // Replace .main with the html from the response
    const main = document.querySelector('.main');
    main.innerHTML = await response.text();
}

enhanceQuery().then(() => {
    console.log("Enhanced query finished");
    window.postMessage('results-loaded', "*");
}).catch(error => {
    console.log("Error", error);
});
