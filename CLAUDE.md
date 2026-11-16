# Logic Academy — guia do projeto

Site de estudos em português (plano semanal, pomodoro/cronômetro, banco de questões, flashcards, IA, comunidade).

## Estrutura
- `index.html` — o app inteiro (HTML + CSS + JS num arquivo só). Edite direto aqui.
- `questoes/` — banco de questões: `<prova>-<area>.json` + `indice-<prova>.json` (ENEM, EsPCEx, PISM, PAS) e imagens `questoes/<prova>/...webp`.
  Os índices também ficam embutidos no `index.html` (`QB_INDICE`, `QB_INDICE_ESP`, `QB_INDICE_PISM`, `QB_INDICE_PAS`).
- `firestore.rules` — regras do Firestore (grupos, chats, arquivos em partes, voz/WebRTC, presença, chamadas, ranking, desafios).
- `firebase.json` — hosting (site `logicacademy` + site antigo que redireciona) e regras.
- `icones/` (laranja = site de testes) e `icones-oficial/` (preto = site oficial; o workflow copia por cima no deploy).
- `firebase-config.js` — config pública do Firebase (projeto `mapa-de-estudos-d6eca`).

## Publicação (regra do dono: SEMPRE testes primeiro)
1. Commit/push na branch `main` → GitHub Pages = **site de testes** (`https://matoseb-stack.github.io/mapa-de-estudos/`, mostra a faixa "Versão de testes").
2. Só quando o dono disser "pode publicar no oficial": push da mesma versão na branch `producao` →
   `.github/workflows/firebase.yml` publica hosting + regras em **https://logicacademy.web.app** (precisa do segredo `FIREBASE_SERVICE_ACCOUNT`).
- `.github/workflows/regras.yml` (manual) publica só as regras do Firestore.

## PDF de questões enviado solto (regra do dono)
Quando o dono mandar um PDF de questões sem outra instrução:
1. Ler tudo e identificar banca, ano, assunto, gabarito (oficial ou do material) e figuras.
2. Separar cada questão (do número até a última alternativa); texto de apoio comum vai junto em cada questão; figuras recortadas em `questoes/outras/<lote>/...webp`.
3. Classificar matéria e assunto pela lista oficial do banco (criar assunto novo só se nenhum servir); nível do material ou estimado.
4. Gabarito oficial/do material conferido questão por questão (`gf:"material"`); sem gabarito, resolver e marcar `gf:"resolvido"`; explicação curta em `exp`.
5. Não duplicar questão que já está no banco.
6. Gravar em `questoes/outras-<area>.json` (`p:"outras"`, `banca`, `ano`, `adapt`, `n` sequencial dentro de "outras") e atualizar `QB_INDICE_OUT` no `index.html`.
7. Ajustar fonte (banca/ano), formatação (expoentes, frações, símbolos) e nível quando precisar; publicar nos testes e **mandar direto para o oficial, sem esperar o "pronto"** (autorizado pelo dono para PDFs de exercícios). Depois, avisar o resumo: quantas entraram, quais já estavam no banco e o que foi ajustado.

## Missões e Biblioteca
- `js/componentes/Missoes.js` (aba Missões). Missão PISM 1: `missoes/pism1/ufjf.webp` (foto, domínio público), `raiox.json` e `provas.json` gerados das questões do banco (Módulo I), PDFs em `missoes/pism1/provas/`. A música tema é sintetizada no navegador (sem arquivo). "Treinar" abre o banco com o filtro `mo:"I"`.
- `js/componentes/Biblioteca.js` (aba Biblioteca): e-books em `biblioteca/<matéria>/<arquivo>.pdf`, listados em `biblioteca/indice.json` (`{"livros":[{id,titulo,autor,materia,arquivo,paginas,descricao}]}`); matérias: mat, por, lit, fis, qui, bio, his, geo, fil, soc, ing, esp, red, out. Cada livro tem `sumario` (capítulos com assunto claro e subtópicos, cada um com a página do PDF) e o leitor (pdf.js) abre direto na página.
- Só entram livros de uso livre (domínio público, licença aberta ou reprodução autorizada, citando a fonte). Livros de editora/pirateados (ex.: FME do Z-Library) não vão para o site. Os atuais são o Livro Didático Público da SEED-PR (2006), "permitida a reprodução total ou parcial, desde que citada a fonte".

## Apps (Android .apk e Windows .exe)
- `apps/android` (Capacitor + código nativo em `apps/android/nativo`) e `apps/windows` (Electron). Os apps abrem o site oficial; o site fala com eles por `window.LogicAndroid` / `window.logicApp` (chamada em segundo plano, widget, lembretes agendados, versão).
- `.github/workflows/apps.yml` monta e publica em `releases/download/apps/` quando `apps/**` muda.
- `versao.json`: `site` é preenchido sozinho na publicação oficial; ao mudar um app, suba a versão em `apps/*/package.json` **e** em `versao.json` (`android`/`windows`) para os apps antigos avisarem.

## Segurança
- Nunca peça nem receba a chave da conta de serviço ou segredos do reCAPTCHA: vão só nos segredos do GitHub/Firebase.
- Nunca desligue a verificação TLS nem contorne captchas.

## Comunicação
- O dono escreve em português; responda em português simples, sem jargão.
