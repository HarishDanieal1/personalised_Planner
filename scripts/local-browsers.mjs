// Runs a command with PLAYWRIGHT_BROWSERS_PATH=0 so Playwright keeps its browser
// inside this project's node_modules instead of a shared folder on the computer.
// Usage: node scripts/local-browsers.mjs <command> [args...]
import { spawn } from 'node:child_process';

const [cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' }
});
child.on('close', (code) => process.exit(code ?? 1));
