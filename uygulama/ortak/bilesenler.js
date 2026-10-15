/* Ortak arayüz parçaları: ikonlar, modal, alan, rozet, bildirim, onay penceresi. */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, useState, useEffect, useRef } = window.htmPreact;
  const { basHarfler } = NT.c;

  /* --- İkonlar (1.8px çizgi, 24'lük kutu) --- */
  const YOLLAR = {
    ozet: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z',
    stok: 'M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4',
    dolum: 'M12 3s6 6.2 6 11a6 6 0 01-12 0c0-4.8 6-11 6-11z',
    damacana: 'M10 2h4v3h-4zM10 5v1.5C7 7.3 5.5 9.3 5.5 12v8a2 2 0 002 2h9a2 2 0 002-2v-8c0-2.7-1.5-4.7-4.5-5.5V5M5.5 14h13M5.5 18h13',
    sevk: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
    alim: 'M6 7h12l-1 13H7L6 7zM9 7V5a3 3 0 016 0v2',
    ayar: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
    arti: 'M12 5v14M5 12h14',
    eksi: 'M5 12h14',
    ara: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3',
    yazici: 'M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a2 2 0 012-2h14a2 2 0 012 2v6a1 1 0 01-1 1h-2M6 14h12v7H6z',
    kopya: 'M9 9h11v11H9zM5 15H4V4h11v1',
    indir: 'M12 3v12M7 10l5 5 5-5M4 21h16',
    yukle: 'M12 21V9M7 14l5-5 5 5M4 3h16',
    cop: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
    geri: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
    kapat: 'M6 6l12 12M18 6L6 18',
    kalem: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
    uyari: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
    tik: 'M20 6L9 17l-5-5',
    daire_tik: 'M22 11.1V12a10 10 0 11-5.9-9.1M22 4L12 14l-3-3',
    yasak: 'M12 22a10 10 0 100-20 10 10 0 000 20zM4.9 4.9l14.2 14.2',
    klasor: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
    kisi: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
    saat: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
    etiket: 'M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01',
    senkron: 'M21 12a9 9 0 01-15.5 6.3L3 16M3 12a9 9 0 0115.5-6.3L21 8M21 3v5h-5M3 21v-5h5',
    ok: 'M9 18l6-6-6-6',
    asagi: 'M6 9l6 6 6-6',
    whatsapp: 'M20.5 3.5A11 11 0 003.4 17.3L2 22l4.8-1.3A11 11 0 1020.5 3.5zM8.5 7.5c.3-.6.6-.6.9-.6h.7c.2 0 .5 0 .7.6l1 2.2c.1.3 0 .5-.1.7l-.6.7c-.2.2-.2.4 0 .7a7 7 0 003.3 2.9c.3.1.5.1.7-.1l.8-1c.2-.2.4-.3.7-.2l2.1 1c.3.2.5.3.5.5 0 .9-.6 2-1.8 2.2-1 .2-2.3.1-4.6-1.1a11 11 0 01-4.4-4.5c-.6-1.2-.7-2.3-.3-3.3z',
    bilgi: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
    goz: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
    liste: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    pano: 'M3 3h7v18H3zM14 3h7v10h-7z',
    ay: 'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z',
    gunes: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    ataç: 'M21.4 11.1l-9.2 9.2a6 6 0 01-8.5-8.5l9.2-9.2a4 4 0 015.7 5.7l-9.2 9.2a2 2 0 01-2.8-2.8l8.5-8.5',
    sayim: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    takvim: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
    bina: 'M3 21h18M5 21V5l7-2v18M19 21V9l-7-2M8.5 8h.01M8.5 12h.01M8.5 16h.01M15.5 12h.01M15.5 16h.01',
    rapor: 'M4 20V11M10 20V5M16 20v-7M21 20H3',
    fatura: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4',
    yemek: 'M5 3v7a3 3 0 006 0V3M8 3v18M18 21V3c-2 0-4 3-4 8h4',
    kahve: 'M4 9h13v4a5 5 0 01-5 5H9a5 5 0 01-5-5zM17 10h1.5a2.5 2.5 0 010 5H17M4 21h13M8 3v3M12 3v3',
    ev: 'M3 11l9-8 9 8M5 9v12h14V9',
    kutu: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
    kamera: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
    belge: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h6',
  };
  function Ikon({ ad, boyut = 18, sinif = '' }) {
    return html`<svg class=${'ikon ' + sinif} width=${boyut} height=${boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${YOLLAR[ad] || ''} /></svg>`;
  }

  /* Hacme göre ölçeklenen şişe/bidon silueti — raf görünümü için */
  function Sise({ litre = 1, boyut = 1 }) {
    const l = Math.max(0.25, Number(litre) || 1);
    const h = Math.round((16 + Math.sqrt(l) * 9) * boyut);
    const w = Math.round((9 + Math.sqrt(l) * 6.2) * boyut);
    const bidon = l >= 5;
    const boyun = Math.max(4, Math.round(w * 0.36));
    const govdeY = Math.round(h * (bidon ? 0.16 : 0.3));
    return html`<svg width=${w + 4} height=${h + 2} viewBox=${`-2 -1 ${w + 4} ${h + 2}`} aria-hidden="true">
      <rect x=${(w - boyun) / 2} y="0" width=${boyun} height=${govdeY + 2} rx="1.5" fill="var(--ana-koyu)" />
      <rect x="0" y=${govdeY} width=${w} height=${h - govdeY} rx=${bidon ? 3 : w * 0.28} fill="var(--ana-cizgi)" stroke="var(--ana)" stroke-width="1.4" />
      ${bidon && html`<rect x=${w * 0.62} y=${govdeY - 3} width=${w * 0.24} height="5" rx="2" fill="none" stroke="var(--ana)" stroke-width="1.4" />`}
      <rect x=${w * 0.18} y=${govdeY + (h - govdeY) * 0.38} width=${w * 0.64} height=${(h - govdeY) * 0.3} rx="1.5" fill="var(--yuzey)" opacity=".85" />
    </svg>`;
  }

  const DURUM_BILGI = {
    iyi: { ikon: 'daire_tik', yazi: 'Yeterli' },
    kritik: { ikon: 'uyari', yazi: 'Kritik' },
    yok: { ikon: 'yasak', yazi: 'Tükendi' },
    eksi: { ikon: 'yasak', yazi: 'Eksiye düştü' },
  };
  function StokRozeti({ durum }) {
    const b = DURUM_BILGI[durum] || DURUM_BILGI.iyi;
    return html`<span class=${'rozet ' + durum}><${Ikon} ad=${b.ikon} />${b.yazi}</span>`;
  }
  const SEVK_ROZET = {
    'Karar Aşaması': { s: 'mor', ikon: 'saat' },
    Beklemede: { s: 'kritik', ikon: 'saat' },
    'Etiket Bekliyor': { s: 'bilgi', ikon: 'etiket' },
    Gönderildi: { s: 'iyi', ikon: 'daire_tik' },
  };
  function SevkRozeti({ durum }) {
    const b = SEVK_ROZET[durum] || { s: '', ikon: 'bilgi' };
    return html`<span class=${'rozet ' + b.s}><${Ikon} ad=${b.ikon} />${durum}</span>`;
  }
  function Parti({ parti }) {
    return parti ? html`<span class="parti">${parti}</span>` : html`<span class="parti yok-parti">Partisiz</span>`;
  }

  const RENKLER = ['#2e7d32', '#2f5f8a', '#8a4b0f', '#6a3fa0', '#0f766e', '#9f1239', '#4d7c0f', '#1e40af'];
  function Avatar({ ad, kucuk }) {
    let h = 0;
    for (const ch of String(ad)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return html`<span class=${'avatar' + (kucuk ? ' kucuk-av' : '')} style=${{ background: RENKLER[h % RENKLER.length] }} title=${ad}>${basHarfler(ad)}</span>`;
  }

  function Modal({ baslik, kapat, genis, dar, sag, alt, children, sinif = '' }) {
    const perde = useRef();
    useEffect(() => {
      const f = (e) => {
        if (e.key !== 'Escape') return;
        const gorunen = [...document.querySelectorAll('.perde')].filter((p) => p.getClientRects().length);
        if (gorunen[gorunen.length - 1] !== perde.current) return;
        e.stopImmediatePropagation();
        kapat();
      };
      window.addEventListener('keydown', f, true);
      return () => window.removeEventListener('keydown', f, true);
    }, [kapat]);
    return html`<div class="perde" ref=${perde} onMouseDown=${(e) => e.target === e.currentTarget && kapat()}>
      <div class=${`modal ${genis ? 'genis' : ''} ${dar ? 'dar' : ''} ${sinif}`} role="dialog" aria-modal="true" aria-label=${baslik}>
        ${baslik && html`<div class="modal-bas"><h2>${baslik}</h2><div class="sag">${sag}<button class="d hayalet ikon-d" onClick=${kapat} aria-label="Kapat"><${Ikon} ad="kapat" /></button></div></div>`}
        ${children}
        ${alt && html`<div class="modal-alt">${alt}</div>`}
      </div>
    </div>`;
  }

  function Alan({ etiket, ipucu, hata, sinif = 's12', children }) {
    return html`<div class=${'alan ' + sinif}>
      ${etiket && html`<label>${etiket}</label>`}
      ${children}
      ${hata ? html`<span class="hata-yazi">${hata}</span>` : ipucu && html`<span class="ipucu">${ipucu}</span>`}
    </div>`;
  }

  function AdetGirdi({ deger, degis, min = 0, otomatikOdak }) {
    const n = Number(deger) || 0;
    return html`<div class="adet-girdi">
      <button type="button" tabindex="-1" onClick=${() => degis(Math.max(min, n - 1))} aria-label="Azalt">−</button>
      <input class="girdi" type="number" inputmode="numeric" min=${min} value=${deger} autofocus=${otomatikOdak} onInput=${(e) => degis(e.target.value === '' ? '' : Number(e.target.value))} />
      <button type="button" tabindex="-1" onClick=${() => degis(n + 1)} aria-label="Artır">+</button>
    </div>`;
  }

  function Oneri({ id, liste }) {
    return html`<datalist id=${id}>${liste.map((x) => html`<option value=${x} />`)}</datalist>`;
  }

  function BosDurum({ ikon = 'liste', baslik, aciklama, children }) {
    return html`<div class="bos-durum"><${Ikon} ad=${ikon} /><h3>${baslik}</h3>${aciklama && html`<p>${aciklama}</p>`}${children}</div>`;
  }

  /* --- Global: bildirim ve onay penceresi --- */
  const ui = { bildirimler: [], onay: null, dinle: new Set() };
  const uiGuncelle = () => ui.dinle.forEach((f) => f());
  function bildir(mesaj, { tur = '', eylem, sure = 4200 } = {}) {
    const b = { id: Math.random(), mesaj, tur, eylem };
    ui.bildirimler = [...ui.bildirimler.slice(-3), b];
    uiGuncelle();
    setTimeout(() => { ui.bildirimler = ui.bildirimler.filter((x) => x !== b); uiGuncelle(); }, sure);
  }
  /* Sonuç: true (evet), false (vazgeç / kapat) ya da 'alternatif' (üçüncü düğme verildiyse ve ona basıldıysa). */
  function onayla(metin, { baslik = 'Emin misiniz?', evet = 'Evet', hayir = 'Vazgeç', alternatif, tehlike = false, detay } = {}) {
    return new Promise((coz) => { ui.onay = { metin, baslik, evet, hayir, alternatif, tehlike, detay, coz }; uiGuncelle(); });
  }
  function GlobalKatman() {
    const [, yenile] = useState(0);
    useEffect(() => { const f = () => yenile((x) => x + 1); ui.dinle.add(f); return () => ui.dinle.delete(f); }, []);
    const o = ui.onay;
    const bitir = (v) => { ui.onay = null; uiGuncelle(); o.coz(v); };
    return html`
      <div class="bildirimler" role="status" aria-live="polite">
        ${ui.bildirimler.map((b) => html`<div key=${b.id} class=${'bildirim ' + b.tur}>
          <span>${b.mesaj}</span>
          ${b.eylem && html`<button onClick=${() => { b.eylem.fn(); ui.bildirimler = ui.bildirimler.filter((x) => x !== b); uiGuncelle(); }}>${b.eylem.yazi}</button>`}
        </div>`)}
      </div>
      ${o && html`<${Modal} baslik=${o.baslik} dar kapat=${() => bitir(false)} alt=${html`
          <button class="d hayalet" onClick=${() => bitir(false)}>${o.hayir}</button>
          ${o.alternatif && html`<button class="d" onClick=${() => bitir('alternatif')}>${o.alternatif}</button>`}
          <button class=${'d ' + (o.tehlike ? 'tehlike' : 'ana-d')} autofocus onClick=${() => bitir(true)}>${o.evet}</button>`}>
        <div class="modal-ic"><p style="margin:0">${o.metin}</p>${o.detay}</div>
      <//>`}`;
  }

  /* Kayıt geçmişi: kim, ne zaman, hangi alanı neden neye çevirdi. */
  const ALAN_ADLARI = {
    tarih: 'Tarih', urun: 'Ürün', parti: 'Parti', ambalaj: 'Ambalaj', adet: 'Adet', hazirlayan: 'Hazırlayan', dolduranlar: 'Dolumu yapanlar', notlar: 'Not',
    firma: 'Firma', yetkili: 'Yetkili', sekil: 'Gönderi şekli', sebep: 'Talep sebebi', durum: 'Durum', kargoFirma: 'Kargo firması',
    takipNo: 'Takip no', adres: 'Adres', kalemler: 'Kalemler', tedarikci: 'Tedarikçi', faturaNo: 'Fatura no', birimFiyat: 'Birim fiyat',
    ekler: 'Ekler', fark: 'Fark', sayilan: 'Sayılan', neden: 'Neden', no: 'Kayıt no', ad: 'Ad', partili: 'Parti takibi', alarm: 'Stok alarmı',
    kritik: 'Kritik seviye', aktif: 'Aktif', etiketNotu: 'Etiket notu',
    ulke: 'Ülke', telefon: 'Telefon', irtibatDetay: 'Diğer iletişim', talepTarihi: 'Talep tarihi', sorumlu: 'Sorumlu', geriBildirim: 'Geri bildirim', numuneYeri: 'Numune noktası', iptal: 'İptal', iptalNeden: 'İptal nedeni', iptalTarihi: 'İptal tarihi', siseler: 'Şişe numaraları', gecmis: 'Açılış sayımından önce (stoka dahil değil)',
    kargoBelge: 'Kargo gönderi belgesi', kaynakTur: 'Nereden dolduruldu', kaynakNo: 'Kaynak no / açıklama',
  };
  /* Modüller kendi alanlarının yazılışını buraya ekleyebilir: NT.ui.DEGER_YAZ.kalemler = (v) => … */
  const DEGER_YAZ = {};
  function degerYaz(a, v) {
    if (v == null || v === '') return '—';
    if (DEGER_YAZ[a]) return DEGER_YAZ[a](v);
    if (a === 'kalemler') return (v || []).map((k) => `${k.adet}× ${k.urun}${k.parti ? ' ' + k.parti : ''} ${k.ambalaj}`).join(', ');
    if (a === 'ekler' || (Array.isArray(v) && v.length && v.every((x) => x && x.dosya))) return `${v.length} dosya`;
    if (Array.isArray(v) && !v.length) return '—';
    if (typeof v === 'boolean') return v ? 'Evet' : 'Hayır';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return NT.c.tarihYaz(v);
    return String(v);
  }
  function Gecmis({ kayit }) {
    if (!kayit) return null;
    const onceki = {};
    const satirlar = kayit._gecmis.map((e, i) => {
      let degisimler = [];
      if (e.op === 'put') {
        for (const [a, v] of Object.entries(e.v || {})) {
          if (i > 0 && JSON.stringify(onceki[a]) !== JSON.stringify(v)) degisimler.push({ a, eski: onceki[a], yeni: v });
          onceki[a] = v;
        }
      }
      const ne = i === 0 ? 'oluşturdu' : e.op === 'del' ? 'sildi' : e.op === 'undel' ? 'geri aldı' : degisimler.length ? 'güncelledi' : 'kaydetti';
      return { e, ne, degisimler };
    });
    return html`<ul class="gecmis">${satirlar.reverse().map(({ e, ne, degisimler }) => html`<li key=${e.id}>
      <div><b>${e.u}</b> ${ne} <span class="soluk kucuk">· ${NT.c.zamanYaz(e.t)}</span></div>
      ${degisimler.map((d) => html`<div class="degisim">${ALAN_ADLARI[d.a] || d.a}: <s>${degerYaz(d.a, d.eski)}</s> → ${degerYaz(d.a, d.yeni)}</div>`)}
    </li>`)}</ul>`;
  }

  /* Kaydın altında açılır kapanır geçmiş şeridi (formun kaydırılan alanının içinde durur). */
  function GecmisBolumu({ kayit }) {
    const [acik, setAcik] = useState(false);
    if (!kayit) return null;
    const son = kayit._gecmis[kayit._gecmis.length - 1];
    return html`<div class="s12 gecmis-bolum">
      <button type="button" class="gecmis-serit" aria-expanded=${acik} onClick=${() => setAcik(!acik)}>
        <${Ikon} ad=${acik ? 'asagi' : 'ok'} boyut=${16} />
        <b>Kayıt geçmişi</b><span class="soluk">${kayit._gecmis.length} işlem</span>
        ${son && html`<span class="soluk kucuk sag">Son: ${son.u} · ${NT.c.zamanYaz(son.t)}</span>`}
      </button>
      ${acik && html`<div class="gecmis-ic"><${Gecmis} kayit=${kayit} /></div>`}
    </div>`;
  }

  /* Ek dosyayı yeni sekmede aç. */
  async function ekAc(ek) {
    try {
      const f = await NT.baglanti.depo.ekOku(ek.dosya);
      window.open(URL.createObjectURL(f), '_blank');
    } catch { bildir('Dosya açılamadı (silinmiş ya da erişim yok).', { tur: 'hata' }); }
  }
  /* Görsel ekin küçük önizlemesi (PDF vb. için simge + ad). */
  function EkOnizleme({ ek }) {
    const [url, setUrl] = useState(null);
    useEffect(() => {
      let u = null, iptal = false;
      setUrl(null);
      if (ek && /^image\//.test(ek.tur || '')) NT.baglanti.depo.ekOku(ek.dosya).then((f) => { if (!iptal) { u = URL.createObjectURL(f); setUrl(u); } }).catch(() => {});
      return () => { iptal = true; if (u) URL.revokeObjectURL(u); };
    }, [ek && ek.dosya]);
    return url ? html`<img src=${url} alt=${ek.ad} />` : html`<span class="ek-simge"><${Ikon} ad="etiket" boyut=${22} /><small>${ek?.ad || ''}</small></span>`;
  }

  /* Dosya ekleri: veri deposuna (bulut) kaydedilir. */
  function Ekler({ ekler = [], degis, salt }) {
    const [yukleniyor, setYukleniyor] = useState(false);
    const girdi = useRef();
    const depo = NT.baglanti.depo;
    const ac = ekAc;
    const ekle = async (e) => {
      const dosyalar = [...e.target.files];
      e.target.value = '';
      if (!dosyalar.length) return;
      const buyuk = dosyalar.find((f) => f.size > 15 * 1024 * 1024);
      if (buyuk) return bildir(`${buyuk.name} 15 MB'tan büyük.`, { tur: 'hata' });
      setYukleniyor(true);
      try {
        const yeni = [];
        for (const f of dosyalar) yeni.push(await depo.ekYaz(f));
        degis([...ekler, ...yeni]);
      } catch (err) { bildir('Dosya yüklenemedi: ' + err.message, { tur: 'hata' }); }
      setYukleniyor(false);
    };
    return html`<div class="dugmeler">
      ${ekler.map((ek) => html`<span class="kalem-cip" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px">
        <a href="#" onClick=${(e) => { e.preventDefault(); ac(ek); }}>${ek.ad}</a>
        ${!salt && html`<button class="d hayalet ikon-d" style="padding:0" title="Kaldır" onClick=${() => degis(ekler.filter((x) => x !== ek))}><${Ikon} ad="kapat" boyut=${13} /></button>`}
      </span>`)}
      ${!salt && html`<button type="button" class="d kucuk-d" disabled=${yukleniyor} onClick=${() => girdi.current.click()}><${Ikon} ad="ataç" boyut=${15} />${yukleniyor ? 'Yükleniyor…' : 'Dosya / fotoğraf ekle'}</button>
      <input ref=${girdi} type="file" multiple class="gizli" onChange=${ekle} />`}
    </div>`;
  }

  /* Büyük fotoğrafı (telefon kamerası) yüklemeden önce küçült: en uzun kenar 2000 px, JPEG. Bulutta yer kaplamasın,
     8 MB sınırına takılmasın. PDF ve küçük resimler olduğu gibi gider. */
  async function resimKucult(f, enBuyuk = 2000) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type || '') || f.size < 1.2 * 1048576) return f;
    try {
      const bmp = await createImageBitmap(f);
      const o = Math.min(1, enBuyuk / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * o); c.height = Math.round(bmp.height * o);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((coz) => c.toBlob(coz, 'image/jpeg', 0.85));
      if (!blob || blob.size >= f.size) return f;
      return new File([blob], f.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch { return f; }
  }

  /* Belirli bir belge için yükleme kutusu (CoA, irsaliye, kargo belgesi…): boşken kesik çizgili, yüklenince yeşil.
     Dosya sürükle-bırak da olur. Değer, Ekler ile aynı biçimde dosya listesidir. `eski`: eski kayıtlardaki numara vb. */
  function BelgeKutusu({ baslik, ipucu, ekler = [], degis, foto, eski, children }) {
    const [yukleniyor, setYukleniyor] = useState(false);
    const [surukle, setSurukle] = useState(false);
    const girdi = useRef();
    const yukle = async (dosyalar) => {
      if (!dosyalar.length) return;
      setYukleniyor(true);
      try {
        const yeni = [];
        for (const f of dosyalar) yeni.push(await NT.baglanti.depo.ekYaz(await resimKucult(f)));
        degis([...ekler, ...yeni]);
      } catch (err) { bildir('Dosya yüklenemedi: ' + err.message, { tur: 'hata' }); }
      setYukleniyor(false);
    };
    const tamam = ekler.length > 0;
    return html`<div class=${'belge-kutu' + (tamam ? ' tamam' : '') + (surukle ? ' surukle' : '')}
      onDragOver=${(e) => { e.preventDefault(); setSurukle(true); }} onDragLeave=${() => setSurukle(false)}
      onDrop=${(e) => { e.preventDefault(); setSurukle(false); yukle([...e.dataTransfer.files]); }}>
      <div class="belge-bas"><${Ikon} ad=${tamam ? 'daire_tik' : foto ? 'kamera' : 'belge'} boyut=${18} /><b>${baslik}</b>${tamam && html`<span class="belge-sayi">${ekler.length}</span>`}</div>
      ${eski && html`<div class="belge-eski">${eski}</div>`}
      ${children}
      ${tamam && html`<div class="belge-dosyalar">${ekler.map((ek) => html`<div class="belge-dosya" key=${ek.dosya}>
        <button type="button" class="belge-onizle" title=${ek.ad + ' — açmak için tıklayın'} onClick=${() => ekAc(ek)}><${EkOnizleme} ek=${ek} /></button>
        <button type="button" class="belge-kaldir" title="Kaldır" onClick=${() => degis(ekler.filter((x) => x !== ek))}><${Ikon} ad="kapat" boyut=${12} /></button>
      </div>`)}</div>`}
      <div class="belge-alt">
        <button type="button" class="d kucuk-d" disabled=${yukleniyor} onClick=${() => girdi.current.click()}><${Ikon} ad="yukle" boyut=${15} />${yukleniyor ? 'Yükleniyor…' : tamam ? 'Ekle' : foto ? 'Fotoğraf yükle' : 'Belge yükle'}</button>
        ${!tamam && !yukleniyor && html`<span class="ipucu">${ipucu || (foto ? 'veya buraya sürükleyin' : 'PDF ya da görsel; buraya da sürükleyebilirsiniz')}</span>`}
      </div>
      <input ref=${girdi} type="file" multiple accept=${foto ? 'image/*' : 'image/*,application/pdf'} class="gizli" onChange=${(e) => { const l = [...e.target.files]; e.target.value = ''; yukle(l); }} />
    </div>`;
  }

  /* Genel Bakış bandının (.tz-selam-bant) arka plan süsü: dalga ve yaprak çizgisi (yalnızca görünüm). */
  const BantSus = () => html`<svg class="tz-selam-sus" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path d="M0 150 C 220 110 440 190 660 145 S 1040 100 1200 135 L1200 200 L0 200 Z" fill="currentColor" opacity=".08" />
    <g fill="none" stroke="currentColor" stroke-width="1.3" opacity=".16"><path d="M1010 20 C 1080 20 1130 70 1130 140 C 1060 140 1010 90 1010 20 Z M1010 20 L1130 140" /></g>
  </svg>`;

  /* Her modülün sol menüsünde: karşılama ekranına (tüm sistemler) dönüş. Sunum modunda sunum modunda kalır. */
  function AnaEkranLinki() {
    return html`<a class="tz-anaekran" href=${NT.c.adres('portal')} title="Karşılama ekranına dön"><${Ikon} ad="geri" boyut=${15} />Tüm sistemler</a>`;
  }

  /* Adım adım kurulum hatası: başlık + ne yapmalı + teknik ayrıntı (bize iletmek için) */
  function HataKutusu({ hata }) {
    if (!hata) return null;
    const e = typeof hata === 'string' ? { message: hata } : hata;
    return html`<div class="uyari-kutu yok" role="alert"><${Ikon} ad="uyari" /><span>
      <b>${e.message}</b>${e.ipucu && html`<br />${e.ipucu}`}
      ${e.detay && html`<br /><span class="mono" style="font-size:11.5px;opacity:.8">Teknik ayrıntı: ${e.detay}</span>`}
    </span></div>`;
  }

  NT.ui = { HataKutusu, ekAc, EkOnizleme, Ikon, YOLLAR, Sise, StokRozeti, SevkRozeti, Parti, Avatar, Modal, Alan, AdetGirdi, Oneri, BosDurum, GlobalKatman, Gecmis, GecmisBolumu, Ekler, BelgeKutusu, resimKucult, bildir, onayla, ALAN_ADLARI, DEGER_YAZ, DURUM_BILGI, AnaEkranLinki, BantSus };
})();
