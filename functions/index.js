/* Logic Academy Pro — pagamentos pelo Mercado Pago (Checkout Pro: Pix, cartão e boleto).
   - criarPagamento (chamada pelo app, com login): cria o pagamento do plano escolhido e devolve o link do checkout.
   - mpWebhook (chamado pelo Mercado Pago): quando o pagamento é aprovado, libera o Pro em assinaturas/{uid}.
   O preço e a duração ficam só aqui no servidor; o app não consegue mudar.
   O token do Mercado Pago fica no Secret Manager (segredo MP_ACCESS_TOKEN), nunca no código. */
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const MP_ACCESS_TOKEN = defineSecret("MP_ACCESS_TOKEN");
const REGIAO = "southamerica-east1";
const PROJETO = process.env.GCLOUD_PROJECT || "mapa-de-estudos-d6eca";
const WEBHOOK = `https://${REGIAO}-${PROJETO}.cloudfunctions.net/mpWebhook`;

const PLANOS = {
  mensal: { titulo: "Logic Academy Pro — 1 mês", preco: 5.0, dias: 31 },
  anual: { titulo: "Logic Academy Pro — 12 meses", preco: 49.9, dias: 366 }
};
// só volta para os sites do Logic Academy depois do pagamento
const ORIGENS = ["https://logicacademy.web.app/", "https://logicacademy.firebaseapp.com/", "https://matoseb-stack.github.io/mapa-de-estudos/"];

async function mp(caminho, op = {}) {
  const r = await fetch("https://api.mercadopago.com" + caminho, {
    ...op,
    headers: { Authorization: "Bearer " + MP_ACCESS_TOKEN.value(), "Content-Type": "application/json", ...(op.headers || {}) }
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`Mercado Pago ${r.status}`); e.corpo = corpo; e.status = r.status; throw e; }
  return corpo;
}

exports.criarPagamento = onCall({ region: REGIAO, secrets: [MP_ACCESS_TOKEN] }, async req => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Entre com sua conta para assinar.");
  const plano = PLANOS[req.data && req.data.plano];
  if (!plano) throw new HttpsError("invalid-argument", "Plano inválido.");
  const origem = ORIGENS.find(o => String(req.data.origem || "").startsWith(o)) || ORIGENS[0];
  const uid = req.auth.uid, email = req.auth.token.email || undefined;
  try {
    const pref = await mp("/checkout/preferences", {
      method: "POST",
      headers: { "X-Idempotency-Key": `${uid}-${req.data.plano}-${Date.now()}` },
      body: JSON.stringify({
        items: [{ id: "pro-" + req.data.plano, title: plano.titulo, quantity: 1, unit_price: plano.preco, currency_id: "BRL" }],
        payer: email ? { email } : undefined,
        external_reference: `${uid}|${req.data.plano}`,
        notification_url: WEBHOOK,
        back_urls: { success: origem + "?pro=ok", pending: origem + "?pro=pendente", failure: origem + "?pro=erro" },
        auto_return: "approved",
        statement_descriptor: "LOGICACADEMY",
        metadata: { uid, plano: req.data.plano }
      })
    });
    return { url: pref.init_point };
  } catch (e) {
    logger.error("criarPagamento", e.status, e.corpo);
    throw new HttpsError("internal", "Não foi possível abrir o pagamento agora.");
  }
});

// libera (ou devolve, em caso de estorno) os dias de Pro, uma única vez por pagamento
async function processarPagamento(id) {
  const pg = await mp("/v1/payments/" + encodeURIComponent(id));
  const [uid, chave] = String(pg.external_reference || "").split("|");
  const plano = PLANOS[chave];
  if (!uid || !plano || pg.currency_id !== "BRL" || Number(pg.transaction_amount) + 0.001 < plano.preco) {
    logger.warn("pagamento ignorado", { id, ref: pg.external_reference, valor: pg.transaction_amount });
    return "ignorado";
  }
  const refPg = db.collection("pagamentos").doc(String(pg.id)), refAss = db.collection("assinaturas").doc(uid);
  return db.runTransaction(async t => {
    const [jaPg, ass] = await Promise.all([t.get(refPg), t.get(refAss)]);
    const antes = jaPg.exists ? jaPg.data().status : null, agora = Date.now();
    const ate = ass.exists && ass.data().ate ? ass.data().ate.toMillis() : 0;
    const aprovado = pg.status === "approved", estornado = ["refunded", "charged_back", "cancelled"].includes(pg.status);
    if (aprovado && antes !== "approved") {
      const novo = Math.max(agora, ate) + plano.dias * 864e5;
      t.set(refAss, { ate: admin.firestore.Timestamp.fromMillis(novo), plano: chave, status: "ativo", ultimoPagamento: String(pg.id), atualizado: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      t.set(refPg, { uid, plano: chave, valor: pg.transaction_amount, metodo: pg.payment_type_id || "", status: "approved", em: admin.firestore.FieldValue.serverTimestamp() });
      return "liberado";
    }
    if (estornado && antes === "approved") {
      const novo = Math.max(agora, ate - plano.dias * 864e5);
      t.set(refAss, { ate: admin.firestore.Timestamp.fromMillis(novo), status: novo > agora ? "ativo" : "estornado", atualizado: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      t.set(refPg, { status: pg.status, estornadoEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return "estornado";
    }
    if (!jaPg.exists) t.set(refPg, { uid, plano: chave, valor: pg.transaction_amount, metodo: pg.payment_type_id || "", status: pg.status, em: admin.firestore.FieldValue.serverTimestamp() });
    return "sem mudança";
  });
}

exports.mpWebhook = onRequest({ region: REGIAO, secrets: [MP_ACCESS_TOKEN] }, async (req, res) => {
  // o Mercado Pago avisa só o número do pagamento; os dados são sempre buscados de novo na API (não dá para forjar)
  const tipo = req.query.type || req.query.topic || (req.body && (req.body.type || req.body.topic));
  const id = req.query["data.id"] || req.query.id || (req.body && req.body.data && req.body.data.id);
  if (tipo !== "payment" || !id) { res.status(200).send("ok"); return; }
  try {
    const r = await processarPagamento(id);
    logger.info("pagamento", { id, r });
    res.status(200).send(r);
  } catch (e) {
    logger.error("mpWebhook", id, e.status, e.corpo || e.message);
    res.status(500).send("erro");                         // o Mercado Pago tenta de novo mais tarde
  }
});

if (process.env.LA_TESTE) exports._teste = { PLANOS, processarPagamento };   // só nos testes locais
