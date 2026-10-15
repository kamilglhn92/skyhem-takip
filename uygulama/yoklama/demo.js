/* Yoklama — sunum modu (?demo): uydurma personel ve örnek izin/rapor/fazla mesai kayıtları; hiçbir şey kaydedilmez. */
(function () {
  'use strict';
  const NT = window.NT;
  const { uid, bugun, gunEkle } = NT.c;
  const K = NT.kabuk;
  const T = NT.tatil;

  K.demoTanimla(async (d, { kim, kaydet }) => {
    const bg = bugun();
    const bas = gunEkle(bg.slice(0, 7) + '-01', -45);
    kim('Kamil Gülhan');
    const kisiler = ['Ali Demir', 'Mehmet Kaya', 'Ayşe Şahin', 'Hasan Çelik', 'Zeynep Arslan'].map((ad, i) => ({ id: uid(), ad, sira: i + 1 }));
    await kaydet([{ c: 'ayar', k: 'genel', v: { baslangic: bas } }, ...kisiler.map((k) => ({ c: 'kisi', k: k.id, v: { ad: k.ad, aktif: true, bas: '', bit: '', sira: k.sira, notlar: '' } }))], bas);
    const isGunu = (n) => { let t = gunEkle(bg, n); while (!T.isGunu(t)) t = gunEkle(t, -1); return t; };
    const cmt = (() => { let t = gunEkle(bg, -20); while (new Date(t + 'T12:00:00').getDay() !== 6) t = gunEkle(t, 1); return t; })();
    const kayitlar = [
      [0, 'rapor', isGunu(-30), gunEkle(isGunu(-30), 2), '', '3 günlük rapor'],
      [1, 'yillik', isGunu(-22), isGunu(-20), '', 'Yıllık izin'],
      [2, 'izin', isGunu(-12), isGunu(-12), '', 'Mahkemesi var'],
      [3, 'mesai', isGunu(-9), isGunu(-9), 3, 'Sevkiyat yüklemesi'],
      [0, 'mesai', isGunu(-9), isGunu(-9), 3, 'Sevkiyat yüklemesi'],
      [4, 'mesai', isGunu(-5), isGunu(-4), 2, ''],
      [3, 'tatil', cmt, cmt, 6, 'Bakım'],
      [1, 'gelmedi', isGunu(-3), isGunu(-3), '', 'Haber vermedi'],
      [2, 'yillik', gunEkle(bg, 6), gunEkle(bg, 10), '', 'Planlı izin'],
      [0, 'rapor', bg, gunEkle(bg, 1), '', '2 günlük rapor'],
    ];
    for (const [i, tur, b, s, saat, notlar] of kayitlar) {
      kim(i % 2 ? 'Farukcan' : 'Kamil Gülhan');
      await kaydet([{ c: 'istisna', k: uid(), v: { kisi: kisiler[i].id, tur, bas: b, bit: s, saat, notlar, ekler: [] } }], b < bg ? b : gunEkle(bg, -1));
    }
  });
})();
