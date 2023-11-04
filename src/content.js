
console.log("Hello from content.js");


function querySelectorInnerText(result, selector) {
    const element = result.querySelector(selector);
    return element ? element.innerText : null;
}

function querySelectorHref(result, selector) {
    const element = result.querySelector(selector);
    return element ? element.href : null;
}


async function fetchGoogleResults() {

}


function enhanceQuery() {
    // Parse the query string and assign parameters to `params` object
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    console.log("Query", q);

    // Construct URL to query Google
    const url = 'https://www.google.com/search?q=' + encodeURIComponent(q);
    console.log("Fetching", url);

    // Fetch the URL with headers to specify UK origin
    const headers = new Headers();
    headers.append('Accept-Language', 'en-GB,en-US;q=0.7,en;q=0.3');
    const options = {
        headers: headers,
        credentials: 'omit',
        signal: AbortSignal.timeout(5000)
    };
    const resultArray = [];
    fetch(url, options)
        .then(response => {
            console.log("Response", response);
            return response.text();
        })
        .then(text => {
            console.log("Text", text);
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");
            console.log("Doc", doc);
            const results = doc.querySelectorAll('.g');
            console.log("Results", results);
            // Collect results
            for (let i = 0; i < results.length; ++i) {
                const result = results[i];
                const title = querySelectorInnerText(result, '.DKV0Md');
                const url = querySelectorHref(result, '.yuRUbf a');
                if (!url || !title) {
                    continue;
                }
                const description = querySelectorInnerText(result, '.VwiC3b');
                // const description = result.querySelector('.VwiC3b').innerText;
                console.log("Result", title, url, description);
                resultArray.push({
                    'title': title,
                    'url': url,
                    'description': description
                });
            }

            console.log("Result array", resultArray);
        }
        )
        .catch(error => {
            console.log("Error", error);
        }
        );


}

enhanceQuery();
