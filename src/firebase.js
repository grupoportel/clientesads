import { initializeApp } from "firebase/app";
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

// Exporta as ferramentas para usarmos nos outros arquivos
export const database = getDatabase(app);
export const auth = getAuth(app);