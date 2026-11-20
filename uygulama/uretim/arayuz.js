/*
 * Üretim paneli — arayüz. Sayfalar: Genel Bakış, Partiler, Formlar (tarama ve işleme sırası), Hammadde (FR-005), Vardiya (FR-032), Ayarlar.
 * Asıl ekran "işleme": solda taranmış sayfa, sağda formun dijital karşılığı. El yazısı değerleri kişi girer; tarama kayıtta kanıt kalır.
 * Şimdilik yalnız sunum modunda (?demo) açılır; canlı tablo (olaylar_uretim) sekreter onayından sonra (context/uretim-paneli.md).
 */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, render, useState, useEffect, useMemo, useRef } = window.htmPreact;
  const { Ikon, Modal, BosDurum, bildir, onayla } = NT.ui;
  const K = NT.kabuk;
  const U = NT.uretim;
  const { c, m } = U;
  const { bugun, uid, tarihYaz, onceYaz, ara } = NT.c;
  const b = NT.baglanti;
  const depo = () => b.depo;
  const yetkili = () => K.yetkili();

  const Durum = ({ d }) => { const x = U.DURUM[d] || U.DURUM.taslak; return html`<span class=${'rozet ' + x.rozet}><${Ikon} ad=${x.ikon} />${c(x.ad, x.en)}</span>`; };
  const FormEtiket = ({ form }) => { const f = U.formAl(form); return html`<span class="ur-form-etiket"><b>${f ? f.kod : '?'}</b>${f ? ' ' + f.sayfa : ''}</span>`; };
  const yaz = (v) => (v == null || v === '' ? '—' : String(v));

  /* ---------------- Çizgi grafik (kütüphanesiz SVG) ---------------- */
  /* Fare ya da parmakla grafikte gezilince en yakın ölçüm anı seçilir: dikey çizgi, vurgulu noktalar ve her serinin o andaki değeri
     (sekreter isteği, 2026-11-17). sure: x ekseni partinin başından geçen süredir (partileri üst üste karşılaştırmak için). */
  const saatYaz = (dk) => `${String(Math.floor(dk / 60) % 24).padStart(2, '0')}:${String(Math.round(dk) % 60).padStart(2, '0')}`;
  const sureYaz = (dk) => (dk % 60 ? `+${Math.floor(dk / 60)}:${String(Math.round(dk) % 60).padStart(2, '0')}` : `+${dk / 60} ${c('sa', 'h')}`);
  const sayiYaz = (v) => Number(v).toLocaleString(NT.dil.yerel(), { maximumFractionDigits: 1 });
  function Cizgi({ seriler, yukseklik = 220, birim = '°C', sure = false }) {
    const [imlec, setImlec] = useState(null);
    const dolu = seriler.filter((s) => s.noktalar.length);
    if (!dolu.length) return html`<p class="soluk kucuk">${c('Grafik için ölçüm yok.', 'No readings to chart.')}</p>`;
    /* Telefonda daha dar çizim alanı: yazılar ve noktalar okunur büyüklükte kalır. */
    const dar = typeof innerWidth === 'number' && innerWidth < 640;
    const W = dar ? 380 : 640, H = dar ? Math.round(yukseklik * 0.95) : yukseklik, sol = dar ? 34 : 40, alt = 24, ust = 10, sag = 10;
    const xs = dolu.flatMap((s) => s.noktalar.map((n) => n.x)), ys = dolu.flatMap((s) => s.noktalar.map((n) => n.y));
    const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pay = (y1 - y0) * 0.08 || 5; y0 = Math.floor((y0 - pay) / 10) * 10; y1 = Math.ceil((y1 + pay) / 10) * 10;
    const X = (x) => sol + ((x - x0) / Math.max(1, x1 - x0)) * (W - sol - sag);
    const Y = (y) => ust + (1 - (y - y0) / Math.max(1, y1 - y0)) * (H - ust - alt);
    const yCizgi = [0, 1, 2, 3, 4].map((i) => y0 + ((y1 - y0) * i) / 4);
    const adim = (x1 - x0) > 900 ? (dar ? 360 : 240) : (dar ? 180 : 120);
    const xCizgi = []; for (let x = Math.ceil(x0 / adim) * adim; x <= x1; x += adim) xCizgi.push(x);
    const eksen = sure ? sureYaz : saatYaz;
    const anlar = [...new Set(xs)].sort((a, b) => a - b);
    const tolerans = Math.max(10, (x1 - x0) / 30);
    /* Her serinin seçilen ana en yakın ölçümü (tolerans içinde); yoksa o seri ipucunda "—" görünür. */
    const deger = (s, x) => { let en = null; for (const n of s.noktalar) if (Math.abs(n.x - x) <= tolerans && (!en || Math.abs(n.x - x) < Math.abs(en.x - x))) en = n; return en; };
    function bul(e) {
      const r = e.currentTarget.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const xv = x0 + ((px - sol) / (W - sol - sag)) * Math.max(1, x1 - x0);
      let en = anlar[0];
      for (const x of anlar) if (Math.abs(x - xv) < Math.abs(en - xv)) en = x;
      setImlec(en);
    }
    const birak = (e) => { if (e.pointerType === 'mouse') setImlec(null); };
    const secili = imlec == null ? [] : dolu.map((s) => ({ s, n: deger(s, imlec) }));
    const konum = imlec == null ? 0 : (X(imlec) / W) * 100;
    return html`<div class="ur-cizgi"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${dolu.map((s) => s.ad).join(', ')}
        onPointerMove=${bul} onPointerDown=${bul} onPointerLeave=${birak}>
      ${yCizgi.map((y) => html`<g><line x1=${sol} x2=${W - sag} y1=${Y(y)} y2=${Y(y)} class="kilavuz" /><text x=${sol - 6} y=${Y(y) + 4} text-anchor="end">${Math.round(y)}</text></g>`)}
      ${xCizgi.map((x) => html`<text x=${X(x)} y=${H - 6} text-anchor="middle">${eksen(x)}</text>`)}
      ${dolu.map((s) => html`<g style=${{ color: s.renk }}><polyline fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" points=${s.noktalar.map((n) => `${X(n.x)},${Y(n.y)}`).join(' ')} />
        ${s.noktalar.map((n) => html`<circle cx=${X(n.x)} cy=${Y(n.y)} r=${n.uyari ? 5 : 2.6} fill=${n.uyari ? 'var(--kritik)' : 'currentColor'} />`)}</g>`)}
      ${imlec != null && html`<g class="ur-imlec"><line x1=${X(imlec)} x2=${X(imlec)} y1=${ust} y2=${H - alt} />
        ${secili.filter((x) => x.n).map(({ s, n }) => html`<circle cx=${X(n.x)} cy=${Y(n.y)} r="5.5" style=${{ fill: n.uyari ? 'var(--kritik)' : s.renk }} />`)}</g>`}
    </svg>
    ${imlec != null && html`<div class=${'ur-ipucu' + (konum > 62 ? ' sag' : '')} style=${konum > 62 ? { right: `${100 - konum}%` } : { left: `${konum}%` }} role="status">
      <b>${eksen(imlec)}</b>
      ${secili.map(({ s, n }) => html`<span><i style=${{ background: s.renk }} />${s.ad}<b class=${n?.uyari ? 'kirmizi' : ''}>${n ? `${sayiYaz(n.y)} ${birim}` : '—'}</b>${sure && n?.saat ? html`<small>${n.saat}</small>` : ''}</span>`)}
    </div>`}
    <div class="ur-lejant">${dolu.map((s) => html`<span><i style=${{ background: s.renk }} />${s.ad}</span>`)}</div></div>`;
  }

  /* ---------------- Tarama görünümü ---------------- */
  /* Sunum kayıtlarında gerçek tarama yerine formun el yazısıyla doldurulmuş bir taklidi çizilir (gerçek form/ad kullanılmaz). */
  function OrnekTarama({ kayit }) {
    const f = U.formAl(kayit.form);
    if (!f) return null;
    const v = kayit.ornekDegerler || kayit;
    const alanlar = (v.alanlar || {});
    const t = f.tablolar[0];
    const satir = U.satirlar({ tablolar: v.tablolar || {} }, t).slice(0, 24);
    const sut = t.sutunlar.slice(0, 6);
    const W = 620, sw = (W - 40) / sut.length, y0 = 170, sh = 22;
    const el = { fontFamily: "'Segoe Print','Bradley Hand','Comic Sans MS',cursive", fill: '#2346a8', fontSize: '13px' };
    return html`<svg class="ur-ornek-tarama" viewBox=${`0 0 ${W} ${y0 + (satir.length + 1) * sh + 40}`} role="img" aria-label=${c('Örnek tarama', 'Sample scan')}>
      <rect width="100%" height="100%" fill="#fbfaf6" />
      <rect x="20" y="16" width=${W - 40} height="52" fill="none" stroke="#333" />
      <text x="34" y="48" style=${{ font: '700 15px sans-serif', fill: '#1b5e20' }}>SKYHEM</text>
      <text x=${W / 2} y="40" text-anchor="middle" style=${{ font: '700 14px sans-serif', fill: '#1f4f8a' }}>${c(f.ad, f.en).toLocaleUpperCase('tr')}</text>
      <text x=${W / 2} y="58" text-anchor="middle" style=${{ font: '11px sans-serif', fill: '#333' }}>${f.kod} · ${c('Sayfa', 'Page')} ${f.sayfa}</text>
      ${f.alanlar.slice(0, 6).map((a, i) => html`<g><text x=${30 + (i % 3) * 196} y=${92 + Math.floor(i / 3) * 26} style=${{ font: '10px sans-serif', fill: '#333' }}>${c(a.ad, a.en)}:</text>
        <text x=${30 + (i % 3) * 196 + 92} y=${92 + Math.floor(i / 3) * 26} style=${el}>${alanlar[a.id] != null ? String(alanlar[a.id]).replace(/^(\d{4})-(\d\d)-(\d\d)$/, '$3.$2.$1') : ''}</text></g>`)}
      ${sut.map((s, i) => html`<g><rect x=${20 + i * sw} y=${y0 - sh} width=${sw} height=${sh} fill="#eef1f5" stroke="#555" stroke-width=".6" /><text x=${20 + i * sw + sw / 2} y=${y0 - 7} text-anchor="middle" style=${{ font: '700 9.5px sans-serif', fill: '#222' }}>${c(s.ad, s.en)}</text></g>`)}
      ${satir.map((r, j) => sut.map((s, i) => html`<g><rect x=${20 + i * sw} y=${y0 + j * sh} width=${sw} height=${sh} fill="none" stroke="#777" stroke-width=".5" />
        <text x=${20 + i * sw + 6} y=${y0 + j * sh + 16} style=${s.tur === 'sabit' ? { font: '10px sans-serif', fill: '#222' } : el} transform=${`rotate(${((j * 7 + i * 3) % 5) - 2} ${20 + i * sw + 6} ${y0 + j * sh + 12})`}>${r[s.id] != null ? String(r[s.id]).slice(0, 26) : ''}</text></g>`))}
    </svg>`;
  }

  function TaramaGorunumu({ kayit }) {
    const ekler = kayit.tarama || [];
    const [i, setI] = useState(0);
    const [url, setUrl] = useState('');
    const [yakin, setYakin] = useState(1);
    const [donus, setDonus] = useState(0);
    useEffect(() => {
      let adres = '';
      setUrl('');
      if (ekler[i]) depo().ekOku(ekler[i].dosya).then((f) => { if (f) { adres = URL.createObjectURL(f); setUrl(adres); } }).catch(() => {});
      return () => adres && URL.revokeObjectURL(adres);
    }, [kayit.id, i, ekler.length]);
    const icerik = ekler.length ? (url ? html`<img src=${url} alt=${c('Taranmış form', 'Scanned form')} />` : html`<p class="soluk">${c('Tarama yükleniyor…', 'Loading scan…')}</p>`)
      : kayit.ornekTarama ? html`<${OrnekTarama} kayit=${kayit} />` : html`<${BosDurum} ikon="belge" baslik=${c('Tarama yok', 'No scan')} aciklama=${c('Bu kayıt elle girildi.', 'This record was entered manually.')} />`;
    return html`<div class="ur-tarama">
      <div class="ur-tarama-arac">
        <span class="kucuk soluk">${ekler.length ? m('Tarama {0} / {1}', 'Scan {0} / {1}', i + 1, ekler.length) : kayit.ornekTarama ? c('Örnek tarama (sunum)', 'Sample scan (demo)') : ''}</span><span style="flex:1" />
        ${ekler.length > 1 && html`<button class="d kucuk-d ikon-d" disabled=${!i} onClick=${() => setI(i - 1)} aria-label=${c('Önceki', 'Previous')}><${Ikon} ad="geri" boyut=${15} /></button><button class="d kucuk-d ikon-d" disabled=${i >= ekler.length - 1} onClick=${() => setI(i + 1)} aria-label=${c('Sonraki', 'Next')}><${Ikon} ad="ok" boyut=${15} /></button>`}
        <button class="d kucuk-d ikon-d" onClick=${() => setYakin(Math.max(0.6, yakin - 0.25))} aria-label=${c('Uzaklaştır', 'Zoom out')}><${Ikon} ad="eksi" boyut=${15} /></button>
        <button class="d kucuk-d ikon-d" onClick=${() => setYakin(Math.min(3, yakin + 0.25))} aria-label=${c('Yakınlaştır', 'Zoom in')}><${Ikon} ad="arti" boyut=${15} /></button>
        <button class="d kucuk-d ikon-d" onClick=${() => setDonus((donus + 90) % 360)} aria-label=${c('Döndür', 'Rotate')}><${Ikon} ad="senkron" boyut=${15} /></button>
      </div>
      <div class="ur-tarama-ic"><div style=${{ width: `${yakin * 100}%`, transform: donus ? `rotate(${donus}deg)` : '' }}>${icerik}</div></div>
    </div>`;
  }

  /* ---------------- İşleme ekranı ---------------- */
  /* Tablo hücreleri: Enter aynı sütunda alt satıra, " üstteki değeri kopyalar. */
  function Hucre({ sutun, deger, satir, degis, salt, konum }) {
    const durum = U.degerDurumu(sutun, deger, satir);
    const tur = `ur-k-${sutun.tur}`;
    if (sutun.tur === 'sabit') return html`<td class=${'ur-sabit ' + tur}>${c(deger || '', deger)}</td>`;
    const ortak = { 'data-konum': konum, disabled: salt, 'aria-label': c(sutun.ad, sutun.en) };
    if (sutun.tur === 'secim' || sutun.tur === 'tik') {
      const sec = sutun.tur === 'tik' ? ['✓', '✗'] : sutun.secenekler;
      return html`<td class=${tur + ' ' + (durum || (sutun.anormal && deger === sutun.anormal ? 'disari' : ''))}><select class="ur-girdi" value=${deger || ''} onChange=${(e) => degis(e.target.value)} ...${ortak}><option value="">—</option>${sec.map((x) => html`<option value=${x}>${c(x, x)}</option>`)}</select></td>`;
    }
    const tus = (e) => {
      if (e.key === '"' && e.target.value === '') { e.preventDefault(); degis('"'); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const [t, s, su] = konum.split('|');
        document.querySelector(`[data-konum="${t}|${+s + 1}|${su}"]`)?.focus();
      }
    };
    const limit = sutun.satirLimiti && (satir.min != null || satir.max != null) ? `${satir.min ?? '—'} – ${satir.max ?? '—'}` : '';
    return html`<td class=${tur + ' ' + (durum || '')}><input class="ur-girdi" value=${deger ?? ''} inputmode=${sutun.tur === 'sayi' ? 'decimal' : sutun.tur === 'saat' ? 'numeric' : 'text'}
      placeholder=${sutun.tur === 'saat' ? 'ss:dd' : limit} onInput=${(e) => degis(e.target.value)} onKeyDown=${tus} title=${durum === 'disari' ? c('Sınır dışı değer', 'Out of range') : durum === 'gecersiz' ? c('Sayı değil', 'Not a number') : ''} ...${ortak} /></td>`;
  }

  function TabloDuzenle({ tablo, satirlar, degis, salt }) {
    const sat = (i, alan, v) => {
      const yeni = satirlar.map((s) => ({ ...s }));
      if (v === '"') v = i > 0 ? yeni[i - 1][alan] ?? '' : '';
      yeni[i] = { ...yeni[i], [alan]: v };
      degis(yeni);
    };
    const ekle = () => {
      const son = satirlar[satirlar.length - 1];
      const saat = son?.saat && /^\d{1,2}:\d{2}$/.test(son.saat) ? U.saatler(son.saat, son.saat, 60)[0] && (() => { const [h, mm] = son.saat.split(':').map(Number); return `${String((h + (tablo.id === 'sogutma' ? 2 : 1)) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; })() : '';
      degis([...satirlar, tablo.sutunlar.some((s) => s.id === 'saat') ? { saat } : {}]);
    };
    return html`<section class="ur-tablo-bolum"><h3>${c(tablo.ad, tablo.en)}</h3>
      <div class="tablo-kap"><table class=${'tablo ur-tablo' + (tablo.sutunlar.some((s) => s.tur === 'metin') ? '' : ' dar')}><thead><tr>${tablo.sutunlar.map((s) => html`<th class=${'ur-k-' + s.tur}>${c(s.ad, s.en)}</th>`)}${tablo.serbest && !salt && html`<th />`}</tr></thead>
        <tbody>${satirlar.map((s, i) => html`<tr key=${i}>${tablo.sutunlar.map((su) => html`<${Hucre} key=${su.id} sutun=${su} satir=${s} deger=${s[su.id]} salt=${salt} konum=${`${tablo.id}|${i}|${su.id}`} degis=${(v) => sat(i, su.id, v)} />`)}
          ${tablo.serbest && !salt && html`<td><button class="d hayalet kucuk-d ikon-d" aria-label=${c('Satırı sil', 'Delete row')} onClick=${() => degis(satirlar.filter((_, j) => j !== i))}><${Ikon} ad="kapat" boyut=${14} /></button></td>`}</tr>`)}</tbody></table></div>
      ${tablo.serbest && !salt && html`<button class="d kucuk-d" onClick=${ekle}><${Ikon} ad="arti" boyut=${15} />${c('Satır ekle', 'Add row')}</button>`}
    </section>`;
  }

  function AlanGirdi({ alan, deger, degis, salt, partiler }) {
    const ortak = { disabled: salt, value: deger ?? '' };
    let g;
    if (alan.tur === 'secim') g = html`<select class="girdi" ...${ortak} onChange=${(e) => degis(e.target.value)}><option value="">—</option>${alan.secenekler.map((x) => html`<option value=${x}>${c(x, x)}</option>`)}</select>`;
    else if (alan.tur === 'uzun') g = html`<textarea class="girdi" rows="2" ...${ortak} onInput=${(e) => degis(e.target.value)} />`;
    else if (alan.tur === 'parti') g = html`<input class="girdi" list="ur-partiler" placeholder=${c('örn. Batch #24', 'e.g. Batch #24')} ...${ortak} onInput=${(e) => degis(e.target.value)} onBlur=${(e) => degis(U.partiAdi(e.target.value))} />
      <datalist id="ur-partiler">${partiler.map((p) => html`<option value=${p} />`)}</datalist>`;
    else g = html`<input class="girdi" type=${alan.tur === 'tarih' ? 'date' : 'text'} inputmode=${alan.tur === 'sayi' ? 'decimal' : undefined} ...${ortak} onInput=${(e) => degis(e.target.value)} />`;
    return html`<label class=${'alan' + (alan.tur === 'uzun' ? ' tam' : '')}><span>${c(alan.ad, alan.en)}${alan.zorunlu && html` <b class="kirmizi">*</b>`}</span>${g}</label>`;
  }

  /* ---------------- Kâğıt görünümü (ekran ve A4 çıktısı ortak) ---------------- */
  const IMZA_EN = { Hazırlayan: 'Prepared by', Onay: 'Approved by', Kontrol: 'Checked by', Devreden: 'Handed over by', Devralan: 'Taken over by' };
  const alanYaz = (a, v) => (v == null || v === '' ? '—' : a.tur === 'tarih' ? tarihYaz(v) : a.tur === 'secim' ? c(v, v) : String(v));

  function KagitBaslik({ f, kayit, parti }) {
    const tarih = kayit.alanlar?.tarih || kayit.tarih;
    return html`<header class="ur-kagit-bas">
      <img src="uygulama/ortak/logo.svg" alt="SKYHEM" />
      <div class="ad"><b>${c(f.ad, f.en)}</b><small>${f.kod} · ${c('Sayfa', 'Page')} ${f.sayfa}</small></div>
      <dl class="ur-kunye">
        <div><dt>${c('Kayıt', 'Record')}</dt><dd>${kayit.no || '—'}</dd></div>
        <div><dt>${c('Parti', 'Batch')}</dt><dd>${parti || '—'}</dd></div>
        ${tarih && html`<div><dt>${c('Tarih', 'Date')}</dt><dd>${tarihYaz(tarih)}</dd></div>`}
      </dl>
    </header>`;
  }

  /* İmza kutuları: formdaki imza alanlarının dijital karşılığı. İlki işleyen (FR-032'de devreden), ikincisi kontrol eden (devralan). */
  function Imzalar({ f, kayit }) {
    const devir = f.imzalar[0] === 'Devreden';
    const kisi = devir ? [kayit.alanlar?.devreden, kayit.alanlar?.devralan] : [kayit.isleyen, kayit.kontrol?.kim];
    const tarih = devir ? [null, null] : [null, kayit.kontrol?.tarih];
    return html`<div class="ur-imzalar">${f.imzalar.map((ad, i) => html`<div class="ur-imza">
      <small>${c(ad, IMZA_EN[ad])}</small><b>${kisi[i] || ' '}</b><span>${tarih[i] ? tarihYaz(tarih[i]) : ' '}</span></div>`)}</div>`;
  }

  /* A4 çıktısı: değerler kutusuz düz metin olarak, matbu forma benzer düzende. */
  /* A4 üst bilgisi: EYS dokümanlarındaki gibi logo | başlık | künye tablosu, ince ve silik çizgilerle. */
  function A4Baslik({ f, kayit, parti }) {
    const tarih = kayit.alanlar?.tarih || kayit.tarih;
    const satir = [[c('Doküman no', 'Document no'), f.kod], [c('Sayfa', 'Page'), f.sayfa], [c('Kayıt no', 'Record no'), kayit.no || '—'], [c('Parti', 'Batch'), parti || '—'], [c('Tarih', 'Date'), tarih ? tarihYaz(tarih) : '—']];
    return html`<header class="ur-a4-bas">
      <div class="logo"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" /></div>
      <div class="baslik"><b>${c(f.ad, f.en)}</b></div>
      <table class="kunye"><tbody>${satir.map(([k, v]) => html`<tr><th>${k}</th><td>${v}</td></tr>`)}</tbody></table>
    </header>`;
  }

  /* FR-011 2/2 "Operatör ve teknik bakım": matbu formdaki gibi iki grup yan yana (Ad-soyad · Vardiya · İmza). */
  function A4Ekip({ satirlar }) {
    const grup = (g) => satirlar.filter((r) => (r.gorev || 'Operatör') === g);
    const op = grup('Operatör'), tb = grup('Teknik bakım');
    const n = Math.max(2, op.length, tb.length);
    const hucre = (r) => html`<td>${r?.ad || ''}</td><td class="ur-k-secim">${r?.vardiya ? c(r.vardiya, r.vardiya) : ''}</td><td class="imza"></td>`;
    return html`<table class="ur-a4-tablo ur-a4-ekip"><thead>
        <tr><th colspan="3" class="grup">${c('Operatör', 'Operator')}</th><th colspan="3" class="grup">${c('Teknik bakım', 'Maintenance')}</th></tr>
        <tr>${[0, 1].map(() => html`<th>${c('Ad soyad', 'Name')}</th><th class="ur-k-secim">${c('Vardiya', 'Shift')}</th><th class="imza">${c('İmza', 'Signature')}</th>`)}</tr></thead>
      <tbody>${Array.from({ length: n }, (_, i) => html`<tr>${hucre(op[i])}${hucre(tb[i])}</tr>`)}</tbody></table>`;
  }

  function YazdirmaKagidi({ f, kayit }) {
    const parti = kayit.parti || kayit.alanlar?.parti;
    const yatay = f.tablolar.some((t) => t.sutunlar.length > 8);
    return html`<article class=${'ur-a4' + (yatay ? ' yatay' : '')}>
      <${A4Baslik} f=${f} kayit=${kayit} parti=${parti} />
      <dl class="ur-a4-alanlar">${f.alanlar.filter((a) => a.id !== 'parti' && a.id !== 'tarih').map((a) => html`<div class=${a.tur === 'uzun' ? 'tam' : ''}><dt>${c(a.ad, a.en)}</dt><dd>${alanYaz(a, kayit.alanlar?.[a.id])}</dd></div>`)}</dl>
      ${f.tablolar.map((t) => {
        const satirlar = U.satirlar(kayit, t);
        if (t.id === 'ekip') return html`<section class="ur-a4-bolum"><h3>${c(t.ad, t.en)}</h3><${A4Ekip} satirlar=${satirlar} /></section>`;
        return html`<section class="ur-a4-bolum"><h3>${c(t.ad, t.en)}</h3>
          <table class=${'ur-a4-tablo' + (t.sutunlar.some((s) => s.tur === 'metin') ? '' : ' dar')}><thead><tr>${t.sutunlar.map((s) => html`<th class=${'ur-k-' + s.tur}>${c(s.ad, s.en)}</th>`)}</tr></thead>
            <tbody>${satirlar.length ? satirlar.map((r) => html`<tr>${t.sutunlar.map((s) => html`<td class=${'ur-k-' + s.tur + ' ' + (U.degerDurumu(s, r[s.id], r) || '')}>${r[s.id] == null || r[s.id] === '' ? '' : s.tur === 'sabit' ? c(r[s.id], r[s.id]) : String(r[s.id])}</td>`)}</tr>`)
              : html`<tr><td colspan=${t.sutunlar.length} class="bos">—</td></tr>`}</tbody></table></section>`;
      })}
      ${kayit.not && html`<p class="ur-a4-not"><b>${c('İşleme notu', 'Entry note')}:</b> ${kayit.not}</p>`}
      <${Imzalar} f=${f} kayit=${kayit} />
      <footer class="ur-a4-alt"><span>SKYHEM Takip · ${c(U.DURUM[kayit.durum]?.ad || '', U.DURUM[kayit.durum]?.en)}</span><span>${c('Çıktı', 'Printed')}: ${tarihYaz(bugun())}</span></footer>
    </article>`;
  }

  /* Kâğıt tek A4'ü birazcık aşıyorsa (not, imza ya da alt bilgi ikinci sayfaya düşüyorsa) orantılı küçültülür.
     Ölçüm ekranda yapılır: alan kâğıt genişliğinde görünmez biçimde açılır (dolgu taban kuralda, yazdırmadakiyle aynı).
     %60'tan fazla küçültme gerekirse (çok uzun form) küçültülmez; tablo başlığı tekrarlanarak çok sayfa basılır. */
  function sayfayaSigdir(alan) {
    const mm = 96 / 25.4;
    const eski = alan.getAttribute('style');
    alan.style.cssText = 'display:block;position:absolute;left:-10000px;top:0;visibility:hidden';
    for (const kagit of alan.querySelectorAll('.ur-a4')) {
      const yatay = kagit.classList.contains('yatay');
      const [en, boy] = yatay ? [297, 210] : [210, 297];
      alan.style.width = en + 'mm';
      kagit.style.zoom = ''; kagit.style.width = '';
      const sigacak = boy * mm * 0.985; // yuvarlama payı
      let oran = 1;
      for (let i = 0; i < 4; i++) { // küçülünce satırlar genişler; birkaç turda oturur
        const yuk = kagit.getBoundingClientRect().height;
        if (yuk <= sigacak) break;
        oran = Math.max(0.6, oran * (sigacak / yuk) - 0.005);
        kagit.style.zoom = String(oran);
        // küçülen kâğıt sayfa genişliğini yine doldursun; yüzde, tarayıcının zoom yorumuna göre ölçülerek düzeltilir
        kagit.style.width = '100%';
        const gorunen = kagit.getBoundingClientRect().width;
        kagit.style.width = `${((100 * en * mm) / gorunen).toFixed(3)}%`;
        if (oran === 0.6) break;
      }
      if (kagit.getBoundingClientRect().height > sigacak * 1.001 && oran === 0.6) { kagit.style.zoom = ''; kagit.style.width = ''; }
    }
    if (eski == null) alan.removeAttribute('style'); else alan.setAttribute('style', eski);
  }

  function yazdir(icerik) {
    let alan = document.getElementById('yazdir-alani');
    if (!alan) { alan = document.createElement('div'); alan.id = 'yazdir-alani'; document.body.appendChild(alan); }
    render(icerik, alan);
    sayfayaSigdir(alan);
    const temizle = () => { render(null, alan); window.removeEventListener('afterprint', temizle); };
    window.addEventListener('afterprint', temizle);
    setTimeout(() => window.print(), 150); // logo yüklensin
  }

  function IslemeEkrani({ kayit: ilk, kapat }) {
    const d = depo();
    const kayitli = d.kayit('kayit', ilk.id) || ilk;
    const [k, setK] = useState(() => ({ form: kayitli.form || '', parti: kayitli.parti || '', alanlar: { ...(kayitli.alanlar || {}) }, tablolar: JSON.parse(JSON.stringify(kayitli.tablolar || {})), not: kayitli.not || '' }));
    const [kilitAcik, setKilitAcik] = useState(false);
    const [mesgul, setMesgul] = useState(false);
    const f = U.formAl(k.form);
    const salt = kayitli.durum === 'kontrol' && !kilitAcik;
    const tumKayit = { ...kayitli, ...k };
    const den = U.denetle(tumKayit);
    const oneri = k.form === 'FR-005' ? U.hammaddeOneri(tumKayit) : null;
    const partiler = U.partiler(d).map((p) => p.ad);
    const alanDegis = (id, v) => setK((p) => ({ ...p, alanlar: { ...p.alanlar, [id]: v }, ...(id === 'parti' ? { parti: v } : {}) }));
    async function kaydet(durum) {
      if (durum !== 'taslak' && den.eksik.length && !(await onayla(m('Eksik: {0}. Yine de kaydedilsin mi?', 'Missing: {0}. Save anyway?', den.eksik.join(', ')), { baslik: c('Eksik bilgi', 'Missing information'), evet: c('Kaydet', 'Save') }))) return;
      setMesgul(true);
      try {
        const v = { form: k.form, parti: U.partiAdi(k.alanlar.parti ?? k.parti), alanlar: k.alanlar, tablolar: k.tablolar, not: k.not, tarih: k.alanlar.tarih || kayitli.tarih || bugun() };
        if (durum === 'islendi') Object.assign(v, { durum: 'islendi', isleyen: b.kullanici, kontrol: null });
        if (durum === 'kontrol') Object.assign(v, { durum: 'kontrol', kontrol: { kim: b.kullanici, tarih: bugun() }, ...(kayitli.durum === 'taslak' ? { isleyen: b.kullanici } : {}) });
        await d.numuneIslem((guncel) => {
          if (guncel.kayit('kayit', kayitli.id)?.durum === 'kontrol' && !yetkili()) throw new Error(c('Form kontrol edilip kilitlendi.', 'The checked form is locked.'));
          return [{ c: 'kayit', k: kayitli.id, v }];
        });
        bildir(durum === 'kontrol' ? m('{0} kontrol edildi.', '{0} checked.', kayitli.no) : m('{0} kaydedildi.', '{0} saved.', kayitli.no));
        kapat();
      } catch (e) { bildir(e.message, { tur: 'hata' }); }
      finally { setMesgul(false); }
    }
    const ornekAktar = () => setK((p) => ({ ...p, form: kayitli.form, parti: kayitli.ornekDegerler.alanlar.parti, alanlar: { ...kayitli.ornekDegerler.alanlar }, tablolar: JSON.parse(JSON.stringify(kayitli.ornekDegerler.tablolar)) }));
    useEffect(() => { const f2 = (e) => { if (e.key === 'Escape' && !document.querySelector('.perde')) kapat(); }; window.addEventListener('keydown', f2); return () => window.removeEventListener('keydown', f2); });
    return html`<div class="ur-isle" role="dialog" aria-modal="true" aria-label=${c('Form işleme', 'Form entry')}>
      <header class="ur-isle-bas">
        <button class="d hayalet ikon-d" onClick=${kapat} aria-label=${c('Kapat', 'Close')}><${Ikon} ad="geri" /></button>
        <div class="ur-isle-baslik"><b>${kayitli.no} · ${f ? `${f.kod} ${f.sayfa} · ${c(f.ad, f.en)}` : c('Form türünü seçin', 'Choose the form type')}</b>
          <small>${kayitli.isleyen ? m('İşleyen: {0}', 'Entered by: {0}', kayitli.isleyen) : c('Henüz işlenmedi', 'Not entered yet')}${kayitli.kontrol ? ' · ' + m('Kontrol: {0}, {1}', 'Checked: {0}, {1}', kayitli.kontrol.kim, tarihYaz(kayitli.kontrol.tarih)) : ''}</small></div>
        ${f && html`<button class="d kucuk-d" onClick=${() => yazdir(html`<${YazdirmaKagidi} f=${f} kayit=${{ ...tumKayit, parti: U.partiAdi(k.alanlar.parti ?? k.parti) }} />`)} title=${c('Formu A4 olarak yazdır veya PDF kaydet', 'Print the form on A4 or save as PDF')}><${Ikon} ad="yazici" boyut=${15} />${c('Yazdır', 'Print')}</button>`}
        <${Durum} d=${kayitli.durum} />
      </header>
      <div class="ur-isle-govde">
        <${TaramaGorunumu} kayit=${kayitli} />
        <div class="ur-isle-form">
          ${b.mod === 'demo' && kayitli.ornekDegerler && kayitli.durum === 'taslak' && html`<div class="uyari-kutu bilgi"><${Ikon} ad="bilgi" /><span style="flex:1">${c('Sunum: soldaki örnek taramanın değerleri tek tuşla aktarılabilir. Gerçekte değerleri tarama karşısında siz yazarsınız.', 'Demo: the values of the sample scan can be copied in one click. In real use you type them while looking at the scan.')}</span><button class="d kucuk-d" onClick=${ornekAktar}>${c('Değerleri aktar', 'Copy values')}</button></div>`}
          ${salt && html`<div class="uyari-kutu iyi"><${Ikon} ad="daire_tik" /><span style="flex:1">${c('Bu kayıt kontrol edildi ve kilitli.', 'This record has been checked and is locked.')}</span>${yetkili() && html`<button class="d kucuk-d" onClick=${() => setKilitAcik(true)}><${Ikon} ad="kalem" boyut=${14} />${c('Düzelt', 'Correct')}</button>`}</div>`}
          <div class="form-izgara">
            <label class="alan s6"><span>${c('Form', 'Form')}</span><select class="girdi" disabled=${salt} value=${k.form} onChange=${(e) => setK((p) => ({ ...p, form: e.target.value }))}>
              <option value="">${c('— seçin —', '— choose —')}</option>${Object.entries(U.FORMLAR).map(([id, x]) => html`<option value=${id}>${x.kod} ${x.sayfa} · ${c(x.ad, x.en)}</option>`)}</select></label>
          </div>
          ${f && html`<article class="ur-kagit">
            <${KagitBaslik} f=${f} kayit=${tumKayit} parti=${U.partiAdi(k.alanlar.parti ?? k.parti)} />
            <div class="ur-alanlar">${f.alanlar.map((a) => html`<${AlanGirdi} key=${a.id} alan=${a} salt=${salt} partiler=${partiler} deger=${a.id === 'parti' ? (k.alanlar.parti ?? k.parti) : k.alanlar[a.id]} degis=${(v) => alanDegis(a.id, v)} />`)}</div>
            ${oneri && html`<div class=${'uyari-kutu ' + (oneri.karar === 'Kabul' ? 'iyi' : oneri.karar === 'Red' ? 'yok' : 'kritik')}><${Ikon} ad="bilgi" /><span>${m('Program önerisi: {0}', 'Suggested decision: {0}', c(oneri.karar))}${oneri.neden.length ? ' · ' + oneri.neden.join(', ') : ''}. ${c('Kararı kontrol eden kişi verir.', 'The checker makes the decision.')}${k.alanlar.karar && k.alanlar.karar !== oneri.karar ? ' ' + c('Formdaki karar öneriden farklı.', 'The decision on the form differs from the suggestion.') : ''}</span></div>`}
            ${f.tablolar.map((t) => html`<${TabloDuzenle} key=${k.form + t.id} tablo=${t} salt=${salt} satirlar=${U.satirlar(k, t)} degis=${(l) => setK((p) => ({ ...p, tablolar: { ...p.tablolar, [t.id]: l } }))} />`)}
            <${Imzalar} f=${f} kayit=${tumKayit} />
          </article>`}
          <label class="alan"><span>${c('İşleme notu', 'Entry note')}</span><input class="girdi" disabled=${salt} value=${k.not} onInput=${(e) => setK((p) => ({ ...p, not: e.target.value }))} placeholder=${c('Örn: 03:30 satırı okunmuyor', 'e.g. 03:30 row is illegible')} /></label>
        </div>
      </div>
      <footer class="ur-isle-alt">
        <div class="ur-denetim">${den.eksik.length ? html`<span class="rozet kritik"><${Ikon} ad="uyari" />${m('{0} eksik', '{0} missing', den.eksik.length)}</span>` : ''}
          ${den.disari.length ? html`<span class="rozet yok" title=${den.disari.map((x) => `${x.ad}: ${x.deger}`).join('\n')}><${Ikon} ad="uyari" />${m('{0} sınır dışı / anormal', '{0} out of range / abnormal', den.disari.length)}</span>` : ''}
          <span class="kucuk soluk">${m('{0} değer girildi', '{0} values entered', den.dolu)}</span></div>
        <span style="flex:1" />
        ${kayitli.durum === 'taslak' && !salt && html`<button class="d hayalet" onClick=${async () => { if (await K.sil('kayit', kayitli)) kapat(); }}><${Ikon} ad="cop" />${c('Sil', 'Delete')}</button>`}
        ${!salt && html`<button class="d" disabled=${mesgul || !k.form} onClick=${() => kaydet('islendi')}><${Ikon} ad="tik" />${c('Kaydet', 'Save')}</button>`}
        ${!salt && yetkili() && html`<button class="d ana-d" disabled=${mesgul || !k.form} onClick=${() => kaydet('kontrol')}><${Ikon} ad="daire_tik" />${c('Kaydet ve kontrol et', 'Save and check')}</button>`}
        ${salt && html`<button class="d ana-d" onClick=${kapat}>${c('Kapat', 'Close')}</button>`}
      </footer>
    </div>`;
  }
  const isle = (kayit) => K.ac(IslemeEkrani, { kayit });

  /* ---------------- Tarama yükleme ---------------- */
  function TaraYukle({ kapat }) {
    const d = depo();
    const girdi = useRef();
    const [sayfalar, setSayfalar] = useState([]);
    const [durum, setDurum] = useState('');
    const [mesgul, setMesgul] = useState(false);
    const [onizleme, setOnizleme] = useState({});
    const onizlemeUrl = useRef(new Set());
    useEffect(() => () => onizlemeUrl.current.forEach(u => URL.revokeObjectURL(u)), []);
    async function sec(e) {
      const dosyalar = [...e.target.files];
      e.target.value = '';
      if (!dosyalar.length) return;
      setMesgul(true);
      try {
        const l = await NT.uretimTara.hazirla(dosyalar, setDurum);
        const yeni = {};
        l.forEach((s) => { s.id = uid(); yeni[s.id] = URL.createObjectURL(s.blob); onizlemeUrl.current.add(yeni[s.id]); });
        setOnizleme((o) => ({ ...o, ...yeni }));
        setSayfalar((p) => [...p, ...l]);
        setDurum('');
      } catch (er) { setDurum(er.message || String(er)); } finally { setMesgul(false); }
    }
    const degis = (id, alan, v) => setSayfalar((l) => l.map((s) => (s.id === id ? { ...s, [alan]: v } : s)));
    async function kaydet() {
      setMesgul(true);
      try {
        const olusan = [];
        for (const s of sayfalar) {
          setDurum(m('{0} kaydediliyor…', 'Saving {0}…', s.ad));
          const blob = await NT.uretimTara.dondur(s.blob, s.derece);
          const ek = await d.ekYaz(new File([blob], (s.ad || 'tarama').replace(/[^\wçğıöşüÇĞİÖŞÜ.#-]+/g, '_') + '.jpg', { type: 'image/jpeg' }));
          const id = s.id;
          await d.kaydet([{ c: 'kayit', k: id, v: { no: K.yeniNo(d, 'kayit', 'UR'), form: s.form || '', parti: U.partiAdi(s.parti), alanlar: s.parti ? { parti: U.partiAdi(s.parti) } : {}, tablolar: {}, tarama: [ek], durum: 'taslak', tarih: bugun(), isleyen: '' } }]);
          olusan.push(d.kayit('kayit', id));
          // Sonraki dosya yüklenemezse yalnız bekleyen sayfalar yeniden gönderilir.
          setSayfalar(l => l.filter(x => x.id !== id));
        }
        kapat();
        bildir(m('{0} sayfa işleme sırasına alındı.', '{0} pages queued for entry.', olusan.length), { eylem: { yazi: c('İlkini işle', 'Enter the first'), fn: () => isle(olusan[0]) }, sure: 8000 });
        location.hash = '#/formlar';
      } catch (er) { setDurum(er.message || String(er)); } finally { setMesgul(false); }
    }
    return html`<${Modal} genis baslik=${c('Form tara', 'Scan forms')} kapat=${kapat}
      alt=${html`<button class="d hayalet" onClick=${kapat}>${c('Vazgeç', 'Cancel')}</button><button class="d ana-d" disabled=${mesgul || !sayfalar.length} onClick=${kaydet}><${Ikon} ad="tik" />${m('{0} sayfayı işleme sırasına al', 'Queue {0} pages', sayfalar.length)}</button>`}>
      <div class="modal-ic">
        <p style="margin-top:0">${c('Doldurulmuş formun fotoğrafını çekin ya da tarayıcıdan çıkan PDF’i seçin (birden çok sayfa olabilir). Program her sayfanın form türünü ve yönünü matbu başlıktan bulur; el yazısı değerleri işleme ekranında siz girersiniz.', 'Take a photo of the filled form or choose the scanner PDF (several pages are fine). The program finds each page’s form type and orientation from the printed header; you type the handwritten values on the entry screen.')}</p>
        <input ref=${girdi} type="file" accept="application/pdf,image/*" multiple hidden onChange=${sec} />
        <div class="ur-yukle-dugmeler"><button class="d ana-d" disabled=${mesgul} onClick=${() => { girdi.current.removeAttribute('capture'); girdi.current.click(); }}><${Ikon} ad="yukle" />${c('PDF ya da resim seç', 'Choose PDF or image')}</button>
          <button class="d" disabled=${mesgul} onClick=${() => { girdi.current.setAttribute('capture', 'environment'); girdi.current.click(); }}><${Ikon} ad="kamera" />${c('Fotoğraf çek', 'Take a photo')}</button></div>
        ${durum && html`<p class="kucuk soluk" role="status">${durum}</p>`}
        ${sayfalar.length > 0 && html`<ul class="ur-sayfalar">${sayfalar.map((s) => html`<li key=${s.id}>
          <img src=${onizleme[s.id]} alt="" style=${{ transform: `rotate(${s.derece || 0}deg)` }} />
          <div class="form-izgara">
            <label class="alan s12"><span>${c('Form', 'Form')} ${s.form ? html`<span class="rozet iyi">${c('başlıktan bulundu', 'found in header')}</span>` : html`<span class="rozet kritik">${c('seçin', 'choose')}</span>`}</span>
              <select class="girdi" value=${s.form} onChange=${(e) => degis(s.id, 'form', e.target.value)}><option value="">—</option>${Object.entries(U.FORMLAR).map(([id, x]) => html`<option value=${id}>${x.kod} ${x.sayfa} · ${c(x.ad, x.en)}</option>`)}</select></label>
            <label class="alan s6"><span>${c('Parti', 'Batch')}</span><input class="girdi" value=${s.parti || ''} placeholder=${c('örn. Batch #24', 'e.g. Batch #24')} onInput=${(e) => degis(s.id, 'parti', e.target.value)} /></label>
            <div class="alan s6"><span>${c('Yön', 'Orientation')}</span><button class="d kucuk-d" onClick=${() => degis(s.id, 'derece', ((s.derece || 0) + 90) % 360)}><${Ikon} ad="senkron" boyut=${14} />${m('Döndür ({0}°)', 'Rotate ({0}°)', s.derece || 0)}</button></div>
          </div>
          <button class="d hayalet ikon-d" aria-label=${c('Çıkar', 'Remove')} onClick=${() => setSayfalar((l) => l.filter((x) => x.id !== s.id))}><${Ikon} ad="kapat" /></button></li>`)}</ul>`}
      </div><//>`;
  }
  const taraAc = () => K.ac(TaraYukle);
  /* Taramasız, elle form girişi (kağıt yoksa ya da sonradan aktarım). */
  async function elleGir() {
    const d = depo();
    const id = uid();
    await d.kaydet([{ c: 'kayit', k: id, v: { no: K.yeniNo(d, 'kayit', 'UR'), form: '', parti: '', alanlar: {}, tablolar: {}, tarama: [], durum: 'taslak', tarih: bugun(), isleyen: '' } }]);
    isle(d.kayit('kayit', id));
  }

  /* ---------------- Parti dosyası ---------------- */
  const RENK = ['var(--gr-1)', 'var(--gr-3)', 'var(--gr-5)', 'var(--gr-2)'];
  function partiGrafikleri(p) {
    const k011 = p.kayitlar.find((k) => k.form === 'FR-011-1' && k.durum !== 'taslak');
    const k0112 = p.kayitlar.find((k) => k.form === 'FR-011-2' && k.durum !== 'taslak');
    const isaretle = (l, t, alan) => l.map((n) => ({ ...n, uyari: !!U.degerDurumu(U.FORMLAR[t.form].tablolar[0].sutunlar.find((s) => s.id === alan), n.y, {}) }));
    const olcum = k011 ? U.satirlar(k011, U.FORMLAR['FR-011-1'].tablolar[0]) : [];
    const sog = k0112 ? U.satirlar(k0112, U.FORMLAR['FR-011-2'].tablolar[0]) : [];
    return {
      reaksiyon: [{ ad: c('Reaktör °C', 'Reactor °C'), renk: RENK[0], noktalar: k011 ? isaretle(U.seri(olcum, 'reaktorT'), k011, 'reaktorT') : [] }, { ad: c('Kızgın yağ °C', 'Hot oil °C'), renk: RENK[1], noktalar: U.seri(olcum, 'yagT') }],
      agirlik: [{ ad: c('Reaktör ağırlığı (kg)', 'Reactor weight (kg)'), renk: RENK[2], noktalar: U.seri(olcum, 'agirlik').filter((n) => n.y > 1000) }],
      sogutma: [{ ad: c('E2 °C', 'E2 °C'), renk: RENK[3], noktalar: U.seri(sog, 'e2T') }, { ad: c('Su °C', 'Water °C'), renk: RENK[1], noktalar: U.seri(sog, 'suT') }],
    };
  }
  function PartiDosyasi({ ad, kapat }) {
    const d = depo();
    const p = U.partiler(d).find((x) => x.ad === ad);
    if (!p) return html`<${Modal} baslik=${ad} kapat=${kapat}><div class="modal-ic"><${BosDurum} baslik=${c('Parti bulunamadı', 'Batch not found')} /></div><//>`;
    const g = partiGrafikleri(p);
    const excel = () => {
      const satirlar = p.kayitlar.filter((k) => k.form && k.durum !== 'taslak').flatMap((k) => U.formAl(k.form).tablolar.flatMap((t) => U.satirlar(k, t).filter((s) => t.sutunlar.some((su) => su.tur !== 'sabit' && su.tur !== 'saat' && U.dolu(s[su.id])))
        .map((s) => ({ hucreler: [{ v: U.formAdi(k.form) }, { v: c(t.ad, t.en) }, { v: k.alanlar?.tarih || k.tarih, tur: 'tarih' }, ...t.sutunlar.map((su) => ({ v: s[su.id] ?? '', tur: su.tur === 'sayi' && U.dolu(s[su.id]) && !isNaN(NT.c.sayi(s[su.id])) ? 'ondalik' : undefined }))] }))));
      K.excel(`${p.ad.replace(/[^\w]+/g, '-')}-uretim-${bugun()}.xlsx`, { sayfa: p.ad.replace('#', ''), renkli: true, baslik: [c('Form', 'Form'), c('Tablo', 'Table'), c('Tarih', 'Date'), c('Değerler →', 'Values →')], sutunlar: [{ genislik: 30 }, { genislik: 24 }, { genislik: 12 }], satirlar });
    };
    return html`<${Modal} genis baslik=${`${p.ad} · ${p.urun || c('Ürün yok', 'No product')}`} kapat=${kapat} sag=${p.eksikFormlar.length ? html`<span class="rozet kritik">${m('{0} form eksik', '{0} forms missing', p.eksikFormlar.length)}</span>` : html`<span class="rozet iyi">${c('Formlar tam', 'Forms complete')}</span>`}
      alt=${html`<div class="sol"><button class="d" onClick=${excel}><${Ikon} ad="indir" />${c('Excel', 'Excel')}</button></div><button class="d ana-d" onClick=${kapat}>${c('Kapat', 'Close')}</button>`}>
      <div class="modal-ic ur-parti">
        <div class="ur-parti-ozet">${[[c('Tarih', 'Date'), p.bas ? (p.bas === p.bit ? tarihYaz(p.bas) : `${tarihYaz(p.bas)} – ${tarihYaz(p.bit)}`) : '—'], [c('Reaktör', 'Reactor'), yaz(p.reaktor)], [c('Miktar', 'Quantity'), p.miktar ? `${Number(p.miktar).toLocaleString(NT.dil.yerel())} kg` : '—'],
          [c('Asit', 'Acid'), yaz(p.asit)], [c('Viskozite', 'Viscosity'), yaz(p.viskozite)], [c('Uyarı', 'Warnings'), p.uyari]].map(([a, v]) => html`<div><small>${a}</small><b>${v}</b></div>`)}</div>
        ${p.eksikFormlar.length > 0 && html`<div class="uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${m('Bu partide eksik: {0}', 'Missing for this batch: {0}', p.eksikFormlar.map((x) => x === 'FR-035' ? 'FR-035' : U.formAdi(x)).join(', '))}</span></div>`}
        <div class="ur-grafikler">
          <section><h3>${c('Reaksiyon sıcaklıkları (FR-011)', 'Reaction temperatures (FR-011)')}</h3><${Cizgi} seriler=${g.reaksiyon} /></section>
          <section><h3>${c('Reaktör ağırlığı', 'Reactor weight')}</h3><${Cizgi} seriler=${g.agirlik} birim="kg" /></section>
          <section><h3>${c('E2 tankı soğutma', 'E2 tank cooling')}</h3><${Cizgi} seriler=${g.sogutma} /></section>
        </div>
        <h3>${c('Formlar', 'Forms')}</h3>
        <${KayitListesi} liste=${p.kayitlar} />
      </div><//>`;
  }
  const partiAc = (ad) => K.ac(PartiDosyasi, { ad });

  /* ---------------- Grafikler: partiye göre ve forma göre ---------------- */
  /* Formlardaki ölçüm sütunları; "forma göre" görünümde seçilen ölçüm, partiler üst üste çizilir (x = partinin başından geçen süre). */
  const OLCUMLER = [
    { id: 'reaktorT', form: 'FR-011-1', alan: 'reaktorT', birim: '°C', ad: ['Reaktör sıcaklığı', 'Reactor temperature'], uyari: true },
    { id: 'yagT', form: 'FR-011-1', alan: 'yagT', birim: '°C', ad: ['Kızgın yağ sıcaklığı', 'Hot oil temperature'] },
    { id: 'agirlik', form: 'FR-011-1', alan: 'agirlik', birim: 'kg', ad: ['Reaktör ağırlığı', 'Reactor weight'], suz: (n) => n.y > 1000 },
    { id: 'e2T', form: 'FR-011-2', alan: 'e2T', birim: '°C', ad: ['E2 tankı sıcaklığı', 'E2 tank temperature'] },
    { id: 'suT', form: 'FR-011-2', alan: 'suT', birim: '°C', ad: ['Soğutma suyu sıcaklığı', 'Cooling water temperature'] },
  ];
  const PARTI_RENK = ['var(--gr-1)', 'var(--gr-2)', 'var(--gr-3)', 'var(--gr-4)', 'var(--gr-5)', 'var(--gr-7)', 'var(--gr-8)', 'var(--gr-6)'];
  const formKisa = (f) => (f === 'FR-035' ? 'FR-035' : f.replace('-1', ' 1/2').replace('-2', ' 2/2'));
  function olcumNoktalari(p, o) {
    const k = p.kayitlar.find((x) => x.form === o.form && x.durum !== 'taslak');
    if (!k) return [];
    const t = U.FORMLAR[o.form].tablolar[0];
    let l = U.seri(U.satirlar(k, t), o.alan);
    if (o.suz) l = l.filter(o.suz);
    if (o.uyari) { const su = t.sutunlar.find((s) => s.id === o.alan); l = l.map((n) => ({ ...n, uyari: !!U.degerDurumu(su, n.y, {}) })); }
    return l;
  }
  function Grafikler() {
    const d = depo();
    const tum = U.partiler(d).filter((p) => OLCUMLER.some((o) => olcumNoktalari(p, o).length));
    const [gorunum, setGorunum] = useState(() => (/(form|karsilastir)/.test(location.hash) ? 'form' : 'parti'));
    const [partiAd, setParti] = useState('');
    const [olcumId, setOlcum] = useState('reaktorT');
    const [secili, setSecili] = useState(null);
    const [partiSorgu, setPartiSorgu] = useState('');
    if (!tum.length) return html`<${K.Selam} baslik=${c('Grafikler', 'Charts')} /><${BosDurum} ikon="ozet" baslik=${c('Grafik için işlenmiş FR-011 yok', 'No entered FR-011 to chart')} />`;
    const p = tum.find((x) => x.ad === partiAd) || tum[0];
    const o = OLCUMLER.find((x) => x.id === olcumId) || OLCUMLER[0];
    const adaylar = tum.map((parti) => ({ ...parti, seri: olcumNoktalari(parti, o) })).filter((x) => x.seri.length);
    const secim = secili || adaylar.slice(0, 4).map((x) => x.ad);
    const gosterilen = adaylar.filter((x) => secim.includes(x.ad));
    const renk = (ad) => PARTI_RENK[gosterilen.findIndex((x) => x.ad === ad) % PARTI_RENK.length];
    const eslesenler = adaylar.filter((x) => secim.includes(x.ad) || ara(`${x.ad} ${x.urun} ${x.reaktor}`, partiSorgu));
    const ustUste = gosterilen.map((x) => {
      const l = x.seri;
      const bas = l[0].x;
      return { ad: x.ad, renk: renk(x.ad), noktalar: l.map((n) => ({ ...n, x: n.x - bas })), ham: l, parti: x };
    });
    const g = gorunum === 'parti' && partiGrafikleri(p);
    return html`<${K.Selam} baslik=${c('Grafikler', 'Charts')}>${c('Bir partinin ölçümlerini inceleyin veya seçtiğiniz partileri aynı grafikte karşılaştırın. Değerleri görmek için grafiğe dokunun veya fareyle gezinin.', 'View measurements for one batch or compare selected batches on the same chart. Tap or hover to see the values.')}<//>
      <${K.Cipler} secenekler=${[['parti', c('Partiye göre', 'By batch'), tum.length], ['form', c('Partileri karşılaştır', 'Compare batches')]]} deger=${gorunum} degis=${setGorunum} />
      ${gorunum === 'parti' ? html`
        <div class="ur-secim"><span class="kucuk soluk">${c('Parti', 'Batch')}</span>
          ${tum.map((x) => html`<button type="button" class=${'secenek' + (x.ad === p.ad ? ' secili' : '')} onClick=${() => setParti(x.ad)}>${x.ad}</button>`)}</div>
        <${K.Kart} baslik=${`${p.ad} · ${p.urun || c('Ürün yok', 'No product')}`} sag=${html`<button class="d kucuk-d" onClick=${() => partiAc(p.ad)}>${c('Parti dosyası', 'Batch file')} →</button>`}>
          <div class="kart-ic"><div class="ur-grafikler">
            <section><h3>${c('Reaksiyon sıcaklıkları', 'Reaction temperatures')} <span class="ur-form-etiket"><b>FR-011</b> 1/2</span></h3><${Cizgi} seriler=${g.reaksiyon} /></section>
            <section><h3>${c('Reaktör ağırlığı', 'Reactor weight')} <span class="ur-form-etiket"><b>FR-011</b> 1/2</span></h3><${Cizgi} seriler=${g.agirlik} birim="kg" /></section>
            <section><h3>${c('E2 tankı soğutma', 'E2 tank cooling')} <span class="ur-form-etiket"><b>FR-011</b> 2/2</span></h3><${Cizgi} seriler=${g.sogutma} /></section>
          </div></div><//>`
      : html`
        <div class="ur-secim"><span class="kucuk soluk">${c('Ölçüm', 'Reading')}</span>
          ${OLCUMLER.map((x) => html`<button type="button" class=${'secenek' + (x.id === o.id ? ' secili' : '')} onClick=${() => setOlcum(x.id)}><span class="ur-form-etiket"><b>${formKisa(x.form)}</b></span> ${c(...x.ad)}</button>`)}</div>
        <div class="ur-secim">
          <input type="search" class="girdi ur-parti-ara" aria-label=${c('Parti ara', 'Find a batch')} placeholder=${c('Parti, ürün veya reaktör ara', 'Find a batch, product or reactor')} value=${partiSorgu} onInput=${(e) => setPartiSorgu(e.target.value)} />
          <span class="kucuk soluk" role="status">${m('{0} parti seçili', '{0} selected', gosterilen.length)}</span>
          <button type="button" class="d kucuk-d" disabled=${!secim.length} onClick=${() => setSecili([])}>${c('Seçimi temizle', 'Clear selection')}</button>
        </div>
        <div class="ur-secim" role="group" aria-label=${c('Karşılaştırılacak partiler', 'Batches to compare')}>
          ${eslesenler.map((x) => html`<button key=${x.ad} type="button" aria-pressed=${secim.includes(x.ad)} class=${'secenek ur-parti-sec' + (secim.includes(x.ad) ? ' secili' : '')} style=${{ '--renk': renk(x.ad) || 'var(--cizgi2)' }}
            onClick=${() => setSecili(secim.includes(x.ad) ? secim.filter((a) => a !== x.ad) : [...secim, x.ad])}><i />${x.ad}</button>`)}
          ${!eslesenler.length && html`<span class="soluk kucuk">${adaylar.length ? c('Eşleşen parti yok', 'No batch matches') : c('Bu ölçüme ait veri yok', 'No data for this measurement')}</span>`}
        </div>
        <${K.Kart} baslik=${`${c(...o.ad)} · ${formKisa(o.form)}`} sag=${html`<span class="kucuk soluk">${c('İlk ölçümden geçen süre', 'Time since first reading')}</span>`}>
          <div class="kart-ic">${ustUste.length ? html`<${Cizgi} key=${o.id + ':' + gosterilen.map((x) => x.ad).join('|')} seriler=${ustUste} birim=${o.birim} sure yukseklik=${260} />
            <div class="tablo-kap"><table class="tablo ur-karsilastir"><thead><tr><th>${c('Parti', 'Batch')}</th><th>${c('Ürün', 'Product')}</th><th>${c('Başlangıç', 'Start')}</th><th class="sag">${c('Süre', 'Duration')}</th><th class="sag">${c('En düşük', 'Min')}</th><th class="sag">${c('En yüksek', 'Max')}</th><th class="sag">${c('Son', 'Last')}</th></tr></thead><tbody>
              ${ustUste.map((s) => { const ys = s.ham.map((n) => n.y); const son = s.noktalar[s.noktalar.length - 1]; return html`<tr class="tik" key=${s.ad} onClick=${() => partiAc(s.ad)}>
                <td><i class="ur-renk" style=${{ background: s.renk }} /><b>${s.ad}</b></td><td class="kucuk">${s.parti.urun || '—'}</td><td class="kucuk">${s.parti.bas ? tarihYaz(s.parti.bas) : '—'} ${s.ham[0].saat}</td>
                <td class="sag sayi">${sureYaz(son.x).replace('+', '')}</td><td class="sag sayi">${sayiYaz(Math.min(...ys))}</td><td class="sag sayi">${sayiYaz(Math.max(...ys))}</td><td class="sag sayi">${sayiYaz(son.y)} ${o.birim}</td></tr>`; })}
            </tbody></table></div>` : html`<${BosDurum} ikon="ozet" baslik=${c('Parti seçin', 'Choose batches')} />`}</div><//>`}`;
  }

  /* ---------------- Liste parçaları ---------------- */
  function KayitListesi({ liste, bos }) {
    if (!liste.length) return html`<${BosDurum} ikon="belge" baslik=${bos || c('Kayıt yok', 'No records')} />`;
    return html`<ul class="ur-kayitlar">${liste.map((k) => { const den = k.durum === 'taslak' ? null : U.denetle(k); return html`<li key=${k.id} onClick=${() => isle(k)}>
      <span class="ur-kayit-ikon"><${Ikon} ad=${U.formAl(k.form)?.ikon || 'belge'} boyut=${18} /></span>
      <span class="ne"><b>${k.form ? html`<${FormEtiket} form=${k.form} /> ${c(U.formAl(k.form).ad, U.formAl(k.form).en)}` : c('Form türü seçilmedi', 'Form type not chosen')}${k.parti ? ' · ' + k.parti : ''}</b>
        <small>${k.no} · ${tarihYaz(k.alanlar?.tarih || k.tarih)}${k.isleyen ? ' · ' + k.isleyen : ''}${(k.tarama || []).length || k.ornekTarama ? ' · ' + c('taramalı', 'scanned') : ''}</small></span>
      <span class="ur-kayit-rozet">${den && den.disari.length > 0 && html`<span class="rozet yok" title=${c('Sınır dışı değer', 'Out-of-range value')}><${Ikon} ad="uyari" />${den.disari.length}</span>`}<${Durum} d=${k.durum} /></span></li>`; })}</ul>`;
  }

  /* ---------------- Sayfalar ---------------- */
  function GenelBakis() {
    const d = depo();
    const partiler = U.partiler(d);
    const son = partiler[0];
    const bekleyen = U.bekleyenTaramalar(d);
    const kontrol = U.kontrolBekleyen(d);
    const vardiya = U.kayitlar(d).find((k) => k.form === 'FR-032' && k.durum !== 'taslak');
    const ekipman = vardiya ? U.satirlar(vardiya, U.FORMLAR['FR-032'].tablolar[1]) : [];
    /* Eğri için reaksiyon formu işlenmiş en son parti (yeni başlayan partinin taraması henüz işlenmemiş olabilir). */
    const egriParti = partiler.find((p) => p.kayitlar.some((k) => k.form === 'FR-011-1' && k.durum !== 'taslak'));
    const g = egriParti && partiGrafikleri(egriParti);
    const uyariToplam = partiler.reduce((t, p) => t + p.uyari, 0);
    return html`<${K.Selam} bant baslik=${NT.ui.karsilama(b.kullanici)}>
      ${c('Partiler')} <b>${partiler.length}</b> · ${c('Giriş sırası')} <b>${bekleyen.length}</b> · ${c('Kontrol sırası')} <b class=${kontrol.length ? 'u' : ''}>${kontrol.length}</b><//>
      <div class="ur-pano-araclar"><button class="d ana-d" onClick=${taraAc}><${Ikon} ad="kamera" />${c('Form tara', 'Scan forms')}</button></div>
      <div class="kpi-sira">
        <${K.Kpi} ad="Son parti" deger=${son ? son.ad : '—'} alt=${son ? [son.urun, tarihYaz(son.bas)].filter(Boolean).join(' · ') : ''} ikon="dolum" />
        <${K.Kpi} ad="İşlenmeyi bekleyen" deger=${bekleyen.length} alt=${c('taranmış sayfa', 'scanned pages')} ikon="kamera" vurgu=${bekleyen.length > 0} />
        <${K.Kpi} ad="Kontrol bekleyen" deger=${kontrol.length} alt=${c('işlenmiş kayıt', 'entered records')} ikon="kalem" />
        <${K.Kpi} ad="Sınır dışı değer" deger=${uyariToplam} alt=${c('bütün partilerde', 'across batches')} ikon="uyari" vurgu=${uyariToplam > 0} />
      </div>
      <div class="ur-genel-izgara">
        <${K.Kart} baslik=${egriParti ? m('{0} · reaksiyon eğrisi', '{0} · reaction curve', egriParti.ad) : c('Reaksiyon eğrisi', 'Reaction curve')} sag=${egriParti && html`<button class="d kucuk-d" onClick=${() => partiAc(egriParti.ad)}>${c('Parti dosyası', 'Batch file')} →</button>`}>
          <div class="kart-ic">${g ? html`<${Cizgi} seriler=${g.reaksiyon} />` : html`<${BosDurum} baslik=${c('Henüz parti yok', 'No batches yet')} />`}</div><//>
        <${K.Kart} baslik=${c('İşleme sırası', 'Entry queue')} sag=${html`<a href="#/formlar" class="kucuk">${c('Tümü →', 'All →')}</a>`}>
          <div class="kart-ic"><${KayitListesi} liste=${[...bekleyen, ...kontrol].slice(0, 6)} bos=${c('Bekleyen form yok', 'Nothing waiting')} /></div><//>
      </div>
      <div class="ur-genel-izgara">
        <${K.Kart} baslik=${c('Eksik formlar', 'Missing forms')}><div class="kart-ic">
          ${partiler.filter((p) => p.eksikFormlar.length).length ? html`<ul class="ur-eksik">${partiler.filter((p) => p.eksikFormlar.length).map((p) => html`<li onClick=${() => partiAc(p.ad)}><b>${p.ad}</b><span>${p.eksikFormlar.map((x) => html`<span class="rozet kritik">${x === 'FR-035' ? 'FR-035' : x.replace('-1', ' 1/2').replace('-2', ' 2/2')}</span>`)}</span></li>`)}</ul>`
            : html`<p class="soluk">${c('Bütün partilerin formları tam.', 'All batches have their forms.')}</p>`}</div><//>
        <${K.Kart} baslik=${c('Kritik ekipman (son vardiya devri)', 'Critical equipment (last handover)')} sag=${vardiya && html`<span class="kucuk soluk">${tarihYaz(vardiya.alanlar?.tarih)} · ${c(vardiya.alanlar?.vardiya || '')}</span>`}><div class="kart-ic">
          ${ekipman.length ? html`<div class="ur-ekipman">${ekipman.map((e) => html`<span class=${'ur-ekipman-cip d-' + (e.durum || 'yok')} title=${e.aciklama || ''}><i>${e.durum || '?'}</i>${c(e.ekipman)}</span>`)}</div>
            <p class="kucuk soluk">${c('N normal · A anormal · K kapalı/devre dışı', 'N normal · A abnormal · K off')}</p>` : html`<p class="soluk">${c('Vardiya devir kaydı yok.', 'No shift handover yet.')}</p>`}</div><//>
      </div>`;
  }

  function Partiler() {
    const d = depo();
    const [q, setQ] = useState('');
    const liste = U.partiler(d).filter((p) => ara(`${p.ad} ${p.urun} ${p.reaktor}`, q));
    return html`<${K.Selam} baslik=${c('Partiler', 'Batches')} sag=${html`<a class="d ana-d" href="#/grafikler/karsilastir"><${Ikon} ad="grafik" />${c('Partileri karşılaştır', 'Compare batches')}</a>`}>${c('Her parti, FR-011 ve FR-035 kayıtlarından derlenir. Karta tıklayınca parti dosyası açılır.', 'Each batch is compiled from FR-011 and FR-035 records. Click a card for the batch file.')}<//>
      <div class="tz-cipler"><input class="girdi" style="max-width:260px;border-radius:99px" placeholder=${c('Parti, ürün…', 'Batch, product…')} value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
      ${liste.length ? html`<div class="ur-parti-kartlar">${liste.map((p) => html`<button class="ur-parti-kart" onClick=${() => partiAc(p.ad)}>
        <span class="bas"><b>${p.ad}</b>${p.eksikFormlar.length ? html`<span class="rozet kritik">${m('{0} eksik', '{0} missing', p.eksikFormlar.length)}</span>` : html`<span class="rozet iyi">${c('Tam', 'Complete')}</span>`}</span>
        <span class="soluk">${p.urun || '—'} · ${p.reaktor || '—'} · ${p.bas ? tarihYaz(p.bas) : '—'}</span>
        <span class="ur-parti-sayilar"><span><small>${c('Miktar', 'Qty')}</small>${p.miktar ? `${Number(p.miktar).toLocaleString(NT.dil.yerel())} kg` : '—'}</span><span><small>${c('Asit', 'Acid')}</small>${yaz(p.asit)}</span><span><small>${c('Visk.', 'Visc.')}</small>${yaz(p.viskozite)}</span></span>
        <span class="ur-parti-formlar">${['FR-011-1', 'FR-011-2', 'FR-035'].map((x) => html`<span class=${p.eksikFormlar.includes(x) ? 'yok' : 'var'}>${x === 'FR-035' ? 'FR-035' : x.replace('-1', ' 1/2').replace('-2', ' 2/2')}</span>`)}</span>
        ${(p.taslak || p.kontrolsuz || p.uyari) ? html`<span class="kucuk">${[p.taslak && m('{0} işlenmedi', '{0} not entered', p.taslak), p.kontrolsuz && m('{0} kontrol bekliyor', '{0} awaiting check', p.kontrolsuz), p.uyari && m('{0} sınır dışı', '{0} out of range', p.uyari)].filter(Boolean).join(' · ')}</span>` : ''}
      </button>`)}</div>` : html`<${BosDurum} ikon="dolum" baslik=${c('Parti yok', 'No batches')} aciklama=${c('FR-011 formu işlenince parti burada görünür.', 'A batch appears once its FR-011 form is entered.')} />`}`;
  }

  function Formlar() {
    const d = depo();
    // İşlenecek sayfa yoksa Yönetici doğrudan kontrol sırasını görür (yerel deneme, 2026-11-16).
    // Kullanıcı seçene kadar her çizimde hesaplanır (kayıtlar yüklenmeden önceki ilk çizim de doğru sonuca döner).
    const [secilen, setSuz] = useState(null);
    const suz = secilen || (yetkili() && !U.kayitlar(d).some((k) => k.durum === 'taslak') && U.kayitlar(d).some((k) => k.durum === 'islendi') ? 'kontrol' : 'bekleyen');
    const [form, setForm] = useState('');
    const [grup, setGrup] = useState('');
    const tum = U.kayitlar(d).filter((k) => !form || (k.form || '').startsWith(form));
    const liste = suz === 'bekleyen' ? tum.filter((k) => k.durum === 'taslak') : suz === 'kontrol' ? tum.filter((k) => k.durum === 'islendi') : tum;
    return html`<${K.Selam} baslik=${c('Formlar', 'Forms')} sag=${html`<button class="d" onClick=${elleGir}><${Ikon} ad="kalem" />${c('Elle gir', 'Enter manually')}</button><button class="d ana-d" onClick=${taraAc}><${Ikon} ad="kamera" />${c('Form tara', 'Scan forms')}</button>`}>
        ${c('Taranan her sayfa önce “işlenmeyi bekliyor” olur. Değerler girilince kontrol bekler; Yönetici kontrol edince kilitlenir.', 'Each scanned page first awaits entry. Once values are entered it awaits a check; after a manager checks it, it is locked.')}<//>
      <${K.Cipler} secenekler=${[['bekleyen', c('İşlenmeyi bekleyen', 'Awaiting entry'), tum.filter((k) => k.durum === 'taslak').length], ['kontrol', c('Kontrol bekleyen', 'Awaiting check'), tum.filter((k) => k.durum === 'islendi').length], ['hepsi', c('Tümü', 'All'), tum.length]]} deger=${suz} degis=${setSuz}>
        <select class="girdi ur-form-sec" value=${form} onChange=${(e) => setForm(e.target.value)}><option value="">${c('Bütün formlar', 'All forms')}</option>${['FR-011', 'FR-035', 'FR-005', 'FR-032'].map((x) => html`<option value=${x}>${x}</option>`)}</select><//>
      <div class="ur-secim"><span class="kucuk soluk">${c('Grupla', 'Group')}</span>
        ${[['', c('Sıraya göre', 'In order')], ['form', c('Forma göre', 'By form')], ['parti', c('Partiye göre', 'By batch')]].map(([id, yazi]) => html`<button type="button" class=${'secenek' + (grup === id ? ' secili' : '')} onClick=${() => setGrup(id)}>${yazi}</button>`)}</div>
      ${!grup || !liste.length ? html`<${K.Kart}><div class="kart-ic"><${KayitListesi} liste=${liste} bos=${suz === 'bekleyen' ? c('İşlenmeyi bekleyen form yok', 'Nothing awaiting entry') : c('Kayıt yok', 'No records')} /></div><//>`
        : gruplar(liste, grup).map(([ad, l]) => html`<${K.Kart} key=${ad} baslik=${ad} sag=${html`${grup === 'parti' && ad !== bosGrup() ? html`<button class="d kucuk-d" onClick=${() => partiAc(ad)}>${c('Parti dosyası', 'Batch file')} →</button>` : ''}<span class="rozet">${l.length}</span>`}>
          <div class="kart-ic"><${KayitListesi} liste=${l} /></div><//>`)}`;
  }
  const bosGrup = () => c('Partisiz', 'No batch');
  /* Kayıtları form türüne (FR-011 1/2, 2/2 …) ya da partiye göre gruplar; parti grupları en yeni parti üstte. */
  function gruplar(liste, grup) {
    const m = new Map();
    for (const k of liste) {
      const ad = grup === 'form' ? (k.form ? `${formKisa(k.form.startsWith('FR-035') ? 'FR-035' : k.form)} · ${c(U.formAl(k.form).ad, U.formAl(k.form).en)}` : c('Form türü seçilmedi', 'Form type not chosen'))
        : (U.partiAdi(k.parti || k.alanlar?.parti) || bosGrup());
      if (!m.has(ad)) m.set(ad, []);
      m.get(ad).push(k);
    }
    const l = [...m.entries()];
    return grup === 'parti' ? l.sort(([a], [b2]) => (a === bosGrup()) - (b2 === bosGrup()) || U.partiNo(b2) - U.partiNo(a)) : l.sort(([a], [b2]) => a.localeCompare(b2, 'tr'));
  }

  function Hammadde() {
    const d = depo();
    const liste = U.kayitlar(d).filter((k) => k.form === 'FR-005');
    return html`<${K.Selam} baslik=${c('Hammadde kabul', 'Raw material acceptance')} sag=${html`<button class="d ana-d" onClick=${taraAc}><${Ikon} ad="kamera" />${c('FR-005 tara', 'Scan FR-005')}</button>`}>
        ${c('Her isotank teslimi için FR-005. Program COA değerlerini form limitleriyle karşılaştırıp karar önerir; kararı kontrol eden kişi verir. Red için DÖF açılmalıdır.', 'FR-005 for each isotank delivery. The program compares COA values with the form limits and suggests a decision; the checker decides. A rejection needs a corrective action.')}<//>
      <${K.Kart}>${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>${c('Tarih', 'Date')}</th><th>${c('İsotank', 'Isotank')}</th><th>${c('Tedarikçi', 'Supplier')}</th><th>COA</th><th class="sag">${c('Asit', 'Acid')}</th><th class="sag">${c('Su %', 'Water %')}</th><th>${c('Karar', 'Decision')}</th><th>${c('Öneri', 'Suggestion')}</th><th>${c('Durum', 'Status')}</th></tr></thead><tbody>
        ${liste.map((k) => { const coa = U.satirlar(k, U.FORMLAR['FR-005'].tablolar[1]); const o = U.hammaddeOneri(k); const a = k.alanlar || {};
          return html`<tr class="tik" key=${k.id} onClick=${() => isle(k)}><td class="kucuk">${tarihYaz(a.tarih || k.tarih)}</td><td><b>${a.isotank || '—'}</b></td><td class="kucuk">${a.tedarikci || '—'}</td><td class="kucuk">${a.coa || '—'}</td>
            <td class=${'sag sayi ' + (U.degerDurumu(U.FORMLAR['FR-005'].tablolar[1].sutunlar[2], coa[1].deger, coa[1]) ? 'kirmizi' : '')}>${yaz(coa[1].deger)}</td><td class=${'sag sayi ' + (U.degerDurumu(U.FORMLAR['FR-005'].tablolar[1].sutunlar[2], coa[2].deger, coa[2]) ? 'kirmizi' : '')}>${yaz(coa[2].deger)}</td>
            <td>${a.karar ? html`<span class=${'rozet ' + (a.karar === 'Kabul' ? 'iyi' : a.karar === 'Red' ? 'yok' : 'kritik')}>${c(a.karar)}</span>` : '—'}</td><td class="kucuk">${k.durum === 'taslak' ? '' : o.karar}</td><td><${Durum} d=${k.durum} /></td></tr>`; })}</tbody></table></div>`
        : html`<${BosDurum} ikon="alim" baslik=${c('Hammadde kaydı yok', 'No raw material records')} />`}<//>`;
  }

  function Vardiya() {
    const d = depo();
    const liste = U.kayitlar(d).filter((k) => k.form === 'FR-032');
    return html`<${K.Selam} baslik=${c('Vardiya devir-teslim', 'Shift handover')} sag=${html`<button class="d ana-d" onClick=${taraAc}><${Ikon} ad="kamera" />${c('FR-032 tara', 'Scan FR-032')}</button>`}>
        ${c('Her vardiya değişiminde FR-032. Anormal (A) işaretlenen ekipman ve açık arızalar burada ve genel bakışta öne çıkar.', 'FR-032 at each shift change. Equipment marked abnormal (A) and open faults stand out here and on the overview.')}<//>
      <${K.Kart}>${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>${c('Tarih', 'Date')}</th><th>${c('Vardiya', 'Shift')}</th><th>${c('Devreden → devralan', 'Outgoing → incoming')}</th><th>${c('Anormal / kapalı', 'Abnormal / off')}</th><th>${c('Açık arıza', 'Open faults')}</th><th>${c('Durum', 'Status')}</th></tr></thead><tbody>
        ${liste.map((k) => { const e = U.satirlar(k, U.FORMLAR['FR-032'].tablolar[1]); const a = k.alanlar || {}; const ariza = U.satirlar(k, U.FORMLAR['FR-032'].tablolar[2]);
          return html`<tr class="tik" key=${k.id} onClick=${() => isle(k)}><td class="kucuk">${tarihYaz(a.tarih || k.tarih)}</td><td class="kucuk">${a.vardiya ? c(a.vardiya) : '—'}</td><td class="kucuk">${a.devreden || '—'} → ${a.devralan || '—'}</td>
            <td>${e.filter((x) => x.durum === 'A' || x.durum === 'K').map((x) => html`<span class=${'rozet ' + (x.durum === 'A' ? 'yok' : '')} title=${x.aciklama || ''}>${c(x.ekipman)} · ${x.durum}</span> `)}</td><td class="kucuk">${ariza.map((x) => x.tanim).filter(Boolean).join(', ') || '—'}</td><td><${Durum} d=${k.durum} /></td></tr>`; })}</tbody></table></div>`
        : html`<${BosDurum} ikon="saat" baslik=${c('Vardiya kaydı yok', 'No handovers')} />`}<//>`;
  }

  /* ---------------- Başlat ---------------- */
  function Hazirlaniyor() {
    return html`<div class="tz-kurulum"><div class="tz-kurulum-kutu"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" />
      <h1>${c('Üretim paneli hazırlanıyor', 'Production panel in preparation')}</h1>
      <p>${c('Bu bölüm şimdilik yalnız sunum modunda açılır. Canlı kayıt tablosu onaydan sonra kurulacak.', 'For now this section opens in demo mode only. The live record table will be set up after approval.')}</p>
      <a class="d ana-d tz-buyuk" href=${NT.c.adres('uretim', { demo: true })}>${c('Sunumu aç', 'Open demo')}</a></div></div>`;
  }
  void Hazirlaniyor; void render; // canlıya geçildi (2026-11-18, 2. aşama): kayıtlar olaylar_uretim tablosunda
  K.calistir({
    sekmeler: [
      { id: 'genel', ad: 'Genel Bakış', ikon: 'ozet' },
      { id: 'partiler', ad: 'Partiler', ikon: 'dolum' },
      { id: 'grafikler', ad: 'Grafikler', ikon: 'grafik' },
      { id: 'formlar', ad: 'Formlar', ikon: 'belge', sayac: (d) => U.bekleyenTaramalar(d).length + U.kontrolBekleyen(d).length },
      { id: 'hammadde', ad: 'Hammadde kabul', ikon: 'alim' },
      { id: 'vardiya', ad: 'Vardiya devri', ikon: 'saat' },
      { id: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
    ],
    sayfalar: { genel: GenelBakis, partiler: Partiler, grafikler: Grafikler, formlar: Formlar, hammadde: Hammadde, vardiya: Vardiya,
      ayarlar: () => html`<${K.AyarlarSayfasi} cop=${{ kayit: { ad: 'Üretim kaydı', ozet: (r) => `${r.form || ''} ${r.parti || ''}` } }} />` },
    eylemler: [
      { ad: 'Form tara', alt: 'PDF ya da fotoğraf', ikon: 'kamera', tus: 'T', fn: taraAc },
      { ad: 'Elle gir', alt: 'Taramasız form kaydı', ikon: 'kalem', tus: 'E', fn: elleGir },
    ],
    arama: (d, q) => U.kayitlar(d).filter((k) => ara(`${k.no} ${k.form} ${k.parti} ${k.alanlar?.isotank || ''}`, q)).map((k) => ({ tur: 'Form', ad: `${k.no} · ${U.formAdi(k.form)}`, ek: k.parti || '', fn: () => isle(k) })),
    uzakKoleksiyonlar: ['kayit'],
    geri: { yazi: c('Üretim paneli'), adres: NT.c.adres('portal', { panel: 'uretim', kullanici: new URLSearchParams(location.search).get('kullanici') }) },
  });
  void useMemo; void onceYaz;
})();
