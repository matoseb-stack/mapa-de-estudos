# Aulas de idiomas — formato dos arquivos

Cada arquivo `idiomas/<idioma>/<NIVEL>-<habilidade>.json` traz **15 aulas** de uma trilha
(ex.: `idiomas/ingles/B1-listening.json` = Listening do B1, aulas 1 a 15).
Níveis: A1, A2, B1, B2, C1, C2. Habilidades: `reading` (Reading & Use of English), `listening`, `writing`, `speaking`.
A aula 15 de cada trilha é um **simulado** no formato da parte correspondente da prova Cambridge do nível.

Confira sempre com: `python3 idiomas/validar_aulas.py idiomas/ingles/*.json`

## Estrutura

```json
{
  "nivel": "B1",
  "skill": "listening",
  "exame": "B1 Preliminary (PET)",
  "aulas": [
    {
      "n": 1,
      "titulo": "Making plans for the weekend",
      "objetivo": "Entender combinados de dia, hora e lugar em conversas curtas.",
      "foco": "Present continuous for future arrangements; time expressions",
      "explicacao": [
        "Usamos o present continuous para planos já combinados: I'm meeting Ana on Saturday.",
        "Expressões de tempo: at six, on Friday, in the morning, next week."
      ],
      "vocab": [ { "en": "to meet up", "pt": "encontrar-se" } ],
      "material": { },
      "exercicios": [ ]
    }
  ]
}
```

- `titulo`, `foco`: em inglês. `objetivo`, `explicacao`, `vocab[].pt`, `exp` (explicação das respostas), `q` de instrução do speak e `checklist`: em **português do Brasil simples**.
- `explicacao`: 2 a 5 frases curtas, com exemplos em inglês.
- `vocab`: 4 a 10 palavras ou expressões da aula.

### `material` por habilidade

| habilidade | campos |
|---|---|
| reading | `titulo`, `texto` (inglês). Tamanho: A1 50–110 palavras, A2 90–170, B1 160–280, B2 260–430, C1 350–600, C2 420–700 (simulado até 60% maior) |
| listening | `titulo`, `falas`: lista de `{ "p": "A", "t": "fala em inglês" }` (p = quem fala; até 3 pessoas; monólogo usa uma só). Total: A1 50–130 palavras, A2 80–180, B1 130–280, B2 200–400, C1 280–520, C2 330–650. O app lê em voz alta (voz do navegador), sem os nomes. |
| writing | `tarefa` (enunciado no estilo da prova, em inglês), `genero` (ex.: "email", "article", "essay"), `min`, `max` (palavras), `modelo` (resposta-modelo em inglês, entre min e max), `checklist` (3+ itens em português: o que conferir antes de enviar) |
| speaking | `tarefa` (enunciado no estilo da prova, em inglês), `segundos` (30–240), `frases_uteis` (3+ frases em inglês), `modelo` (resposta-modelo falada, em inglês) |

### `exercicios`

Aulas 1–14: **exatamente 9**. Aula 15 (simulado): 10 a 14.
Alternar os tipos (nunca dois `speak` seguidos) e **subir a dificuldade** do primeiro ao último.
Mínimo por aula: 3 `mc` (marcar), 3 de escrever (`gap` ou `order`) e 2 `speak` (3 nas aulas de speaking).
Ordem sugerida: mc, gap, speak, mc, order, gap, speak, mc, gap.

| tipo | campos | como o app confere |
|---|---|---|
| `mc` | `q`, `op` (3 ou 4 opções diferentes), `r` (índice da certa, começa em 0), `exp` | opção escolhida = `r` |
| `gap` | `q` com **uma** lacuna `___`, `resp` (lista de respostas aceitas, até 5 palavras cada; inclua variações como "don't" e "do not"), `exp`, `dica` (opcional, ex.: palavra-base em MAIÚSCULAS para word formation) | texto digitado, sem diferença de maiúsculas, espaços e pontuação final |
| `order` | `palavras` (3–16, na ordem certa; o app embaralha), `resp` (frase certa), `alt` (opcional: outras ordens certas), `exp` | as palavras clicadas formam `resp` ou uma `alt` |
| `speak` | `modo`: `"repetir"` (ler/repetir `frase`, 3–30 palavras) ou `"responder"` (responder à pergunta em `frase`; precisa `modelo`, `min` = mínimo de palavras, `chave` = palavras-chave, das quais ao menos uma deve aparecer); `q` (instrução em português); `exp` (dica de pronúncia ou de resposta) | reconhecimento de voz do navegador: "repetir" vale se ~70% das palavras baterem; "responder" vale com `min` palavras e uma `chave` |

Opcional em qualquer exercício: `"ouvir": "texto em inglês"` — o app mostra um botão ▶ que lê esse texto
(use em listening para ditado: `gap` com a frase ouvida, ou para responder a uma fala).

Nas trilhas de **writing** e **speaking** a aula termina com a tarefa livre (`material.tarefa`), corrigida pela IA do mentor.
