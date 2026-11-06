# Ajustes de Arquivo Granda — versão online (Netlify)

- `public/index.html` — o sistema (gerado de /ajustes + `shim.js`, que troca os recursos do Claude pelo servidor).
- `netlify/functions/` — servidor: `login` (senha única), `db` (pedidos e cadastros), `arquivo` (PDFs/3D salvos), `ia` (Montar 3D via Netlify AI Gateway).
- Dados ficam no Netlify Blobs do próprio site (stores `granda-db`, `granda-arquivos`, `granda-config`).

Deploy: conectar este repositório ao projeto `granda-ajustes` na Netlify (build automático a cada atualização).
