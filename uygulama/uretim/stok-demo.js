/* Örnek hareketler yalnız Üretim Stoku'nun yoğun sunum deposunda oluşturulur. */
(function () {
  'use strict';
  const NT = window.NT;
  const S = NT.uretimStoku;
  S.bosSunumuHazirla = (d) => d.numuneIslem((guncel) => {
    const gruplar = [['Varil',22],['IBC',12],['İsotank',3]];
    return gruplar.flatMap(([ambalaj,adet], i) => {
      const k = 'demo-bos-' + ambalaj;
      if (guncel.kayit('bosAmbalaj',k)) return [];
      const v = { tip: 'bos_giris', konum:S.konumlar[i], ambalaj, tarih: NT.c.bugun(),
        ...(ambalaj === 'İsotank' ? {numaralar:S.seri('DM-ISO-B-001',adet,0).map((x) => x.no)} : {adet}) };
      return S.dogrula(S.hesapla(guncel),v) ? [] : [{ c: 'bosAmbalaj', k, v }];
    });
  });
  S.yogunSunum = async function (depo) {
    const dun = NT.c.gunEkle(NT.c.bugun(), -1);
    const once = NT.c.gunEkle(dun, -7);
    const hareketler = [];
    function ekle(tip, alanlar, tarih = once) {
      hareketler.push({ c: 'stok', k: 'sunum-stok-' + (hareketler.length + 1), v: { tip, tarih, konum:S.konumlar[hareketler.length % 3], ...alanlar } });
    }
    function tank(cins, urun, yer, partiler, kg, tarih) {
      ekle('giris', { acilis: true, tur: 'isotank', cins, urun, yer, kaynak: S.tankId(yer),
        parti: partiler[0], partiler, gram: kg * 1000 }, tarih);
    }
    function kaplar(onek, adet, kg) {
      return Array.from({ length: adet }, (_, i) => ({
        no: onek + String(i + 1).padStart(3, '0'), gram: kg * 1000,
      }));
    }
    // Diğer ürünlere ait hareketler, dünkü örneğin bakiyesini etkilemez.
    for (let i = 1; i <= 6; i++) {
      const gliserin = i > 4;
      const yer = 'DM-HM-' + i;
      tank(gliserin ? 'gliserin' : 'cto', gliserin ? 'Gliserin' : 'CTO', yer, ['LOT-D' + i], 16200 + 500 * i);
      ekle('tuketim', { kaynak: S.tankId(yer), parti: 'DM-R' + i, gram: 340000 });
    }
    for (let i = 1; i <= 6; i++) {
      const yer = 'DM-ISO-' + (10 + i);
      const urun = i % 2 ? 'Ecosky 2108' : 'Ecotall';
      const kaynak = S.tankId(yer);
      tank('urun', urun, yer, ['DM-A' + i, 'DM-B' + i, 'DM-C' + i], 20800);
      for (const [ambalaj, seri, adet, kg] of [['IBC', 'I', 12, 975], ['Varil', 'V', 16, 180]]) {
        const ibcler = kaplar('DM-' + seri + i + '-', adet, kg);
        ekle('dolum', { ambalaj, kaynak, ibcler, gram: S.toplam(ibcler) });
        const numaralar = ibcler.slice(0, 6).map((x) => x.no);
        ekle('ayir', { numaralar, siparis: 'DM-SIP-' + i });
        ekle('sevk', { numaralar: numaralar.slice(0, 2), siparis: 'DM-SEVK-' + i });
      }
    }

    const partiler = ['DM-71', 'DM-72', 'DM-73'];
    const urun = 'Ecosky 3103';
    tank('urun', urun, 'DM-ISO-07', partiler, 12500, dun);
    const ibcler = kaplar('DM-IBC-', 10, 1000);
    ekle('acilis_ibc', { ambalaj: 'IBC', urun, partiler, ibcler, gram: S.toplam(ibcler),
      siparis: 'DM-SIP-10' }, dun);
    await depo.kaydet(hareketler);
  };
})();
