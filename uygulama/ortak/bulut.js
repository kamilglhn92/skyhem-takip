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

  /* ---------------- Kişisel hesap oturumu (Supabase Auth; context/kararlar.md 2026-11-16) ----------------
     Kişi adını soyadını ve şifresini yazar; "Kamil Gülhan" → kullanıcı adı "kamil.gulhan" (küçük harf, Türkçe harfsiz).
     Hesaplar e-postasızdır: arka planda iç adres kullanılır, hiçbir yere posta gitmez. Hesabı yalnız sunucu işlevi açar.
     Oturum bu tarayıcıda saklanır (nt.oturum) ve bütün sayfalarca paylaşılır; erişim belirteci süresi dolmadan yenilenir. */
  const IC_ALAN = 'hesap.skyhem.invalid';
  const OTURUM = 'nt.oturum';
  const HARF = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
  function kullaniciAdi(adSoyad) {
    return String(adSoyad || '').toLocaleLowerCase('tr-TR').replace(/[çğıiöşüâîû]/g, (h) => HARF[h])
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.\s-]/g, '').trim().split(/[\s.]+/).filter(Boolean).join('.');
  }
  const oturumOku = () => { try { return JSON.parse(localStorage.getItem(OTURUM) || 'null'); } catch { return null; } };
  const oturumYaz = (o) => { try { o ? localStorage.setItem(OTURUM, JSON.stringify(o)) : localStorage.removeItem(OTURUM); } catch { /* yoksay */ } };
  function oturumYap(j) {
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: j.user };
  }
  async function authIstek(yol, { method = 'POST', govde, belirtec } = {}) {
    let r;
    try {
      r = await fetch(`${SUNUCU}/auth/v1/${yol}`, {
        method,
        headers: { apikey: ANAHTAR, 'Content-Type': 'application/json', ...(belirtec ? { Authorization: 'Bearer ' + belirtec } : {}) },
        body: govde !== undefined ? JSON.stringify(govde) : undefined,
        cache: 'no-store',
      });
    } catch (e) {
      throw hataYap('Sunucuya ulaşılamadı. İnternet bağlantısını kontrol edin.', 'BaglantiYok', e.message);
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw hataYap(j.msg || j.error_description || j.message || `Sunucu hatası (${r.status}).`, r.status === 400 || r.status === 401 || r.status === 403 ? 'OturumHatasi' : 'SunucuHatasi', j.error_code || j.error);
    return j;
  }
  let yenileniyor = null;
  async function yenile(eski) {
    const kilitli = async () => {
      const simdiki = oturumOku(); // başka sekme yenilemiş olabilir
      if (simdiki && simdiki.refresh_token !== eski.refresh_token && simdiki.expires_at - Date.now() / 1000 > 60) return simdiki;
      try {
        const o = oturumYap(await authIstek('token?grant_type=refresh_token', { govde: { refresh_token: (simdiki || eski).refresh_token } }));
        oturumYaz(o);
        return o;
      } catch (e) {
        if (e.name === 'OturumHatasi') oturumYaz(null); // oturum geçersiz: yeniden giriş istenir
        throw e;
      }
    };
    return navigator.locks ? navigator.locks.request('nt-oturum-yenile', kilitli) : kilitli();
  }
  const oturum = {
    kullaniciAdi,
    var: () => !!oturumOku(),
    /* Hesap bilgisi: { ad, rol: personel|yonetici, mimar, onay, kullanici, sifreBelirlendi } */
    kim() {
      const o = oturumOku();
      if (!o || !o.user) return null;
      const a = o.user.app_metadata || {};
      return { ad: a.ad || '', rol: a.rol || '', mimar: !!a.mimar, onay: !!a.onay, kullanici: a.kullanici || '', sifreBelirlendi: !!(o.user.user_metadata || {}).sifre_belirlendi };
    },
    async girisYap(adSoyad, sifre) {
      const ka = kullaniciAdi(adSoyad);
      // Tek kelimelik ad da olabilir (Alex, sekreter kararı 2026-11-17); yanlış ad "Ad soyad veya şifre yanlış" döner.
      if (!ka) throw hataYap('Adınızı ve soyadınızı yazın.', 'OturumHatasi');
      try {
        const o = oturumYap(await authIstek('token?grant_type=password', { govde: { email: `${ka}@${IC_ALAN}`, password: sifre } }));
        oturumYaz(o);
        return oturum.kim();
      } catch (e) {
        if (e.name === 'OturumHatasi') throw hataYap('Ad soyad veya şifre yanlış.', 'OturumHatasi');
        throw e;
      }
    },
    /* Geçerli erişim belirteci; süresi bitmek üzereyse yenilenir. Oturum yoksa null. */
    async belirtec() {
      const o = oturumOku();
      if (!o) return null;
      if (o.expires_at - Date.now() / 1000 > 60) return o.access_token;
      if (!yenileniyor) yenileniyor = yenile(o).finally(() => { yenileniyor = null; });
      try { return (await yenileniyor).access_token; } catch (e) {
        if (e.name === 'BaglantiYok') return o.access_token; // internet yok: eski belirteçle dene, kayıtlar bekletilir
        return null;
      }
    },
    /* İlk girişte (ve istenince) kişinin kendi şifresini belirlemesi. */
    async sifreBelirle(yeni) {
      if (String(yeni).length < 8) throw hataYap('Şifre en az 8 karakter olmalı.', 'OturumHatasi');
      const t = await oturum.belirtec();
      if (!t) throw hataYap('Oturum kapanmış; yeniden giriş yapın.', 'OturumHatasi');
      let user;
      try {
        user = await authIstek('user', { method: 'PUT', belirtec: t, govde: { password: yeni, data: { sifre_belirlendi: true } } });
      } catch (e) {
        if (e.detay === 'same_password') throw hataYap('Yeni şifre geçici şifreden farklı olmalı.', 'OturumHatasi');
        if (e.detay === 'weak_password') throw hataYap('Bu şifre çok zayıf; daha uzun ve tahmin edilmesi zor bir şifre seçin.', 'OturumHatasi');
        throw e;
      }
      const o = oturumOku();
      if (o) oturumYaz({ ...o, user: user.id ? user : o.user });
      return oturum.kim();
    },
    async cikis() {
      const o = oturumOku();
      oturumYaz(null);
      if (o) authIstek('logout?scope=local', { belirtec: o.access_token }).catch(() => {});
    },
    /* Sunucu işlevi: hesapları kurma (erişim koduyla), listeleme ve geçici şifre verme (yetkili oturumla). */
    async islev(govde, { kod } = {}) {
      const t = await oturum.belirtec();
      let r;
      try {
        r = await fetch(`${SUNUCU}/functions/v1/hesaplar`, {
          method: 'POST',
          headers: { apikey: ANAHTAR, 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(kod ? { 'x-nt-kod': kod } : {}) },
          body: JSON.stringify(govde),
          cache: 'no-store',
        });
      } catch (e) {
        throw hataYap('Sunucuya ulaşılamadı. İnternet bağlantısını kontrol edin.', 'BaglantiYok', e.message);
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw hataYap(j.hata || `Sunucu hatası (${r.status}).`, 'SunucuHatasi');
      return j;
    },
  };
  NT.oturum = oturum;

  async function istek(kod, yol, { method = 'GET', govde, prefer, sure = 20000 } = {}) {
    const iptal = new AbortController();
    const z = setTimeout(() => iptal.abort(), sure);
    const belirtec = await oturum.belirtec();
    let r;
    try {
      r = await fetch(`${SUNUCU}/rest/v1/${yol}`, {
        method,
        headers: {
          apikey: ANAHTAR,
          ...(belirtec ? { Authorization: 'Bearer ' + belirtec } : {}),
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
        throw hataYap(oturum.var() ? 'Oturumunuz kabul edilmedi; yeniden giriş yapın.' : 'Erişim kodu kabul edilmedi.', 'KodHatasi', metin.slice(0, 200));
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

    // İş emri ve stok işlemleri sunucu doğrulamadan yerel günlüğe eklenmez.
    async numuneIslem(hazirla) {
      for (let deneme = 0; deneme < 3; deneme++) {
        await this.tara();
        if (!this.cevrimici || this.bekleyen.length) {
          throw new Error('İşlem için sunucu bağlantısı ve güncel stok gerekir.');
        }
        // Paralel tarama yeni satırları almış ama henüz birleştirmemiş olabilir.
        if (this.sirali.length !== this.olaylar.size) this.yenidenHesapla();
        const sira = this.sonSira;
        const olaylar = this.olayOlustur(hazirla(this));
        if (!olaylar.length) return olaylar;
        const yazildi = await istek(this.kod, 'rpc/numune_kosullu_kaydet', {
          method: 'POST', govde: { beklenen_sira: sira, hareketler: olaylar },
        });
        if (yazildi === true) {
          for (const e of olaylar) this.ekle(e);
          this.yenidenHesapla();
          this.bildir({ yerel: olaylar });
          return olaylar;
        }
      }
      await this.tara();
      throw new Error('Kayıtlar değişti. Güncel bilgileri kontrol edip tekrar deneyin.');
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
