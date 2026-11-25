import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const advisoryId = 'GHSA-fc5q-39xc-vjpf';
const advisoryUrl = `https://github.com/advisories/${advisoryId}`;
const reviewDeadline = '2026-12-01';
const allowedPackages = new Set([
  '@vitejs/plugin-react',
  'fdir',
  'picomatch',
  'tinyglobby',
  'vite',
  'vitest',
]);

function fail(message) {
  console.error(`npm audit: ${message}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
if (today >= reviewDeadline) {
  fail(
    `la excepción temporal venció el ${reviewDeadline}; revisa el aviso upstream y renueva o elimina la excepción.`,
  );
}

const isWindows = process.platform === 'win32';
const audit = spawnSync(
  isWindows ? process.env.ComSpec || 'cmd.exe' : 'npm',
  isWindows
    ? ['/d', '/s', '/c', 'npm audit --audit-level=high --json']
    : ['audit', '--audit-level=high', '--json'],
  {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  },
);

if (audit.error) fail(`no se pudo ejecutar npm audit: ${audit.error.message}`);

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  fail(`npm audit no devolvió JSON válido. ${audit.stderr || ''}`);
}

const severe = Object.entries(report.vulnerabilities ?? {}).filter(([, item]) =>
  ['high', 'critical'].includes(item.severity),
);

if (severe.length === 0 && audit.status === 0) {
  console.log('npm audit: no hay vulnerabilidades altas o críticas.');
  process.exit(0);
}

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const lockPackages = lock.packages ?? {};
const packageNode = (name, path) => lockPackages[path ?? `node_modules/${name}`];

const picomatch = report.vulnerabilities?.picomatch;
const picomatchAdvisories = (picomatch?.via ?? []).filter((item) => typeof item === 'object');
if (
  !picomatch ||
  picomatch.severity !== 'high' ||
  picomatchAdvisories.length !== 1 ||
  picomatchAdvisories[0].url !== advisoryUrl
) {
  fail('la alerta de picomatch no coincide exactamente con la excepción documentada.');
}

const expectedChain = new Set([
  'picomatch',
  'fdir',
  'tinyglobby',
  'vite',
  'vitest',
  '@vitejs/plugin-react',
]);
for (const [name, item] of severe) {
  if (!expectedChain.has(name) || !allowedPackages.has(name)) {
    fail(`se detectó una vulnerabilidad alta/crítica fuera de la excepción: ${name}.`);
  }

  for (const node of item.nodes ?? []) {
    const locked = packageNode(name, node);
    if (!locked || locked.dev !== true) {
      fail(`${name} no está confirmado como dependencia de desarrollo en package-lock.json.`);
    }
  }

  if (name !== 'picomatch') {
    const via = item.via ?? [];
    if (
      via.length === 0 ||
      via.some((dependency) => typeof dependency !== 'string' || !expectedChain.has(dependency))
    ) {
      fail(`${name} tiene una causa de auditoría no cubierta por la excepción de picomatch.`);
    }
  }
}

const lockedPicomatch = packageNode('picomatch');
if (!lockedPicomatch || lockedPicomatch.version !== '4.0.7' || lockedPicomatch.dev !== true) {
  fail('la versión o el alcance de picomatch cambió; revisa la excepción antes de continuar.');
}

console.warn(
  `::warning title=Excepción temporal npm audit::Se permite solo ${advisoryId} y su cadena indirecta de herramientas de desarrollo. Revisión obligatoria antes del ${reviewDeadline}.`,
);
console.warn(`Excepción documentada: ${advisoryUrl}`);
console.warn('Cualquier otra vulnerabilidad alta/crítica, dependencia de producción o cambio de versión mantiene el check en fallo.');
