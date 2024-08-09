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

// Short and near-good headings within MAX_HEADING_DISTANCE characters before
// a good paragraph are classified as good unless --no-headings is specified.
const MAX_HEADING_DISTANCE_DEFAULT = 200;

const PARAGRAPH_TAGS = new Set([
  'body', 'blockquote', 'caption', 'center', 'col', 'colgroup', 'dd',
  'div', 'dl', 'dt', 'fieldset', 'form', 'legend', 'optgroup', 'option',
  'p', 'pre', 'table', 'td', 'textarea', 'tfoot', 'th', 'thead', 'tr',
  'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could",
  "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for",
  "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's",
  "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm",
  "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't",
  "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
  "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
  "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's",
  "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under", "until",
  "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when",
  "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
  "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
])


class Paragraph {
  constructor(domPath) {
    this.domPath = [...domPath];
    this.textNodes = [];
    this.charsCountInLinks = 0;
    this.tagsCount = 0;
    this.cfClass = null;
    this.classType = "";
    this.links = new Map();
    this.heading = this.domPath.some(x => HEADINGS.has(x));
  }

  getText() {
    return this.textNodes.join(' ');
  }
}


const preprocess = document => {
  const killTags = "script, form, style, embed";

  const nodes = document.querySelectorAll(killTags);

  nodes.forEach(node => {
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
    this.links = new Map();
    this.startNewParagraph();
  }

  startNewParagraph() {
    if (this.paragraph !== null && this.paragraph.textNodes.length > 0) {
      this.paragraph.links = new Map(this.links);
      this.paragraphs.push(this.paragraph);
      this.links = new Map();
      this.paragraph = new Paragraph(this.path);
    } else if (this.paragraph === null) {
      this.paragraph = new Paragraph(this.path);
    }
  }

  startElementNS(name) {
    const nameLower = name ? name.toLowerCase() : '';
    if (nameLower !== '') {
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
    const trimmedText = content.trim().replace(/\s+/g, ' ');
    if (trimmedText.length === 0) {
      // Whitespace only
      return;
    }

    this.paragraph.textNodes.push(trimmedText);

    if (this.link) {
      this.paragraph.charsCountInLinks += trimmedText.length;
    }

    this.br = false;
  }

  addLink(url, anchorText) {
    this.links.set(url, anchorText);
  }
}

const visitNodes = (node, paragraphMaker, textNodeType) => {
  paragraphMaker.startElementNS(node.tagName);

  const nameLower = node.tagName ? node.tagName.toLowerCase() : '';
  if (nameLower === 'a') {
    const url = node.href;
    const anchorText = node.textContent;
    paragraphMaker.addLink(url, anchorText);
  }

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
  const paragraphs = makeParagraphs(preprocessed, textNodeType);
  classifyParagraphs(paragraphs);
  reviseParagraphClassification(paragraphs);
  return paragraphs;
};


const classifyParagraphs = (paragraphs) => {
  paragraphs.forEach(paragraph => {
    const text = paragraph.getText();

    const words = text.split(/\s+/);
    const stopwordsCount = words.map(w => STOPWORDS.has(w.toLowerCase()) ? 1 : 0).reduce((x, y) => x + y, 0);
    const stopwordDensity = words.length > 0 ? stopwordsCount / words.length : 0.0;
    const linkDensity = text.length > 0 ? paragraph.charsCountInLinks / text.length : 0.0;

    if (linkDensity > MAX_LINK_DENSITY_DEFAULT) {
      paragraph.cfClass = 'bad';
    } else if (text.search('\xa9') >= 0 || text.search('&copy') >= 0) {
      // Copyright symbol
      paragraph.cfClass = 'bad';
    } else if (text.length < LENGTH_LOW_DEFAULT) {
      if (paragraph.charsCountInLinks > 0) {
        paragraph.cfClass = 'bad';
      } else {
        paragraph.cfClass = 'short';
      }
    } else if (stopwordDensity >= STOPWORDS_HIGH_DEFAULT) {
      if (text.length > LENGTH_HIGH_DEFAULT) {
        paragraph.cfClass = 'good';
      } else {
        paragraph.cfClass = 'neargood';
      }
    } else if (stopwordDensity >= STOPWORDS_LOW_DEFAULT) {
      paragraph.cfClass = 'neargood';
    } else {
      paragraph.cfClass = 'bad';
    }
  });
}


const getNeighbour = (i, paragraphs, ignoreNeargood, inc, boundary) => {
  while (i + inc !== boundary) {
    i += inc;
    const c = paragraphs[i].classType;
    if (c === 'good' || c === 'bad') {
      return c;
    }
    if (c === 'neargood' && !ignoreNeargood) {
      return c;
    }
  }
  return 'bad';
}


const getPrevNeighbour = (i, paragraphs, ignoreNeargood) => {
  // Return the class of the paragraph at the top end of the short/neargood
  // paragraphs block. If ignore_neargood is True, than only 'bad' or 'good'
  // can be returned, otherwise 'neargood' can be returned, too.
  return getNeighbour(i, paragraphs, ignoreNeargood, -1, -1);
}


const getNextNeighbour = (i, paragraphs, ignoreNeargood) => {
  // Return the class of the paragraph at the bottom end of the short/neargood
  // paragraphs block. If ignore_neargood is True, than only 'bad' or 'good'
  // can be returned, otherwise 'neargood' can be returned, too.
  return getNeighbour(i, paragraphs, ignoreNeargood, 1, paragraphs.length);
}


const reviseParagraphClassification = (paragraphs) => {
  // Good headings
  for (let i=0; i<paragraphs.length; ++i) {
    const paragraph = paragraphs[i];
    paragraph.classType = paragraph.cfClass;
    if (!(paragraph.heading && paragraph.classType === 'short')) {
      continue;
    }
    let j = i + 1;
    let distance = 0;
    while (j < paragraphs.length && distance <= MAX_HEADING_DISTANCE_DEFAULT) {
      if (paragraphs[j].classType === 'good') {
        paragraph.classType = 'neargood';
        break
      }
      distance += paragraphs[j].getText().length;
      j++;
    }
  }

  // Classify short
  const newClasses = {};
  for (let i=0; i<paragraphs.length; ++i) {
    const paragraph = paragraphs[i];
    if (paragraph.classType !== 'short') {
      continue;
    }
    const prevNeighbour = getPrevNeighbour(i, paragraphs, true);
    const nextNeighbour = getNextNeighbour(i, paragraphs, true);
    if (prevNeighbour === 'good' && nextNeighbour === 'good') {
      newClasses[i] = 'good';
    } else if (prevNeighbour === 'bad' && nextNeighbour === 'bad') {
      newClasses[i] = 'bad';
    } else if ((prevNeighbour === 'bad' && getPrevNeighbour(i, paragraphs, false) === 'neargood') ||
               (nextNeighbour === 'bad' && getNextNeighbour(i, paragraphs, false) === 'neargood')) {
      newClasses[i] = 'good';
    } else {
      newClasses[i] = 'bad';
    }
  }


  for (const [i, value] of Object.entries(newClasses)) {
    paragraphs[i].classType = value;
  }

  // Revise neargood
  for (let i=0; i<paragraphs.length; ++i) {
    const paragraph = paragraphs[i];
    if (paragraph.classType !== 'neargood') {
      continue;
    }
    const prevNeighbour = getPrevNeighbour(i, paragraphs, true);
    const nextNeighbour = getNextNeighbour(i, paragraphs, true);
    if (prevNeighbour === 'bad' && nextNeighbour === 'bad') {
      paragraph.classType = 'bad';
    } else {
      paragraph.classType = 'good';
    }
  }

  // More good headings
  for (let i=0; i<paragraphs.length; ++i) {
    const paragraph = paragraphs[i];
    if (!(paragraph.heading && paragraph.classType === 'bad' && paragraph.cfClass !== 'bad')) {
      continue;
    }
    let j = i + 1;
    let distance = 0;
    while (j < paragraphs.length && distance <= MAX_HEADING_DISTANCE_DEFAULT) {
      if (paragraphs[j].classType === 'good') {
        paragraph.classType = 'good';
        break;
      }
      distance += paragraphs[j].getText().length;
      j += 1;
    }
  }
}
