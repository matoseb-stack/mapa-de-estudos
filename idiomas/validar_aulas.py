#!/usr/bin/env python3
"""Confere um arquivo de aulas: python3 validar_aulas.py idiomas/ingles/B1-listening.json"""
import json, sys, re
NIVEIS = ["A1", "A2", "B1", "B2", "C1", "C2"]
SKILLS = ["reading", "listening", "writing", "speaking"]
TIPOS = {"mc", "gap", "order", "speak"}
ESCREVER = {"gap", "order"}
LIM_TEXTO = {"A1": (50, 110), "A2": (90, 170), "B1": (160, 280), "B2": (260, 430), "C1": (350, 600), "C2": (420, 700)}
LIM_FALAS = {"A1": (50, 130), "A2": (80, 180), "B1": (130, 280), "B2": (200, 400), "C1": (280, 520), "C2": (330, 650)}
def pal(s): return len(re.findall(r"[A-Za-zÀ-ÿœŒæÆ'’-]+", s or ""))
def norm(s): return re.sub(r"[^a-z0-9à-ÿœæ' -]", "", re.sub(r"\s+", " ", (s or "").lower().replace("’", "'"))).strip()
erros = []
def err(m): erros.append(m)
def main(p):
    d = json.load(open(p, encoding="utf-8"))
    nome = p.replace("\\", "/").split("/")[-1][:-5]
    nv, sk = nome.split("-")
    if d.get("nivel") != nv or d.get("skill") != sk: err(f"nivel/skill do topo não batem com o nome do arquivo ({nome})")
    aulas = d.get("aulas") or []
    if len(aulas) != 15: err(f"precisa de 15 aulas, tem {len(aulas)}")
    titulos = set()
    for i, a in enumerate(aulas, 1):
        L = f"aula {i}"
        if a.get("n") != i: err(f"{L}: n deve ser {i}")
        for c in ["titulo", "objetivo", "foco"]:
            if not isinstance(a.get(c), str) or not a[c].strip(): err(f"{L}: falta {c}")
        if a.get("titulo") in titulos: err(f"{L}: título repetido")
        titulos.add(a.get("titulo"))
        ex = a.get("explicacao")
        if not isinstance(ex, list) or not 2 <= len(ex) <= 5: err(f"{L}: explicacao precisa de 2 a 5 itens")
        vc = a.get("vocab")
        if not isinstance(vc, list) or not 4 <= len(vc) <= 10 or any(not (isinstance(v, dict) and v.get("en") and v.get("pt")) for v in vc): err(f"{L}: vocab precisa de 4 a 10 itens {{en,pt}}")
        m = a.get("material") or {}
        if sk == "reading":
            n = pal(m.get("texto")); lo, hi = LIM_TEXTO[nv]
            if not m.get("titulo"): err(f"{L}: material.titulo")
            if not lo <= n <= hi * (1.6 if i == 15 else 1): err(f"{L}: texto com {n} palavras (esperado {lo}-{hi})")
        elif sk == "listening":
            f = m.get("falas")
            if not isinstance(f, list) or len(f) < 2 or any(not (isinstance(x, dict) and x.get("p") and x.get("t")) for x in f): err(f"{L}: material.falas inválido")
            else:
                n = sum(pal(x["t"]) for x in f); lo, hi = LIM_FALAS[nv]
                if not lo <= n <= hi * (1.6 if i == 15 else 1): err(f"{L}: áudio com {n} palavras (esperado {lo}-{hi})")
            if not m.get("titulo"): err(f"{L}: material.titulo")
        elif sk == "writing":
            for c in ["tarefa", "genero", "modelo"]:
                if not m.get(c): err(f"{L}: material.{c}")
            if not (isinstance(m.get("min"), int) and isinstance(m.get("max"), int) and m["min"] < m["max"]): err(f"{L}: material.min/max")
            elif not m["min"] * 0.85 <= pal(m.get("modelo")) <= m["max"] * 1.15: err(f"{L}: modelo com {pal(m.get('modelo'))} palavras fora de {m['min']}-{m['max']}")
            if not isinstance(m.get("checklist"), list) or len(m["checklist"]) < 3: err(f"{L}: material.checklist (3+)")
        elif sk == "speaking":
            for c in ["tarefa", "modelo"]:
                if not m.get(c): err(f"{L}: material.{c}")
            if not isinstance(m.get("segundos"), int) or not 30 <= m["segundos"] <= 240: err(f"{L}: material.segundos 30-240")
            if not isinstance(m.get("frases_uteis"), list) or len(m["frases_uteis"]) < 3: err(f"{L}: material.frases_uteis (3+)")
        xs = a.get("exercicios") or []
        quer = (10, 14) if i == 15 else (9, 9)
        if not quer[0] <= len(xs) <= quer[1]: err(f"{L}: {len(xs)} exercícios (esperado {quer[0]}-{quer[1]})")
        tipos = [x.get("t") for x in xs]
        if tipos.count("mc") < 3: err(f"{L}: precisa de 3+ mc")
        if sum(t in ESCREVER for t in tipos) < 3: err(f"{L}: precisa de 3+ gap/order")
        if tipos.count("speak") < (3 if sk == "speaking" else 2): err(f"{L}: precisa de {(3 if sk == 'speaking' else 2)}+ speak")
        for a1, b1 in zip(tipos, tipos[1:]):
            if a1 == b1 == "speak": err(f"{L}: dois speak seguidos")
        for j, x in enumerate(xs, 1):
            E = f"{L} ex{j}"
            t = x.get("t")
            if t not in TIPOS: err(f"{E}: tipo {t}"); continue
            if not x.get("exp"): err(f"{E}: falta exp")
            if t == "mc":
                op = x.get("op")
                if not x.get("q") or not isinstance(op, list) or not 3 <= len(op) <= 4: err(f"{E}: mc precisa q e 3-4 op")
                elif not isinstance(x.get("r"), int) or not 0 <= x["r"] < len(op): err(f"{E}: r inválido")
                elif len(set(norm(o) for o in op)) != len(op): err(f"{E}: opções repetidas")
            elif t == "gap":
                if "___" not in (x.get("q") or ""): err(f"{E}: gap precisa de ___ em q")
                if (x.get("q") or "").count("___") != 1: err(f"{E}: gap com mais de uma lacuna")
                r = x.get("resp")
                if not isinstance(r, list) or not r or any(not isinstance(s, str) or not s.strip() or pal(s) > 5 for s in r): err(f"{E}: resp precisa ser lista de respostas curtas (até 5 palavras)")
            elif t == "order":
                w = x.get("palavras"); r = x.get("resp")
                if not isinstance(w, list) or not 3 <= len(w) <= 16 or not isinstance(r, str): err(f"{E}: order precisa palavras (3-16) e resp")
                elif sorted(norm(" ".join(w)).split()) != sorted(norm(r).split()): err(f"{E}: palavras não formam resp")
                for alt in x.get("alt", []):
                    if sorted(norm(alt).split()) != sorted(norm(r).split()): err(f"{E}: alt não usa as mesmas palavras")
            elif t == "speak":
                modo = x.get("modo")
                if modo not in ("repetir", "responder") or not x.get("q") or not x.get("frase"): err(f"{E}: speak precisa modo, q, frase")
                elif modo == "repetir" and not 3 <= pal(x["frase"]) <= 30: err(f"{E}: frase para repetir com 3-30 palavras")
                elif modo == "responder" and (not x.get("modelo") or not isinstance(x.get("min"), int) or not isinstance(x.get("chave"), list)): err(f"{E}: responder precisa modelo, min, chave")
            if "ouvir" in x and (not isinstance(x["ouvir"], str) or pal(x["ouvir"]) < 2): err(f"{E}: ouvir inválido")
falhou = False
for p in sys.argv[1:]:
    erros.clear()
    try: main(p)
    except Exception as e: err(f"JSON inválido ou estrutura errada: {e}")
    print(("OK   " if not erros else "ERRO ") + p + ("" if not erros else f" ({len(erros)} problemas)"))
    for e in erros[:40]: print("   -", e)
    if erros: falhou = True
sys.exit(1 if falhou else 0)
