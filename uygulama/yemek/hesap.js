/*
 * Yemek — iş kuralları (arayüzsüz; karşılama ekranı da özet için yükler). Öğünlerde fiyat yoktur, adet tutulur; kafe siparişlerinde tutar isteğe bağlıdır.
 *
 * Koleksiyonlar:
 *   gun      anahtar 'YYYY-MM-DD' { tarih, ogle, kahvalti, aksam (adet; boş = girilmedi), notlar, yemekYok }
 *            yemekYok: o gün yemek gelmedi (tatil, izin…) — eksik gün sayılmaz
 *   menu     anahtar 'menu-YYYY-MM-ogle|aksam' { ay, ogun, ek, en, boy, kesitler: { 'GG': [x, y, w, h] } }
 *            Desbaş'ın aylık menü resmi; her günün kutusunun resimdeki yeri (kesit)
 *   menugun  anahtar 'YYYY-MM-DD-ogle|aksam' { tarih, ogun, yemekler: [...] } — günün menüsü yazı olarak
 *   fatura   anahtar 'ay-YYYY-MM' { ay, ogle, kahvalti, aksam (Desbaş faturasındaki adetler), faturaNo, faturaTarihi, notlar, ekler }
 *   kafe     { tarih, kisiler: [...], urun, adet, tutar (₺, isteğe bağlı; siparişin toplamı), notlar, ekler (fiş) }
 *            Desbaş Kafe'den menü dışında ayrıca söylenen yemekler; öğün sayılarına karışmaz, ayrı faturalanır
 *   kafefatura anahtar 'ay-YYYY-MM' { ay, tutar, faturaNo, faturaTarihi, notlar, ekler } — ay sonu kafe faturası
 *   ayar     'genel' { eksikBaslangic, otoOgle, otoBaslangic }
 *            eksikBaslangic: bu tarihten önceki girilmemiş günler uyarı vermez (eski kayıtlar)
 *            otoOgle / otoBaslangic: bu tarihten itibaren, elle girilmeyen her iş gününe otomatik otoOgle öğle (varsayılan 9) sayılır
 *   oto      { baslangic, bitis, ogle, notlar } — geçici sayı (örn. biri yıllık izinde: o günlerde 8); çakışırsa son girilen geçerli
 * Otomatik sayılar kayıt olarak yazılmaz, hesaplanır (aynı anda açık bilgisayarlar çift kayıt üretmesin); güne elle girilen sayı her zaman önce gelir.
 */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});
  const { sayi, bugun, gunEkle } = NT.c;
  const T = NT.tatil;

  const OGUNLER = [
    { id: 'ogle', ad: 'Öğle', kisa: 'Ö', menu: true },
    { id: 'kahvalti', ad: 'Kahvaltı', kisa: 'K', menu: false },
    { id: 'aksam', ad: 'Akşam', kisa: 'A', menu: true },
  ];
  const MENULU = OGUNLER.filter((o) => o.menu);
  const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const ayAdi = (ay) => `${AY_ADLARI[+ay.slice(5, 7) - 1]} ${ay.slice(0, 4)}`;
  const gunAdi = (t) => GUN_ADLARI[new Date(t + 'T12:00:00').getDay()];
  const ayGunSayisi = (ay) => new Date(+ay.slice(0, 4), +ay.slice(5, 7), 0).getDate();
  const ayGunleri = (ay) => Array.from({ length: ayGunSayisi(ay) }, (_, i) => `${ay}-${String(i + 1).padStart(2, '0')}`);
  const ayKaydir = (ay, n) => { const d = new Date(+ay.slice(0, 4), +ay.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const menuAnahtari = (ay, ogun) => `menu-${ay}-${ogun}`;
  const menuGunAnahtari = (tarih, ogun) => `${tarih}-${ogun}`;
  const faturaAnahtari = (ay) => `ay-${ay}`;

  // Otomatik doldurma 2026-10-13'ten başlar (o güne kadar eski tablodan aktarılan gerçek sayılar var).
  const ayar = (d) => ({ eksikBaslangic: '', otoOgle: 9, otoBaslangic: '2026-10-13', ...(d.kayit('ayar', 'genel') || {}) });

  function gun(d, t) { const g = d.kayit('gun', t); return g && !g._silindi ? g : null; }
  const girildiMi = (g) => !!g && (g.yemekYok || OGUNLER.some((o) => g[o.id] !== '' && g[o.id] != null));
  const toplam = (g) => (g ? OGUNLER.reduce((t, o) => t + sayi(g[o.id]), 0) : 0);

  /* --- Otomatik doldurma --- */
  const otoKurallar = (d) => d.kayitlar('oto').filter((k) => k.baslangic && k.bitis).sort((a, b) => a._olusturma - b._olusturma);
  /* O güne düşen geçici sayı (son girilen önce gelir). */
  function otoKural(d, t) { const l = otoKurallar(d).filter((k) => k.baslangic <= t && t <= k.bitis); return l[l.length - 1] || null; }
  /* İş gününün otomatik öğle sayısı; otomatik değilse null. */
  function otoOgle(d, t, a = ayar(d)) {
    if (!T.isGunu(t) || !a.otoBaslangic || t < a.otoBaslangic) return null;
    const k = otoKural(d, t);
    if (k) return sayi(k.ogle);
    return sayi(a.otoOgle) > 0 ? sayi(a.otoOgle) : null;
  }
  /* Günün geçerli sayıları: elle girilen kayıt; öğlesi boşsa ya da hiç kayıt yoksa (bugüne kadar) otomatik sayı.
     Dönen nesnede oto: true (öğle otomatik), kural: o güne düşen geçici sayı kaydı. */
  function etkin(d, t, a = ayar(d)) {
    const g = gun(d, t);
    if (g && g.yemekYok) return g;
    const n = t <= bugun() ? otoOgle(d, t, a) : null;
    const elle = g && g.ogle !== '' && g.ogle != null;
    if (elle || n == null) return g;
    return { kahvalti: 0, aksam: 0, ...(g || {}), tarih: t, ogle: n, oto: true, kural: otoKural(d, t) };
  }
  /* Başlangıçtan itibaren n'inci iş günü (başlangıç iş günüyse o da sayılır). */
  function isGunuSonu(bas, n) {
    let t = bas, say = 0;
    for (let i = 0; i < 400; i++) { if (T.isGunu(t) && ++say >= n) return t; t = gunEkle(t, 1); }
    return t;
  }
  function isGunuSay(bas, bit) { let n = 0; for (let t = bas; t <= bit; t = gunEkle(t, 1)) if (T.isGunu(t)) n++; return n; }

  /* Eksik gün: iş günü, bugünden önce, uyarı başlangıcından sonra, hiç girilmemiş ve otomatik sayılmayan. */
  function eksikMi(d, t, a = ayar(d)) {
    return T.isGunu(t) && t < bugun() && (!a.eksikBaslangic || t >= a.eksikBaslangic) && !girildiMi(gun(d, t)) && otoOgle(d, t, a) == null;
  }
  function eksikGunler(d, ay) {
    const a = ayar(d);
    return (ay ? ayGunleri(ay) : []).filter((t) => eksikMi(d, t, a));
  }
  /* Uyarı başlangıcından bugüne kadar bütün eksik günler (karşılama ekranı ve kenar menüsü sayacı). */
  function tumEksikler(d) {
    const a = ayar(d);
    const bas = a.eksikBaslangic || gunEkle(bugun(), -31);
    const l = [];
    for (let t = bas; t < bugun(); t = gunEkle(t, 1)) if (eksikMi(d, t, a)) l.push(t);
    return l;
  }

  /* Ay özeti: öğün başına toplam adet, girilen gün sayısı, fatura karşılaştırması. */
  function ayOzet(d, ay) {
    const adet = { ogle: 0, kahvalti: 0, aksam: 0 };
    let gunSay = 0, otoGun = 0;
    const a = ayar(d);
    for (const t of ayGunleri(ay)) {
      const g = etkin(d, t, a);
      if (!g) continue;
      for (const o of OGUNLER) adet[o.id] += sayi(g[o.id]);
      if (toplam(g) > 0) gunSay++;
      if (g.oto) otoGun++;
    }
    const top = OGUNLER.reduce((t, o) => t + adet[o.id], 0);
    const f = d.kayit('fatura', faturaAnahtari(ay));
    const fatura = f && !f._silindi ? f : null;
    const girilen = fatura ? OGUNLER.filter((o) => fatura[o.id] !== '' && fatura[o.id] != null) : [];
    const fark = {};
    for (const o of girilen) fark[o.id] = sayi(fatura[o.id]) - adet[o.id];
    const kontrol = girilen.length ? (girilen.every((o) => fark[o.id] === 0) ? 'esit' : 'fark') : top > 0 ? 'bekliyor' : 'yok';
    return { ay, adet, toplam: top, gunSay, otoGun, fatura, girilen, fark, kontrol, faturaToplam: girilen.reduce((t, o) => t + sayi(fatura[o.id]), 0) };
  }
  /* Kaydı olan bütün aylar (eskiden yeniye). */
  function aylar(d) {
    const s = new Set([bugun().slice(0, 7)]);
    for (const g of d.kayitlar('gun')) if (g.tarih) s.add(g.tarih.slice(0, 7));
    for (const f of d.kayitlar('fatura')) if (f.ay) s.add(f.ay);
    return [...s].sort();
  }

  /* "Bugün" kutusunun önerisi: öğle, bu tarihten önceki son öğle girilen günden; kahvaltı ve akşam (mesai) ara sıra olduğu için 0. */
  function oneri(d, tarih) {
    const n = otoOgle(d, tarih);
    if (n != null) return { tarih: '', ogle: n, kahvalti: 0, aksam: 0, oto: true, kural: otoKural(d, tarih) };
    const l = d.kayitlar('gun').filter((g) => g.tarih && g.tarih < tarih && sayi(g.ogle) > 0).sort((a, b) => (a.tarih < b.tarih ? 1 : -1));
    const g = l[0];
    return { tarih: g ? g.tarih : '', ogle: g ? sayi(g.ogle) : 0, kahvalti: 0, aksam: 0 };
  }

  /* Menü */
  function menu(d, ay, ogun) { const m = d.kayit('menu', menuAnahtari(ay, ogun)); return m && !m._silindi ? m : null; }
  function menuGun(d, tarih, ogun) { const m = d.kayit('menugun', menuGunAnahtari(tarih, ogun)); return m && !m._silindi ? m : null; }
  const yemekler = (d, tarih, ogun) => (menuGun(d, tarih, ogun)?.yemekler || []).filter(Boolean);
  function kesit(d, tarih, ogun) {
    const m = menu(d, tarih.slice(0, 7), ogun);
    const k = m && m.kesitler && m.kesitler[tarih.slice(8, 10)];
    return k ? { menu: m, kutu: k } : null;
  }
  /* Bir sonraki iş gününün tarihi (yarının menüsü için). */
  function sonrakiIsGunu(t) { let x = gunEkle(t, 1); for (let i = 0; i < 10 && !T.isGunu(x); i++) x = gunEkle(x, 1); return x; }

  /* --- Desbaş Kafe: menü dışı, kişilerin ayrıca söylediği yemekler (ayrı faturalanır) --- */
  const kafeler = (d, onEk) => d.kayitlar('kafe').filter((k) => k.tarih && k.tarih.startsWith(onEk))
    .sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : a._olusturma - b._olusturma));
  const tutarVar = (k) => k.tutar !== '' && k.tutar != null;
  function kafeOzet(d, ay) {
    const l = kafeler(d, ay);
    const kisi = new Map();
    let adet = 0, tutar = 0, tutarsiz = 0;
    for (const k of l) {
      adet += sayi(k.adet);
      if (tutarVar(k)) tutar += sayi(k.tutar); else tutarsiz++;
      const kisiler = (k.kisiler || []).length ? k.kisiler : ['(belirtilmemiş)'];
      for (const ad of kisiler) {
        const x = kisi.get(ad) || { ad, siparis: 0, adet: 0, tutar: 0 };
        x.siparis++; x.adet += sayi(k.adet) / kisiler.length; if (tutarVar(k)) x.tutar += sayi(k.tutar) / kisiler.length;
        kisi.set(ad, x);
      }
    }
    const f = d.kayit('kafefatura', faturaAnahtari(ay));
    const fatura = f && !f._silindi ? f : null;
    const faturaVar = !!(fatura && tutarVar(fatura));
    const fark = faturaVar ? sayi(fatura.tutar) - tutar : 0;
    const kontrol = faturaVar ? (Math.abs(fark) < 0.01 ? 'esit' : 'fark') : l.length ? 'bekliyor' : 'yok';
    return { ay, liste: l, siparis: l.length, adet, tutar, tutarsiz, kisiler: [...kisi.values()].sort((a, b) => b.tutar - a.tutar || b.adet - a.adet), fatura, faturaVar, fark, kontrol };
  }
  /* Öneriler: daha önce yazılan kişi adları ve kafe ürünleri (en çok kullanılan önce). */
  function kafeOnerileri(d) {
    const kisi = new Map(), urun = new Map();
    for (const k of d.kayitlar('kafe')) {
      for (const ad of k.kisiler || []) kisi.set(ad, (kisi.get(ad) || 0) + 1);
      if (k.urun) urun.set(k.urun, (urun.get(k.urun) || 0) + 1);
    }
    const sirala = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    return { kisiler: sirala(kisi), urunler: sirala(urun) };
  }
  /* Aynı ürünün en son girilen birim fiyatı (tutar / adet) — yeni siparişte öneri için. */
  function kafeBirimFiyat(d, urun) {
    const a = String(urun || '').trim().toLocaleLowerCase('tr');
    if (!a) return 0;
    const l = d.kayitlar('kafe').filter((k) => tutarVar(k) && sayi(k.adet) > 0 && String(k.urun || '').trim().toLocaleLowerCase('tr') === a).sort((x, y) => y._olusturma - x._olusturma);
    return l[0] ? sayi(l[0].tutar) / sayi(l[0].adet) : 0;
  }

  /* Karşılama ekranı kartı için kısa özet. */
  /* Karşılama ekranındaki "dikkat bekleyenler" şeridi; kurallar kenar menüsündeki Takvim ve Faturalar sayaçlarıyla aynıdır. */
  function dikkat(d) {
    const eksik = tumEksikler(d).length;
    const gecen = ayOzet(d, ayKaydir(bugun().slice(0, 7), -1));
    const fark = d.kayitlar('fatura').filter((f) => ayOzet(d, f.ay).kontrol === 'fark').length;
    return [eksik && { metin: `${eksik} günün yemek sayısı girilmedi`, sekme: 'takvim' },
      gecen.kontrol === 'bekliyor' && { metin: `${ayAdi(gecen.ay)} yemek faturası girilmedi`, sekme: 'faturalar' },
      fark && { metin: `${fark} ayda yemek faturası farkı`, sekme: 'faturalar' }].filter(Boolean);
  }

  function ozet(d) {
    const bg = bugun();
    const g = etkin(d, bg);
    const ilk = g && g.oto ? `Bugün ${sayi(g.ogle)} öğle (otomatik)` : !girildiMi(g) ? (T.isGunu(bg) ? 'Bugün henüz girilmedi' : `Bugün ${T.tatil(bg) || 'hafta sonu'}`)
      : g.yemekYok ? 'Bugün yemek yok' : `Bugün ${OGUNLER.filter((o) => sayi(g[o.id]) > 0).map((o) => `${sayi(g[o.id])} ${o.ad.toLocaleLowerCase('tr')}`).join(' · ')}`;
    const ay = ayOzet(d, bg.slice(0, 7));
    const eksik = tumEksikler(d).length;
    const ogleMenu = yemekler(d, bg, 'ogle');
    const kafe = kafeler(d, bg.slice(0, 7)).length;
    return [ilk, [`Bu ay ${ay.toplam} öğün`, kafe && `${kafe} kafe siparişi`, eksik && `${eksik} gün girilmedi`, ogleMenu.length && `Öğle: ${ogleMenu.slice(0, 2).join(', ')}`].filter(Boolean).join(' · ')];
  }

  NT.yemek = { otoKurallar, otoKural, otoOgle, etkin, isGunuSonu, isGunuSay, OGUNLER, MENULU, AY_ADLARI, ayAdi, gunAdi, ayGunSayisi, ayGunleri, ayKaydir, menuAnahtari, menuGunAnahtari, faturaAnahtari, ayar, gun, girildiMi, toplam, eksikMi, eksikGunler, tumEksikler, ayOzet, aylar, oneri, menu, menuGun, yemekler, kesit, sonrakiIsGunu, kafeler, kafeOzet, kafeOnerileri, kafeBirimFiyat, ozet, dikkat };
})(typeof window !== 'undefined' ? window : globalThis);
