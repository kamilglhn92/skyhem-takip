/*
 * Üretim formu tarama: PDF ya da fotoğraf → sayfa resimleri → yön ve form türü.
 *  - PDF sayfaları pdf.js ile çizilir (ilk kullanımda internetten ~1 MB indirilir).
 *  - Form türü yalnız MATBU başlıktan okunur (Tesseract, Türkçe; yemek menüsüyle aynı araç). Taramalar baş aşağı ya da yan
 *    gelebildiği için sayfa 0/90/180/270 derece döndürülüp üst şerit okunur; başlık bulunan yön seçilir.
 *  - El yazısı değerler okunmaz: el yazısında yazı tanıma güvenilmez, yanlış değer kayda girmesin (context/uretim-paneli.md).
 * Tanınamayan sayfada kullanıcı türü ve yönü kendisi seçer; tarama her durumda kayda eklenir.
 */
(function () {
  'use strict';
  const NT = window.NT;
  const U = NT.uretim;
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_ISCI = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const EN_BUYUK = 1800; // sayfa resmi en fazla bu kadar piksel (uzun kenar)

  function betik(src, var_) {
    if (var_()) return Promise.resolve();
    return new Promise((ok, hata) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => hata(new Error(NT.dil.t('Gerekli araç indirilemedi (internet bağlantısını kontrol edin).', 'Could not download a required tool (check the internet connection).')));
      document.head.appendChild(s);
    });
  }

  const tuvaldenBlob = (cv) => new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.86));
  function resimAc(blob) {
    return new Promise((ok, hata) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => ok(img);
      img.onerror = () => { URL.revokeObjectURL(url); hata(new Error(NT.dil.t('Dosya resim olarak açılamadı.', 'The file could not be opened as an image.'))); };
      img.src = url;
    });
  }
  /* Resmi döndürüp küçülterek tuvale çizer. */
  function ciz(img, derece = 0, enBuyuk = EN_BUYUK) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const o = Math.min(1, enBuyuk / Math.max(w, h));
    const yan = derece % 180 !== 0;
    const cv = document.createElement('canvas');
    cv.width = Math.round((yan ? h : w) * o); cv.height = Math.round((yan ? w : h) * o);
    const cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.translate(cv.width / 2, cv.height / 2);
    cx.rotate((derece * Math.PI) / 180);
    cx.drawImage(img, (-w * o) / 2, (-h * o) / 2, w * o, h * o);
    return cv;
  }

  /* Dosyayı sayfa resimlerine böler: [{ blob, ad }] */
  async function sayfalaraBol(dosya, durum) {
    const pdf = /pdf$/i.test(dosya.type) || /\.pdf$/i.test(dosya.name || '');
    if (!pdf) {
      const img = await resimAc(dosya);
      return [{ blob: await tuvaldenBlob(ciz(img)), ad: dosya.name }];
    }
    durum && durum(NT.dil.t('PDF açılıyor…', 'Opening PDF…'));
    await betik(PDFJS, () => window.pdfjsLib);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_ISCI;
    const belge = await window.pdfjsLib.getDocument({ data: await dosya.arrayBuffer() }).promise;
    const l = [];
    for (let i = 1; i <= belge.numPages; i++) {
      durum && durum(U.m('PDF sayfası {0} / {1} hazırlanıyor…', 'Preparing PDF page {0} / {1}…', i, belge.numPages));
      const s = await belge.getPage(i);
      const g = s.getViewport({ scale: 1 });
      const olcek = Math.min(2.2, EN_BUYUK / Math.max(g.width, g.height));
      const v = s.getViewport({ scale: olcek });
      const cv = document.createElement('canvas');
      cv.width = Math.round(v.width); cv.height = Math.round(v.height);
      await s.render({ canvasContext: cv.getContext('2d'), viewport: v }).promise;
      l.push({ blob: await tuvaldenBlob(cv), ad: `${dosya.name} · ${i}` });
    }
    return l;
  }

  let isci = null;
  async function isciAl(durum) {
    if (isci) return isci;
    durum && durum(NT.dil.t('Başlık okuma hazırlanıyor (ilk seferde ~10 MB indirilir)…', 'Preparing header reading (first time ~10 MB download)…'));
    await betik(TESSERACT, () => window.Tesseract);
    isci = await window.Tesseract.createWorker('tur', 1);
    await isci.setParameters({ tessedit_pageseg_mode: '11' }); // seyrek metin: kutulu başlık satırları da okunur (6 bunları atlıyordu)
    return isci;
  }

  /* Metinden form türü: başlık deseni + sayfa deseni. Bulunamazsa ''. */
  function formBul(metin) {
    const adaylar = Object.entries(U.FORMLAR).filter(([, f]) => f.tanima.some((r) => r.test(metin)));
    if (!adaylar.length) return '';
    if (adaylar.length === 1) return adaylar[0][0];
    const sayfali = adaylar.find(([, f]) => (f.sayfaTanima || []).some((r) => r.test(metin)));
    return (sayfali || adaylar[0])[0];
  }

  /* Döndürülmüş sayfanın üstten oran kadarını ayrı tuvale keser (tam sayfada bölge vererek okumak döndürülmüş taramada bozuk sonuç verdi). */
  function ustSerit(img, derece, oran) {
    const cv = ciz(img, derece, 2400);
    const k = document.createElement('canvas');
    k.width = cv.width; k.height = Math.round(cv.height * oran);
    k.getContext('2d').drawImage(cv, 0, 0);
    return k;
  }

  /* Bir sayfanın yönünü ve form türünü bulur: 4 yönde üst şeridi okur. */
  async function sayfaTani(blob, durum) {
    const img = await resimAc(blob);
    let w;
    try { w = await isciAl(durum); } catch (e) { return { derece: 0, form: '', metin: '', hata: e.message }; }
    let enIyi = { derece: 0, form: '', metin: '', puan: -1 };
    for (const derece of [0, 180, 90, 270]) {
      const r = await w.recognize(ustSerit(img, derece, 0.2));
      const metin = (r.data.text || '').toLocaleUpperCase('tr');
      const form = formBul(metin);
      const puan = (form ? 10 : 0) + (/SKY|HEM|DOK[ÜU]MAN|FORM/.test(metin) ? 3 : 0) + (r.data.confidence || 0) / 100;
      if (puan > enIyi.puan) enIyi = { derece, form, metin, puan };
      if (form) break;
    }
    // Sayfa 2'yi ayırt eden ifadeler başlıkta değil tablo adında olabilir (ör. "E2 TANKI SOĞUTMA"): tanınan formun eşini tüm sayfada dene.
    if (enIyi.form && ['FR-011-1', 'FR-035-G'].includes(enIyi.form)) {
      const r = await w.recognize(ustSerit(img, enIyi.derece, 0.4));
      const metin = (r.data.text || '').toLocaleUpperCase('tr');
      if (enIyi.form === 'FR-011-1' && /SO[ĞG]UTMA|E2 TANK|2\s*\/\s*2/.test(metin)) enIyi.form = 'FR-011-2';
      // Gece sayfası: "GECE" yazısı eski formda dikey olduğundan okunmayabilir; saat sütunu 20:00–07:00 arasında başlıyorsa gecedir.
      const ilkSaat = /\b([01]?\d|2[0-3])[:.][0-5]\d\b/.exec(metin.replace(/\d{2}[.]\d{2}[.]\d{4}/g, ''));
      if (enIyi.form === 'FR-035-G' && (/GECE/.test(metin) || (ilkSaat && (+ilkSaat[1] >= 20 || +ilkSaat[1] < 7)))) enIyi.form = 'FR-035-N';
      const parti = /(?:LOT|PART[İI])\s*NO\s*:?\s*(BATCH\s*#?\s*\d+|#\s*\d+)/.exec(metin);
      if (parti) enIyi.parti = U.partiAdi(parti[1]);
    }
    return enIyi;
  }

  /* Seçilen dosyalar → [{ blob, ad, derece, form, parti }] ; her sayfa ayrı kayıt olur. */
  async function hazirla(dosyalar, durum) {
    const sonuc = [];
    for (const dosya of dosyalar) {
      for (const s of await sayfalaraBol(dosya, durum)) {
        durum && durum(U.m('{0}: başlık okunuyor…', '{0}: reading header…', s.ad));
        const t = await sayfaTani(s.blob, durum);
        sonuc.push({ ...s, ...t });
      }
    }
    return sonuc;
  }

  /* Kullanıcı yönü değiştirdiyse resmi döndürüp yeni dosya yapar (kayda düz hali girer). */
  async function dondur(blob, derece) {
    if (!derece) return blob;
    return tuvaldenBlob(ciz(await resimAc(blob), derece));
  }

  NT.uretimTara = { hazirla, dondur, sayfalaraBol, formBul, sayfaTani };
})();
