import { expect, test } from 'vitest'
import {getParagraphs} from "../src/justext";
import {JSDOM} from "jsdom";
import NODE_TYPE from "jsdom/lib/jsdom/living/node-type";


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
});


test('Remove multiple white spaces', () => {
  const document = new JSDOM((`
    <html lang="en">
      <body><p>This is      some long
      and interesting content         with lots of
      white space</p></body>
    </html>
  `)).window.document;
  const processed = getParagraphs(document, NODE_TYPE.TEXT_NODE);
  expect(processed.length).toEqual(1);
  expect(processed[0].getText()).toEqual('This is some long and interesting content with lots of white space');
})
