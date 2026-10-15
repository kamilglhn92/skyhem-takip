/* Satış Takip — sunum modu (?demo): uydurma firmalarla örnek veri; hiçbir şey kaydedilmez. */
(function () {
  'use strict';
  const NT = window.NT;
  const { uid, bugun, gunEkle } = NT.c;
  const K = NT.kabuk;

  K.demoTanimla(async (d, { kim, kaydet }) => {
    const bg = bugun();
    const musteriler = [
      ['Anadolu Kauçuk A.Ş.', 'Türkiye', 'Eskişehir OSB', 'Selin Aydın'],
      ['Nordic Tyres Oy', 'Finlandiya', 'Tampere, Finland', 'Mika Virtanen'],
      ['Adriatica Rubber S.p.A.', 'İtalya', 'La Spezia, Italy', 'Giulia Rossi'],
      ['Deccan Tyres Ltd.', 'Hindistan', 'Pune, India', 'Arjun Mehta'],
      ['Bolu Yalıtım San.', 'Türkiye', 'Bolu OSB', 'Kerem Yıldız'],
    ].map(([ad, ulke, adres, yetkili]) => ({ id: uid(), ad, ulke, adres, yetkili }));
    kim('Kamil Gülhan');
    await kaydet(musteriler.map((m) => ({ c: 'musteri', k: m.id, v: { ad: m.ad, ulke: m.ulke, adres: m.adres, yetkili: m.yetkili } })), gunEkle(bg, -330));
    await kaydet([
      { c: 'parti', k: uid(), v: { urun: 'Ecosky 3103', parti: 'Batch #4', uretimTarihi: gunEkle(bg, -420), uretimKg: 20000 } },
      { c: 'parti', k: uid(), v: { urun: 'Ecosky 3103', parti: 'Batch #21', uretimTarihi: gunEkle(bg, -250), uretimKg: 12000 } },
    ], gunEkle(bg, -300));

    const sevkler = [
      [-300, 0, 'IBC', 4, 'Batch #4', 'Teslim edildi'], [-260, 1, 'Varil', 1, 'Batch #8', 'Teslim edildi'], [-230, 2, 'Varil', 2, 'Batch #8', 'Teslim edildi'],
      [-200, 3, 'Varil', 1, 'Batch #8', 'Teslim edildi'], [-170, 4, 'IBC', 4, 'Batch #4', 'Teslim edildi'], [-140, 0, 'IBC', 7, 'Batch #21', 'Teslim edildi'],
      [-110, 4, 'Varil', 3, 'Batch #21', 'Teslim edildi'], [-80, 0, 'IBC', 5, 'Batch #21', 'Teslim edildi'], [-50, 1, 'İsotank', 1, 'Batch #21', 'Teslim edildi'],
      [-25, 4, 'IBC', 2, 'Batch #21', 'Teslim edildi'], [-12, 2, 'IBC', 4, 'Batch #22', 'Yolda'], [-4, 0, 'IBC', 6, 'Batch #22', 'Hazırlanıyor'], [-1, 3, 'Varil', 2, 'Batch #22', 'Sipariş'],
    ];
    let n = 0;
    for (const [gun, mi, ambalaj, adet, parti, durum] of sevkler) {
      const m = musteriler[mi];
      const tarih = gunEkle(bg, gun);
      const birim = ambalaj === 'IBC' ? 1000 : ambalaj === 'Varil' ? 200 : 20000;
      const dara = ambalaj === 'IBC' ? 57 : ambalaj === 'Varil' ? 26 : 0;
      const yer = NT.satis.DURUMLAR.indexOf(durum);
      kim(n % 3 ? 'Farukcan' : 'Kamil Gülhan');
      await kaydet([{ c: 'sevk', k: uid(), v: {
        no: K.yeniNo(d, 'sevk', 'SV', tarih), durum, firma: m.ad, musteri: m.id, ulke: m.ulke, adres: m.adres, yetkili: m.yetkili,
        siparisTarihi: gunEkle(tarih, -3), sevkTarihi: yer >= 2 ? tarih : '', teslimTarihi: yer >= 3 ? gunEkle(tarih, m.ulke === 'Türkiye' ? 1 : 12) : '',
        kalemler: [{ urun: 'Ecosky 3103', parti, ambalaj, adet, brut: adet * (birim + dara), dara: adet * dara, net: adet * birim }],
        coaTarihi: yer >= 1 ? gunEkle(tarih, -5) : '', plaka: yer >= 2 ? `34 SKY ${120 + n}` : '', sofor: yer >= 2 ? ['Ali Demir', 'Hasan Çelik'][n % 2] : '',
        konteyner: ambalaj === 'İsotank' ? 'AAMU2617088' : '', birimFiyat: n % 4 === 0 ? 1.85 : '', paraBirimi: '€', notlar: '', ekler: [],
      } }], gunEkle(tarih, -3));
      n++;
    }
  });
})();
