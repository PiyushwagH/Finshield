#!/usr/bin/env node
/**
 * Backend API smoke test.
 *
 * Exercises every endpoint the frontend calls against a running backend and
 * prints a pass/fail line per check. Zero dependencies — plain Node + fetch.
 *
 *   npm run test:api
 *
 * Reads the same VITE_API_URL the app uses, from frontend/.env (override with
 * an env var of the same name). Needs the backend up and its database migrated.
 *
 * Admin checks need an existing admin account; without one they are skipped
 * rather than failed, so the script stays useful in a plain dev setup:
 *   TEST_ADMIN_EMAIL=admin@finshield.local TEST_ADMIN_PASSWORD=... npm run test:api
 *
 * The user account is registered fresh on each run, so no fixtures are needed.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env reader — avoids pulling in dotenv for a standalone script.
function loadEnvFile(path) {
  try {
    for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env file — fall back to the real environment.
  }
}

loadEnvFile(resolve(frontendRoot, '.env'));

const BASE_URL = (process.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@finshield.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';

// Unique per run so re-runs never collide on the email unique constraint.
// Note the domain: EmailStr rejects reserved TLDs (.test, .local, .example),
// so a throwaway address still needs a normal-looking domain.
const USER_EMAIL = `smoketest+${Date.now()}@finshield-qa.com`;
const USER_PASSWORD = 'SmokeTest123';

const results = [];
let userToken = null;
let adminToken = null;

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/** Perform a request. `form: true` sends OAuth2 form-encoded credentials. */
async function call(method, path, { token, body, form, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;

  if (form) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = new URLSearchParams(body).toString();
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

/**
 * Run one check. `expect` is the acceptable status or list of them; `verify`
 * optionally asserts on the body and returns a string reason on failure.
 */
async function check(name, expect, requestFn, verify) {
  const expected = Array.isArray(expect) ? expect : [expect];
  try {
    const { status, data } = await requestFn();

    if (!expected.includes(status)) {
      const detail = typeof data === 'object' && data !== null
        ? JSON.stringify(data).slice(0, 160)
        : String(data).slice(0, 160);
      results.push({ name, ok: false, reason: `expected ${expected.join('/')}, got ${status} — ${detail}` });
      console.log(`${c.red('FAIL')}  ${name}  ${c.dim(`expected ${expected.join('/')}, got ${status}`)}`);
      return null;
    }

    const problem = verify ? verify(data, status) : null;
    if (problem) {
      results.push({ name, ok: false, reason: problem });
      console.log(`${c.red('FAIL')}  ${name}  ${c.dim(problem)}`);
      return null;
    }

    results.push({ name, ok: true });
    console.log(`${c.green('PASS')}  ${name}  ${c.dim(String(status))}`);
    return data;
  } catch (err) {
    results.push({ name, ok: false, reason: err.message });
    console.log(`${c.red('FAIL')}  ${name}  ${c.dim(err.message)}`);
    return null;
  }
}

function skip(name, why) {
  results.push({ name, skipped: true, reason: why });
  console.log(`${c.yellow('SKIP')}  ${name}  ${c.dim(why)}`);
}

function section(title) {
  console.log(`\n${c.bold(title)}`);
}

// A complete, valid assessment payload: all 21 fields the model contract requires.
const ASSESSMENT_PAYLOAD = {
  age: 34,
  gender: 'male',
  education: 'bachelors',
  marital_status: 'married',
  dependents: 2,
  employment_status: 'salaried_private',
  years_employed: 8,
  annual_income: 900000,
  monthly_emi: 18000,
  existing_total_debt: 850000,
  asset_value: 2500000,
  monthly_expenditure: 35000,
  savings: 300000,
  owns_vehicle: true,
  owns_property: true,
  has_prior_credit: true,
  has_defaulted: false,
  payment_history: 'good',
  n_prior_credits: 4,
  n_active_credits: 2,
  years_credit_history: 9,
};

async function main() {
  console.log(c.bold('FinShield backend API smoke test'));
  console.log(c.dim(`target: ${BASE_URL}`));

  // ---------------------------------------------------------------- health
  section('Health');
  const health = await check('GET  /health', 200, () => call('GET', '/health'),
    (d) => (d?.status === 'ok' ? null : `unexpected body: ${JSON.stringify(d)}`));

  if (!health) {
    console.log(c.red('\nBackend unreachable — is uvicorn running? Aborting.'));
    summarize();
    return;
  }

  // ------------------------------------------------------------------ auth
  section('Auth');
  await check('POST /auth/register', 200,
    () => call('POST', '/auth/register', { body: { email: USER_EMAIL, password: USER_PASSWORD, full_name: 'Smoke Test' } }),
    (d) => (d?.email === USER_EMAIL && d?.role === 'user' ? null : `unexpected body: ${JSON.stringify(d)}`));

  await check('POST /auth/register  rejects duplicate email', 400,
    () => call('POST', '/auth/register', { body: { email: USER_EMAIL, password: USER_PASSWORD } }));

  await check('POST /auth/register  rejects weak password', 422,
    () => call('POST', '/auth/register', { body: { email: `weak+${Date.now()}@finshield.test`, password: 'short' } }));

  const userLogin = await check('POST /auth/login/user', 200,
    () => call('POST', '/auth/login/user', { form: true, body: { username: USER_EMAIL, password: USER_PASSWORD } }),
    (d) => {
      if (!d?.access_token) return 'no access_token in response';
      if (d.role !== 'user') return `expected role "user", got "${d.role}"`;
      if (d.user?.email !== USER_EMAIL) return 'response.user does not match the account';
      return null;
    });
  userToken = userLogin?.access_token ?? null;

  await check('POST /auth/login/user  rejects wrong password', 401,
    () => call('POST', '/auth/login/user', { form: true, body: { username: USER_EMAIL, password: 'WrongPass123' } }));

  await check('POST /auth/login/admin  rejects a non-admin account', 403,
    () => call('POST', '/auth/login/admin', { form: true, body: { username: USER_EMAIL, password: USER_PASSWORD } }));

  await check('POST /auth/login  (role-agnostic, OAuth2 endpoint)', 200,
    () => call('POST', '/auth/login', { form: true, body: { username: USER_EMAIL, password: USER_PASSWORD } }),
    (d) => (d?.access_token ? null : 'no access_token in response'));

  if (userToken) {
    await check('GET  /auth/me', 200, () => call('GET', '/auth/me', { token: userToken }),
      (d) => (d?.email === USER_EMAIL ? null : `unexpected body: ${JSON.stringify(d)}`));
  } else {
    skip('GET  /auth/me', 'no user token');
  }

  await check('GET  /auth/me  rejects a missing token', 401, () => call('GET', '/auth/me'));
  await check('GET  /auth/me  rejects a malformed token', 401,
    () => call('GET', '/auth/me', { token: 'not-a-real-jwt' }));

  await check('GET  /auth/admin-only  rejects a non-admin', [401, 403],
    () => call('GET', '/auth/admin-only', { token: userToken }));

  // --------------------------------------------------------- admin session
  section('Admin auth');
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const adminLogin = await check('POST /auth/login/admin', 200,
      () => call('POST', '/auth/login/admin', { form: true, body: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD } }),
      (d) => {
        if (!d?.access_token) return 'no access_token in response';
        if (d.role !== 'admin') return `expected role "admin", got "${d.role}"`;
        return null;
      });
    adminToken = adminLogin?.access_token ?? null;

    if (adminToken) {
      await check('GET  /auth/admin-only  accepts an admin', 200,
        () => call('GET', '/auth/admin-only', { token: adminToken }));
    }
  } else {
    skip('POST /auth/login/admin', 'set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD');
  }

  // ------------------------------------------------------------------ risk
  section('Risk');
  await check('GET  /risk/schema', 200, () => call('GET', '/risk/schema'), (d) => {
    const required = ['gender', 'education', 'marital_status', 'employment_status', 'payment_history'];
    const missing = required.filter((k) => !Array.isArray(d?.[k]));
    return missing.length ? `missing dropdown lists: ${missing.join(', ')}` : null;
  });

  let assessmentId = null;
  if (userToken) {
    const assessment = await check('POST /risk/assess', 200,
      () => call('POST', '/risk/assess', { token: userToken, body: ASSESSMENT_PAYLOAD }),
      (d) => {
        // Guard the model contract: these fields are what the UI renders.
        const required = ['id', 'default_probability', 'risk_band', 'risk_score',
          'population_percentile', 'affordability', 'factors', 'model_version'];
        const missing = required.filter((k) => d?.[k] === undefined || d[k] === null);
        if (missing.length) return `missing contract fields: ${missing.join(', ')}`;
        if (typeof d.default_probability !== 'number') return 'default_probability is not a number';
        const bands = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];
        if (!bands.includes(d.risk_band)) return `unexpected risk_band "${d.risk_band}"`;
        for (const k of ['grade', 'monthly_surplus', 'emi_to_income_ratio', 'flags']) {
          if (d.affordability?.[k] === undefined) return `affordability.${k} missing`;
        }
        if (!Array.isArray(d.factors?.positive) || !Array.isArray(d.factors?.negative)) {
          return 'factors.positive/negative must be arrays';
        }
        return null;
      });
    assessmentId = assessment?.id ?? null;

    await check('POST /risk/assess  rejects an out-of-range age', 422,
      () => call('POST', '/risk/assess', { token: userToken, body: { ...ASSESSMENT_PAYLOAD, age: 7 } }));

    await check('POST /risk/assess  rejects an invalid dropdown value', 422,
      () => call('POST', '/risk/assess', { token: userToken, body: { ...ASSESSMENT_PAYLOAD, education: 'wizardry' } }));

    await check('POST /risk/assess  requires auth', 401,
      () => call('POST', '/risk/assess', { body: ASSESSMENT_PAYLOAD }));

    await check('GET  /risk/assessments', 200,
      () => call('GET', '/risk/assessments', { token: userToken }),
      (d) => (Array.isArray(d) && d.length >= 1 ? null : 'expected at least the assessment just created'));

    if (assessmentId) {
      await check('GET  /risk/assessments/:id', 200,
        () => call('GET', `/risk/assessments/${assessmentId}`, { token: userToken }),
        (d) => (d?.id === assessmentId ? null : 'returned a different assessment'));
    } else {
      skip('GET  /risk/assessments/:id', 'no assessment was created');
    }

    if (assessmentId) {
      await check('GET  /risk/assessments/compare', 200,
        () => call('GET', `/risk/assessments/compare?ids=${assessmentId}`, { token: userToken }),
        (d) => (Array.isArray(d) && d.length === 1 ? null : `expected 1 assessment, got ${Array.isArray(d) ? d.length : typeof d}`));

      await check('GET  /risk/assessments/compare  404s for an unowned id', 404,
        () => call('GET', '/risk/assessments/compare?ids=00000000-0000-0000-0000-000000000000', { token: userToken }));
    } else {
      skip('GET  /risk/assessments/compare', 'no assessment was created');
    }

    await check('GET  /risk/assessments/compare  requires the ids param', 422,
      () => call('GET', '/risk/assessments/compare', { token: userToken }));
  } else {
    for (const n of ['POST /risk/assess', 'GET  /risk/assessments', 'GET  /risk/assessments/:id']) {
      skip(n, 'no user token');
    }
  }

  // --------------------------------------------------------------- schemes
  section('Schemes');
  const schemes = await check('GET  /schemes', 200, () => call('GET', '/schemes'), (d) => {
    if (!Array.isArray(d)) return 'expected an array';
    if (d.length === 0) return 'no schemes returned — has backend/scripts/run_sync.py been run?';
    return null;
  });

  const slug = schemes?.[0]?.slug ?? null;
  if (slug) {
    await check('GET  /schemes/:slug', 200, () => call('GET', `/schemes/${slug}`),
      (d) => (d?.slug === slug ? null : 'returned a different scheme'));
  } else {
    skip('GET  /schemes/:slug', 'no schemes to look up');
  }

  await check('GET  /schemes/:slug  404s for an unknown slug', 404,
    () => call('GET', '/schemes/definitely-not-a-real-scheme'));

  await check('GET  /schemes?category=  filters', 200,
    () => call('GET', '/schemes?category=agriculture'),
    (d) => (Array.isArray(d) ? null : 'expected an array'));

  // Scheme browsing must keep working with no ML involvement and no session,
  // so quick-match runs unauthenticated.
  await check('POST /schemes/quick-match', 200,
    () => call('POST', '/schemes/quick-match', {
      body: { age: 34, gender: 'male', annual_income: 900000, state: 'Maharashtra', area_type: 'urban' },
    }),
    (d) => {
      if (!Array.isArray(d)) return 'expected an array';
      if (!d.length) return 'no schemes ranked';
      const first = d[0];
      for (const k of ['scheme', 'eligibility', 'matched_criteria_count', 'total_criteria_count']) {
        if (first?.[k] === undefined) return `ranked item missing "${k}"`;
      }
      return null;
    });

  // match takes the full assessment profile, so reuse the payload above.
  const MATCH_PROFILE = {
    age: ASSESSMENT_PAYLOAD.age,
    gender: ASSESSMENT_PAYLOAD.gender,
    education: ASSESSMENT_PAYLOAD.education,
    marital_status: ASSESSMENT_PAYLOAD.marital_status,
    dependents: ASSESSMENT_PAYLOAD.dependents,
    employment_status: ASSESSMENT_PAYLOAD.employment_status,
    years_employed: ASSESSMENT_PAYLOAD.years_employed,
    annual_income: ASSESSMENT_PAYLOAD.annual_income,
    monthly_emi: ASSESSMENT_PAYLOAD.monthly_emi,
    existing_total_debt: ASSESSMENT_PAYLOAD.existing_total_debt,
    asset_value: ASSESSMENT_PAYLOAD.asset_value,
    monthly_expenditure: ASSESSMENT_PAYLOAD.monthly_expenditure,
    savings: ASSESSMENT_PAYLOAD.savings,
    owns_vehicle: ASSESSMENT_PAYLOAD.owns_vehicle,
    owns_property: ASSESSMENT_PAYLOAD.owns_property,
    state: 'Maharashtra',
    area_type: 'urban',
    occupation_tags: ['salaried'],
  };

  await check('POST /schemes/match', 200,
    () => call('POST', '/schemes/match', { token: userToken, body: MATCH_PROFILE }),
    (d) => (Array.isArray(d) && d.length ? null : 'expected a non-empty ranked array'));

  await check('POST /schemes/match  rejects an incomplete profile', 422,
    () => call('POST', '/schemes/match', { token: userToken, body: { age: 34 } }));

  if (slug && userToken) {
    const schemeId = schemes[0].id;
    await check('GET  /schemes/:id/eligibility', 200,
      () => call('GET', `/schemes/${schemeId}/eligibility`, { token: userToken }));
  } else {
    skip('GET  /schemes/:id/eligibility', 'no scheme or user token');
  }

  // ----------------------------------------------------------- user schemes
  section('User schemes');
  if (userToken && schemes?.length) {
    const schemeId = schemes[0].id;

    await check('GET  /user-schemes', 200, () => call('GET', '/user-schemes', { token: userToken }),
      (d) => (Array.isArray(d) ? null : 'expected an array'));

    const saved = await check('POST /user-schemes', [200, 201],
      () => call('POST', '/user-schemes', { token: userToken, body: { scheme_id: schemeId } }),
      (d) => (d?.id ? null : `unexpected body: ${JSON.stringify(d)}`));

    if (saved?.id) {
      await check('PATCH /user-schemes/:id', 200,
        () => call('PATCH', `/user-schemes/${saved.id}`, { token: userToken, body: { status: 'applied' } }));
    } else {
      skip('PATCH /user-schemes/:id', 'nothing was saved');
    }

    await check('GET  /user-schemes  requires auth', 401, () => call('GET', '/user-schemes'));
  } else {
    skip('GET  /user-schemes', userToken ? 'no schemes seeded' : 'no user token');
  }

  // ----------------------------------------------------------------- admin
  section('Admin');
  if (adminToken) {
    await check('GET  /admin/stats', 200, () => call('GET', '/admin/stats', { token: adminToken }));
    await check('GET  /admin/analytics', 200, () => call('GET', '/admin/analytics', { token: adminToken }));
    await check('GET  /admin/schemes', 200, () => call('GET', '/admin/schemes', { token: adminToken }),
      (d) => (Array.isArray(d) ? null : 'expected an array'));
    await check('GET  /admin/users', 200, () => call('GET', '/admin/users', { token: adminToken }),
      (d) => (Array.isArray(d) ? null : 'expected an array'));
    await check('GET  /admin/scheme-updates', 200, () => call('GET', '/admin/scheme-updates', { token: adminToken }));
    await check('GET  /admin/audit-logs', 200, () => call('GET', '/admin/audit-logs', { token: adminToken }));

    // Non-admins must not reach the admin surface.
    await check('GET  /admin/stats  rejects a non-admin', [401, 403],
      () => call('GET', '/admin/stats', { token: userToken }));
    await check('GET  /admin/users  rejects a missing token', 401, () => call('GET', '/admin/users'));
  } else {
    for (const n of ['GET  /admin/stats', 'GET  /admin/analytics', 'GET  /admin/schemes',
      'GET  /admin/users', 'GET  /admin/scheme-updates', 'GET  /admin/audit-logs']) {
      skip(n, 'no admin token');
    }
  }

  // --------------------------------------------------------------- session
  section('Session lifecycle');
  await check('POST /auth/refresh  rejects a missing cookie', 401, () => call('POST', '/auth/refresh'));
  await check('POST /auth/logout', 200, () => call('POST', '/auth/logout'));

  summarize();
}

function summarize() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => r.ok === false);
  const skipped = results.filter((r) => r.skipped);

  console.log(`\n${c.bold('─'.repeat(60))}`);
  console.log(
    `${c.green(`${passed} passed`)}  ${failed.length ? c.red(`${failed.length} failed`) : '0 failed'}  ${skipped.length ? c.yellow(`${skipped.length} skipped`) : '0 skipped'}`
  );

  if (failed.length) {
    console.log(`\n${c.bold('Failures')}`);
    for (const f of failed) console.log(`  ${c.red('•')} ${f.name}\n    ${c.dim(f.reason)}`);
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(c.red(`\nUnexpected error: ${err.stack || err.message}`));
  process.exit(1);
});
