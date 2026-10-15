/* Ortak grafikler (kütüphanesiz): sütun, halka (donut), yatay çubuk. Her işaretin üzerine gelince ipucu çıkar,
   tıklanınca `tikla(anahtar)` çağrılır (veriyi gösteren pencere açmak için). Renkler stil.css'teki --gr-* rolleridir. */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, useState, useRef } = window.htmPreact;

  /* Üzerine gelince imlecin yanında duran küçük bilgi kutusu. */
  function useIpucu() {
    const [ip, setIp] = useState(null);
    const kap = useRef();
    const goster = (e, icerik) => {
      const r = kap.current.getBoundingClientRect();
      setIp({ x: Math.min(e.clientX - r.left, r.width - 12), y: e.clientY - r.top, sag: e.clientX - r.left > r.width * 0.6, icerik });
    };
    const kutu = ip && html`<div class=${'gr-ipucu' + (ip.sag ? ' sag' : '')} style=${{ left: ip.x + 'px', top: ip.y + 'px' }}>${ip.icerik}</div>`;
    return { kap, goster, gizle: () => setIp(null), kutu };
  }

  /* Sütun grafik: veri [{ anahtar, ad, deger, onceki?, etiket, ipucu, vurgu }]. `onceki` verilirse yanında gri
     karşılaştırma sütunu (örn. geçen yıl) çizilir; seriler: ['2026', '2025']. Etiket yalnızca en yüksek ve vurgulu sütunda. */
  function Sutunlar({ veri, seriler, yukseklik = 210, tikla, olcekYaz = (n) => n }) {
    const ip = useIpucu();
    const en = Math.max(1, ...veri.map((x) => Math.max(x.deger || 0, x.onceki || 0)));
    const enBuyuk = veri.reduce((m, x) => (x.deger > (m?.deger || 0) ? x : m), null);
    const iki = veri.some((x) => x.onceki != null);
    const bos = veri.every((x) => !(x.deger > 0) && !(x.onceki > 0));
    const h = (n) => Math.max(n > 0 ? 3 : 0, (n / en) * (yukseklik - 46));
    return html`<div class="gr-sutun-kap" ref=${ip.kap} onMouseLeave=${ip.gizle}>
      ${iki && seriler && html`<div class="gr-lejant"><span><i class="gr-kare" style="background:var(--gr-ana)" />${seriler[0]}</span><span><i class="gr-kare" style="background:var(--gr-onceki)" />${seriler[1]}</span></div>`}
      <div class="gr-sutunlar" style=${{ height: yukseklik + 'px' }}>
        <div class="gr-izgara">${[1, 0.5, 0].map((o) => html`<div style=${{ bottom: `calc(${o} * (100% - 46px) + 22px)` }}><span>${bos ? '' : olcekYaz(en * o)}</span></div>`)}</div>
        ${bos && html`<div class="gr-bos">Henüz veri yok</div>`}
        ${veri.map((x) => html`<button type="button" class=${'gr-sutun' + (x.vurgu ? ' vurgu' : '') + (tikla ? '' : ' pasif')} key=${x.anahtar}
            aria-label=${x.ipucu} onClick=${() => tikla && tikla(x.anahtar)} onMouseMove=${(e) => ip.goster(e, x.ipucu)}>
          <span class="gr-cubuklar">
            ${iki && html`<i class="gr-cubuk onceki" style=${{ height: h(x.onceki || 0) + 'px' }} />`}
            <i class="gr-cubuk" style=${{ height: h(x.deger) + 'px' }}>${(x === enBuyuk || x.vurgu) && x.deger > 0 && html`<b>${x.etiket}</b>`}</i>
          </span>
          <span class="gr-ad">${x.ad}</span>
        </button>`)}
      </div>
      ${ip.kutu}
    </div>`;
  }

  /* Halka (donut): dilimler [{ anahtar, ad, deger, renk, ipucu, simge? }], ortada büyük sayı. Lejant da tıklanır. */
  function Halka({ dilimler, merkez, merkezAlt, tikla, degerYaz = (n) => n, boyut = 168 }) {
    const ip = useIpucu();
    const [secili, setSecili] = useState(null);
    const toplam = dilimler.reduce((t, x) => t + x.deger, 0);
    const R = 50, r = 33;
    const nokta = (a, yar) => [60 + yar * Math.sin(a), 60 - yar * Math.cos(a)];
    let bas = 0;
    const yaylar = dilimler.filter((x) => x.deger > 0).map((x) => {
      const aci = (x.deger / toplam) * Math.PI * 2;
      const son = bas + aci;
      const buyuk = aci > Math.PI ? 1 : 0;
      if (aci >= Math.PI * 2 - 1e-6) return { ...x, tam: true };
      const d = (() => { const [x1, y1] = nokta(bas, R), [x2, y2] = nokta(son, R), [x3, y3] = nokta(son, r), [x4, y4] = nokta(bas, r);
          return `M${x1} ${y1} A${R} ${R} 0 ${buyuk} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${buyuk} 0 ${x4} ${y4} Z`; })();
      bas = son;
      return { ...x, d };
    });
    const pay = (x) => (toplam ? Math.round((x.deger / toplam) * 100) : 0);
    return html`<div class="gr-halka-kap" ref=${ip.kap} onMouseLeave=${() => { ip.gizle(); setSecili(null); }}>
      <svg viewBox="0 0 120 120" width=${boyut} height=${boyut} class="gr-halka" role="img" aria-label=${dilimler.map((x) => `${x.ad} ${pay(x)}%`).join(', ')}>
        ${toplam ? yaylar.map((x) => x.tam ? html`<circle key=${x.anahtar} cx="60" cy="60" r="41.5" fill="none" stroke=${x.renk} stroke-width="17" style="stroke-width:17px"
            onMouseMove=${(e) => { setSecili(x.anahtar); ip.goster(e, x.ipucu); }} onClick=${() => tikla && tikla(x.anahtar)} />` : html`<path key=${x.anahtar} d=${x.d} fill=${x.renk} class=${secili && secili !== x.anahtar ? 'soluk-dilim' : ''}
            onMouseMove=${(e) => { setSecili(x.anahtar); ip.goster(e, x.ipucu); }} onClick=${() => tikla && tikla(x.anahtar)} style=${tikla ? 'cursor:pointer' : ''} />`)
          : html`<circle cx="60" cy="60" r="41.5" fill="none" stroke="var(--cizgi)" stroke-width="17" />`}
        <text x="60" y="58" class="gr-halka-sayi">${merkez}</text>
        <text x="60" y="73" class="gr-halka-alt">${merkezAlt}</text>
      </svg>
      <div class="gr-lejant-liste">${dilimler.map((x) => html`<button type="button" key=${x.anahtar} class=${'gr-lejant-satir' + (secili === x.anahtar ? ' secili' : '')}
          onMouseEnter=${() => setSecili(x.anahtar)} onClick=${() => tikla && tikla(x.anahtar)}>
        ${x.simge || html`<i class="gr-kare" style=${{ background: x.renk }} />`}<span class="ad">${x.ad}</span>
        <span class="deger">${degerYaz(x.deger)}</span><span class="pay">${pay(x)}%</span>
      </button>`)}</div>
      ${ip.kutu}
    </div>`;
  }

  /* Yatay çubuklar: satirlar [{ anahtar, ad, alt?, parcalar: [{ deger, renk }], etiket, ipucu }]; en uzun satır tam genişlik. */
  function YatayCubuklar({ satirlar, tikla, lejant }) {
    const ip = useIpucu();
    const en = Math.max(1, ...satirlar.map((x) => x.parcalar.reduce((t, p) => t + p.deger, 0)));
    return html`<div class="gr-yatay" ref=${ip.kap} onMouseLeave=${ip.gizle}>
      ${lejant && html`<div class="gr-lejant">${lejant.map((l) => html`<span><i class="gr-kare" style=${{ background: l.renk }} />${l.ad}</span>`)}</div>`}
      ${satirlar.map((x) => html`<button type="button" key=${x.anahtar} class="gr-yatay-satir" aria-label=${x.ipucu}
          onClick=${() => tikla && tikla(x.anahtar)} onMouseMove=${(e) => ip.goster(e, x.ipucu)}>
        <span class="ad">${x.ad}${x.alt && html`<small>${x.alt}</small>`}</span>
        <span class="iz">${x.parcalar.filter((p) => p.deger > 0).map((p) => html`<i style=${{ width: (p.deger / en) * 100 + '%', background: p.renk }} />`)}</span>
        <span class="deger">${x.etiket}</span>
      </button>`)}
      ${ip.kutu}
    </div>`;
  }

  NT.grafik = { Sutunlar, Halka, YatayCubuklar, RENKLER: ['var(--gr-1)', 'var(--gr-2)', 'var(--gr-3)', 'var(--gr-4)', 'var(--gr-5)', 'var(--gr-6)', 'var(--gr-7)', 'var(--gr-8)'] };
})();
