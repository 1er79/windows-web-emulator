# Boxedwine64 — artefatos de runtime

Os binários e arquivos do rootfs não são incluídos no ZIP fonte leve. Para obtê-los, execute na raiz do projeto:

```bash
npm run sync-engine
```

O sincronizador obtém launcher, loader Emscripten/WASM e o rootfs publicado pelo projeto Boxedwine64. Os arquivos esperados ficam nesta pasta (o launcher e `boxedwine64.js/.wasm` ficam na raiz do site porque o loader oficial usa caminhos relativos à página):

- `glibc-rootfs64.zip`
- `prefix64.zip`
- `wine64.zip.manifest.json` e suas partes `wine64.zip.partNNN` (ou `wine64.zip` inteiro, quando publicado)
- manifestos e arquivos adicionais disponibilizados pela release

A configuração e origem exatas ficam em `engine-assets.json`. Os arquivos baixados são artefatos do upstream, não foram recompilados por este projeto. Consulte `THIRD_PARTY_NOTICES.md`.
