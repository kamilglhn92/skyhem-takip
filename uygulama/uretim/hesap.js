/*
 * Üretim paneli — iş kuralları (arayüzsüz). Tasarım: context/uretim-paneli.md.
 *
 * Kağıt formlar (Kalite › 03_FORMLAR (FR) › FR_ÜRETİM) sahada doldurulur, taranır ve burada dijital kayda işlenir.
 * Her form sayfası bir şablondur: başlık alanları + tablolar. Tek bir genel işleme ekranı bütün şablonları çizer.
 *
 * Koleksiyon:
 *   kayit { no: UR-YYYY-NNNN, form: FORMLAR anahtarı, parti: 'Batch #21', tarih, alanlar: {}, tablolar: { id: [ { sütun: değer } ] },
 *           tarama: [ek], durum: 'taslak' | 'islendi' | 'kontrol', isleyen, kontrol: { kim, tarih }, not }
 * Partiler kayıtlardan derlenir.
 */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});
  const c = (tr, en) => (NT.dil ? NT.dil.t(tr, en) : tr);
  const m = (tr, en, ...a) => c(tr, en).replace(/\{(\d+)\}/g, (_, i) => String(a[i] ?? ''));
  const { sayi } = NT.c;

  /* Saat dizisi: bas ve bit dahil, adım dakika. Gece yarısını geçebilir. */
  function saatler(bas, bit, adim) {
    const dk = (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
    const l = [];
    let t = dk(bas);
    const son = dk(bit) < t ? dk(bit) + 1440 : dk(bit);
    for (; t <= son; t += adim) l.push(`${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
    return l;
  }

  /* Sütun türleri: saat, sayi (min/max uyarı sınırı), metin, secim (secenekler), tik (✓/✗). */
  const S = (id, ad, en, tur = 'sayi', ek = {}) => ({ id, ad, en, tur, ...ek });
  const FR035_SUTUN = [S('saat', 'Saat', 'Time', 'saat'), S('kazanT', 'Kazan °C', 'Boiler °C', 'sayi', { min: 0, max: 120 }), S('kazanP', 'Kazan bar', 'Boiler bar', 'sayi', { min: 0, max: 10 }),
    S('yagPGiris', 'K.yağ bar giriş', 'Oil bar in', 'sayi', { min: 0, max: 10 }), S('yagPCikis', 'K.yağ bar çıkış', 'Oil bar out', 'sayi', { min: 0, max: 10 }),
    S('yagTGiris', 'K.yağ °C giriş', 'Oil °C in', 'sayi', { min: 0, max: 300 }), S('yagTCikis', 'K.yağ °C çıkış', 'Oil °C out', 'sayi', { min: 0, max: 300 }),
    S('genlesme', 'Genleşme t. °C', 'Expansion °C', 'sayi', { min: 0, max: 120 }), S('baca', 'Baca °C', 'Flue °C', 'sayi', { min: 0, max: 400 }),
    S('icIso', 'İç isotank °C', 'Inner iso °C', 'sayi', { min: 0, max: 120 }), S('disIso', 'Dış isotank °C', 'Outer iso °C', 'sayi', { min: 0, max: 120 }), S('aciklama', 'Açıklama', 'Note', 'metin')];
  const PARTI = { id: 'parti', ad: 'Parti (Lot) no', en: 'Batch no', tur: 'parti', zorunlu: true };

  const FORMLAR = {
    'FR-011-1': {
      kod: 'FR-011', sayfa: '1/2', ad: 'Reaksiyon Takip', en: 'Reaction log', alt: 'Reaksiyon takibi', altEn: 'Reaction readings', ikon: 'dolum', tanima: [/REAKS/i, /FR[-\s]?[O0]?[O0]11\b/i], sayfaTanima: [/1\s*\/\s*2/],
      alanlar: [PARTI, { id: 'urun', ad: 'Ürün adı', en: 'Product', tur: 'metin' }, { id: 'recete', ad: 'Reçete no', en: 'Recipe no', tur: 'metin' },
        { id: 'tarih', ad: 'Üretim tarihi', en: 'Production date', tur: 'tarih', zorunlu: true }, { id: 'miktar', ad: 'Üretim miktarı (kg)', en: 'Quantity (kg)', tur: 'sayi' },
        { id: 'reaktor', ad: 'Reaktör', en: 'Reactor', tur: 'secim', secenekler: ['P1', 'P2', 'P3'] }, { id: 'calismaT', ad: 'Çalışma sıcaklığı °C', en: 'Working temp. °C', tur: 'sayi' },
        { id: 'aktarmaT', ad: 'Aktarma sıcaklığı °C', en: 'Transfer temp. °C', tur: 'sayi' }, { id: 'isotankT', ad: 'İsotanka aktarma °C', en: 'To isotank °C', tur: 'sayi' },
        { id: 'asit', ad: 'Asit', en: 'Acid value', tur: 'sayi' }, { id: 'viskozite', ad: 'Viskozite', en: 'Viscosity', tur: 'sayi' },
        { id: 'scada', ad: 'SCADA trend çıktısı alındı', en: 'SCADA trend printed', tur: 'secim', secenekler: ['Evet', 'Hayır'] }],
      tablolar: [
        { id: 'olcum', ad: 'Reaksiyon takip', en: 'Reaction readings', serbest: true,
          sutunlar: [S('saat', 'Saat', 'Time', 'saat'), S('reaktorT', 'Reaktör °C', 'Reactor °C', 'sayi', { min: 0, max: 260 }), S('yagT', 'K. yağ °C', 'Hot oil °C', 'sayi', { min: 0, max: 300 }),
            S('agirlik', 'R. ağırlık (kg)', 'R. weight (kg)', 'sayi', { min: 0, max: 20000 }), S('aciklama', 'Açıklama', 'Note', 'metin')] },
        { id: 'son', ad: 'Son ölçüm', en: 'Final test', satirlar: [{}], sutunlar: [S('asit', 'Asit', 'Acid', 'sayi'), S('viskozite', 'Viskozite', 'Viscosity', 'sayi'), S('sonuc', 'Sonuç', 'Result', 'metin')] },
      ],
      imzalar: ['Hazırlayan', 'Onay'],
    },
    'FR-011-2': {
      kod: 'FR-011', sayfa: '2/2', ad: 'Reaksiyon Takip · soğutma ve aktarma', en: 'Reaction log · cooling & transfer', alt: 'E2 soğutma, hammadde, aktarma', altEn: 'E2 cooling, raw materials, transfer', ikon: 'sevk', tanima: [/SO[ĞG]UTMA|E2 TANK/i], sayfaTanima: [/2\s*\/\s*2/],
      alanlar: [PARTI, { id: 'sevkIsotank', ad: 'Sevkiyat isotank no', en: 'Shipment isotank no', tur: 'metin' },
        { id: 'notGunduz', ad: 'Vardiya teslim notu · gündüz', en: 'Shift note · day', tur: 'uzun' }, { id: 'notGece', ad: 'Vardiya teslim notu · gece', en: 'Shift note · night', tur: 'uzun' }],
      tablolar: [
        { id: 'sogutma', ad: 'E2 tankı soğutma (2 saatte bir)', en: 'E2 tank cooling (every 2 h)', serbest: true,
          sutunlar: [S('saat', 'Saat', 'Time', 'saat'), S('e2T', 'E2 °C', 'E2 °C', 'sayi', { min: 0, max: 260 }), S('suT', 'Su °C', 'Water °C', 'sayi', { min: 0, max: 60 }), S('h4', 'H4 bar', 'H4 bar', 'sayi', { min: 0, max: 10 }), S('aciklama', 'Açıklama', 'Note', 'metin')] },
        { id: 'hammadde', ad: 'Hammadde', en: 'Raw materials', satirlar: [{ malzeme: 'CTO' }, { malzeme: 'Gliserin' }],
          sutunlar: [S('malzeme', 'Malzeme', 'Material', 'sabit'), S('miktar', 'Miktar (kg)', 'Qty (kg)', 'sayi'), S('isotank', 'İsotank no', 'Isotank no', 'metin'), S('aciklama', 'Açıklama', 'Note', 'metin')] },
        { id: 'aktarma', ad: 'Aktarma', en: 'Transfers', satirlar: [{ operasyon: 'İç isotanktan reaktöre' }, { operasyon: 'Gliserin tankından reaktöre' }, { operasyon: 'Reaktörden E2 tankına' }, { operasyon: 'E2 tankından sevkiyata' }],
          sutunlar: [S('operasyon', 'Operasyon', 'Operation', 'sabit'), S('bas', 'Başlangıç', 'Start', 'saat'), S('bit', 'Bitiş', 'End', 'saat'), S('aciklama', 'Açıklama', 'Note', 'metin')] },
        { id: 'ekip', ad: 'Operatör ve teknik bakım', en: 'Operators and maintenance', serbest: true,
          sutunlar: [S('ad', 'Ad soyad', 'Name', 'metin'), S('gorev', 'Görev', 'Role', 'secim', { secenekler: ['Operatör', 'Teknik bakım'] }), S('vardiya', 'Vardiya', 'Shift', 'secim', { secenekler: ['Gündüz', 'Gece'] })] },
      ],
      imzalar: ['Hazırlayan', 'Onay'],
    },
    'FR-035-G': {
      kod: 'FR-035', sayfa: '1/2', ad: 'Proses Takip · gündüz', en: 'Process log · day', alt: 'Kazan, kızgın yağ, baca (08:30–20:00)', altEn: 'Boiler, hot oil, flue (08:30–20:00)', ikon: 'simsek', tanima: [/PROSES/i, /FR[-\s]?[O0]?[O0](35|29)\b/i], sayfaTanima: [/G[ÜU]ND[ÜU]Z|1\s*\/\s*2/i],
      alanlar: [PARTI, { id: 'tarih', ad: 'Tarih', en: 'Date', tur: 'tarih', zorunlu: true }, { id: 'urun', ad: 'Ürün', en: 'Product', tur: 'metin' }],
      tablolar: [{ id: 'olcum', ad: 'Gündüz ölçümleri', en: 'Day readings', satirlar: saatler('08:30', '20:00', 30).map((saat) => ({ saat })), sutunlar: FR035_SUTUN }],
      imzalar: ['Kontrol', 'Onay'],
    },
    'FR-035-N': {
      kod: 'FR-035', sayfa: '2/2', ad: 'Proses Takip · gece', en: 'Process log · night', alt: 'Kazan, kızgın yağ, baca (20:30–08:00)', altEn: 'Boiler, hot oil, flue (20:30–08:00)', ikon: 'ay', tanima: [/PROSES/i, /FR[-\s]?[O0]?[O0](35|29)\b/i], sayfaTanima: [/GECE|2\s*\/\s*2/i],
      alanlar: [PARTI, { id: 'tarih', ad: 'Tarih', en: 'Date', tur: 'tarih', zorunlu: true }, { id: 'urun', ad: 'Ürün', en: 'Product', tur: 'metin' }],
      tablolar: [{ id: 'olcum', ad: 'Gece ölçümleri', en: 'Night readings', satirlar: saatler('20:30', '08:00', 30).map((saat) => ({ saat })), sutunlar: FR035_SUTUN }],
      imzalar: ['Kontrol', 'Onay'],
    },
    'FR-005': {
      kod: 'FR-005', sayfa: '1/1', ad: 'Hammadde Kontrol', en: 'Raw material check', alt: 'İsotank kabulü, COA karşılaştırma', altEn: 'Isotank acceptance, COA check', ikon: 'alim', tanima: [/HAMMADDE KONTROL/i, /FR[-\s]?[O0]?[O0]05\b/i], hammadde: true,
      alanlar: [{ id: 'tarih', ad: 'Tarih', en: 'Date', tur: 'tarih', zorunlu: true }, { id: 'tedarikci', ad: 'Tedarikçi', en: 'Supplier', tur: 'metin' }, { id: 'coa', ad: 'COA no', en: 'COA no', tur: 'metin' },
        { id: 'isotank', ad: 'İsotank kimliği', en: 'Isotank ID', tur: 'metin', zorunlu: true }, { id: 'muhur', ad: 'Mühür no', en: 'Seal no', tur: 'metin' }, { id: 'lot', ad: 'LOT no', en: 'LOT no', tur: 'metin' },
        { id: 'plaka', ad: 'Araç plakası', en: 'Vehicle plate', tur: 'metin' }, { id: 'vardiya', ad: 'Vardiya', en: 'Shift', tur: 'secim', secenekler: ['Gündüz', 'Gece'] },
        { id: 'karar', ad: 'Karar', en: 'Decision', tur: 'secim', secenekler: ['Kabul', 'Şartlı kabul', 'Red'] }, { id: 'not', ad: 'Açıklama / bulgular', en: 'Notes / findings', tur: 'uzun' }],
      tablolar: [
        { id: 'gorsel', ad: 'Görsel ve fiziksel kontrol', en: 'Visual and physical check', satirlar: ['Renk', 'Yabancı madde / katı partikül', 'Su varlığı', 'İsotank temizliği', 'Akışkanlık'].map((parametre) => ({ parametre })),
          sutunlar: [S('parametre', 'Parametre', 'Parameter', 'sabit'), S('sonuc', 'Sonuç', 'Result', 'tik'), S('aciklama', 'Açıklama', 'Note', 'metin')] },
        { id: 'coa', ad: 'Analiz sertifikası karşılaştırma', en: 'Certificate of analysis', limitli: true,
          satirlar: [['Yoğunluk 15 °C', 'kg/m³', 950, 990], ['Asit sayısı', 'mg KOH/g', 95, 115], ['Su içeriği', '%', null, 2], ['Viskozite 40 °C', 'mm²/s', 85, 125],
            ['Sabunlaşmayan madde', '%', null, 30], ['Kükürt içeriği', '%', null, 0.5], ['PAH · DMSO ekstraktı *', '%', null, 3], ['PAH · Benzo[a]piren *', 'mg/kg', null, 1]]
            .map(([parametre, birim, min, max]) => ({ parametre, birim, min, max })),
          sutunlar: [S('parametre', 'Parametre', 'Parameter', 'sabit'), S('birim', 'Birim', 'Unit', 'sabit'), S('deger', 'Sertifika değeri', 'Certificate value', 'sayi', { satirLimiti: true })] },
      ],
      imzalar: ['Kontrol', 'Onay'],
    },
    'FR-032': {
      kod: 'FR-032', sayfa: '1/1', ad: 'Vardiya Devir-Teslim', en: 'Shift handover', alt: 'Reaktörler, kritik ekipman, açık arızalar', altEn: 'Reactors, critical equipment, open faults', ikon: 'saat', tanima: [/DEV[İI]R[-\s]*TESL[İI]M/i, /FR[-\s]?[O0]?[O0]32\b/i], vardiya: true,
      alanlar: [{ id: 'tarih', ad: 'Tarih', en: 'Date', tur: 'tarih', zorunlu: true }, { id: 'vardiya', ad: 'Vardiya', en: 'Shift', tur: 'secim', secenekler: ['Gündüz → Gece', 'Gece → Gündüz'] },
        { id: 'devreden', ad: 'Devreden operatör', en: 'Outgoing operator', tur: 'metin' }, { id: 'devralan', ad: 'Devralan operatör', en: 'Incoming operator', tur: 'metin' },
        { id: 'notGunduz', ad: 'Sonraki vardiyaya not · gündüz', en: 'Note to next shift · day', tur: 'uzun' }, { id: 'notGece', ad: 'Sonraki vardiyaya not · gece', en: 'Note to next shift · night', tur: 'uzun' }],
      tablolar: [
        { id: 'reaktor', ad: 'Batch / proses durumu', en: 'Batch / process status', satirlar: [{ reaktor: 'R-1' }, { reaktor: 'R-2' }, { reaktor: 'R-3' }],
          sutunlar: [S('reaktor', 'Reaktör', 'Reactor', 'sabit'), S('parti', 'Batch no', 'Batch no', 'metin'), S('asama', 'Aşama', 'Stage', 'metin'), S('sicaklik', 'Sıcaklık °C', 'Temp. °C', 'sayi', { min: 0, max: 260 }), S('not', 'Not', 'Note', 'metin')] },
        { id: 'ekipman', ad: 'Kritik ekipman durumu', en: 'Critical equipment', satirlar: ['Kızgın yağ kazanı', 'Chiller', 'Kompresör', 'Sıcak su kazanı', 'Azot jeneratörü', 'H1 pompa', 'H2 pompa (2.1–2.2)', 'H3 pompa', 'H4 pompa', 'H5 pompa', 'Hava kurutucu'].map((ekipman) => ({ ekipman })),
          sutunlar: [S('ekipman', 'Ekipman', 'Equipment', 'sabit'), S('durum', 'Durum', 'Status', 'secim', { secenekler: ['N', 'A', 'K'], anormal: 'A' }), S('aciklama', 'Açıklama / anormallik', 'Note / abnormality', 'metin')] },
        { id: 'ariza', ad: 'Açık arızalar / devam eden bakımlar', en: 'Open faults / ongoing maintenance', serbest: true,
          sutunlar: [S('tanim', 'Arıza / bakım', 'Fault / maintenance', 'metin'), S('ekipman', 'Ekipman', 'Equipment', 'metin'), S('baslangic', 'Başlangıç', 'Start', 'metin'), S('durum', 'Durum / detay', 'Status / detail', 'metin')] },
      ],
      imzalar: ['Devreden', 'Devralan'],
    },
  };
  const formAl = (id) => FORMLAR[id] || null;
  const formAdi = (id) => { const f = formAl(id); return f ? `${f.kod} · ${c(f.ad, f.en)}` : id; };

  /* Bir tablonun satırları: sabit satırlı şablonda kayıttaki değerler şablona yerleşir; serbestte kayıttakiler. */
  function satirlar(kayit, tablo) {
    const kayitli = (kayit.tablolar && kayit.tablolar[tablo.id]) || [];
    if (tablo.serbest) return kayitli;
    return tablo.satirlar.map((s, i) => ({ ...s, ...(kayitli[i] || {}) }));
  }
  const dolu = (v) => v != null && String(v).trim() !== '';
  /* Değerin uyarı durumu: '' | 'disari' (sınır dışı) | 'gecersiz' (sayı değil). */
  function degerDurumu(sutun, v, satir) {
    if (!dolu(v) || sutun.tur !== 'sayi') return '';
    const n = sayi(v);
    if (!/^-?\d+([.,]\d+)?$/.test(String(v).trim())) return 'gecersiz';
    const min = sutun.satirLimiti ? satir.min : sutun.min;
    const max = sutun.satirLimiti ? satir.max : sutun.max;
    if ((min != null && n < min) || (max != null && n > max)) return 'disari';
    return '';
  }

  /* Kaydın denetimi: zorunlu alanlar, sınır dışı değerler, boş tablo. */
  function denetle(kayit) {
    const f = formAl(kayit.form);
    if (!f) return { eksik: [c('Form türü seçilmedi', 'Form type not selected')], disari: [], dolu: 0 };
    const eksik = f.alanlar.filter((a) => a.zorunlu && !dolu((kayit.alanlar || {})[a.id])).map((a) => c(a.ad, a.en));
    const disari = [];
    let doluHucre = 0;
    for (const t of f.tablolar) {
      satirlar(kayit, t).forEach((s, i) => {
        for (const su of t.sutunlar) {
          if (su.tur === 'sabit' || su.tur === 'saat') continue;
          if (dolu(s[su.id])) doluHucre++;
          const d = degerDurumu(su, s[su.id], s);
          if (d) disari.push({ tablo: t.id, satir: i, sutun: su.id, deger: s[su.id], durum: d, ad: `${c(t.ad, t.en)} · ${s.saat || s.parametre || s.ekipman || s.reaktor || i + 1} · ${c(su.ad, su.en)}` });
          if (su.anormal && s[su.id] === su.anormal) disari.push({ tablo: t.id, satir: i, sutun: su.id, deger: s[su.id], durum: 'anormal', ad: `${s.ekipman}: ${c('anormal', 'abnormal')}` });
        }
      });
    }
    if (!doluHucre) eksik.push(c('Tablolarda hiç değer yok', 'No values in the tables'));
    return { eksik, disari, dolu: doluHucre };
  }

  /* FR-005 karar önerisi (karar insanındır): sınır dışı COA değeri veya ✗ görsel kontrol varsa red önerilir. */
  function hammaddeOneri(kayit) {
    const f = FORMLAR['FR-005'];
    const coa = satirlar(kayit, f.tablolar[1]);
    const gorsel = satirlar(kayit, f.tablolar[0]);
    const disari = coa.filter((s) => degerDurumu(f.tablolar[1].sutunlar[2], s.deger, s) === 'disari').map((s) => s.parametre);
    const red = gorsel.filter((s) => s.sonuc === '✗').map((s) => s.parametre);
    const eksik = coa.filter((s, i) => i < 6 && !dolu(s.deger)).map((s) => s.parametre);
    if (disari.length || red.length) return { karar: 'Red', neden: [...disari, ...red] };
    if (eksik.length) return { karar: 'Şartlı kabul', neden: eksik.map((x) => x + ' ' + c('girilmedi', 'missing')) };
    return { karar: 'Kabul', neden: [] };
  }

  const kayitlar = (d) => d.kayitlar('kayit').filter((k) => k.form || k.durum === 'taslak').sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '') || b._olusturma - a._olusturma);
  const bekleyenTaramalar = (d) => kayitlar(d).filter((k) => k.durum === 'taslak');
  const kontrolBekleyen = (d) => kayitlar(d).filter((k) => k.durum === 'islendi');
  const partiNo = (p) => { const m = /#\s*(\d+)/.exec(p || ''); return m ? +m[1] : 0; };
  const partiAdi = (v) => { const s = String(v || '').trim(); if (!s) return ''; const m = /^#?\s*(\d+)$/.exec(s) || /batch\s*#?\s*(\d+)/i.exec(s); return m ? `Batch #${m[1]}` : s; };

  /* Partiler: FR-011 / FR-035 kayıtlarından derlenir. Beklenen sayfalar: FR-011 1/2, FR-011 2/2, en az bir FR-035. */
  const BEKLENEN = ['FR-011-1', 'FR-011-2', 'FR-035'];
  function partiler(d) {
    const m = new Map();
    for (const k of kayitlar(d)) {
      const ad = partiAdi(k.parti || k.alanlar?.parti);
      if (!ad) continue;
      if (!m.has(ad)) m.set(ad, { ad, kayitlar: [] });
      m.get(ad).kayitlar.push(k);
    }
    return [...m.values()].map((p) => {
      const bas = p.kayitlar.find((k) => k.form === 'FR-011-1');
      const a = bas?.alanlar || {};
      const formlar = new Set(p.kayitlar.map((k) => (k.form || '').startsWith('FR-035') ? 'FR-035' : k.form));
      const tarihler = p.kayitlar.map((k) => k.alanlar?.tarih || k.tarih).filter(Boolean).sort();
      return { ...p, urun: a.urun || p.kayitlar.find((k) => k.alanlar?.urun)?.alanlar.urun || '', reaktor: a.reaktor || '', miktar: a.miktar, asit: a.asit, viskozite: a.viskozite,
        bas: tarihler[0] || '', bit: tarihler[tarihler.length - 1] || '', eksikFormlar: BEKLENEN.filter((x) => !formlar.has(x)),
        taslak: p.kayitlar.filter((k) => k.durum === 'taslak').length, kontrolsuz: p.kayitlar.filter((k) => k.durum === 'islendi').length,
        uyari: p.kayitlar.reduce((t, k) => t + (k.durum === 'taslak' ? 0 : denetle(k).disari.length), 0) };
    }).sort((a, b) => partiNo(b.ad) - partiNo(a.ad) || b.bas.localeCompare(a.bas));
  }

  /* Grafik serisi: saat sütunundan dakika ekseni (gece yarısını geçince +24 saat). */
  function seri(satirListesi, alan) {
    let onceki = -1, ek = 0;
    const l = [];
    for (const s of satirListesi) {
      if (!dolu(s.saat) || !dolu(s[alan]) || !/^\d{1,2}[:.]\d{2}$/.test(String(s.saat).trim())) continue;
      const [h, m] = String(s.saat).trim().split(/[:.]/).map(Number);
      let dk = h * 60 + m + ek;
      if (onceki >= 0 && dk < onceki - 360) { ek += 1440; dk += 1440; }
      onceki = dk;
      l.push({ x: dk, y: sayi(s[alan]), saat: s.saat });
    }
    return l;
  }

  /* Kayıt durumları */
  const DURUM = {
    taslak: { ad: 'İşlenmeyi bekliyor', en: 'Awaiting entry', rozet: 'kritik', ikon: 'saat' },
    islendi: { ad: 'Kontrol bekliyor', en: 'Awaiting check', rozet: 'bilgi', ikon: 'kalem' },
    kontrol: { ad: 'Kontrol edildi', en: 'Checked', rozet: 'iyi', ikon: 'daire_tik' },
  };

  const genelDikkat = (d) => {
    const l = [];
    const t = bekleyenTaramalar(d).length;
    const k = kontrolBekleyen(d).length;
    if (t) l.push({ metin: m('{0} taranmış form işlenmeyi bekliyor', '{0} scanned forms awaiting entry', t), sekme: 'isle' });
    if (k) l.push({ metin: m('{0} üretim kaydı kontrol bekliyor', '{0} production records awaiting check', k), sekme: 'isle' });
    return l;
  };

  NT.uretim = { c, m, FORMLAR, formAl, formAdi, saatler, satirlar, dolu, degerDurumu, denetle, hammaddeOneri, kayitlar, bekleyenTaramalar, kontrolBekleyen, partiler, partiAdi, partiNo, seri, DURUM, BEKLENEN, dikkat: genelDikkat };
})(typeof window !== 'undefined' ? window : globalThis);
