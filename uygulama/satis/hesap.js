/*
 * Satış Takip — iş kuralları (arayüzsüz; karşılama ekranı da özet için yükler).
 *
 * Koleksiyonlar:
 *   sevk     { no: SV-YYYY-NNNN, durum, iptal, musteri (id), firma, ulke, adres, yetkili,
 *              siparisTarihi, sevkTarihi, teslimTarihi,
 *              kalemler: [{ urun, parti, ambalaj, adet, brut, dara, net,
 *                           karisim: [{ parti, kg }]   — birden fazla partinin karışımı (parti = "Batch #3 + Batch #20")
 *                           coaBelge, coaTarihi, belgeler (etiket vb.) — kalemin kendi belgeleri }],
 *              irsaliyeBelge, faturaBelge, kontrolFormu, kantarFisleri, packingList, aracFoto (dosya listeleri),
 *              plaka, sofor, konteyner, birimFiyat, paraBirimi, notlar, ekler,
 *              coaNo, coaTarihi, coaBelge, irsaliyeNo, faturaNo — eski kayıtlarda sevkiyat geneli (bütün kalemler için geçerli) }
 *   musteri  { ad, ulke, adres, yetkili, unvan, telefon, eposta, notlar }  — sevkiyatta yeni yazılan firma kendiliğinden eklenir
 *   parti    { urun, parti, uretimTarihi, notlar }  — isteğe bağlı bilgi (eski kayıtlarda uretimKg de var; kullanılmaz: stok tutulmaz)
 * Satış, sevkiyat "Yolda" olduğu andan itibaren rapora girer (sevkTarihi).
 */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});
  const { sayi, trSirala, kucuk, bugun } = NT.c;

  const DURUMLAR = ['Sipariş', 'Hazırlanıyor', 'Yolda', 'Teslim edildi'];
  const AMBALAJLAR = [
    { id: 'IBC', ad: 'IBC', dara: 57 },
    { id: 'Varil', ad: 'Varil', dara: 26 },
    { id: 'İsotank', ad: 'İsotank', dara: 0 },
    { id: 'Dökme', ad: 'Dökme (tanker)', dara: 0 },
  ];
  const URUNLER = ['Ecosky 3103', 'Ecosky 2108', 'Ecophalt', 'Ecotall'];
  const PARA = ['₺', '€', '$'];

  const ad = (s) => kucuk(String(s || '').replace(/\s+/g, ' ').trim());
  const satildi = (s) => !s.iptal && (s.durum === 'Yolda' || s.durum === 'Teslim edildi');
  const aktif = (s) => !s.iptal && s.durum !== 'Teslim edildi';
  const kalemNet = (k) => {
    const brut = sayi(k.brut), dara = sayi(k.dara);
    return brut > 0 ? Math.max(0, brut - dara) : sayi(k.net);
  };
  const sevkNet = (s) => (s.kalemler || []).reduce((t, k) => t + kalemNet(k), 0);
  const sevkTarihi = (s) => s.sevkTarihi || s.siparisTarihi || '';
  const tutar = (s) => (sayi(s.birimFiyat) > 0 ? sevkNet(s) * sayi(s.birimFiyat) : 0);

  /* Sevkiyat belgeleri. Packing list yalnızca yurtdışı satışta beklenir. Eski kayıtlarda belge yerine yazılmış
     numara (coaNo, irsaliyeNo, faturaNo) varsa o belge var sayılır. */
  const yurtdisi = (s) => !!String(s.ulke || '').trim() && kucuk(s.ulke.trim()) !== kucuk('Türkiye');
  // Sevkiyatın ortak belgeleri (CoA her kalemin kendisindedir).
  const BELGELER = [
    { alan: 'irsaliyeBelge', ad: 'İrsaliye', eski: 'irsaliyeNo' },
    { alan: 'faturaBelge', ad: 'Fatura', eski: 'faturaNo' },
    { alan: 'kontrolFormu', ad: 'Sevkiyat kontrol formu' },
    { alan: 'kantarFisleri', ad: 'Kantar fişi' },
    { alan: 'packingList', ad: 'Packing list', yurtdisi: true },
  ];
  const belgeVar = (s, b) => (Array.isArray(s[b.alan]) && s[b.alan].length > 0) || (b.eski && !!String(s[b.eski] || '').trim());
  /* Eski kayıtlarda sevkiyat geneline girilmiş CoA (no ya da belge) bütün kalemler için geçerli sayılır. */
  const eskiCoa = (s) => !!String(s.coaNo || '').trim() || (s.coaBelge || []).length > 0;
  const kalemCoaVar = (s, k) => (k.coaBelge || []).length > 0 || eskiCoa(s);
  const kalemAdi = (k) => `${k.adet} × ${k.ambalaj} ${k.urun}${k.parti ? ' ' + k.parti : ''}`;
  /* Kaydetmeden önce hatırlatılacak eksikler (zorunlu değil). */
  function eksikler(s) {
    const l = [];
    const kalemler = s.kalemler || [];
    kalemler.forEach((k, i) => {
      if (!kalemCoaVar(s, k)) l.push(kalemler.length > 1 ? `CoA — ${i + 1}. kalem (${kalemAdi(k)})` : 'CoA belgesi');
    });
    if (!(s.aracFoto || []).length) l.push('Araç fotoğrafı');
    if (!String(s.plaka || '').trim()) l.push('Araç plakası');
    if (!String(s.sofor || '').trim()) l.push('Şoför adı');
    for (const b of BELGELER) if ((!b.yurtdisi || yurtdisi(s)) && !belgeVar(s, b)) l.push(b.ad);
    return l;
  }

  /* Karışım: bir kalem birden fazla partiden olabilir (örn. 1 IBC = 600 kg Batch #3 + 350 kg Batch #20).
     Kalemin neti partilere dağıtılır: kg yazılan partiye o kadar, kalanı kg yazılmayanlara eşit bölünür. */
  const karisimMi = (k) => (k.karisim || []).filter((p) => String(p.parti || '').trim()).length > 1;
  function kalemPartileri(k) {
    const net = kalemNet(k);
    if (!karisimMi(k)) return [{ parti: k.parti || '', net }];
    const l = k.karisim.filter((p) => String(p.parti || '').trim());
    const yazilan = l.reduce((t, p) => t + sayi(p.kg), 0);
    const bos = l.filter((p) => !(sayi(p.kg) > 0)).length;
    const pay = bos ? Math.max(0, net - yazilan) / bos : 0;
    return l.map((p) => ({ parti: String(p.parti).trim(), net: sayi(p.kg) > 0 ? sayi(p.kg) : pay }));
  }
  const karisimAdi = (karisim) => karisim.map((p) => String(p.parti || '').trim()).filter(Boolean).join(' + ');
  /* Partinin yazılışı; kgIle: karışımda her partinin kg'ı da yazılır. */
  const partiYazi = (k, kgIle) => (karisimMi(k)
    ? kalemPartileri(k).map((p) => (kgIle ? `${p.parti} (${Math.round(p.net).toLocaleString('tr-TR')} kg)` : p.parti)).join(' + ')
    : k.parti || '');
  /* Hatırlatma yalnızca araç yola çıkarken / çıktıktan sonra yapılır; siparişte belgeler henüz olmaz. */
  const belgeZamani = (s) => !s.iptal && (s.durum === 'Yolda' || s.durum === 'Teslim edildi');

  function musteriBul(d, firma) {
    const a = ad(firma);
    return a ? d.kayitlar('musteri').find((m) => ad(m.ad) === a) || null : null;
  }
  /* Müşteri hafızası: yazılana göre öneriler (önce en çok sevkiyat yapılanlar). */
  function musteriOnerileri(d, q) {
    const say = new Map();
    for (const s of d.kayitlar('sevk')) if (s.musteri) say.set(s.musteri, (say.get(s.musteri) || 0) + 1);
    const a = ad(q);
    return d.kayitlar('musteri')
      .filter((m) => !a || ad(m.ad).includes(a) || ad(m.yetkili).includes(a))
      .sort((x, y) => (say.get(y.id) || 0) - (say.get(x.id) || 0) || trSirala(x.ad, y.ad));
  }
  /* Sevkiyat kaydedilirken: firma yeni ise müşteri olarak eklenir; varsa boş alanları tamamlanır (dolu alanlar ezilmez). */
  function musteriIslemleri(d, s, uid) {
    const alanlar = { ulke: s.ulke, adres: s.adres, yetkili: s.yetkili };
    const m = (s.musteri && d.kayit('musteri', s.musteri)) || musteriBul(d, s.firma);
    if (!m) {
      const id = uid();
      return { id, ops: [{ c: 'musteri', k: id, v: { ad: String(s.firma).trim(), ...Object.fromEntries(Object.entries(alanlar).filter(([, v]) => v)) } }] };
    }
    const eksik = Object.fromEntries(Object.entries(alanlar).filter(([k, v]) => v && !String(m[k] || '').trim()));
    return { id: m.id, ops: Object.keys(eksik).length ? [{ c: 'musteri', k: m.id, v: eksik }] : [] };
  }

  /* Ambalaj başına dara önerisi: aynı ambalajda en son girilen dara/adet; yoksa varsayılan. */
  function daraOner(d, ambalaj) {
    const l = d.kayitlar('sevk').filter((s) => !s.iptal).sort((a, b) => b._olusturma - a._olusturma);
    for (const s of l) for (const k of s.kalemler || []) {
      if (k.ambalaj === ambalaj && sayi(k.adet) > 0 && sayi(k.dara) > 0) return Math.round(sayi(k.dara) / sayi(k.adet));
    }
    return AMBALAJLAR.find((a) => a.id === ambalaj)?.dara || 0;
  }
  function urunler(d) {
    const s = new Set(URUNLER);
    for (const r of d.kayitlar('sevk')) for (const k of r.kalemler || []) if (k.urun) s.add(k.urun);
    for (const p of d.kayitlar('parti')) if (p.urun) s.add(p.urun);
    return [...s];
  }
  const partiNo = (p) => { const m = /(\d+)/.exec(p || ''); return m ? +m[1] : -1; };

  /* Partiler yalnızca sevkiyatlardan derlenir: sistem stok tutmaz (kullanıcı kararı, 2026-10-14). Sevkiyatı silinen
     parti listeden düşer. Parti kaydı (üretim tarihi, not) yalnızca bilgi olarak eklenir; eski kayıtlardaki üretim
     miktarı (uretimKg) kullanılmaz. */
  function partiler(d) {
    const m = new Map();
    const al = (urun, parti) => {
      const k = `${ad(urun)}|${ad(parti)}`;
      if (!m.has(k)) m.set(k, { anahtar: k, urun, parti, kayit: null, satilan: 0, rezerve: 0, sevkler: new Set(), musteriler: new Set(), son: '' });
      return m.get(k);
    };
    for (const s of d.kayitlar('sevk')) {
      if (s.iptal) continue;
      for (const k of s.kalemler || []) {
        if (!k.urun) continue;
        for (const p of kalemPartileri(k)) {
          const x = al(k.urun, p.parti);
          if (satildi(s)) { x.satilan += p.net; x.sevkler.add(s.id); x.musteriler.add(s.firma); if (sevkTarihi(s) > x.son) x.son = sevkTarihi(s); }
          else x.rezerve += p.net;
        }
      }
    }
    for (const p of d.kayitlar('parti')) { const x = m.get(`${ad(p.urun)}|${ad(p.parti)}`); if (x) x.kayit = p; }
    return [...m.values()].map((x) => ({ ...x, sevkler: [...x.sevkler], musteriler: [...x.musteriler], uretimTarihi: x.kayit?.uretimTarihi || '' }))
      .sort((a, b) => trSirala(a.urun, b.urun) || partiNo(b.parti) - partiNo(a.parti));
  }

  /* Rapor satırları (kalem bazında) — süzgeç: { yil, ay, musteri, urun } */
  function raporSatirlari(d, f = {}) {
    const l = [];
    for (const s of d.kayitlar('sevk')) {
      if (!satildi(s)) continue;
      const t = sevkTarihi(s);
      if (f.yil && t.slice(0, 4) !== String(f.yil)) continue;
      if (f.ay && +t.slice(5, 7) !== +f.ay) continue;
      if (f.musteri && s.firma !== f.musteri) continue;
      for (const k of s.kalemler || []) {
        if (f.urun && k.urun !== f.urun) continue;
        const net = kalemNet(k);
        l.push({ s, k, tarih: t, net, tutar: sayi(s.birimFiyat) > 0 ? net * sayi(s.birimFiyat) : 0, para: s.paraBirimi || '' });
      }
    }
    return l.sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : trSirala(a.s.no, b.s.no)));
  }
  /* Ay ay sevk edilen net kg (son 12 ay) */
  function aylik(d, bitis = bugun()) {
    const aylar = [];
    let y = +bitis.slice(0, 4), a = +bitis.slice(5, 7);
    for (let i = 0; i < 12; i++) { aylar.unshift(`${y}-${String(a).padStart(2, '0')}`); if (--a === 0) { a = 12; y--; } }
    const top = new Map(aylar.map((x) => [x, 0]));
    for (const s of d.kayitlar('sevk')) if (satildi(s)) { const k = sevkTarihi(s).slice(0, 7); if (top.has(k)) top.set(k, top.get(k) + sevkNet(s)); }
    return aylar.map((k) => ({ ay: k, net: top.get(k) }));
  }
  function musteriPayi(d, yil) {
    const m = new Map();
    for (const s of d.kayitlar('sevk')) if (satildi(s) && (!yil || sevkTarihi(s).startsWith(String(yil)))) m.set(s.firma, (m.get(s.firma) || 0) + sevkNet(s));
    return [...m.entries()].map(([firma, net]) => ({ firma, net })).sort((a, b) => b.net - a.net);
  }
  /* Karşılama ekranı kartı için kısa özet. */
  /* Karşılama ekranındaki "dikkat bekleyenler" şeridi: yoldaki kartlardaki "N eksik belge" işaretiyle aynı kural. */
  function dikkat(d) {
    const n = d.kayitlar('sevk').filter((s) => !s.iptal && s.durum === 'Yolda' && eksikler(s).length).length;
    return n ? [{ metin: `${n} sevkiyatta eksik belge`, sekme: 'sevkiyatlar' }] : [];
  }

  function ozet(d) {
    const bg = bugun();
    const l = d.kayitlar('sevk');
    const buAy = l.filter((s) => satildi(s) && sevkTarihi(s).slice(0, 7) === bg.slice(0, 7)).reduce((t, s) => t + sevkNet(s), 0);
    const yolda = l.filter((s) => !s.iptal && s.durum === 'Yolda').length;
    const hazir = l.filter((s) => !s.iptal && (s.durum === 'Sipariş' || s.durum === 'Hazırlanıyor')).length;
    return [
      `Bu ay ${(buAy / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ton sevk edildi`,
      yolda || hazir ? [yolda && `${yolda} sevkiyat yolda`, hazir && `${hazir} hazırlanıyor`].filter(Boolean).join(' · ') : 'Bekleyen sevkiyat yok',
    ];
  }

  NT.satis = { DURUMLAR, AMBALAJLAR, URUNLER, PARA, satildi, aktif, kalemNet, BELGELER, belgeVar, eksikler, belgeZamani, yurtdisi, eskiCoa, kalemCoaVar, kalemAdi,
    karisimMi, kalemPartileri, karisimAdi, partiYazi, sevkNet, sevkTarihi, tutar, musteriBul, musteriOnerileri, musteriIslemleri, daraOner, urunler, partiler, partiNo, raporSatirlari, aylik, musteriPayi, ozet, dikkat, adNormal: ad };
})(typeof window !== 'undefined' ? window : globalThis);
