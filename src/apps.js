window.WineApps = (() => {
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (label, fn, cls = "win-button") => {
    const b = el("button", cls, label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  };
  const opened = new Map();

  async function filesApp() {
    const root = el("div", "files-app");
    const toolbar = el("div", "toolbar");
    toolbar.append(
      button("Adicionar arquivos", () => document.getElementById("file-picker").click()),
      button("Atualizar", render)
    );
    const hint = el("p", "muted", "Arquivos guardados neste navegador. EXE e ZIP podem ser enviados ao Boxedwine64 depois que o motor estiver instalado e a sessão Wine estiver pronta.");
    const list = el("div", "file-list");
    root.append(toolbar, hint, list);

    async function render() {
      list.replaceChildren();
      try {
        const files = await WineStorage.listFiles();
        if (!files.length) {
          list.append(el("p", "muted", "Nenhum arquivo armazenado."));
          return;
        }
        for (const file of files) {
          const row = el("div", "file-row");
          const info = el("span", "file-info", `📄 ${file.name} — ${formatSize(file.size)}`);
          const inspect = button("Analisar", () => inspectFile(file));
          row.append(info, inspect);
          if (/\.(exe|zip)$/i.test(file.name)) {
            const run = button("Executar", async () => {
              run.disabled = true;
              run.textContent = "Enviando…";
              try {
                await WineRuntime.runStoredFile(file);
              } catch (error) {
                const runtime = opened.get("runtime");
                if (runtime?.status) runtime.status.textContent = `Falha: ${error.message}`;
                else alert(`Não foi possível iniciar o runtime: ${error.message}`);
              } finally {
                run.disabled = false;
                run.textContent = "Executar";
              }
            });
            run.title = "Importar este arquivo para a sessão Wine";
            row.append(run);
          }
          const remove = button("Excluir", async () => {
            await WineStorage.deleteFile(file.id);
            await render();
          });
          row.append(remove);
          list.append(row);
        }
      } catch (error) {
        list.append(el("p", "notice", `Erro no armazenamento: ${error.message}`));
      }
    }
    await render();
    return root;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function inspectFile(file) {
    const root = el("div");
    root.append(el("h3", "", file.name));
    const panel = el("div", "panel");
    const lines = [
      `Nome: ${file.name}`,
      `Tamanho: ${formatSize(file.size)}`,
      `Tipo MIME: ${file.type || "não informado"}`,
      `Última modificação: ${file.modified ? new Date(file.modified).toLocaleString("pt-BR") : "desconhecida"}`
    ];
    const bytes = file.data;
    const view = bytes instanceof ArrayBuffer && bytes.byteLength >= 2 ? new DataView(bytes) : null;
    const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
    let format = "Arquivo desconhecido";
    let detail = "O formato ainda não foi reconhecido pelo inspetor.";

    if (ext === "bat") {
      format = "Script de comandos DOS/Windows (.BAT)";
      detail = "O runtime atual não integra um interpretador de comandos para executar arquivos BAT diretamente.";
    } else if (ext === "com") {
      format = "Possível executável DOS (.COM)";
      detail = "A extensão não comprova compatibilidade. O fluxo de execução do Wine Web é voltado a programas Windows PE.";
    } else if (view && view.getUint16(0, true) === 0x5a4d) {
      format = "Executável MZ (família DOS/Windows)";
      if (file.size >= 64) {
        const peOffset = view.getUint32(0x3c, true);
        if (peOffset + 26 <= file.size && view.getUint32(peOffset, true) === 0x00004550) {
          const machine = view.getUint16(peOffset + 4, true);
          const sections = view.getUint16(peOffset + 6, true);
          const optionalSize = view.getUint16(peOffset + 20, true);
          const magicOffset = peOffset + 24;
          const magic = magicOffset + 2 <= file.size ? view.getUint16(magicOffset, true) : 0;
          const machineName = machine === 0x014c ? "x86 (32 bits)" : machine === 0x8664 ? "x86-64 (64 bits)" : `desconhecida (0x${machine.toString(16)})`;
          const peKind = magic === 0x010b ? "PE32" : magic === 0x020b ? "PE32+" : `opcional desconhecido (0x${magic.toString(16)})`;
          format = "Executável Windows PE";
          detail = `Assinatura PE encontrada. Arquitetura declarada: ${machineName}. Formato: ${peKind}. Seções: ${sections}. Isso não garante que o programa rode no Wine.`;
          lines.push(`Máquina: ${machineName}`, `Formato: ${peKind}`, `Número de seções: ${sections}`, `Tamanho do cabeçalho opcional: ${optionalSize} bytes`);
        } else {
          detail = "Cabeçalho MZ encontrado, mas não foi localizada uma assinatura PE válida no deslocamento indicado.";
        }
      }
    } else if (ext === "exe") {
      detail = "A extensão é .EXE, mas o cabeçalho MZ não foi encontrado. O arquivo pode estar inválido ou usar outro formato.";
    } else if (ext === "zip") {
      format = "Arquivo ZIP";
      detail = "O runtime tenta extrair os arquivos e procura executáveis dentro do pacote. O suporte a ZIP64 e a todos os métodos de compressão não é garantido.";
    }

    lines.unshift(`Formato identificado: ${format}`);
    lines.forEach(line => panel.append(el("div", "inspect-line", line)));
    root.append(panel, el("div", "notice", detail), el("p", "muted", "Inspeção local: nenhum conteúdo foi enviado a um servidor. Um cabeçalho PE válido não comprova segurança, dependências ou compatibilidade."));
    WineWindows.open("Análise de arquivo", root, "Inspeção local de cabeçalho — não é teste de execução.");
  }

  function consoleApp() {
    const root = el("div");
    const screen = el("div", "console");
    const line = el("div");
    line.textContent = "Wine Web Console 0.2\r\nEste console é uma demonstração, não um terminal Windows real.\r\nDigite HELP para ver os comandos disponíveis.";
    screen.append(line);
    const prompt = el("div");
    prompt.textContent = "C:\\>";
    const input = el("input");
    input.setAttribute("aria-label", "Comando");
    prompt.append(input);
    screen.append(prompt);
    root.append(screen);
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      const command = input.value.trim();
      const echo = el("div");
      echo.textContent = `C:\\>${command}`;
      screen.insertBefore(echo, prompt);
      const result = el("div");
      const cmd = command.toLowerCase();
      if (cmd === "help") result.textContent = "HELP  — mostra comandos\r\nVER   — versão do Wine Web\r\nCLS   — limpa a tela\r\nDIR   — lista arquivos carregados (não implementado)";
      else if (cmd === "ver") result.textContent = "Wine Web 0.2.0 — integração experimental Boxedwine64";
      else if (cmd === "dir") result.textContent = "Este console não está conectado ao sistema de arquivos do Wine.";
      else if (cmd === "cls") { screen.replaceChildren(prompt); line.textContent = ""; }
      else if (command) result.textContent = `'${command}' não é um comando reconhecido neste console demonstrativo.`;
      if (cmd !== "cls") screen.insertBefore(result, prompt);
      input.value = "";
      screen.scrollTop = screen.scrollHeight;
    });
    return root;
  }

  function aboutApp() {
    const root = el("div");
    root.append(el("div", "about-logo", "🪟"), el("h2", "", "Wine Web 0.2.0"));
    root.append(el("p", "", "Um desktop web independente que usa Boxedwine64 como motor experimental de compatibilidade Windows."));
    root.append(el("div", "notice", "A interface está integrada ao launcher oficial. O runtime precisa ser sincronizado separadamente e a execução de aplicativos externos ainda deve ser validada no navegador de destino."));
    root.append(el("p", "muted", "Wine Web não é uma distribuição oficial do Wine nem do Boxedwine64. Consulte THIRD_PARTY_NOTICES.md."));
    return root;
  }

  function computerApp() {
    const root = el("div");
    root.append(el("h3", "", "Meu computador"), el("p", "", "Unidades e armazenamento"));
    const panel = el("div", "panel");
    panel.append(el("div", "", "💽  C:  Unidade Windows virtual (Wine)"));
    panel.append(el("p", "muted", "O launcher oficial monta o rootfs do Wine e mantém os arquivos graváveis da sessão em um armazenamento IndexedDB próprio."));
    root.append(panel, el("p", "muted", "Os arquivos adicionados no Explorador do Wine Web ficam em outro banco IndexedDB até serem importados para o runtime."));
    return root;
  }

  function diagnosticsApp() {
    const root = el("div", "diagnostics-app");
    root.append(el("h3", "", "Diagnóstico do navegador"));
    const table = el("div", "diagnostic-list");
    const canvas = document.createElement("canvas");
    let webgl = false;
    try { webgl = Boolean(canvas.getContext("webgl2")); } catch {}
    const checks = [
      ["WebAssembly", typeof WebAssembly !== "undefined"],
      ["Web Workers", typeof Worker !== "undefined"],
      ["SharedArrayBuffer", typeof SharedArrayBuffer !== "undefined"],
      ["Isolamento cross-origin", window.crossOriginIsolated === true],
      ["WebGL 2", webgl],
      ["IndexedDB", Boolean(window.indexedDB)],
      ["Contexto seguro (HTTPS/localhost)", window.isSecureContext === true]
    ];
    for (const [label, ok] of checks) {
      const row = el("div", "diagnostic-row");
      row.append(el("span", "", label), el("strong", ok ? "diagnostic-ok" : "diagnostic-no", ok ? "Disponível" : "Indisponível"));
      table.append(row);
    }
    const memory64 = el("div", "notice", "Memory64 é um requisito específico do binário Boxedwine64. O teste decisivo é a compilação/carregamento do WASM distribuído; o navegador não oferece um detector universal simples para essa variante.");
    const note = el("p", "muted", "Este diagnóstico verifica APIs do navegador. Ele não confirma que o rootfs foi baixado nem que um executável Windows seja compatível.");
    const refresh = button("Atualizar diagnóstico", () => {
      const updated = diagnosticsApp();
      root.replaceWith(updated);
    });
    root.append(table, memory64, note, refresh);
    return root;
  }

  function runtimeApp() {
    const root = el("div", "runtime-panel");
    const top = el("div", "runtime-topline");
    top.append(el("strong", "", "Sessão Windows — Boxedwine64"));
    top.append(el("span", "runtime-progress-label", "Aguardando inicialização"));

    const message = el("div", "runtime-message");
    message.id = "runtime-message";
    message.textContent = "Ao iniciar pela primeira vez, o motor e o sistema de arquivos serão carregados do projeto oficial.";

    const loading = el("div", "runtime-loading");
    loading.id = "loading";
    const spinner = el("span", "runtime-spinner");
    spinner.id = "spinner";
    const status = el("span", "");
    status.id = "status";
    status.textContent = "Aguardando launcher…";
    const progress = document.createElement("progress");
    progress.id = "progress";
    progress.value = 0;
    progress.max = 100;
    progress.hidden = true;
    loading.append(spinner, status, progress);

    const appArea = el("div", "runtime-apps");
    const label = el("div", "runtime-section-label", "Aplicativos internos do Wine");
    const appButtons = el("div", "runtime-app-buttons");
    const programs = [
      ["📝 Notepad", "notepad.exe"], ["📄 WordPad", "wordpad.exe"], ["🕒 Clock", "clock.exe"],
      ["⚙️ Winecfg", "winecfg.exe"], ["📂 Wine Files", "winefile.exe"], ["📊 Task Manager", "taskmgr.exe"],
      ["🧊 OpenGL cube", "glcube.exe"], ["💣 Minesweeper", "winemine.exe"], ["🐍 Snake", "snake.exe"], ["🟦 Tetris", "tetris.exe"]
    ];
    for (const [caption, program] of programs) {
      const appButton = button(caption, () => {}, "appbtn");
      appButton.setAttribute("data-wine-program", program);
      appButtons.append(appButton);
    }
    appArea.append(label, appButtons);

    const myAppsRow = el("div", "runtime-myapps");
    myAppsRow.id = "myAppsRow";
    myAppsRow.hidden = true;
    myAppsRow.append(el("strong", "", "Meus programas"));
    const myApps = el("span");
    myApps.id = "myApps";
    myAppsRow.append(myApps);

    const toolbar = el("div", "runtime-toolbar");
    const exeInput = document.createElement("input");
    exeInput.type = "file";
    exeInput.id = "runtime-exe-input";
    exeInput.accept = ".exe,.zip,application/x-msdownload,application/zip,application/octet-stream";
    exeInput.hidden = true;
    const folderInput = document.createElement("input");
    folderInput.type = "file";
    folderInput.id = "runtime-folder-input";
    folderInput.setAttribute("webkitdirectory", "");
    folderInput.setAttribute("directory", "");
    folderInput.multiple = true;
    folderInput.hidden = true;
    toolbar.append(exeInput, folderInput);
    const importExeButton = button("Importar EXE / ZIP", () => {}, "win-button");
    importExeButton.id = "runtime-exe-button";
    const importFolderButton = button("Importar pasta", () => {}, "win-button");
    importFolderButton.id = "runtime-folder-button";
    const exportButton = button("Exportar arquivos do Wine", () => {}, "win-button");
    exportButton.id = "runtime-download-button";
    toolbar.append(importExeButton, importFolderButton, exportButton);

    const argsRow = el("div", "runtime-args-row");
    argsRow.append(el("label", "", "Argumentos:"));
    const args = document.createElement("input");
    args.id = "exeArgs";
    args.type = "text";
    args.placeholder = "opcional";
    args.setAttribute("aria-label", "Argumentos do programa");
    argsRow.append(args);
    const chooser = el("div", "runtime-exe-chooser");
    chooser.id = "exeChooser";
    chooser.hidden = true;

    const viewport = el("div", "runtime-viewport");
    const dropzone = el("div", "runtime-dropzone");
    dropzone.id = "dropzone";
    const border = el("div", "emscripten_border");
    const canvas = document.createElement("canvas");
    canvas.id = "canvas";
    canvas.className = "emscripten";
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Tela do programa Windows em execução");
    canvas.addEventListener("contextmenu", event => event.preventDefault());
    border.append(canvas);
    dropzone.append(border);
    const glCanvas = document.createElement("canvas");
    glCanvas.id = "gl64canvas";
    glCanvas.width = 1024;
    glCanvas.height = 1024;
    glCanvas.hidden = true;
    viewport.append(dropzone, glCanvas);

    const controls = el("div", "runtime-controls");
    const full = button("Tela cheia", () => {}, "win-button"); full.id = "runtime-fullscreen-button";
    const lock = button("Capturar mouse", () => {}, "win-button"); lock.id = "runtime-lockmouse-button";
    const copy = button("Copiar do programa", () => {}, "win-button"); copy.id = "runtime-copy-button";
    const paste = button("Colar no programa", () => {}, "win-button"); paste.id = "runtime-paste-button";
    controls.append(full, lock, copy, paste);

    const consoleBox = el("details", "runtime-console");
    const summary = el("summary", "", "Logs do Wine / Emscripten");
    const output = document.createElement("textarea");
    output.id = "output";
    output.rows = 6;
    output.readOnly = true;
    output.spellcheck = false;
    output.setAttribute("aria-label", "Logs do runtime");
    consoleBox.append(summary, output);

    const notice = el("div", "runtime-disclaimer", "Compatibilidade experimental: comece pelo Notepad interno e depois por um EXE portátil simples. Programas que dependem de DLLs externas, .NET, drivers, rede ou Direct3D podem não funcionar. Execute apenas arquivos em que confia.");
    root.append(top, message, loading, appArea, myAppsRow, toolbar, argsRow, chooser, viewport, controls, consoleBox, notice);
    return root;
  }

  async function open(name) {
    const existing = opened.get(name);
    if (existing && existing.element.isConnected) {
      if (existing.element.style.display === "none") {
        existing.element.style.display = "flex";
        existing.element.dataset.minimized = "false";
      }
      WineWindows.focus(existing.id);
      if (name === "files") {
        const refreshed = await filesApp();
        existing.content.replaceChildren(refreshed);
      }
      return existing;
    }

    let content, title;
    if (name === "files") { title = "Explorador de arquivos"; content = await filesApp(); }
    else if (name === "console") { title = "Console DOS demonstrativo"; content = consoleApp(); }
    else if (name === "about") { title = "Sobre o Wine Web"; content = aboutApp(); }
    else if (name === "runtime") { title = "Executar Windows"; content = runtimeApp(); }
    else if (name === "diagnostics") { title = "Diagnóstico"; content = diagnosticsApp(); }
    else { title = "Meu computador"; content = computerApp(); }

    const win = WineWindows.open(title, content, name === "runtime" ? "O runtime é iniciado nesta janela." : "Pronto");
    opened.set(name, win);
    if (name === "runtime") {
      win.element.classList.add("runtime-window");
      const closeButton = win.element.querySelector('[data-action="close"]');
      // O módulo WASM não é reinicializável na mesma página: o botão X minimiza a
      // janela e preserva a sessão. O botão da barra de tarefas pode restaurá-la.
      closeButton?.addEventListener("click", event => {
        event.stopImmediatePropagation();
        win.element.style.display = "none";
        win.element.dataset.minimized = "true";
      }, true);
      WineRuntime.mount(content, win).catch(error => {
        win.status.textContent = `Runtime: ${error.message}`;
      });
    }
    return win;
  }

  return { open };
})();
