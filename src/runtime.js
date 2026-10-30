/* Ponte de interface para o launcher oficial Boxedwine64. */
window.WineRuntime = (() => {
  const ROOT_ASSETS = [
    './wine64-launcher.js', './boxedwine64.js', './boxedwine64.wasm', './coi-serviceworker.js'
  ];
  const ENGINE_BASE = './engine/boxedwine64/';
  const AUTO_START_KEY = 'wineweb.runtime.autostart';
  let launchPromise = null;
  let scriptInjected = false;
  let coiScriptInjected = false;
  let controlsConfigured = false;
  let statusTimer = null;
  let runtimeWindow = null;
  let runtimeRoot = null;

  function byId(id) { return document.getElementById(id); }

  function setStatus(message, kind = 'info') {
    const node = byId('runtime-message');
    if (node) {
      node.textContent = message;
      node.dataset.kind = kind;
    }
    const badge = byId('runtime-status');
    if (badge) badge.textContent = kind === 'error' ? 'Runtime: erro' : kind === 'success' ? 'Runtime: ativo' : 'Runtime: iniciando';
    const progressLabel = document.querySelector('.runtime-progress-label');
    if (progressLabel) progressLabel.textContent = message;
    if (runtimeWindow?.status) runtimeWindow.status.textContent = message;
  }

  async function checkInstalled() {
    if (window.location.protocol === 'file:') {
      throw new Error('Você abriu o index.html diretamente. Feche esta aba e execute start-wineweb.bat; o Wine Web precisa do servidor local para carregar o motor Windows.');
    }
    let response;
    try {
      response = await fetch('./engine-assets.json', { cache: 'no-store' });
    } catch (error) {
      throw new Error(`Não foi possível acessar engine-assets.json (${error.message}). Inicie o projeto com start-wineweb.bat, não pelo arquivo index.html.`);
    }
    if (!response.ok) throw new Error(`Manifesto do motor não encontrado (HTTP ${response.status}). Execute start-wineweb.bat para instalar o Boxedwine64.`);
    const meta = await response.json();
    if (!(Number(meta?.rootfsBytes) > 0)) throw new Error('O manifesto do Boxedwine64 está incompleto. Execute novamente npm run sync-engine.');
    for (const asset of ROOT_ASSETS) {
      const head = await fetch(asset, { method: 'HEAD', cache: 'no-store' });
      if (!head.ok) throw new Error(`Arquivo do motor ausente: ${asset}. Execute npm run sync-engine.`);
    }
    const glibc = await fetch(`${ENGINE_BASE}glibc-rootfs64.zip`, { method: 'HEAD', cache: 'no-store' });
    const prefix = await fetch(`${ENGINE_BASE}prefix64.zip`, { method: 'HEAD', cache: 'no-store' });
    const wineManifest = await fetch(`${ENGINE_BASE}wine64.zip.manifest.json`, { method: 'HEAD', cache: 'no-store' });
    const wineWhole = await fetch(`${ENGINE_BASE}wine64.zip`, { method: 'HEAD', cache: 'no-store' });
    if (!(glibc.ok && prefix.ok && (wineManifest.ok || wineWhole.ok))) {
      throw new Error('Os arquivos do sistema Wine estão incompletos. Execute novamente npm run sync-engine.');
    }
    return true;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Não foi possível carregar ${src}.`));
      document.head.appendChild(script);
    });
  }

  async function ensureIsolation() {
    if (window.crossOriginIsolated === true) return true;
    if (!window.isSecureContext) {
      throw new Error('O runtime precisa de HTTPS ou localhost. Abra pelo npm start, não por file://.');
    }
    if (!('serviceWorker' in navigator)) {
      throw new Error('Este navegador não oferece Service Worker para ativar o isolamento COOP/COEP.');
    }

    try { sessionStorage.setItem(AUTO_START_KEY, '1'); } catch {}
    if (!coiScriptInjected && !document.querySelector('script[data-wineweb-coi]')) {
      coiScriptInjected = true;
      const script = document.createElement('script');
      script.src = './coi-serviceworker.js';
      script.async = true;
      script.dataset.winewebCoi = 'true';
      const loadPromise = new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(new Error('Não foi possível carregar o ativador de isolamento do Boxedwine64.'));
      });
      document.head.appendChild(script);
      await loadPromise;
    }

    setStatus('Ativando o isolamento exigido pelo WebAssembly multi-thread; a página pode recarregar…');
    const start = Date.now();
    while (Date.now() - start < 18000) {
      if (window.crossOriginIsolated === true) return true;
      await new Promise(resolve => window.setTimeout(resolve, 250));
    }
    throw new Error('O navegador não ativou crossOriginIsolated. Tente Chrome/Edge recentes, HTTPS ou localhost e recarregue a página.');
  }

  function applyLauncherOptions() {
    const url = new URL(window.location.href);
    url.searchParams.set('base', ENGINE_BASE);
    url.searchParams.set('p', 'notepad.exe');
    url.searchParams.delete('chunked');
    url.searchParams.delete('boot');
    url.searchParams.delete('novideo');
    window.history.replaceState(window.history.state, '', url);
  }

  async function launchProgram(program) {
    const ready = await mount(runtimeRoot, runtimeWindow);
    if (!ready) return;
    if (typeof window.launchApp !== 'function') {
      throw new Error('O launcher carregou, mas não disponibilizou launchApp().');
    }
    window.launchApp(program);
  }

  function configureControls() {
    if (controlsConfigured) return;
    controlsConfigured = true;
    const exe = byId('runtime-exe-input');
    const folder = byId('runtime-folder-input');
    byId('runtime-exe-button')?.addEventListener('click', () => exe?.click());
    byId('runtime-folder-button')?.addEventListener('click', () => folder?.click());

    exe?.addEventListener('change', async () => {
      const file = exe.files?.[0];
      try { if (file) await importFile(file); }
      catch (error) { setStatus(error.message, 'error'); }
      exe.value = '';
    });
    folder?.addEventListener('change', async () => {
      try {
        if (!folder.files?.length) return;
        const ready = await mount(runtimeRoot, runtimeWindow);
        if (!ready) return;
        if (typeof window.bw64ImportFolderInput !== 'function') {
          throw new Error('O launcher não publicou bw64ImportFolderInput().');
        }
        window.bw64ImportFolderInput(folder);
        setStatus('Enviando pasta ao sistema de arquivos C:\\Apps do Wine…');
      } catch (error) {
        setStatus(error.message, 'error');
      }
    });

    byId('runtime-download-button')?.addEventListener('click', () => {
      if (typeof window.downloadSavedFiles === 'function') window.downloadSavedFiles();
      else setStatus('A exportação ficará disponível após o carregamento do launcher.', 'error');
    });
    byId('runtime-fullscreen-button')?.addEventListener('click', () => window.bw64Fullscreen?.());
    byId('runtime-lockmouse-button')?.addEventListener('click', () => window.bw64LockMouse?.());
    byId('runtime-copy-button')?.addEventListener('click', () => window.bw64CopyFromApp?.());
    byId('runtime-paste-button')?.addEventListener('click', () => window.bw64PasteToApp?.());

    document.querySelectorAll('[data-wine-program]').forEach(button => {
      button.addEventListener('click', () => {
        const program = button.getAttribute('data-wine-program');
        launchProgram(program).catch(error => setStatus(error.message, 'error'));
      });
    });
    window.setActiveApp = program => {
      document.querySelectorAll('[data-wine-program]').forEach(button => {
        button.setAttribute('aria-pressed', button.getAttribute('data-wine-program') === program ? 'true' : 'false');
      });
    };
  }

  function injectLauncher() {
    if (scriptInjected || window.launchApp) return Promise.resolve();
    scriptInjected = true;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './wine64-launcher.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        scriptInjected = false;
        reject(new Error('Não foi possível carregar wine64-launcher.js. Execute npm run sync-engine.'));
      };
      document.body.appendChild(script);
    });
  }

  async function waitForSession(timeoutMs = 10 * 60 * 1000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (typeof window.bw64SessionReady === 'function') {
        try {
          if (window.bw64SessionReady()) {
            setStatus('Sessão Wine iniciada. Pronto para importar programas.', 'success');
            return true;
          }
        } catch (error) {
          throw new Error(`Falha ao consultar a sessão Wine: ${error.message}`);
        }
      }
      const elapsed = Date.now() - start;
      if (elapsed > 15000 && elapsed % 10000 < 1000) {
        setStatus('Wine ainda inicializando; o primeiro carregamento pode levar vários minutos…');
      }
      await new Promise(resolve => window.setTimeout(resolve, 500));
    }
    throw new Error('A sessão Wine não ficou pronta em 10 minutos. Consulte os logs do runtime e o console do navegador.');
  }

  async function mount(root, win) {
    if (root) runtimeRoot = root;
    if (win) runtimeWindow = win;
    configureControls();
    if (launchPromise) return launchPromise;

    launchPromise = (async () => {
      const installed = await checkInstalled();
      if (!installed) return false;
      const isolated = await ensureIsolation();
      if (!isolated) return false;
      applyLauncherOptions();
      setStatus('Carregando Boxedwine64 e os arquivos do Wine…');
      await injectLauncher();
      if (statusTimer) window.clearInterval(statusTimer);
      statusTimer = window.setInterval(() => {
        const upstream = byId('status')?.textContent?.trim();
        const progress = byId('progress');
        if (upstream) setStatus(upstream);
        if (progress && !progress.hidden && progress.max > 0) {
          const percent = Math.round((progress.value / progress.max) * 100);
          const label = document.querySelector('.runtime-progress-label');
          if (label) label.textContent = `${percent}% — ${upstream || 'Carregando'}`;
        }
      }, 800);
      await waitForSession();
      return true;
    })().catch(error => {
      launchPromise = null;
      setStatus(error.message || String(error), 'error');
      throw error;
    });
    return launchPromise;
  }

  async function importFile(file) {
    if (!file) return;
    const ready = await mount(runtimeRoot, runtimeWindow);
    if (!ready) return;
    if (typeof window.bw64ImportFile !== 'function') {
      throw new Error('O launcher carregou, mas não publicou bw64ImportFile(). Verifique os arquivos sincronizados.');
    }
    window.bw64ImportFile(file);
    setStatus(`Enviando ${file.name} ao ambiente Wine…`);
  }

  async function runStoredFile(record) {
    if (!record || !(record.data instanceof ArrayBuffer)) {
      throw new Error('O arquivo armazenado não contém dados válidos. Importe-o novamente.');
    }
    if (!/\.(exe|zip)$/i.test(record.name)) {
      throw new Error('O Explorador só envia arquivos .exe e .zip ao runtime.');
    }
    await window.WineApps.open('runtime');
    const file = new File([record.data], record.name, {
      type: record.type || 'application/octet-stream',
      lastModified: record.modified || Date.now()
    });
    await importFile(file);
  }

  function consumeAutoStart() {
    try {
      if (sessionStorage.getItem(AUTO_START_KEY) !== '1') return false;
      sessionStorage.removeItem(AUTO_START_KEY);
      return true;
    } catch {
      return false;
    }
  }

  return { mount, importFile, runStoredFile, consumeAutoStart, checkInstalled };
})();
