# Vídeos do Logic Academy para o TikTok

Gera um vídeo por dia (9:16, 1080×1920, MP4) gravando o app de verdade num navegador automático,
com legendas de anúncio, toques na tela e uma **comunidade de demonstração**.

## Usuários de demonstração (importante)
Os estudantes, mensagens, comunidades, chamadas e respostas da mentoria que aparecem nos vídeos são **fictícios**
e existem **só dentro do navegador da gravação** (`mock-firebase.js`, `demo-dados.js`, `mock-ai.mjs`).
Nada é gravado no Firebase real: ninguém do site vê essas contas. O vídeo termina com o aviso
"Imagens ilustrativas · usuários e conversas fictícios".

## Como gerar
```bash
git clone https://github.com/matoseb-stack/mapa-de-estudos site            # o site (branch producao = oficial)
git clone -b marketing https://github.com/matoseb-stack/mapa-de-estudos marketing
cd marketing && node gerar.js --repo ../site --saida ./videos                 # vídeo de hoje
node gerar.js --repo ../site --data 2026-10-07                                # roteiro de outro dia
node gerar.js --repo ../site --cenas chatAoVivo,conversa,questao,convite      # escolher as cenas
```
Saída em `videos/`: `logic-academy-AAAA-MM-DD.mp4`, `-legenda.txt` (texto do post com hashtags),
`-roteiro.json` (cenas usadas) e `-conferencia.jpg` (folha com quadros para conferir).

Precisa de: Node 18+, Playwright com Chromium e ffmpeg com libx264.

## Cenas (`cenas.js`)
Estudo: `cadastro`, `plano`, `pomodoro`, `questao`, `mentoria`, `molduras`, `estatisticas`, `convite`.
Comunidade: `chatAoVivo`, `enviarQuestao`, `chamada`, `conversa`, `ranking`, `grupo`.
Cada dia sorteia (pela data) 2 cenas de comunidade + 2 de estudo, a frase de abertura, o nome e o tema (claro/preto).
