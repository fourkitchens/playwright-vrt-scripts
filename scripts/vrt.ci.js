#!/usr/bin/env node

const { buildPantheonUrl, loadDotenv, runPlaywrightPass, wakePantheonEnv } = require('./vrt.shared');

loadDotenv();

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }

  return value;
}

function getTargets() {
  const sourceSite =
    process.env.VRT_PANTHEON_SITE ||
    process.env.VRT_SOURCE_SITE ||
    process.env.TERMINUS_SITE;
  const targetSite =
    process.env.VRT_PANTHEON_SITE ||
    process.env.VRT_TARGET_SITE ||
    sourceSite;
  const sourceEnv = process.env.VRT_SOURCE_ENV || process.env.TERMINUS_ENV;
  const targetEnv =
    process.env.VRT_TARGET_ENV ||
    process.env.VRT_COMPARE_ENV ||
    process.env.CANONICAL_ENV ||
    'live';

  return {
    source: {
      site: sourceSite || getRequiredEnv('TERMINUS_SITE'),
      environment: sourceEnv || getRequiredEnv('TERMINUS_ENV')
    },
    target: {
      site: targetSite || getRequiredEnv('TERMINUS_SITE'),
      environment: targetEnv
    }
  };
}

function main() {
  const { source, target } = getTargets();

  wakePantheonEnv(source.environment, source.site);
  runPlaywrightPass({
    label: `Baseline (update snapshots) ${source.environment}.${source.site}`,
    baseUrl: buildPantheonUrl(source.environment, source.site),
    updateSnapshots: true,
    terminusEnv: source.environment,
    terminusSite: source.site
  });

  wakePantheonEnv(target.environment, target.site);
  runPlaywrightPass({
    label: `Compare (no update) ${target.environment}.${target.site}`,
    baseUrl: buildPantheonUrl(target.environment, target.site),
    terminusEnv: target.environment,
    terminusSite: target.site
  });
}

main();
