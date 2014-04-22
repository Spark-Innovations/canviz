function debug(str, escape) {
  str = String(str);
  if ('undefined' === typeof escape) {
    escape = true;
  }
  if (escape) {
    str = escapeHtml(str);
  }
  if (document.getElementById('debug_output')) {
    document.getElementById('debug_output').innerHTML += '&raquo;' + str + '&laquo;<br />';
  } else {
    console.log(str);
  }
}

module.exports = debug;

var escapeHtml = require('escape-html');
