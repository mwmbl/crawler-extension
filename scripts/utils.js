const { resolve } = require('path');

const port = parseInt(process.env.PORT || '') || 3303;
const r = (...args) => resolve(__dirname, '..', ...args);
const isDev = process.env.NODE_ENV !== 'production';

module.exports = { port, r, isDev };
