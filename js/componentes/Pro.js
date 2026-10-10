/* Logic Academy Pro — tela de assinatura, aviso de área Pro e anúncios para quem é grátis.
   Uso (o index.html cria o objeto app):
     LAComp.Pro.render(container, app)        tela "Logic Academy Pro"
     LAComp.Pro.paywall(app, motivo)          janela "isto é Pro" (motivo: "mentoria" | "idiomas")
     LAComp.Pro.anuncios(app)                 carrega/remove anúncios conforme o plano
   app: esc, ico, pageHead, toast, go, ehPro(), assinatura(), logado(), pagar(plano) → Promise<url> */
(function () {
  "use strict";
  const PLANOS = [
    { k: "mensal", nome: "Mensal", preco: "R$ 9,90", por: "/mês", obs: "Pague com Pix, cartão ou boleto. Vale por 31 dias." },
    { k: "anual", nome: "Anual", preco: "R$ 79,90", por: "/ano", obs: "Equivale a R$ 6,66 por mês. Vale por 12 meses.", selo: "Economize 33%" }
  ];
  const BENEFICIOS = [
    ["mentor", "Mentoria com IA sem limite", "Pergunte quanto quiser: o que revisar, planos de estudo e explicação de questões. No grátis são 3 perguntas por dia."],
    ["book", "Curso de Inglês completo", "As 360 aulas do A1 ao C2, simulados Cambridge e correção de redação e fala pela IA. No grátis: nivelamento e a aula 1 de cada trilha."],
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
      <button class="btn ${p.k === "anual" ? "primary" : ""}" type="button" data-pro-plano="${p.k}">Assinar ${esc(p.nome.toLowerCase())}</button></div>`).join("")}</div>`;
  }
  async function assinar(app, plano, botao) {
    if (!app.logado()) { app.toast("Entre com sua conta para assinar o Pro."); return; }
    const txt = botao.textContent; botao.disabled = true; botao.textContent = "Abrindo o pagamento…";
    try { const url = await app.pagar(plano); location.href = url; }
    catch (e) { botao.disabled = false; botao.textContent = txt; app.toast(e && e.message ? e.message : "Não foi possível abrir o pagamento agora. Tente de novo."); }
  }

  function render(container, app) {
    const { esc, ico } = app, a = app.assinatura(), pro = app.ehPro();
    container.innerHTML = `<div class="page pro-page" style="max-width:900px">
      ${app.pageHead("Logic Academy Pro", "Estude sem limites: mentoria com IA, curso de Inglês completo e nada de anúncios.")}
      ${pro ? `<div class="card pro-ativo"><span class="pro-tag">PRO</span><div><h2 style="margin:0">Seu Pro está ativo</h2>
          <p class="muted" style="margin:4px 0 0">Plano ${esc(a.plano === "anual" ? "anual" : "mensal")} · válido até <b>${esc(fmtData(a.ate))}</b>. Você pode renovar antes: os dias se somam.</p></div></div>`
        : a && a.ate ? `<div class="card flat"><p style="margin:0">Seu Pro venceu em <b>${esc(fmtData(a.ate))}</b>. Renove para voltar a usar tudo.</p></div>` : ""}
      <div class="pro-beneficios">${BENEFICIOS.map(([i, t, d]) => `<div class="pro-ben">${ico(i)}<div><b>${esc(t)}</b><p class="small muted">${esc(d)}</p></div></div>`).join("")}</div>
      <h2 style="margin:22px 0 10px">${pro ? "Renovar" : "Escolha seu plano"}</h2>
      ${cartoesPlanos(app)}
      ${app.logado() ? "" : `<p class="small" style="margin-top:10px">Para assinar, <b>entre com sua conta</b>: o Pro fica ligado a ela e vale em qualquer aparelho.</p>`}
      <p class="hint" style="margin-top:14px">Pagamento processado pelo Mercado Pago. Não é renovação automática: quando o prazo acabar, o app avisa e você renova se quiser. O Pro é liberado assim que o pagamento é aprovado (Pix e cartão costumam levar poucos segundos; boleto, até 2 dias úteis). Dúvidas: logicorg.inc@gmail.com.</p>
    </div>`;
    container.onclick = e => { const b = e.target.closest("[data-pro-plano]"); if (b) assinar(app, b.dataset.proPlano, b); };
  }

  const MOTIVOS = {
    mentoria: ["Você usou as 3 perguntas grátis de hoje", "Com o Pro, a mentoria com IA não tem limite. Amanhã você ganha mais 3 perguntas grátis."],
    idiomas: ["Esta aula faz parte do Pro", "No plano grátis você faz o nivelamento e a aula 1 de cada trilha. Com o Pro, libera as 360 aulas do A1 ao C2 e os simulados."]
  };
  function paywall(app, motivo) {
    document.querySelectorAll(".pro-modal").forEach(x => x.remove());
    const [t, d] = MOTIVOS[motivo] || ["Recurso Pro", "Assine o Logic Academy Pro para usar."], bg = document.createElement("div");
    bg.className = "modal-bg pro-modal";
    bg.innerHTML = `<div class="card stack modal" role="dialog" aria-modal="true" aria-labelledby="pw-t" style="width:min(560px,100%)">
      <div class="row" style="gap:8px"><span class="pro-tag">PRO</span><span class="eyebrow">Logic Academy Pro</span></div>
      <h3 id="pw-t" style="margin:0">${app.esc(t)}</h3><p class="muted small" style="margin:0">${app.esc(d)}</p>
      ${cartoesPlanos(app)}
      <div class="row" style="justify-content:space-between"><button class="btn ghost sm" type="button" data-pw="ver">Ver tudo o que o Pro inclui</button><button class="btn ghost" type="button" data-pw="x">Agora não</button></div></div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", e => {
      const b = e.target.closest("[data-pro-plano]"); if (b) { assinar(app, b.dataset.proPlano, b); return; }
      const x = e.target.closest("[data-pw]");
      if (e.target === bg || (x && x.dataset.pw === "x")) bg.remove();
      else if (x && x.dataset.pw === "ver") { bg.remove(); app.go("pro"); }
    });
    bg.addEventListener("keydown", e => { if (e.key === "Escape") bg.remove(); });
    setTimeout(() => { const b = bg.querySelector('[data-pro-plano="anual"]'); if (b) b.focus(); }, 60);
  }

  /* ---------- anúncios (só para quem não é Pro) ----------
     Usa o Google AdSense: os anúncios automáticos do site + os espaços [data-anuncio] (se houver ids em LA_ADS.slots).
     Nunca aparecem dentro de aulas, questões ou do relógio de estudo. */
  let carregado = false;
  function anuncios(app) {
    const cfg = window.LA_ADS || {};
    if (!cfg.cliente) return;
    if (app.ehPro()) { document.querySelectorAll("[data-anuncio]").forEach(x => { x.innerHTML = ""; x.hidden = true; }); return; }
    if (!carregado) {
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

  (window.LAComp = window.LAComp || {}).Pro = { render, paywall, anuncios, PLANOS };
})();
