module.exports = {
  testEnvironment: "node",
  testTimeout: 30000,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "controllers/**/*.js",
    "middlewares/**/*.js",
    "utils/**/*.js",
    "validators/**/*.js",
    "!node_modules/**"
  ],
  verbose: true
};
