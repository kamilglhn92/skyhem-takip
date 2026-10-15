/*
 * Olay günlüğü veri deposu (temel sınıf). Klasöre yazar; bulut.js aynı mantığı internet üzerinden uygular
 * (BulutDepo bu sınıfı genişletir). Klasör hâli yalnızca sunum (demo) modunda bellekte kullanılır.
 *
 * Neden böyle: eski sürüm tek bir numune_data.json dosyasını her bilgisayardan
 * komple üzerine yazıyordu; iki kişi çalışınca biri diğerinin verisini siliyordu.
 *
 * Burada her bilgisayar SADECE kendi dosyasına satır EKLER (log/2026-09_<cihaz>.jsonl).
 * Hiçbir dosya başka bir bilgisayar tarafından yazılmaz → yazma çakışması imkânsız.
 * Herkes tüm dosyaları okur, olayları zamana göre sıralar ve aynı sonuca ulaşır.
 * Aynı alan iki kişi tarafından değiştirilirse son yazan kazanır (alan bazında).
 *
 * Klasör düzeni:
 *   numune-takip.json          işaret dosyası (format sürümü)
 *   log/<YYYY-MM>_<cihaz>.jsonl olay kayıtları (sadece eklenir, asla silinmez)
 *   kisi/<cihaz>.json          kim çevrimiçi (30 sn'de bir güncellenir)
 *   ekler/                     etiket fotoğrafı, irsaliye vb. dosyalar
 */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});
  const { uid } = NT.c;

  const FORMAT = 1;
  const ISARET = 'numune-takip.json';
  const VERI_KLASORU = 'NumuneTakip-Veri';
  const cozucu = new TextDecoder();

  function siraKarsilastir(a, b) {
    return a.t - b.t || (a.d < b.d ? -1 : a.d > b.d ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }
  const gecerliOlay = (e) =>
    e && typeof e.id === 'string' && typeof e.t === 'number' && typeof e.c === 'string' &&
    typeof e.k === 'string' && (e.op === 'put' || e.op === 'del' || e.op === 'undel');

  function harfEki(i) {
    let s = '';
    for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  }

  class Depo {
    constructor({ dizin, cihaz, kullanici, bekleyen = [], bekleyenKaydet = () => {}, kilit }) {
      this.dizin = dizin;
      this.cihaz = cihaz;
      this.kullanici = kullanici;
      this.olaylar = new Map();
      this.imlec = new Map();
      this.bekleyen = bekleyen.filter(gecerliOlay);
      this.bekleyenKaydet = bekleyenKaydet;
      this.kilit = kilit || ((fn) => fn());
      this.sonT = 0;
      this.koleksiyonlar = {};
      this.sirali = [];
      this.surum = 0;
      this.dinleyiciler = new Set();
      this.hata = null;
      this.sonEsitleme = null;
      this.bozukSatir = 0;
      this.kisiler = [];
      for (const e of this.bekleyen) this.ekle(e);
    }

    async hazirla() {
      let yeni = false;
      try {
        const f = await (await this.dizin.getFileHandle(ISARET)).getFile();
        const bilgi = JSON.parse((await f.text()) || '{}');
        if (bilgi.format > FORMAT) {
          throw new Error('Bu veri klasörü uygulamanın daha yeni bir sürümüyle oluşturulmuş. Lütfen uygulamayı güncelleyin.');
        }
      } catch (e) {
        if (e.name !== 'NotFoundError') throw e;
        const fh = await this.dizin.getFileHandle(ISARET, { create: true });
        const w = await fh.createWritable();
        await w.write(JSON.stringify({ uygulama: 'SKYHEM Numune Takip', format: FORMAT, olusturma: new Date().toISOString() }, null, 2));
        await w.close();
        yeni = true;
      }
      this.logDizin = await this.dizin.getDirectoryHandle('log', { create: true });
      this.kisiDizin = await this.dizin.getDirectoryHandle('kisi', { create: true });
      this.ekDizin = await this.dizin.getDirectoryHandle('ekler', { create: true });
      return { yeni };
    }

    saat() {
      const t = Math.max(Date.now(), this.sonT + 1);
      this.sonT = t;
      return t;
    }

    ekle(e) {
      if (!gecerliOlay(e) || this.olaylar.has(e.id)) return false;
      this.olaylar.set(e.id, e);
      // Saati ileri kaymış bir bilgisayar herkesi sürüklemesin diye 1 saatle sınırla.
      this.sonT = Math.max(this.sonT, Math.min(e.t, Date.now() + 3600e3));
      return true;
    }

    abone(fn) {
      this.dinleyiciler.add(fn);
      return () => this.dinleyiciler.delete(fn);
    }
    bildir(bilgi = {}) {
      for (const fn of this.dinleyiciler) {
        try { fn(bilgi); } catch (e) { console.error(e); }
      }
    }

    /* ops: [{op:'put'|'del'|'undel', c:koleksiyon, k:anahtar, v:{alan:değer}}] */
    async kaydet(ops) {
      const evs = ops.map((o) => ({ id: uid(12), t: this.saat(), d: this.cihaz, u: this.kullanici, op: o.op || 'put', c: o.c, k: o.k, v: o.v }));
      for (const e of evs) this.ekle(e);
      this.bekleyen.push(...evs);
      this.bekleyenKaydet(this.bekleyen);
      this.yenidenHesapla();
      this.bildir({ yerel: evs });
      await this.gonder();
      return evs;
    }

    async gonder() {
      if (this.gonderiliyor || !this.bekleyen.length || !this.logDizin) return;
      this.gonderiliyor = true;
      try {
        while (this.bekleyen.length) {
          const parti = this.bekleyen.slice();
          const d = new Date();
          const ad = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}_${this.cihaz}.jsonl`;
          await this.kilit(async () => {
            const fh = await this.logDizin.getFileHandle(ad, { create: true });
            const w = await fh.createWritable({ keepExistingData: true });
            await w.seek((await fh.getFile()).size);
            await w.write(parti.map((e) => JSON.stringify(e)).join('\n') + '\n');
            await w.close();
          });
          this.bekleyen = this.bekleyen.slice(parti.length);
          this.bekleyenKaydet(this.bekleyen);
        }
        this.hata = null;
      } catch (e) {
        this.hata = 'Veri klasörüne yazılamadı: ' + (e.message || e.name) + '. Değişiklikler bu bilgisayarda bekletiliyor, bağlantı gelince gönderilecek.';
      } finally {
        this.gonderiliyor = false;
        this.bildir({});
      }
    }

    async tara() {
      if (!this.logDizin) return [];
      const yeni = [];
      try {
        for await (const [ad, h] of this.logDizin.entries()) {
          if (h.kind !== 'file' || !ad.endsWith('.jsonl')) continue;
          const f = await h.getFile();
          const im = this.imlec.get(ad);
          if (im && im.boyut === f.size && im.zaman === f.lastModified) continue;
          const bas = im && f.size >= im.okunan ? im.okunan : 0;
          const buf = new Uint8Array(await f.slice(bas).arrayBuffer());
          const son = buf.lastIndexOf(10);
          if (son >= 0) {
            for (const satir of cozucu.decode(buf.subarray(0, son)).split('\n')) {
              if (!satir.trim()) continue;
              let e;
              try { e = JSON.parse(satir); } catch { this.bozukSatir++; continue; }
              if (this.ekle(e)) yeni.push(e);
            }
          }
          this.imlec.set(ad, { boyut: f.size, zaman: f.lastModified, okunan: bas + son + 1 });
        }
        this.sonEsitleme = Date.now();
        if (this.hata && !this.bekleyen.length) this.hata = null;
      } catch (e) {
        this.hata = 'Veri klasörü okunamadı: ' + (e.message || e.name);
      }
      if (this.bekleyen.length) await this.gonder();
      if (yeni.length) {
        this.yenidenHesapla();
        this.bildir({ yeni });
      } else this.bildir({});
      return yeni;
    }

    yenidenHesapla() {
      const liste = [...this.olaylar.values()].sort(siraKarsilastir);
      const kol = {};
      for (const e of liste) {
        const m = (kol[e.c] ||= new Map());
        let r = m.get(e.k);
        if (e.op === 'put') {
          if (!r) {
            r = { id: e.k, _olusturma: e.t, _olusturan: e.u, _cihaz: e.d, _silindi: false, _gecmis: [] };
            m.set(e.k, r);
          }
          for (const [a, v] of Object.entries(e.v || {})) if (a[0] !== '_' && a !== 'id') r[a] = v;
        } else {
          if (!r) continue;
          r._silindi = e.op === 'del';
        }
        r._degisim = e.t;
        r._degistiren = e.u;
        r._gecmis.push(e);
      }
      // Aynı anda iki bilgisayar aynı kayıt numarasını verirse, önce oluşturulan numarayı korur.
      for (const m of Object.values(kol)) {
        const gruplar = new Map();
        for (const r of m.values()) {
          if (!r.no) continue;
          if (!gruplar.has(r.no)) gruplar.set(r.no, []);
          gruplar.get(r.no).push(r);
        }
        for (const [no, g] of gruplar) {
          if (g.length < 2) continue;
          g.sort((a, b) => a._olusturma - b._olusturma || (a.id < b.id ? -1 : 1));
          g.forEach((r, i) => { if (i) { r._asilNo = no; r.no = `${no}-${harfEki(i)}`; } });
        }
      }
      this.koleksiyonlar = kol;
      this.sirali = liste;
      this.surum++;
    }

    kayitlar(c, { silinenler = false } = {}) {
      const m = this.koleksiyonlar[c];
      if (!m) return [];
      const r = [...m.values()];
      return silinenler ? r : r.filter((x) => !x._silindi);
    }
    kayit(c, k) {
      return this.koleksiyonlar[c]?.get(k) || null;
    }

    async varlikYaz(ekstra = {}) {
      if (!this.kisiDizin) return;
      try {
        const fh = await this.kisiDizin.getFileHandle(`${this.cihaz}.json`, { create: true });
        const w = await fh.createWritable();
        await w.write(JSON.stringify({ cihaz: this.cihaz, ad: this.kullanici, t: Date.now(), ...ekstra }));
        await w.close();
      } catch { /* çevrimiçi göstergesi kritik değil */ }
    }
    async varlikOku() {
      if (!this.kisiDizin) return [];
      const liste = [];
      try {
        for await (const [ad, h] of this.kisiDizin.entries()) {
          if (h.kind !== 'file' || !ad.endsWith('.json')) continue;
          try { liste.push(JSON.parse(await (await h.getFile()).text())); } catch { /* yazılırken okunmuş olabilir */ }
        }
      } catch { /* yoksay */ }
      this.kisiler = liste;
      return liste;
    }

    async ekYaz(dosya) {
      const uzanti = (dosya.name.match(/\.[a-z0-9]{1,5}$/i) || [''])[0].toLowerCase();
      const ad = `${uid(12)}${uzanti}`;
      const fh = await this.ekDizin.getFileHandle(ad, { create: true });
      const w = await fh.createWritable();
      await w.write(dosya);
      await w.close();
      return { dosya: ad, ad: dosya.name, tur: dosya.type || '', boyut: dosya.size };
    }
    async ekOku(ad) {
      return (await this.ekDizin.getFileHandle(ad)).getFile();
    }
  }

  /* Seçilen klasörden veri klasörünü bul ya da oluştur. */
  async function veriDizini(secilen) {
    try { await secilen.getFileHandle(ISARET); return secilen; } catch { /* değil */ }
    try { await secilen.getDirectoryHandle('log'); return secilen; } catch { /* değil */ }
    if (secilen.name === VERI_KLASORU) return secilen;
    return secilen.getDirectoryHandle(VERI_KLASORU, { create: true });
  }

  NT.Depo = Depo;
  NT.depoAraclari = { veriDizini, siraKarsilastir, VERI_KLASORU, FORMAT };
})(typeof window !== 'undefined' ? window : globalThis);
