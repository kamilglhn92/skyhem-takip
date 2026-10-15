/* Sunum/demo modu: ?demo ile açılır. Hiçbir dosyaya yazmaz; veriler bellekte, sayfa kapanınca silinir.
   İçinde gerçekçi bir senaryo kurulur: örnek sayım + birkaç kullanıcının sevkiyat ve alımları. */
(function () {
  'use strict';
  const NT = window.NT;
  const H = NT.hesap;
  const { uid } = NT.c;

  /* --- Bellek içi klasör (File System Access API'nin küçük bir taklidi) --- */
  class BellekDosya {
    constructor(ad) { this.kind = 'file'; this.name = ad; this.veri = new Blob([]); this.zaman = Date.now(); }
    async getFile() { return new File([this.veri], this.name, { lastModified: this.zaman }); }
    async createWritable({ keepExistingData = false } = {}) {
      let parcalar = keepExistingData ? [this.veri] : [];
      return {
        seek: async () => {},
        write: async (v) => { parcalar.push(v); },
        close: async () => { this.veri = new Blob(parcalar); this.zaman = Date.now(); },
      };
    }
  }
  class BellekDizin {
    constructor(ad) { this.kind = 'directory'; this.name = ad; this.c = new Map(); }
    async getDirectoryHandle(ad, { create } = {}) { return this.al(ad, create, () => new BellekDizin(ad)); }
    async getFileHandle(ad, { create } = {}) { return this.al(ad, create, () => new BellekDosya(ad)); }
    al(ad, create, yeni) {
      if (!this.c.has(ad)) {
        if (!create) throw Object.assign(new Error('Bulunamadı: ' + ad), { name: 'NotFoundError' });
        this.c.set(ad, yeni());
      }
      return this.c.get(ad);
    }
    async *entries() { yield* this.c.entries(); }
  }

  const FIRMALAR = [
    ['Anadolu Yol Yapı A.Ş.', 'Selin Aydın (Ar-Ge Müdürü)', 'OSB 3. Cad. No:14, Konya'],
    ['Marmara Asfalt Ltd.', 'Burak Şen (Kalite)', 'Tuzla Kimya OSB, İstanbul'],
    ['Ege Polimer San.', 'Deniz Kara', 'Kemalpaşa OSB, İzmir'],
    ['Trakya Bitüm A.Ş.', 'Onur Çelik (Satınalma)', 'Çorlu, Tekirdağ'],
    ['Karadeniz Altyapı', 'Elif Yurt', 'Samsun'],
  ];

  async function senaryoKur(depo, kullanici) {
    const kim = (ad) => { depo.kullanici = ad; };
    const olaylar = [];
    const kaydet = async (ad, ops, tarih) => {
      kim(ad);
      const evs = await depo.kaydet(ops);
      if (tarih) olaylar.push(...evs.map((e) => [e, tarih]));
    };

    kim('Ahmet Kaya');
    await H.eskiVeriyiAktar(depo, NT.ORNEK);
    for (const e of depo.olaylar.values()) if (e.v?.tarih) olaylar.push([e, e.v.tarih]);

    // Geçmiş aylardan dolum + sevkiyat, grafik ve akış dolu görünsün.
    const eski = [['2026-04', 'Batch #4'], ['2026-05', 'Batch #5'], ['2026-06', 'Batch #6'], ['2026-07', 'Batch #7'], ['2026-08', 'Batch #7']];
    let i = 0;
    for (const [ay, parti] of eski) {
      const tarih = `${ay}-0${3 + (i % 5)}`;
      const adet = 6 + (i * 3) % 7;
      await kaydet('Ahmet Kaya', [{ c: 'dolum', k: uid(), v: { no: H.yeniNo(depo, 'dolum', tarih), tarih, urun: 'Ecosky 3103', parti, ambalaj: '1L', adet, hazirlayan: 'Ahmet Kaya' } }], tarih);
      const [firma, yetkili, adres] = FIRMALAR[i % FIRMALAR.length];
      const sTarih = `${ay}-${10 + i * 3}`;
      await kaydet('Zeynep Arslan', [{ c: 'sevk', k: uid(), v: {
        no: H.yeniNo(depo, 'sevk', sTarih), tarih: sTarih, firma, yetkili, adres, sekil: 'Kargo', kargoFirma: 'Yurtiçi Kargo', takipNo: `YK${40251000 + i * 137}`,
        sebep: ['Saha denemesi', 'Laboratuvar karşılaştırma', 'Şartname onayı', 'Yeni proje teklifi', 'Tekrar sipariş öncesi kontrol'][i], durum: 'Gönderildi',
        kalemler: [{ urun: 'Ecosky 3103', parti, ambalaj: '1L', adet: adet - 1 - (i % 2) }], notlar: '', ekler: [],
      } }], sTarih);
      i++;
    }
    await kaydet('Mehmet Yılmaz', [{ c: 'alim', k: uid(), v: { no: H.yeniNo(depo, 'alim', '2026-09-22'), tarih: '2026-09-22', ambalaj: '5L', adet: 20, tedarikci: 'Örnek Ambalaj Ltd.', faturaNo: 'A-2026-3318', birimFiyat: 42, notlar: 'Kollu bidon', ekler: [] } }], '2026-09-22');

    // Bu ay: farklı aşamalarda sevkiyatlar
    const bekleyenler = [
      ['2026-09-26', 0, 'Gönderildi', [{ urun: 'Ecosky 3103', parti: 'Batch #8', ambalaj: '1L', adet: 3 }, { urun: 'Ecosky 3103', parti: 'Batch #8', ambalaj: '5L', adet: 1 }], 'YK40259911'],
      ['2026-09-27', 1, 'Etiket Bekliyor', [{ urun: 'Ecosky 3103', parti: 'Batch #21', ambalaj: '1L', adet: 2 }], ''],
      ['2026-09-28', 2, 'Beklemede', [{ urun: 'Ecophalt', parti: '', ambalaj: '1L', adet: 2 }], ''],
      ['2026-09-18', 3, 'Karar Aşaması', [{ urun: 'Talloil pich', parti: '', ambalaj: '5L', adet: 1 }], ''],
    ];
    for (const [tarih, f, durum, kalemler, takipNo] of bekleyenler) {
      const [firma, yetkili, adres] = FIRMALAR[f];
      await kaydet('Zeynep Arslan', [{ c: 'sevk', k: uid(), v: {
        no: H.yeniNo(depo, 'sevk', tarih), tarih, firma, yetkili, adres, sekil: 'Kargo', kargoFirma: takipNo ? 'Yurtiçi Kargo' : '', takipNo,
        sebep: 'Müşteri numune talebi', durum, kalemler, notlar: '', ekler: [],
      } }], tarih);
    }

    // Olay zamanlarını belge tarihlerine yay: akış "3 gün önce" gibi gerçekçi görünsün.
    const bugun = NT.c.bugun();
    // Kurulumda yazılan ürün tanımları "az önce" görünmesin.
    for (const e of depo.olaylar.values()) if (e.c === 'urun') { e.t = Date.parse('2026-01-05T09:00:00'); e.u = 'Ahmet Kaya'; }
    for (const [e, tarih] of olaylar) {
      const t = Date.parse(tarih + 'T09:00:00') + ((e.id.charCodeAt(0) * 7919) % (8 * 3600e3));
      e.t = tarih >= bugun ? Math.min(t, Date.now() - 60e3) : t;
    }
    depo.yenidenHesapla();
    depo.kullanici = kullanici;
    depo.kisiler = [
      { cihaz: 'demo-z', ad: 'Zeynep Arslan', t: Date.now() },
      { cihaz: 'demo-m', ad: 'Mehmet Yılmaz', t: Date.now() },
      { cihaz: NT.baglanti.cihaz, ad: kullanici, t: Date.now() },
    ];
  }

  NT.demo = {
    aktif: new URLSearchParams(location.search).has('demo'),
    async kur(baglanti) {
      // Sunumda kayıtlı kullanıcı adı yerine sunulan kişinin adı görünsün (kalıcı olarak kaydedilmez).
      baglanti.kullanici = new URLSearchParams(location.search).get('kullanici') || 'Farukcan Bey';
      // Senaryo tamamen kurulmadan arayüz açılmasın; yoksa yarım raf görünebilir.
      const depo = new NT.Depo({ dizin: new BellekDizin('Demo (örnek veri)'), cihaz: baglanti.cihaz, kullanici: baglanti.kullanici });
      await baglanti.ac(depo, 'demo', { hazirYap: false });
      await senaryoKur(baglanti.depo, baglanti.kullanici);
      baglanti.durdur();
      baglanti.durumYap('hazir');
    },
  };
})();
