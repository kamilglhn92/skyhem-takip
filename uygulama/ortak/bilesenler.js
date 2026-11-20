/* Ortak arayüz parçaları: ikonlar, modal, alan, rozet, bildirim, onay penceresi. */
(function () {
  'use strict';
  const NT = window.NT;
  const { t: cevir } = NT.dil;
  const { html, useState, useEffect, useLayoutEffect, useRef } = window.htmPreact;
  const { basHarfler } = NT.c;

  /* --- İkonlar (1.8px çizgi, 24'lük kutu) --- */
  const YOLLAR = {
    ozet: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z',
    grafik: 'M3 3v18h18M7 15l4-4 3 3 5-6',
    stok: 'M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4',
    dolum: 'M12 3s6 6.2 6 11a6 6 0 01-12 0c0-4.8 6-11 6-11z',
    damacana: 'M10 2h4v3h-4zM10 5v1.5C7 7.3 5.5 9.3 5.5 12v8a2 2 0 002 2h9a2 2 0 002-2v-8c0-2.7-1.5-4.7-4.5-5.5V5M5.5 14h13M5.5 18h13',
    simsek: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
    alev: 'M12 2.5c.7 3.6 5.5 6 5.5 11a5.5 5.5 0 01-11 0c0-2.2 1-3.7 2.2-4.8.2 1.7.9 2.7 1.8 3.1-.3-3.6.2-6.6 1.5-9.3z',
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
    dunya: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM2 12h20M12 2a16 16 0 0 1 0 20 16 16 0 0 1 0-20z',
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

  function AmbalajCizimi({ tur, boyut = 1 }) {
    const tip = { IBC: 'IBC', Varil: 'Varil', 'İsotank': 'isotank', 'Dökme': 'dokme' }[tur];
    if (!tip) return html`<${NT.ui.Sise} litre=${5} boyut=${boyut} />`;
    const genis = tip === 'isotank' || tip === 'dokme';
    return html`<span class=${'amb-cizim nt-amb-resim nt-amb-' + tip} aria-hidden="true" style=${{ width: (genis ? 62 : 42) * boyut, height: 42 * boyut }}></span>`;
  }

  /* Hacme göre ölçeklenen gerçekçi kaplar. 10/20 L: kullanıcının kırmızı kapaklı bidonları. */
  function Sise({ litre = 1, boyut = 1 }) {
    const gercek = Number(litre) || 1;
    const l = Math.max(0.25, gercek);
    const h = Math.round((16 + Math.sqrt(l) * 9) * boyut);
    const w = Math.round((9 + Math.sqrt(l) * 6.2) * boyut);
    const tip = gercek <= .1 ? 0 : gercek <= .25 ? 1 : gercek <= .5 ? 2 : gercek < 5 ? 3 : gercek < 10 ? 4 : gercek < 20 ? 5 : 6;
    return html`<span class="nt-sise" data-litre=${gercek} aria-hidden="true" style=${{ width: w + 4, height: h + 2 }}><span class=${'nt-sise-resim nt-sise-' + tip}></span></span>`;
  }

  const DURUM_BILGI = {
    iyi: { ikon: 'daire_tik', yazi: 'Yeterli' },
    kritik: { ikon: 'uyari', yazi: 'Kritik' },
    yok: { ikon: 'yasak', yazi: 'Tükendi' },
    eksi: { ikon: 'yasak', yazi: 'Eksiye düştü' },
  };
  function StokRozeti({ durum }) {
    const b = DURUM_BILGI[durum] || DURUM_BILGI.iyi;
    return html`<span class=${'rozet ' + durum}><${Ikon} ad=${b.ikon} />${cevir(b.yazi)}</span>`;
  }
  const SEVK_ROZET = {
    'Karar Aşaması': { s: 'mor', ikon: 'saat' },
    Beklemede: { s: 'kritik', ikon: 'saat' },
    'Etiket Bekliyor': { s: 'bilgi', ikon: 'etiket' },
    Gönderildi: { s: 'iyi', ikon: 'daire_tik' },
  };
  function SevkRozeti({ durum }) {
    const b = SEVK_ROZET[durum] || { s: '', ikon: 'bilgi' };
    return html`<span class=${'rozet ' + b.s}><${Ikon} ad=${b.ikon} />${cevir(durum)}</span>`;
  }
  function Parti({ parti }) {
    return parti ? html`<span class="parti">${parti}</span>` : html`<span class="parti yok-parti">${cevir("Partisiz")}</span>`;
  }

  const RENKLER = ['#2e7d32', '#2f5f8a', '#8a4b0f', '#6a3fa0', '#0f766e', '#9f1239', '#4d7c0f', '#1e40af'];
  function Avatar({ ad, kucuk }) {
    let h = 0;
    for (const ch of String(ad)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return html`<span class=${'avatar' + (kucuk ? ' kucuk-av' : '')} style=${{ background: RENKLER[h % RENKLER.length] }} title=${ad}>${basHarfler(ad)}</span>`;
  }

  function Modal({ baslik, kapat, genis, dar, sag, alt, children, sinif = '', odagiKoru }) {
    const perde = useRef();
    useLayoutEffect(() => {
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
    function sekmeTusu(e) {
      if (e.key !== 'Tab') return;
      const elemanlar = [...e.currentTarget.querySelectorAll('button, input, textarea, a[href], select, [tabindex="0"]')]
        .filter((el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
      if (!elemanlar.length) return;
      const sinir = e.shiftKey ? elemanlar[0] : elemanlar[elemanlar.length - 1];
      if (document.activeElement === sinir) {
        e.preventDefault();
        (e.shiftKey ? elemanlar[elemanlar.length - 1] : elemanlar[0]).focus();
      }
    }
    return html`<div class="perde" ref=${perde} onMouseDown=${(e) => e.target === e.currentTarget && kapat()}>
      <div class=${`modal ${genis ? 'genis' : ''} ${dar ? 'dar' : ''} ${sinif}`} role="dialog" aria-modal="true" aria-label=${cevir(baslik)} onKeyDown=${odagiKoru ? sekmeTusu : undefined}>
        ${baslik && html`<div class="modal-bas"><h2>${cevir(baslik)}</h2><div class="sag">${sag}<button class="d hayalet ikon-d" onClick=${kapat} aria-label=${cevir("Kapat")}><${Ikon} ad="kapat" /></button></div></div>`}
        ${children}
        ${alt && html`<div class="modal-alt">${alt}</div>`}
      </div>
    </div>`;
  }

  function KartDetayDugmesi({ no, firma, ac }) {
    const etiket = cevir('Detayları görüntüle', 'View details');
    return html`<button type="button" class="firma tz-kart-detay-dugme" onClick=${ac}
      aria-label=${[etiket, no, firma].filter(Boolean).join(' · ')}>${firma || no}</button>`;
  }

  function KayitDetay({ baslik, kapat, durum, ozet, children }) {
    const govde = useRef();
    useEffect(() => {
      const onceki = document.activeElement;
      govde.current?.focus();
      return () => { if (onceki?.isConnected) onceki.focus(); };
    }, []);
    return html`<${Modal} genis sinif="tz-detay-modal" baslik=${cevir(baslik)} sag=${durum} kapat=${kapat}>
      <div class="modal-ic tz-detay-govde" ref=${govde} tabIndex="-1">
        <dl class="tz-detay-ozet">${ozet.filter(([, deger]) => deger || deger === 0).map(([ad, deger]) => html`<div key=${ad}>
          <dt>${ad}</dt><dd>${deger}</dd>
        </div>`)}</dl>
        ${children}
      </div>
    <//>`;
  }

  function DetayEkleri({ ekler }) {
    const [secili, sec] = useState(null);
    const gorsel = ekler.find((ek) => ek.dosya === secili);
    return html`
      <ul class="tz-detay-ekler">${ekler.map((ek) => {
        const resim = /^image\//i.test(ek.tur || '');
        const acik = resim && ek.dosya === secili;
        return html`<li key=${ek.dosya}><button type="button" title=${ek.ad}
          aria-expanded=${resim ? acik : undefined} onClick=${() => resim ? sec(acik ? null : ek.dosya) : ekAc(ek)}>
          <span class="tz-detay-ek-simge" aria-hidden="true">${resim ? html`<${EkOnizleme} ek=${ek} />`
            : html`<${Ikon} ad="belge" boyut=${22} />`}</span>
          <span class="tz-detay-ek-ad">${ek.ad}</span>
        </button></li>`;
      })}</ul>
      ${gorsel && html`<figure class="tz-detay-ek-onizleme"><${EkOnizleme} ek=${gorsel} /></figure>`}`;
  }

  function DetayBolumu({ baslik, ikon, gorsel, alanlar = [], belgeler = [], children }) {
    const dolu = (v) => v != null && v !== '' && v !== false;
    const alan = alanlar.filter(([, v]) => dolu(v));
    const dosya = belgeler.filter(([, ek, eski]) => ek?.length || dolu(eski));
    if (!alan.length && !dosya.length && !children && !gorsel) return null;
    return html`<section class="tz-detay-bolum">
      <h3>${gorsel || (ikon && html`<span class="tz-detay-simge"><${Ikon} ad=${ikon} boyut=${16} /></span>`)}<span>${cevir(baslik)}</span></h3>
      ${(alan.length > 0 || dosya.length > 0) && html`<dl class="tz-detay-alanlar">
        ${alan.map(([ad, v, genis]) => html`<div key=${ad} class=${genis ? "tz-detay-genis" : ""}><dt>${ad}</dt><dd>${v}</dd></div>`)}
        ${dosya.map(([ad, ek, eski]) => html`<div key=${ad} class="tz-detay-belge"><dt>${ad}</dt><dd>
          ${dolu(eski) && eski}${ek?.length > 0 && html`<${DetayEkleri} ekler=${ek} />`}
        </dd></div>`)}
      </dl>`}
      ${children}
    </section>`;
  }

  function Alan({ etiket, ipucu, hata, sinif = 's12', children }) {
    return html`<div class=${'alan ' + sinif}>
      ${etiket && html`<label>${cevir(etiket)}</label>`}
      ${children}
      ${hata ? html`<span class="hata-yazi">${cevir(hata)}</span>` : ipucu && html`<span class="ipucu">${cevir(ipucu)}</span>`}
    </div>`;
  }

  function AdetGirdi({ deger, degis, min = 0, otomatikOdak }) {
    const n = Number(deger) || 0;
    return html`<div class="adet-girdi">
      <button type="button" tabindex="-1" onClick=${() => degis(Math.max(min, n - 1))} aria-label=${cevir("Azalt")}>−</button>
      <input class="girdi" type="number" inputmode="numeric" min=${min} value=${deger} autofocus=${otomatikOdak} onInput=${(e) => degis(e.target.value === '' ? '' : Number(e.target.value))} />
      <button type="button" tabindex="-1" onClick=${() => degis(n + 1)} aria-label=${cevir("Artır")}>+</button>
    </div>`;
  }

  function Oneri({ id, liste }) {
    return html`<datalist id=${id}>${liste.map((x) => html`<option value=${x} />`)}</datalist>`;
  }

  function BosDurum({ ikon = 'liste', baslik, aciklama, children }) {
    return html`<div class="bos-durum"><${Ikon} ad=${ikon} /><h3>${cevir(baslik)}</h3>${aciklama && html`<p>${aciklama}</p>`}${children}</div>`;
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

  const ONERI_PANELLERI = {
    portal: ['Panel seçimi', 'Panel selection'], yonetim: ['Yönetim paneli', 'Management panel'],
    personel: ['Personel paneli', 'Staff panel'], 'personel-talepleri': ['Personel talepleri', 'Staff requests'],
    uretim: ['Üretim', 'Production'], numune: ['Numune Takip', 'Sample tracking'], satis: ['Satış Takip', 'Sales tracking'],
    klips: ['Klips Takip', 'Seal tracking'], su: ['İçme Suyu', 'Drinking water'], yemek: ['Yemek', 'Meals'],
    yoklama: ['Yoklama', 'Attendance'], enerji: ['Enerji', 'Energy'],
  };
  const oneriPanelAdi = (id) => cevir(...(Object.hasOwn(ONERI_PANELLERI, id) ? ONERI_PANELLERI[id] : ONERI_PANELLERI.portal));
  const ONERI_SAYFA = 25;
  const DEMO_ONERILERI = 'nt.sunum.uygulama-onerileri';
  function sunumOnerileri() {
    try {
      const kayitlar = JSON.parse(localStorage.getItem(DEMO_ONERILERI) || '[]');
      return Array.isArray(kayitlar) ? kayitlar : [];
    } catch { return []; }
  }

  function UygulamaOnerileri({ demo }) {
    const [sayfa, setSayfa] = useState(0);
    const [sonuc, setSonuc] = useState({ kayitlar: null, hata: false });
    const [tekrar, setTekrar] = useState(0);
    useEffect(() => {
      let guncel = true;
      const bas = ONERI_SAYFA * sayfa;
      setSonuc({ kayitlar: null, hata: false });
      const oku = async () => {
        try {
          const kayitlar = demo ? sunumOnerileri().slice(bas, bas + ONERI_SAYFA + 1)
            : await NT.bulut.uygulamaOnerileriniOku(bas, ONERI_SAYFA + 1);
          if (guncel) setSonuc({ kayitlar, hata: false });
        } catch {
          if (guncel) setSonuc({ kayitlar: null, hata: true });
        }
      };
      oku();
      return () => { guncel = false; };
    }, [sayfa, tekrar, demo]);
    if (sonuc.hata) return html`<p role="alert">${cevir('Öneri kutusu açılmadı.', 'The suggestion inbox could not be opened.')}
      <button type="button" class="d kucuk-d" onClick=${() => setTekrar((x) => x + 1)}>${cevir('Tekrar dene', 'Try again')}</button></p>`;
    if (!sonuc.kayitlar) return html`<p role="status" class="soluk">${cevir('Yükleniyor…')}</p>`;
    return html`${sonuc.kayitlar.length ? html`<ul class="op-gelen" tabindex="0" aria-label=${cevir('Uygulama önerileri', 'App suggestions')}>${sonuc.kayitlar.slice(0, ONERI_SAYFA).map((x) => html`<li key=${x.id}>
      <small>${oneriPanelAdi(x.panel)} · ${x.gonderen} ·
        <time dateTime=${x.olusturuldu}>${NT.c.tarihYaz(NT.c.bugun(new Date(x.olusturuldu)))}</time></small>
      <p>${x.metin}</p>
    </li>`)}</ul>` : html`<p class="soluk">${cevir('Henüz uygulama önerisi yok.', 'There are no app suggestions yet.')}</p>`}
      ${(sayfa > 0 || sonuc.kayitlar.length > ONERI_SAYFA) && html`<div class="op-sayfalama">
        <button type="button" class="d kucuk-d" disabled=${sayfa === 0} onClick=${() => setSayfa(sayfa - 1)}>${cevir('Önceki', 'Previous')}</button>
        <button type="button" class="d kucuk-d" disabled=${sonuc.kayitlar.length <= ONERI_SAYFA} onClick=${() => setSayfa(sayfa + 1)}>${cevir('Sonraki', 'Next')}</button>
      </div>`}`;
  }

  function OneriPostasiPenceresi({ panel, demo, mimar, ad, kapat, durgun, hareketDegistir }) {
    const [gelen, setGelen] = useState(false);
    const [metin, setMetin] = useState('');
    const [mesgul, setMesgul] = useState(false);
    const [hata, setHata] = useState('');
    const girdi = useRef();
    const kilit = useRef(false);
    useEffect(() => { if (!gelen) girdi.current?.focus(); }, [gelen]);
    async function gonder(e) {
      e.preventDefault();
      const temiz = metin.trim();
      if (kilit.current || temiz.length < 5 || temiz.length > 1500) return;
      kilit.current = true;
      setMesgul(true);
      setHata('');
      try {
        if (demo) {
          const kayit = { id: NT.c.uid(), panel, metin: temiz, gonderen: ad, olusturuldu: new Date().toISOString() };
          localStorage.setItem(DEMO_ONERILERI, JSON.stringify([kayit, ...sunumOnerileri()]));
        } else {
          await NT.bulut.uygulamaOnerisiYaz(panel, temiz);
        }
        kapat();
        bildir(cevir('Uygulama öneriniz kaydedildi.', 'Your app suggestion was saved.'));
      } catch {
        setHata(cevir('Öneri kaydedilemedi. Bağlantıyı kontrol edip tekrar deneyin.', 'The suggestion could not be saved. Check your connection and try again.'));
      } finally {
        kilit.current = false;
        setMesgul(false);
      }
    }
    return html`<${Modal} dar odagiKoru baslik=${cevir('Öneri Postası', 'Suggestion Mailbox')}
      kapat=${() => { if (!kilit.current) kapat(); }}
      alt=${html`<div class="sol"><button type="button" class="d hayalet kucuk-d" onClick=${hareketDegistir}>${cevir(durgun ? 'Hareketi aç' : 'Hareketi durdur', durgun ? 'Enable motion' : 'Pause motion')}</button></div>
        ${!gelen && html`<button type="submit" form="op-form" class="d ana-d" disabled=${mesgul || metin.trim().length < 5}>${mesgul ? cevir('Gönderiliyor…', 'Sending…') : cevir('Öneriyi gönder', 'Send suggestion')}</button>`}`}>
      <div class="modal-ic op-pencere">
        ${mimar && html`<div class="op-sekmeler">
          <button type="button" class="d kucuk-d" disabled=${mesgul} aria-pressed=${!gelen} onClick=${() => setGelen(false)}>${cevir('Öneri yaz', 'Write a suggestion')}</button>
          <button type="button" class="d kucuk-d" disabled=${mesgul} aria-pressed=${gelen} onClick=${() => setGelen(true)}>${cevir('Uygulama öneri kutusu', 'App suggestion inbox')}</button>
        </div>`}
        ${gelen ? html`<${UygulamaOnerileri} demo=${demo} />` : html`<form id="op-form" onSubmit=${gonder}>
          <p class="op-panel">${oneriPanelAdi(panel)}</p>
          <label for="op-metin">${cevir('SKYHEM Takip’te neyi iyileştirebiliriz?', 'What could we improve in SKYHEM Takip?')}</label>
          <textarea id="op-metin" ref=${girdi} class="girdi" rows="4" maxlength="1500" value=${metin} onInput=${(e) => setMetin(e.target.value)} readonly=${mesgul} aria-describedby="op-bilgi"></textarea>
          <small id="op-bilgi" class="soluk">${cevir('Önerin, adınla birlikte sistem mimarına gider.', 'Your suggestion goes to the system architect with your name.')}</small>
          ${hata && html`<p role="alert" class="op-hata">${hata}</p>`}
        </form>`}
      </div>
    <//>`;
  }

  const POSTA_AYARI = 'nt.oneri-postasi.';
  function postaAyarOku(alan) {
    try { return JSON.parse(sessionStorage.getItem(POSTA_AYARI + alan)); } catch { return null; }
  }
  function postaAyarYaz(alan, deger) {
    try { sessionStorage.setItem(POSTA_AYARI + alan, JSON.stringify(deger)); } catch { /* oturum ayarı isteğe bağlı */ }
  }
  function postaSinirla(x, y) {
    const sinir = (n, boyut) => Math.max(8, Math.min(Math.round(n), boyut - 56));
    return { x: sinir(x, window.innerWidth), y: sinir(y, window.innerHeight) };
  }
  function OneriPostasi({ panel, demo, mimar, ad }) {
    const [konum, setKonum] = useState(() => {
      const kayitli = postaAyarOku('konum');
      return Number.isFinite(kayitli?.x) && Number.isFinite(kayitli?.y) ? postaSinirla(kayitli.x, kayitli.y) : null;
    });
    const [durgun, setDurgun] = useState(() => postaAyarOku('durgun') === true);
    const [acik, setAcik] = useState(false);
    const dugme = useRef();
    const surukleme = useRef(null);
    const tasindi = useRef(false);
    useEffect(() => {
      const boyutDegisti = () => setKonum((k) => k ? postaSinirla(k.x, k.y) : null);
      window.addEventListener('resize', boyutDegisti);
      return () => window.removeEventListener('resize', boyutDegisti);
    }, []);
    function baslat(e) {
      if (!e.isPrimary || e.button !== 0) return;
      const kutu = e.currentTarget.getBoundingClientRect();
      tasindi.current = false;
      surukleme.current = { id: e.pointerId, x: e.clientX, y: e.clientY, sol: kutu.left, ust: kutu.top };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    function tasi(e) {
      const s = surukleme.current;
      if (!s || s.id !== e.pointerId) return;
      const x = e.clientX - s.x, y = e.clientY - s.y;
      if (!tasindi.current && Math.hypot(x, y) < 6) return;
      tasindi.current = true;
      s.konum = postaSinirla(s.sol + x, s.ust + y);
      setKonum(s.konum);
    }
    function bitir(e) {
      const s = surukleme.current;
      if (s?.id !== e.pointerId) return;
      if (s.konum) postaAyarYaz('konum', s.konum);
      surukleme.current = null;
    }
    function klavyeyleTasi(e) {
      const yon = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[e.key];
      if (!yon) return;
      e.preventDefault();
      const kutu = e.currentTarget.getBoundingClientRect();
      const yeni = postaSinirla(kutu.left + yon[0], kutu.top + yon[1]);
      setKonum(yeni);
      postaAyarYaz('konum', yeni);
    }
    function kapat() {
      setAcik(false);
      requestAnimationFrame(() => dugme.current?.focus({ preventScroll: true }));
    }
    const etiket = cevir('Uygulama önerisi', 'App suggestion');
    return html`<button ref=${dugme} type="button" class=${'op-posta' + (konum ? ' sabit' : '') + (durgun ? ' hareket-kapali' : '')} aria-label=${etiket}
      aria-description=${cevir('Yön tuşlarıyla yerini değiştirin.', 'Use the arrow keys to move it.')} aria-haspopup="dialog"
      style=${konum ? { left: konum.x + 'px', top: konum.y + 'px', right: 'auto', bottom: 'auto' } : undefined}
      onPointerDown=${baslat} onPointerMove=${tasi} onPointerUp=${bitir} onPointerCancel=${bitir} onLostPointerCapture=${bitir} onKeyDown=${klavyeyleTasi}
      onClick=${(e) => { if (!tasindi.current || e.detail === 0) setAcik(true); }}>
        <span class="op-maskot" aria-hidden="true">
          <i class="op-golge"></i>
          <span class="op-sandik"><i class="op-on"></i><i class="op-sag"></i><i class="op-kapak"></i><i class="op-zarf"></i></span>
        </span>
      </button>
      ${acik && html`<${OneriPostasiPenceresi} ...${{ panel, demo, mimar, ad, kapat, durgun }}
        hareketDegistir=${() => { postaAyarYaz('durgun', !durgun); setDurgun(!durgun); }} />`}`;
  }

  function Yenilikler({ surum, notlar, hesap, ad }) {
    const [acik, setAcik] = useState(false);
    const [metin, setMetin] = useState('');
    const pencere = useRef();
    const anahtar = 'nt.surum-okundu.' + (hesap?.kullanici || 'yerel.' + ad) + '.' + surum;
    const yerelOku = () => { try { return localStorage.getItem(anahtar); } catch { return null; } };
    const yerelYaz = (v) => { try { localStorage.setItem(anahtar, v); } catch { /* Bu tarayıcıda depo kapalı. */ } };
    useEffect(() => {
      let aktif = true;
      const digerSekme = (e) => { if (e.key === anahtar && e.newValue) setAcik(false); };
      async function getir() {
        const durum = yerelOku();
        if (durum === 'bekliyor' && hesap) {
          await NT.bulut.surumOkunduYaz(surum).then(() => yerelYaz('evet')).catch(() => {});
        } else if (!durum) {
          const okundu = hesap && await NT.bulut.surumOkunduMu(surum).catch(() => false);
          if (okundu) { yerelYaz('evet'); return; }
          const yazi = notlar || await NT.bulut.surumNotlari(surum, NT.baglanti.kod || '').catch(() => '');
          if (aktif && yazi.trim() && !yerelOku()) { setMetin(yazi); setAcik(true); }
        }
      }
      window.addEventListener('storage', digerSekme);
      window.addEventListener('online', getir);
      getir();
      return () => { aktif = false; window.removeEventListener('storage', digerSekme); window.removeEventListener('online', getir); };
    }, [anahtar]);
    useLayoutEffect(() => {
      if (acik && pencere.current && !pencere.current.open) pencere.current.showModal();
    }, [acik]);
    function okudum() {
      yerelYaz(hesap ? 'bekliyor' : 'evet');
      pencere.current?.close();
      setAcik(false);
      if (hesap) NT.bulut.surumOkunduYaz(surum).then(() => yerelYaz('evet')).catch(() => {});
    }
    if (!acik) return null;
    const maddeler = metin.split(/\r?\n/).map((s) => s.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean);
    return html`<dialog class="modal dar nt-yenilikler" ref=${pencere} aria-labelledby="nt-yenilik-baslik" onCancel=${(e) => e.preventDefault()}>
      <div class="modal-bas"><h2 id="nt-yenilik-baslik">${cevir('Bu sürümde neler yeni?')}</h2><span class="rozet iyi">${NT.c.surumYaz(surum)}</span></div>
      <div class="modal-ic"><ul class="nt-yenilik-listesi">${maddeler.map((s) => html`<li>${cevir(s)}</li>`)}</ul></div>
      <div class="modal-alt"><button type="button" class="d ana-d" autofocus onClick=${okudum}><${Ikon} ad="tik" />${cevir('Okudum')}</button></div>
    </dialog>`;
  }

  function GlobalKatman() {
    const [, yenile] = useState(0);
    useEffect(() => { const f = () => yenile((x) => x + 1); ui.dinle.add(f); return () => ui.dinle.delete(f); }, []);
    const o = ui.onay;
    const bitir = (v) => { ui.onay = null; uiGuncelle(); o.coz(v); };
    const b = NT.baglanti;
    const q = new URLSearchParams(location.search);
    const demo = q.has('demo');
    const modul = b.modul.id;
    const panel = modul === 'uretimstok' ? 'uretim' : modul === 'portal' && q.get('panel') === 'yonetim' ? 'yonetim'
      : modul === 'personel' && b.modul.ad === 'Personel talepleri' ? 'personel-talepleri' : modul;
    const hesap = NT.c.hesap();
    const postaVar = (b.durum === 'hazir' || (demo && modul === 'portal')) && (demo || !!hesap);
    const demoAdi = q.get('kullanici') || (modul === 'portal' ? 'Farukcan Bey' : b.kullanici);
    const surum = window.NT_SURUM_AKTIF;
    return html`
      ${!demo && b.durum === 'hazir' && Number(surum?.surum) >= 21 &&
        html`<${Yenilikler} key=${surum.surum + ':' + (hesap?.kullanici || b.kullanici)} surum=${Number(surum.surum)} notlar=${surum.notlar} hesap=${hesap} ad=${b.kullanici} />`}
      ${postaVar && html`<${OneriPostasi} panel=${panel} demo=${demo} ad=${demo ? demoAdi || 'Sunum' : hesap.ad}
        mimar=${demo ? ['kamil', 'kamil gülhan'].includes(NT.c.kucuk(demoAdi)) : hesap.mimar} />`}
      <div class="bildirimler" role="status" aria-live="polite">
        ${ui.bildirimler.map((b) => html`<div key=${b.id} class=${'bildirim ' + b.tur}>
          <span>${b.mesaj}</span>
          ${b.eylem && html`<button onClick=${() => { b.eylem.fn(); ui.bildirimler = ui.bildirimler.filter((x) => x !== b); uiGuncelle(); }}>${cevir(b.eylem.yazi)}</button>`}
        </div>`)}
      </div>
      ${o && html`<${Modal} baslik=${cevir(o.baslik)} dar kapat=${() => bitir(false)} alt=${html`
          <button class="d hayalet" onClick=${() => bitir(false)}>${cevir(o.hayir)}</button>
          ${o.alternatif && html`<button class="d" onClick=${() => bitir('alternatif')}>${cevir(o.alternatif)}</button>`}
          <button class=${'d ' + (o.tehlike ? 'tehlike' : 'ana-d')} autofocus onClick=${() => bitir(true)}>${cevir(o.evet)}</button>`}>
        <div class="modal-ic"><p style="margin:0">${cevir(o.metin)}</p>${o.detay}</div>
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
    if (a === 'ekler' || (Array.isArray(v) && v.length && v.every((x) => x && x.dosya))) return NT.dil.m('{0} dosya', v.length);
    if (Array.isArray(v) && !v.length) return '—';
    if (typeof v === 'boolean') return v ? cevir('Evet') : cevir('Hayır');
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
      <div><b>${e.u}</b> ${cevir(ne)} <span class="soluk kucuk">· ${NT.c.zamanYaz(e.t)}</span></div>
      ${degisimler.map((d) => html`<div class="degisim">${cevir(ALAN_ADLARI[d.a] || d.a)}: <s>${degerYaz(d.a, d.eski)}</s> → ${degerYaz(d.a, d.yeni)}</div>`)}
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
        <b>${cevir("Kayıt geçmişi")}</b><span class="soluk">${kayit._gecmis.length} ${cevir("işlem")}</span>
        ${son && html`<span class="soluk kucuk sag">${cevir("Son:")} ${son.u} · ${NT.c.zamanYaz(son.t)}</span>`}
      </button>
      ${acik && html`<div class="gecmis-ic"><${Gecmis} kayit=${kayit} /></div>`}
    </div>`;
  }

  /* Ek dosyayı yeni sekmede aç. */
  async function ekAc(ek) {
    try {
      const f = await NT.baglanti.depo.ekOku(ek.dosya);
      window.open(URL.createObjectURL(f), '_blank');
    } catch { bildir(cevir("Dosya açılamadı (silinmiş ya da erişim yok)."), { tur: 'hata' }); }
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
  function Ekler({ ekler = [], degis, salt, gizli }) {
    const [yukleniyor, setYukleniyor] = useState(false);
    const girdi = useRef();
    const depo = NT.baglanti.depo;
    const ac = ekAc;
    const ekle = async (e) => {
      const dosyalar = [...e.target.files];
      e.target.value = '';
      if (!dosyalar.length) return;
      const buyuk = dosyalar.find((f) => f.size > 15 * 1024 * 1024);
      if (buyuk) return bildir(NT.dil.m("{0} 15 MB'tan büyük.", buyuk.name), { tur: 'hata' });
      setYukleniyor(true);
      try {
        const yeni = [];
        for (const f of dosyalar) yeni.push(await depo.ekYaz(f, { gizli: !!gizli }));
        degis([...ekler, ...yeni]);
      } catch (err) { bildir(cevir('Dosya yüklenemedi', 'File upload failed') + ': ' + err.message, { tur: 'hata' }); }
      setYukleniyor(false);
    };
    return html`<div class="dugmeler">
      ${ekler.map((ek) => html`<span class="kalem-cip" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px">
        <a href="#" onClick=${(e) => { e.preventDefault(); ac(ek); }}>${ek.ad}</a>
        ${!salt && html`<button class="d hayalet ikon-d" style="padding:0" title=${cevir("Kaldır")} onClick=${() => degis(ekler.filter((x) => x !== ek))}><${Ikon} ad="kapat" boyut=${13} /></button>`}
      </span>`)}
      ${!salt && html`<button type="button" class="d kucuk-d" disabled=${yukleniyor} onClick=${() => girdi.current.click()}><${Ikon} ad="ataç" boyut=${15} />${yukleniyor ? cevir("Yükleniyor…") : cevir("Dosya / fotoğraf ekle")}</button>
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
  /* kamera: telefonda dosya seçici yerine doğrudan arka kamerayı açar (capture="environment"); masaüstünde dosya seçimi kalır. */
  function BelgeKutusu({ baslik, ipucu, ekler = [], degis, foto, kamera, kameraVeGaleri, eski, gizli, talep,
    kilitli, yuklemeDegis, children }) {
    const [yukleniyor, setYukleniyor] = useState(false);
    const [surukle, setSurukle] = useState(false);
    const girdi = useRef();
    const kameraGirdisi = useRef();
    const yukleme = useRef(false);
    const ikiSecenek = foto && kameraVeGaleri;
    const yukle = async (dosyalar) => {
      if (!dosyalar.length || kilitli || yukleme.current) return;
      yukleme.current = true;
      setYukleniyor(true);
      yuklemeDegis?.(true);
      try {
        const yeni = [];
        for (const f of dosyalar) yeni.push(await NT.baglanti.depo.ekYaz(await resimKucult(f), { gizli: !!gizli, talep: !!talep }));
        degis([...ekler, ...yeni]);
      } catch (err) {
        bildir(cevir('Dosya yüklenemedi', 'File upload failed') + ': ' + err.message, { tur: 'hata' });
      } finally {
        yukleme.current = false;
        setYukleniyor(false);
        yuklemeDegis?.(false);
      }
    };
    const dosyaSecildi = (e) => {
      const dosyalar = [...e.currentTarget.files];
      e.currentTarget.value = '';
      yukle(dosyalar);
    };
    const devreDisi = kilitli || yukleniyor;
    const tamam = ekler.length > 0;
    return html`<div class=${'belge-kutu' + (tamam ? ' tamam' : '') + (surukle ? ' surukle' : '')}
      onDragOver=${(e) => { e.preventDefault(); setSurukle(true); }} onDragLeave=${() => setSurukle(false)}
      onDrop=${(e) => { e.preventDefault(); setSurukle(false); yukle([...e.dataTransfer.files]); }}>
      <div class="belge-bas"><${Ikon} ad=${tamam ? 'daire_tik' : foto ? 'kamera' : 'belge'} boyut=${18} /><b>${cevir(baslik)}</b>${tamam && html`<span class="belge-sayi">${ekler.length}</span>`}</div>
      ${eski && html`<div class="belge-eski">${eski}</div>`}
      ${children}
      ${tamam && html`<div class="belge-dosyalar">${ekler.map((ek) => html`<div class="belge-dosya" key=${ek.dosya}>
        <button type="button" class="belge-onizle" title=${ek.ad + ' — ' + cevir('açmak için tıklayın', 'click to open')} onClick=${() => ekAc(ek)}><${EkOnizleme} ek=${ek} /></button>
        <button type="button" class="belge-kaldir" disabled=${devreDisi} title=${cevir("Kaldır")} onClick=${() => degis(ekler.filter((x) => x !== ek))}><${Ikon} ad="kapat" boyut=${12} /></button>
      </div>`)}</div>`}
      <div class="belge-alt">
        <button type="button" class="d kucuk-d" disabled=${devreDisi} onClick=${() => girdi.current.click()}><${Ikon} ad="yukle" boyut=${15} />${yukleniyor ? cevir("Yükleniyor…") : ikiSecenek ? cevir("Galeriden seç", "Choose from gallery") : tamam ? cevir("Ekle") : kamera ? cevir("Fotoğraf çek", "Take a photo") : foto ? cevir("Fotoğraf yükle") : cevir("Belge yükle")}</button>
        ${ikiSecenek && html`<button type="button" class="d kucuk-d" disabled=${devreDisi} onClick=${() => kameraGirdisi.current.click()}><${Ikon} ad="kamera" boyut=${15} />${cevir("Kamerayla çek", "Take a photo")}</button>`}
        ${!tamam && !yukleniyor && html`<span class="ipucu">${ipucu || (foto ? cevir("veya buraya sürükleyin") : cevir("PDF ya da görsel; buraya da sürükleyebilirsiniz"))}</span>`}
      </div>
      <input ref=${girdi} type="file" multiple accept=${foto ? 'image/*' : 'image/*,application/pdf'} capture=${foto && kamera && !ikiSecenek ? 'environment' : undefined} disabled=${devreDisi} class="gizli" onChange=${dosyaSecildi} />
      ${ikiSecenek && html`<input ref=${kameraGirdisi} type="file" accept="image/*" capture="environment" disabled=${devreDisi} class="gizli" onChange=${dosyaSecildi} />`}
    </div>`;
  }

  /* Genel Bakış bandının (.tz-selam-bant) arka plan süsü: dalga ve yaprak çizgisi (yalnızca görünüm). */
  function karsilama(kullanici) {
    const saat = new Date().getHours();
    const selam = NT.dil.t(saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar');
    const ad = (kullanici || '').trim().split(/\s+/)[0];
    return selam + (ad ? ', ' + ad : '') + '.';
  }

  const BantSus = () => html`<svg class="tz-selam-sus" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path d="M0 150 C 220 110 440 190 660 145 S 1040 100 1200 135 L1200 200 L0 200 Z" fill="currentColor" opacity=".08" />
    <g fill="none" stroke="currentColor" stroke-width="1.3" opacity=".16"><path d="M1010 20 C 1080 20 1130 70 1130 140 C 1060 140 1010 90 1010 20 Z M1010 20 L1130 140" /></g>
  </svg>`;

  /* Her modülün sol menüsünde: karşılama ekranına (tüm sistemler) dönüş. Sunum modunda sunum modunda kalır. */
  function AnaEkranLinki() {
    // Personel rolü yönetim karşılamasına giremez; panel seçimine döner.
    return html`<a class="tz-anaekran" href=${NT.c.adres('portal', { panel: NT.c.personelRolu() ? undefined : 'yonetim', kullanici: new URLSearchParams(location.search).get('kullanici') })} title=${cevir("Karşılama ekranına dön")}><${Ikon} ad="geri" boyut=${15} />${cevir("Tüm sistemler")}</a>`;
  }

  /* Adım adım kurulum hatası: başlık + ne yapmalı + teknik ayrıntı (bize iletmek için) */
  function HataKutusu({ hata }) {
    if (!hata) return null;
    const e = typeof hata === 'string' ? { message: hata } : hata;
    return html`<div class="uyari-kutu yok" role="alert"><${Ikon} ad="uyari" /><span>
      <b>${cevir(e.message)}</b>${e.ipucu && html`<br />${cevir(e.ipucu)}`}
      ${e.detay && html`<br /><span class="mono" style="font-size:11.5px;opacity:.8">${cevir("Teknik ayrıntı:")} ${e.detay}</span>`}
    </span></div>`;
  }


  /* Kişi seçimi (Numune, Su, Klips). Liste: Yoklama personeli + verilen önceki adlar; kullanici true ise giriş yapan kişi de.
     Büyük/küçük harf farkı ve "Kamil" / "Kamil Gülhan" tek kişi sayılır. */
  const PERSONEL = ['Nurettin Durak', 'Kamil Gülhan', 'Onur Özdemir', 'Yusuf Yılmaz', 'Erkan Eser'];
  /* Aynı kişinin farklı yazımları (ör. "Farukcan Bey", "Onur abi") tek ada iner. Sekreter kararı 2026-11-16:
     ilk adı bu listede olan herkes tam adıyla yazılır. Kayıtlardaki eski yazım değişmez; yalnız listeler birleşir. */
  const KANONIK = { kamil: 'Kamil Gülhan', farukcan: 'Farukcan Biçer', onur: 'Onur Özdemir' };
  function kisiAdi(a) {
    const s = String(a || '').replace(/\s+/g, ' ').trim();
    return (s && KANONIK[s.split(' ')[0].toLocaleLowerCase('tr')]) || s;
  }
  function kisiListesi(ekler = [], { kullanici = true } = {}) {
    const k = (a) => a.toLocaleLowerCase('tr');
    const adlar = [...PERSONEL, ...(kullanici ? [NT.baglanti && NT.baglanti.kullanici] : []), ...ekler].map(kisiAdi).filter(Boolean);
    const gorulen = new Set();
    const tek = adlar.filter((a) => { if (gorulen.has(k(a))) return false; gorulen.add(k(a)); return true; });
    return tek.filter((a) => !tek.some((x) => x !== a && k(x).startsWith(`${k(a)} `))).sort((a, c) => a.localeCompare(c, 'tr'));
  }
  function KisiSec({ liste, deger, degis, etiket = 'Kişi' }) {
    const [diger, setDiger] = useState(false);
    const k = (a) => kisiAdi(a).toLocaleLowerCase('tr');
    const tum = deger && !liste.some((a) => k(a) === k(deger)) ? [...liste, deger] : liste;
    const secili = tum.find((a) => k(a) === k(deger)) || '';
    return html`<select class="girdi" aria-label=${cevir(etiket)} value=${diger ? '__diger' : secili} onChange=${(e) => { const v = e.target.value; if (v === '__diger') { setDiger(true); degis(''); } else { setDiger(false); degis(v); } }}>
        <option value="">${cevir("Seçin…")}</option>
        ${tum.map((a) => html`<option value=${a}>${a}</option>`)}
        <option value="__diger">${cevir("Başka kişi…")}</option>
      </select>
      ${diger && html`<input class="girdi" style="margin-top:6px" value=${deger} placeholder=${cevir("Ad Soyad")} autofocus onInput=${(e) => degis(e.target.value)} />`}`;
  }

  /* ---------------- Giriş (kişisel hesap: ad soyad + şifre; bütün sistemlerde ortak) ---------------- */
  const GIRDI = 'font-size:17px;padding:12px 14px';
  function KurulumKutusu({ children }) {
    return html`<div class="tz-kurulum"><div class="tz-kurulum-kutu">
      <div class="tz-kurulum-dil"><${NT.dil.DilSecimi} /></div>
      <img src="uygulama/ortak/logo.svg" alt="SKYHEM" />${children}</div></div>`;
  }
  function Kurulum({ baslik }) {
    const b = NT.baglanti;
    if (b.durum === 'sifre') return html`<${SifreBelirle} />`;
    if (/[?&]hesapkur\b/.test(location.search)) return html`<${HesapKurulumu} />`;
    return html`<${GirisFormu} baslik=${baslik} />`;
  }
  function GirisFormu({ baslik }) {
    const b = NT.baglanti;
    const [ad, setAd] = useState(b.kullanici);
    const [sifre, setSifre] = useState('');
    const [hata, setHata] = useState('');
    const [bekle, setBekle] = useState(false);
    const giris = async () => {
      if (!NT.oturum.kullaniciAdi(ad)) return setHata(cevir("Adınızı ve soyadınızı yazın."));
      if (!sifre) return setHata(cevir("Şifrenizi yazın."));
      setHata(''); setBekle(true);
      try { await b.girisYap(ad, sifre); } catch (e) { console.error(e); setHata(cevir(e.message)); } finally { setBekle(false); }
    };
    const hataVar = b.durum === 'hata';
    const girisFormu = !hataVar || b.hataKod;
    const enter = (e) => e.key === 'Enter' && giris();
    return html`<${KurulumKutusu}>
      <h1>${hataVar && !b.hataKod ? cevir('Sunucuya bağlanılamadı') : cevir(baslik || 'SKYHEM Takip’e hoş geldiniz')}</h1>
      <p>${hataVar && !b.hataKod ? cevir(b.hataMesaji) : cevir("Adınızı, soyadınızı ve şifrenizi yazın. İlk girişte size verilen geçici şifreyi kullanın; ardından kendi şifrenizi belirlersiniz.", "Enter your first name, last name and password. On first sign-in use the temporary password you were given; you will then set your own.")}</p>
      ${girisFormu && html`
        <input class="girdi" style=${GIRDI} placeholder=${cevir("Adınız Soyadınız")} value=${ad} onInput=${(e) => setAd(e.target.value)} onKeyDown=${enter} autocomplete="username" autofocus />
        <input class="girdi" type="password" style=${GIRDI} placeholder=${cevir("Şifre", "Password")} value=${sifre} onInput=${(e) => setSifre(e.target.value)} onKeyDown=${enter} autocomplete="current-password" />
        <button class="d ana-d tz-buyuk" disabled=${bekle} onClick=${giris}>${bekle ? cevir("Bağlanıyor…") : cevir("Giriş yap", "Sign in")}</button>
        <p class="kucuk soluk" style="margin:0">${cevir("Şifrenizi unuttuysanız Kamil Gülhan'a veya Farukcan Biçer'e başvurun; size yeni geçici şifre verilir.", "Forgot your password? Ask Kamil Gülhan or Farukcan Biçer for a new temporary password.")}</p>`}
      ${!girisFormu && html`<button class="d ana-d tz-buyuk" onClick=${() => b.baslat()}>${cevir("Tekrar dene")}</button>`}
      <${HataKutusu} hata=${hata} />
    <//>`;
  }
  /* İlk giriş: geçici şifre kişinin kendi şifresiyle değiştirilmeden program açılmaz. */
  function SifreBelirle() {
    const b = NT.baglanti;
    const [s1, setS1] = useState('');
    const [s2, setS2] = useState('');
    const [hata, setHata] = useState('');
    const [bekle, setBekle] = useState(false);
    const kaydet = async () => {
      if (s1.length < 8) return setHata(cevir("Şifre en az 8 karakter olmalı.", "The password must be at least 8 characters."));
      if (s1 !== s2) return setHata(cevir("İki şifre aynı değil.", "The two passwords do not match."));
      setHata(''); setBekle(true);
      try { await b.sifreBelirle(s1); } catch (e) { console.error(e); setHata(cevir(e.message)); } finally { setBekle(false); }
    };
    const enter = (e) => e.key === 'Enter' && kaydet();
    return html`<${KurulumKutusu}>
      <h1>${NT.dil.m('Hoş geldiniz, {0}', 'Welcome, {0}', (b.hesap && b.hesap.ad) || '')}</h1>
      <p>${cevir("Geçici şifreyle girdiniz. Devam etmek için kendi şifrenizi belirleyin; bundan sonra yalnız bu şifreyle girersiniz. Şifrenizi kimseyle paylaşmayın.", "You signed in with a temporary password. Set your own password to continue; from now on you will sign in only with it. Do not share it.")}</p>
      <input class="girdi" type="password" style=${GIRDI} placeholder=${cevir("Yeni şifre (en az 8 karakter)", "New password (at least 8 characters)")} value=${s1} onInput=${(e) => setS1(e.target.value)} onKeyDown=${enter} autocomplete="new-password" autofocus />
      <input class="girdi" type="password" style=${GIRDI} placeholder=${cevir("Yeni şifre (tekrar)", "New password (again)")} value=${s2} onInput=${(e) => setS2(e.target.value)} onKeyDown=${enter} autocomplete="new-password" />
      <button class="d ana-d tz-buyuk" disabled=${bekle} onClick=${kaydet}>${bekle ? cevir("Kaydediliyor…") : cevir("Şifremi belirle", "Set my password")}</button>
      <button class="d hayalet" onClick=${() => b.ayril()}>${cevir("Başka biriyle gir", "Sign in as someone else")}</button>
      <${HataKutusu} hata=${hata} />
    <//>`;
  }
  /* Hesapların ilk kurulumu (?hesapkur): ortak erişim koduyla bir kez yapılır; ortak geçici şifreyi kurulumu yapan kişi yazar,
     şifre hiçbir dosyaya ve kayda yazılmaz. Sunucu işlevi yalnız eksik hesapları açar, var olanlara dokunmaz. */
  function HesapKurulumu() {
    const b = NT.baglanti;
    const [kod, setKod] = useState('');
    const [s1, setS1] = useState('');
    const [s2, setS2] = useState('');
    const [hata, setHata] = useState('');
    const [bekle, setBekle] = useState(false);
    const [sonuc, setSonuc] = useState(null);
    const kur = async () => {
      if (kod.trim().length < 4) return setHata(cevir("Erişim kodunu yazın."));
      if (s1.length < 8) return setHata(cevir("Geçici şifre en az 8 karakter olmalı."));
      if (s1 !== s2) return setHata(cevir("İki şifre aynı değil."));
      setHata(''); setBekle(true);
      try { setSonuc(await NT.oturum.islev({ islem: 'kur', sifre: s1 }, { kod: kod.trim().toUpperCase() })); setS1(''); setS2(''); }
      catch (e) { console.error(e); setHata(cevir(e.message)); } finally { setBekle(false); }
    };
    return html`<${KurulumKutusu}>
      <h1>${cevir("Hesapları kur")}</h1>
      ${!sonuc ? html`
        <p>${cevir("Bütün kişilerin hesapları aynı geçici şifreyle açılır. Herkes ilk girişte kendi şifresini belirlemek zorundadır. Var olan hesaplara dokunulmaz.")}</p>
        <input class="girdi mono" style=${GIRDI + ';text-transform:uppercase'} placeholder=${cevir("Erişim kodu (örn. SKY-XXXX-XXXX)")} value=${kod} onInput=${(e) => setKod(e.target.value)} autocomplete="off" spellcheck="false" />
        <input class="girdi" type="password" style=${GIRDI} placeholder=${cevir("Ortak geçici şifre (en az 8 karakter)")} value=${s1} onInput=${(e) => setS1(e.target.value)} autocomplete="new-password" />
        <input class="girdi" type="password" style=${GIRDI} placeholder=${cevir("Ortak geçici şifre (tekrar)")} value=${s2} onInput=${(e) => setS2(e.target.value)} autocomplete="new-password" />
        <button class="d ana-d tz-buyuk" disabled=${bekle} onClick=${kur}>${bekle ? cevir("Kuruluyor…") : cevir("Hesapları aç")}</button>`
      : html`<table class="tablo" style="width:100%;text-align:left"><thead><tr><th>${cevir("Kişi")}</th><th>${cevir("Kullanıcı adı")}</th><th>${cevir("Rol")}</th><th>${cevir("Durum")}</th></tr></thead>
          <tbody>${(sonuc.hesaplar || []).map((h) => html`<tr><td>${h.ad}</td><td class="mono">${h.kullanici}</td><td>${h.rol}${h.mimar ? ' + mimar' : ''}</td><td>${h.durum === 'acildi' ? cevir('Açıldı') : h.durum === 'vardi' ? cevir('Zaten vardı') : h.hata || h.durum}</td></tr>`)}</tbody></table>
        <a class="d ana-d tz-buyuk" href=${location.pathname}>${cevir("Girişe dön")}</a>`}
      <${HataKutusu} hata=${hata} />
    <//>`;
  }

  NT.ui = { Kurulum, KartDetayDugmesi, KayitDetay, DetayBolumu, DetayEkleri, HataKutusu, ekAc, EkOnizleme, Ikon, YOLLAR, Sise, AmbalajCizimi, StokRozeti, SevkRozeti, Parti, Avatar, Modal, Alan, AdetGirdi, Oneri, BosDurum, GlobalKatman, Gecmis, GecmisBolumu, Ekler, BelgeKutusu, resimKucult, bildir, onayla, ALAN_ADLARI, DEGER_YAZ, DURUM_BILGI, AnaEkranLinki, BantSus, karsilama };
  Object.assign(NT.ui, { PERSONEL, kisiAdi, kisiListesi, KisiSec });
})();
