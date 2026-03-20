#!/usr/bin/env node

const readline = require('readline');
const { inferPantheonTarget, loadDotenv, runPlaywrightPass, wakePantheonEnv } = require('./vrt.shared');

loadDotenv();

function isInteractive() {
  return Boolean(process.stdin.isTTY && !process.env.CI);
}

function ask(question, defaultValue) {
  if (!isInteractive()) {
    return Promise.resolve(defaultValue);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const hint = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${hint}: `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue);
    });
  });
}

async function resolveUrl(promptLabel, initialValue) {
  if (!isInteractive()) {
    return initialValue;
  }

  if (initialValue) {
    const override = await ask(`Override ${promptLabel}? (y/N)`, 'N');
    if (!override.toLowerCase().startsWith('y')) {
      return initialValue;
    }
  }

  return ask(promptLabel, initialValue);
}

function normalizeTarget(url, explicitEnv, explicitSite) {
  const inferred = inferPantheonTarget(url);
  return {
    url,
    terminusEnv: explicitEnv || inferred?.environment,
    terminusSite: explicitSite || inferred?.site
  };
}

async function getTargets() {
  const baselineUrl = await resolveUrl(
    'Baseline URL',
    process.env.BASELINE_URL || process.env.VRT_BASELINE_URL
  );
  const candidateUrl = await resolveUrl(
    'Candidate URL',
    process.env.CANDIDATE_URL || process.env.VRT_CANDIDATE_URL
  );

  if (!baselineUrl || !candidateUrl) {
    console.error(
      'Missing URLs. Set BASELINE_URL and CANDIDATE_URL (or VRT_BASELINE_URL / VRT_CANDIDATE_URL).'
    );
    process.exit(1);
  }

  return {
    baseline: normalizeTarget(
      baselineUrl,
      process.env.BASELINE_TERMINUS_ENV || process.env.VRT_BASELINE_TERMINUS_ENV,
      process.env.BASELINE_TERMINUS_SITE || process.env.VRT_BASELINE_TERMINUS_SITE
    ),
    candidate: normalizeTarget(
      candidateUrl,
      process.env.CANDIDATE_TERMINUS_ENV || process.env.VRT_CANDIDATE_TERMINUS_ENV,
      process.env.CANDIDATE_TERMINUS_SITE || process.env.VRT_CANDIDATE_TERMINUS_SITE
    )
  };
}

async function main() {
  const { baseline, candidate } = await getTargets();

  if (baseline.terminusEnv) {
    wakePantheonEnv(baseline.terminusEnv, baseline.terminusSite);
  }

  runPlaywrightPass({
    label: 'Baseline (update snapshots)',
    baseUrl: baseline.url,
    updateSnapshots: true,
    terminusEnv: baseline.terminusEnv,
    terminusSite: baseline.terminusSite
  });

  if (candidate.terminusEnv) {
    wakePantheonEnv(candidate.terminusEnv, candidate.terminusSite);
  }

  runPlaywrightPass({
    label: 'Compare (no update)',
    baseUrl: candidate.url,
    terminusEnv: candidate.terminusEnv,
    terminusSite: candidate.terminusSite
  });
}

main();
