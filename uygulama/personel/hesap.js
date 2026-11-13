/*
 * Personel paneli — iş kuralları (arayüzsüz). Tasarım: context/personel-paneli.md.
 *
 * Koleksiyonlar:
 *   talep     { no: TL-YYYY-NNNN, tur: 'izin' | 'malzeme' | 'ariza', sahip (ad), tarih (oluşturma günü),
 *               durum: 'bekliyor' | 'onaylandi' | 'reddedildi' | 'tamamlandi', karar: { kim, tarih, not },
 *               izin:    izinTur ('yillik' | 'mazeret' | 'raporlu' | 'ucretsiz'), bas, bit, gun, aciklama, rapor: [ek]
 *               malzeme: kalemler: [{ ad, adet }], neden, acil
 *               ariza:   yer, aciklama, foto: [ek], durdu }
 *   bildirim  { no: BD-YYYY-NNNN, tur: 'ramak' | 'oneri' | 'sikayet', isimsiz, sahip (isimsizde ''), takipKodu, tarih,
 *               metin, yer, foto: [ek], durum: 'yeni' | 'okundu' | 'onlem' | 'kapandi', cevap }
 *   kisi      { ad, iseBaslama }
 *
 * Yıllık izin hakkı (İş Kanunu 53): kıdem 1–5 yıl (5 dahil) 14 gün, 5–15 yıl 20 gün, 15 yıl ve üstü 26 gün.
 * Devreden izin ve yaş kuralı modellenmedi (İK ile doğrulanacak).
 */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});
  /* Ortak sözlük (dil.js) dondurulmuş olduğundan bu modülün İngilizcesi yanında durur: c('Türkçe', 'English'). */
  const c = (tr, en) => (NT.dil ? NT.dil.t(tr, en) : tr);
  const adi = (x, alan = 'ad') => c(x[alan], x[alan + 'En']);
  const { bugun } = NT.c;

  const TALEP_TURLERI = [
    { id: 'izin', ad: 'İzin talebi', adEn: 'Leave request', kisa: 'İzin', kisaEn: 'Leave', ikon: 'takvim' },
    { id: 'malzeme', ad: 'Malzeme isteği', adEn: 'Material request', kisa: 'Malzeme', kisaEn: 'Material', ikon: 'kutu' },
    { id: 'ariza', ad: 'Arıza bildirimi', adEn: 'Fault report', kisa: 'Arıza', kisaEn: 'Fault', ikon: 'ayar' },
  ];
  const BILDIRIM_TURLERI = [
    { id: 'ramak', ad: 'Ramak kala / tehlikeli durum', adEn: 'Near miss / hazard', kisa: 'Ramak kala', kisaEn: 'Near miss', ikon: 'uyari' },
    { id: 'oneri', ad: 'Öneri', adEn: 'Suggestion', kisa: 'Öneri', kisaEn: 'Suggestion', ikon: 'bilgi' },
    { id: 'sikayet', ad: 'Şikâyet', adEn: 'Complaint', kisa: 'Şikâyet', kisaEn: 'Complaint', ikon: 'yasak' },
  ];
  const IZIN_TURLERI = [
    { id: 'yillik', ad: 'Yıllık izin', adEn: 'Annual leave', yoklama: 'yillik' },
    { id: 'mazeret', ad: 'Mazeret izni', adEn: 'Excused leave', yoklama: 'izin' },
    { id: 'raporlu', ad: 'Raporlu', adEn: 'Sick leave', yoklama: 'rapor' },
    { id: 'ucretsiz', ad: 'Ücretsiz izin', adEn: 'Unpaid leave', yoklama: 'izin' },
  ];
  const TALEP_DURUM = {
    bekliyor: { ad: 'Onay bekliyor', adEn: 'Awaiting approval', rozet: 'kritik', ikon: 'saat' },
    onaylandi: { ad: 'Onaylandı', adEn: 'Approved', rozet: 'iyi', ikon: 'daire_tik' },
    reddedildi: { ad: 'Reddedildi', adEn: 'Declined', rozet: 'yok', ikon: 'yasak' },
    tamamlandi: { ad: 'Tamamlandı', adEn: 'Done', rozet: 'iyi', ikon: 'tik' },
  };
  const BILDIRIM_DURUM = {
    yeni: { ad: 'Yeni', adEn: 'New', rozet: 'kritik', ikon: 'saat' },
    okundu: { ad: 'Okundu', adEn: 'Read', rozet: 'bilgi', ikon: 'goz' },
    onlem: { ad: 'Önlem alındı', adEn: 'Action taken', rozet: 'iyi', ikon: 'daire_tik' },
    kapandi: { ad: 'Kapandı', adEn: 'Closed', rozet: '', ikon: 'tik' },
  };
  const bul = (liste, id) => liste.find((x) => x.id === id) || liste[0];
  const talepTuru = (id) => bul(TALEP_TURLERI, id);
  const bildirimTuru = (id) => bul(BILDIRIM_TURLERI, id);
  const izinTuru = (id) => bul(IZIN_TURLERI, id);

  /* --- tarih yardımcıları --- */
  const iki = (n) => String(n).padStart(2, '0');
  const gunEkle = (t, n) => { const d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`; };
  const isGunu = (t) => (NT.tatil ? NT.tatil.isGunu(t) : ![0, 6].includes(new Date(t + 'T12:00:00').getDay()));

  /* bas–bit arasındaki iş günü sayısı (ikisi dahil). Raporlu izin takvim günüyle sayılır (rapor gün sayısı). */
  function gunSay(bas, bit, izinTur) {
    if (!bas || !bit || bit < bas) return 0;
    let n = 0;
    for (let t = bas; t <= bit; t = gunEkle(t, 1)) if (izinTur === 'raporlu' || isGunu(t)) n++;
    return n;
  }

  /* Tam kıdem yılı (işe başlama yıldönümleri). */
  function kidemYili(iseBaslama, tarih = bugun()) {
    if (!iseBaslama) return 0;
    let y = +tarih.slice(0, 4) - +iseBaslama.slice(0, 4);
    if (tarih.slice(5) < iseBaslama.slice(5)) y--;
    return Math.max(0, y);
  }
  const yillikHak = (kidem) => (kidem < 1 ? 0 : kidem <= 5 ? 14 : kidem < 15 ? 20 : 26);
  /* İçinde bulunulan izin yılı: son yıldönümünden bir sonrakine. */
  function izinYili(iseBaslama, tarih = bugun()) {
    const k = kidemYili(iseBaslama, tarih);
    const bas = `${+iseBaslama.slice(0, 4) + k}-${iseBaslama.slice(5)}`;
    const bit = gunEkle(`${+iseBaslama.slice(0, 4) + k + 1}-${iseBaslama.slice(5)}`, -1);
    return { bas, bit, kidem: k };
  }

  const kisiler = (d) => d.kayitlar('kisi').filter((k) => k.ad).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  const kisiBul = (d, ad) => kisiler(d).find((k) => k.ad === ad);
  const talepler = (d) => d.kayitlar('talep').filter((t) => t.tur).sort((a, b) => b._olusturma - a._olusturma);
  const bildirimler = (d) => d.kayitlar('bildirim').filter((t) => t.tur).sort((a, b) => b._olusturma - a._olusturma);
  const benimTaleplerim = (d, ad) => talepler(d).filter((t) => t.sahip === ad);
  const bekleyenler = (d) => talepler(d).filter((t) => t.durum === 'bekliyor');
  const yeniBildirimler = (d) => bildirimler(d).filter((t) => t.durum === 'yeni');

  /* Kişinin bu izin yılındaki yıllık izin durumu. kullanilan: onaylanmış; bekleyen: onay bekleyen. */
  function izinDurumu(d, ad, tarih = bugun()) {
    const k = kisiBul(d, ad);
    if (!k || !k.iseBaslama) return null;
    const y = izinYili(k.iseBaslama, tarih);
    const hak = yillikHak(y.kidem);
    const yillik = benimTaleplerim(d, ad).filter((t) => t.tur === 'izin' && t.izinTur === 'yillik' && t.bas >= y.bas && t.bas <= y.bit);
    const kullanilan = yillik.filter((t) => t.durum === 'onaylandi').reduce((s, t) => s + (t.gun || 0), 0);
    const bekleyen = yillik.filter((t) => t.durum === 'bekliyor').reduce((s, t) => s + (t.gun || 0), 0);
    return { ...y, hak, kullanilan, bekleyen, kalan: hak - kullanilan };
  }

  /* Takip kodu: isimsiz bildirimi gönderen kişi yalnız bununla izler (kimlik yazılmaz). */
  function takipKodu() {
    const h = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += h[Math.floor(Math.random() * h.length)];
    return `${s.slice(0, 3)}-${s.slice(3)}`;
  }

  /* Bir talebin bir satırlık özeti (listelerde). */
  function talepOzet(t) {
    if (t.tur === 'izin') {
      const ayni = t.bas === t.bit;
      const tarih = ayni ? NT.c.tarihYaz(t.bas) : `${NT.c.tarihYaz(t.bas)} – ${NT.c.tarihYaz(t.bit)}`;
      return `${adi(izinTuru(t.izinTur))} · ${tarih} · ${t.gun || 0} ${c('gün', t.gun === 1 ? 'day' : 'days')}`;
    }
    if (t.tur === 'malzeme') return (t.kalemler || []).map((k) => `${k.ad}${k.adet ? ` × ${k.adet}` : ''}`).join(', ') || c('Malzeme', 'Material');
    return [t.yer, t.aciklama].filter(Boolean).join(' · ');
  }

  /* Yönetim kenar menüsü ve karşılama ekranı için sayaç: karar bekleyen talepler + okunmamış bildirimler. */
  const dikkatSayisi = (d) => bekleyenler(d).length + yeniBildirimler(d).length;

  NT.personel = {
    c, adi, TALEP_TURLERI, BILDIRIM_TURLERI, IZIN_TURLERI, TALEP_DURUM, BILDIRIM_DURUM, talepTuru, bildirimTuru, izinTuru,
    gunEkle, gunSay, kidemYili, yillikHak, izinYili, kisiler, kisiBul, talepler, bildirimler, benimTaleplerim, bekleyenler, yeniBildirimler,
    izinDurumu, takipKodu, talepOzet, dikkatSayisi,
  };
})(typeof window !== 'undefined' ? window : globalThis);
