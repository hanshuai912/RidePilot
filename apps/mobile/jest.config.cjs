module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
  moduleNameMapper: {
    "^lucide-react-native$": "<rootDir>/test/lucide-mock.cjs",
  },
};
