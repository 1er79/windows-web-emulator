import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const engineDir = join(projectRoot, 'engine', 'boxedwine64');
const pagesBase = (process.env.BOXEDWINE64_PAGES_BASE || 'https://andrewnakas.github.io/Boxedwine64/').replace(/\/?$/, '/');
const apiRelease = 'https://api.github.com/repos/andrewnakas/Boxedwine64/releases/tags/rootfs-pages';
const headers = { 'User-Agent': 'Wine-Web-runtime-sync/0.2', 'Accept': 'application/vnd.github+json' };

async function request(url, extraHeaders = {}) {
  const response = await fetch(url, { headers: { ...headers, ...extraHeaders }, redirect: 'follow' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} ao baixar ${url}`);
  return response;
}

async function download(url, destination, label = destination) {
  await mkdir(dirname(destination), { recursive: true });
  const response = await request(url, { Accept: '*/*' });
  if (!response.body) throw new Error(`Resposta sem conteúdo: ${url}`);
  const temp = `${destination}.partial`;
  await rm(temp, { force: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temp));
  await rename(temp, destination);
  const size = (await stat(destination)).size;
  console.log(`OK ${label} — ${(size / 1048576).toFixed(1)} MB`);
  return size;
}

async function fetchJson(url) {
  const response = await request(url);
  return response.json();
}

async function main() {
  await mkdir(engineDir, { recursive: true });
  console.log(`Sincronizando launcher e WASM de ${pagesBase}`);

  const rootAssets = [
    'wine64-launcher.js',
    'coi-serviceworker.js',
    'boxedwine64.js',
    'boxedwine64.wasm'
  ];
  const rootSizes = {};
  for (const name of rootAssets) {
    rootSizes[name] = await download(new URL(name, pagesBase), join(projectRoot, name), name);
  }

  // Alguns builds do Emscripten geram worker separado; outros incorporam o bootstrap
  // de workers no JS principal. Baixamos o arquivo apenas quando o deployment o expõe.
  for (const optional of ['boxedwine64.worker.js', 'boxedwine.css']) {
    try { await download(new URL(optional, pagesBase), join(projectRoot, optional), optional); }
    catch (error) { console.log(`Opcional ausente (${optional}): ${error.message}`); }
  }

  console.log('Obtendo os arquivos do rootfs pela release pública rootfs-pages…');
  const release = await fetchJson(apiRelease);
  if (!Array.isArray(release.assets) || !release.assets.length) {
    throw new Error('A release rootfs-pages não retornou assets. Verifique o repositório Boxedwine64.');
  }
  const wanted = release.assets.filter(asset =>
    /\.zip$/i.test(asset.name) || /\.zip\.part\d+$/i.test(asset.name) || /\.zip\.manifest\.json$/i.test(asset.name)
  );
  if (!wanted.some(asset => asset.name === 'glibc-rootfs64.zip')) throw new Error('glibc-rootfs64.zip não está na release rootfs-pages.');
  if (!wanted.some(asset => asset.name === 'prefix64.zip')) throw new Error('prefix64.zip não está na release rootfs-pages.');

  const assetSizes = {};
  for (const asset of wanted) {
    assetSizes[asset.name] = await download(asset.browser_download_url, join(engineDir, asset.name), asset.name);
  }

  const manifestPath = join(engineDir, 'wine64.zip.manifest.json');
  let wineManifest = null;
  try { wineManifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch {}
  if (wineManifest) {
    const parts = Array.isArray(wineManifest.parts) ? wineManifest.parts : [];
    let assembledBytes = 0;
    for (const part of parts) {
      const partPath = resolve(engineDir, part);
      if (!partPath.startsWith(engineDir + sep)) {
        throw new Error(`Caminho de parte inválido no manifesto: ${part}`);
      }
      try { assembledBytes += (await stat(partPath)).size; }
      catch { throw new Error(`Parte do rootfs ausente no pacote: ${part}`); }
    }
    if (Number(wineManifest.totalBytes) <= 0 || parts.length === 0 || assembledBytes !== Number(wineManifest.totalBytes)) {
      throw new Error(`Manifesto wine64.zip.manifest.json inválido: declarado ${wineManifest.totalBytes} bytes, arquivos ${assembledBytes} bytes, partes ${parts.length}.`);
    }
  } else if (!wanted.some(asset => asset.name === 'wine64.zip')) {
    throw new Error('A release não contém wine64.zip nem wine64.zip.manifest.json.');
  }

  for (const required of ['glibc-rootfs64.zip', 'prefix64.zip']) {
    const first = await readFile(join(engineDir, required));
    if (first.length < 4 || first[0] !== 0x50 || first[1] !== 0x4b) {
      throw new Error(`${required} não parece ser um ZIP válido.`);
    }
  }

  // Expor o estado de instalação ao frontend. A função bw64SessionReady é publicada
  // por um pequeno patch determinístico na função privada real do launcher.
  const launcherPath = join(projectRoot, 'wine64-launcher.js');
  let launcher = await readFile(launcherPath, 'utf8');
  const sessionFunction = /function sessionReady\(\)\s*\{\s*return callExport\("bw64_session_ready",\s*\[\],\s*\[\]\)\s*===\s*1;\s*\}/;
  if (!sessionFunction.test(launcher)) {
    throw new Error('A API sessionReady do launcher mudou. Não apliquei patch; revise a nova versão antes de continuar.');
  }
  if (!launcher.includes('window.bw64SessionReady = sessionReady')) {
    launcher = launcher.replace(sessionFunction, match => `${match}\n    window.bw64SessionReady = sessionReady;`);
    await writeFile(launcherPath, launcher);
  }

  const metadata = {
    product: 'Wine Web',
    runtime: 'Boxedwine64',
    syncedAt: new Date().toISOString(),
    pagesBase,
    release: { tag: release.tag_name, name: release.name, publishedAt: release.published_at },
    launcherApiPatch: 'window.bw64SessionReady exposes the launcher internal bw64_session_ready() result',
    rootAssets: rootSizes,
    engineAssets: assetSizes,
    rootfsBytes: wineManifest?.totalBytes ?? assetSizes['wine64.zip'] ?? null,
    rootfsManifest: wineManifest ? 'engine/boxedwine64/wine64.zip.manifest.json' : null
  };
  await writeFile(join(projectRoot, 'engine-assets.json'), JSON.stringify(metadata, null, 2) + '\n');
  console.log('\nRuntime instalado. Execute `npm start` e abra http://127.0.0.1:4173/.');
  console.log('O primeiro boot do Wine pode demorar e consumir bastante memória.');
}

main().catch(error => {
  console.error(`\nFalha ao sincronizar Boxedwine64: ${error.message}`);
  process.exitCode = 1;
});
