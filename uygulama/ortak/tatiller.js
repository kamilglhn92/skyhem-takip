/*
 * Türkiye resmi tatilleri (Yemek ve Yoklama ortak kullanır). Tam gün tatiller "tatil", arife yarım günleri "yarim".
 * Dini bayramlar her yıl değişir: yeni yıl için Diyanet takvimine göre buraya eklenmelidir.
 * 2026 bayramları eski yemek tablosundaki boş günlerle, 2027 tarihleri Diyanet takvimini aktaran haberlerle (Ekim 2026) doğrulandı.
 */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});

  const SABIT = { '01-01': 'Yılbaşı', '04-23': 'Ulusal Egemenlik ve Çocuk Bayramı', '05-01': 'Emek ve Dayanışma Günü', '05-19': 'Atatürk’ü Anma, Gençlik ve Spor Bayramı',
    '07-15': 'Demokrasi ve Millî Birlik Günü', '08-30': 'Zafer Bayramı', '10-29': 'Cumhuriyet Bayramı' };
  /* [ilk gün, gün sayısı, ad] — arife bir önceki gündür (yarım gün) */
  const BAYRAM = {
    2025: [['2025-03-30', 3, 'Ramazan Bayramı'], ['2025-06-06', 4, 'Kurban Bayramı']],
    2026: [['2026-03-20', 3, 'Ramazan Bayramı'], ['2026-05-27', 4, 'Kurban Bayramı']],
    2027: [['2027-03-09', 3, 'Ramazan Bayramı'], ['2027-05-16', 4, 'Kurban Bayramı']],
  };

  const iki = (n) => String(n).padStart(2, '0');
  const gunEkle = (t, n) => { const d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`; };
  const yillar = {};
  function yil(y) {
    if (yillar[y]) return yillar[y];
    const tatil = {}, yarim = {};
    for (const [g, ad] of Object.entries(SABIT)) tatil[`${y}-${g}`] = ad;
    yarim[`${y}-10-28`] = 'Cumhuriyet Bayramı arifesi';
    for (const [ilk, n, ad] of BAYRAM[y] || []) {
      yarim[gunEkle(ilk, -1)] = `${ad} arifesi`;
      for (let i = 0; i < n; i++) tatil[gunEkle(ilk, i)] = tatil[gunEkle(ilk, i)] ? `${tatil[gunEkle(ilk, i)]} · ${ad}` : `${ad} ${i + 1}. gün`;
    }
    return (yillar[y] = { tatil, yarim });
  }
  /* Tam gün resmi tatilse adı, değilse null. */
  const tatil = (t) => yil(+t.slice(0, 4)).tatil[t] || null;
  const yarimGun = (t) => yil(+t.slice(0, 4)).yarim[t] || null;
  const haftaSonu = (t) => { const g = new Date(t + 'T12:00:00').getDay(); return g === 0 || g === 6; };
  /* İş günü: hafta içi ve resmi tatil değil (arife yarım günü iş günüdür). */
  const isGunu = (t) => !haftaSonu(t) && !tatil(t);
  const bilinenYil = (y) => !!BAYRAM[y];
  /* Bir yılın tatil listesi: [{ tarih, ad, yarim }] */
  function liste(y) {
    const { tatil: t, yarim } = yil(y);
    return [...Object.entries(t).map(([tarih, ad]) => ({ tarih, ad, yarim: false })), ...Object.entries(yarim).map(([tarih, ad]) => ({ tarih, ad, yarim: true }))]
      .sort((a, b) => (a.tarih < b.tarih ? -1 : 1));
  }

  NT.tatil = { tatil, yarimGun, haftaSonu, isGunu, bilinenYil, liste };
})(typeof window !== 'undefined' ? window : globalThis);
