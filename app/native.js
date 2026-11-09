// Alleen in de Android-app: geeft de webapp de echte Android-Bluetooth en
// "scherm aan" via Capacitor. Bootst daarvoor het stukje Web Bluetooth na dat app.js
// gebruikt, zodat app.js zelf niet hoeft te veranderen. In de browser doet dit niets.
// Bouwen: npm run bouw  (→ public/native.js)
import { Capacitor } from '@capacitor/core';
import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';
import { KeepAwake } from '@capacitor-community/keep-awake';

const naarUuid = (u) => (typeof u === 'number' ? numberToUUID(u) : String(u).toLowerCase());
const naarDataView = (d) => (d instanceof DataView ? d : new DataView(d.buffer || d, d.byteOffset || 0, d.byteLength));
const fout = (naam, tekst) => Object.assign(new Error(tekst), { name: naam });

class Kenmerk {
  constructor(apparaat, dienst, c) {
    this.apparaat = apparaat; this.dienst = dienst;
    this.uuid = c.uuid; this.properties = c.properties || {};
    this.value = null; this.oncharacteristicvaluechanged = null;
  }
  async startNotifications() {
    await BleClient.startNotifications(this.apparaat.id, this.dienst, this.uuid, (dv) => {
      this.value = dv;
      this.oncharacteristicvaluechanged?.({ target: this });
    });
    return this;
  }
  writeValueWithResponse(d) { return BleClient.write(this.apparaat.id, this.dienst, this.uuid, naarDataView(d)); }
  writeValueWithoutResponse(d) { return BleClient.writeWithoutResponse(this.apparaat.id, this.dienst, this.uuid, naarDataView(d)); }
  writeValue(d) { return this.properties.write ? this.writeValueWithResponse(d) : this.writeValueWithoutResponse(d); }
  readValue() { return BleClient.read(this.apparaat.id, this.dienst, this.uuid); }
}

class Dienst {
  constructor(apparaat, s) { this.apparaat = apparaat; this.uuid = s.uuid; this.kenmerken = s.characteristics.map((c) => new Kenmerk(apparaat, s.uuid, c)); }
  async getCharacteristic(u) {
    const k = this.kenmerken.find((c) => c.uuid === naarUuid(u));
    if (!k) throw fout('NotFoundError', 'Kenmerk niet gevonden: ' + naarUuid(u));
    return k;
  }
  async getCharacteristics() { return this.kenmerken; }
}

class Apparaat {
  constructor(d) {
    this.id = d.deviceId; this.name = d.name || '';
    this.luisteraars = [];
    this.diensten = [];
    const apparaat = this;
    const server = {
      async getPrimaryService(u) {
        const s = apparaat.diensten.find((x) => x.uuid === naarUuid(u));
        if (!s) throw fout('NotFoundError', 'Dienst niet gevonden: ' + naarUuid(u));
        return s;
      },
      async getPrimaryServices() { return apparaat.diensten; },
    };
    this.gatt = {
      connected: false,
      async connect() {
        await BleClient.connect(apparaat.id, () => {
          apparaat.gatt.connected = false;
          apparaat.luisteraars.forEach((f) => f());
        }, { timeout: 15000 });
        apparaat.gatt.connected = true;
        apparaat.diensten = (await BleClient.getServices(apparaat.id)).map((s) => new Dienst(apparaat, s));
        return server;
      },
      disconnect() { BleClient.disconnect(apparaat.id).catch(() => {}); },
    };
  }
  addEventListener(naam, f) { if (naam === 'gattserverdisconnected') this.luisteraars.push(f); }
}

if (Capacitor.isNativePlatform()) {
  window.__native = true;
  let start;
  const init = () => (start ||= BleClient.initialize({ androidNeverForLocation: true }));

  const bluetooth = {
    async getAvailability() { await init(); return BleClient.isEnabled(); },
    async requestDevice(opties = {}) {
      await init();
      if (!(await BleClient.isEnabled())) {
        try { await BleClient.requestEnable(); } catch { /* geweigerd */ }
        if (!(await BleClient.isEnabled())) throw fout('NotFoundError', 'Bluetooth adapter not available.');
      }
      const o = { optionalServices: (opties.optionalServices || []).map(naarUuid), displayMode: 'list' };
      if (!opties.acceptAllDevices) o.namePrefix = 'iBBQ';
      try {
        return new Apparaat(await BleClient.requestDevice(o));
      } catch (e) {
        const tekst = String(e.message || e);
        if (/no device/i.test(tekst)) throw fout('NotFoundError', 'Geen thermometer gevonden. Staat hij aan? Probeer anders "Toon álle Bluetooth-apparaten".');
        throw fout('NotFoundError', tekst);
      }
    },
  };
  const IBBQ = numberToUUID(0xfff0);
  const lijktThermometer = (naam) => /ibbq|ibt|inkbird/i.test(naam || '');
  // Thermometers die de telefoon al kent: eerder gebruikt, nu verbonden (bijv. via BBQ Go)
  // of gekoppeld in de Bluetooth-instellingen. Daarmee kan zonder zoeken verbonden worden.
  bluetooth.bekende = async () => {
    await init();
    const lijst = [];
    const voegToe = (d, bron) => { if (d && !lijst.some((x) => x.id === d.deviceId)) lijst.push({ id: d.deviceId, name: d.name, bron }); };
    try { const v = JSON.parse(localStorage.getItem('bbqApparaat') || 'null'); if (v) voegToe(v, 'eerder gebruikt'); } catch { /* niets */ }
    try { (await BleClient.getConnectedDevices([IBBQ])).forEach((d) => voegToe(d, 'nu verbonden')); } catch { /* niet ondersteund */ }
    try { (await BleClient.getConnectedDevices([])).filter((d) => lijktThermometer(d.name)).forEach((d) => voegToe(d, 'nu verbonden')); } catch { /* niets */ }
    try { (await BleClient.getBondedDevices()).filter((d) => lijktThermometer(d.name)).forEach((d) => voegToe(d, 'gekoppeld')); } catch { /* niets */ }
    return lijst;
  };
  bluetooth.apparaat = (id, name) => new Apparaat({ deviceId: id, name });
  // Melden als Bluetooth aan/uit gaat (dan meteen opnieuw verbinden)
  bluetooth.opAdapter = (terug) => { init().then(() => BleClient.startEnabledNotifications(terug)).catch(() => {}); };
  bluetooth.onthoud = (a) => {
    try { localStorage.setItem('bbqApparaat', JSON.stringify({ deviceId: a.id, name: a.name })); } catch { /* geen opslag */ }
  };
  bluetooth.zoektest = async (ms, terug) => {
    await init();
    if (!(await BleClient.isEnabled())) throw fout('NotFoundError', 'Bluetooth staat uit');
    await BleClient.requestLEScan({ allowDuplicates: false }, (r) => terug({
      id: r.device.deviceId,
      name: r.localName || r.device.name,
      rssi: r.rssi,
      uuids: r.uuids,
      fabrikant: r.manufacturerData ? Object.keys(r.manufacturerData).join(',') : '',
    }));
    await new Promise((ok) => setTimeout(ok, ms));
    await BleClient.stopLEScan();
  };
  Object.defineProperty(navigator, 'bluetooth', { value: bluetooth, configurable: true });

  // Scherm aan houden
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      async request() {
        await KeepAwake.keepAwake();
        return { release: () => KeepAwake.allowSleep(), addEventListener() {} };
      },
    },
  });

}
