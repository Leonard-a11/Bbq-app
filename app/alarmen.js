// Alarmen: geluid, trillen, meldingen (ook met scherm uit) en de achtergrondservice.
import { registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { inst } from './staat.js';
import { $, esc, isNative } from './hulp.js';

const Achtergrond = registerPlugin('Achtergrond');
let ctx = null, geluidTimer = null, kanaalKlaar = null;
const actief = new Map(); // sleutel → { titel, tekst }

export function ontgrendelGeluid() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
  } catch { /* geen geluid */ }
}
function piep() {
  if (!ctx || !inst.geluid) return;
  [0, 0.22, 0.44].forEach((d, k) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = k === 2 ? 2093 : 1760;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + d);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + d + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.16);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.17);
  });
}

/** Uitspreken (Nederlands). In de app via Android-spraak, in de browser via speechSynthesis. */
export function spreek(tekst) {
  if (!inst.spraak) return;
  const t = String(tekst).replace(/°C|°F|°/g, ' graden').replace(/[⏱🔥🔔✅📖]/gu, '').replace(/\s+/g, ' ').trim();
  if (!t) return;
  try {
    if (isNative()) TextToSpeech.speak({ text: t, lang: 'nl-NL', rate: 1.0, volume: 1.0, category: 'playback', queueStrategy: 1 }).catch(() => {});
    else if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(t); u.lang = 'nl-NL'; speechSynthesis.speak(u); }
  } catch { /* geen spraak */ }
}

export async function vraagMeldingen() {
  try {
    if (isNative()) {
      const r = await LocalNotifications.checkPermissions();
      if (r.display !== 'granted') await LocalNotifications.requestPermissions();
      kanaalKlaar ||= LocalNotifications.createChannel({
        id: 'alarm', name: 'Alarmen', description: 'Temperatuur bereikt, BBQ te koud/heet, timers',
        importance: 5, visibility: 1, vibration: true, lights: true, lightColor: '#FF7A1A',
      }).catch(() => {});
    } else if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch { /* geen meldingen */ }
}

let meldingId = 100;
/** Melding op het toestel (ook als de app op de achtergrond staat). */
export async function toestelMelding(titel, tekst, opties = {}) {
  try {
    if (isNative()) {
      await kanaalKlaar;
      await LocalNotifications.schedule({ notifications: [{
        id: opties.id ?? meldingId++, title: titel, body: tekst, channelId: 'alarm',
        smallIcon: 'ic_stat_thermo', iconColor: '#FF7A1A',
        ...(opties.at ? { schedule: { at: new Date(opties.at), allowWhileIdle: true } } : {}),
      }] });
    } else if (!opties.at && 'Notification' in window && Notification.permission === 'granted') {
      const o = { body: tekst, tag: 'bbq-' + (opties.id ?? 'alarm'), renotify: true, icon: 'icoon-192.png' };
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg) await reg.showNotification(titel, o); else new Notification(titel, o);
    }
  } catch { /* geen melding mogelijk */ }
}
export async function annuleerMelding(id) {
  if (!isNative()) return;
  try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch { /* al weg */ }
}

/** Alarm aan: rode balk, geluid, trillen en een melding. */
export function geefAlarm(sleutel, titel, tekst, { melden = true } = {}) {
  if (actief.has(sleutel)) return;
  actief.set(sleutel, { titel, tekst });
  toonBalk();
  if (!geluidTimer) { piep(); geluidTimer = setInterval(piep, 1400); }
  if (inst.trillen && navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
  if (melden) toestelMelding(titel, tekst);
  spreek(titel);
}
export function heeftAlarm(sleutel) { return actief.has(sleutel); }
export function wisAlarm(sleutel) {
  if (!actief.delete(sleutel)) return;
  toonBalk();
}
/** Alle alarmen bevestigen. Geeft de sleutels terug. */
export function stopAlarmen() {
  const sleutels = [...actief.keys()];
  actief.clear();
  toonBalk();
  return sleutels;
}
function toonBalk() {
  const el = $('#alarm');
  if (!actief.size) {
    el.hidden = true;
    clearInterval(geluidTimer); geluidTimer = null;
    return;
  }
  $('#alarm-tekst').innerHTML = [...actief.values()].map((a) => `<div><b>${esc(a.titel)}</b>${a.tekst ? `<small>${esc(a.tekst)}</small>` : ''}</div>`).join('');
  el.hidden = false;
}

// ---------- Achtergrondservice (Android) ----------
let achtergrondAan = false;
export async function achtergrondStart(tekst) {
  if (!isNative()) return;
  try {
    await Achtergrond.start({ titel: 'BBQ Thermometer meet', tekst });
    achtergrondAan = true;
  } catch (e) { console.warn(e); }
}
export function achtergrondUpdate(titel, tekst) {
  if (!isNative() || !achtergrondAan) return;
  Achtergrond.update({ titel, tekst }).catch(() => {});
}
export async function achtergrondStop() {
  if (!isNative() || !achtergrondAan) return;
  achtergrondAan = false;
  try { await Achtergrond.stop(); } catch { /* al gestopt */ }
}
export async function achtergrondStatus() {
  if (!isNative()) return null;
  try { return await Achtergrond.status(); } catch { return null; }
}
export function accuVrijgeven() { return Achtergrond.accuVrijgeven(); }

// ---------- Scherm aan houden (alleen als de app zichtbaar is) ----------
let wakeLock = null;
export async function houdSchermAan() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); } } catch { /* mag niet */ }
}
export function laatSchermLos() { try { wakeLock?.release?.(); } catch { /* */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wakeLock = null; });
