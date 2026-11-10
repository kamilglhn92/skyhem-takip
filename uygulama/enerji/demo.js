/* Enerji — sunum modu (?demo): örnek elektrik ve doğalgaz kayıtları (gerçek veri değildir); hiçbir şey kaydedilmez. */
(function () {
  'use strict';
  const NT = window.NT;
  const { uid, bugun } = NT.c;
  const K = NT.kabuk;
  const E = NT.enerji;

  K.demoTanimla(async (d, { kim, kaydet }) => {
    const buAy = bugun().slice(0, 7);
    kim('Kamil Gülhan');
    await kaydet([{ c: 'ayar', k: 'genel', v: { tedarikci: 'Örnek OSB', katsayi: 10.64 } }], `${E.ayKaydir(buAy, -27)}-01`);
    /* 26 ay; son kayıt iki ay önce (bir ayın kaydı eksik görünsün). Yazın doğalgaz tüketimi sıfır. */
    const elektrik = [2100, 1450, 980, 1170, 1380, 1620, 1900, 2640, 3100, 2850, 2300, 1750, 1500, 1120, 900, 1050, 1440, 2600, 3400, 2950, 3650, 2700, 2080, 1360, 1200, 1480];
    for (let i = 27; i >= 2; i--) {
      const n = 27 - i;
      const ay = E.ayKaydir(buAy, -i);
      const tarih = `${ay}-28`;
      const m = +ay.slice(5, 7);
      kim(n % 4 === 1 ? 'Farukcan' : 'Kamil Gülhan');
      const kwh = elektrik[n];
      const elFiyat = 0.128 - n * 0.0016 + (kwh < 1000 ? 0.02 : 0);
      await kaydet([{ c: 'kayit', k: uid(), v: { no: K.yeniNo(d, 'kayit', 'EN', tarih), tarih, tip: 'elektrik', miktar: kwh, birim: 'kWh', tutar: Math.round(kwh * elFiyat * 100) / 100, notlar: kwh > 3500 ? 'Yüksek tüketim' : '', belge: [] } }], tarih);
      if (n < 4) continue; // doğalgaz kayıtları sonradan başlıyor
      const kis = m >= 10 || m <= 4;
      const m3 = m >= 6 && m <= 8 ? 0 : kis ? [0, 620, 540, 410, 260, 0, 0, 0, 0, 0, 380, 560, 700][m] : 150;
      const gazFiyat = n < 14 ? 0.39 : 0.54;
      const kwhIle = n === 20; // bir kayıt kWh ile girilmiş: dönüştürücü örneği
      await kaydet([{ c: 'kayit', k: uid(), v: { no: K.yeniNo(d, 'kayit', 'EN', tarih), tarih, tip: 'dogalgaz', miktar: kwhIle ? Math.round(m3 * 10.64) : m3, birim: kwhIle ? 'kWh' : 'm3',
        tutar: Math.round(m3 * gazFiyat * 100) / 100, notlar: m3 === 0 ? 'Sıfır tüketim' : kwhIle ? 'Faturada kWh yazıyordu' : '', belge: [] } }], tarih);
    }
  });
})();
