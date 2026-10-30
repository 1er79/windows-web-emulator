# Avisos de terceiros e licenças

## Boxedwine / Boxedwine64

O runtime integrado é obtido do projeto público **Boxedwine64**, derivado do Boxedwine original. O projeto upstream identifica sua licença como **GNU General Public License, versão 2 (GPL-2.0)**.

- Repositório e código-fonte: https://github.com/andrewnakas/Boxedwine64
- Demonstração/build Web: https://andrewnakas.github.io/Boxedwine64/
- Release usada pelo sincronizador para os arquivos do rootfs: https://github.com/andrewnakas/Boxedwine64/releases/tag/rootfs-pages
- Origem do Boxedwine: https://github.com/danoon2/Boxedwine

Este pacote de teste não inclui os grandes binários do Boxedwine64. O comando `npm run sync-engine` baixa os artefatos publicados pelo projeto upstream e os coloca na pasta do Wine Web. O sincronizador aplica apenas um patch pequeno no launcher JavaScript para expor a consulta de prontidão da sessão ao adaptador do desktop. O restante do launcher e os binários são mantidos como arquivos do upstream.

Ao redistribuir uma build que inclua ou disponibilize binários derivados do Boxedwine64, preserve os avisos de copyright e licença, disponibilize o código-fonte correspondente e cumpra as obrigações da GPL-2.0 aplicáveis à forma de distribuição. Consulte a licença e o projeto upstream para determinar os termos aplicáveis à sua redistribuição. Não remova os avisos incorporados nos arquivos baixados.

## coi-serviceworker

O arquivo `coi-serviceworker.js` é obtido do repositório Boxedwine64, que identifica o componente `coi-serviceworker` v0.1.7 e sua licença MIT. Origem do projeto: https://github.com/gzuidhof/coi-serviceworker.

## Wine Web

Os arquivos originais do desktop Wine Web nesta entrega são código do projeto Wine Web. O projeto não é afiliado oficialmente ao Wine, Boxedwine, Boxedwine64 ou Microsoft. O nome “Windows” é usado apenas para descrever compatibilidade pretendida.
