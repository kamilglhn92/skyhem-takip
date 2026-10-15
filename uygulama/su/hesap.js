/*
 * İçme Suyu — iş kuralları (arayüzsüz; karşılama ekranı da özet için yükler).
 *
 * Koleksiyonlar:
 *   siparis  { no: SU-YYYY-NNNN, tarih, damacana, bardak (istenen adet; bardak = koli), notlar,
 *              iptal, iptalNeden, iptalTarihi, kapandi, kapanisNot }   — kapandi: kalanı gelmeyecek, sipariş kapatıldı
 *   teslim   { siparis (id), tarih, damacana, bardak, notlar }         — bir sipariş birden fazla teslimatla (kısmi) gelebilir
 *   fiyat    { tarih (geçerlilik başlangıcı), damacana, bardak, kdv (%), aciklama }
 *   fatura   { ay: 'YYYY-MM', tutar, faturaNo, faturaTarihi, notlar, ekler } — anahtar 'ay-YYYY-MM' (aynı ay tek kayıt)
 *   ayar     'genel' { tedarikci, telefon, mesaj, koliBardak, bardakMl, damacanaL }
 *
 * Fiyat, siparişin tarihindeki fiyat listesinden alınır (zam eski siparişleri değiştirmez).
 * Tutar teslim edilen adetle hesaplanır ve teslim tarihinin ayına (fatura dönemine) yazılır.
 */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});
  const { sayi, bugun } = NT.c;

  const URUNLER = [
    { id: 'damacana', ad: 'Damacana', birim: 'damacana', excel: 'DAMACANA' },
    { id: 'bardak', ad: 'Bardak su', birim: 'koli', excel: 'BARDAK KOLİ' },
  ];
  const VARSAYILAN = {
    tedarikci: '', telefon: '', koliBardak: 60, bardakMl: 200, damacanaL: 19,
    mesaj: 'Merhaba, SKYHEM Kimya için {liste} rica ediyoruz. Teşekkürler.',
  };
  const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const ayAdi = (ay) => `${AY_ADLARI[+ay.slice(5, 7) - 1]} ${ay.slice(0, 4)}`;
  const faturaAnahtari = (ay) => `ay-${ay}`;

  function ayar(d) {
    const a = d.kayit('ayar', 'genel') || {};
    const r = { ...VARSAYILAN };
    for (const k of Object.keys(VARSAYILAN)) if (a[k] !== undefined && a[k] !== '') r[k] = a[k];
    return r;
  }

  /* Bir litre hesabı: damacana × damacanaL; bardak koli × koli içi bardak × bardak ml. */
  function litre(d, x, a = ayar(d)) {
    return sayi(x.damacana) * sayi(a.damacanaL) + (sayi(x.bardak) * sayi(a.koliBardak) * sayi(a.bardakMl)) / 1000;
  }

  /* Tarihteki geçerli fiyat: geçerlilik tarihi bu tarihe eşit veya önce olan en son kayıt.
     Tarihten önce hiç fiyat yoksa en eski fiyat kullanılır (fiyat hiç girilmemişse sıfır). */
  function fiyatlar(d) {
    return d.kayitlar('fiyat').filter((f) => f.tarih).sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : a._olusturma - b._olusturma));
  }
  function fiyatBul(d, tarih, liste = fiyatlar(d)) {
    let f = null;
    for (const x of liste) if (x.tarih <= tarih) f = x;
    return f || liste[0] || null;
  }

  /* Siparişin teslimatları (silinmemiş), tarih sırasıyla. */
  function teslimler(d, s) {
    return d.kayitlar('teslim').filter((t) => t.siparis === s.id).sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : a._olusturma - b._olusturma));
  }
  /* Sipariş durumu: Bekliyor → Kısmi geldi → Geldi; ayrıca İptal ve Kapatıldı (kalanı gelmeyecek). */
  function durum(d, s) {
    const tl = teslimler(d, s);
    const gelen = { damacana: 0, bardak: 0 };
    for (const t of tl) for (const u of URUNLER) gelen[u.id] += sayi(t[u.id]);
    const kalan = {};
    for (const u of URUNLER) kalan[u.id] = Math.max(0, sayi(s[u.id]) - gelen[u.id]);
    const kalanVar = URUNLER.some((u) => kalan[u.id] > 0);
    const ad = s.iptal ? 'İptal' : !kalanVar ? 'Geldi' : s.kapandi ? 'Kapatıldı' : tl.length ? 'Kısmi geldi' : 'Bekliyor';
    return { ad, gelen, kalan, kalanVar, teslimler: tl, acik: ad === 'Bekliyor' || ad === 'Kısmi geldi', son: tl.length ? tl[tl.length - 1].tarih : '' };
  }
  const acikMi = (d, s) => durum(d, s).acik;

  /* Bir teslimatın tutarı (sipariş tarihindeki fiyatla). */
  function teslimTutar(d, t, liste = fiyatlar(d)) {
    const s = d.kayit('siparis', t.siparis);
    const f = fiyatBul(d, (s && s.tarih) || t.tarih, liste);
    const kalem = {};
    let haric = 0;
    for (const u of URUNLER) { kalem[u.id] = sayi(t[u.id]) * sayi(f && f[u.id]); haric += kalem[u.id]; }
    const kdv = (haric * sayi(f && f.kdv)) / 100;
    return { fiyat: f, kalem, haric, kdv, toplam: haric + kdv };
  }
  /* Hesaba girecek teslimatlar: siparişi silinmemiş ve iptal edilmemiş olanlar. */
  function gecerliTeslimler(d) {
    return d.kayitlar('teslim').filter((t) => { const s = d.kayit('siparis', t.siparis); return s && !s._silindi && !s.iptal && t.tarih; });
  }

  /* Ay ay döküm: teslim tarihine göre adet, tutar, litre; o ayın faturasıyla karşılaştırma. */
  function aylar(d) {
    const a = ayar(d);
    const liste = fiyatlar(d);
    const m = new Map();
    const al = (ay) => {
      if (!m.has(ay)) m.set(ay, { ay, adet: { damacana: 0, bardak: 0 }, tutar: { damacana: 0, bardak: 0 }, haric: 0, kdv: 0, toplam: 0, litre: 0, teslimler: [], fatura: null });
      return m.get(ay);
    };
    for (const t of gecerliTeslimler(d)) {
      const x = al(t.tarih.slice(0, 7));
      const h = teslimTutar(d, t, liste);
      for (const u of URUNLER) { x.adet[u.id] += sayi(t[u.id]); x.tutar[u.id] += h.kalem[u.id]; }
      x.haric += h.haric; x.kdv += h.kdv; x.toplam += h.toplam; x.litre += litre(d, t, a);
      x.teslimler.push(t);
    }
    for (const f of d.kayitlar('fatura')) if (f.ay) al(f.ay).fatura = f;
    return [...m.values()].sort((x, y) => (x.ay < y.ay ? -1 : 1)).map((x) => {
      const faturaVar = !!(x.fatura && x.fatura.tutar !== '' && x.fatura.tutar != null);
      const fark = faturaVar ? sayi(x.fatura.tutar) - x.toplam : 0;
      const kontrol = faturaVar ? (Math.abs(fark) < 0.01 ? 'esit' : 'fark') : x.toplam > 0 ? 'bekliyor' : 'yok';
      return { ...x, faturaVar, fark, kontrol };
    });
  }
  /* Aylık dökümü verilen yıl için ay ay tamamlar (ilk hareketten bu aya kadar, aradaki boş aylar dahil). */
  function yilAylari(d, yil, liste = aylar(d)) {
    const bg = bugun().slice(0, 7);
    const ilk = liste.length ? liste[0].ay : bg;
    const sonuc = [];
    let kum = 0;
    for (let i = 1; i <= 12; i++) {
      const ay = `${yil}-${String(i).padStart(2, '0')}`;
      const x = liste.find((y) => y.ay === ay);
      if (!x && (ay < ilk || ay > bg)) continue;
      const r = x || { ay, adet: { damacana: 0, bardak: 0 }, tutar: { damacana: 0, bardak: 0 }, haric: 0, kdv: 0, toplam: 0, litre: 0, teslimler: [], fatura: null, faturaVar: false, fark: 0, kontrol: 'yok' };
      kum += r.litre;
      sonuc.push({ ...r, kumulatif: kum });
    }
    return sonuc;
  }
  /* Son 12 ayın litresi (grafik). */
  function aylikLitre(d, bitis = bugun()) {
    const liste = aylar(d);
    const sonuc = [];
    let y = +bitis.slice(0, 4), a = +bitis.slice(5, 7);
    for (let i = 0; i < 12; i++) {
      const ay = `${y}-${String(a).padStart(2, '0')}`;
      const x = liste.find((z) => z.ay === ay);
      sonuc.unshift({ ay, litre: x ? x.litre : 0, toplam: x ? x.toplam : 0 });
      if (--a === 0) { a = 12; y--; }
    }
    return sonuc;
  }

  /* Siparişin metin hâli: "10 damacana ve 8 koli bardak su" */
  function liste(x) {
    const p = [];
    if (sayi(x.damacana) > 0) p.push(`${sayi(x.damacana)} damacana`);
    if (sayi(x.bardak) > 0) p.push(`${sayi(x.bardak)} koli bardak su`);
    return p.join(' ve ');
  }
  function whatsappMetni(d, x) {
    return String(ayar(d).mesaj || VARSAYILAN.mesaj).replace(/\{liste\}/g, liste(x) || '…');
  }
  /* wa.me bağlantısı: numara varsa doğrudan o kişiye (Türkiye: 0 ile başlayan numara 90'a çevrilir). */
  function whatsappAdresi(d, metin) {
    let tel = String(ayar(d).telefon || '').replace(/\D/g, '');
    if (tel.startsWith('0')) tel = '90' + tel.slice(1);
    else if (tel.length === 10 && tel.startsWith('5')) tel = '90' + tel;
    return `https://wa.me/${tel}?text=${encodeURIComponent(metin)}`;
  }

  /* Yeni sipariş penceresinde önerilecek adetler: son siparişteki adetler; hiç yoksa 10 + 10. */
  function sonAdetler(d) {
    const s = d.kayitlar('siparis').filter((x) => !x.iptal).sort((a, b) => (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : b._olusturma - a._olusturma))[0];
    return s ? { damacana: sayi(s.damacana), bardak: sayi(s.bardak) } : { damacana: 10, bardak: 10 };
  }

  /* Karşılama ekranı kartı için kısa özet. */
  function ozet(d) {
    const bg = bugun().slice(0, 7);
    const l = aylar(d);
    const buAy = l.find((x) => x.ay === bg);
    const acik = d.kayitlar('siparis').filter((s) => acikMi(d, s)).length;
    const faturaBekleyen = l.filter((x) => x.kontrol === 'bekliyor' && x.ay < bg).length;
    const fark = l.filter((x) => x.kontrol === 'fark').length;
    return [
      `Bu ay ${Math.round(buAy ? buAy.litre : 0).toLocaleString('tr-TR')} L su geldi`,
      [acik ? `${acik} sipariş bekleniyor` : 'Bekleyen sipariş yok', faturaBekleyen && `${faturaBekleyen} ayın faturası girilmedi`, fark && `${fark} ayda fatura farkı`].filter(Boolean).join(' · '),
    ];
  }

  /* Karşılama ekranındaki "dikkat bekleyenler" şeridi; kural kenar menüsündeki Faturalar sayacıyla aynıdır. */
  function dikkat(d) {
    const bg = bugun().slice(0, 7);
    const l = aylar(d);
    const bekleyen = l.filter((x) => x.kontrol === 'bekliyor' && x.ay < bg).length;
    const fark = l.filter((x) => x.kontrol === 'fark').length;
    return [bekleyen && { metin: `${bekleyen} ayın su faturası girilmedi`, sekme: 'faturalar' },
      fark && { metin: `${fark} ayda su faturası farkı`, sekme: 'faturalar' }].filter(Boolean);
  }

  NT.su = { URUNLER, VARSAYILAN, AY_ADLARI, ayAdi, faturaAnahtari, ayar, litre, fiyatlar, fiyatBul, teslimler, durum, acikMi, teslimTutar, gecerliTeslimler, aylar, yilAylari, aylikLitre, liste, whatsappMetni, whatsappAdresi, sonAdetler, ozet, dikkat };
})(typeof window !== 'undefined' ? window : globalThis);
