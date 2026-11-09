// Node has no native gesture/worklet runtime. Keep interaction tests at the
// library callback boundary; native gesture and scrolling need device checks.
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);
