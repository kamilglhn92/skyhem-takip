/*
 * Bulut (Supabase) veri deposu. depo.js'deki Depo'nun aynısı; yalnızca okuma/yazma klasör yerine
 * internet üzerinden yapılır. Böylece farklı bilgisayarlar (ortak ağ olmadan) aynı kayıtları görür.
 *
 * Kurallar aynı: olaylar yalnızca EKLENİR (sunucu silme/değiştirmeye izin vermez), herkes tüm olayları
 * okuyup zamana göre birleştirir. Aynı olay iki kez gönderilirse sunucu ikincisini yok sayar.
 *
 * Erişim: her istekte x-nt-kod başlığında kullanıcının girdiği erişim kodu gider. Kod uygulama
 * dosyalarında yazmaz; sunucu yalnızca kodun özetini (sha256) bilir.
 *
 * İnternet yokken: son görülen kayıtlar bu bilgisayarda (IndexedDB) saklıdır, uygulama onlarla açılır;
 * yeni kayıtlar bekletilir ve bağlantı gelince gönderilir.
 */
(function () {
  'use strict';
  const NT = window.NT;

  const SUNUCU = 'https://ocwfhzngqzcsxojmiaqo.supabase.co';
  const ANAHTAR = 'sb_publishable_X8DEW9HdL9RIa5zM7bxZfw_m20QlMp-'; // herkese açık anahtar; asıl koruma erişim kodudur
  const SAYFA = 1000;
  const ORTUSME = 200; // aynı anda yazılan olaylar sıra dışı görünebilir; son 200 olayı her taramada yeniden iste
  const EK_SINIRI = 8 * 1024 * 1024;
  const ALANLAR = ['id', 't', 'd', 'u', 'op', 'c', 'k', 'v'];

  function hataYap(mesaj, ad, detay) {
    return Object.assign(new Error(mesaj), { name: ad, detay });
  }

  async function istek(kod, yol, { method = 'GET', govde, prefer, sure = 20000 } = {}) {
    const iptal = new AbortController();
    const z = setTimeout(() => iptal.abort(), sure);
    let r;
    try {
      r = await fetch(`${SUNUCU}/rest/v1/${yol}`, {
        method,
        headers: {
          apikey: ANAHTAR,
          'x-nt-kod': kod,
          ...(govde !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(prefer ? { Prefer: prefer } : {}),
        },
        body: govde !== undefined ? JSON.stringify(govde) : undefined,
        signal: iptal.signal,
        cache: 'no-store',
      });
    } catch (e) {
      throw hataYap('Sunucuya ulaşılamadı. İnternet bağlantısını kontrol edin.', 'BaglantiYok', e.name === 'AbortError' ? 'zaman aşımı' : e.message);
    } finally {
      clearTimeout(z);
    }
    if (!r.ok) {
      const metin = await r.text().catch(() => '');
      if (r.status === 401 || r.status === 403 || /row-level security/.test(metin)) {
        throw hataYap('Erişim kodu kabul edilmedi.', 'KodHatasi', metin.slice(0, 200));
      }
      throw hataYap(`Sunucu hatası (${r.status}).`, 'SunucuHatasi', metin.slice(0, 200));
    }
    if (r.status === 201 || r.status === 204) return null;
    return r.json();
  }

  /* Girilen kod doğru mu? (yanlış kodla sunucu hata vermez, sadece boş liste döner; bu yüzden ayrıca sorulur) */
  async function kodDogrula(kod) {
    return (await istek(kod, 'rpc/erisim_var', { method: 'POST', govde: {} })) === true;
  }

  function base64(dosya) {
    return new Promise((ok, red) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1] || '');
      r.onerror = () => red(r.error);
      r.readAsDataURL(dosya);
    });
  }

  class BulutDepo extends NT.Depo {
    /* onbellek: { al(): Promise<{sonSira, olaylar}|null>, yaz(veri): Promise } */
    constructor({ kod, onbellek, tablo = 'olaylar', ...o }) {
      super({ ...o, dizin: null });
      this.kod = kod;
      this.tablo = tablo; // her modülün kendi olay tablosu (numune: olaylar, satış: olaylar_satis …)
      this.onbellek = onbellek;
      this.sonSira = 0;
      this.ekOnbellek = new Map();
      this.cevrimici = false;
    }

    async hazirla() {
      const kayitli = await this.onbellek.al().catch(() => null);
      if (kayitli && Array.isArray(kayitli.olaylar)) {
        for (const e of kayitli.olaylar) this.ekle(e);
        this.sonSira = kayitli.sonSira || 0;
        this.yenidenHesapla();
      }
      try {
        if (!(await kodDogrula(this.kod))) throw hataYap('Erişim kodu yanlış.', 'KodHatasi');
        this.cevrimici = true;
      } catch (e) {
        // İnternet yoksa ve daha önce kayıt indirilmişse yine de açıl; kod yanlışsa açılma.
        if (e.name !== 'BaglantiYok' || !this.olaylar.size) throw e;
        this.hata = e.message + ' Son indirilen kayıtlar gösteriliyor; yeni kayıtlar bekletilip bağlantı gelince gönderilecek.';
      }
      this.logDizin = true; // Depo.gonder() bu alanı arar
      return { yeni: false };
    }

    async gonder() {
      if (this.gonderiliyor || !this.bekleyen.length) return;
      this.gonderiliyor = true;
      try {
        while (this.bekleyen.length) {
          const parti = this.bekleyen.slice(0, 500);
          const satirlar = parti.map((e) => Object.fromEntries(ALANLAR.map((a) => [a, e[a] ?? null])));
          await this.kilit(() => istek(this.kod, `${this.tablo}?on_conflict=id`, {
            method: 'POST', govde: satirlar, prefer: 'resolution=ignore-duplicates,return=minimal', sure: 60000,
          }));
          this.bekleyen = this.bekleyen.slice(parti.length);
          this.bekleyenKaydet(this.bekleyen);
        }
        this.hata = null;
      } catch (e) {
        this.hata = (e.name === 'KodHatasi' ? e.message : 'Kayıt sunucuya gönderilemedi: ' + e.message) +
          ' Değişiklikler bu bilgisayarda bekletiliyor, bağlantı gelince gönderilecek.';
      } finally {
        this.gonderiliyor = false;
        this.bildir({});
      }
    }

    async tara() {
      const yeni = [];
      const oncekiSira = this.sonSira;
      try {
        let bas = Math.max(0, this.sonSira - ORTUSME);
        for (;;) {
          const sayfa = await istek(this.kod, `${this.tablo}?select=sira,${ALANLAR.join(',')}&sira=gt.${bas}&order=sira.asc&limit=${SAYFA}`);
          for (const s of sayfa) {
            const { sira, ...e } = s;
            if (e.u === null) delete e.u;
            if (e.v === null) delete e.v;
            if (this.ekle(e)) yeni.push(e);
            if (sira > this.sonSira) this.sonSira = sira;
          }
          if (sayfa.length < SAYFA) break;
          bas = sayfa[sayfa.length - 1].sira;
        }
        this.sonEsitleme = Date.now();
        this.cevrimici = true;
        if (this.hata && !this.bekleyen.length) this.hata = null;
      } catch (e) {
        this.cevrimici = false;
        this.hata = e.name === 'KodHatasi' ? e.message : 'Sunucuya ulaşılamadı (' + (e.detay || e.message) + '). Son indirilen kayıtlar gösteriliyor.';
      }
      if (this.bekleyen.length) await this.gonder();
      if (yeni.length) this.yenidenHesapla();
      // Bu bilgisayarın kendi yazdıkları da sunucuda görüldüğünde (sıra ilerler) kopyaya girsin.
      if (yeni.length || this.sonSira !== oncekiSira) {
        this.onbellek.yaz({ sonSira: this.sonSira, olaylar: this.sirali }).catch(() => {});
      }
      this.bildir(yeni.length ? { yeni } : {});
      return yeni;
    }

    async varlikYaz(ekstra = {}) {
      try {
        await istek(this.kod, 'kisiler?on_conflict=cihaz', {
          method: 'POST', govde: [{ cihaz: this.cihaz, ad: this.kullanici, t: Date.now(), ...ekstra }],
          prefer: 'resolution=merge-duplicates,return=minimal',
        });
      } catch { /* çevrimiçi göstergesi kritik değil */ }
    }
    async varlikOku() {
      try { this.kisiler = await istek(this.kod, 'kisiler?select=cihaz,ad,t'); } catch { /* yoksay */ }
      return this.kisiler;
    }

    async ekYaz(dosya) {
      if (dosya.size > EK_SINIRI) throw new Error(`Dosya çok büyük (${Math.round(dosya.size / 1048576)} MB). En fazla 8 MB yüklenebilir.`);
      const uzanti = (dosya.name.match(/\.[a-z0-9]{1,5}$/i) || [''])[0].toLowerCase();
      const ad = `${NT.c.uid(12)}${uzanti}`;
      const bilgi = { dosya: ad, ad: dosya.name, tur: dosya.type || '', boyut: dosya.size };
      await istek(this.kod, 'ekler', { method: 'POST', govde: { ...bilgi, veri: await base64(dosya) }, prefer: 'return=minimal', sure: 120000 });
      this.ekOnbellek.set(ad, dosya);
      return bilgi;
    }
    async ekOku(ad) {
      if (this.ekOnbellek.has(ad)) return this.ekOnbellek.get(ad);
      const [r] = await istek(this.kod, `ekler?dosya=eq.${encodeURIComponent(ad)}&select=ad,tur,veri`, { sure: 120000 });
      if (!r) throw hataYap('Ek dosya sunucuda bulunamadı.', 'NotFoundError');
      const ikili = atob(r.veri);
      const bayt = new Uint8Array(ikili.length);
      for (let i = 0; i < ikili.length; i++) bayt[i] = ikili.charCodeAt(i);
      const f = new File([bayt], r.ad || ad, { type: r.tur || '' });
      this.ekOnbellek.set(ad, f);
      return f;
    }
  }

  NT.BulutDepo = BulutDepo;
  NT.bulut = { kodDogrula, SUNUCU };
})();
