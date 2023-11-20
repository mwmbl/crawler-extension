
console.log("Hello from content.js");


function querySelectorInnerText(result, selector) {
    const element = result.querySelector(selector);
    return element ? element.innerText : null;
}

function querySelectorHref(result, selector) {
    const element = result.querySelector(selector);
    return element ? element.href : null;
}

async function fetchGoogleResults(query) {
    // Construct URL to query Google
    const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
    console.log("Fetching", url);

    // Fetch the URL with headers to specify UK origin
    const headers = new Headers();
    headers.append('Accept-Language', 'en-GB,en-US;q=0.7,en;q=0.3');
    const options = {
        headers: headers,
        credentials: 'omit',
        signal: AbortSignal.timeout(5000)
    };

    const response = await fetch(url, options);
    const text = await response.text();

    console.log("Text", text);
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");
    console.log("Doc", doc);
    const results = doc.querySelectorAll('.g');
    console.log("Results", results);

    // Collect results
    const resultArray = [];
    for (let i = 0; i < results.length; ++i) {
        const result = results[i];
        const title = querySelectorInnerText(result, '.DKV0Md');
        const url = querySelectorHref(result, '.yuRUbf a');
        if (!url || !title) {
            continue;
        }
        const extract = querySelectorInnerText(result, '.VwiC3b');
        // const description = result.querySelector('.VwiC3b').innerText;
        console.log("Result", title, url, extract);
        resultArray.push({
            'title': title,
            'url': url,
            'extract': extract
        });
    }

    return resultArray;
}

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
    // Parse the query string and assign parameters to `params` object
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    console.log("Query", q);
    const results = await fetchGoogleResults(q);
    console.log("Results", results);
    const parameters = encodeParametersFromResultArray(q, results);
    console.log("Parameters", parameters.toString());
    const url = 'http://localhost:8000/app/home?' + parameters.toString();

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
    console.log("Enhanced query");
}).catch(error => {
    console.log("Error", error);
})
