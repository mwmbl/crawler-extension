import { assert, expect, test } from 'vitest'
import {getParagraphs} from "../src/justext";
import {JSDOM} from "jsdom";
import NODE_TYPE from "jsdom/lib/jsdom/living/node-type";


test('Test complete HTML file', () => {
  const input = `
<!doctype html>
<html lang="en">
  <head>
    <!-- Required meta tags -->
    <meta charset="utf-8">

    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css" integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk" crossorigin="anonymous">
    <link rel="stylesheet" href='/css/style.css'>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;800&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/05fb44fc17.js" crossorigin="anonymous"></script>

    <title>Moxie Marlinspike >> Blog >> My first impressions of web3</title>

    
  
    <meta property="og:title" content="My first impressions of web3" />
    <meta property="og:site_name" content="Moxie Marlinspike" />
    <meta property="og:type" content="website" />
    <meta property="og:description" content="Despite considering myself a cryptographer, I have not found myself particularly drawn to “crypto.” I don’t think I’ve ever actually said the words “get off my lawn,” but I’m much more likely to click on Pepperidge Farm Remembers flavored memes about how “crypto” used to mean “cryptography” than ..." />
    <meta property="og:url" content="/2022/01/07/web3-first-impressions.html" />

    
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
    </head>
  <body>

  <div class="container py-5 d-none d-lg-block"></div>

    <div class="container">
      <nav class="row offset-sm-2 navbar navbar-dark navbar-expand-lg mt-4" style="background-color: transparent;">
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav">
            <li class="nav-item ">
              <a class="nav-link" href="/">
                <h3>ABOUT</h3>
                
              </a>
            </li>
            <li class="nav-item ">
              <a class="nav-link" href="/stories.html">
                <h3>LIFE</h3>
                
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </div>

    <div class="container pt-5 pb-3 d-lg-none"></div>

    <div class="container">
      <div class="row">
        <div class="col-lg-12">
          <div class="content">
            <div class="row pt-5 pb-5">
              <div class="offset-lg-1 col-lg-10">
                <div class="row">
  <div class="col-lg"><h1 class="blog-title">My first impressions of web3</h1></div>
</div>

<div class="date pb-4">Jan 07, 2022</div>

<article>

<p>Despite considering myself a cryptographer, I have not found myself particularly drawn to “crypto.” I don’t think I’ve ever actually said the words “get off my lawn,” but I’m much more likely to click on <em>Pepperidge Farm Remembers</em> flavored memes about how “crypto” used to mean “cryptography” than I am the latest NFT drop.</p>

<p>Also – cards on the table here – I don’t share the same generational excitement for moving all aspects of life into an instrumented economy.</p>

<p>Even strictly on the technological level, though, I haven’t yet managed to become a believer. So given all of the recent attention into what is now being called web3, I decided to explore some of what has been happening in that space more thoroughly to see what I may be missing.</p>

<div class="row">
  <div class="col-md-4">
    <figure class="figure">
      <img src="/blog/images/nft-opensea.png" class="figure-img img-fluid rounded" alt="NFT on OpenSea" />
      <figcaption class="figure-caption">NFT on OpenSea</figcaption>
    </figure>
  </div>

  <div class="col-md-4">
    <figure class="figure">
      <img src="/blog/images/nft-rarible.png" class="figure-img img-fluid rounded" alt="NFT on rarible" />
      <figcaption class="figure-caption">Same NFT on Rarible</figcaption>
    </figure>
  </div>

  <div class="col-md-4">
    <figure class="figure">
      <img src="/blog/images/nft-metamask.png" class="figure-img img-fluid rounded" alt="NFT in wallet" />
      <figcaption class="figure-caption">Same NFT in a wallet</figcaption>
    </figure>
  </div>
</div>

<div class="highlighter-rouge"><div class="highlight"><pre class="highlight"><code>POST https://mainnet.infura.io/v3/d039103314584a379e33c21fbe89b6cb HTTP/2.0

{
    "id": 2628746552039525,
    "jsonrpc": "2.0",
    "method": "eth_getBalance",
    "params": [
        "0x0208376c899fdaEbA530570c008C4323803AA9E8",
        "latest"
    ]
}
</code></pre></div></div>

<ul class="social-buttons">
  <li><a href="https://twitter.com/share" class="twitter-share-button" data-via="moxie">Tweet</a></li>
</ul>

<ul class="follow"><li>Stay in touch,</li><li class="social-buttons-follow"><a href="https://twitter.com/moxie" class="twitter-follow-button" data-show-count="false" data-size="large">Follow @moxie</a></li></ul>

<p style="clear: both;"/>

<script>!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src="//platform.twitter.com/widgets.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","twitter-wjs");
</script>


</article>

              </div>
            </div>
          </div>
        </div>

        <!--
         <div class="col-md-5 col-lg-2">
          <div class="content about">
            <h2>Moxie Marlinspike</h2>
            <img src="/images/moxiemarlinspike3.jpg" class="portrait mt-3 mb-3"/>

            <hr>

            <p>
              <ul>
                <li>
                  <a href="https://instagram.com/moxiemarlinspike"><i class="fab fa-instagram"></i> moxiemarlinspike</a>
                </li>
                <li>
                  <a href="https://twitter.com/moxie"><i class="fab fa-twitter"></i> moxie</a>
                </li>
              </ul>
            </p>    
          </div>
        </div>
      -->
      </div>

      <div class="row pt-3">
        <div class="offset-lg-1 col-lg-11">
          <span class="copyright">&copy; 2012 Moxie Marlinspike</span>  
        </div>
      </div>

    </div>


    <script type="text/javascript">
      var clicky_site_ids = clicky_site_ids || [];
      clicky_site_ids.push(100527609);
      (function() {
      var s = document.createElement('script');
      s.type = 'text/javascript';
      s.async = true;
      s.src = '//static.getclicky.com/js';
      ( document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0] ).appendChild( s );
      })();
    </script>
    <noscript><p><img alt="Clicky" width="1" height="1" src="//in.getclicky.com/100527609ns.gif" /></p></noscript>
    
  </body>
</html>
  `

  let jsdom = new JSDOM(input);
  const parsedDoc = jsdom.window.document;
  // console.log("Before", parsedDoc.documentElement.textContent);
  const paragraphs = getParagraphs(parsedDoc, NODE_TYPE.TEXT_NODE);
  console.log("Paragraphs", paragraphs);
  console.log("-----------------------");

  // const output = JSON.stringify(input)
  //
  // expect(input).toEqual({
  //   foo: 'hello',
  //   bar: 'world',
  // })
  // expect(output).toEqual('{"foo":"hello","bar":"world"}')
  // assert.deepEqual(JSON.parse(output), input, 'matches original')
})


test('Test deleting a nested forbidden tag', () => {
  const document = new JSDOM(`
    <html lang="en">
      <body><form>Form content <script>Script content</script></form></body>
    </html>`).window.document;
  const processed = getParagraphs(document, NODE_TYPE.TEXT_NODE);
  expect(processed).toEqual([]);
  console.log("-----------------------", processed);
});


test('Test that we capture links', () => {
  const document = new JSDOM((`
    <html lang="en">
      <body><p><a href="/test"><h3>Some content</h3></a></p></body>
    </html>
  `)).window.document;
  const processed = getParagraphs(document, NODE_TYPE.TEXT_NODE);
  expect(processed.length).toEqual(1);
  expect(processed[0].links).toEqual(['/test']);
  console.log("-----------------------", processed);
});


test('Test link with children', () => {
  const document = new JSDOM((`
    <html lang="en">
      <body><p><a href="/test"><h3>Some content</h3><p>Some other content</p></a></p></body>
    </html>
  `)).window.document;
  const processed = getParagraphs(document, NODE_TYPE.TEXT_NODE);
  expect(processed.length).toEqual(2);
  expect(processed[0].links).toEqual(['/test']);
  expect(processed[1].links).toEqual(['/test']);
  console.log("-----------------------", processed);
});


test('Test adjacent links', () => {
  const document = new JSDOM((`
    <html lang="en">
      <body><p><a href="/test"><h3>Some content</h3></a><a href="/test2"><h3>Other content</h3></a></p></body>
    </html>
  `)).window.document;
  const processed = getParagraphs(document, NODE_TYPE.TEXT_NODE);
  expect(processed.length).toEqual(2);
  expect(processed[0].links).toEqual(['/test']);
  expect(processed[1].links).toEqual(['/test2']);
  console.log("-----------------------", processed);
});

