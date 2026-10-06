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

## Segurança
- Nunca peça nem receba a chave da conta de serviço ou segredos do reCAPTCHA: vão só nos segredos do GitHub/Firebase.
- Nunca desligue a verificação TLS nem contorne captchas.

## Comunicação
- O dono escreve em português; responda em português simples, sem jargão.
