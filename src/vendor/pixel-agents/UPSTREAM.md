# Pixel Agents renderer extraction

Source: https://github.com/pixel-agents-hq/pixel-agents

Pinned commit: `3537e140c2094761beae748592aeb92ece8edfdd`.

The 27 vendored source files are the transitive dependencies of `OfficeState`, `renderFrame`, and `editorActions`. Their relative paths are preserved and the files are unmodified. Brand OS integration lives in `src/pixel-office/`; no terminal runtime, hooks, provider credentials, or VS Code adapter is imported.

The upstream MIT license is retained here and distributed under `/pixel-office/LICENSE`. Bundled artwork comes from the same commit's `webview-ui/public/assets`. Its character sprites credit JIK-A-4's MetroCity pack, whose original asset page lists CC0: https://jik-a-4.itch.io/metrocity-free-topdown-character-pack . Retain these credits when replacing or updating the asset pack.

`public/pixel-office/catalog.json` was generated with upstream `core/src/assets/build.ts`'s `buildFurnitureCatalog`; `index.json` with `buildAssetIndex`. The browser adapter decodes the bundled PNGs into the upstream sprite data format. Runtime never reads the research checkout in `/tmp`.
