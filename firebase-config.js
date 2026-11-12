// Configuração do login por e-mail e da nuvem (Firebase) do Mapa de Estudos.
// Estes valores são públicos por natureza; quem protege os dados são as regras do Firestore (firestore.rules).
window.MAPA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDtUB5CNTtGiyxMPZafYFsQVhaneL3iF-Q",
  authDomain: "mapa-de-estudos-d6eca.firebaseapp.com",
  projectId: "mapa-de-estudos-d6eca",
  storageBucket: "mapa-de-estudos-d6eca.firebasestorage.app",
  messagingSenderId: "454005758309",
  appId: "1:454005758309:web:2b477549a8d801b200e98c",
  measurementId: "G-X9061S2G4L",
  // App Check ligado no Firebase: a IA (Firebase AI Logic) só responde a pedidos com o comprovante do App Check.
  // Esta é a chave PÚBLICA do site no reCAPTCHA v3 (a chave secreta fica só no painel do Firebase).
  // Os domínios logicacademy.web.app e matoseb-stack.github.io precisam estar na lista da chave no reCAPTCHA.
  // Se um dia a chave for do reCAPTCHA Enterprise, acrescente appCheckEnterprise: true.
  appCheckSiteKey: "6LfU4d0tAAAAAGFGclhMF-twnNWXmyfu3Ezwm0n-"
};
