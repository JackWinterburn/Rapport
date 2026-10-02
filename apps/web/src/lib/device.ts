import { useEffect, useState } from "react";
import { api } from "./api";

/** Resize and compress a photo on the client before upload (max 512px, JPEG). */
export async function resizePhoto(file: File, max = 512, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  // Square-crop to the centre so avatars look right everywhere.
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(max, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

// --- Web push -------------------------------------------------------------

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iOS only allows web push once the app is installed to the home screen. */
export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error("This browser does not support notifications.");
  if (isIos() && !isStandalone()) throw new Error("On iPhone, add Rapport to your Home Screen first, then enable notifications from there.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them in your browser settings.");
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api.pushPublicKey();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await api.pushSubscribe(sub.toJSON());
}

export async function disablePush(): Promise<void> {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await api.pushUnsubscribe(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
}

// --- Install prompt (Chrome/Android/desktop) --------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return {
    canPrompt: Boolean(deferredPrompt),
    installed: typeof window !== "undefined" && isStandalone(),
    prompt: async () => {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      listeners.forEach((l) => l());
    },
  };
}

// --- Online status ----------------------------------------------------------

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

// --- Dictation (Web Speech API, where available) ----------------------------

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

export const dictationSupported = () => typeof window !== "undefined" && getRecognitionCtor() !== null;

/** Start dictation; calls onText with each finalised phrase. Returns a stop function. */
export function startDictation(onText: (text: string) => void, onEnd: () => void, onError: (msg: string) => void): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    onError("Dictation is not supported in this browser. Use your keyboard's microphone instead.");
    onEnd();
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = navigator.language || "en-GB";
  rec.continuous = true;
  rec.interimResults = false;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]!;
      if (r.isFinal) onText(r[0].transcript.trim());
    }
  };
  rec.onerror = (e) => {
    if (e.error !== "no-speech" && e.error !== "aborted") onError(e.error === "not-allowed" ? "Microphone access was blocked." : "Dictation stopped.");
  };
  rec.onend = onEnd;
  rec.start();
  return () => rec.stop();
}

/** Drop cached API responses (personal data) from the service worker cache, e.g. on sign-out. */
export async function clearOfflineData() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_DATA" });
    await caches.delete("rapport-api");
  } catch {
    /* no SW or Cache API */
  }
}

// --- Theme -----------------------------------------------------------------

export type ThemePref = "system" | "light" | "dark";
const THEME_KEY = "rapport-theme";

export function getTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* private mode */
  }
}
