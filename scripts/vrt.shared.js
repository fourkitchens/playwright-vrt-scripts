const path = require('path');
const { createRequire } = require('module');
const { execSync, spawnSync } = require('child_process');

function parseUrl(value) {
  try {
    return new URL(value);
  } catch (error) {
    return null;
  }
}

function isPantheonUrl(url) {
  const parsedUrl = parseUrl(url);
  return Boolean(parsedUrl && /\.pantheonsite\.io$/i.test(parsedUrl.hostname));
}

function inferPantheonTarget(url) {
  if (!url || !isPantheonUrl(url)) {
    return null;
  }

  const parsedUrl = parseUrl(url);
  const match = parsedUrl.hostname.match(/^([a-z0-9-]+)-([a-z0-9-]+)\.pantheonsite\.io$/i);

  if (!match) {
    return null;
  }

  return {
    environment: match[1],
    site: match[2]
  };
}

function getPantheonSite(site) {
  const resolvedSite = site || process.env.TERMINUS_SITE;

  if (!resolvedSite) {
    throw new Error('Pantheon site is required. Set TERMINUS_SITE or pass the site explicitly.');
  }

  return resolvedSite;
}

function buildPantheonUrl(environment, site) {
  if (!environment) {
    throw new Error('Pantheon environment is required to build the URL.');
  }

  const resolvedSite = getPantheonSite(site);
  const basicAuth =
    process.env.BASIC_USER && process.env.BASIC_PASS
      ? `${process.env.BASIC_USER}:${process.env.BASIC_PASS}@`
      : '';

  return `https://${basicAuth}${environment}-${resolvedSite}.pantheonsite.io/`;
}

function ensureLocalTerminusLogin() {
  try {
    execSync('terminus auth:whoami', {
      stdio: 'ignore'
    });
  } catch (error) {
    console.error(
      'Pantheon access requires an existing Terminus login. Run `terminus auth:login` and retry.'
    );
    process.exit(1);
  }
}

function wakePantheonEnv(environment, site) {
  if (!environment) {
    return;
  }

  const resolvedSite = getPantheonSite(site);

  ensureLocalTerminusLogin();
  execSync(`terminus -n env:wake ${resolvedSite}.${environment}`, {
    stdio: 'inherit'
  });
}

function getWorkingDirectory() {
  return path.resolve(process.env.VRT_CWD || process.cwd());
}

function getWorkingDirectoryRequire() {
  return createRequire(path.join(getWorkingDirectory(), '__playwright_vrt__.js'));
}

function resolveFromWorkingDirectory(moduleId) {
  try {
    return getWorkingDirectoryRequire().resolve(moduleId);
  } catch (error) {
    return null;
  }
}

function resolveFromPackage(moduleId) {
  try {
    return require.resolve(moduleId);
  } catch (error) {
    return null;
  }
}

function loadDotenv() {
  const dotenvPath = resolveFromWorkingDirectory('dotenv') || resolveFromPackage('dotenv');

  if (!dotenvPath) {
    return;
  }

  const dotenv = require(dotenvPath);

  dotenv.config({
    path: process.env.VRT_DOTENV_PATH || path.join(getWorkingDirectory(), '.env')
  });
}

function getPlaywrightCliPath() {
  const cliPath = resolveFromWorkingDirectory('@playwright/test/cli');

  if (cliPath) {
    return cliPath;
  }

  console.error(
    'Missing peer dependency `@playwright/test`. Install it in the consuming project before running these scripts.'
  );
  process.exit(1);
}

function getPlaywrightConfigPath() {
  const configPath = process.env.VRT_CONFIG || process.env.PLAYWRIGHT_CONFIG;

  if (!configPath) {
    return null;
  }

  return path.resolve(getWorkingDirectory(), configPath);
}

function getShardArguments() {
  const totalShards = process.env.PLAYWRIGHT_TOTAL_SHARDS || process.env.CIRCLE_NODE_TOTAL;
  let shard = process.env.PLAYWRIGHT_SHARD;

  if (!shard && process.env.CIRCLE_NODE_INDEX !== undefined && totalShards) {
    const nodeIndex = Number(process.env.CIRCLE_NODE_INDEX);

    if (Number.isInteger(nodeIndex) && nodeIndex >= 0) {
      shard = String(nodeIndex + 1);
    }
  }

  if (!shard || !totalShards) {
    return [];
  }

  return ['--shard', `${shard}/${totalShards}`];
}

function runPlaywrightPass({
  label,
  baseUrl,
  tag = process.env.VRT_TAG || '@vrt',
  testPath = process.env.VRT_TEST,
  updateSnapshots = false,
  terminusEnv,
  terminusSite,
  extraEnv = {}
}) {
  const args = [getPlaywrightCliPath(), 'test'];
  const configPath = getPlaywrightConfigPath();

  if (configPath) {
    args.push('--config', configPath);
  }

  args.push('--grep', tag);
  args.push(...getShardArguments());

  if (updateSnapshots) {
    args.push('--update-snapshots');
  }

  if (testPath) {
    args.push(testPath);
  }

  console.log(`\n[VRT] ${label}: ${baseUrl}`);

  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    cwd: getWorkingDirectory(),
    env: {
      ...process.env,
      ...extraEnv,
      REMOTE_ENV_BASE_URL: baseUrl,
      ...(terminusEnv ? { TERMINUS_ENV: terminusEnv } : {}),
      ...(terminusSite ? { TERMINUS_SITE: terminusSite } : {})
    }
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

module.exports = {
  buildPantheonUrl,
  ensureLocalTerminusLogin,
  getPantheonSite,
  inferPantheonTarget,
  isPantheonUrl,
  loadDotenv,
  runPlaywrightPass,
  wakePantheonEnv
};
