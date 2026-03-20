# @fourkitchens/playwright-vrt-scripts

Reusable Playwright Visual Regression Testing runners for:

- local-to-local comparisons
- Pantheon-to-local comparisons
- Pantheon-to-Pantheon comparisons in CI

The package ships three CLI entrypoints:

- `playwright-vrt`: compatibility alias for `playwright-vrt-local`
- `playwright-vrt-local`: baseline and candidate URLs are provided locally
- `playwright-vrt-ci`: baseline and candidate Pantheon environments are built from CI environment variables

## Installation

Install the package together with Playwright in the consuming project.

If you are developing against this local repository before publishing it:

```bash
npm install --save-dev @playwright/test ../playwright-vrt-scripts
```

After the package is published, install it from npm:

```bash
npm install --save-dev @playwright/test @fourkitchens/playwright-vrt-scripts
```

Then add package scripts in the consuming project's `package.json`:

```json
{
  "scripts": {
    "vrt": "playwright-vrt",
    "vrt:local": "playwright-vrt-local",
    "vrt:ci": "playwright-vrt-ci"
  }
}
```

## Consumer Setup

### 1. Configure Playwright

The runners execute `playwright test` in the consuming project. Your Playwright config should read `REMOTE_ENV_BASE_URL`.

Example config:

```js
const { defineConfig, devices } = require('@playwright/test');

const configuredBaseURL = (process.env.REMOTE_ENV_BASE_URL || 'http://example.ddev.site')
  .trim()
  .replace(/\/+$/, '');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 100000,
  reporter: 'html',
  use: {
    baseURL: `${configuredBaseURL}/`,
    trace: 'on'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ]
});
```

Notes:

- If your config file is not the default `playwright.config.js`, set `VRT_CONFIG` before running the VRT command.
- If your tests live outside the current working directory, set `VRT_CWD` to the directory that contains the consumer's Playwright project.
- Screenshot-specific global styling is intentionally not bundled. If a project needs masking or admin-toolbar hiding, configure `expect.toHaveScreenshot.stylePath` inside that project.

### 2. Write VRT Tests

The runners execute tagged Playwright tests in two passes:

1. baseline run with `--update-snapshots`
2. candidate run without updating snapshots

Default grep tag: `@vrt`

Example VRT spec:

```js
const { test, expect } = require('@playwright/test');

test('front page VRT @vrt', async ({ page }) => {
  await page.goto('/components-test-page-vrt');
  await page.waitForLoadState('networkidle');

  await page.addStyleTag({
    content: `
      * {
        animation: none !important;
        transition: none !important;
      }
    `
  });

  await expect(page).toHaveScreenshot('frontpage.png', { fullPage: true });
});
```

### 3. Optional `.env` File

The CLI entrypoints load environment variables with `dotenv`, so you can keep local values in a `.env` file.

Example:

```bash
BASELINE_URL=https://test-example-site.pantheonsite.io
CANDIDATE_URL=http://example.ddev.site
BASELINE_TERMINUS_ENV=test
BASELINE_TERMINUS_SITE=example-site
BASIC_USER=your-basic-auth-user
BASIC_PASS=your-basic-auth-pass
```

## Usage

### Local Runner

Use `playwright-vrt-local` when you want to compare:

- local against local
- Pantheon against local
- one remote URL against another remote URL

Interactive:

```bash
npm run vrt:local
```

Non-interactive:

```bash
BASELINE_URL="http://mcny.ddev.site" \
CANDIDATE_URL="https://feature-branch-example.pantheonsite.io" \
npm run vrt:local
```

If you want to run a specific config file:

```bash
VRT_CONFIG="./test/playwright/playwright.config.js" \
BASELINE_URL="https://test-example-site.pantheonsite.io" \
CANDIDATE_URL="http://example.ddev.site" \
npm run vrt:local
```

### CircleCI Runner

Use `playwright-vrt-ci` when both runs target Pantheon environments and the site/environment values come from CI variables.

```bash
VRT_PANTHEON_SITE="example-site" \
VRT_SOURCE_ENV="feature-branch" \
VRT_TARGET_ENV="live" \
npm run vrt:ci
```

The CI runner generates Pantheon URLs in this format:

```text
https://<basic-auth-if-present><env>-<site>.pantheonsite.io/
```

## Environment Variables

### Shared

- `VRT_TAG`: grep tag for Playwright. Default: `@vrt`
- `VRT_TEST`: optional single test file path to run
- `VRT_CONFIG`: optional Playwright config path
- `PLAYWRIGHT_CONFIG`: fallback alias for `VRT_CONFIG`
- `VRT_CWD`: optional working directory for the Playwright command
- `BASIC_USER`: optional HTTP basic auth username used for generated Pantheon URLs
- `BASIC_PASS`: optional HTTP basic auth password used for generated Pantheon URLs

### Local Runner

- `BASELINE_URL`: baseline URL
- `CANDIDATE_URL`: candidate URL
- `VRT_BASELINE_URL`: fallback alias for `BASELINE_URL`
- `VRT_CANDIDATE_URL`: fallback alias for `CANDIDATE_URL`
- `BASELINE_TERMINUS_ENV`: optional explicit Pantheon env for the baseline pass
- `CANDIDATE_TERMINUS_ENV`: optional explicit Pantheon env for the candidate pass
- `VRT_BASELINE_TERMINUS_ENV`: alias for `BASELINE_TERMINUS_ENV`
- `VRT_CANDIDATE_TERMINUS_ENV`: alias for `CANDIDATE_TERMINUS_ENV`
- `BASELINE_TERMINUS_SITE`: optional explicit Pantheon site for the baseline pass
- `CANDIDATE_TERMINUS_SITE`: optional explicit Pantheon site for the candidate pass
- `VRT_BASELINE_TERMINUS_SITE`: alias for `BASELINE_TERMINUS_SITE`
- `VRT_CANDIDATE_TERMINUS_SITE`: alias for `CANDIDATE_TERMINUS_SITE`

### CI Runner

- `VRT_PANTHEON_SITE`: Pantheon site shared by baseline and target passes
- `VRT_SOURCE_ENV`: Pantheon environment for the baseline pass
- `VRT_TARGET_ENV`: Pantheon environment for the compare pass
- `VRT_COMPARE_ENV`: fallback alias for `VRT_TARGET_ENV`
- `TERMINUS_SITE`: fallback Pantheon site
- `TERMINUS_ENV`: fallback baseline environment
- `CANONICAL_ENV`: fallback target environment
- `VRT_SOURCE_SITE`: legacy fallback site
- `VRT_TARGET_SITE`: legacy fallback site

## Pantheon Behavior

- Pantheon URLs are inferred automatically for standard `*.pantheonsite.io` URLs in local mode.
- If a pass resolves to a Pantheon environment, the runner executes `terminus env:wake` before Playwright starts.
- Local and CI Pantheon flows expect Terminus to already be authenticated.
- Custom Pantheon domains cannot be inferred automatically. Set explicit `*_TERMINUS_ENV` and `*_TERMINUS_SITE` values when using custom domains.

## Package Exports

This package exports the shared helpers from `scripts/vrt.shared.js`.

## Troubleshooting

- `Missing peer dependency @playwright/test`:
  install `@playwright/test` in the consuming project.
- `Missing URLs`:
  set `BASELINE_URL` and `CANDIDATE_URL` for local runs.
- `Missing required environment variable`:
  set the CI variables required by `playwright-vrt-ci`.
- `Pantheon access requires an existing Terminus login`:
  run `terminus auth:login` and retry.
- Protected Pantheon environment:
  set `BASIC_USER` and `BASIC_PASS`.
