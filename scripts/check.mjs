// Runs build, unit tests and browser tests one after another and writes each
// step's output to logs/<step>.log, plus a summary in logs/summary.txt.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';

const steps = [
  ['build', 'npm run build'],
  ['unit', 'npm test'],
  ['e2e', 'npm run e2e']
];
const only = process.argv[2];
mkdirSync('logs', { recursive: true });
const summary = [];
for (const [name, cmd] of steps) {
  if (only && only !== name) continue;
  const log = createWriteStream(`logs/${name}.log`);
  const code = await new Promise((resolve) => {
    const p = spawn(cmd, { shell: true, env: { ...process.env, FORCE_COLOR: '0', CI: '1', PLAYWRIGHT_BROWSERS_PATH: '0' } });
    p.stdout.on('data', (d) => { process.stdout.write(d); log.write(d); });
    p.stderr.on('data', (d) => { process.stderr.write(d); log.write(d); });
    p.on('close', resolve);
  });
  log.end();
  summary.push(`${name}: ${code === 0 ? 'passed' : 'FAILED (exit ' + code + ')'}`);
  writeFileSync('logs/summary.txt', summary.join('\n') + '\n');
  if (code !== 0) break;
}
console.log('\n' + summary.join('\n'));
