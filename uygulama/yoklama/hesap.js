/*
 * Yoklama — iş kuralları (arayüzsüz; karşılama ekranı da özet için yükler).
 * Ücret/gelir hesabı yoktur; amaç kişilerin devamını ve fazla mesai saatini tutmak, İK'nın kendi kayıtlarıyla karşılaştırabileceği aylık dökümü vermektir.
 *
 * Herkes iş günlerinde işte kabul edilir; yalnızca istisna girilir. Hafta sonu ve resmî tatiller kendiliğindendir (ortak/tatiller.js).
 *
 * Koleksiyonlar:
 *   kisi     { ad, aktif, bas (işe başlama / takibe giriş), bit (ayrılış), sira, notlar }
 *   istisna  { kisi (id), tur, bas, bit (tarih aralığı; tek gün için bit = bas), saat, notlar, ekler }
 *            tur: rapor | yillik | izin | gelmedi (yok sayılır) · mesai (iş gününde fazla mesai, günlük saat) · tatil (hafta sonu / resmî tatilde çalıştı)
 *   onay     anahtar 'ay-YYYY-MM' { ay, notlar } — "Ayı onayla"; onaylayan ve zaman kaydın geçmişindedir
 *   ayar     'genel' { baslangic } — takibin başladığı gün (önceki günler sayılmaz)
 */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});
  const { sayi, bugun, gunEkle, trSirala } = NT.c;
  const T = NT.tatil;

  /* yok: o gün işte değil (iş günü sayısından düşer). Sıra, aynı güne iki kayıt düşerse hangisinin görüneceğidir. */
  const TURLER = [
    { id: 'rapor', ad: 'Raporlu', kod: 'S', renk: 'yok', yok: true, ipucu: 'Rapor görselini eklemeniz önerilir' },
    { id: 'yillik', ad: 'Yıllık izin', kod: 'Yİ', renk: 'bilgi', yok: true, ipucu: 'Açıklama yazmanız önerilir' },
    { id: 'izin', ad: 'İzinli / mazeret', kod: 'İ', renk: 'mor', yok: true },
    { id: 'gelmedi', ad: 'Gelmedi', kod: 'G', renk: 'kritik', yok: true },
    { id: 'mesai', ad: 'Fazla mesai', kod: '', renk: 'iyi', saat: true, ipucu: 'İş günündeki fazla mesai; aralık seçilirse her iş gününe aynı saat yazılır' },
    { id: 'tatil', ad: 'Hafta sonu / tatil çalıştı', kod: 'Ç', renk: 'iyi', saat: true, ipucu: 'Cumartesi, Pazar veya resmî tatilde çalışma' },
  ];
  const tur = (id) => TURLER.find((t) => t.id === id) || TURLER[0];
  const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const ayAdi = (ay) => `${AY_ADLARI[+ay.slice(5, 7) - 1]} ${ay.slice(0, 4)}`;
  const gunKisa = (t) => GUN_KISA[new Date(t + 'T12:00:00').getDay()];
  const ayGunleri = (ay) => Array.from({ length: new Date(+ay.slice(0, 4), +ay.slice(5, 7), 0).getDate() }, (_, i) => `${ay}-${String(i + 1).padStart(2, '0')}`);
  const ayKaydir = (ay, n) => { const d = new Date(+ay.slice(0, 4), +ay.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const saatYaz = (s) => (Number.isInteger(s) ? String(s) : String(Math.round(s * 10) / 10).replace('.', ','));
  const onayAnahtari = (ay) => `ay-${ay}`;

  const ayar = (d) => ({ baslangic: '', ...(d.kayit('ayar', 'genel') || {}) });
  function kisiler(d, { hepsi = false } = {}) {
    return d.kayitlar('kisi').filter((k) => hepsi || k.aktif !== false).sort((a, b) => sayi(a.sira) - sayi(b.sira) || trSirala(a.ad, b.ad));
  }
  /* Kişi o gün takipte mi: takip başlangıcı, işe başlama ve ayrılış tarihleri arasında. */
  function takipte(d, k, t, a = ayar(d)) {
    return (!a.baslangic || t >= a.baslangic) && (!k.bas || t >= k.bas) && (!k.bit || t <= k.bit);
  }
  const istisnalar = (d) => d.kayitlar('istisna').filter((i) => i.kisi && i.bas);
  const kapsar = (i, t) => i.bas <= t && t <= (i.bit || i.bas);

  /* Bir kişinin bir günü: { kod, tur, kayit, kayitlar, yok, calisti, kapali, saat, tatil, disarda, gelecek } */
  function gunDurum(d, k, t, liste = istisnalar(d), a = ayar(d)) {
    if (!takipte(d, k, t, a)) return { kod: '', disarda: true, kayitlar: [] };
    const ilgili = liste.filter((i) => i.kisi === k.id && kapsar(i, t));
    const gelecek = t > bugun();
    const yok = TURLER.filter((x) => x.yok).map((x) => ilgili.find((i) => i.tur === x.id)).find(Boolean);
    if (yok) return { kod: tur(yok.tur).kod, tur: yok.tur, kayit: yok, kayitlar: ilgili, yok: true, gelecek };
    if (!T.isGunu(t)) {
      const c = ilgili.find((i) => i.tur === 'tatil');
      if (c) return { kod: 'Ç' + (sayi(c.saat) ? saatYaz(sayi(c.saat)) : ''), tur: 'tatil', kayit: c, kayitlar: ilgili, calisti: true, tatil: true, saat: sayi(c.saat), gelecek };
      return { kod: T.tatil(t) ? 'RT' : 'HT', kapali: true, kayitlar: ilgili, gelecek };
    }
    const mesai = ilgili.filter((i) => i.tur === 'mesai');
    const saat = mesai.reduce((s, i) => s + sayi(i.saat), 0);
    if (gelecek && !saat) return { kod: '', gelecek: true, kayitlar: ilgili };
    return { kod: saat ? saatYaz(saat) : '+', tur: saat ? 'mesai' : '', kayit: mesai[0], kayitlar: ilgili, calisti: true, saat, gelecek };
  }

  /* Ay özeti (kişi başına). Bu ayın gelecek günleri "çalıştı"ya sayılmaz; izin/rapor gibi önceden girilenler sayılır. */
  function ayOzet(d, ay) {
    const a = ayar(d);
    const liste = istisnalar(d);
    const gunler = ayGunleri(ay);
    return kisiler(d, { hepsi: true }).map((k) => {
      const x = { kisi: k, isGunu: 0, calisti: 0, rapor: 0, raporTakvim: 0, yillik: 0, izin: 0, gelmedi: 0, mesaiSaat: 0, mesaiGun: 0, tatilGun: 0, tatilSaat: 0, cumartesi: 0, pazar: 0, resmi: 0, gunler: {} };
      let var_ = false;
      for (const t of gunler) {
        const g = gunDurum(d, k, t, liste, a);
        x.gunler[t] = g;
        if (g.disarda) continue;
        var_ = true;
        if (g.tur === 'rapor') x.raporTakvim++;
        if (T.isGunu(t)) {
          x.isGunu++;
          if (g.yok) x[g.tur]++;
          else if (g.calisti && !g.gelecek) { x.calisti++; if (g.saat) { x.mesaiSaat += g.saat; x.mesaiGun++; } }
        } else if (g.tatil && !g.gelecek) {
          x.tatilGun++; x.tatilSaat += g.saat || 0;
          if (T.tatil(t)) x.resmi++; else if (new Date(t + 'T12:00:00').getDay() === 0) x.pazar++; else x.cumartesi++;
        }
      }
      x.takipte = var_;
      return x;
    }).filter((x) => x.takipte && (x.kisi.aktif !== false || Object.values(x.gunler).some((g) => !g.disarda)));
  }

  function onay(d, ay) { const o = d.kayit('onay', onayAnahtari(ay)); return o && !o._silindi ? o : null; }
  /* Onaydan sonra o ayı etkileyen bir kayıt değişti mi? */
  function onaydanSonraDegisen(d, ay) {
    const o = onay(d, ay);
    if (!o) return [];
    const ilk = `${ay}-01`, son = ayGunleri(ay).slice(-1)[0];
    return d.kayitlar('istisna', { silinenler: true }).filter((i) => i._degisim > o._degisim && i.bas <= son && (i.bit || i.bas) >= ilk);
  }

  /* Bir kaydın kapsadığı gün sayıları: iş günü ve takvim günü. */
  function kayitGunleri(i) {
    let is = 0, takvim = 0;
    for (let t = i.bas; t <= (i.bit || i.bas); t = gunEkle(t, 1)) { takvim++; if (T.isGunu(t)) is++; if (takvim > 400) break; }
    return { is, takvim };
  }
  /* Aynı kişide çakışan yokluk kaydı (aynı güne iki farklı izin/rapor). */
  function cakisanlar(d, i) {
    if (!tur(i.tur).yok) return [];
    return istisnalar(d).filter((x) => x.id !== i.id && x.kisi === i.kisi && tur(x.tur).yok && x.bas <= (i.bit || i.bas) && (x.bit || x.bas) >= i.bas);
  }

  /* Bugün: kişi başına durum. */
  function bugunListe(d) {
    const bg = bugun(), liste = istisnalar(d), a = ayar(d);
    return kisiler(d).map((k) => ({ k, g: gunDurum(d, k, bg, liste, a) }));
  }
  /* Karşılama ekranı kartı için kısa özet. */
  /* Karşılama ekranındaki "dikkat bekleyenler" şeridi; kural kenar menüsündeki Aylık çizelge sayacıyla aynıdır (geçen ay). */
  function dikkat(d) {
    const g = ayKaydir(bugun().slice(0, 7), -1);
    if (!ayOzet(d, g).length) return [];
    if (!onay(d, g)) return [{ metin: `${ayAdi(g)} yoklaması onaylanmadı`, sekme: 'cizelge' }];
    const n = onaydanSonraDegisen(d, g).length;
    return n ? [{ metin: `${ayAdi(g)} onayından sonra ${n} kayıt değişti`, sekme: 'cizelge' }] : [];
  }

  function ozet(d) {
    const l = bugunListe(d).filter((x) => !x.g.disarda);
    if (!kisiler(d).length) return ['Personel eklenmedi', 'Ayarlar › Personel'];
    const bg = bugun();
    const ay = ayOzet(d, bg.slice(0, 7));
    const yok = l.filter((x) => x.g.yok);
    const ilk = T.isGunu(bg) ? `Bugün ${l.length - yok.length}/${l.length} kişi işte` : `Bugün ${T.tatil(bg) || 'hafta sonu'}`;
    const mesai = ay.reduce((s, x) => s + x.mesaiSaat + x.tatilSaat, 0);
    return [ilk, [yok.length && yok.map((x) => `${x.k.ad.split(' ')[0]}: ${tur(x.g.tur).ad.toLocaleLowerCase('tr')}`).join(', '), `Bu ay ${saatYaz(mesai)} saat fazla mesai`].filter(Boolean).join(' · ')];
  }

  NT.yoklama = { TURLER, tur, AY_ADLARI, ayAdi, gunKisa, ayGunleri, ayKaydir, saatYaz, onayAnahtari, ayar, kisiler, takipte, istisnalar, kapsar, gunDurum, ayOzet, onay, onaydanSonraDegisen, kayitGunleri, cakisanlar, bugunListe, ozet, dikkat };
})(typeof window !== 'undefined' ? window : globalThis);
