/* Yemek — sunum modu (?demo): örnek günlük sayılar, yazılı menüler ve faturalar; hiçbir şey kaydedilmez. */
(function () {
  'use strict';
  const NT = window.NT;
  const { bugun, gunEkle } = NT.c;
  const K = NT.kabuk;
  const Y = NT.yemek;
  const T = NT.tatil;

  const CORBA = ['MERCİMEK ÇORBASI', 'EZOGELİN ÇORBASI', 'YAYLA ÇORBASI', 'DOMATES ÇORBASI', 'TARHANA ÇORBASI', 'MANTAR ÇORBASI', 'BROKOLİ ÇORBASI'];
  const ANA = ['FIRIN ANNE KÖFTE', 'TAVUK DÖNER', 'KURU FASULYE', 'PİLİÇ KÜLBASTI', 'KARNIYARIK', 'ORMAN KEBABI', 'ET DÖNER', 'NOHUT', 'İZMİR KÖFTE'];
  const PILAV = ['PİRİNÇ PİLAVI', 'BULGUR PİLAVI', 'ŞEH. PİRİNÇ PİLAVI', 'BURGU MAKARNA'];
  const SALATA = ['ÇOBAN SALATA/YOĞURT', 'MEVSİM SALATA/AYRAN', 'AKDENİZ SALATA/AYRAN', 'ŞEFİN SALATA/AYRAN'];
  const YAN = ['HAVUÇ TARATOR', 'ACILI EZME', 'KISIR', 'HAYDARİ', 'BİBER BORANİ', 'PATATES SALATASI'];
  const TATLI = ['MEYVE', 'MEYVE', 'SÜTLAÇ', 'REVANİ', 'TRİLEÇE', 'ISLAK KEK'];

  K.demoTanimla(async (d, { kim, kaydet }) => {
    const bg = bugun();
    const bas = gunEkle(bg, -130);
    kim('Kamil Gülhan');
    await kaydet([{ c: 'ayar', k: 'genel', v: { eksikBaslangic: bas } }], bas);
    // Günlük sayılar: iş günleri 8–9 öğle; ara sıra kahvaltı ve akşam (mesai). Bu ay iki gün bilerek boş bırakıldı.
    const bos = new Set([gunEkle(bg, -3), gunEkle(bg, -8)].filter((t) => T.isGunu(t)));
    let i = 0;
    for (let t = bas; t < bg; t = gunEkle(t, 1)) {
      if (!T.isGunu(t) || bos.has(t)) continue;
      i++;
      kim(i % 4 === 0 ? 'Farukcan' : 'Kamil Gülhan');
      const mesai = i % 9 === 0;
      await kaydet([{ c: 'gun', k: t, v: { tarih: t, ogle: i % 7 === 0 ? 8 : 9, kahvalti: mesai ? 3 : 0, aksam: mesai ? 4 : 0, notlar: i % 23 === 0 ? 'Bacacılar için +2 sipariş verildi' : '', yemekYok: false } }], t);
    }
    // Yazılı menüler: bu ay ve gelecek ay (öğle + akşam). Gerçekte menü resmi yüklenince kendiliğinden dolar.
    kim('Kamil Gülhan');
    const ops = [];
    for (const ay of [bg.slice(0, 7), Y.ayKaydir(bg.slice(0, 7), 1)]) {
      Y.ayGunleri(ay).forEach((t, n) => {
        for (const [j, o] of ['ogle', 'aksam'].entries()) {
          const k = n * 2 + j;
          ops.push({ c: 'menugun', k: Y.menuGunAnahtari(t, o), v: { tarih: t, ogun: o, yemekler: [CORBA[k % 7], ANA[(k * 5) % 9], PILAV[k % 4], SALATA[(k + j) % 4], YAN[(k * 3) % 6], TATLI[(k * 7) % 6]] } });
        }
      });
    }
    await kaydet(ops, gunEkle(bg.slice(0, 7) + '-01', -2));
    // Desbaş Kafe: menü dışı siparişler (son iki ay); geçen ayın kafe faturası girilmiş.
    const kafe = [[-40, ['Farukcan'], 'Kaşarlı tost + ayran', 1, 90], [-33, ['Barlas', 'Baturhan'], 'Lahmacun', 4, 320], [-26, ['Farukcan', 'Barlas'], 'Hamburger menü', 2, 380],
      [-19, ['Baturhan'], 'Kaşarlı tost + ayran', 1, 90], [-9, ['Farukcan', 'Baturhan', 'Barlas'], 'Pide', 3, ''], [-2, ['Farukcan'], 'Çay + simit', 2, 60]];
    for (const [g, kisiler, urun, adet, tutar] of kafe) {
      const t = gunEkle(bg, g);
      kim(kisiler[0] === 'Farukcan' ? 'Farukcan' : 'Kamil Gülhan');
      await kaydet([{ c: 'kafe', k: NT.c.uid(), v: { tarih: t, kisiler, urun, adet, tutar, notlar: g === -9 ? 'Mesai' : '', ekler: [] } }], t);
    }
    kim('Kamil Gülhan');
    const gecenAy = Y.ayKaydir(bg.slice(0, 7), -1);
    const kg = Y.kafeOzet(d, gecenAy);
    if (kg.siparis) await kaydet([{ c: 'kafefatura', k: Y.faturaAnahtari(gecenAy), v: { ay: gecenAy, tutar: kg.tutar, faturaNo: 'KF-' + gecenAy.replace('-', ''), faturaTarihi: '', notlar: '', ekler: [] } }], bg.slice(0, 7) + '-02');
    // Faturalar: geçmiş aylar tutuyor, biri farklı; geçen ayın faturası bekleniyor.
    const aylar = Y.aylar(d).filter((a) => a < Y.ayKaydir(bg.slice(0, 7), -1));
    for (const [n, a] of aylar.entries()) {
      const x = Y.ayOzet(d, a);
      if (!x.toplam) continue;
      await kaydet([{ c: 'fatura', k: Y.faturaAnahtari(a), v: { ay: a, ogle: x.adet.ogle + (n === aylar.length - 1 ? 2 : 0), kahvalti: x.adet.kahvalti, aksam: x.adet.aksam, faturaNo: `DSB${a.replace('-', '')}`, faturaTarihi: gunEkle(Y.ayKaydir(a, 1) + '-01', 2), notlar: '', ekler: [] } }], gunEkle(Y.ayKaydir(a, 1) + '-01', 3));
    }
  });
})();
