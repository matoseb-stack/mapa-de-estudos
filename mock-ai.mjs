// IA de DEMONSTRAÇÃO (só no vídeo): substitui firebase-app.js / firebase-ai.js / firebase-app-check.js do gstatic.
// A resposta vem de window.DEMO_IA(pergunta) e chega aos poucos, como na mentoria real.
export function initializeApp(){return {name:"demo"}}
export function initializeAppCheck(){return {}}
export class ReCaptchaV3Provider{}
export class ReCaptchaEnterpriseProvider{}
export class GoogleAIBackend{}
export function getAI(){return {}}
const espera=ms=>new Promise(r=>setTimeout(r,ms));
export function getGenerativeModel(){return {
  async generateContentStream({contents}){
    const txt=(contents||[]).filter(c=>c.role==="user").map(c=>c.parts.map(p=>p.text||"").join(" ")).join("\n");
    // pedidos que esperam JSON (plano, edital): sem IA no vídeo, o app usa o cálculo local
    if(/JSON/.test(txt)&&!/PERGUNTA:/.test(txt))throw new Error("demo: sem IA para JSON");
    const pergunta=(txt.split("PERGUNTA:").pop()||txt).trim();
    const resp=(window.DEMO_IA&&window.DEMO_IA(pergunta))||"Ótima pergunta! Vamos montar isso juntos.";
    const pedacos=resp.match(/\S+\s*/g)||[resp];
    await espera(700);
    return {stream:(async function*(){for(const p of pedacos){await espera(38);yield {text:()=>p}}})(),response:Promise.resolve({text:()=>resp})}},
  async generateContent(r){const s=await this.generateContentStream(r);let t="";for await(const c of s.stream)t+=c.text();return {response:{text:()=>t}}}}}
