/*
 * Klips Takip — iş kuralları (arayüzsüz; karşılama ekranı da özet için yükler).
 *
 * Koleksiyonlar:
 *   ambalaj  { tur, numara (serbest metin), urun, parti, sevk (Satış kayıt id), sevkNo, firma, tarih, takan, notlar, ekler }
 *   klips    { numara ('00013'), ambalaj (id; fire'da boş), durum: takili | degisti | fire | verildi (başka firmaya gönderildi; neden alanında kime), tarih, takan, neden,
 *              yerine (yerine takılan no), eskisi (yerine takıldığı no), cikisTarihi, notlar }
 *   aralik   { bas ('00001'), bit ('00999'), tarih, kisi, notlar }   — elimizdeki klips numaraları
 *   ayar     'genel' { uyariSiniri }
 *
 * Stok saklanmaz, kayıtlardan hesaplanır: aralıkta olup kaydı olmayan numara boştadır.
 * Anahtarlar numara değil rastgeledir: iki kişi aynı numarayı girerse biri silinmesin, çakışma olarak görünsün.
 */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});
  /* Arayüz dili (Node testlerinde dil modülü yoktur; Türkçe kalır). */
  const M_ = (k, ...a) => (NT.dil ? NT.dil.m(k, ...a) : k.replace(/\{(\d+)\}/g, (_, i) => String(a[i] ?? '')));
  const T_ = (k) => (NT.dil ? NT.dil.t(k) : k);
  const { trSirala } = NT.c;

  const TURLER = ['IBC', 'Varil', 'İsotank', 'Konteyner', 'Tanker', 'Diğer'];
  const DURUMLAR = { takili: 'Takılı', degisti: 'Değiştirildi', fire: 'Fire', verildi: 'Verildi' };
  /* "Takan" listesi: yalnız Yoklama personeli; beyaz yakalılar eklenmez (sekreter, 2026-11-05). "Başka kişi" ile yenisi yazılabilir. */
  const PERSONEL = ['Nurettin Durak', 'Kamil Gülhan', 'Onur Özdemir', 'Yusuf Yılmaz', 'Erkan Eser'];
  const VARSAYILAN = { uyariSiniri: 100 };
  const EN_BUYUK = 99999;
  const ARALIK_SINIRI = 20000;

  /* '13', 'SN:00013' → '00013'; geçersizse boş metin. */
  function klipsNo(x) {
    const t = String(x ?? '').replace(/\D/g, '');
    const n = Number(t);
    if (!t || !n || n > EN_BUYUK) return '';
    return String(n).padStart(5, '0');
  }
  /* Ambalaj numarası serbest metindir; sondaki sayı 5 haneye tamamlanır: 'IBC 186' → 'IBC 00186', türle birlikte '186' → 'IBC 00186'. */
  function ambalajNo(metin, tur) {
    const t = String(metin ?? '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (/^\d+$/.test(t)) {
      const no = t.padStart(5, '0');
      return tur && tur !== 'Diğer' ? `${tur} ${no}` : no;
    }
    const m = /^(.*\D)(\d{1,4})$/.exec(t);
    return m ? m[1] + m[2].padStart(5, '0') : t;
  }
  /* Yeni satırda önerilir: 'IBC 00186' → 'IBC 00187'. Sayıyla bitmiyorsa boş. */
  function sonrakiAmbalajNo(no) {
    const m = /^(.*?)(\d+)$/.exec(String(no ?? '').trim());
    if (!m) return '';
    return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, '0');
  }
  /* '1-7, 9' → { liste: ['00001', …, '00007', '00009'], hata } */
  function numaraListesi(metin) {
    const liste = [];
    for (const parca of String(metin ?? '').split(/[,;\s]+/).filter(Boolean)) {
      const m = /^(\D*\d+)[-–](\D*\d+)$/.exec(parca);
      if (m) {
        const a = klipsNo(m[1]);
        const c = klipsNo(m[2]);
        if (!a || !c || +a > +c) return { liste: [], hata: M_('“{0}” geçerli bir aralık değil.', parca) };
        if (+c - +a > ARALIK_SINIRI) return { liste: [], hata: M_('“{0}” çok geniş.', parca) };
        for (let i = +a; i <= +c; i++) liste.push(String(i).padStart(5, '0'));
      } else {
        const n = klipsNo(parca);
        if (!n) return { liste: [], hata: M_('“{0}” geçerli bir klips numarası değil.', parca) };
        liste.push(n);
      }
    }
    return { liste: [...new Set(liste)], hata: '' };
  }

  function ayar(d) {
    const a = d.kayit('ayar', 'genel') || {};
    return { uyariSiniri: a.uyariSiniri === '' || a.uyariSiniri == null ? VARSAYILAN.uyariSiniri : Number(a.uyariSiniri) || 0 };
  }
  const araliklar = (d) => d.kayitlar('aralik').filter((a) => a.bas && a.bit).sort((a, c) => +a.bas - +c.bas);

  /* Bütün sayımlar tek yerde; depo değişmedikçe yeniden hesaplanmaz. */
  const onbellek = new WeakMap();
  function stok(d) {
    const o = onbellek.get(d);
    if (o && o.surum === d.surum) return o.v;
    const harita = new Map();
    for (const k of d.kayitlar('klips')) {
      if (!k.numara) continue;
      if (!harita.has(k.numara)) harita.set(k.numara, []);
      harita.get(k.numara).push(k);
    }
    const aralikNo = new Set();
    for (const a of araliklar(d)) for (let i = +a.bas; i <= +a.bit; i++) aralikNo.add(i);
    const bosta = [...aralikNo].filter((n) => !harita.has(String(n).padStart(5, '0'))).sort((a, c) => a - c);
    const say = { takili: 0, degisti: 0, fire: 0, verildi: 0 };
    const cakisan = [];
    const disinda = [];
    for (const [no, l] of harita) {
      if (l.length > 1) cakisan.push(no);
      if (!aralikNo.has(+no)) disinda.push(no);
      for (const k of l) if (say[k.durum] !== undefined) say[k.durum]++;
    }
    const v = { harita, aralikNo, bosta, toplam: aralikNo.size, ...say, cakisan: cakisan.sort(), disinda: disinda.sort(), sirada: bosta.length ? String(bosta[0]).padStart(5, '0') : '' };
    onbellek.set(d, { surum: d.surum, v });
    return v;
  }
  /* Sıradaki boş numaralar; formda yazılmış olanlar (haric) atlanır. */
  function siradakiler(d, adet, haric = new Set()) {
    const l = [];
    for (const n of stok(d).bosta) {
      const no = String(n).padStart(5, '0');
      if (haric.has(no)) continue;
      l.push(no);
      if (l.length >= adet) break;
    }
    return l;
  }

  const ambalajKlipsleri = (d, id) => d.kayitlar('klips').filter((k) => k.ambalaj === id).sort((a, c) => trSirala(a.numara, c.numara));
  /* En yeni üstte; tarihi girilmemiş kayıtlar eklenme sırasıyla sonda. */
  const ambalajlar = (d) => d.kayitlar('ambalaj').sort((a, c) => {
    const x = a.tarih || '';
    const y = c.tarih || '';
    if (x !== y) return x < y ? 1 : -1;
    return trSirala(c.numara || '', a.numara || '');
  });
  /* Sonradan elle tamamlanacak bilgiler. */
  function eksikler(a) {
    const l = [];
    if (!String(a.numara || '').trim()) l.push('Ambalaj no');
    if (!a.tarih) l.push('Tarih');
    if (!a.sevk && !a.sevkNo && !a.firma) l.push('Sevkiyat');
    if (!String(a.urun || '').trim()) l.push('Ürün');
    if (!String(a.parti || '').trim()) l.push('Parti');
    return l;
  }
  const eksikliAmbalajlar = (d) => ambalajlar(d).filter((a) => eksikler(a).length > 0);
  function cakisanAmbalajlar(d) {
    const c = new Set(stok(d).cakisan);
    return ambalajlar(d).filter((a) => ambalajKlipsleri(d, a.id).some((k) => c.has(k.numara)));
  }
  /* Başka firmaya verilenler, nedene göre ve ardışık aralıklarla: [{ neden, adet, araliklar: ['00023–00120'], kayitlar }] */
  function verilenler(d) {
    const m = new Map();
    for (const k of d.kayitlar('klips').filter((x) => x.durum === 'verildi').sort((a, c) => +a.numara - +c.numara)) {
      const n = k.neden || 'Neden yazılmamış';
      if (!m.has(n)) m.set(n, { neden: n, adet: 0, parca: [], kayitlar: [] });
      const g = m.get(n);
      g.adet++;
      g.kayitlar.push(k);
      const son = g.parca[g.parca.length - 1];
      if (son && +son[1] + 1 === +k.numara) son[1] = k.numara; else g.parca.push([k.numara, k.numara]);
    }
    return [...m.values()].map((g) => ({ ...g, araliklar: g.parca.map(([a, c]) => (a === c ? a : `${a}–${c}`)) }));
  }
  /* Sevkiyata göre gruplar: Satış kaydı, yoksa sevkiyat no / firma; hiçbiri yoksa “girilmemiş”. */
  function sevkGruplari(d) {
    const m = new Map();
    for (const a of ambalajlar(d)) {
      const ana = a.sevk || a.sevkNo || a.firma || '';
      if (!m.has(ana)) m.set(ana, { anahtar: ana, sevk: a.sevk || '', sevkNo: a.sevkNo || '', firma: a.firma || '', tarih: a.tarih || '', ambalajlar: [] });
      const g = m.get(ana);
      g.ambalajlar.push(a);
      if (!g.sevkNo && a.sevkNo) g.sevkNo = a.sevkNo;
      if (!g.firma && a.firma) g.firma = a.firma;
      if (a.tarih && a.tarih > g.tarih) g.tarih = a.tarih;
    }
    return [...m.values()].sort((x, y) => {
      if (!x.anahtar !== !y.anahtar) return x.anahtar ? -1 : 1;
      return x.tarih < y.tarih ? 1 : x.tarih > y.tarih ? -1 : trSirala(x.firma, y.firma);
    });
  }

  function ozet(d) {
    const s = stok(d);
    if (!s.toplam && !s.harita.size) return [T_('Henüz kayıt yok'), T_('Klips numaralarını Stok sayfasından tanımlayın')];
    return [
      M_('{0} klips takılı · {1} boşta', s.takili.toLocaleString(NT.dil?.yerel() ?? 'tr-TR'), s.bosta.length.toLocaleString(NT.dil?.yerel() ?? 'tr-TR')),
      [s.sirada ? M_('Sıradaki: {0}', s.sirada) : T_('Boşta klips yok'), s.fire && M_('{0} fire', s.fire), s.verildi && M_('{0} verildi', s.verildi), s.degisti && M_('{0} değiştirildi', s.degisti)].filter(Boolean).join(' · '),
    ];
  }
  /* Karşılama ekranı şeridi; kurallar kenar menüsü sayaçlarıyla aynıdır. */
  function dikkat(d) {
    const s = stok(d);
    const sinir = ayar(d).uyariSiniri;
    const eksik = eksikliAmbalajlar(d).length;
    return [
      s.cakisan.length && { metin: M_('{0} klips numarası iki kez girilmiş', s.cakisan.length), sekme: 'kayitlar' },
      s.toplam > 0 && sinir > 0 && s.bosta.length <= sinir && { metin: M_('Boşta {0} klips kaldı', s.bosta.length), sekme: 'stok' },
      eksik && { metin: `${eksik} ambalajda eksik klips bilgisi`, sekme: 'kayitlar' },
    ].filter(Boolean);
  }

  NT.klips = { TURLER, DURUMLAR, PERSONEL, VARSAYILAN, ARALIK_SINIRI, klipsNo, ambalajNo, sonrakiAmbalajNo, numaraListesi, ayar, araliklar, stok, siradakiler, ambalajKlipsleri, ambalajlar, eksikler, eksikliAmbalajlar, cakisanAmbalajlar, verilenler, sevkGruplari, ozet, dikkat };
})(typeof window !== 'undefined' ? window : globalThis);
