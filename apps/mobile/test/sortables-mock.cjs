const React = require("react");
const { View } = require("react-native");

function Grid({ data, renderItem, keyExtractor, ...props }) {
  return React.createElement(
    View,
    { ...props, testID: "sortable-segments" },
    data.map((item, index) =>
      React.createElement(
        React.Fragment,
        { key: keyExtractor(item) },
        renderItem({ item, index }),
      ),
    ),
  );
}

module.exports = {
  __esModule: true,
  default: { Grid, Handle: View },
};
