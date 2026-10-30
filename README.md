# Wine Web 0.2.1 — pacote experimental de testes

Desktop próprio, inspirado em interfaces clássicas, com integração experimental ao **Boxedwine64**. O desktop, o Explorador e o gerenciador de janelas continuam sendo do Wine Web. O Boxedwine64 fornece o runtime Windows/Wine em WebAssembly; não há iframe e não há servidor remoto executando o programa do usuário.

> **Estado desta entrega:** a ponte JavaScript foi conectada às funções públicas do launcher oficial e o fluxo de importação foi implementado. A execução de um `.exe` externo ainda precisa ser validada em um navegador real nesta distribuição. Não trate este pacote como um emulador universal ou como compatibilidade já comprovada para qualquer aplicativo.

## O que foi implementado

- Desktop, menu Iniciar, barra de tarefas e janelas arrastáveis.
- Janela própria **Executar Windows**, com canvas para a saída gráfica do Boxedwine64.
- Inicialização do launcher oficial, verificação dos artefatos e espera pela sessão Wine.
- Verificação de isolamento cross-origin e suporte ao COI Service Worker do Boxedwine64 para hospedagem estática.
- Sincronização sob demanda dos artefatos oficiais (launcher, JavaScript/WASM e rootfs).
- Ponte com `bw64ImportFile()`, `bw64ImportFolderInput()`, `launchApp()` e funções de clipboard/tela cheia do launcher.
- Importação de `.exe` e `.zip` pelo Explorador; botão **Executar** para os dois formatos.
- Importação direta de pastas com `webkitdirectory`, mantendo caminhos relativos no importador oficial.
- Armazenamento dos arquivos adicionados pelo Explorador em IndexedDB (`wine-web-01`).
- Persistência adicional do sistema gravável do Wine pelo próprio launcher Boxedwine64 (IndexedDB `bw64persist`).
- Diagnóstico das APIs do navegador, console/logs do motor, tela cheia e captura do mouse.
- Servidor local Node.js com cabeçalhos COOP/COEP e suporte a HTTP Range.
- GitHub Actions opcional para sincronizar o runtime e publicar em GitHub Pages.

## Requisitos

- Windows, macOS ou Linux com **Node.js 20 ou superior** para o servidor local e sincronização.
- Chrome ou Edge recente recomendado para a primeira validação. O requisito de `SharedArrayBuffer` exige contexto cross-origin-isolated.
- HTTPS em hospedagem pública. `http://localhost` é aceito no teste local.
- Espaço em disco e memória disponíveis. O rootfs principal do upstream é grande (cerca de 196 MB na documentação do projeto; o download total pode variar por release e arquivos adicionais).

## Iniciar localmente no Windows

**Não abra `index.html` com duplo clique.** Isso usa `file://` e impede o navegador de carregar os arquivos do motor.

1. Extraia o ZIP em uma pasta.
2. Instale Node.js 20 ou superior.
3. Dê duplo clique em `start-wineweb.bat`. O arquivo instala/sincroniza o motor automaticamente na primeira execução e inicia o servidor local.
4. Abra `http://127.0.0.1:4173/` no Chrome ou Edge. Mantenha a janela preta do servidor aberta enquanto usa o Wine Web.

Para fazer a instalação manualmente, abra um terminal nessa pasta. Confira a instalação:

   ```bash
   node --version
   npm run check
   ```

4. Baixe/sincronize os artefatos oficiais do motor:

   ```bash
   npm run sync-engine
   ```

   O comando baixa os arquivos do Boxedwine64 e os rootfs da release `rootfs-pages`. Ele grava os arquivos gerados no diretório do projeto. O download é grande e pode demorar, dependendo da conexão.

5. Inicie o servidor:

   ```bash
   npm start
   ```

6. Abra **http://127.0.0.1:4173/** em Chrome ou Edge.
7. Abra **Executar Windows** no desktop. O primeiro boot pode levar alguns minutos; comece pelo Notepad que acompanha o ambiente.

No Windows, `start-wineweb.bat` abre o servidor local. Execute `npm run sync-engine` antes, caso os artefatos ainda não tenham sido baixados.

## Testar um programa externo

**Opção A — arquivo único:** abra o Explorador, adicione um `.exe`, aguarde o armazenamento terminar e clique em **Executar**. O launcher oficial coloca o executável no diretório de usuário do Wine e o registra no sistema virtual antes de iniciá-lo.

**Opção B — pacote com dependências:** adicione um `.zip` que contenha o executável e os arquivos auxiliares, ou abra Executar Windows e escolha **Importar pasta**. O importador oficial tenta preservar a estrutura e instalar o conteúdo em `C:\Apps\<nome>`. Se houver vários `.exe`, o launcher mostra uma seleção.

Comece com um aplicativo Win32 portátil e simples, preferencialmente baseado em GDI. O próprio Boxedwine64 recomenda esse perfil para executáveis fornecidos pelo usuário. Um `.exe` com assinatura PE válida não é necessariamente compatível.

## O que ainda precisa ser validado

Este ambiente de construção não dispõe de uma sessão de navegador com o rootfs baixado para executar o teste de aceitação. Portanto, **não foi comprovado nesta entrega** que um EXE externo conclua a execução dentro do desktop Wine Web.

A validação manual obrigatória é:

1. `npm run sync-engine` termina sem erros e cria `engine-assets.json`.
2. O diagnóstico mostra WebAssembly, Web Workers, SharedArrayBuffer, WebGL 2, IndexedDB e isolamento cross-origin disponíveis.
3. Executar Windows inicia e mostra o Notepad interno.
4. Um EXE Win32/GDI simples importado pelo Explorador aparece e abre no canvas.
5. Um ZIP com EXE e DLLs auxiliares preserva os caminhos e inicia — se o aplicativo suportar esse ambiente.
6. Digitação, mouse, redimensionamento, tela cheia, clipboard e persistência após recarregar a página são verificados.

Registre navegador/versão, sistema operacional, nome/arquitetura do EXE, tamanho, logs do console e resultado de cada etapa. Não marque a integração como concluída antes do teste 4.

## Limitações conhecidas

- Não há garantia de compatibilidade universal x86/x64. O caminho de 32 bits depende dos componentes publicados no rootfs e da compatibilidade do programa.
- O próprio upstream destaca melhor compatibilidade para programas Win32/GDI portáteis; aplicativos que dependem de DLLs externas, .NET, drivers, recursos de hardware, rede, instaladores complexos ou Direct3D podem falhar ou ter desempenho impraticável.
- A importação ZIP usa APIs nativas do navegador e não promete suporte a todas as variantes ZIP/ZIP64 ou todos os métodos de compressão.
- A importação de pasta depende de `webkitdirectory`, cuja disponibilidade varia por navegador.
- O IndexedDB do Explorador (`wine-web-01`) e o armazenamento persistente interno do Boxedwine64 (`bw64persist`) são separados. Excluir um item no Explorador não apaga automaticamente a cópia já importada para o Wine.
- O navegador não substitui antivírus. Não execute arquivos desconhecidos; arquivos PE podem conter código malicioso. O projeto não faz análise de malware.
- O diagnóstico do navegador não comprova que o módulo WASM específico conseguirá compilar ou que um determinado aplicativo funcionará.

## Arquitetura

```text
Wine Web Desktop (HTML/CSS/JS)
  ├─ src/window-manager.js   Janelas, foco e barra de tarefas
  ├─ src/apps.js             Explorador, diagnóstico e janela de runtime
  ├─ src/storage.js          Arquivos importados pelo usuário (IndexedDB)
  └─ src/runtime.js          Ponte para o launcher Boxedwine64
          │
          ├─ wine64-launcher.js  Launcher oficial (patch pequeno e verificado)
          ├─ boxedwine64.js/.wasm Núcleo Emscripten/WebAssembly
          ├─ coi-serviceworker.js Isolamento em hospedagem sem cabeçalhos HTTP
          └─ engine/boxedwine64/  Rootfs Wine/glibc e manifestos/partes
```

O launcher oficial cria o módulo Emscripten e entrega o canvas/teclado/mouse ao ambiente. O adaptador deste projeto expõe ao desktop somente ações de interface e importação. Ele aplica um patch textual mínimo para publicar o estado da função `sessionReady()` — originalmente privada dentro do launcher — porque o Explorador precisa aguardar a sessão antes de chamar os importadores. Se o código upstream mudar e o patch deixar de corresponder, `npm run sync-engine` falha deliberadamente em vez de editar um launcher desconhecido.

## Comandos

| Comando | Finalidade |
|---|---|
| `npm run check` | Verifica arquivos e sintaxe JavaScript (não executa WASM) |
| `npm run sync-engine` | Baixa launcher, WASM e rootfs oficiais |
| `npm start` | Servidor local em `127.0.0.1:4173` com COOP/COEP e Range |
| `PORT=8080 npm start` | Usa outra porta (Linux/macOS; no Windows defina `PORT` antes) |

## Publicar em GitHub Pages

O workflow `.github/workflows/publish-wineweb.yml` publica quando executado manualmente ou após push para `main`. Em **Settings → Pages**, configure a origem como **GitHub Actions**. O workflow sincroniza os artefatos antes de publicar. O `coi-serviceworker.js` do upstream injeta os cabeçalhos necessários em hospedagem que não permite configurá-los diretamente.

Para hospedar em outro lugar, sirva todos os arquivos do pacote na mesma origem e configure pelo menos:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

O mesmo domínio deve servir o launcher, o módulo WASM, os ZIPs e os manifestos. O servidor Node incluído já configura esses cabeçalhos e suporta requisições `Range`.

## Atualização e suporte

O script busca o launcher atual do site do Boxedwine64 e os arquivos de rootfs da release pública `rootfs-pages`. O manifesto `engine-assets.json` registra a data e a release usadas. Para reproduzir um teste, guarde esse manifesto junto dos logs. Como o upstream é atualizado, sincronizações feitas em datas diferentes podem produzir builds distintos.

Consulte `THIRD_PARTY_NOTICES.md` para licenças e atribuições. O Wine Web é um projeto independente, não afiliado oficialmente ao Wine, Boxedwine ou Microsoft.

### Atualizando da versão 0.1

A versão 0.1 instalava um Service Worker que armazenava o desktop antigo em cache. Se a versão nova abrir com a interface antiga, use **DevTools → Application → Service Workers → Unregister** para a origem do Wine Web e limpe o cache `wine-web-shell-v2`; depois faça uma recarga completa. A versão 0.2 deixa de registrar esse cache e usa o `coi-serviceworker.js` do Boxedwine64 somente quando a hospedagem não entrega COOP/COEP por cabeçalho HTTP.
