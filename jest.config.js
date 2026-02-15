const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
    "^.+\\.js$": ["ts-jest", { useESM: false }],
  },
  transformIgnorePatterns: ["/node_modules/(?!jose)"],
  moduleNameMapper: {
    "^next/headers$": "<rootDir>/src/lib/__mocks__/next-headers.ts",
  },
};