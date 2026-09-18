import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// As chaves que você já usava no código antigo
const firebaseConfig = {
  apiKey: "AIzaSyCTjJ2x_ujBjDTZzrkgHxP8RyTVqj4swkE",
  authDomain: "crm---grupo-portel.firebaseapp.com",
  databaseURL: "https://crm---grupo-portel-default-rtdb.firebaseio.com",
  projectId: "crm---grupo-portel",
  storageBucket: "crm---grupo-portel.firebasestorage.app",
  messagingSenderId: "1070269671191",
  appId: "1:1070269671191:web:2ea382e76a06f0b0947952"
};

// Inicializa o app
const app = initializeApp(firebaseConfig);

// O App Check fica inativo até a chave pública do reCAPTCHA Enterprise ser
// configurada na Vercel. Assim podemos publicar a preparação primeiro,
// observar as métricas e só depois exigir os tokens sem bloquear usuários.
const chaveAppCheck = String(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY || '').trim();

if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG === 'true') {
  // Em desenvolvimento o Firebase exibirá um token no console. Cadastre esse
  // token na tela App Check > Apps > Debug tokens; nunca use esta opção em
  // Production ou Preview.
  globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export const appCheck = chaveAppCheck
  ? initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(chaveAppCheck),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

// Exporta as ferramentas para usarmos nos outros arquivos
export const database = getDatabase(app);
export const auth = getAuth(app);
