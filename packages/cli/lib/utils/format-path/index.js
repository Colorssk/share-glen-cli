'use strict';

const path = require('path');

module.exports = function formatPath(p) {
  if (p && typeof p === 'string') {
    const sep = path.sep;
    if (sep === '/') {// Compatible with win and mac
      return p;
    } else {
      return p.replace(/\\/g, '/');
    }
  }
  return p;
}
