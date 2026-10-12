/* Logic Academy Pro — tela de assinatura, aviso de área Pro e anúncios para quem é grátis.
   Uso (o index.html cria o objeto app):
     LAComp.Pro.render(container, app)        tela "Logic Academy Pro"
     LAComp.Pro.paywall(app, motivo)          janela "isto é Pro" (motivo: "mentoria" | "idiomas")
     LAComp.Pro.anuncios(app)                 carrega/remove anúncios conforme o plano
   app: esc, ico, pageHead, toast, go, ehPro(), assinatura(), logado(), pagar(plano) → Promise<url> */
(function () {
  "use strict";
  const PLANOS = [
    { k: "mensal", nome: "Mensal", preco: "R$ 5,00", por: "/mês", obs: "Pague por Pix, combinando pelo WhatsApp. Vale por 31 dias." },
    { k: "anual", nome: "Anual", preco: "R$ 49,90", por: "/ano", obs: "Equivale a R$ 4,16 por mês. Vale por 12 meses.", selo: "Economize 17%" }
  ];
  const BENEFICIOS = [
    ["mentor", "Mentoria com IA sem limite", "Pergunte quanto quiser: o que revisar, planos de estudo e explicação de questões. No grátis são 3 perguntas por dia."],
    ["book", "Cursos de Inglês e Francês completos", "720 aulas do A1 ao C2, simulados Cambridge e DELF/DALF, e correção de redação e fala pela IA. No grátis: nivelamento e a aula 1 de cada trilha."],
    ["lock", "Sem anúncios", "Estude sem nenhuma propaganda no app."],
    ["trophy", "Ajuda a manter o Logic Academy", "O banco de questões, o plano semanal e a comunidade continuam grátis para todo mundo."]
  ];
  const fmtData = ms => new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  function cartoesPlanos(app) {
    const esc = app.esc;
    return `<div class="pro-planos">${PLANOS.map(p => `<div class="card pro-plano ${p.k === "anual" ? "destaque" : ""}">
      ${p.selo ? `<span class="pro-selo">${esc(p.selo)}</span>` : ""}
      <span class="eyebrow">${esc(p.nome)}</span>
      <div class="pro-preco"><b>${esc(p.preco)}</b><span>${esc(p.por)}</span></div>
      <p class="small muted">${esc(p.obs)}</p>
      <button class="btn ${p.k === "anual" ? "primary" : ""}" type="button" data-pro-plano="${p.k}">Assinar ${esc(p.nome.toLowerCase())} pelo WhatsApp</button></div>`).join("")}</div>`;
  }
  // assinatura pelo WhatsApp: abre a conversa com a mensagem pronta (no mesmo toque, para o navegador não bloquear)
  // e registra o pedido; o administrador confirma o Pix e libera o Pro no painel de administração
  // abre um link numa aba nova; devolve false se o navegador bloqueou (aí o chamador abre na mesma aba)
  function abrirAba(url) {
    let w = null;
    try { w = window.open(url, "_blank"); } catch (e) { w = null; }
    if (!w) return false;
    try { w.opener = null; } catch (e) {}
    return true;
  }
  function assinar(app, plano, botao) {
    if (!app.logado()) { app.toast("Entre com sua conta para assinar o Pro."); return; }
    const url = app.linkPedido(plano);
    if (!url) { app.toast("A assinatura pelo WhatsApp ainda não foi configurada. Tente de novo mais tarde."); return; }
    const abriu = abrirAba(url);
    app.registrarPedido(plano).catch(() => {});
    if (!abriu) location.href = url;
    else app.toast("Abrimos o WhatsApp com a sua mensagem. Envie e combine o Pix; o Pro é liberado assim que o pagamento for confirmado.");
  }

  /* ---------- teste grátis de 3 dias (sem cartão) ----------
     A pessoa informa o celular e aceita os termos (entrar no grupo do WhatsApp); o teste começa na hora
     e o link do grupo aparece. As regras do Firestore conferem o formato do número e só deixam usar
     o teste uma vez por conta e por número. */
  const TERMOS = "Ao ativar o teste grátis, autorizo o Logic Academy a usar este número de celular para me adicionar ao grupo do Logic Academy no WhatsApp, onde recebo avisos, dicas de estudo e novidades. Posso sair do grupo a qualquer momento. O teste dura 3 dias, não pede cartão e não vira cobrança automática; ele só pode ser usado uma vez por conta e por número.";
  const DDDS = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];
  // celular brasileiro: DDD válido + 9 dígitos começando com 9 → formato internacional (+55…)
  function celular(v) {
    let d = String(v || "").replace(/\D/g, "");
    if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
    if (d.length !== 11 || !DDDS.includes(+d.slice(0, 2)) || d[2] !== "9") return null;
    const resto = d.slice(3);                                     // os 8 dígitos depois do 9
    if (/^(\d)\1+$/.test(resto) || "0123456789".includes(resto) || "9876543210".includes(resto)) return null;   // números claramente inventados
    return "+55" + d;
  }
  const fmtCel = e164 => e164 ? `(${e164.slice(3, 5)}) ${e164.slice(5, 10)}-${e164.slice(10)}` : "";
  function cartaoTeste(app) {
    if (!app.podeTestar || !app.podeTestar()) return "";
    return `<div class="card pro-teste"><div><span class="pro-selo-teste">3 DIAS GRÁTIS</span><h2 style="margin:6px 0 4px">Experimente o Pro de graça</h2>
      <p class="small muted" style="margin:0">Sem cartão e sem cobrança automática. Basta informar seu celular e entrar no nosso grupo do WhatsApp.</p></div>
      <button class="btn primary" type="button" data-pro-teste>Começar teste grátis</button></div>`;
  }
  function modalTeste(app) {
    if (!app.logado()) { app.toast("Crie sua conta ou entre para usar o teste grátis."); return; }
    document.querySelectorAll(".pro-modal").forEach(x => x.remove());
    const bg = document.createElement("div"); bg.className = "modal-bg pro-modal";
    let numero = null;
    const passo1 = () => `<form class="card stack modal" data-t="1" novalidate style="width:min(480px,100%)">
        <div class="row" style="gap:8px"><span class="pro-selo-teste">3 DIAS GRÁTIS</span><span class="eyebrow">Logic Academy Pro</span></div>
        <h3 style="margin:0">Ative seu teste grátis</h3>
        <p class="small muted" style="margin:0">Informe o celular que você usa no WhatsApp. Depois de ativar, você recebe o link para entrar no grupo do Logic Academy.</p>
        <div class="field"><label for="tt-cel">Celular com DDD</label><div class="tt-cel"><span>+55</span><input id="tt-cel" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(11) 99734-2851" maxlength="16" required></div></div>
        <label class="tt-termos"><input type="checkbox" id="tt-ok" required><span>${app.esc(TERMOS)} <a href="termos.html#teste-gratis" target="_blank" rel="noopener">Termos de uso</a> · <a href="privacidade.html#celular" target="_blank" rel="noopener">Privacidade</a></span></label>
        <p class="small tt-erro" hidden></p>
        <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn ghost" type="button" data-tt="x">Cancelar</button><button class="btn primary" type="submit" id="tt-enviar">Ativar 3 dias grátis</button></div></form>`;
    const passo3 = ate => `<div class="card stack modal" style="width:min(480px,100%);text-align:center;align-items:center">
        <div class="tt-ok">✓</div><h3 style="margin:0">Seu teste grátis começou!</h3>
        <p class="muted small" style="margin:0">Você tem o Logic Academy Pro até <b>${app.esc(fmtData(ate))}</b>: mentoria sem limite, todas as aulas de Inglês e Francês e nenhum anúncio.</p>
        <button class="btn primary" type="button" data-tt="grupo">Entrar no grupo do WhatsApp</button>
        <button class="btn ghost sm" type="button" data-tt="x">Começar a estudar</button></div>`;
    const erro = m => { const e = bg.querySelector(".tt-erro"); if (e) { e.hidden = false; e.textContent = m; } };
    const pintar = h => { bg.innerHTML = h; const i = bg.querySelector("input:not([type=checkbox])"); if (i) setTimeout(() => i.focus(), 50); };
    pintar(passo1());
    document.body.appendChild(bg);
    bg.addEventListener("click", async e => {
      const b = e.target.closest("[data-tt]"); if (!b && e.target !== bg) return;
      const a = b ? b.dataset.tt : "x";
      if (a === "x") bg.remove();
      else if (a === "grupo") abrirGrupo(app, b);
    });
    bg.addEventListener("submit", async e => {
      e.preventDefault();
      const f = e.target, btn = f.querySelector('[type="submit"]'), txt = btn.textContent;
      btn.disabled = true;
      try {
        numero = celular(f.querySelector("#tt-cel").value);
        if (!numero) { erro("Digite um celular brasileiro válido, com DDD (ex.: 11 99734-2851)."); btn.disabled = false; return; }
        if (!f.querySelector("#tt-ok").checked) { erro("Para ativar o teste, é preciso aceitar os termos."); btn.disabled = false; return; }
        btn.textContent = "Ativando…";
        await app.ativarTeste(numero);
        pintar(passo3(app.testeAte()));
      } catch (err) { btn.disabled = false; btn.textContent = txt; erro(err && err.message ? err.message : "Não foi possível agora. Tente de novo."); }
    });
  }
  // abre o grupo no mesmo toque: se o link já foi buscado, abre na hora (o navegador não bloqueia);
  // se ainda não, busca e abre na mesma aba (no celular, o WhatsApp abre direto)
  async function abrirGrupo(app, botao) {
    const pronto = app.linkGrupoPronto && app.linkGrupoPronto();
    if (pronto) { if (!abrirAba(pronto)) location.href = pronto; return; }
    const txt = botao ? botao.textContent : ""; if (botao) { botao.disabled = true; botao.textContent = "Abrindo…"; }
    try {
      const link = await app.linkGrupo();
      if (link) location.href = link;
      else app.toast("O link do grupo ainda não foi configurado. Avisamos assim que estiver pronto!");
    } catch (e) {
      app.toast(e && e.code === "permission-denied" ? "Ative o teste grátis ou o Pro para entrar no grupo." : "Não foi possível abrir o grupo agora. Confira sua internet.");
    }
    if (botao) { botao.disabled = false; botao.textContent = txt; }
  }

  function render(container, app) {
    const { esc, ico } = app, a = app.assinatura(), pro = app.ehPro(), teste = app.testeAte && app.testeAte(), emTeste = pro && !(a && a.ate > Date.now()) && teste > Date.now();
    container.innerHTML = `<div class="page pro-page" style="max-width:900px">
      ${app.pageHead("Logic Academy Pro", "Estude sem limites: mentoria com IA, cursos de Inglês e Francês completos e nada de anúncios.")}
      ${app.ehAdmin && app.ehAdmin() ? `<div class="card pro-ativo"><span class="pro-tag">ADMIN</span><div style="flex:1"><h2 style="margin:0">Você é administrador</h2>
          <p class="muted" style="margin:4px 0 0">Todos os recursos Pro estão liberados na sua conta. Libere o Pro dos alunos no painel de administração.</p></div><button class="btn sm primary" type="button" data-pro-admin>Abrir painel</button></div>`
      : emTeste ? `<div class="card pro-ativo"><span class="pro-tag">PRO</span><div style="flex:1"><h2 style="margin:0">Seu teste grátis está ativo</h2>
          <p class="muted" style="margin:4px 0 0">Vale até <b>${esc(fmtData(teste))}</b>. Gostou? Assine abaixo para continuar depois do teste.</p></div><button class="btn sm" type="button" data-pro-grupo>Grupo do WhatsApp</button></div>`
      : pro ? `<div class="card pro-ativo"><span class="pro-tag">PRO</span><div><h2 style="margin:0">Seu Pro está ativo</h2>
          <p class="muted" style="margin:4px 0 0">Plano ${esc(a.plano === "anual" ? "anual" : "mensal")} · válido até <b>${esc(fmtData(a.ate))}</b>. Você pode renovar antes: os dias se somam.</p></div></div>`
        : a && a.ate ? `<div class="card flat"><p style="margin:0">Seu Pro venceu em <b>${esc(fmtData(a.ate))}</b>. Renove para voltar a usar tudo.</p></div>` : ""}
      ${cartaoTeste(app)}
      <div class="pro-beneficios">${BENEFICIOS.map(([i, t, d]) => `<div class="pro-ben">${ico(i)}<div><b>${esc(t)}</b><p class="small muted">${esc(d)}</p></div></div>`).join("")}</div>
      <h2 style="margin:22px 0 10px">${pro ? "Renovar" : "Escolha seu plano"}</h2>
      ${cartoesPlanos(app)}
      ${app.logado() ? "" : `<p class="small" style="margin-top:10px">Para assinar, <b>entre com sua conta</b>: o Pro fica ligado a ela e vale em qualquer aparelho.</p>`}
      <p class="hint" style="margin-top:14px">Como funciona: ao tocar em assinar, o WhatsApp abre com uma mensagem pronta para o Logic Academy. Você combina o pagamento por Pix e o Pro é liberado na sua conta assim que ele for confirmado. Não há renovação automática: quando o prazo acabar, o app avisa e você renova se quiser. Dúvidas: logicorg.inc@gmail.com.</p>
    </div>`;
    container.onclick = e => {
      const b = e.target.closest("[data-pro-plano]"); if (b) { assinar(app, b.dataset.proPlano, b); return; }
      if (e.target.closest("[data-pro-teste]")) { modalTeste(app); return; }
      if (e.target.closest("[data-pro-admin]")) { app.go("admin"); return; }
      const g = e.target.closest("[data-pro-grupo]"); if (g) abrirGrupo(app, g);
    };
  }

  const MOTIVOS = {
    mentoria: ["Você usou as 3 perguntas grátis de hoje", "Com o Pro, a mentoria com IA não tem limite. Amanhã você ganha mais 3 perguntas grátis."],
    dica: ["Você usou as 3 perguntas grátis de hoje", "As dicas da IA nos exercícios e a mentoria dividem as 3 perguntas grátis por dia. Com o Pro, peça quantas dicas quiser."],
    idiomas: ["Esta aula faz parte do Pro", "No plano grátis você faz o nivelamento e a aula 1 de cada trilha. Com o Pro, libera as 720 aulas de Inglês e Francês, do A1 ao C2, e os simulados."]
  };
  function paywall(app, motivo) {
    document.querySelectorAll(".pro-modal").forEach(x => x.remove());
    const [t, d] = MOTIVOS[motivo] || ["Recurso Pro", "Assine o Logic Academy Pro para usar."], bg = document.createElement("div");
    bg.className = "modal-bg pro-modal";
    bg.innerHTML = `<div class="card stack modal" role="dialog" aria-modal="true" aria-labelledby="pw-t" style="width:min(560px,100%)">
      <div class="row" style="gap:8px"><span class="pro-tag">PRO</span><span class="eyebrow">Logic Academy Pro</span></div>
      <h3 id="pw-t" style="margin:0">${app.esc(t)}</h3><p class="muted small" style="margin:0">${app.esc(d)}</p>
      ${app.podeTestar && app.podeTestar() ? `<button class="btn primary tt-cta" type="button" data-pro-teste>Testar 3 dias grátis · sem cartão</button><p class="small muted" style="margin:-4px 0 0;text-align:center">ou assine:</p>` : ""}
      ${cartoesPlanos(app)}
      <div class="row" style="justify-content:space-between"><button class="btn ghost sm" type="button" data-pw="ver">Ver tudo o que o Pro inclui</button><button class="btn ghost" type="button" data-pw="x">Agora não</button></div></div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", e => {
      const b = e.target.closest("[data-pro-plano]"); if (b) { assinar(app, b.dataset.proPlano, b); return; }
      if (e.target.closest("[data-pro-teste]")) { bg.remove(); modalTeste(app); return; }
      const x = e.target.closest("[data-pw]");
      if (e.target === bg || (x && x.dataset.pw === "x")) bg.remove();
      else if (x && x.dataset.pw === "ver") { bg.remove(); app.go("pro"); }
    });
    bg.addEventListener("keydown", e => { if (e.key === "Escape") bg.remove(); });
    setTimeout(() => { const b = bg.querySelector('[data-pro-plano="anual"]'); if (b) b.focus(); }, 60);
  }

  /* ---------- anúncios (só para quem não é Pro) ----------
     Só nos espaços [data-anuncio] com id em LA_ADS.slots (telas com conteúdo, como o Início). Sem anúncios automáticos:
     pelas regras do AdSense, anúncio não pode aparecer em telas sem conteúdo do editor (login, formulários,
     cronômetro, chats da comunidade). Por isso o script do AdSense só é carregado quando há um espaço configurado. */
  let carregado = false;
  function anuncios(app) {
    const cfg = window.LA_ADS || {};
    if (!cfg.cliente) return;
    if (app.ehPro()) { document.querySelectorAll("[data-anuncio]").forEach(x => { x.innerHTML = ""; x.hidden = true; }); return; }
    const temEspaco = [...document.querySelectorAll("[data-anuncio]:not([data-pronto])")].some(b => (cfg.slots || {})[b.dataset.anuncio]);
    if (!carregado && temEspaco) {
      carregado = true;
      const s = document.createElement("script");
      s.async = true; s.crossOrigin = "anonymous";
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.cliente);
      document.head.appendChild(s);
    }
    document.querySelectorAll("[data-anuncio]:not([data-pronto])").forEach(box => {
      const slot = (cfg.slots || {})[box.dataset.anuncio]; box.dataset.pronto = "1";
      if (!slot) { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = `<span class="anuncio-rot">Publicidade · <a href="#pro" data-go-pro>remover com o Pro</a></span><ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.cliente}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
      box.querySelector("[data-go-pro]").onclick = e => { e.preventDefault(); app.go("pro"); };
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  }

  (window.LAComp = window.LAComp || {}).Pro = { render, paywall, anuncios, modalTeste, celular, PLANOS, TERMOS };
})();
