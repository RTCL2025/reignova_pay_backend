'use strict';

// Wraps `sequelize-cli migration:create` / `sequelize-cli seed:create`.
//
// sequelize-cli hardcodes a .js extension for generated files. This package
// is ESM ("type": "module"), so a .js migration/seeder throws
// "module is not defined in ES module scope" the moment umzug requires it —
// the very next `db:migrate` after scaffolding dies. This wrapper runs the
// normal generator, then renames whatever it just emitted from .js to .cjs.
//
// Usage:
//   node scripts/generate.cjs migration --name add-foo-column
//   node scripts/generate.cjs seed --name demo-data

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const KIND_CONFIG = {
  migration: {
    cliCommand: 'migration:create',
    dir: path.resolve(__dirname, '..', 'src', 'migrations'),
  },
  seed: {
    cliCommand: 'seed:create',
    dir: path.resolve(__dirname, '..', 'src', 'seeders'),
  },
};

const [, , kind, ...cliArgs] = process.argv;
const kindConfig = KIND_CONFIG[kind];

if (!kindConfig) {
  console.error(`Usage: node scripts/generate.cjs <migration|seed> --name <name>`);
  console.error(`Got kind: ${JSON.stringify(kind)}`);
  process.exit(1);
}

function listJsFiles(dir) {
  return new Set(fs.readdirSync(dir).filter((name) => name.endsWith('.js')));
}

function quoteArg(arg) {
  return /\s/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

const before = listJsFiles(kindConfig.dir);

// A single command string (rather than a program + args array) avoids
// Node's DEP0190 warning, which fires whenever args are combined with
// shell: true. shell: true is kept for Windows compatibility, where
// sequelize-cli is a .cmd/.ps1 shim that spawnSync cannot exec directly.
const command = `sequelize-cli ${kindConfig.cliCommand} ${cliArgs.map(quoteArg).join(' ')}`.trim();

const result = spawnSync(command, {
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  console.error(`\ngenerate.cjs: "${command}" failed.`);
  process.exit(result.status === null ? 1 : result.status);
}

const after = listJsFiles(kindConfig.dir);
const created = [...after].filter((name) => !before.has(name));

if (created.length === 0) {
  console.error(
    `generate.cjs: sequelize-cli reported success but no new .js file appeared in ${kindConfig.dir}.`
  );
  process.exit(1);
}

if (created.length > 1) {
  console.error(
    `generate.cjs: expected exactly one new file in ${kindConfig.dir}, found ${created.length}: ${created.join(', ')}. Rename manually.`
  );
  process.exit(1);
}

const [createdName] = created;
const fromPath = path.join(kindConfig.dir, createdName);
const toPath = fromPath.replace(/\.js$/, '.cjs');

fs.renameSync(fromPath, toPath);

console.log(`\nCreated ${toPath}`);
