# Vídeos e carrosséis do Logic Academy (TikTok e Instagram)

**Estética padrão (todos os vídeos e carrosséis):** palco escuro com luzes animadas, o app dentro de um celular, barra de capítulos estilo stories, títulos palavra por palavra com destaque em degradê, números de capítulo, adesivos e cartões de abertura/fim (`palco.html` + `palco-kit.js`; carrossel em `carrossel.js`).

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
Saída em `videos/`: `logic-academy-AAAA-MM-DD.mp4` (já acelerado 1,15×), `-carrossel-1..6.png` (Instagram 1080×1350) + `-carrossel-legenda.txt`, `-legenda.txt` (texto do post com hashtags),
`-roteiro.json` (cenas usadas) e `-conferencia.jpg` (folha com quadros para conferir).

Precisa de: Node 18+, Playwright com Chromium e ffmpeg com libx264.

## Vídeo de lançamento das novidades
```bash
node novidades.js --repo ../site --saida ./videos      # curso de Inglês, nivelamento, fala corrigida, cronômetro, Pro R$ 5 e teste grátis
```
O reconhecimento de voz é simulado na gravação (a "fala" é a própria frase do exercício).

## Cenas (`cenas.js`)
Estudo: `cadastro`, `plano`, `pomodoro`, `questao`, `mentoria`, `molduras`, `estatisticas`, `convite`.
Comunidade: `chatAoVivo`, `enviarQuestao`, `chamada`, `conversa`, `ranking`, `grupo`.
Cada dia sorteia (pela data) 2 cenas de comunidade + 2 de estudo, a frase de abertura, o nome e o tema (claro/preto).

## Vídeo "vitrine" do curso de Francês (visual novo)
```bash
node vitrine-frances.js --repo ../site --saida ./videos      # ~1 min: idioma, nivelamento, 360 aulas, Dica da IA, fala, Pro
```
O app aparece dentro de um celular num palco animado (`palco.html`: fundo de luzes, barra de capítulos estilo stories,
títulos palavra por palavra, adesivos, números de capítulo e cartões de abertura e fim). Com `abrir({palco})` o app roda no
iframe `#app` e `E()` avalia lá dentro. A dica da IA usa `window.DEMO_IA_JSON` (respostas fixas, só no vídeo).

## Carrosséis do Instagram (um tema por dia)
O `gerar.js` cria junto com o vídeo um carrossel com o **tema do dia** (rodízio em `temas-carrossel.js`):
mentor ("Já pensou estudar com um mentor?"), esquece (revisão espaçada), sozinho (comunidade), procrastina (pomodoro),
plano (plano da semana), idiomas (Cambridge/DELF/DALF), questoes (banco de questões) e convite.
Estrutura: gancho → dor → solução → prova (recorte limpo do site) → como usar → chamada. As imagens do site são só
recortes do pedaço útil (`capturas.js`, página alta sem barras); se um recorte falhar, o slide vira só texto.
```bash
node carrossel-gerar.js --repo ../site --saida ./videos --tema mentor     # só o carrossel (ou --tema todos)
node gerar.js --repo ../site --carrossel idiomas                          # vídeo do dia + carrossel com tema escolhido
```
