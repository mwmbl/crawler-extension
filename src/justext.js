// Ported from https://github.com/miso-belica/jusText
// Copyright (c) 2011, Jan Pomikalek <jan.pomikalek@gmail.com> Copyright (c) 2013, Michal Belica
//
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//
//     Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//     Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE REGENTS AND CONTRIBUTORS ''AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE REGENTS OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

const MAX_LINK_DENSITY_DEFAULT = 0.2;
const LENGTH_LOW_DEFAULT = 70;
const LENGTH_HIGH_DEFAULT = 200;
const STOPWORDS_LOW_DEFAULT = 0.30;
const STOPWORDS_HIGH_DEFAULT = 0.32;
const NO_HEADINGS_DEFAULT = false;

// Short and near-good headings within MAX_HEADING_DISTANCE characters before
// a good paragraph are classified as good unless --no-headings is specified.
const MAX_HEADING_DISTANCE_DEFAULT = 200;

const PARAGRAPH_TAGS = new Set([
  'body', 'blockquote', 'caption', 'center', 'col', 'colgroup', 'dd',
  'div', 'dl', 'dt', 'fieldset', 'form', 'legend', 'optgroup', 'option',
  'p', 'pre', 'table', 'td', 'textarea', 'tfoot', 'th', 'thead', 'tr',
  'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);
const DEFAULT_ENCODING = 'utf8';
const DEFAULT_ENC_ERRORS = 'replace';
// const CHARSET_META_TAG_PATTERN = re.compile(br"""<meta[^>]+charset=["']?([^'"/>\s]+)""", re.IGNORECASE);
const GOOD_OR_BAD = ['good', 'bad'];


class Paragraph {
  constructor(domPath) {
    this.domPath = [...domPath];
    this.textNodes = [];
    this.charsCountInLinks = 0;
    this.tagsCount = 0;
    this.classType = "";
  }
}


const preprocess = document => {
  const killTags = "script, form, style, embed";

  const nodes = document.querySelectorAll(killTags);
  console.log("Got num nodes", nodes.length);

  nodes.forEach(node => {
    console.log("Removing", node.textContent);
    node.remove();
  });
  return document;
};


class ParagraphMaker {
  constructor() {
    this.path = [];
    this.paragraphs = [];
    this.paragraph = null;
    this.link = false;
    this.br = false;
    this.startNewParagraph();
  }

  startNewParagraph() {
    if (this.paragraph !== null && this.paragraph.textNodes.length > 0) {
      this.paragraphs.push(this.paragraph);
    }
    console.log("New paragraph", this.path);
    this.paragraph = new Paragraph(this.path);
  }

  startElementNS(name) {
    console.log("Starting", name);
    const nameLower = name ? name.toLowerCase() : '';
    if (nameLower) {
      this.path.push(nameLower);
    }
    if (PARAGRAPH_TAGS.has(nameLower.toLowerCase()) || (nameLower === 'br' && this.br)) {
      if (nameLower === 'br') {
        this.paragraph.tagsCount++;
      }
      this.startNewParagraph();
    } else {
      this.br = nameLower === 'br';
      if (this.br) {
        this.paragraph.textNodes.push(' ');
      } else if (nameLower === 'a') {
        this.link = true;
      }
      this.paragraph.tagsCount++;
    }
  }

  endElementNS(name) {
    if (name) {
      this.path.pop();
    }

    const nameLower = name ? name.toLowerCase() : '';
    if (PARAGRAPH_TAGS.has(nameLower)) {
      this.startNewParagraph();
    }

    if (nameLower === 'a') {
      this.link = false;
    }
  }

  endDocument() {
    this.startNewParagraph();
  }

  characters(content) {
    const trimmedText = content.trim();
    if (trimmedText.length === 0) {
      // Whitespace only
      return;
    }

    console.log("Found text", trimmedText);
    // TODO: remove multiple whitespaces inside the trimmedText
    this.paragraph.textNodes.push(trimmedText);

    if (this.link) {
      this.paragraph.charsCountInLinks += trimmedText.length;
    }

    this.br = false;
  }
}

const visitNodes = (node, paragraphMaker, textNodeType) => {
  paragraphMaker.startElementNS(node.tagName);

  const children = [...node.childNodes];
  children.forEach(child => {
    if (child.nodeType === textNodeType) {
      paragraphMaker.characters(child.textContent);
    } else {
      visitNodes(child, paragraphMaker, textNodeType);
    }
  });

  paragraphMaker.endElementNS(node.tagName);
};


const makeParagraphs = (preprocessed, textNodeType) => {
  const paragraphMaker = new ParagraphMaker();
  visitNodes(preprocessed, paragraphMaker, textNodeType);
  paragraphMaker.endDocument();
  return paragraphMaker.paragraphs;
};


export const getParagraphs = (document, textNodeType) => {
  const preprocessed = preprocess(document);
  return makeParagraphs(preprocessed, textNodeType);
};
