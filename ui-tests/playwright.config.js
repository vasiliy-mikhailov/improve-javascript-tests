// Runs inside the Playwright container against the sidecar container; BASE_URL comes
// from docker-compose.ui.yml. Nothing here touches the host.
module.exports = {
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: [['list']],
  // one worker: the tests write feedback into one shared corpus file, so parallel
  // workers would race over the same records
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://dash:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
};
