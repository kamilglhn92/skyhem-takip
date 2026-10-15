/*
 * Desbaş aylık menü resmini okur:
 *  1) Resimdeki turuncu gün başlıklarını bulur → 7 sütunlu takvim ızgarası (her günün kutusu).
 *  2) Başlıktan ayı ("1 Ekim 2026 Perşembe") ve öğünü ("… AKŞAM MENÜ …") okur.
 *  3) Kutuları ayın günlerine eşler (ilk kutu ayın 1'inin haftanın gününe düşmeli; kutu sayısı = ayın gün sayısı).
 *  4) Her kutuyu yazıya çevirir (Tesseract, Türkçe; ilk kullanımda internetten ~10 MB indirilir).
 * Kutunun resimdeki yeri (kesit) kaydedilir; yazı tanıma hatalı olsa bile o günün menüsü resim olarak hep görünür.
 */
(function () {
  'use strict';
  const NT = window.NT;
  const Y = NT.yemek;
  const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

  function resimAc(dosya) {
    return new Promise((ok, hata) => {
      const img = new Image();
      const url = URL.createObjectURL(dosya);
      img.onload = () => ok(img);
      img.onerror = () => { URL.revokeObjectURL(url); hata(new Error(`${dosya.name || 'Dosya'} resim olarak açılamadı.`)); };
      img.src = url;
    });
  }

  /* Turuncu başlık şeritlerinden takvim ızgarası. Koordinatlar resmin kendi pikselleriyle. */
  function izgaraBul(img) {
    const en = img.naturalWidth, boy = img.naturalHeight;
    const o = Math.min(1, 1600 / en); // çözümleme en fazla 1600 px genişlikte yapılır
    const W = Math.round(en * o), H = Math.round(boy * o);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, W, H);
    const px = cx.getImageData(0, 0, W, H).data;
    const turuncu = (x, y) => { const i = (y * W + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2]; return r > 190 && g > 70 && g < 150 && b < 80 && r - g > 70; };

    // 1) Satırlarının çoğu turuncu olan, başlık yüksekliğindeki bantlar
    const bantlar = [];
    let bas = -1;
    for (let y = 0; y <= H; y++) {
      let n = 0;
      if (y < H) for (let x = 0; x < W; x++) if (turuncu(x, y)) n++;
      const var_ = y < H && n > W * 0.1;
      if (var_ && bas < 0) bas = y;
      if (!var_ && bas >= 0) { const h = y - bas; if (h >= W * 0.006 && h <= W * 0.03) bantlar.push({ y0: bas, y1: y }); bas = -1; }
    }
    // 2) Her bantta turuncu parçalar (yazı boşlukları kapatılır)
    for (const b of bantlar) {
      const h = b.y1 - b.y0, bosluk = Math.round(W * 0.03);
      b.parca = [];
      let s = -1, son = -1;
      for (let x = 0; x < W; x++) {
        let n = 0;
        for (let y = b.y0; y < b.y1; y++) if (turuncu(x, y)) n++;
        if (n / h < 0.5) continue;
        if (s < 0) s = x; else if (x - son > bosluk) { b.parca.push([s, son + 1]); s = x; }
        son = x;
      }
      if (s >= 0) b.parca.push([s, son + 1]);
      b.parca = b.parca.filter(([a, z]) => z - a > W * 0.06);
      // Dolgunluk: gün başlığı düz turuncu şerittir; büyük turuncu başlık yazısının harfleri arası boştur
      let dolu = 0, alan = 0;
      for (const [a, z] of b.parca) for (let y = b.y0; y < b.y1; y++) for (let x = a; x < z; x += 2) { alan++; if (turuncu(x, y)) dolu++; }
      b.dolgu = alan ? dolu / alan : 0;
    }
    // Gün başlıkları aynı yükseklikte ve dolu şeritlerdir; başlık yazısı gibi aykırı bantlar elenir
    const adaylar = bantlar.filter((b) => b.parca.length && b.dolgu > 0.6);
    const yukseklikler = adaylar.map((b) => b.y1 - b.y0).sort((a, z) => a - z);
    const ortaH = yukseklikler[Math.floor(yukseklikler.length / 2)];
    const iyi = adaylar.filter((b) => Math.abs((b.y1 - b.y0) - ortaH) <= Math.max(2, ortaH * 0.25));
    if (iyi.length < 4) return { en, boy, hucreler: [], hata: 'Resimde takvim (turuncu gün başlıkları) bulunamadı.' };
    // 3) Sütun genişliği: en geniş yayılım 7 sütundur
    const minX = Math.min(...iyi.flatMap((b) => b.parca.map((p) => p[0])));
    const maxX = Math.max(...iyi.flatMap((b) => b.parca.map((p) => p[1])));
    const sw = (maxX - minX) / 7;
    const araliklar = iyi.slice(1).map((b, i) => b.y0 - iyi[i].y1).sort((a, z) => a - z);
    const satirH = araliklar[Math.floor(araliklar.length / 2)];
    const hucreler = [];
    iyi.forEach((b, satir) => {
      const altY = satir + 1 < iyi.length ? iyi[satir + 1].y0 : Math.min(H, b.y1 + satirH);
      for (const [a, z] of b.parca) {
        const c0 = Math.round((a - minX) / sw), c1 = Math.round((z - minX) / sw);
        for (let c = c0; c < c1; c++) {
          const x = minX + c * sw;
          hucreler.push({ satir, sutun: c, x: x / o, y: b.y0 / o, w: sw / o, h: (altY - b.y0) / o, basH: (b.y1 - b.y0) / o });
        }
      }
    });
    return { en, boy, hucreler, ilkBant: iyi[0].y0 / o };
  }

  /* --- Yazı tanıma --- */
  let isci = null;
  function betikYukle() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise((ok, hata) => {
      const s = document.createElement('script');
      s.src = TESSERACT;
      s.onload = ok;
      s.onerror = () => hata(new Error('Yazı tanıma aracı indirilemedi (internet bağlantısını kontrol edin).'));
      document.head.appendChild(s);
    });
  }
  async function isciAl(durum) {
    if (isci) return isci;
    durum && durum('Yazı tanıma hazırlanıyor (ilk seferde ~10 MB indirilir)…');
    await betikYukle();
    isci = await window.Tesseract.createWorker('tur', 1, {
      logger: (m) => { if (durum && m.status && /loading|initializ/.test(m.status)) durum(`Yazı tanıma hazırlanıyor… %${Math.round((m.progress || 0) * 100)}`); },
    });
    await isci.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    return isci;
  }
  /* Tanıma için büyütülmüş tuval (küçük yazılar daha doğru okunur). */
  function buyukTuval(img) {
    const K = Math.max(1, Math.min(3, 3200 / img.naturalWidth));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * K); cv.height = Math.round(img.naturalHeight * K);
    const cx = cv.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    return { cv, K };
  }
  async function oku(w, t, x, y, gw, gh) {
    const r = await w.recognize(t.cv, { rectangle: { left: Math.max(0, Math.round(x * t.K)), top: Math.max(0, Math.round(y * t.K)), width: Math.round(gw * t.K), height: Math.round(gh * t.K) } });
    return r.data.text || '';
  }
  const satirlar = (metin) => metin.split('\n').map((s) => s.replace(/[|_~`"'“”]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^[\s\-–—©®•·,;:.]+/, '').replace(/[\s\-–—©®•·,;:]+$/, '')).filter((s) => s.length > 1 && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(s));

  const AYLAR = Y.AY_ADLARI.map((a) => a.toLocaleLowerCase('tr'));
  function ayBul(metin) {
    const k = metin.toLocaleLowerCase('tr');
    for (let i = 0; i < 12; i++) {
      const m = new RegExp(`${AYLAR[i]}\\s*(20\\d\\d)`).exec(k);
      if (m) return `${m[1]}-${String(i + 1).padStart(2, '0')}`;
    }
    return '';
  }

  /* Resmi çözümle: ızgara + ay + öğün tahmini. */
  async function cozumle(dosya, durum) {
    const img = await resimAc(dosya);
    const iz = izgaraBul(img);
    const sonuc = { dosya, img, en: iz.en, boy: iz.boy, hucreler: iz.hucreler, hata: iz.hata || '', ay: '', ogun: /ak[sş]am/i.test(dosya.name || '') ? 'aksam' : 'ogle', ocrHata: '' };
    if (iz.hata) return sonuc;
    try {
      const w = await isciAl(durum);
      durum && durum('Ay ve öğün okunuyor…');
      const t = buyukTuval(img);
      sonuc.tuval = t;
      const ilk = iz.hucreler[0];
      const baslik = await oku(w, t, ilk.x, ilk.y, ilk.w, ilk.basH);
      const ust = await oku(w, t, iz.en * 0.15, 0, iz.en * 0.7, Math.max(10, iz.ilkBant));
      sonuc.ay = ayBul(baslik) || ayBul(ust);
      if (/ak[sş]am/i.test(ust)) sonuc.ogun = 'aksam';
      sonuc.baslikYazi = ust.trim();
    } catch (e) { sonuc.ocrHata = e.message || String(e); }
    return sonuc;
  }

  /* Kutuları ayın günlerine eşle: { kesitler: { 'GG': [x,y,w,h] }, hata, uyari } */
  function gunlereEsle(c, ay) {
    if (!c.hucreler.length) return { kesitler: {}, hata: c.hata || 'Takvim bulunamadı.' };
    const n = Y.ayGunSayisi(ay);
    if (c.hucreler.length !== n) return { kesitler: {}, hata: `Resimde ${c.hucreler.length} gün bulundu; ${Y.ayAdi(ay)} ${n} gün. Ayı doğru seçtiğinizden emin olun.` };
    const ilkSutun = (new Date(`${ay}-01T12:00:00`).getDay() + 6) % 7; // Pazartesi = 0
    const uyari = c.hucreler[0].sutun !== ilkSutun ? `Dikkat: resimde ayın 1'i ${['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'][c.hucreler[0].sutun]} sütununda; ${Y.ayAdi(ay)} 1'i ${Y.gunAdi(`${ay}-01`)}. Ay yanlış seçilmiş olabilir.` : '';
    const kesitler = {};
    c.hucreler.forEach((h, i) => { kesitler[String(i + 1).padStart(2, '0')] = [h.x, h.y, h.w, h.h].map((v) => Math.round(v)); });
    return { kesitler, uyari };
  }

  /* Her günün kutusunu yazıya çevir: { 'GG': [yemekler] } */
  async function yaziyaCevir(c, durum) {
    const w = await isciAl(durum);
    const t = c.tuval || (c.tuval = buyukTuval(c.img));
    const sonuc = {};
    for (let i = 0; i < c.hucreler.length; i++) {
      const h = c.hucreler[i];
      durum && durum(`Yazıya çevriliyor: ${i + 1} / ${c.hucreler.length}`);
      const pay = h.w * 0.015;
      sonuc[String(i + 1).padStart(2, '0')] = satirlar(await oku(w, t, h.x + pay, h.y + h.basH + 1, h.w - 2 * pay, h.h - h.basH - 2));
    }
    return sonuc;
  }

  /* Önizleme: bulunan kutular ve gün numaraları resmin üstüne çizilir. */
  function onizleme(c, kesitler, genislik = 720) {
    const o = genislik / c.en;
    const cv = document.createElement('canvas');
    cv.width = genislik; cv.height = Math.round(c.boy * o);
    const cx = cv.getContext('2d');
    cx.drawImage(c.img, 0, 0, cv.width, cv.height);
    cx.lineWidth = 2;
    cx.font = `700 ${Math.max(12, Math.round(18 * o * 1.6))}px Segoe UI, sans-serif`;
    for (const [g, [x, y, w, h]] of Object.entries(kesitler || {})) {
      cx.strokeStyle = 'rgba(30, 110, 200, .9)';
      cx.fillStyle = 'rgba(30, 110, 200, .10)';
      cx.fillRect(x * o, y * o, w * o, h * o);
      cx.strokeRect(x * o + 1, y * o + 1, w * o - 2, h * o - 2);
      cx.fillStyle = 'rgba(20, 80, 160, .95)';
      cx.fillRect(x * o + 2, (y + h) * o - 22, 28, 20);
      cx.fillStyle = '#fff';
      cx.fillText(String(+g), x * o + 6, (y + h) * o - 7);
    }
    return cv.toDataURL('image/jpeg', 0.85);
  }

  async function kapat() { if (isci) { const w = isci; isci = null; await w.terminate().catch(() => {}); } }

  /* Kaydedilmiş menü resmini açıp bir günün kutusunu tuvale çizmek için: ek dosyası → Image (önbellekli). */
  const resimler = new Map();
  function kayitliResim(ek) {
    if (!resimler.has(ek.dosya)) {
      resimler.set(ek.dosya, NT.baglanti.depo.ekOku(ek.dosya).then(resimAc).catch((e) => { resimler.delete(ek.dosya); throw e; }));
    }
    return resimler.get(ek.dosya);
  }

  NT.menuOku = { cozumle, gunlereEsle, yaziyaCevir, onizleme, kapat, kayitliResim, satirlar };
})();
