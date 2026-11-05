/* Klips Takip — sunum modu (?demo): örnek klipsler ve sevkiyatlar; hiçbir şey kaydedilmez. */
(function () {
  'use strict';
  const NT = window.NT;
  const { uid, bugun, gunEkle } = NT.c;
  const K = NT.kabuk;

  /* Sunum modunda Satış'a bağlanılmaz; sevkiyat listesi yerine bu örnekler kullanılır. */
  NT.klipsDemoSevk = () => {
    const bg = bugun();
    return [
      { id: 'demo-s1', no: 'SV-2026-0014', firma: 'Örnek Firma A', durum: 'Teslim edildi', sevkTarihi: gunEkle(bg, -12), kalemler: [{ urun: 'Ecosky 3103', parti: 'SKY.PR.0071', ambalaj: 'IBC', adet: 6 }] },
      { id: 'demo-s2', no: 'SV-2026-0015', firma: 'Örnek Firma B', durum: 'Yolda', sevkTarihi: gunEkle(bg, -1), kalemler: [{ urun: 'Ecosky 3103', parti: 'SKY.PR.0074', ambalaj: 'Varil', adet: 8 }] },
      { id: 'demo-s3', no: 'SV-2026-0016', firma: 'Örnek Firma C', durum: 'Yolda', sevkTarihi: bg, kalemler: [{ urun: 'Ecophalt', parti: 'SKY.PR.0075', ambalaj: 'İsotank', adet: 1 }] },
      { id: 'demo-s4', no: 'SV-2026-0017', firma: 'Örnek Firma D', durum: 'Hazırlanıyor', kalemler: [{ urun: 'Ecosky 3103', parti: 'SKY.PR.0076', ambalaj: 'IBC', adet: 4 }] },
    ];
  };

  K.demoTanimla(async (d, { kim, kaydet }) => {
    const bg = bugun();
    const on = gunEkle(bg, -30);
    kim('Kamil Gülhan');
    await kaydet([{ c: 'aralik', k: uid(), v: { bas: '00001', bit: '01000', tarih: on, notlar: 'İlk alınan klipsler' } }], on);
    await kaydet(['00001', '00002', '00003', '00004', '00005', '00006', '00007', '00009', '01000'].map((no) => ({ c: 'klips', k: uid(), v: { numara: no, ambalaj: '', durum: 'fire', tarih: on, neden: 'Klips denemelerinde ıskarta' } })), on);

    await kaydet(Array.from({ length: 10 }, (_, i) => ({ c: 'klips', k: uid(), v: { numara: String(40 + i).padStart(5, '0'), ambalaj: '', durum: 'verildi', tarih: on, neden: 'Örnek Firma’ya gönderildi' } })), on);

    /* [tür, ambalaj no, klipsler, ürün, parti, sevkiyat id, sevkiyat no, firma, gün önce] */
    const satirlar = [
      ['IBC', 'IBC 00186', ['00013', '00014'], 'Ecosky 3103', 'SKY.PR.0071', 'demo-s1', 'SV-2026-0014', 'Örnek Firma A', -12],
      ['IBC', 'IBC 00187', ['00015', '00016'], 'Ecosky 3103', 'SKY.PR.0071', 'demo-s1', 'SV-2026-0014', 'Örnek Firma A', -12],
      ['IBC', 'IBC 00188', ['00017', '00018'], 'Ecosky 3103', 'SKY.PR.0071', 'demo-s1', 'SV-2026-0014', 'Örnek Firma A', -12],
      ['IBC', 'IBC 00189', ['00019', '00020'], 'Ecosky 3103', 'SKY.PR.0071', 'demo-s1', 'SV-2026-0014', 'Örnek Firma A', -12],
      ['IBC', 'IBC 00190', ['00008', '00010'], 'Ecosky 3103', 'SKY.PR.0071', 'demo-s1', 'SV-2026-0014', 'Örnek Firma A', -12],
      ['IBC', 'IBC 00191', ['00011', '00012'], 'Ecosky 3103', 'SKY.PR.0071', 'demo-s1', 'SV-2026-0014', 'Örnek Firma A', -12],
      ['Varil', 'Varil 00041', ['00023'], 'Ecosky 3103', 'SKY.PR.0074', 'demo-s2', 'SV-2026-0015', 'Örnek Firma B', -1],
      ['Varil', 'Varil 00042', ['00024'], 'Ecosky 3103', 'SKY.PR.0074', 'demo-s2', 'SV-2026-0015', 'Örnek Firma B', -1],
    ];
    for (const [tur, no, klipsler, urun, parti, sevk, sevkNo, firma, gun] of satirlar) {
      const tarih = gunEkle(bg, gun);
      const id = uid();
      kim('Onur Özdemir');
      await kaydet([{ c: 'ambalaj', k: id, v: { tur, numara: no, urun, parti, sevk, sevkNo, firma, tarih, takan: 'Onur Özdemir', notlar: '', ekler: [] } },
        ...klipsler.map((k) => ({ c: 'klips', k: uid(), v: { numara: k, ambalaj: id, durum: 'takili', tarih, takan: 'Onur Özdemir' } }))], tarih);
    }
    /* Elle kayıttan aktarılmış gibi: tarih ve sevkiyat sonradan tamamlanacak. */
    const eksik = uid();
    kim('Kamil Gülhan');
    await kaydet([{ c: 'ambalaj', k: eksik, v: { tur: 'IBC', numara: '', urun: '', parti: '0056', tarih: '', takan: '', notlar: 'Kağıt kayıttan aktarıldı; kağıtta Material Code X110103', ekler: [] } },
      { c: 'klips', k: uid(), v: { numara: '00021', ambalaj: eksik, durum: 'takili', tarih: '' } }, { c: 'klips', k: uid(), v: { numara: '00022', ambalaj: eksik, durum: 'takili', tarih: '' } }], gunEkle(bg, -3));

    /* Gümrükte kesilip değiştirilmiş bir klips */
    const varil = d.kayitlar('ambalaj').find((a) => a.numara === 'Varil 00042');
    const eski = d.kayitlar('klips').find((k) => k.numara === '00024');
    await kaydet([{ c: 'klips', k: eski.id, v: { durum: 'degisti', yerine: '00025', neden: 'Gümrük kontrolünde kesildi', cikisTarihi: bg } },
      { c: 'klips', k: uid(), v: { numara: '00025', ambalaj: varil.id, durum: 'takili', tarih: bg, takan: 'Kamil Gülhan', eskisi: '00024' } }], bg);
  });
})();
