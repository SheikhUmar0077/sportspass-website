import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");
const verifyAccess = httpsCallable(functions, "getBusinessDashboardAccess");

const form = document.querySelector("#login-form");
const checking = document.querySelector("#auth-checking");
const verified = document.querySelector("#verified-state");
const message = document.querySelector("#form-message");
const loginButton = document.querySelector("#submit-login");
const businessType = document.body.dataset.businessType;

let authorizationMessage = "";
let verificationSequence = 0;
let verifyInProgress = false;
let refreshTimer;

function setBusy(isBusy) {
  loginButton.disabled = isBusy;
  loginButton.classList.toggle("is-loading", isBusy);
  loginButton.querySelector(".button-label").textContent =
    isBusy ? "Checking account…" : "Sign in";
}

function showSignedOut(notice = "") {
  checking.hidden = true;
  verified.hidden = true;
  form.hidden = false;
  message.textContent = notice;
  setBusy(false);
}

function authErrorMessage(error) {
  if (
    ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found",
      "auth/invalid-email", "auth/too-many-requests"].includes(error.code)
  ) {
    return error.code === "auth/too-many-requests"
      ? "Too many attempts. Please wait a moment and try again."
      : "Email or password is incorrect.";
  }
  if (error.code === "auth/network-request-failed") {
    return "Could not connect. Check your internet connection and try again.";
  }
  return "Could not sign in right now. Please try again.";
}

async function checkBusinessAccess(user) {
  if (verifyInProgress) return;
  verifyInProgress = true;
  const sequence = ++verificationSequence;
  checking.hidden = false;
  form.hidden = true;
  verified.hidden = true;

  try {
    const response = await verifyAccess({ businessType });
    if (sequence !== verificationSequence || auth.currentUser?.uid !== user.uid) {
      return;
    }
    const account = response.data;
    verified.querySelector("#business-name").textContent =
      account.displayName || (businessType === "partner" ? "Partner portal" : "Corporate portal");
    verified.querySelector("#account-email").textContent = user.email || "";
    checking.hidden = true;
    form.hidden = true;
    verified.hidden = false;
    authorizationMessage = "";
    setBusy(false);
  } catch (error) {
    if (sequence !== verificationSequence) return;
    authorizationMessage =
      error.code === "functions/permission-denied"
        ? "This account does not have an active account for this dashboard."
        : "We could not verify dashboard access. Please try again.";
    try {
      await signOut(auth);
    } catch {
      showSignedOut(
        "We could not verify access or clear your session. Refresh the page before trying again.",
      );
    }
  } finally {
    if (sequence === verificationSequence) verifyInProgress = false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  setBusy(true);
  message.textContent = "";
  const data = new FormData(form);
  try {
    await setPersistence(auth, browserSessionPersistence);
    await signInWithEmailAndPassword(
      auth,
      data.get("email").toString().trim(),
      data.get("password").toString(),
    );
  } catch (error) {
    message.textContent = authErrorMessage(error);
    setBusy(false);
  }
});

document.querySelector("#toggle-password").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const password = document.querySelector("#password");
  const visible = password.type === "password";
  password.type = visible ? "text" : "password";
  button.textContent = visible ? "Hide" : "Show";
  button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
  button.setAttribute("aria-pressed", String(visible));
});

document.querySelector("#forgot-password").addEventListener("click", async () => {
  const email = document.querySelector("#email").value.trim();
  if (!email || !document.querySelector("#email").checkValidity()) {
    message.textContent = "Enter your account email first.";
    document.querySelector("#email").focus();
    return;
  }

  const button = document.querySelector("#forgot-password");
  button.disabled = true;
  message.textContent = "";
  try {
    await sendPasswordResetEmail(auth, email);
    message.textContent =
      "If an account exists for that email, a password reset link will be sent.";
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      message.textContent =
        "If an account exists for that email, a password reset link will be sent.";
    } else if (error.code === "auth/network-request-failed") {
      message.textContent = "Could not connect. Check your internet connection and try again.";
    } else if (error.code === "auth/too-many-requests") {
      message.textContent = "Too many reset requests. Please wait and try again.";
    } else if (error.code === "auth/operation-not-allowed") {
      message.textContent = "Password reset is unavailable. Please contact Sportspass support.";
    } else {
      message.textContent = "Could not request a password reset right now. Please try again.";
    }
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#sign-out").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const verifiedMessage = document.querySelector("#verified-message");
  button.disabled = true;
  verifiedMessage.textContent = "";
  try {
    await signOut(auth);
  } catch {
    verifiedMessage.textContent = "Could not sign out. Please try again.";
    button.disabled = false;
  }
});

onAuthStateChanged(auth, (user) => {
  verificationSequence++;
  verifyInProgress = false;
  clearInterval(refreshTimer);
  if (!user) {
    showSignedOut(authorizationMessage);
    authorizationMessage = "";
    return;
  }

  checkBusinessAccess(user);
  refreshTimer = setInterval(() => {
    if (document.visibilityState === "visible" && auth.currentUser) {
      checkBusinessAccess(auth.currentUser);
    }
  }, 60_000);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && auth.currentUser) {
    checkBusinessAccess(auth.currentUser);
  }
});
