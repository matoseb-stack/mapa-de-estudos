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
- Trilha (aba 🗺️ da missão, `js/componentes/Trilha.js`): `missoes/pism1/trilha.json` com "Guia do ano" e "Reta final" (unidades → etapas `licao|desafio|simulado|trofeu`, assuntos do banco, livro/página). Treino com questões do Módulo I; 60% conclui; estrelas, XP e ofensiva salvos no documento `trilha` da conta.
- Missão ENEM (mesmo componente): `missoes/enem/enem.webp` (Agência Brasil, CC BY 3.0 BR), `raiox.json`/`provas.json` gerados do banco ENEM inteiro, `trilha.json` pela Matriz de Referência (guia do ano + reta final, o que mais cai primeiro). A trilha (`Trilha.js`) recebe a config da missão (`id`, `dir`, `arq`, `filtro`, `rotulo`); o progresso de cada missão fica em `trilha.<id>`.
- ENEM 2024 e 2025: recortados do caderno azul (uma imagem por questão em `questoes/enem/<ano>/`, texto em `b`, gabarito oficial; anuladas ficam de fora). 2009–2023 vêm da API enem.dev.
- Missão Escola Naval (mesmo componente): banco `questoes/en-<area>.json` (`p:"en"`, `QB_INDICE_EN`), uma imagem por questão em `questoes/en/<ano>/` (texto de apoio compartilhado em imagem à parte, `...-apoio-N.webp`, citado no `c`), gabarito oficial da prova AMARELA (anuladas ficam de fora). Provas de 2017, 2018, 2019, 2021, 2025 e 2026 (o site da Marinha tem verificação anti-robô; os cadernos vieram do espelho público `arquivos.qconcursos.com`, e `assets.marinha.mil.br` precisa do intermediário da GlobalSign). `missoes/en/` tem foto (Marinha, CC BY-SA 2.0), `raiox.json`, `provas.json` e `trilha.json` com 3 guias (`base`, `consolida`, `final`); a trilha aceita qualquer número de guias.
- Concursos militares no banco (v3.41): `efomm`, `cn` (Colégio Naval), `afa`, `epcar`, `eear`, `esa` — arquivos `questoes/<prova>-<area>.json`, índices `questoes/indice-<prova>.json` e `QB_INDICE_<PROVA>` no `index.html`, uma imagem por questão em `questoes/<prova>/<ano>/<dia>-<n>.webp`. Provas e gabaritos oficiais do espelho público `arquivos.qconcursos.com` (versão A / prova Branca / Amarela / código 05 conforme o caderno; anuladas e questões com recorte incompleto ficam de fora). Matéria por blocos oficiais da prova; assunto pelas questões mais parecidas do banco. Ferramentas no scratchpad: `ferr2/recorta2.py`, `ferr2/gab2.py`, `ferr2/monta2.py`.
- Aba 💡 Insights das missões: `missoes/<id>/insights.json` (`{titulo, atualizado, itens:[{ic,t,d}], fontes:[[nome,url]]}`), tirado do edital mais recente, das provas e dos preparatórios. Revisar quando sair edital novo (PISM: Resolução 340/2026 com 40 objetivas + 16 discursivas; ENEM: matriz atual até 2027).
- `js/componentes/Biblioteca.js` (aba Biblioteca): e-books em `biblioteca/<matéria>/<arquivo>.pdf`, listados em `biblioteca/indice.json` (`{"livros":[{id,titulo,autor,materia,arquivo,paginas,descricao}]}`); matérias: mat, por, lit, fis, qui, bio, his, geo, fil, soc, ing, esp, red, out. Cada livro tem `sumario` (capítulos com assunto claro e subtópicos, cada um com a página do PDF) e o leitor (pdf.js) abre direto na página.
- Só entram livros de uso livre (domínio público, licença aberta ou reprodução autorizada, citando a fonte). Livros de editora/pirateados (ex.: FME do Z-Library) não vão para o site. Os atuais são o Livro Didático Público da SEED-PR (2006), "permitida a reprodução total ou parcial, desde que citada a fonte".

## Acesso pago (regra do dono)
- Para usar o site é preciso conta + assinatura de R$ 10,00/mês (`ACESSO_PAGO`, `PRECO_ACESSO` no `index.html`): Pix combinado pelo WhatsApp, pedido em `pedidos/{uid}`, liberação no painel de administração (grava `assinaturas/{uid}.ate`, 31 dias). Sem modo visitante.
- Não pagam: o dono (`ADMIN_EMAIL`) e as contas de `ISENTOS` (hoje só a conta do emblema especial, a mesma de `EXCLUSIVOS`). Não incluir mais ninguém sem o dono pedir.
- A Mentoria com IA foi retirada (menu, rota e botões); os outros recursos de IA continuam.

## Vídeos de divulgação (preferência do dono)
- Não usar a voz sintetizada do Piper (soou artificial) nem legenda na tela.
- Personagens e cenário com modelos 3D prontos da internet, de licença livre (citar a fonte), em vez de formas montadas à mão, para não parecer feito por IA.
- Usar os modelos com as cores que já vêm no arquivo (sem repintar). Fontes que funcionam: Kenney (CC0, espelho `Kenney-CCO/Kenney-CCO.glb` no jsDelivr), Quaternius (CC0, `quaternius.trebeljahr.com/glb/...`), Kit Cidade Low Poly (CC0, `kayquer/kit-cidade-lowpoly`: ônibus, ponto, ruas brasileiras). O pacote de transporte do OpenGameArt vem sem cor — não usar.
- Voz: neural da Microsoft (`pt-BR-AntonioNeural` / `pt-BR-FranciscaNeural`) via edge-tts, apontando o certifi para o certificado do proxy. Kokoro e Piper soam robóticos.
- Processo em duas etapas: uma cria a cena e outra, separada, revisa antes de gravar (personagem atravessando cadeira/cama, pés flutuando, veículo fora da faixa, modelo sem cor, câmera dentro de objeto, trechos com tempo errado). Só gravar e entregar depois da revisão.

## Apps (Android .apk e Windows .exe)
- `apps/android` (Capacitor + código nativo em `apps/android/nativo`) e `apps/windows` (Electron). Os apps abrem o site oficial; o site fala com eles por `window.LogicAndroid` / `window.logicApp` (chamada em segundo plano, widget, lembretes agendados, versão).
- `.github/workflows/apps.yml` monta e publica em `releases/download/apps/` quando `apps/**` muda.
- `versao.json`: `site` é preenchido sozinho na publicação oficial; ao mudar um app, suba a versão em `apps/*/package.json` **e** em `versao.json` (`android`/`windows`) para os apps antigos avisarem.

## Segurança
- Nunca peça nem receba a chave da conta de serviço ou segredos do reCAPTCHA: vão só nos segredos do GitHub/Firebase.
- Nunca desligue a verificação TLS nem contorne captchas.

## Comunicação
- O dono escreve em português; responda em português simples, sem jargão.
