import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
function walk(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, f.name);
    if (f.isDirectory()) walk(path);
    else if (f.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status) process.exit(result.status);
    }
  }
}
for (const dir of ['src', 'public', 'scripts', 'tests', 'backend', 'bot-shared', 'migrations']) walk(dir);
console.log('Sintaxe JavaScript verificada.');
