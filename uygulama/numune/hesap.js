/* İş kuralları: stok hesabı, alarm, kayıt numarası, WhatsApp sayım metni, eski sistemden aktarım. */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});
  const { trSirala, sayi, bugun } = NT.c;

  const AMBALAJLAR = [
    { id: '250ml', ad: '250 ml', litre: 0.25 },
    { id: '500ml', ad: '500 ml', litre: 0.5 },
    { id: '1L', ad: '1 L', litre: 1 },
    { id: '5L', ad: '5 L', litre: 5 },
    { id: '10L', ad: '10 L', litre: 10 },
    { id: '20L', ad: '20 L', litre: 20 },
  ];
  const URUNLER = [
    { ad: 'Ecosky 3103', partili: true, alarm: true, kritik: 5 },
    { ad: 'Ecosky 2801', partili: false, alarm: false, kritik: 5 },
    { ad: 'Ecophalt', partili: false, alarm: false, kritik: 5 },
    { ad: 'Ecotall', partili: false, alarm: false, kritik: 5 },
    { ad: 'Talloil pich', partili: false, alarm: false, kritik: 5 },
  ];
  const SEVK_DURUMLARI = ['Karar Aşaması', 'Beklemede', 'Etiket Bekliyor', 'Gönderildi'];
  const GONDERI_SEKILLERI = ['Kargo', 'Elden', 'Kurye'];
  /* Dolumun kaynağı (dolum kaydında kaynakTur + kaynakNo). "Numune": daha büyük bir numune şişesi küçük şişelere bölündü
     (büyük şişenin stoku kendiliğinden düşmez). */
  const DOLUM_KAYNAKLARI = [
    { id: 'IBC', ad: 'IBC', no: 'IBC no / açıklama' },
    { id: 'Varil', ad: 'Varil', no: 'Varil no / açıklama' },
    { id: 'İsotank', ad: 'İsotank', no: 'İsotank no' },
    { id: 'Numune', ad: 'Büyük numuneden', no: 'Hangi numune? (örn. 5 L, GN-2026-0012)' },
    { id: 'Diğer', ad: 'Diğer', no: 'Nereden? (örn. reaktör, tank)' },
  ];
  const dolumKaynagi = (r) => {
    const k = DOLUM_KAYNAKLARI.find((x) => x.id === r.kaynakTur);
    return k ? `${k.ad}${r.kaynakNo ? ' · ' + r.kaynakNo : ''}` : '';
  };

  /* Stoku etkileyen gönderi mi? İptal edilenler ve açılış sayımından önceki kayıtlar (gecmis: true) etkilemez. */
  const sevkEtkili = (s) => !s.gecmis && !s.iptal;
  /* Aynı firmaya yeni gönderide doldurulacak alıcı bilgileri: her alan, o alanı dolu olan en son gönderiden. */
  function firmaBilgisi(depo, firma, haricId) {
    const l = depo.kayitlar('sevk').filter((r) => r.firma === firma && r.id !== haricId)
      .sort((a, b) => (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : b._olusturma - a._olusturma));
    const al = (k) => l.find((r) => String(r[k] || '').trim())?.[k] || '';
    return { var: l.length > 0, yetkili: al('yetkili'), telefon: al('telefon'), irtibatDetay: al('irtibatDetay'), adres: al('adres'), ulke: al('ulke') };
  }
  /* Gönderilen toplam hacim (litre): adet × ambalaj litresi. */
  function sevkLitre(depo, kalemler) {
    const amb = new Map(ambalajlar(depo, { hepsi: true }).map((a) => [a.id, sayi(a.litre)]));
    return (kalemler || []).reduce((t, k) => t + sayi(k.adet) * (amb.get(k.ambalaj) || 0), 0);
  }

  /* Ülke listesi: ISO kodlarından tarayıcının Türkçe adlarıyla üretilir. Kayıtta ülkenin Türkçe adı saklanır. */
  /* ISO kodu:uluslararası telefon kodu */
  const ULKE_TEL = Object.fromEntries((
    'AD:376 AE:971 AF:93 AG:1 AL:355 AM:374 AO:244 AR:54 AT:43 AU:61 AZ:994 BA:387 BB:1 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 ' +
    'BN:673 BO:591 BR:55 BS:1 BT:975 BW:267 BY:375 BZ:501 CA:1 CD:243 CF:236 CG:242 CH:41 CI:225 CL:56 CM:237 CN:86 CO:57 CR:506 CU:53 ' +
    'CV:238 CY:357 CZ:420 DE:49 DJ:253 DK:45 DM:1 DO:1 DZ:213 EC:593 EE:372 EG:20 ER:291 ES:34 ET:251 FI:358 FJ:679 FM:691 FR:33 GA:241 ' +
    'GB:44 GD:1 GE:995 GH:233 GM:220 GN:224 GQ:240 GR:30 GT:502 GW:245 GY:592 HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 IL:972 IN:91 ' +
    'IQ:964 IR:98 IS:354 IT:39 JM:1 JO:962 JP:81 KE:254 KG:996 KH:855 KI:686 KM:269 KN:1 KP:850 KR:82 KW:965 KZ:7 LA:856 LB:961 LC:1 ' +
    'LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 LV:371 LY:218 MA:212 MC:377 MD:373 ME:382 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MR:222 MT:356 ' +
    'MU:230 MV:960 MW:265 MX:52 MY:60 MZ:258 NA:264 NE:227 NG:234 NI:505 NL:31 NO:47 NP:977 NR:674 NZ:64 OM:968 PA:507 PE:51 PG:675 PH:63 ' +
    'PK:92 PL:48 PS:970 PT:351 PW:680 PY:595 QA:974 RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65 SI:386 SK:421 SL:232 ' +
    'SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SY:963 SZ:268 TD:235 TG:228 TH:66 TJ:992 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1 TV:688 ' +
    'TW:886 TZ:255 UA:380 UG:256 US:1 UY:598 UZ:998 VA:39 VC:1 VE:58 VN:84 VU:678 WS:685 XK:383 YE:967 ZA:27 ZM:260 ZW:263'
  ).split(' ').map((x) => x.split(':')));
  const ULKE_KODLARI = Object.keys(ULKE_TEL);
  /* Aynı telefon kodunu paylaşan ülkelerde (+1, +7, +39) numaradan ülke çözülürken tercih edilen. */
  const TEL_TERCIH = { 1: 'US', 7: 'RU', 39: 'IT' };
  let ulkeAdlari;
  function tumUlkeler() {
    if (!ulkeAdlari) {
      let ad = (k) => k;
      try { const dn = new Intl.DisplayNames(['tr'], { type: 'region' }); ad = (k) => (k === 'XK' ? 'Kosova' : dn.of(k)); } catch { /* eski tarayıcı: kodlar */ }
      ulkeAdlari = [...new Set(ULKE_KODLARI.map(ad))].sort(trSirala);
    }
    return ulkeAdlari;
  }
  /* Telefon kodu seçimi için: [{ iso, ad (Türkçe), tel }] ada göre sıralı. */
  let telListesi;
  function ulkeTelefonlari() {
    if (!telListesi) {
      let ad = (k) => k;
      try { const dn = new Intl.DisplayNames(['tr'], { type: 'region' }); ad = (k) => (k === 'XK' ? 'Kosova' : dn.of(k)); } catch { /* eski tarayıcı */ }
      telListesi = ULKE_KODLARI.map((iso) => ({ iso, ad: ad(iso), tel: ULKE_TEL[iso] })).sort((a, b) => trSirala(a.ad, b.ad));
    }
    return telListesi;
  }
  /* Kayıtlı telefonu "+<kod> <numara>" olarak çözer. tercihUlke (Türkçe ad) aynı kodu paylaşan ülkelerde seçimi belirler.
     Kodsuz eski numaralarda iso boş döner, numara olduğu gibi kalır. */
  function telefonCoz(metin, tercihUlke) {
    const s = String(metin || '').trim();
    const liste = ulkeTelefonlari();
    const tercih = liste.find((u) => u.ad === tercihUlke);
    const m = /^\+\s*(\d{1,3})\s*(.*)$/.exec(s.replace(/^00/, '+'));
    if (!m) return { iso: '', numara: s };
    const rakam = (m[1] + m[2]).replace(/\D/g, '');
    for (const uz of [3, 2, 1]) {
      const kod = rakam.slice(0, uz);
      const adaylar = liste.filter((u) => u.tel === kod);
      if (!adaylar.length) continue;
      const u = adaylar.find((x) => x === tercih) || adaylar.find((x) => x.iso === TEL_TERCIH[kod]) || adaylar[0];
      // Numara kısmını kullanıcının yazdığı biçimde koru (yalnızca baştaki kodu at).
      const kalan = s.replace(/^(\+|00)\s*/, '').replace(new RegExp('^' + kod.split('').join('\\s*')), '').trim();
      return { iso: u.iso, numara: kalan };
    }
    return { iso: '', numara: s };
  }
  const telefonBirlestir = (iso, numara) => {
    const n = String(numara || '').trim();
    return !n ? '' : iso && ULKE_TEL[iso] ? `+${ULKE_TEL[iso]} ${n}` : n;
  };
  const ulkeIso = (ad) => ulkeTelefonlari().find((u) => u.ad === ad)?.iso || '';

  /* İngilizce çıktılar için: kayıtlı Türkçe ülke adı → İngilizce ad (bulunamazsa olduğu gibi). */
  let ulkeEn;
  function ulkeIngilizce(ad) {
    if (!ad) return '';
    if (!ulkeEn) {
      ulkeEn = new Map();
      try {
        const tr = new Intl.DisplayNames(['tr'], { type: 'region' }), en = new Intl.DisplayNames(['en'], { type: 'region' });
        for (const k of ULKE_KODLARI) ulkeEn.set(k === 'XK' ? 'Kosova' : tr.of(k), k === 'XK' ? 'Kosovo' : en.of(k));
      } catch { /* eski tarayıcı */ }
    }
    return ulkeEn.get(ad) || ad;
  }
  /* Açılır liste: önce Türkiye, sonra daha önce gönderilen ülkeler (en çok kullanılan önce), sonra hepsi. */
  function ulkeler(depo) {
    const say = new Map();
    for (const s of depo.kayitlar('sevk')) if (s.ulke) say.set(s.ulke, (say.get(s.ulke) || 0) + 1);
    const sik = [...say.keys()].filter((u) => u !== 'Türkiye').sort((a, b) => say.get(b) - say.get(a) || trSirala(a, b));
    return { sik: ['Türkiye', ...sik], hepsi: tumUlkeler().filter((u) => u !== 'Türkiye' && !sik.includes(u)) };
  }
  const ONEK = { alim: 'SA', dolum: 'NH', sevk: 'GN', sayim: 'SY' };

  function kisaAd(ad) {
    return String(ad).toLocaleLowerCase('tr-TR')
      .replace(/[çğıöşü]/g, (h) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[h])
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'urun';
  }
  const anahtar = (urun, parti, ambalaj) => `${urun}|${parti || ''}|${ambalaj}`;

  function ambalajlar(depo, { hepsi = false } = {}) {
    const kayitli = new Map(depo.kayitlar('ambalaj').map((r) => [r.id, r]));
    const liste = AMBALAJLAR.map((a) => ({ kritik: 5, aktif: true, ...a, ...(kayitli.get(a.id) || {}), id: a.id }));
    for (const r of kayitli.values()) if (!AMBALAJLAR.some((a) => a.id === r.id)) liste.push({ kritik: 5, aktif: true, litre: 0, ad: r.id, ...r });
    liste.sort((a, b) => sayi(a.litre) - sayi(b.litre) || trSirala(a.ad, b.ad));
    return hepsi ? liste : liste.filter((a) => a.aktif !== false);
  }
  function ambalajAdi(depo, id) {
    return ambalajlar(depo, { hepsi: true }).find((a) => a.id === id)?.ad || id;
  }

  function urunler(depo, { hepsi = false } = {}) {
    const l = depo.kayitlar('urun').filter((u) => hepsi || u.aktif !== false);
    return l.sort((a, b) => (b.partili === true) - (a.partili === true) || sayi(a.sira) - sayi(b.sira) || trSirala(a.ad, b.ad));
  }
  function urunBul(depo, ad) {
    return depo.kayitlar('urun').find((u) => u.ad === ad) || null;
  }

  async function varsayilanlariYaz(depo) {
    const ops = URUNLER.filter((u) => !urunBul(depo, u.ad)).map((u, i) => ({ c: 'urun', k: kisaAd(u.ad), v: { ...u, sira: i, aktif: true } }));
    if (ops.length) await depo.kaydet(ops);
  }

  function durum(mevcut, kritik, alarmVar = true) {
    if (!alarmVar) return mevcut < 0 ? 'eksi' : 'iyi';
    if (mevcut < 0) return 'eksi';
    if (mevcut === 0) return 'yok';
    if (mevcut < sayi(kritik)) return 'kritik';
    return 'iyi';
  }

  /* Tüm stok durumunu hareketlerden hesaplar. Stok hiçbir yerde "saklanmaz"; her zaman türetilir. */
  function stok(depo) {
    const onbellek = depo._stokOnbellek;
    if (onbellek && onbellek.surum === depo.surum) return onbellek.deger;

    const amb = ambalajlar(depo, { hepsi: true });
    const bos = new Map(amb.map((a) => [a.id, { ambalaj: a.id, alinan: 0, kullanilan: 0, duzeltme: 0, mevcut: 0, kritik: a.kritik }]));
    const bosAl = (id) => {
      if (!bos.has(id)) bos.set(id, { ambalaj: id, alinan: 0, kullanilan: 0, duzeltme: 0, mevcut: 0, kritik: 5 });
      return bos.get(id);
    };
    const dolu = new Map();
    const doluAl = (urun, parti, ambalaj) => {
      const k = anahtar(urun, parti, ambalaj);
      if (!dolu.has(k)) dolu.set(k, { anahtar: k, urun, parti: parti || '', ambalaj, doldurulan: 0, gonderilen: 0, duzeltme: 0, rezerve: 0, sonDolum: null });
      return dolu.get(k);
    };

    // Açılış sayımından (12.10.2026) önceki kayıtlar (gecmis: true) stoku etkilemez: o şişeler sayımda zaten raftaydı ya da çıkmıştı.
    for (const r of depo.kayitlar('alim')) if (!r.gecmis) bosAl(r.ambalaj).alinan += sayi(r.adet);
    for (const r of depo.kayitlar('dolum')) {
      if (r.gecmis) continue;
      bosAl(r.ambalaj).kullanilan += sayi(r.adet);
      const d = doluAl(r.urun, r.parti, r.ambalaj);
      d.doldurulan += sayi(r.adet);
      if (!d.sonDolum || r.tarih > d.sonDolum) d.sonDolum = r.tarih;
    }
    for (const s of depo.kayitlar('sevk')) {
      if (!sevkEtkili(s)) continue;
      for (const k of s.kalemler || []) {
        const d = doluAl(k.urun, k.parti, k.ambalaj);
        if (s.durum === 'Gönderildi') d.gonderilen += sayi(k.adet);
        else d.rezerve += sayi(k.adet);
      }
    }
    for (const r of depo.kayitlar('sayim')) {
      if (r.tur === 'bos') bosAl(r.ambalaj).duzeltme += sayi(r.fark);
      else doluAl(r.urun, r.parti, r.ambalaj).duzeltme += sayi(r.fark);
    }

    for (const b of bos.values()) {
      b.mevcut = b.alinan - b.kullanilan + b.duzeltme;
      b.durum = durum(b.mevcut, b.kritik);
    }
    /* Alarm ürün × ambalaj TOPLAMINA göre verilir (tüm partiler birlikte). Parti başına alarm,
       her 1-2 şişelik partiyi "kritik" gösterip uyarıyı anlamsızlaştırıyordu.
       Tek bir hücre yine de eksiye düşerse (sayım hatası) o hücre ayrıca işaretlenir. */
    const urunMap = new Map(depo.kayitlar('urun').map((u) => [u.ad, u]));
    const urunAmbalaj = new Map();
    for (const d of dolu.values()) {
      d.mevcut = d.doldurulan - d.gonderilen + d.duzeltme;
      d.kullanilabilir = d.mevcut - d.rezerve;
      d.durum = d.mevcut < 0 ? 'eksi' : 'iyi';
      const k = `${d.urun}|${d.ambalaj}`;
      if (!urunAmbalaj.has(k)) urunAmbalaj.set(k, { urun: d.urun, ambalaj: d.ambalaj, mevcut: 0, rezerve: 0, sonDolum: null });
      const t = urunAmbalaj.get(k);
      t.mevcut += d.mevcut;
      t.rezerve += d.rezerve;
      if (d.sonDolum && (!t.sonDolum || d.sonDolum > t.sonDolum)) t.sonDolum = d.sonDolum;
    }
    for (const t of urunAmbalaj.values()) {
      const u = urunMap.get(t.urun);
      t.alarm = !!u?.alarm;
      t.kritik = u?.kritik ?? 5;
      t.durum = durum(t.mevcut, t.kritik, t.alarm);
    }
    const deger = { bos, dolu, urunAmbalaj };
    depo._stokOnbellek = { surum: depo.surum, deger };
    return deger;
  }

  function bosMevcut(depo, ambalaj) {
    return stok(depo).bos.get(ambalaj)?.mevcut ?? 0;
  }
  function doluMevcut(depo, urun, parti, ambalaj) {
    return stok(depo).dolu.get(anahtar(urun, parti, ambalaj))?.mevcut ?? 0;
  }

  /* Bir sevkiyat "Gönderildi" olursa stok yeterli mi? haricId: düzenlenen sevkiyatın kendi etkisini yok say. */
  function sevkKontrol(depo, kalemler, haricId) {
    const eski = haricId ? depo.kayit('sevk', haricId) : null;
    const geriEkle = new Map();
    if (eski && !eski._silindi && sevkEtkili(eski) && eski.durum === 'Gönderildi') {
      for (const k of eski.kalemler || []) {
        const a = anahtar(k.urun, k.parti, k.ambalaj);
        geriEkle.set(a, (geriEkle.get(a) || 0) + sayi(k.adet));
      }
    }
    const istenen = new Map();
    for (const k of kalemler) {
      const a = anahtar(k.urun, k.parti, k.ambalaj);
      istenen.set(a, (istenen.get(a) || 0) + sayi(k.adet));
    }
    const eksikler = [];
    for (const [a, adet] of istenen) {
      const mevcut = (stok(depo).dolu.get(a)?.mevcut ?? 0) + (geriEkle.get(a) || 0);
      if (mevcut < adet) {
        const [urun, parti, ambalaj] = a.split('|');
        eksikler.push({ urun, parti, ambalaj, mevcut, istenen: adet });
      }
    }
    return eksikler;
  }

  function yeniNo(depo, c, tarih = bugun()) {
    const yil = tarih.slice(0, 4);
    const re = new RegExp(`^${ONEK[c]}-${yil}-(\\d+)`);
    let en = 0;
    for (const r of depo.kayitlar(c, { silinenler: true })) {
      const m = re.exec(r._asilNo || r.no || '');
      if (m) en = Math.max(en, +m[1]);
    }
    return `${ONEK[c]}-${yil}-${String(en + 1).padStart(4, '0')}`;
  }

  function partiNo(p) {
    const m = /(\d+)\s*$/.exec(p || '');
    return m ? +m[1] : -1;
  }
  function partiler(depo, urun) {
    const s = new Set();
    for (const r of depo.kayitlar('dolum')) if (r.urun === urun && r.parti) s.add(r.parti);
    for (const r of depo.kayitlar('sevk')) for (const k of r.kalemler || []) if (k.urun === urun && k.parti) s.add(k.parti);
    // Açılış sayımıyla girilen partiler de listede görünsün ve sonraki parti no'su onlara göre önerilsin.
    for (const r of depo.kayitlar('sayim')) if (r.tur !== 'bos' && r.urun === urun && r.parti) s.add(r.parti);
    return [...s].sort((a, b) => partiNo(b) - partiNo(a) || trSirala(b, a));
  }
  function sonrakiParti(depo, urun) {
    const l = partiler(depo, urun);
    const en = Math.max(0, ...l.map(partiNo));
    return `Batch #${en + 1}`;
  }

  /* Bir stok kalemi (ürün|parti|ambalaj) veya boş ambalaj için hareket defteri, yürüyen bakiye ile. */
  function defter(depo, { urun, parti, ambalaj, bos: bosMu }) {
    const h = [];
    const kayit = (c) => depo.kayitlar(c).filter((r) => !r.gecmis && !r.iptal); // açılış öncesi ve iptal edilenler bakiyeye girmez
    const ayni = (r) => r.urun === urun && (r.parti || '') === (parti || '') && r.ambalaj === ambalaj;
    if (bosMu) {
      for (const r of kayit('alim')) if (r.ambalaj === ambalaj) h.push({ tarih: r.tarih, t: r._olusturma, c: 'alim', r, adet: sayi(r.adet), aciklama: r.tedarikci || 'Satın alma' });
      for (const r of kayit('dolum')) if (r.ambalaj === ambalaj) h.push({ tarih: r.tarih, t: r._olusturma, c: 'dolum', r, adet: -sayi(r.adet), aciklama: `${r.urun}${r.parti ? ' · ' + r.parti : ''} dolumu` });
      for (const r of kayit('sayim')) if (r.tur === 'bos' && r.ambalaj === ambalaj) h.push({ tarih: r.tarih, t: r._olusturma, c: 'sayim', r, adet: sayi(r.fark), aciklama: r.neden || 'Sayım düzeltmesi' });
    } else {
      for (const r of kayit('dolum')) if (ayni(r)) h.push({ tarih: r.tarih, t: r._olusturma, c: 'dolum', r, adet: sayi(r.adet), aciklama: ['Dolum', dolumKaynagi(r), r.hazirlayan].filter(Boolean).join(' · ') });
      for (const s of kayit('sevk')) {
        const adet = (s.kalemler || []).filter(ayni).reduce((t, k) => t + sayi(k.adet), 0);
        if (adet) h.push({ tarih: s.tarih, t: s._olusturma, c: 'sevk', r: s, adet: s.durum === 'Gönderildi' ? -adet : 0, rezerve: s.durum !== 'Gönderildi' ? adet : 0, aciklama: `${s.firma} · ${s.durum}` });
      }
      for (const r of kayit('sayim')) if (r.tur !== 'bos' && ayni(r)) h.push({ tarih: r.tarih, t: r._olusturma, c: 'sayim', r, adet: sayi(r.fark), aciklama: r.neden || 'Sayım düzeltmesi' });
    }
    h.sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : a.t - b.t));
    let bakiye = 0;
    for (const x of h) { bakiye += x.adet; x.bakiye = bakiye; }
    return h.reverse();
  }

  /* Eski uygulamadaki WhatsApp sayım biçimi korunarak. */
  function whatsappMetni(depo) {
    const st = stok(depo);
    const amb = ambalajlar(depo);
    const ad = (id) => ambalajAdi(depo, id);
    const sira = new Map(amb.map((a, i) => [a.id, i]));
    let t = `📋 *GÜNCEL NUMUNE SAYIM LİSTESİ*\n_${NT.c.tarihYaz(bugun())}_\n\n*BOŞ NUMUNE KAPLARI:*\n`;
    for (const a of amb) {
      const b = st.bos.get(a.id);
      t += `• ${ad(a.id)}: ${b ? b.mevcut : 0} adet${b && b.durum === 'kritik' ? ' ⚠️' : b && b.durum !== 'iyi' ? ' ⛔' : ''}\n`;
    }
    const doluListe = [...st.dolu.values()].filter((d) => d.mevcut > 0);
    const urunSira = urunler(depo, { hepsi: true });
    const bolum = (baslik, liste, grupla) => {
      if (!liste.length) return '';
      let s = `\n---\n\n*${baslik}*\n`;
      const gruplar = new Map();
      for (const d of liste) {
        const g = grupla(d);
        if (!gruplar.has(g)) gruplar.set(g, []);
        gruplar.get(g).push(d);
      }
      for (const [g, l] of gruplar) {
        s += `• *${g}:*\n`;
        l.sort((a, b) => (sira.get(a.ambalaj) ?? 99) - (sira.get(b.ambalaj) ?? 99));
        for (const d of l) s += `   ${ad(d.ambalaj)} ➔ ${d.mevcut} adet\n`;
      }
      return s;
    };
    const partililer = urunSira.filter((u) => u.partili);
    for (const u of partililer) {
      const l = doluListe.filter((d) => d.urun === u.ad).sort((a, b) => partiNo(b.parti) - partiNo(a.parti));
      t += bolum(`${u.ad.toLocaleUpperCase('tr-TR')} (Parti Bazlı):`, l, (d) => d.parti || 'Partisiz');
    }
    const partiliAdlar = new Set(partililer.map((u) => u.ad));
    const digerleri = doluListe.filter((d) => !partiliAdlar.has(d.urun)).sort((a, b) => trSirala(a.urun, b.urun));
    t += bolum('AR-GE / DİĞER ÜRÜNLER:', digerleri, (d) => d.urun + (d.parti ? ` (${d.parti})` : ''));
    return t.trim();
  }

  /* Eski AI Studio uygulamasının numune_data.json yedeğini olaylara çevirir. Tekrar aktarılırsa kopya oluşmaz.
     gecmis: true → kayıtlar yalnızca geçmiş olarak durur, stoku değiştirmez (stok açılış sayımıyla başladığı için
     eski hareketler stoğu ikinci kez saydırırdı). */
  async function eskiVeriyiAktar(depo, veri, { gecmis = false } = {}) {
    if (!veri || !Array.isArray(veri.purchases) || !Array.isArray(veri.fillings) || !Array.isArray(veri.shipments)) {
      throw new Error('Bu dosya eski sistemin yedeği gibi görünmüyor (purchases / fillings / shipments bulunamadı).');
    }
    const isaret = gecmis ? { gecmis: true } : {};
    const parti = (p) => (!p || /^ar-?ge$/i.test(String(p).trim()) ? '' : String(p).trim());
    const ekCevir = async (dataUrl) => {
      if (!dataUrl || !String(dataUrl).startsWith('data:')) return [];
      const blob = await (await fetch(dataUrl)).blob();
      const uzanti = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      return [await depo.ekYaz(new File([blob], `etiket.${uzanti}`, { type: blob.type }))];
    };
    const ops = [];
    const urunAdlari = new Set([...(veri.knownProducts || [])]);
    const partiliAdlar = new Set();
    for (const f of veri.fillings) { urunAdlari.add(f.urunAdi); if (parti(f.batchNo)) partiliAdlar.add(f.urunAdi); }
    for (const s of veri.shipments) { urunAdlari.add(s.urunAdi); if (parti(s.batchNo)) partiliAdlar.add(s.urunAdi); }
    for (const ad of urunAdlari) {
      if (!ad || urunBul(depo, ad)) continue;
      ops.push({ c: 'urun', k: kisaAd(ad), v: { ad, partili: partiliAdlar.has(ad), alarm: ad === 'Ecosky 3103', kritik: 5, aktif: true } });
    }
    for (const p of veri.purchases) {
      ops.push({ c: 'alim', k: `eski-${p.id}`, v: { no: p.id, tarih: p.tarih, ambalaj: p.ambalajTipi, adet: sayi(p.adet), tedarikci: p.tedarikci || '', faturaNo: p.faturaNo || '', birimFiyat: p.fiyatBirim ?? '', notlar: p.notlar || '', ...isaret } });
    }
    for (const f of veri.fillings) {
      ops.push({ c: 'dolum', k: `eski-${f.id}`, v: { no: f.id, tarih: f.tarih, urun: f.urunAdi, parti: parti(f.batchNo), ambalaj: f.siseHacmi, adet: sayi(f.adet), hazirlayan: f.hazirlayan || '', notlar: f.notlar || '', ekler: await ekCevir(f.etiketGorseli), ...isaret } });
    }
    for (const s of veri.shipments) {
      ops.push({
        c: 'sevk', k: `eski-${s.id}`,
        v: {
          no: s.id, tarih: s.gonderiTarihi, firma: s.firmaAdi || '', yetkili: s.irtibatYetkilisi || '', sekil: s.gonderiSekli || 'Kargo',
          sebep: s.talepSebebi || '', durum: SEVK_DURUMLARI.includes(s.sevkiyatDurumu) ? s.sevkiyatDurumu : 'Beklemede',
          kargoFirma: s.kargoFirmasi || '', takipNo: s.takipNo || '', adres: s.teslimAdresi || '', notlar: s.notlar || '',
          kalemler: [{ urun: s.urunAdi, parti: parti(s.batchNo), ambalaj: s.ambalajTipi, adet: sayi(s.gonderilenAdet) }],
          ekler: await ekCevir(s.etiketGorseli), ...isaret,
        },
      });
    }
    if (ops.length) await depo.kaydet(ops);
    return { alim: veri.purchases.length, dolum: veri.fillings.length, sevk: veri.shipments.length };
  }

  /* Tam yedek: tüm olaylar. Geri yükleme = olayları kendi dosyana yazmak (kimlik korunur, kopya oluşmaz). */
  function yedek(depo) {
    return JSON.stringify({ uygulama: 'SKYHEM Numune Takip', format: 1, tarih: new Date().toISOString(), olaylar: depo.sirali }, null, 0);
  }
  async function yedektenYukle(depo, veri) {
    if (!veri || !Array.isArray(veri.olaylar)) throw new Error('Geçerli bir Numune Takip yedeği değil.');
    const yeni = veri.olaylar.filter((e) => !depo.olaylar.has(e.id));
    for (const e of yeni) depo.ekle(e);
    depo.bekleyen.push(...yeni);
    depo.bekleyenKaydet(depo.bekleyen);
    depo.yenidenHesapla();
    depo.bildir({});
    await depo.gonder();
    return yeni.length;
  }


  /* ---------------- Şişe (numune kabı) numaraları ve etiketleri ----------------
     Gönderi kaydında siseler: [{ no:'PR300226/3', urun, parti, ambalaj, ek:{dosya,ad,tur,boyut}|null }] (01.10.2026'da eklendi;
     eski kayıtlarda yok). Kalemler (stok) değişmez; her kalemin adet kadar "yuvası" vardır, şişeler sırayla eşlenir.
     Numara (sample no, örn. 0608261/1) serbest metindir ve kullanıcı belirler; sistem öneri üretmez (2026-10-12). */
  function siseSlotlari(kalemler, siseler = []) {
    const grup = new Map();
    for (const x of siseler || []) {
      const k = anahtar(x.urun, x.parti, x.ambalaj);
      if (!grup.has(k)) grup.set(k, []);
      grup.get(k).push(x);
    }
    return (kalemler || []).map((k) => {
      const g = grup.get(anahtar(k.urun, k.parti, k.ambalaj)) || [];
      return Array.from({ length: Math.max(0, Math.floor(sayi(k.adet))) }, () => {
        const x = g.shift();
        return { urun: k.urun, parti: k.parti || '', ambalaj: k.ambalaj, no: x?.no || '', ek: x?.ek || null };
      });
    });
  }
  /* Kaydedilecek liste: kalemlere uyan, numarası ya da etiketi olan şişeler. */
  const siseTemizle = (kalemler, siseler) => siseSlotlari(kalemler, siseler).flat()
    .map((x) => ({ ...x, no: String(x.no || '').trim() })).filter((x) => x.no || x.ek);
  function siseBul(depo, no) {
    const q = String(no || '').trim().toLocaleUpperCase('tr');
    if (!q) return null;
    for (const r of depo.kayitlar('sevk')) for (const x of r.siseler || []) if (String(x.no).trim().toLocaleUpperCase('tr') === q) return { sevk: r, sise: x };
    return null;
  }

  NT.hesap = {
    AMBALAJLAR, URUNLER, SEVK_DURUMLARI, GONDERI_SEKILLERI, DOLUM_KAYNAKLARI, dolumKaynagi, ONEK,
    kisaAd, anahtar, ambalajlar, ambalajAdi, urunler, urunBul, varsayilanlariYaz, stok, bosMevcut, doluMevcut,
    sevkKontrol, yeniNo, partiler, sonrakiParti, partiNo, defter, whatsappMetni, eskiVeriyiAktar, yedek, yedektenYukle,
    siseSlotlari, siseTemizle, siseBul, sevkEtkili, sevkLitre, firmaBilgisi, ulkeler, ulkeIngilizce, ulkeTelefonlari, telefonCoz, telefonBirlestir, ulkeIso,
  };
})(typeof window !== 'undefined' ? window : globalThis);
