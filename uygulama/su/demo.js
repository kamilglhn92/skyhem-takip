/* İçme Suyu — sunum modu (?demo): örnek siparişler, teslimatlar, fiyatlar ve faturalar; hiçbir şey kaydedilmez. */
(function () {
  'use strict';
  const NT = window.NT;
  const { uid, bugun, gunEkle } = NT.c;
  const K = NT.kabuk;
  const S = NT.su;

  K.demoTanimla(async (d, { kim, kaydet }) => {
    const bg = bugun();
    kim('Kamil Gülhan');
    await kaydet([
      { c: 'ayar', k: 'genel', v: { tedarikci: 'Örnek Su Bayii', telefon: '', mesaj: S.VARSAYILAN.mesaj, koliBardak: 60, bardakMl: 200, damacanaL: 19 } },
      { c: 'fiyat', k: uid(), v: { tarih: gunEkle(bg, -400), damacana: 150, bardak: 125, kdv: 0, aciklama: 'İlk fiyat' } },
    ], gunEkle(bg, -330));
    await kaydet([{ c: 'fiyat', k: uid(), v: { tarih: gunEkle(bg, -150), damacana: 160, bardak: 135, kdv: 0, aciklama: 'Zam' } }], gunEkle(bg, -150));

    /* [sipariş günü (bugünden), damacana, bardak koli, teslimatlar: [gün sonra, damacana, bardak]] */
    const siparisler = [
      [-310, 10, 10, [[1, 10, 10]]], [-282, 0, 10, [[2, 0, 5], [4, 0, 5]]], [-255, 10, 10, [[1, 10, 10]]], [-226, 10, 8, [[2, 10, 8]]],
      [-198, 5, 10, [[0, 5, 10]]], [-170, 10, 10, [[1, 10, 10]]], [-141, 10, 15, [[1, 10, 15]]], [-112, 0, 10, [[0, 0, 10]]],
      [-90, 10, 10, [[0, 10, 10]]], [-61, 10, 10, [[1, 10, 6]]], [-34, 10, 11, [[0, 10, 11]]], [-12, 10, 10, [[1, 10, 10]]], [-2, 10, 10, []],
    ];
    let n = 0;
    for (const [gun, damacana, bardak, tl] of siparisler) {
      const tarih = gunEkle(bg, gun);
      const id = uid();
      kim(n % 3 === 1 ? 'Farukcan' : 'Kamil Gülhan');
      const kapandi = tl.length && tl.reduce((t, x) => t + x[2], 0) < bardak;
      await kaydet([{ c: 'siparis', k: id, v: { no: K.yeniNo(d, 'siparis', 'SU', tarih), tarih, damacana, bardak, notlar: '', ...(kapandi ? { kapandi: true, kapanisNot: 'Kalan 4 koli gelmedi' } : {}) } }], tarih);
      for (const [sonra, td, tb] of tl) {
        const t2 = gunEkle(tarih, sonra);
        if (t2 > bg) continue;
        await kaydet([{ c: 'teslim', k: uid(), v: { siparis: id, tarih: t2, damacana: td, bardak: tb, notlar: tl.length > 1 ? 'Kısmi teslim' : '' } }], t2);
      }
      n++;
    }

    /* Faturalar: geçmiş ayların çoğu girilmiş, biri farklı, son ay bekleniyor. */
    const aylar = S.aylar(d).filter((x) => x.ay < bg.slice(0, 7));
    kim('Kamil Gülhan');
    for (const [i, x] of aylar.entries()) {
      if (i === aylar.length - 1) continue;
      const fark = i === aylar.length - 3 ? 160 : 0;
      await kaydet([{ c: 'fatura', k: S.faturaAnahtari(x.ay), v: { ay: x.ay, tutar: x.toplam + fark, faturaNo: `SU${x.ay.replace('-', '')}${String(i + 1).padStart(3, '0')}`, faturaTarihi: gunEkle(`${x.ay}-28`, 3), notlar: fark ? 'Bir damacana fazla yazılmış olabilir' : '', ekler: [] } }], gunEkle(`${x.ay}-28`, 4));
    }
  });
})();
