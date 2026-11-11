/*
 * Enerji — iş kuralları (arayüzsüz; karşılama ekranı da özet için yükler).
 *
 * Koleksiyonlar:
 *   kayit  { no: EN-YYYY-NNNN, tarih (fatura / sayaç okuma tarihi; ayı dönemdir), tip: 'elektrik' | 'dogalgaz',
 *            miktar, birim: 'kWh' | 'm3' (elektrik hep kWh; doğalgaz faturadaki birimle), tutar (USD), notlar, belge: [dosyalar] }
 *   ayar   'genel' { tedarikci, katsayi }   — katsayi: 1 m³ doğalgaz kaç kWh (varsayılan 10,64)
 *
 * Doğalgaz hangi birimle girilirse diğeri katsayıyla hesaplanır; iki kaynak kWh üzerinden karşılaştırılır.
 * "Son 12 ay" bugüne göre değil, son kayıtlı aya göre sayılır (eksik aylar girildikçe kendiliğinden kayar).
 */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});
  const { sayi, bugun } = NT.c;

  const TIPLER = [
    { id: 'elektrik', ad: 'Elektrik', birim: 'kWh', renk: 'var(--gr-1)', ikon: 'simsek' },
    { id: 'dogalgaz', ad: 'Doğalgaz', birim: 'm3', renk: 'var(--gr-2)', ikon: 'alev' },
  ];
  const tipBul = (id) => TIPLER.find((t) => t.id === id) || TIPLER[0];
  const BIRIM_YAZ = { kWh: 'kWh', m3: 'm³' };
  const VARSAYILAN = { tedarikci: 'DESBAŞ', katsayi: 10.64 };
  const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const ayAdi = (ay) => `${NT.dil?.t(AY_ADLARI[+ay.slice(5, 7) - 1]) ?? AY_ADLARI[+ay.slice(5, 7) - 1]} ${ay.slice(0, 4)}`;
  const ayKisa = (ay) => `${NT.dil?.t(AY_KISA[+ay.slice(5, 7) - 1]) ?? AY_KISA[+ay.slice(5, 7) - 1]} ${ay.slice(2, 4)}`;
  const ayNo = (ay) => +ay.slice(0, 4) * 12 + (+ay.slice(5, 7) - 1);
  const ayYaz = (n) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
  const ayKaydir = (ay, n) => ayYaz(ayNo(ay) + n);

  function ayar(d) {
    const a = d.kayit('ayar', 'genel') || {};
    const r = { ...VARSAYILAN };
    for (const k of Object.keys(VARSAYILAN)) if (a[k] !== undefined && a[k] !== '') r[k] = a[k];
    if (!(sayi(r.katsayi) > 0)) r.katsayi = VARSAYILAN.katsayi;
    return r;
  }

  /* Kaydın geçerli birimi: elektrik her zaman kWh; doğalgaz kWh seçilmediyse m³. */
  const birimi = (k) => (k.tip === 'dogalgaz' ? (k.birim === 'kWh' ? 'kWh' : 'm3') : 'kWh');
  const kwh = (k, katsayi) => (birimi(k) === 'm3' ? sayi(k.miktar) * katsayi : sayi(k.miktar));
  const m3 = (k, katsayi) => (k.tip !== 'dogalgaz' ? null : birimi(k) === 'm3' ? sayi(k.miktar) : sayi(k.miktar) / katsayi);

  /* Hesaba giren kayıtlar (tarihi ve tipi olanlar), tarih sırasıyla; her biri hesaplanmış değerleriyle. */
  function satirlar(d, a = ayar(d)) {
    const kat = sayi(a.katsayi);
    return d.kayitlar('kayit').filter((k) => k.tarih && (k.tip === 'elektrik' || k.tip === 'dogalgaz'))
      .sort((x, y) => (x.tarih < y.tarih ? -1 : x.tarih > y.tarih ? 1 : x.tip < y.tip ? 1 : x.tip > y.tip ? -1 : x._olusturma - y._olusturma))
      .map((k) => {
        const e = kwh(k, kat);
        const usd = sayi(k.tutar);
        return { k, ay: k.tarih.slice(0, 7), kwh: e, m3: m3(k, kat), usd, fiyat: e > 0 ? usd / e : null };
      });
  }

  const bosAy = (ay) => ({ ay, elektrik: { kwh: 0, usd: 0, n: 0 }, dogalgaz: { kwh: 0, m3: 0, usd: 0, n: 0 }, kwh: 0, usd: 0, n: 0 });
  function ekle(x, s) {
    const t = x[s.k.tip];
    t.kwh += s.kwh; t.usd += s.usd; t.n++;
    if (s.k.tip === 'dogalgaz') t.m3 += s.m3;
    x.kwh += s.kwh; x.usd += s.usd; x.n++;
    return x;
  }
  /* Ay ay döküm (yalnız kaydı olan aylar), eskiden yeniye. */
  function aylar(d, liste = satirlar(d)) {
    const m = new Map();
    for (const s of liste) { if (!m.has(s.ay)) m.set(s.ay, bosAy(s.ay)); ekle(m.get(s.ay), s); }
    return [...m.values()].sort((x, y) => (x.ay < y.ay ? -1 : 1));
  }
  const sonAy = (d, l = aylar(d)) => (l.length ? l[l.length - 1].ay : '');

  /* bitis ayında biten n aylık pencere; kaydı olmayan aylar sıfırla (n: 0) doldurulur. */
  function pencere(l, bitis, n) {
    const sonuc = [];
    for (let i = n - 1; i >= 0; i--) { const ay = ayKaydir(bitis, -i); sonuc.push(l.find((x) => x.ay === ay) || bosAy(ay)); }
    return sonuc;
  }
  function topla(liste) {
    const t = bosAy('');
    for (const x of liste) {
      for (const tip of ['elektrik', 'dogalgaz']) { t[tip].kwh += x[tip].kwh; t[tip].usd += x[tip].usd; t[tip].n += x[tip].n; }
      t.dogalgaz.m3 += x.dogalgaz.m3; t.kwh += x.kwh; t.usd += x.usd; t.n += x.n;
    }
    return t;
  }
  const bol = (a, b) => (b > 0 ? a / b : null);

  /* Genel Bakış sayıları: son kayıtlı ayda biten 12 ay ve ondan önceki 12 ay. */
  function son12(d) {
    const l = aylar(d);
    const bitis = sonAy(d, l);
    if (!bitis) return null;
    const simdi = pencere(l, bitis, 12);
    const once = pencere(l, ayKaydir(bitis, -12), 12);
    const t = topla(simdi), o = topla(once);
    return {
      bitis, baslangic: simdi[0].ay, aylar: simdi, oncekiAylar: once, toplam: t, onceki: o,
      degisim: o.usd > 0 ? t.usd / o.usd - 1 : null,
      elFiyat: bol(t.elektrik.usd, t.elektrik.kwh), gazFiyat: bol(t.dogalgaz.usd, t.dogalgaz.kwh), gazFiyatM3: bol(t.dogalgaz.usd, t.dogalgaz.m3),
    };
  }

  /* Yıl yıl karşılaştırma. */
  function yillar(d) {
    const l = aylar(d);
    const m = new Map();
    for (const x of l) { const y = x.ay.slice(0, 4); if (!m.has(y)) m.set(y, []); m.get(y).push(x); }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([yil, liste]) => {
      const t = topla(liste);
      return { yil, ...t, elFiyat: bol(t.elektrik.usd, t.elektrik.kwh), gazFiyatM3: bol(t.dogalgaz.usd, t.dogalgaz.m3), gazFiyat: bol(t.dogalgaz.usd, t.dogalgaz.kwh) };
    });
  }
  /* Yıl × ay tablosu: al(ayKaydı) → değer ya da null (o ay o türde kayıt yok). Satır: { yil, aylar: [12], toplam }. */
  function matris(d, al) {
    const l = aylar(d);
    const ys = [...new Set(l.map((x) => x.ay.slice(0, 4)))].sort();
    return ys.map((yil) => {
      const hucre = AY_KISA.map((_, i) => { const x = l.find((y) => y.ay === `${yil}-${String(i + 1).padStart(2, '0')}`); return x ? al(x) : null; });
      return { yil, aylar: hucre, toplam: hucre.reduce((t, v) => t + (v || 0), 0) };
    });
  }

  /* Kaydederken gösterilen uyarılar (engellemez): aynı aya çift kayıt, alışılmadık birim fiyat. taslak: { id?, tarih, tip, miktar, birim, tutar } */
  function uyarilar(d, taslak) {
    const u = [];
    if (!taslak.tarih || !taslak.tip) return u;
    const a = ayar(d);
    const diger = satirlar(d, a).filter((s) => s.k.id !== taslak.id && s.k.tip === taslak.tip);
    const ayni = diger.find((s) => s.ay === taslak.tarih.slice(0, 7));
    if (ayni) u.push(`${ayAdi(ayni.ay)} için zaten bir ${tipBul(taslak.tip).ad.toLocaleLowerCase('tr')} kaydı var (${ayni.k.no || 'numarasız'}).`);
    const e = kwh(taslak, sayi(a.katsayi));
    const ort = bol(diger.reduce((t, s) => t + s.usd, 0), diger.reduce((t, s) => t + s.kwh, 0));
    if (e > 0 && sayi(taslak.tutar) > 0 && ort) {
      const f = sayi(taslak.tutar) / e;
      if (f > ort * 1.5 || f < ort * 0.5) u.push(`Birim fiyat alışılmadık: ${f.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} $/kWh (ortalama ${ort.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}). Tüketimi, birimi ve tutarı kontrol edin.`);
    }
    return u;
  }

  /* Son kayıttan sonra kaydı girilmemiş, bitmiş ay sayısı (içinde bulunulan ay sayılmaz). */
  function eksikAy(d, l = aylar(d)) {
    const son = sonAy(d, l);
    return son ? Math.max(0, ayNo(bugun().slice(0, 7)) - ayNo(son) - 1) : 0;
  }

  const dolar = (n, basamak = 0) => `$${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: basamak, maximumFractionDigits: basamak })}`;
  /* Karşılama ekranı kartı için kısa özet. */
  function ozet(d) {
    const s = son12(d);
    if (!s) return [(NT.dil?.t('Henüz kayıt yok') ?? 'Henüz kayıt yok'), (NT.dil?.t('Elektrik ve doğalgaz faturalarını girin') ?? 'Elektrik ve doğalgaz faturalarını girin')];
    const eksik = eksikAy(d);
    return [(NT.dil?.m("Son 12 ay {0} · {1} kWh", dolar(s.toplam.usd), Math.round(s.toplam.kwh).toLocaleString('tr-TR')) ?? `Son 12 ay ${dolar(s.toplam.usd)} · ${Math.round(s.toplam.kwh).toLocaleString('tr-TR')} kWh`),
      [(NT.dil?.m("Son kayıt {0}", ayAdi(s.bitis)) ?? `Son kayıt ${ayAdi(s.bitis)}`), eksik && (NT.dil?.m("{0} ay girilmedi", eksik) ?? `${eksik} ay girilmedi`)].filter(Boolean).join(' · ')];
  }
  /* Karşılama ekranındaki "dikkat bekleyenler" şeridi; kural kenar menüsündeki Kayıtlar sayacıyla aynıdır. */
  function dikkat(d) {
    const eksik = eksikAy(d);
    return eksik ? [{ metin: (NT.dil?.m("{0} ayın enerji kaydı girilmedi", eksik) ?? `${eksik} ayın enerji kaydı girilmedi`), sekme: 'kayitlar' }] : [];
  }

  NT.enerji = { TIPLER, tipBul, BIRIM_YAZ, VARSAYILAN, AY_ADLARI, AY_KISA, ayAdi, ayKisa, ayKaydir, ayar, birimi, kwh, m3, satirlar, aylar, sonAy, pencere, topla, son12, yillar, matris, uyarilar, eksikAy, dolar, ozet, dikkat };
})(typeof window !== 'undefined' ? window : globalThis);
