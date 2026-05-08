import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = ['index.html', 'src/app.js', 'src/styles.css'];
for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing required file: ${file}`);
}

execFileSync(process.execPath, ['--check', 'src/app.js'], { stdio: 'inherit' });

const html = readFileSync('index.html', 'utf8');
const app = readFileSync('src/app.js', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');
for (const expected of ['Users Master', 'Tasks Hub', 'My Tasks']) {
  if (!app.includes(expected)) throw new Error(`Missing section text: ${expected}`);
}
if (!html.includes('/src/app.js')) throw new Error('HTML does not load app.js');
if (!css.includes('.modal-backdrop')) throw new Error('Confirmation modal styles missing');
console.log('Validation passed: app files, syntax, core sections, and modal styles are present.');
