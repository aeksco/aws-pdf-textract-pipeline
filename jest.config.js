module.exports = {
  roots: ["<rootDir>/test", "./src"],
  testMatch: ["**/*.test.ts", "**/__tests__/*.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  modulePathIgnorePatterns: ["^.+\\.d.ts?$"]
};
