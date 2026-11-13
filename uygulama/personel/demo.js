/* Personel paneli — sunum modu (?demo): örnek kişiler ve talepler. Kişi adları UYDURMADIR (bu dosya herkese açık depoda yayınlanır). */
(function () {
  'use strict';
  const NT = window.NT;
  const { uid, bugun } = NT.c;
  const K = NT.kabuk;
  const P = NT.personel;

  NT.personelDemo = { PERSONEL: 'Ahmet Kaya' };

  K.demoTanimla(async (d, { kim, kaydet }) => {
    const bg = bugun();
    const g = (n) => P.gunEkle(bg, n);
    /* Bir sonraki iş günü (n'inci) — izin aralıkları hafta sonuna düşmesin. */
    const isg = (n) => { let t = bg, k = 0; while (k < n) { t = P.gunEkle(t, 1); if (NT.tatil.isGunu(t)) k++; } return t; };

    kim('Kamil Gülhan');
    const kisiler = [['Ahmet Kaya', P.gunEkle(bg, -(365 * 3 + 40))], ['Mehmet Demir', P.gunEkle(bg, -(365 * 7 + 100))], ['Ali Şahin', P.gunEkle(bg, -(365 + 200))],
      ['Hasan Çelik', P.gunEkle(bg, -(365 * 16 + 10))], ['Kamil Gülhan', P.gunEkle(bg, -(365 * 4))], ['Farukcan Bey', P.gunEkle(bg, -(365 * 6))]];
    for (const [ad, iseBaslama] of kisiler) await kaydet([{ c: 'kisi', k: uid(), v: { ad, iseBaslama } }], g(-200));

    const talep = async (sahip, gun, v, karar) => {
      kim(sahip);
      const no = K.yeniNo(d, 'talep', 'TL', g(gun));
      const k = uid();
      await kaydet([{ c: 'talep', k, v: { no, sahip, tarih: g(gun), durum: 'bekliyor', ...v } }], g(gun));
      if (karar) {
        kim(karar.kim);
        await kaydet([{ c: 'talep', k, v: { no, sahip, tarih: g(gun), ...v, durum: karar.durum, karar: { kim: karar.kim, tarih: g(gun + 1), not: karar.not || '' } } }], g(gun + 1));
      }
    };
    const izin = (izinTur, bas, bit, aciklama) => ({ tur: 'izin', izinTur, bas, bit, gun: P.gunSay(bas, bit, izinTur), aciklama, rapor: [] });

    /* Ahmet Kaya (telefon görünümündeki kişi): bir onaylı, bir bekleyen izin; onaylı ve bekleyen malzeme. */
    await talep('Ahmet Kaya', -35, izin('yillik', g(-30), g(-26), 'Memleket ziyareti'), { kim: 'Farukcan Bey', durum: 'onaylandi' });
    await talep('Ahmet Kaya', -9, { tur: 'malzeme', kalemler: [{ ad: 'Nitril eldiven (L)', adet: 2 }, { ad: 'Koruyucu gözlük', adet: 1 }], neden: 'Eldivenler yırtıldı', acil: false }, { kim: 'Kamil Gülhan', durum: 'onaylandi', not: 'Depodan alınabilir' });
    await talep('Ahmet Kaya', -1, izin('yillik', isg(6), isg(8), 'Düğün'));

    /* Diğerleri: yönetim ekranında bekleyenler. */
    await talep('Mehmet Demir', -2, izin('mazeret', isg(2), isg(2), 'Çocuğumun okul toplantısı'));
    await talep('Ali Şahin', -1, { tur: 'malzeme', kalemler: [{ ad: 'İş ayakkabısı (43)', adet: 1 }], neden: 'Tabanı delindi', acil: true });
    await talep('Hasan Çelik', 0, { tur: 'ariza', yer: 'Dolum alanı', aciklama: 'Varil pompası hortum bağlantısından damlatıyor.', foto: [], durdu: false });
    await talep('Mehmet Demir', -20, izin('raporlu', g(-18), g(-17), ''), { kim: 'Farukcan Bey', durum: 'onaylandi' });
    await talep('Ali Şahin', -30, { tur: 'malzeme', kalemler: [{ ad: 'Akülü matkap', adet: 1 }], neden: 'Atölye için', acil: false }, { kim: 'Kamil Gülhan', durum: 'reddedildi', not: 'Mevcut matkap tamirde, bu hafta dönüyor' });

    /* Bildirimler: isimsiz ramak kala (kimlik yok), adlı öneri. */
    kim('İsimsiz');
    await kaydet([{ c: 'bildirim', k: uid(), v: { no: K.yeniNo(d, 'bildirim', 'BD', g(-1)), tur: 'ramak', isimsiz: true, sahip: '', takipKodu: 'KMP-4R7', tarih: g(-1),
      metin: 'Forklift yolunda dökülmüş yağ vardı, az kalsın kayıyordum. Temizlendi ama kaynağı belli değil.', yer: 'Depo girişi', foto: [], durum: 'yeni' } }], g(-1));
    kim('Ali Şahin');
    await kaydet([{ c: 'bildirim', k: uid(), v: { no: K.yeniNo(d, 'bildirim', 'BD', g(-12)), tur: 'oneri', isimsiz: false, sahip: 'Ali Şahin', takipKodu: P.takipKodu(), tarih: g(-12),
      metin: 'Dolum alanına ikinci bir göz duşu konulabilir; mevcut olan uzak kalıyor.', yer: 'Dolum alanı', foto: [], durum: 'onlem', cevap: 'Sipariş verildi, ay sonuna kadar takılacak.' } }], g(-12));
  });
})();
