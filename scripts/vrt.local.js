#!/usr/bin/env node

const { inferPantheonTarget, loadDotenv, runPlaywrightPass, wakePantheonEnv } = require('./vrt.shared');

loadDotenv();

function normalizeTarget(url, explicitEnv, explicitSite) {
  const inferred = inferPantheonTarget(url);
  return {
    url,
    terminusEnv: explicitEnv || inferred?.environment,
    terminusSite: explicitSite || inferred?.site
  };
}

async function getTargets() {
  const baselineUrl = process.env.BASELINE_URL || process.env.VRT_BASELINE_URL;
  const candidateUrl = process.env.CANDIDATE_URL || process.env.VRT_CANDIDATE_URL;

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
