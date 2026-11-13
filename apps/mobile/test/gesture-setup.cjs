// Node has no native gesture/worklet runtime. Keep interaction tests at the
// library callback boundary; native gesture and scrolling need device checks.
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);

// Component tests do not have a native window. Use the library's supported mock;
// route tests still exercise their providers and explicit inset tests override it.
jest.mock("react-native-safe-area-context", () => {
  const mock = require("react-native-safe-area-context/jest/mock").default;
  const { useContext } = require("react");
  return {
    ...mock,
    // Plain hooks survive resetAllMocks while respecting test provider metrics.
    useSafeAreaInsets: () =>
      useContext(mock.SafeAreaInsetsContext) ??
      mock.initialWindowMetrics.insets,
    useSafeAreaFrame: () =>
      useContext(mock.SafeAreaFrameContext) ?? mock.initialWindowMetrics.frame,
  };
});
