import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const files = [
  'index.html', 'styles.css', 'README.md', 'THIRD_PARTY_NOTICES.md', 'start-wineweb.bat',
  'src/main.js', 'src/apps.js', 'src/runtime.js', 'src/storage.js', 'src/window-manager.js',
  'tools/dev-server.mjs', 'tools/sync-boxedwine64.mjs', 'engine/boxedwine64/README.md',
  '.github/workflows/publish-wineweb.yml'
];
let failed = false;
for (const file of files) {
  try {
    await access(resolve(root, file));
    const body = await readFile(resolve(root, file), 'utf8');
    if (!body.trim()) throw new Error('arquivo vazio');
    console.log(`OK ${file}`);
  } catch (error) {
    failed = true;
    console.error(`ERRO ${file}: ${error.message}`);
  }
}
for (const file of ['src/main.js', 'src/apps.js', 'src/runtime.js', 'src/storage.js', 'src/window-manager.js', 'tools/dev-server.mjs', 'tools/sync-boxedwine64.mjs']) {
  const result = await import('node:child_process').then(({ execFileSync }) => {
    try { execFileSync(process.execPath, ['--check', resolve(root, file)], { stdio: 'pipe' }); return true; }
    catch (e) { console.error(e.stderr?.toString() || e.message); return false; }
  });
  console.log(`${result ? 'OK' : 'ERRO'} sintaxe ${file}`);
  if (!result) failed = true;
}
if (!failed) {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const apps = await readFile(resolve(root, 'src/apps.js'), 'utf8');
  const runtime = await readFile(resolve(root, 'src/runtime.js'), 'utf8');
  const requiredHooks = ['runtime-message', 'status', 'progress', 'spinner', 'canvas', 'gl64canvas', 'dropzone', 'output', 'exeArgs', 'exeChooser', 'myAppsRow', 'myApps', 'runtime-exe-input', 'runtime-folder-input'];
  for (const hook of requiredHooks) {
    if (!html.includes(hook) && !apps.includes(hook) && !runtime.includes(hook)) {
      console.error(`ERRO integração: elemento ${hook} não foi encontrado`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('\nChecagem estática concluída. Isso não equivale a iniciar o WASM nem executar um EXE.');
