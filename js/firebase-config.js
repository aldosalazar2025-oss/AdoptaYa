// Configuración del proyecto de Firebase "mascotas-ecaac"
// (Firebase console → Configuración del proyecto → Tus apps)
const firebaseConfig = {
  apiKey: "AIzaSyAVyGlwovULgVfE-yrczCzx1als6Ld63Zs",
  authDomain: "mascotas-ecaac.firebaseapp.com",
  projectId: "mascotas-ecaac",
  storageBucket: "mascotas-ecaac.firebasestorage.app",
  messagingSenderId: "743954506238",
  appId: "1:743954506238:web:c409d49d0d3f41f73be0af"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
