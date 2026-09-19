#!/usr/bin/env node
// P3.20: повторяемый нагрузочный/soak-прогон против КОПИИ окружения
// (никогда против прода). Без внешних зависимостей — Node >= 18 (fetch).
//
//   node scripts/load-test.mjs
//   LOAD_BASE_URL=http://staging.local:3000 LOAD_DURATION_SEC=600 LOAD_CONCURRENCY=32 node scripts/load-test.mjs
//
// Сценарии (веса): расписание, слоты, серверная сводка выручки (тяжёлый
// SQL P3.19), пагинированный реестр, публичный health. Токен получается
// одним логином; заказы/фото сознательно не создаём — прогон не должен
// портить данные копии.
//
// Что смотрим (по исходному backlog):
//  - задержки p50/p95/p99 и error rate по сценариям;
//  - RSS/heap из /api/health каждые SAMPLE_SEC — рост без возврата = утечка (P3.17);
//  - worker в /api/health — распределение по воркерам PM2 (P3.18);
//  - число соединений Postgres против лимита пула (P3.14), если задан
//    LOAD_PG_DOCKER (имя контейнера с psql).
//
// На время прогона поднимать rate-limit API, иначе глобальный 120 req/min
// на IP забьёт ответами 429: API_RATE_LIMIT=100000 (и LOGIN_* для логина).
//
// Отчёт: консоль + load-reports/report-<ts>.md (gitignored). Порог ошибки
// LOAD_MAX_ERROR_RATE (дефолт 1%) делает прогон красным — удобно для CI.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.LOAD_BASE_URL ?? 'http://127.0.0.1:3000';
const DURATION_SEC = Number(process.env.LOAD_DURATION_SEC ?? 60);
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 16);
const THINK_MS = Number(process.env.LOAD_THINK_MS ?? 150);
const SAMPLE_SEC = Number(process.env.LOAD_SAMPLE_SEC ?? 5);
const MAX_ERROR_RATE = Number(process.env.LOAD_MAX_ERROR_RATE ?? 0.01);
const EMAIL = process.env.LOAD_EMAIL ?? 'ceo@siberiangym.ru';
const PASSWORD = process.env.LOAD_PASSWORD ?? 'change-me-12345';
const PG_DOCKER = process.env.LOAD_PG_DOCKER ?? '';
const PG_LIMIT = Number(process.env.LOAD_PG_LIMIT ?? 0);

const SCENARIOS = [
  { name: 'group-classes', weight: 3, path: '/api/group-classes' },
  { name: 'personal-slots', weight: 2, path: '/api/personal-slots' },
  { name: 'summary', weight: 1, path: '/api/transactions/summary?days=30' },
  { name: 'feed', weight: 1, path: '/api/transactions?page=1&pageSize=20' },
  { name: 'health', weight: 1, path: '/api/health', public: true },
];
const WEIGHT_SUM = SCENARIOS.reduce((acc, s) => acc + s.weight, 0);

const percentile = (sorted, p) => (sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);

const stats = new Map(SCENARIOS.map((s) => [s.name, { count: 0, errors: 0, latencies: [], statuses: new Map() }]));
const samples = [];
const workerCounts = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${res.status}: подставьте LOAD_EMAIL/LOAD_PASSWORD (или LOGIN_RATE_LIMIT) — ${await res.text()}`.slice(0, 300));
  const body = await res.json();
  if (!body.accessToken) throw new Error(`login без токена (2FA?): ответ ${JSON.stringify(body).slice(0, 200)}`);
  return body.accessToken;
}

function pickScenario() {
  let ticket = Math.random() * WEIGHT_SUM;
  for (const s of SCENARIOS) {
    ticket -= s.weight;
    if (ticket <= 0) return s;
  }
  return SCENARIOS[0];
}

async function virtualUser(token, deadline) {
  while (Date.now() < deadline) {
    const s = pickScenario();
    const started = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${s.path}`, {
        headers: s.public ? {} : { Authorization: `Bearer ${token}` },
      });
      const st = stats.get(s.name);
      st.count += 1;
      st.latencies.push(performance.now() - started);
      st.statuses.set(res.status, (st.statuses.get(res.status) ?? 0) + 1);
      if (res.status >= 400) st.errors += 1;
    } catch (err) {
      const st = stats.get(s.name);
      st.count += 1;
      st.errors += 1;
      const code = err?.cause?.code ?? err?.code ?? 'unknown';
      st.statuses.set(`ERR:${code}`, (st.statuses.get(`ERR:${code}`) ?? 0) + 1);
    }
    if (THINK_MS > 0) await sleep(THINK_MS * (0.5 + Math.random()));
  }
}

async function pgConnections() {
  if (!PG_DOCKER) return undefined;
  try {
    const r = spawnSync('docker', [
      'exec', PG_DOCKER, 'psql', '-U', process.env.LOAD_PG_USER ?? 'siberiangym',
      '-d', process.env.LOAD_PG_DB ?? 'siberiangym', '-t', '-A',
      '-c', "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()",
    ], { timeout: 5000, encoding: 'utf8' });
    const n = Number((r.stdout ?? '').trim());
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

async function sampler(deadline) {
  while (Date.now() < deadline) {
    await sleep(Math.min(SAMPLE_SEC * 1000, deadline - Date.now()));
    if (Date.now() >= deadline) break;
    try {
      const res = await fetch(`${BASE_URL}/api/health`, { headers: {} });
      const h = await res.json();
      const rec = {
        t: new Date().toISOString(),
        rss: h.memoryMb?.rss,
        heapUsed: h.memoryMb?.heapUsed,
        worker: h.worker,
        pg: await pgConnections(),
      };
      samples.push(rec);
      workerCounts.set(rec.worker, (workerCounts.get(rec.worker) ?? 0) + 1);
      process.stdout.write(`[${rec.t.slice(11, 19)}] rss=${rec.rss}MB heap=${rec.heapUsed}MB worker=${rec.worker}${rec.pg !== undefined ? ` pg=${rec.pg}${PG_LIMIT ? `/${PG_LIMIT}` : ''}` : ''}\n`);
    } catch (err) {
      process.stdout.write(`[sampler] health недоступен: ${err.message}\n`);
    }
  }
}

const fmt = (n) => Math.round(n);

function report(totalReq, totalErr, wallSec) {
  const lines = [];
  const overall = [...stats.values()].flatMap((s) => s.latencies).sort((a, b) => a - b);
  lines.push(`# Load report — ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`- Цель: \`${BASE_URL}\`, длительность ${DURATION_SEC}s, параллелизм ${CONCURRENCY}, think ${THINK_MS}ms`);
  lines.push(`- Запросов: ${totalReq}, ошибок: ${totalErr} (${((100 * totalErr) / Math.max(1, totalReq)).toFixed(2)}%), RPS: ${(totalReq / Math.max(1, wallSec)).toFixed(1)}`);
  if (overall.length) {
    lines.push(`- Задержки всего: p50=${fmt(percentile(overall, 50))}ms p95=${fmt(percentile(overall, 95))}ms p99=${fmt(percentile(overall, 99))}ms max=${fmt(overall[overall.length - 1])}ms`);
  }
  lines.push('');
  lines.push('| Сценарий | Запросов | Ошибок | p50 | p95 | p99 | Коды ответов |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const s of SCENARIOS) {
    const st = stats.get(s.name);
    const sorted = [...st.latencies].sort((a, b) => a - b);
    const codes = [...st.statuses.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}: ${n}`).join(', ');
    lines.push(`| ${s.name} | ${st.count} | ${st.errors} | ${sorted.length ? fmt(percentile(sorted, 50)) : '-'} | ${sorted.length ? fmt(percentile(sorted, 95)) : '-'} | ${sorted.length ? fmt(percentile(sorted, 99)) : '-'} | ${codes} |`);
  }
  if (samples.length) {
    const rssSeries = samples.map((x) => x.rss).filter(Number.isFinite);
    lines.push('');
    lines.push(`- Память (из /api/health): rss ${Math.min(...rssSeries)}→${Math.max(...rssSeries)} MB по ${samples.length} замерам; рост без возврата = симптом утечки (P3.17)`);
    lines.push(`- Распределение по воркерам PM2: ${[...workerCounts.entries()].map(([w, c]) => `${w}: ${c}`).join(', ') || '—'} — все воркеры должны отвечать (P3.18)`);
    const pgSeries = samples.map((x) => x.pg).filter(Number.isFinite);
    if (pgSeries.length) {
      lines.push(`- Соединения Postgres: max ${Math.max(...pgSeries)}${PG_LIMIT ? ` из лимита ${PG_LIMIT} (P3.14)` : ''}`);
    }
  }
  return lines.join('\n');
}

async function main() {
  console.log(`Нагрузочный прогон: ${BASE_URL}, ${DURATION_SEC}s, VU=${CONCURRENCY}`);
  const token = await login();
  const deadline = Date.now() + DURATION_SEC * 1000;
  const started = Date.now();
  await Promise.all([sampler(deadline), ...Array.from({ length: CONCURRENCY }, () => virtualUser(token, deadline))]);
  const wallSec = (Date.now() - started) / 1000;

  const totalReq = [...stats.values()].reduce((acc, s) => acc + s.count, 0);
  const totalErr = [...stats.values()].reduce((acc, s) => acc + s.errors, 0);
  const md = report(totalReq, totalErr, wallSec);
  console.log('\n' + md);

  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'load-reports');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
  writeFileSync(file, md + '\n', 'utf8');
  console.log(`\nОтчёт: ${file}`);

  const errorRate = totalReq === 0 ? 1 : totalErr / totalReq;
  if (errorRate > MAX_ERROR_RATE) {
    console.error(`FAIL: error rate ${(errorRate * 100).toFixed(2)}% > порога ${(MAX_ERROR_RATE * 100).toFixed(2)}%`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
