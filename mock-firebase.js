// Firebase de DEMONSTRAÇÃO: roda só dentro do navegador da gravação dos vídeos.
// Imita a parte do SDK "compat" que o app usa (auth + firestore) com tudo em memória.
// Nada aqui fala com o Firebase de verdade: os usuários e as conversas existem só no vídeo.
(function(){
  "use strict";
  const STORE=new Map();          // caminho do documento -> dados
  const LIS=new Set();            // ouvintes (onSnapshot)
  let seq=0;
  const nid=()=>Date.now().toString(36)+(seq++).toString(36)+Math.random().toString(36).slice(2,7);
  class Timestamp{constructor(ms){this._ms=ms;this.seconds=Math.floor(ms/1000);this.nanoseconds=(ms%1000)*1e6}
    toMillis(){return this._ms}toDate(){return new Date(this._ms)}static now(){return new Timestamp(Date.now())}static fromMillis(ms){return new Timestamp(ms)}static fromDate(d){return new Timestamp(+d)}}
  const FV=t=>({__fv:t});
  const isFV=(v,t)=>v&&typeof v==="object"&&v.__fv&&(!t||v.__fv===t);
  function copia(v){if(v instanceof Timestamp)return v;if(Array.isArray(v))return v.map(copia);if(v&&typeof v==="object"){const o={};for(const k in v)o[k]=copia(v[k]);return o}return v}
  function resolve(v,antigo){
    if(isFV(v,"ts"))return new Timestamp(Date.now());
    if(isFV(v,"union"))return [...(Array.isArray(antigo)?antigo:[]),...v.v.filter(x=>!(antigo||[]).includes(x))];
    if(isFV(v,"remove"))return (Array.isArray(antigo)?antigo:[]).filter(x=>!v.v.includes(x));
    if(isFV(v,"inc"))return (typeof antigo==="number"?antigo:0)+v.v;
    if(v instanceof Timestamp)return v;
    if(Array.isArray(v))return v.map(x=>resolve(x));
    if(v&&typeof v==="object"){const o={};for(const k in v){if(isFV(v[k],"del"))continue;o[k]=resolve(v[k],antigo&&antigo[k])}return o}
    return v}
  function mescla(a,b){const o=copia(a||{});for(const k in b){const v=b[k];
      if(isFV(v,"del")){delete o[k];continue}
      if(v&&typeof v==="object"&&!Array.isArray(v)&&!(v instanceof Timestamp)&&!isFV(v)&&o[k]&&typeof o[k]==="object"&&!Array.isArray(o[k])&&!(o[k] instanceof Timestamp))o[k]=mescla(o[k],v);
      else o[k]=resolve(v,o[k])}return o}
  function atualiza(a,b){const o=copia(a||{});for(const chave in b){const partes=chave.split(".");let alvo=o;
      for(let i=0;i<partes.length-1;i++){if(!alvo[partes[i]]||typeof alvo[partes[i]]!=="object")alvo[partes[i]]={};alvo=alvo[partes[i]]}
      const ult=partes[partes.length-1];if(isFV(b[chave],"del"))delete alvo[ult];else alvo[ult]=resolve(b[chave],alvo[ult])}return o}
  const valorOrdem=v=>v instanceof Timestamp?v.toMillis():v;
  const campo=(d,c)=>c.split(".").reduce((x,k)=>x==null?undefined:x[k],d);

  let aviso=null;
  function avisar(){if(aviso)return;aviso=setTimeout(()=>{aviso=null;LIS.forEach(l=>{try{l.rodar()}catch(e){console.warn("demo",e)}})},0)}
  function escrever(caminho,dados){if(dados===null)STORE.delete(caminho);else STORE.set(caminho,dados);avisar()}

  class DocSnap{constructor(ref,dados){this.ref=ref;this.id=ref.id;this._d=dados;this.exists=dados!==undefined;this.metadata={hasPendingWrites:false,fromCache:false}}
    data(){return this._d===undefined?undefined:copia(this._d)}get(c){return this._d?copia(campo(this._d,c)):undefined}}
  class DocRef{constructor(caminho){this.path=caminho;this.id=caminho.split("/").pop()}
    get parent(){return new ColRef(this.path.split("/").slice(0,-1).join("/"))}
    collection(c){return new ColRef(this.path+"/"+c)}
    async get(){return new DocSnap(this,STORE.get(this.path))}
    async set(d,o){const antigo=STORE.get(this.path);escrever(this.path,o&&o.merge?mescla(antigo,d):resolve(d))}
    async update(d){const antigo=STORE.get(this.path);if(antigo===undefined){const e=new Error("not-found");e.code="not-found";throw e}escrever(this.path,atualiza(antigo,d))}
    async delete(){escrever(this.path,null)}
    onSnapshot(fn,err){let ultimo;const l={rodar:()=>{const d=STORE.get(this.path),j=JSON.stringify(d);if(j===ultimo)return;ultimo=j;fn(new DocSnap(this,d))}};
      LIS.add(l);setTimeout(()=>l.rodar(),0);return ()=>LIS.delete(l)}
    isEqual(o){return o&&o.path===this.path}}
  class Query{constructor(col,filtros,ordem,lim){this._col=col;this._f=filtros||[];this._o=ordem||[];this._l=lim}
    where(c,op,v){return new Query(this._col,[...this._f,[c,op,v]],this._o,this._l)}
    orderBy(c,dir){return new Query(this._col,this._f,[...this._o,[c,dir||"asc"]],this._l)}
    limit(n){return new Query(this._col,this._f,this._o,n)}
    limitToLast(n){return new Query(this._col,this._f,this._o,-n)}
    _docs(){const pref=this._col+"/",lista=[];
      STORE.forEach((d,p)=>{if(p.startsWith(pref)&&!p.slice(pref.length).includes("/"))lista.push([p,d])});
      let r=lista.filter(([,d])=>this._f.every(([c,op,v])=>{const x=campo(d,c);
        return op==="=="?x===v:op==="!="?x!==v:op==="array-contains"?Array.isArray(x)&&x.includes(v):op==="in"?v.includes(x):op===">"?valorOrdem(x)>v:op===">="?valorOrdem(x)>=v:op==="<"?valorOrdem(x)<v:op==="<="?valorOrdem(x)<=v:true}));
      this._o.slice().reverse().forEach(([c,dir])=>r.sort((a,b)=>{const x=valorOrdem(campo(a[1],c)),y=valorOrdem(campo(b[1],c));return (x>y?1:x<y?-1:0)*(dir==="desc"?-1:1)}));
      if(this._l>0)r=r.slice(0,this._l);else if(this._l<0)r=r.slice(this._l);
      return r.map(([p,d])=>new DocSnap(new DocRef(p),d))}
    _snap(docs,antes){const ids=new Map(docs.map(d=>[d.id,d])),mud=[];
      docs.forEach(d=>{const a=antes&&antes.get(d.id);if(!a)mud.push({type:"added",doc:d});else if(JSON.stringify(a._d)!==JSON.stringify(d._d))mud.push({type:"modified",doc:d})});
      if(antes)antes.forEach((d,id)=>{if(!ids.has(id))mud.push({type:"removed",doc:d})});
      return {docs,size:docs.length,empty:!docs.length,forEach:f=>docs.forEach(f),docChanges:()=>mud,metadata:{hasPendingWrites:false,fromCache:false},query:this}}
    async get(){return this._snap(this._docs(),null)}
    onSnapshot(fn,err){let antes=null,ultimo;const l={rodar:()=>{const docs=this._docs(),j=JSON.stringify(docs.map(d=>[d.id,d._d]));if(j===ultimo)return;ultimo=j;
        const s=this._snap(docs,antes);antes=new Map(docs.map(d=>[d.id,d]));fn(s)}};
      LIS.add(l);setTimeout(()=>l.rodar(),0);return ()=>LIS.delete(l)}}
  class ColRef extends Query{constructor(caminho){super(caminho);this.path=caminho;this.id=caminho.split("/").pop()}
    doc(id){return new DocRef(this.path+"/"+(id||nid()))}
    async add(d){const r=this.doc();await r.set(d);return r}}
  const DB={collection:c=>new ColRef(c),doc:p=>new DocRef(p),
    batch(){const ops=[];return {set(r,d,o){ops.push(()=>r.set(d,o));return this},update(r,d){ops.push(()=>r.update(d));return this},delete(r){ops.push(()=>r.delete());return this},
      async commit(){for(const op of ops)await op()}}},
    async runTransaction(fn){return fn({get:r=>r.get(),set:(r,d,o)=>r.set(d,o),update:(r,d)=>r.update(d),delete:r=>r.delete()})},
    settings(){},enablePersistence:async()=>{}};

  // conta de quem aparece no vídeo (configurável antes do app carregar)
  const EU=window.DEMO_EU||{uid:"demo_eu",nome:"Ana Souza"};
  const usuario={uid:EU.uid,displayName:EU.nome,email:"demo@exemplo.com",emailVerified:true,providerData:[],updateProfile:async()=>{}};
  const AUTH={currentUser:usuario,languageCode:"pt-BR",onAuthStateChanged(cb){setTimeout(()=>cb(usuario),30);return ()=>{}},getRedirectResult:async()=>null,
    signOut:async()=>{},signInWithPopup:async()=>({user:usuario}),signInWithRedirect:async()=>{},createUserWithEmailAndPassword:async()=>({user:usuario}),
    signInWithEmailAndPassword:async()=>({user:usuario}),sendPasswordResetEmail:async()=>{}};
  const firebase={apps:[],initializeApp(){this.apps.push({});return {}},auth:()=>AUTH,firestore:()=>DB};
  firebase.auth.GoogleAuthProvider=class{addScope(){}};firebase.auth.OAuthProvider=class{addScope(){}};
  firebase.firestore.FieldValue={serverTimestamp:()=>FV("ts"),delete:()=>FV("del"),arrayUnion:(...v)=>({__fv:"union",v}),arrayRemove:(...v)=>({__fv:"remove",v}),increment:v=>({__fv:"inc",v})};
  firebase.firestore.Timestamp=Timestamp;
  Object.defineProperty(window,"firebase",{value:firebase,writable:false,configurable:false});

  // atalhos para os roteiros: escrever como se fosse outra pessoa
  window.DEMO={STORE,Timestamp,ts:ms=>new Timestamp(ms==null?Date.now():ms),
    set:(p,d)=>{STORE.set(p,resolve(d));avisar()},merge:(p,d)=>{STORE.set(p,mescla(STORE.get(p),d));avisar()},
    add:(col,d)=>{const p=col+"/"+nid();STORE.set(p,resolve(d));avisar();return p.split("/").pop()},
    get:p=>copia(STORE.get(p)),del:p=>{STORE.delete(p);avisar()},
    lista:pref=>[...STORE.keys()].filter(k=>k.startsWith(pref)),eu:EU};
})();
