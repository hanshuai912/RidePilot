module.exports = {
  preset: "jest-expo",
  resolver: "<rootDir>/test/worklets-resolver.cjs",
  setupFilesAfterEnv: ["<rootDir>/test/gesture-setup.cjs"],
  testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
  moduleNameMapper: {
    "^lucide-react-native$": "<rootDir>/test/lucide-mock.cjs",
    "^react-native-sortables$": "<rootDir>/test/sortables-mock.cjs",
  },
};
