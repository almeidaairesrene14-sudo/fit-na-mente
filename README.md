# Video Template Studio

Ferramenta estática para GitHub Pages.

## Recursos
- Upload de vários vídeos
- Templates
- @perfil
- Logo
- Pré-visualização
- Renderização em 1080x1920
- Exportação local no navegador

## Importante
A versão inicial usa `MediaRecorder`, que normalmente gera WebM no navegador. Para exigir MP4/H.264 compatível com Instagram, é necessário adicionar FFmpeg WebAssembly (`ffmpeg-core.js` + `.wasm`) e integrar a conversão no `export.js`.

O projeto foi separado para facilitar essa integração sem servidor.

## GitHub Pages
1. Crie um repositório.
2. Envie todos os arquivos mantendo as pastas.
3. Vá em Settings > Pages.
4. Em Build and deployment, selecione Deploy from a branch.
5. Escolha `main` e `/ (root)`.
6. Salve e aguarde a publicação.
