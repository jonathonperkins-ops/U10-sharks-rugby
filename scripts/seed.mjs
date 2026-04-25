// One-shot uploader: copies data/session.json into Firestore at sharks/<seasonId>.
//
// Prereqs:
//   1. `firebase init` has been run and .firebaserc has the project ID.
//   2. Either run `gcloud auth application-default login` OR set
//      GOOGLE_APPLICATION_CREDENTIALS to a service account key with
//      Firestore write access.
//   3. Run from the repo root:  node scripts/seed.mjs
//
// Idempotent: refuses to overwrite an existing doc unless --force is passed.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEASON_ID = process.env.SEASON_ID || 'season-2026';
const SOURCE    = resolve(__dirname, '..', 'api', 'data');
const FORCE     = process.argv.includes('--force');

function readSeed() {
  const raw = readFileSync(SOURCE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${SOURCE} is not a JSON object`);
  }
  return parsed;
}

async function main() {
  const projectId =
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    JSON.parse(readFileSync(resolve(__dirname, '..', '.firebaserc'), 'utf8'))
      .projects?.default;

  if (!projectId || projectId.includes('CHANGE-ME')) {
    throw new Error(
      'Project ID not set. Update .firebaserc with the real GCP project ID, or export GCLOUD_PROJECT.'
    );
  }

  initializeApp({ credential: applicationDefault(), projectId });
  const db  = getFirestore();
  const ref = db.collection('sharks').doc(SEASON_ID);

  const snap = await ref.get();
  if (snap.exists && !FORCE) {
    console.error(`sharks/${SEASON_ID} already exists. Re-run with --force to overwrite.`);
    process.exit(1);
  }

  const seed = readSeed();
  const previousVersion = snap.exists ? (snap.data()._version || 0) : 0;

  // _coachKey must match the value in firestore.rules so subsequent client
  // writes (which echo the same key) are accepted. Override at the shell
  // with COACH_KEY=... if you've rotated the rules.
  const coachKey = process.env.COACH_KEY || 'rvsjptb2016';

  await ref.set({
    ...seed,
    _version:    previousVersion + 1,
    _updatedAt:  FieldValue.serverTimestamp(),
    _seededFrom: 'data/session.json',
    _coachKey:   coachKey,
  });

  console.log(`Seeded sharks/${SEASON_ID} into project ${projectId}.`);
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
