const React = require('react');
module.exports = new Proxy({}, {
  get: () => () => React.createElement(React.Fragment),
});
