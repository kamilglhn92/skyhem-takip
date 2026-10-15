/* Tarayıcı tarafı: kimlik (ad + erişim kodu), bulut deposunu açma, eşitleme zamanlayıcıları. */
(function () {
  'use strict';
  const NT = window.NT;
  const { uid } = NT.c;

  /* --- küçük IndexedDB anahtar-değer deposu (internet yokken açılabilmek için kayıtların kopyası) --- */
  function idb() {
    return new Promise((ok, hata) => {
      const r = indexedDB.open('numune-takip', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => hata(r.error);
    });
  }
  async function idbIslem(mod, fn) {
    const db = await idb();
    return new Promise((ok, hata) => {
      const tx = db.transaction('kv', mod);
      const r = fn(tx.objectStore('kv'));
      tx.oncomplete = () => ok(r && r.result);
      tx.onerror = () => hata(tx.error);
    });
  }
  const idbAl = (k) => idbIslem('readonly', (s) => s.get(k));
  const idbYaz = (k, v) => idbIslem('readwrite', (s) => s.put(v, k));
  const idbSil = (k) => idbIslem('readwrite', (s) => s.delete(k));

  const ls = {
    al(k) { try { return localStorage.getItem(k); } catch { return null; } },
    yaz(k, v) { try { localStorage.setItem(k, v); } catch { /* yoksay */ } },
    sil(k) { try { localStorage.removeItem(k); } catch { /* yoksay */ } },
  };

  /* Kimlik: her tarayıcı kalıcı bir cihaz kodu alır. (?cihaz=... sadece test içindir.) */
  const url = new URLSearchParams(location.search);
  const cihaz = url.get('cihaz') || ls.al('nt.cihaz') || (() => { const c = uid(8); ls.yaz('nt.cihaz', c); return c; })();
  const anahtar = (k) => `nt.${k}.${cihaz}`;

  /* Modül: her sayfa (numune.html, satis.html …) kendi tablosunu ve önbelleğini kullanır; ad + erişim kodu ortaktır.
     Numune eski anahtarları korur (bekleyen kayıtlar ve önbellek kaybolmasın). Karşılama ekranı (depoYok) kendi depo açmaz. */
  const MODULLER = {
    numune: { ad: 'Numune Takip', tablo: 'olaylar', ek: '' },
    satis: { ad: 'Satış Takip', tablo: 'olaylar_satis', ek: '-satis' },
    su: { ad: 'İçme Suyu', tablo: 'olaylar_su', ek: '-su' },
    yemek: { ad: 'Yemek', tablo: 'olaylar_yemek', ek: '-yemek' },
    yoklama: { ad: 'Yoklama', tablo: 'olaylar_yoklama', ek: '-yoklama' },
  };
  const M = Object.assign({ id: 'numune' }, MODULLER[(window.NT_MODUL || {}).id || 'numune'] || {}, window.NT_MODUL || {});
  const onbellekAdi = (m) => 'bulut-olaylar' + m.ek;

  /* Bir modülün bulut deposunu kurar (karşılama ekranı özet için salt okunur olarak da kullanır). */
  function depoOlustur(id, kod, kullanici) {
    const m = { id, ...MODULLER[id] };
    const bAnahtar = anahtar('bekleyen' + m.ek);
    let bekleyen = [];
    try { bekleyen = JSON.parse(ls.al(bAnahtar) || '[]'); } catch { /* yoksay */ }
    return new NT.BulutDepo({
      kod,
      cihaz,
      kullanici: kullanici || 'İsimsiz',
      tablo: m.tablo,
      bekleyen,
      bekleyenKaydet: (l) => (l.length ? ls.yaz(bAnahtar, JSON.stringify(l)) : ls.sil(bAnahtar)),
      kilit: navigator.locks ? (fn) => navigator.locks.request('nt-yaz-' + cihaz + m.ek, fn) : undefined,
      onbellek: { al: () => idbAl(onbellekAdi(m)), yaz: (v) => idbYaz(onbellekAdi(m), v) },
    });
  }

  const b = {
    cihaz,
    modul: M,
    MODULLER,
    depoOlustur,
    durum: 'basliyor', // basliyor | kurulum | hazir | hata
    mod: null, // bulut | demo
    hataMesaji: null,
    depo: null,
    kullanici: url.get('kullanici') || ls.al(anahtar('kullanici')) || ls.al('nt.kullanici') || '',
    kod: ls.al('nt.kod') || '',
    dinleyiciler: new Set(),

    abone(fn) { this.dinleyiciler.add(fn); return () => this.dinleyiciler.delete(fn); },
    bildir() { for (const fn of this.dinleyiciler) fn(); },

    kullaniciAyarla(ad) {
      this.kullanici = ad.trim();
      ls.yaz(anahtar('kullanici'), this.kullanici);
      ls.yaz('nt.kullanici', this.kullanici);
      if (this.depo) { this.depo.kullanici = this.kullanici; this.depo.varlikYaz(); }
      this.bildir();
    },

    async baslat() {
      try {
        if (NT.demo && NT.demo.aktif) return await NT.demo.kur(this);
        if (!this.kullanici || !this.kod) return this.durumYap('kurulum');
        if (M.depoYok) return this.durumYap('hazir');
        await this.bulutAc();
      } catch (e) {
        return this.hataYap(e);
      }
    },

    /* İlk açılış: ad + erişim kodu. Kod sunucuda doğrulanmadan kaydedilmez. */
    async girisYap(ad, kod) {
      kod = kod.trim().toUpperCase();
      let dogru;
      try { dogru = await NT.bulut.kodDogrula(kod); } catch (e) {
        throw Object.assign(new Error(e.message), { detay: e.detay });
      }
      if (!dogru) throw new Error('Erişim kodu yanlış. Kodu uygulamayı kuran kişiden alın.');
      this.kullaniciAyarla(ad);
      this.kod = kod;
      ls.yaz('nt.kod', kod);
      if (M.depoYok) return this.durumYap('hazir');
      await this.bulutAc();
    },

    async bulutAc() {
      await this.ac(depoOlustur(M.id, this.kod, this.kullanici), 'bulut');
    },

    /* Bu bilgisayarın erişimini kaldırır (bütün modüller için). Bulut verilerine dokunmaz. */
    async ayril() {
      this.durdur();
      for (const m of Object.values(MODULLER)) await idbSil(onbellekAdi(m)).catch(() => {});
      ls.sil('nt.kod');
      this.kod = '';
      this.depo = null;
      this.mod = null;
      this.durumYap('kurulum');
    },

    async ac(depo, mod, { hazirYap = true } = {}) {
      await depo.hazirla();
      await depo.tara();
      // Varsayılan tanımlar (ör. numunenin ürün listesi) yalnızca sunucu gerçekten boşsa yazılır; internetsizken boş görünmesi yanıltmasın.
      if (!depo.hata && M.ilkKurulum) await M.ilkKurulum(depo);
      this.depo = depo;
      this.mod = mod;
      this.baslatZamanlayicilar();
      if (hazirYap) this.durumYap('hazir');
    },

    baslatZamanlayicilar() {
      this.durdur();
      const dongu = async () => {
        if (!this.depo) return;
        await this.depo.tara();
        this.taraZaman = setTimeout(dongu, document.hidden ? 30000 : 5000);
      };
      this.taraZaman = setTimeout(dongu, 5000);
      const varlik = async () => {
        if (!this.depo) return;
        if (this.depo.kullanici && this.kullanici) this.depo.kullanici = this.kullanici;
        await this.depo.varlikYaz();
        await this.depo.varlikOku();
        this.bildir();
      };
      varlik();
      this.varlikZaman = setInterval(varlik, 30000);
      this.gorunurluk = () => { if (!document.hidden && this.depo) this.depo.tara(); };
      document.addEventListener('visibilitychange', this.gorunurluk);
      window.addEventListener('focus', this.gorunurluk);
      window.addEventListener('online', this.gorunurluk);
    },
    durdur() {
      clearTimeout(this.taraZaman);
      clearInterval(this.varlikZaman);
      if (this.gorunurluk) {
        document.removeEventListener('visibilitychange', this.gorunurluk);
        window.removeEventListener('focus', this.gorunurluk);
        window.removeEventListener('online', this.gorunurluk);
      }
    },

    durumYap(d) { this.durum = d; this.bildir(); },
    hataYap(e) {
      console.error(e);
      this.hataMesaji = e.message || String(e);
      this.hataKod = e.name === 'KodHatasi';
      this.durumYap('hata');
    },
  };

  NT.baglanti = b;
})();
