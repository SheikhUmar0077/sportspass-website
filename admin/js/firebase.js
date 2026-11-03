import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const functions = getFunctions(app, "us-central1");
export const signIn = signInWithEmailAndPassword;
export { setPersistence, browserSessionPersistence, signOut, httpsCallable };

const useEmulators =
  location.hostname === "localhost" &&
  new URLSearchParams(location.search).get("emulator") === "1";

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
