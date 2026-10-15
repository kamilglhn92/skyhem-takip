/* Satış Takip — arayüz: genel bakış, sevkiyatlar, müşteriler, partiler, rapor, ayarlar. */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, useState, useMemo } = window.htmPreact;
  const { Ikon, Modal, Alan, Oneri, BosDurum, Ekler, BelgeKutusu, GecmisBolumu, bildir, onayla } = NT.ui;
  const K = NT.kabuk;
  const S = NT.satis;
  const { bugun, uid, sayi, tarihYaz, gunFarki, ara, trSirala, AYLAR } = NT.c;
  const b = NT.baglanti;
  const depo = () => b.depo;
  const kg = (n) => `${K.sayiYaz(n)} kg`;
  const ton = (n) => (n / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  const paraYaz = (n, p) => `${K.sayiYaz(n, 2)} ${p || '₺'}`;

  Object.assign(NT.ui.ALAN_ADLARI, {
    musteri: 'Müşteri', siparisTarihi: 'Sipariş tarihi', sevkTarihi: 'Sevk tarihi', teslimTarihi: 'Teslim tarihi', coaNo: 'CoA no', coaTarihi: 'CoA tarihi',
    irsaliyeNo: 'İrsaliye no', konteyner: 'Konteyner / isotank no', faturaNo: 'Fatura no', paraBirimi: 'Para birimi', unvan: 'Unvan', eposta: 'E-posta',
    uretimTarihi: 'Üretim tarihi', uretimKg: 'Üretim miktarı (kg)',
    coaBelge: 'CoA belgesi', irsaliyeBelge: 'İrsaliye', faturaBelge: 'Fatura', kontrolFormu: 'Sevkiyat kontrol formu', kantarFisleri: 'Kantar fişleri', packingList: 'Packing list',
    aracFoto: 'Araç fotoğrafları', plaka: 'Plaka', sofor: 'Şoför',
  });
  NT.ui.DEGER_YAZ.kalemler = (v) => (v || []).map((k) => `${k.adet}× ${k.ambalaj} ${k.urun}${k.parti ? ' ' + k.parti : ''} (${K.sayiYaz(S.kalemNet(k))} kg)`).join(', ');
  NT.ui.DEGER_YAZ.musteri = (v) => depo()?.kayit('musteri', v)?.ad || v;

  /* ---------------- Ambalaj çizimleri (numunedeki şişeler gibi) ---------------- */
  const R = { f: 'var(--ana-cizgi)', s: 'var(--ana)', k: 'var(--ana-koyu)', z: 'var(--yuzey)' };
  function AmbalajCizimi({ tur, boyut = 1 }) {
    const g = (w, h, ic) => html`<svg width=${w * boyut} height=${h * boyut} viewBox=${`0 0 ${w} ${h}`} aria-hidden="true" class="amb-cizim">${ic}</svg>`;
    if (tur === 'IBC') return g(40, 42, html`
      <rect x="5" y="36" width="30" height="4" rx="1" fill=${R.k} />
      <rect x="8" y="7" width="24" height="28" rx="4" fill=${R.z} stroke=${R.s} stroke-width="1.2" />
      <rect x="9.5" y="15" width="21" height="18.5" rx="2.5" fill=${R.f} />
      <rect x="4" y="5" width="32" height="31" rx="2" fill="none" stroke=${R.s} stroke-width="1.6" />
      <path d=${'M4 15.5h32M4 25.5h32M12 5v31M20 5v31M28 5v31'} stroke=${R.s} stroke-width=".9" opacity=".75" />
      <rect x="16.5" y="1.5" width="7" height="4" rx="1" fill=${R.k} />
      <rect x="17.5" y="32" width="5" height="3.5" rx="1" fill=${R.k} />`);
    if (tur === 'Varil') return g(30, 42, html`
      <path d="M4 7 Q4 4 15 4 Q26 4 26 7 L26 36 Q26 39 15 39 Q4 39 4 36 Z" fill=${R.f} stroke=${R.s} stroke-width="1.6" />
      <ellipse cx="15" cy="7" rx="11" ry="3" fill=${R.z} stroke=${R.s} stroke-width="1.4" />
      <path d="M4 16 Q15 19 26 16M4 27 Q15 30 26 27" fill="none" stroke=${R.k} stroke-width="1.6" />
      <circle cx="10" cy="6.6" r="1.2" fill=${R.k} />`);
    if (tur === 'İsotank') return g(58, 34, html`
      <rect x="2" y="3" width="54" height="27" rx="1.5" fill="none" stroke=${R.s} stroke-width="1.6" />
      <rect x="6" y="6.5" width="46" height="20" rx="10" fill=${R.f} stroke=${R.s} stroke-width="1.3" />
      <path d="M2 3l6 4M56 3l-6 4M2 30l6-4M56 30l-6-4" stroke=${R.s} stroke-width="1.2" />
      <rect x="25" y="2" width="8" height="3" rx="1" fill=${R.k} />
      <rect x="1" y="29" width="56" height="3" rx="1" fill=${R.k} />`);
    if (tur === 'Dökme') return g(62, 34, html`
      <rect x="2" y="7" width="40" height="17" rx="8.5" fill=${R.f} stroke=${R.s} stroke-width="1.5" />
      <path d="M44 11h9l6 7v8H44z" fill=${R.z} stroke=${R.s} stroke-width="1.5" stroke-linejoin="round" />
      <path d="M48 13h4.5l3.5 4.5H48z" fill=${R.f} />
      <rect x="2" y="24" width="57" height="3" rx="1" fill=${R.k} />
      <circle cx="11" cy="28.5" r="3.6" fill=${R.z} stroke=${R.k} stroke-width="2" /><circle cx="21" cy="28.5" r="3.6" fill=${R.z} stroke=${R.k} stroke-width="2" />
      <circle cx="51" cy="28.5" r="3.6" fill=${R.z} stroke=${R.k} stroke-width="2" />
      <rect x="18" y="4" width="6" height="3" rx="1" fill=${R.k} />`);
    return g(30, 42, html`<rect x="5" y="8" width="20" height="30" rx="3" fill=${R.f} stroke=${R.s} stroke-width="1.5" /><rect x="11" y="3" width="8" height="5" rx="1" fill=${R.k} />`);
  }

  /* ---------------- Durum ---------------- */
  const ROZET = { Sipariş: ['mor', 'saat'], Hazırlanıyor: ['kritik', 'kutu'], Yolda: ['bilgi', 'sevk'], 'Teslim edildi': ['iyi', 'daire_tik'] };
  function DurumRozeti({ s }) {
    if (s.iptal) return html`<span class="rozet yok"><${Ikon} ad="kapat" />İptal</span>`;
    const [r, ik] = ROZET[s.durum] || ['', 'bilgi'];
    return html`<span class=${'rozet ' + r}><${Ikon} ad=${ik} />${s.durum}</span>`;
  }
  /* Eksik belge/bilgi hatırlatması: zorunlu değil. Sonuç true (devam), false (vazgeç) ya da 'alternatif'. */
  function eksikHatirlat(eksik, { evet = 'Yine de kaydet', hayir = 'Geri dön, tamamlayayım', alternatif } = {}) {
    return onayla('Aşağıdakiler henüz girilmedi veya yüklenmedi. Şimdi tamamlayabilir ya da daha sonra eklemek üzere devam edebilirsiniz.', {
      baslik: `${eksik.length} eksik var`, evet, hayir, alternatif,
      detay: html`<ul class="eksik-liste">${eksik.map((x) => html`<li>${x}</li>`)}</ul>`,
    });
  }
  async function ilerlet(s) {
    const d = depo();
    const sonraki = S.DURUMLAR[S.DURUMLAR.indexOf(s.durum) + 1];
    if (!sonraki) return;
    const eksik = S.belgeZamani({ ...s, durum: sonraki }) ? S.eksikler(s) : [];
    if (eksik.length) {
      const c = await eksikHatirlat(eksik, { evet: `Yine de “${sonraki}” yap`, hayir: 'Vazgeç', alternatif: 'Belgeleri ekle' });
      if (c === 'alternatif') return sevkAc(s, { durum: sonraki });
      if (c !== true) return;
    }
    const v = { durum: sonraki };
    if (sonraki === 'Yolda' && !s.sevkTarihi) v.sevkTarihi = bugun();
    if (sonraki === 'Teslim edildi') { v.teslimTarihi = bugun(); if (!s.sevkTarihi) v.sevkTarihi = bugun(); }
    await d.kaydet([{ c: 'sevk', k: s.id, v }]);
    bildir(`${s.no} · ${s.firma}: ${sonraki}`, { eylem: { yazi: 'Geri al', fn: () => d.kaydet([{ c: 'sevk', k: s.id, v: { durum: s.durum, sevkTarihi: s.sevkTarihi || '', teslimTarihi: s.teslimTarihi || '' } }]) } });
  }
  function IptalPenceresi({ s, kapat }) {
    const [neden, setNeden] = useState('');
    return html`<${Modal} dar baslik=${`${s.no} iptal edilsin mi?`} kapat=${kapat} alt=${html`<button class="d hayalet" onClick=${kapat}>Vazgeç</button>
      <button class="d tehlike" onClick=${async () => { await depo().kaydet([{ c: 'sevk', k: s.id, v: { iptal: true, iptalNeden: neden.trim(), iptalTarihi: bugun() } }]); bildir(`${s.no} iptal edildi.`); kapat(); }}>İptal et</button>`}>
      <div class="modal-ic"><p style="margin:0 0 12px">Kayıt silinmez; Sevkiyatlar › İptal’de kalır ve rapora girmez.</p>
        <${Alan} etiket="Neden (isteğe bağlı)"><input class="girdi" value=${neden} onInput=${(e) => setNeden(e.target.value)} autofocus placeholder="Örn: Müşteri siparişi erteledi" /><//></div>
    <//>`;
  }

  /* ---------------- Sevkiyat kartı ---------------- */
  const ADIM = { Sipariş: 'Sipariş', Hazırlanıyor: 'Hazırlanıyor', Yolda: 'Yolda', 'Teslim edildi': 'Teslim' };
  function KalemCip({ k }) {
    return html`<span class="st-kalem"><${AmbalajCizimi} tur=${k.ambalaj} boyut=${0.8} /><span><b>${k.adet} × ${k.ambalaj}</b> ${k.urun}${k.parti ? ' · ' + k.parti : ''}<small>${kg(S.kalemNet(k))}</small></span></span>`;
  }
  function SevkKarti({ s }) {
    const yer = S.DURUMLAR.indexOf(s.durum);
    const sonraki = s.iptal ? null : S.DURUMLAR[yer + 1];
    const net = S.sevkNet(s);
    const eksik = s.durum === 'Yolda' && !s.iptal ? S.eksikler(s) : [];
    const gun = gunFarki(s.siparisTarihi || bugun(), bugun());
    const bilgi = s.iptal ? `İptal · ${s.iptalNeden || 'neden yazılmamış'}`
      : s.durum === 'Teslim edildi' ? `Teslim ${tarihYaz(s.teslimTarihi || s.sevkTarihi)}`
      : s.durum === 'Yolda' ? `Yola çıktı ${tarihYaz(s.sevkTarihi)}` : gun === 0 ? 'Bugün' : `${gun} gündür`;
    return html`<div class="tz-gonderi st-kart" style=${s.iptal ? 'opacity:.72' : ''}>
      <div class="bas"><span class="etiket-kod">${s.no}</span><span class="firma" onClick=${() => sevkAc(s)}>${s.firma}</span>
        ${s.ulke && s.ulke !== 'Türkiye' && html`<span class="soluk kucuk">${s.ulke}</span>`}
        <span class=${'gun' + (!s.iptal && yer < 2 && gun >= 10 ? ' gec' : '')}>${bilgi}</span></div>
      <div class="st-kalemler">${(s.kalemler || []).map((k, i) => html`<${KalemCip} key=${i} k=${k} />`)}
        <span class="st-toplam">${kg(net)}${S.tutar(s) > 0 ? html`<small>${paraYaz(S.tutar(s), s.paraBirimi)}</small>` : ''}</span></div>
      ${!s.iptal && html`<div class="tz-adimlar">${S.DURUMLAR.map((x, i) => html`${i > 0 && html`<span class=${'tz-cizgi' + (i <= yer ? ' gecti' : '')} />`}
        <span class=${'tz-adim' + (i < yer || (i === yer && x === 'Teslim edildi') ? ' gecti' : i === yer ? ' simdi' : '')}><span class="o">${i < yer || (x === s.durum && x === 'Teslim edildi') ? html`<${Ikon} ad="tik" boyut=${12} />` : ''}</span><span class="yazi">${ADIM[x]}</span></span>`)}</div>`}
      <div class="alt">
        ${sonraki ? html`<button class="d ana-d kucuk-d" onClick=${() => ilerlet(s)}>→ ${ADIM[sonraki]}</button>`
          : html`<span class="soluk kucuk">${[s.plaka, s.sofor, s.konteyner].filter(Boolean).join(' · ')}</span>`}
        ${eksik.length > 0 && html`<button class="tz-alarm" style="border:0;cursor:pointer" title=${'Eksik: ' + eksik.join(', ')} onClick=${() => sevkAc(s)}><${Ikon} ad="uyari" />${eksik.length} eksik belge</button>`}
        <span class="bosluk" />
        ${s.iptal ? html`<button class="d hayalet kucuk-d" onClick=${() => depo().kaydet([{ c: 'sevk', k: s.id, v: { iptal: false } }])}><${Ikon} ad="geri" boyut=${15} />İptali geri al</button>`
          : s.durum !== 'Teslim edildi' && html`<button class="d hayalet kucuk-d" onClick=${() => K.ac(IptalPenceresi, { s })}><${Ikon} ad="kapat" boyut=${15} />İptal et</button>`}
        <button class="d hayalet kucuk-d" onClick=${() => sevkAc(s)}><${Ikon} ad="kalem" boyut=${15} />Düzenle</button>
      </div>
    </div>`;
  }
  const KartIzgara = ({ liste }) => html`<div class="st-izgara">${liste.map((s) => html`<${SevkKarti} key=${s.id} s=${s} />`)}</div>`;

  /* ---------------- Sevkiyat formu ---------------- */
  const bosKalem = (d, on = {}) => {
    const ambalaj = on.ambalaj || 'IBC';
    return { urun: on.urun || 'Ecosky 3103', parti: on.parti || '', ambalaj, adet: 1, brut: '', dara: S.daraOner(d, ambalaj), net: '', _daraElle: false };
  };
  function KalemSatiri({ k, degis, sil, d, i }) {
    const partiOneri = useMemo(() => S.partiler(d).filter((p) => p.urun === k.urun && p.parti).map((p) => p.parti), [k.urun, d.surum]);
    const s = (alan) => (v) => {
      const yeni = { ...k, [alan]: v };
      if (alan === 'dara') yeni._daraElle = true;
      if ((alan === 'ambalaj' || alan === 'adet') && !k._daraElle) yeni.dara = S.daraOner(d, yeni.ambalaj) * (sayi(yeni.adet) || 0);
      degis(yeni);
    };
    const net = S.kalemNet(k);
    const karisim = Array.isArray(k.karisim) ? k.karisim : null;
    const kSatir = (j, alan) => (v) => s('karisim')(karisim.map((p, x) => (x === j ? { ...p, [alan]: v } : p)));
    const karisimKg = karisim ? karisim.reduce((t, p) => t + sayi(p.kg), 0) : 0;
    // kg yazılmayan partilere düşecek pay (ipucu olarak gösterilir)
    const bosPay = karisim ? (() => { const l = karisim.filter((p) => String(p.parti).trim()); const n = l.filter((p) => !(sayi(p.kg) > 0)).length; return n ? Math.max(0, net - karisimKg) / n : 0; })() : 0;
    return html`<div class="st-kalem-satir">
      <div class="st-amb-sec">${S.AMBALAJLAR.map((a) => html`<button type="button" class=${'st-amb' + (k.ambalaj === a.id ? ' secili' : '')} onClick=${() => s('ambalaj')(a.id)} title=${a.ad}>
        <${AmbalajCizimi} tur=${a.id} boyut=${0.85} /><span>${a.id}</span></button>`)}</div>
      <div class="form-izgara">
        <${Oneri} id=${'st-parti-' + i} liste=${partiOneri} />
        <${Alan} etiket="Ürün" sinif="s4"><input class="girdi" list="st-urunler" value=${k.urun} onInput=${(e) => s('urun')(e.target.value)} /><//>
        ${karisim ? html`<${Alan} etiket="Parti" sinif="s4"><div class="girdi st-net">Karışım · ${karisim.filter((p) => String(p.parti).trim()).length} parti</div><//>`
          : html`<${Alan} etiket="Parti" sinif="s4">
            <input class="girdi" list=${'st-parti-' + i} value=${k.parti} placeholder="Örn: Batch #21" onInput=${(e) => s('parti')(e.target.value)} />
            <button type="button" class="st-link" onClick=${() => degis({ ...k, karisim: [{ parti: k.parti || '', kg: '' }, { parti: '', kg: '' }] })}>+ Birden fazla parti (karışım)</button><//>`}
        <${Alan} etiket="Adet" sinif="s4"><input class="girdi sayi" type="number" min="1" value=${k.adet} onInput=${(e) => s('adet')(e.target.value === '' ? '' : Number(e.target.value))} /><//>
        <${Alan} etiket="Brüt (kg)" sinif="s4"><input class="girdi sayi" inputmode="decimal" value=${k.brut} onInput=${(e) => s('brut')(e.target.value)} placeholder="Kantar" /><//>
        <${Alan} etiket="Dara (kg)" sinif="s4" ipucu=${!k._daraElle && k.ambalaj && sayi(k.adet) ? `${k.adet} × ${S.daraOner(d, k.ambalaj)} kg önerildi` : ''}><input class="girdi sayi" inputmode="decimal" value=${k.dara} onInput=${(e) => s('dara')(e.target.value)} /><//>
        <${Alan} etiket="Net (kg)" sinif="s4" ipucu=${sayi(k.brut) > 0 ? 'Brüt − dara' : 'Brüt yoksa neti yazın'}>
          ${sayi(k.brut) > 0 ? html`<div class="girdi sayi st-net">${K.sayiYaz(net)}</div>` : html`<input class="girdi sayi" inputmode="decimal" value=${k.net} onInput=${(e) => s('net')(e.target.value)} />`}<//>
        ${karisim && html`<div class="s12 st-karisim">
          <div class="st-karisim-bas"><b>Karışım</b><span class="soluk kucuk">Hangi partiden kaç kg? Kg yazılmayan partilere kalan net eşit bölünür.</span>
            <button type="button" class="st-link" onClick=${() => { const { karisim: _, ...tek } = k; degis({ ...tek, parti: String(karisim.find((p) => String(p.parti).trim())?.parti || '').trim() }); }}>Tek partiye dön</button></div>
          ${karisim.map((p, j) => html`<div class="st-karisim-satir" key=${j}>
            <input class="girdi" list=${'st-parti-' + i} value=${p.parti} placeholder="Örn: Batch #3" onInput=${(e) => kSatir(j, 'parti')(e.target.value)} />
            <input class="girdi sayi" inputmode="decimal" value=${p.kg} placeholder=${bosPay > 0 && String(p.parti).trim() ? `≈ ${K.sayiYaz(bosPay)}` : 'kg'} onInput=${(e) => kSatir(j, 'kg')(e.target.value)} />
            <span class="soluk kucuk">kg</span>
            <button type="button" class="d hayalet ikon-d" title="Partiyi çıkar" disabled=${karisim.length <= 2} onClick=${() => s('karisim')(karisim.filter((_, x) => x !== j))}><${Ikon} ad="kapat" boyut=${14} /></button>
          </div>`)}
          <div class="st-karisim-alt"><button type="button" class="d kucuk-d" onClick=${() => s('karisim')([...karisim, { parti: '', kg: '' }])}><${Ikon} ad="arti" boyut=${14} />Parti ekle</button>
            ${karisimKg > 0 && html`<span class=${'kucuk ' + (net > 0 && Math.abs(karisimKg - net) > 0.5 && karisim.every((p) => sayi(p.kg) > 0) ? 'hata-yazi' : 'soluk')}>Yazılan ${K.sayiYaz(karisimKg)} kg · kalem neti ${K.sayiYaz(net)} kg</span>`}</div>
        </div>`}
        <div class="s12 belge-izgara">
          <${BelgeKutusu} baslik="CoA (bu kalem)" ekler=${k.coaBelge} degis=${s('coaBelge')} ipucu=${karisim ? 'Karışımda her partinin CoA’sını ekleyin' : 'Bu kalemin analiz sertifikası'}>
            <label class="belge-tarih">CoA tarihi <input class="girdi" type="date" value=${k.coaTarihi || ''} onInput=${(e) => s('coaTarihi')(e.target.value)} /></label>
          <//>
          <${BelgeKutusu} baslik="Etiketler / diğer belgeler" ekler=${k.belgeler} degis=${s('belgeler')} ipucu="IBC etiketleri vb. (bu kalem)" />
        </div>
      </div>
      ${sil && html`<button type="button" class="d hayalet ikon-d st-kalem-sil" title="Kalemi çıkar" onClick=${sil}><${Ikon} ad="kapat" boyut=${16} /></button>`}
    </div>`;
  }

  function SevkFormu({ kayit, on = {}, kapat }) {
    const d = depo();
    const [f, setF] = useState(() => {
      const bos = { durum: 'Sipariş', siparisTarihi: bugun(), sevkTarihi: '', teslimTarihi: '', firma: '', musteri: '', ulke: 'Türkiye', adres: '', yetkili: '',
        kalemler: [bosKalem(d)], coaNo: '', coaTarihi: '', irsaliyeNo: '', faturaNo: '', konteyner: '', plaka: '', sofor: '',
        coaBelge: [], irsaliyeBelge: [], faturaBelge: [], kontrolFormu: [], kantarFisleri: [], packingList: [], aracFoto: [], birimFiyat: '', paraBirimi: '€', notlar: '', ekler: [] };
      // Kartta "Belgeleri ekle" denince aşama (on.durum) önceden seçili gelir.
      return kayit ? { ...bos, ...kayit, kalemler: (kayit.kalemler || []).map((k) => ({ ...k, _daraElle: true })), ...on } : { ...bos, ...on };
    });
    const [denendi, setDenendi] = useState(false);
    const [mesgul, setMesgul] = useState(false);
    const [fiyatAcik, setFiyatAcik] = useState(!!(kayit && kayit.birimFiyat));
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const oneriler = S.musteriOnerileri(d, f.firma).filter((m) => S.adNormal(m.ad) !== S.adNormal(f.firma) || !f.musteri)
      .map((m) => ({ ad: m.ad, alt: [m.ulke, m.yetkili].filter(Boolean).join(' · '), m }));
    const kayitli = S.musteriBul(d, f.firma);
    const musteriSec = (x) => setF((p) => ({ ...p, firma: x.m.ad, musteri: x.m.id, ulke: x.m.ulke || p.ulke, adres: x.m.adres || '', yetkili: x.m.yetkili || '' }));
    const net = f.kalemler.reduce((t, k) => t + S.kalemNet(k), 0);
    const kalemHata = f.kalemler.some((k) => !String(k.urun).trim() || !(sayi(k.adet) > 0) || !(S.kalemNet(k) > 0));
    const hatalar = { firma: !f.firma.trim() && 'Müşteri adını yazın', kalem: kalemHata && 'Her kalemde ürün, adet ve net kg olmalı' };
    const yer = S.DURUMLAR.indexOf(f.durum);

    const eksik = S.eksikler(f);
    const yurtdisi = S.yurtdisi(f);

    async function kaydet() {
      setDenendi(true);
      if (Object.values(hatalar).some(Boolean)) return;
      // Eksik belge/bilgi varsa hatırlat (araç yola çıktıysa); kullanıcı isterse yine de kaydeder.
      if (S.belgeZamani(f) && eksik.length && (await eksikHatirlat(eksik)) !== true) return;
      setMesgul(true);
      try {
        const kalemler = f.kalemler.map(({ _daraElle, karisim, ...k }) => {
          const x = { ...k, urun: String(k.urun).trim(), parti: String(k.parti || '').trim(), adet: sayi(k.adet), brut: sayi(k.brut) || '', dara: sayi(k.dara) || 0, net: S.kalemNet(k),
            coaBelge: k.coaBelge || [], coaTarihi: k.coaTarihi || '', belgeler: k.belgeler || [] };
          // Karışım: en az iki parti yazıldıysa saklanır, parti adı "Batch #3 + Batch #20" olur; tek parti kaldıysa normal kaleme döner.
          const l = (karisim || []).map((p) => ({ parti: String(p.parti || '').trim(), kg: sayi(p.kg) || '' })).filter((p) => p.parti);
          if (l.length > 1) { x.karisim = l; x.parti = S.karisimAdi(l); } else if (karisim) x.parti = l[0]?.parti || '';
          return x;
        });
        const v = {
          durum: f.durum, firma: f.firma.trim(), ulke: f.ulke, adres: f.adres.trim(), yetkili: f.yetkili.trim(),
          siparisTarihi: f.siparisTarihi, sevkTarihi: yer >= 2 ? f.sevkTarihi || bugun() : '', teslimTarihi: yer >= 3 ? f.teslimTarihi || f.sevkTarihi || bugun() : '',
          kalemler, coaBelge: f.coaBelge, coaTarihi: f.coaTarihi, irsaliyeBelge: f.irsaliyeBelge, faturaBelge: f.faturaBelge, kontrolFormu: f.kontrolFormu, kantarFisleri: f.kantarFisleri,
          packingList: f.packingList, aracFoto: f.aracFoto, plaka: f.plaka.trim().toLocaleUpperCase('tr'), sofor: f.sofor.trim(), konteyner: f.konteyner.trim(),
          birimFiyat: fiyatAcik ? sayi(f.birimFiyat) || '' : '', paraBirimi: f.paraBirimi, notlar: f.notlar, ekler: f.ekler,
        };
        // Eski kayıtlarda belge yerine yazılmış numaralar silinmez.
        for (const a of ['coaNo', 'irsaliyeNo', 'faturaNo']) if (String(f[a] || '').trim()) v[a] = String(f[a]).trim();
        // Firma adı kayıtlı bir müşteriyle eşleşiyorsa ona bağlanır; eşleşmiyorsa yeni müşteri oluşturulur.
        const m = S.musteriIslemleri(d, { ...v, musteri: kayitli ? kayitli.id : '' }, uid);
        v.musteri = m.id;
        const yeniMusteri = m.ops.some((o) => !d.kayit('musteri', o.k));
        if (kayit) {
          await d.kaydet([...m.ops, { c: 'sevk', k: kayit.id, v }]);
          bildir(`${kayit.no} güncellendi.`);
        } else {
          const no = K.yeniNo(d, 'sevk', 'SV', v.siparisTarihi || bugun());
          await d.kaydet([...m.ops, { c: 'sevk', k: uid(), v: { no, ...v } }]);
          bildir(`${no} kaydedildi · ${v.firma} · ${kg(net)}${yeniMusteri ? ' · müşteri listesine eklendi' : ''}`);
        }
        kapat();
      } finally { setMesgul(false); }
    }
    const silFn = async () => (await K.sil('sevk', kayit, `${kayit.no} (${kayit.firma})`)) && kapat();
    return html`<${Modal} genis baslik=${kayit ? `Sevkiyat ${kayit.no}` : 'Yeni sevkiyat'} kapat=${kapat} sag=${kayit && html`<${DurumRozeti} s=${kayit} />`}
      alt=${html`<${K.FormAlt} kayit=${kayit} sil=${silFn} kapat=${kapat} kaydet=${kaydet} mesgul=${mesgul} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <div class="s12 form-bolum">Müşteri</div>
        <${Alan} etiket="Firma" sinif="s8" hata=${denendi && hatalar.firma} ipucu=${f.firma.trim() ? (kayitli ? 'Kayıtlı müşteri' : 'Yeni müşteri — kaydedince müşteri listesine eklenir') : 'Yazmaya başlayın; daha önceki müşteriler altta çıkar'}>
          <${K.OneriGirdi} deger=${f.firma} degis=${(v) => setF((p) => ({ ...p, firma: v, musteri: '' }))} oneriler=${oneriler} sec=${musteriSec} placeholder="Firma adı" otomatikOdak=${!kayit} /><//>
        <${Alan} etiket="Ülke" sinif="s4"><input class="girdi" list="st-ulkeler" value=${f.ulke} onInput=${(e) => s('ulke')(e.target.value)} /><//>
        <${Alan} etiket="Yetkili" sinif="s4"><input class="girdi" value=${f.yetkili} onInput=${(e) => s('yetkili')(e.target.value)} /><//>
        <${Alan} etiket="Teslim adresi" sinif="s8"><input class="girdi" value=${f.adres} onInput=${(e) => s('adres')(e.target.value)} /><//>

        <div class="s12 form-bolum">Durum</div>
        <${Alan} etiket="Aşama" sinif="s12"><div class="secenekler">${S.DURUMLAR.map((x) => html`<button type="button" class=${'secenek' + (f.durum === x ? ' secili' : '')} onClick=${() => s('durum')(x)}>${x}</button>`)}</div><//>
        <${Alan} etiket="Sipariş tarihi" sinif="s4"><input class="girdi" type="date" value=${f.siparisTarihi} onInput=${(e) => s('siparisTarihi')(e.target.value)} /><//>
        ${yer >= 2 ? html`<${Alan} etiket="Sevk (yola çıkış) tarihi" sinif="s4" ipucu="Rapor bu tarihe göre"><input class="girdi" type="date" value=${f.sevkTarihi || bugun()} onInput=${(e) => s('sevkTarihi')(e.target.value)} /><//>` : html`<div class="s4" />`}
        ${yer >= 3 ? html`<${Alan} etiket="Teslim tarihi" sinif="s4"><input class="girdi" type="date" value=${f.teslimTarihi || f.sevkTarihi || bugun()} onInput=${(e) => s('teslimTarihi')(e.target.value)} /><//>` : html`<div class="s4" />`}

        <div class="s12 form-bolum">Ürün ve ambalaj <span class="soluk" style="font-weight:500;text-transform:none;letter-spacing:0">· toplam ${kg(net)}</span></div>
        <div class="s12">${f.kalemler.map((k, i) => html`<${KalemSatiri} key=${i} i=${i} k=${k} d=${d} degis=${(y) => s('kalemler')(f.kalemler.map((x, j) => (j === i ? y : x)))}
            sil=${f.kalemler.length > 1 ? () => s('kalemler')(f.kalemler.filter((_, j) => j !== i)) : null} />`)}
          ${denendi && hatalar.kalem && html`<div class="hata-yazi" style="margin-top:6px">${hatalar.kalem}</div>`}
          <button type="button" class="d kucuk-d" style="margin-top:10px" onClick=${() => { const son = f.kalemler[f.kalemler.length - 1]; s('kalemler')([...f.kalemler, bosKalem(d, son)]); }}><${Ikon} ad="arti" boyut=${15} />Kalem ekle (başka parti / ambalaj)</button>
          <${Oneri} id="st-urunler" liste=${S.urunler(d)} /><${Oneri} id="st-ulkeler" liste=${K.ulkeler()} /></div>

        <div class="s12 form-bolum">Araç</div>
        <${Alan} etiket="Plaka" sinif="s4"><input class="girdi mono" value=${f.plaka} onInput=${(e) => s('plaka')(e.target.value)} placeholder="34 ABC 123" /><//>
        <${Alan} etiket="Şoför adı" sinif="s4"><input class="girdi" list="st-soforler" value=${f.sofor} onInput=${(e) => s('sofor')(e.target.value)} placeholder="Ad Soyad" />
          <${Oneri} id="st-soforler" liste=${[...new Set(d.kayitlar('sevk').map((x) => String(x.sofor || '').trim()).filter(Boolean))].sort(trSirala)} /><//>
        <${Alan} etiket="Konteyner / isotank no" sinif="s4"><input class="girdi mono" value=${f.konteyner} onInput=${(e) => s('konteyner')(e.target.value)} placeholder="Varsa" /><//>
        <div class="s12"><${BelgeKutusu} foto baslik="Araç fotoğrafları" ekler=${f.aracFoto} degis=${s('aracFoto')} ipucu="Aracın ve yükün fotoğrafları; birden fazla seçilebilir" /></div>

        <div class="s12 form-bolum">Sevkiyat belgeleri ${S.belgeZamani(f) && eksik.length > 0 && html`<span style="font-weight:600;text-transform:none;letter-spacing:0;color:var(--kritik)">· ${eksik.length} eksik (kalemler dahil)</span>`}</div>
        <div class="s12 belge-izgara">
          ${(S.eskiCoa(f) || f.coaTarihi) && html`<${BelgeKutusu} baslik="CoA (eski kayıt · bütün kalemler)" ekler=${f.coaBelge} degis=${s('coaBelge')}
            eski=${[f.coaNo && `CoA no ${f.coaNo}`, f.coaTarihi && `tarih ${tarihYaz(f.coaTarihi)}`].filter(Boolean).join(' · ') + ' — yeni CoA’ları kalemlere yükleyin'} />`}
          <${BelgeKutusu} baslik="İrsaliye" ekler=${f.irsaliyeBelge} degis=${s('irsaliyeBelge')} eski=${f.irsaliyeNo && `Eski kayıt: irsaliye no ${f.irsaliyeNo}`} />
          <${BelgeKutusu} baslik="Fatura" ekler=${f.faturaBelge} degis=${s('faturaBelge')} eski=${f.faturaNo && `Eski kayıt: fatura no ${f.faturaNo}`} />
          <${BelgeKutusu} baslik="Sevkiyat kontrol formu" ekler=${f.kontrolFormu} degis=${s('kontrolFormu')} ipucu="Taranmış form (PDF)" />
          <${BelgeKutusu} baslik="Kantar fişleri" ekler=${f.kantarFisleri} degis=${s('kantarFisleri')} ipucu="Tartım fişleri; birden fazla seçilebilir (PDF ya da görsel)" />
          ${(yurtdisi || f.packingList.length > 0) && html`<${BelgeKutusu} baslik="Packing list" ekler=${f.packingList} degis=${s('packingList')} ipucu="Yurtdışı satış" />`}
        </div>

        <div class="s12">${fiyatAcik ? html`<div class="form-izgara st-fiyat">
            <${Alan} etiket="Birim fiyat (kg başına, isteğe bağlı)" sinif="s4"><input class="girdi sayi" inputmode="decimal" value=${f.birimFiyat} onInput=${(e) => s('birimFiyat')(e.target.value)} placeholder="Örn: 1,85" /><//>
            <${Alan} etiket="Para birimi" sinif="s4"><div class="secenekler">${S.PARA.map((p) => html`<button type="button" class=${'secenek' + (f.paraBirimi === p ? ' secili' : '')} onClick=${() => s('paraBirimi')(p)}>${p}</button>`)}</div><//>
            <${Alan} etiket="Tutar" sinif="s4"><div class="girdi sayi st-net">${sayi(f.birimFiyat) > 0 ? paraYaz(net * sayi(f.birimFiyat), f.paraBirimi) : '—'}</div><//>
          </div>` : html`<button type="button" class="d hayalet kucuk-d" onClick=${() => setFiyatAcik(true)}><${Ikon} ad="arti" boyut=${15} />Fiyat ekle (isteğe bağlı)</button>`}</div>

        <${Alan} etiket="Not"><textarea class="girdi" rows="2" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} placeholder="Örn: 3 IBC Batch #4 + 1 IBC karışım" /><//>
        <${Alan} etiket="Diğer ekler" ipucu="Yukarıdakilerin dışında kalan dosyalar (en fazla 8 MB)"><${Ekler} ekler=${f.ekler || []} degis=${s('ekler')} /><//>
        <${GecmisBolumu} kayit=${kayit} />
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const sevkAc = (s, on) => K.ac(SevkFormu, { kayit: s, on });
  const yeniSevk = (on) => K.ac(SevkFormu, { on });

  /* ---------------- Müşteri penceresi ---------------- */
  function MusteriPenceresi({ kayit, kapat }) {
    const d = depo();
    const [f, setF] = useState(() => ({ ad: '', ulke: 'Türkiye', adres: '', yetkili: '', unvan: '', telefon: '', eposta: '', notlar: '', ...(kayit || {}) }));
    const [denendi, setDenendi] = useState(false);
    const s = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
    const sevkler = kayit ? d.kayitlar('sevk').filter((x) => x.musteri === kayit.id).sort((a, x) => (S.sevkTarihi(a) < S.sevkTarihi(x) ? 1 : -1)) : [];
    const toplam = sevkler.filter(S.satildi).reduce((t, x) => t + S.sevkNet(x), 0);
    const ayni = f.ad.trim() && d.kayitlar('musteri').find((m) => m.id !== kayit?.id && S.adNormal(m.ad) === S.adNormal(f.ad));
    async function kaydet() {
      setDenendi(true);
      if (!f.ad.trim() || ayni) return;
      const v = { ad: f.ad.trim(), ulke: f.ulke, adres: f.adres.trim(), yetkili: f.yetkili.trim(), unvan: f.unvan.trim(), telefon: f.telefon.trim(), eposta: f.eposta.trim(), notlar: f.notlar };
      const ops = [{ c: 'musteri', k: kayit ? kayit.id : uid(), v }];
      // Firma adı değiştiyse bu müşterinin sevkiyatlarındaki ad da güncellenir (raporlar tek ad altında toplansın).
      if (kayit && v.ad !== kayit.ad) for (const x of sevkler) ops.push({ c: 'sevk', k: x.id, v: { firma: v.ad } });
      await d.kaydet(ops);
      bildir(kayit ? `${v.ad} güncellendi.` : `${v.ad} müşteri listesine eklendi.`);
      kapat();
    }
    const silFn = async () => {
      if (sevkler.length && !(await onayla(`${kayit.ad} müşterisinin ${sevkler.length} sevkiyatı var. Sevkiyatlar silinmez, yalnızca müşteri kartı çöp kutusuna gider.`, { baslik: 'Müşteri kartı silinsin mi?', evet: 'Devam' }))) return;
      if (await K.sil('musteri', kayit, kayit.ad)) kapat();
    };
    return html`<${Modal} genis baslik=${kayit ? kayit.ad : 'Yeni müşteri'} kapat=${kapat}
      alt=${html`<${K.FormAlt} kayit=${kayit} sil=${silFn} kapat=${kapat} kaydet=${kaydet}
        ek=${kayit && html`<button class="d" onClick=${() => { kapat(); yeniSevk({ firma: kayit.ad, musteri: kayit.id, ulke: kayit.ulke || 'Türkiye', adres: kayit.adres || '', yetkili: kayit.yetkili || '' }); }}><${Ikon} ad="sevk" />Bu müşteriye sevkiyat</button>`} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        ${kayit && html`<div class="s12 st-ozet-serit"><div><small>Toplam satış</small><b>${kg(toplam)}</b></div><div><small>Sevkiyat</small><b>${sevkler.filter(S.satildi).length}</b></div>
          <div><small>Son sevkiyat</small><b>${sevkler[0] ? tarihYaz(S.sevkTarihi(sevkler[0])) : '—'}</b></div></div>`}
        <${Alan} etiket="Firma adı" sinif="s8" hata=${denendi && (!f.ad.trim() ? 'Firma adını yazın' : ayni && 'Bu adla bir müşteri zaten var')}><input class="girdi" value=${f.ad} onInput=${s('ad')} autofocus=${!kayit} /><//>
        <${Alan} etiket="Ülke" sinif="s4"><input class="girdi" list="st-ulkeler2" value=${f.ulke} onInput=${s('ulke')} /><${Oneri} id="st-ulkeler2" liste=${K.ulkeler()} /><//>
        <${Alan} etiket="Adres"><input class="girdi" value=${f.adres} onInput=${s('adres')} /><//>
        <${Alan} etiket="Yetkili" sinif="s6"><input class="girdi" value=${f.yetkili} onInput=${s('yetkili')} /><//>
        <${Alan} etiket="Unvan" sinif="s6"><input class="girdi" value=${f.unvan} onInput=${s('unvan')} /><//>
        <${Alan} etiket="Telefon" sinif="s6"><input class="girdi" type="tel" value=${f.telefon} onInput=${s('telefon')} placeholder="+90 …" /><//>
        <${Alan} etiket="E-posta" sinif="s6"><input class="girdi" type="email" value=${f.eposta} onInput=${s('eposta')} /><//>
        <${Alan} etiket="Not"><textarea class="girdi" rows="2" value=${f.notlar} onInput=${s('notlar')} /><//>
        ${kayit && html`<div class="s12 form-bolum">Sevkiyatlar</div>
          <div class="s12">${sevkler.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>No</th><th>Tarih</th><th>Kalemler</th><th class="sag">Net</th><th>Durum</th></tr></thead><tbody>
            ${sevkler.map((x) => html`<tr class="tik" onClick=${() => sevkAc(x)}><td><span class="etiket-kod">${x.no}</span></td><td>${tarihYaz(S.sevkTarihi(x))}</td>
              <td>${(x.kalemler || []).map((k) => `${k.adet} ${k.ambalaj} ${k.urun} ${k.parti || ''}`).join(', ')}</td><td class="sag sayi">${kg(S.sevkNet(x))}</td><td><${DurumRozeti} s=${x} /></td></tr>`)}
          </tbody></table></div>` : html`<p class="soluk" style="margin:0">Henüz sevkiyat yok.</p>`}</div>`}
        <${GecmisBolumu} kayit=${kayit} />
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const musteriAc = (m) => K.ac(MusteriPenceresi, { kayit: m });

  /* ---------------- Parti penceresi ---------------- */
  function PartiPenceresi({ p, kapat }) {
    const d = depo();
    const [f, setF] = useState({ uretimTarihi: p.kayit?.uretimTarihi || '', notlar: p.kayit?.notlar || '' });
    const sevkler = p.sevkler.map((id) => d.kayit('sevk', id)).filter(Boolean).sort((a, x) => (S.sevkTarihi(a) < S.sevkTarihi(x) ? 1 : -1));
    async function kaydet() {
      await d.kaydet([{ c: 'parti', k: p.kayit ? p.kayit.id : uid(), v: { urun: p.urun, parti: p.parti, uretimTarihi: f.uretimTarihi, notlar: f.notlar } }]);
      bildir(`${p.urun} ${p.parti || 'partisiz'} güncellendi.`);
      kapat();
    }
    return html`<${Modal} genis baslik=${`${p.urun} · ${p.parti || 'Partisiz'}`} kapat=${kapat} alt=${html`<${K.FormAlt} kapat=${kapat} kaydet=${kaydet} />`}>
      <div class="modal-ic form-izgara">
        <div class="s12 st-ozet-serit"><div><small>Satılan</small><b>${kg(p.satilan)}</b></div><div><small>Sevkiyat</small><b>${p.sevkler.length}</b></div>
          <div><small>Hazırlanan (henüz yola çıkmadı)</small><b>${kg(p.rezerve)}</b></div></div>
        <${Alan} etiket="Üretim tarihi" sinif="s4" ipucu="İsteğe bağlı bilgi"><input class="girdi" type="date" value=${f.uretimTarihi} onInput=${(e) => setF({ ...f, uretimTarihi: e.target.value })} /><//>
        <${Alan} etiket="Not" sinif="s8"><input class="girdi" value=${f.notlar} onInput=${(e) => setF({ ...f, notlar: e.target.value })} placeholder="Örn: Batch #17 + #21 karışımı" /><//>
        <div class="s12 form-bolum">Bu partiden sevkiyatlar</div>
        <div class="s12">${sevkler.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>No</th><th>Tarih</th><th>Müşteri</th><th class="sag">Net</th></tr></thead><tbody>
          ${sevkler.map((x) => html`<tr class="tik" onClick=${() => sevkAc(x)}><td><span class="etiket-kod">${x.no}</span></td><td>${tarihYaz(S.sevkTarihi(x))}</td><td>${x.firma}</td>
            <td class="sag sayi">${kg((x.kalemler || []).filter((k) => k.urun === p.urun).flatMap(S.kalemPartileri).filter((y) => y.parti === p.parti).reduce((t, y) => t + y.net, 0))}</td></tr>`)}
        </tbody></table></div>` : html`<p class="soluk" style="margin:0">Bu partiden henüz sevkiyat yok.</p>`}</div>
        ${p.kayit && html`<${GecmisBolumu} kayit=${p.kayit} />`}
      </div>
    <//>`;
  }

  /* ---------------- Genel bakış (pano) ----------------
     Okumadan, bakarak anlaşılsın diye grafikler. Her sütuna, dilime, çubuğa ve özet kutusuna tıklanınca o verinin
     sevkiyat listesi açılır (oradan sevkiyata gidilir, Excel alınır). */
  const G = NT.grafik;
  const AY_TAM = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const kisa = (n) => (n >= 1000 ? `${ton(n)} t` : `${K.sayiYaz(n)} kg`);
  const toplamNet = (l) => l.reduce((t, x) => t + x.net, 0);

  function DetayPenceresi({ baslik, satirlar, ek, kapat }) {
    const toplam = toplamNet(satirlar);
    const sevkSay = new Set(satirlar.map((x) => x.s.id)).size;
    const musteriSay = new Set(satirlar.map((x) => x.s.firma)).size;
    const sirali = [...satirlar].sort((a, x) => (a.tarih < x.tarih ? 1 : a.tarih > x.tarih ? -1 : 0));
    return html`<${Modal} genis baslik=${baslik} kapat=${kapat} alt=${html`${ek && html`<div class="sol">${ek}</div>`}
        <button class="d" onClick=${() => K.excel(`${baslik.replace(/[^\wçğıöşüÇĞİÖŞÜ]+/g, '-')}.xlsx`, { sayfa: 'Satış', sutunlar: GEN, baslik: BASLIK, satirlar: excelSatirlari(satirlar) })}><${Ikon} ad="indir" boyut=${15} />Excel</button>
        <button class="d ana-d" onClick=${kapat}>Kapat</button>`}>
      <div class="modal-ic">
        <div class="st-ozet-serit" style="margin-bottom:14px"><div><small>Toplam net</small><b>${kg(toplam)}</b></div><div><small>Sevkiyat</small><b>${sevkSay}</b></div><div><small>Müşteri</small><b>${musteriSay}</b></div></div>
        ${sirali.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>Sevk tarihi</th><th>No</th><th>Müşteri</th><th>Ürün / parti</th><th>Ambalaj</th><th class="sag">Net</th></tr></thead><tbody>
          ${sirali.map((x, i) => html`<tr key=${i} class="tik" onClick=${() => sevkAc(x.s)}><td>${tarihYaz(x.tarih)}</td><td><span class="etiket-kod">${x.s.no}</span></td><td>${x.s.firma}</td>
            <td>${x.k.urun} <span class="parti">${S.partiYazi(x.k, true) || 'Partisiz'}</span></td><td>${x.k.adet} × ${x.k.ambalaj}</td><td class="sag sayi">${kg(x.net)}</td></tr>`)}
        </tbody></table></div>` : html`<p class="soluk" style="margin:0">Bu seçimde sevkiyat yok.</p>`}
      </div>
    <//>`;
  }
  const detay = (baslik, satirlar, ek) => K.ac(DetayPenceresi, { baslik, satirlar, ek });
  function ListePenceresi({ baslik, liste, kapat }) {
    return html`<${Modal} genis baslik=${baslik} kapat=${kapat} alt=${html`<button class="d ana-d" onClick=${kapat}>Kapat</button>`}>
      <div class="modal-ic">${liste.length ? html`<${KartIzgara} liste=${liste} />` : html`<p class="soluk" style="margin:0">Bu aşamada sevkiyat yok.</p>`}</div>
    <//>`;
  }

  /* Özet kutusu (tıklanır). iz: küçük eğilim çizgisi için değerler (örn. aylık). */
  function PanoKpi({ ad, deger, birim, alt, ikon, vurgu, tikla, iz }) {
    const en = iz ? Math.max(1, ...iz) : 1;
    const nokta = iz ? iz.map((v, i) => `${(i / Math.max(1, iz.length - 1)) * 100},${28 - (v / en) * 26}`).join(' ') : '';
    return html`<button type="button" class=${'kart kpi pano-kpi' + (vurgu ? ' vurgu' : '')} onClick=${tikla}>
      <div class="ad">${ikon && html`<${Ikon} ad=${ikon} boyut=${15} />`}${ad}<${Ikon} ad="ok" boyut=${14} sinif="pano-ok" /></div>
      <div class="deger">${deger}${birim && html`<small>${birim}</small>`}</div>${alt && html`<div class="alt">${alt}</div>`}
      ${iz && html`<svg class="pano-iz" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points=${nokta} fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" /></svg>`}
    </button>`;
  }

  function GenelBakis() {
    const d = depo();
    const bg = bugun();
    const buYil = bg.slice(0, 4);
    const [donem, setDonem] = useState(buYil);
    const tumSatilan = S.raporSatirlari(d, {});
    const yillar = [...new Set(tumSatilan.map((x) => x.tarih.slice(0, 4)).concat(buYil))].sort().reverse();
    const satirlar = donem ? tumSatilan.filter((x) => x.tarih.startsWith(donem)) : tumSatilan;
    const donemAdi = donem || 'Bütün yıllar';
    const toplam = toplamNet(satirlar);
    const sevkSay = new Set(satirlar.map((x) => x.s.id)).size;

    // Geçen yılın aynı dönemiyle karşılaştırma (bu yıl seçiliyse bugünün tarihine kadar).
    let fark = null;
    if (donem) {
      const onceki = String(+donem - 1);
      const sinir = donem === buYil ? onceki + bg.slice(4) : `${onceki}-12-31`;
      const o = toplamNet(tumSatilan.filter((x) => x.tarih.startsWith(onceki) && x.tarih <= sinir));
      if (o > 0) fark = Math.round(((toplam - o) / o) * 100);
    }
    // Müşteriler: bu dönemde alanlar; ilk kez bu dönemde alanlar "yeni".
    const ilkAlim = new Map();
    for (const x of tumSatilan) if (!ilkAlim.has(x.s.firma) || x.tarih < ilkAlim.get(x.s.firma)) ilkAlim.set(x.s.firma, x.tarih);
    const musteriler = [...new Set(satirlar.map((x) => x.s.firma))];
    const yeni = donem ? musteriler.filter((m) => (ilkAlim.get(m) || '').startsWith(donem)).length : 0;

    // Sütunlar: yıl seçiliyse 12 ay (yanında geçen yıl), "bütün yıllar"da yıl yıl.
    const sutunlar = donem
      ? AY_TAM.map((a, i) => {
        const ay = `${donem}-${String(i + 1).padStart(2, '0')}`, ayOnce = `${+donem - 1}-${String(i + 1).padStart(2, '0')}`;
        const deger = toplamNet(satirlar.filter((x) => x.tarih.startsWith(ay)));
        const onceki = toplamNet(tumSatilan.filter((x) => x.tarih.startsWith(ayOnce)));
        return { anahtar: ay, ad: AYLAR[i], deger, onceki, etiket: ton(deger), vurgu: ay === bg.slice(0, 7),
          ipucu: html`<b>${a} ${donem}</b>: ${kg(deger)}<br />${a} ${+donem - 1}: ${kg(onceki)}<br /><span style="opacity:.75">Tıklayın: sevkiyatlar</span>` };
      })
      : [...yillar].reverse().map((y) => {
        const deger = toplamNet(tumSatilan.filter((x) => x.tarih.startsWith(y)));
        return { anahtar: y, ad: y, deger, etiket: ton(deger), vurgu: y === buYil, ipucu: html`<b>${y}</b>: ${kg(deger)}` };
      });
    const sutunTikla = (k) => detay(`${k.length > 4 ? `${AY_TAM[+k.slice(5) - 1]} ${k.slice(0, 4)}` : k} · sevkiyatlar`, tumSatilan.filter((x) => x.tarih.startsWith(k)));
    // Ana kutudaki eğilim çizgisi: son 12 ay.
    const iz = S.aylik(d).map((x) => x.net);

    // Müşteriler: ilk 6, kalanı "Diğer".
    const musteriNet = musteriler.map((m) => { const l = satirlar.filter((x) => x.s.firma === m); return { m, net: toplamNet(l), n: new Set(l.map((x) => x.s.id)).size }; })
      .sort((a, x) => x.net - a.net);
    const ilk = musteriNet.slice(0, 6), diger = musteriNet.slice(6);
    const pay = (n) => (toplam ? Math.round((n / toplam) * 100) : 0);
    const musteriSatir = [...ilk.map((x) => ({ anahtar: x.m, ad: x.m, alt: `${x.n} sevkiyat · %${pay(x.net)}`, parcalar: [{ deger: x.net, renk: 'var(--gr-ana)' }], etiket: kisa(x.net),
      ipucu: html`<b>${x.m}</b><br />${kg(x.net)} · ${x.n} sevkiyat · %${pay(x.net)}` })),
    ...(diger.length ? [{ anahtar: '__diger', ad: `Diğer ${diger.length} müşteri`, parcalar: [{ deger: diger.reduce((t, x) => t + x.net, 0), renk: 'var(--gr-onceki)' }], etiket: kisa(diger.reduce((t, x) => t + x.net, 0)), ipucu: diger.map((x) => x.m).join(', ') }] : [])];
    const musteriTikla = (k) => {
      if (k === '__diger') return detay(`Diğer müşteriler · ${donemAdi}`, satirlar.filter((x) => diger.some((y) => y.m === x.s.firma)));
      const m = S.musteriBul(d, k);
      detay(`${k} · ${donemAdi}`, satirlar.filter((x) => x.s.firma === k), m && html`<button class="d" onClick=${() => musteriAc(m)}><${Ikon} ad="bina" boyut=${15} />Müşteri kartı</button>`);
    };

    // Ürünler: renk, ürünün sabit sırasından gelir (sıralamaya göre değişmez).
    const urunDilim = S.urunler(d).map((u, i) => {
      const n = toplamNet(satirlar.filter((x) => x.k.urun === u));
      return { anahtar: u, ad: u, deger: n, renk: G.RENKLER[i % 8], ipucu: html`<b>${u}</b>: ${kg(n)}` };
    }).filter((x) => x.deger > 0);

    // Ambalaj: çizimleriyle, adet ve kg.
    const ambalajlar = S.AMBALAJLAR.map((a) => { const l = satirlar.filter((x) => x.k.ambalaj === a.id); return { ...a, adet: l.reduce((t, x) => t + sayi(x.k.adet), 0), net: toplamNet(l) }; }).filter((a) => a.adet > 0);
    const enAdet = Math.max(1, ...ambalajlar.map((a) => a.adet));

    // Partiler: bu dönemde en çok satılanlar (karışımlar partilerine bölünür).
    const partiMap = new Map();
    for (const x of satirlar) for (const p of S.kalemPartileri(x.k)) {
      const k = `${x.k.urun}|${p.parti}`;
      const y = partiMap.get(k) || { anahtar: k, urun: x.k.urun, parti: p.parti, net: 0 };
      y.net += p.net * (x.net / (S.kalemNet(x.k) || 1));
      partiMap.set(k, y);
    }
    const partiSatir = [...partiMap.values()].sort((a, x) => x.net - a.net).slice(0, 6).map((p) => ({ anahtar: p.anahtar, ad: p.parti || 'Partisiz', alt: p.urun, parcalar: [{ deger: p.net, renk: 'var(--gr-ana)' }], etiket: kisa(p.net),
      ipucu: html`<b>${p.urun} · ${p.parti || 'Partisiz'}</b><br />${kg(p.net)} (${donemAdi})` }));
    const partiTikla = (k) => { const [u, pa] = k.split('|'); detay(`${u} · ${pa || 'Partisiz'} · ${donemAdi}`, satirlar.filter((x) => x.k.urun === u && S.kalemPartileri(x.k).some((p) => p.parti === pa))); };

    // Devam eden iş hattı: Sipariş → Hazırlanıyor → Yolda.
    const aktifler = d.kayitlar('sevk').filter(S.aktif);
    const hat = S.DURUMLAR.slice(0, 3).map((x) => { const l = aktifler.filter((s) => s.durum === x); return { durum: x, l, net: l.reduce((t, s) => t + S.sevkNet(s), 0) }; });
    const ikon = { Sipariş: 'saat', Hazırlanıyor: 'kutu', Yolda: 'sevk' };
    const sonlar = [...new Map([...tumSatilan].sort((a, x) => (a.tarih < x.tarih ? 1 : -1)).map((x) => [x.s.id, x])).values()].slice(0, 5);

    const saat = new Date().getHours();
    const adK = (b.kullanici || '').split(' ')[0];
    const bos = html`<p class="soluk" style="margin:0">Bu dönemde satış yok.</p>`;
    return html`
      <${K.Selam} bant baslik=${`${saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar'}${adK ? ', ' + adK : ''}.`}
        sag=${html`<button class="d ana-d tz-buyuk" onClick=${() => yeniSevk()}><${Ikon} ad="arti" />Yeni sevkiyat</button>`}>
        Grafiklerin üzerine gelin ya da tıklayın: ilgili sevkiyatlar açılır.
      <//>
      <${K.Cipler} secenekler=${[...yillar.map((y) => [y, y]), ['', 'Bütün yıllar']]} deger=${donem} degis=${setDonem} />
      <div class="kpi-sira">
        <${PanoKpi} vurgu ikon="sevk" ad=${`Sevk edilen · ${donemAdi}`} deger=${ton(toplam)} birim="ton" iz=${iz}
          alt=${fark == null ? kg(toplam) : `${fark >= 0 ? '▲' : '▼'} %${Math.abs(fark)} geçen yılın aynı dönemine göre`} tikla=${() => detay(`Sevk edilen · ${donemAdi}`, satirlar)} />
        <${PanoKpi} ikon="rapor" ad="Sevkiyat" deger=${sevkSay} alt=${sevkSay ? `ortalama ${kisa(toplam / sevkSay)}` : '—'} tikla=${() => detay(`Sevkiyatlar · ${donemAdi}`, satirlar)} />
        <${PanoKpi} ikon="bina" ad="Müşteri" deger=${musteriler.length} alt=${donem ? (yeni ? `${yeni} yeni müşteri` : 'yeni müşteri yok') : `${d.kayitlar('musteri').length} kayıtlı`} tikla=${() => { location.hash = '#/musteriler'; }} />
        <${PanoKpi} ikon="saat" ad="Devam eden" deger=${aktifler.length} alt=${aktifler.length ? hat.filter((x) => x.l.length).map((x) => `${x.l.length} ${x.durum.toLocaleLowerCase('tr')}`).join(' · ') : 'Bekleyen iş yok'} tikla=${() => { location.hash = '#/sevkiyatlar'; }} />
      </div>
      <div class="pano-izgara">
        <${K.Kart} sinif="p7" baslik=${donem ? `Aylık sevkiyat` : 'Yıllık sevkiyat'} sag=${html`<span class="soluk kucuk">ton</span>`}>
          <${G.Sutunlar} veri=${sutunlar} seriler=${donem ? [donem, String(+donem - 1)] : null} tikla=${sutunTikla} olcekYaz=${(n) => ton(n)} yukseklik=${230} />
        <//>
        <${K.Kart} sinif="p5" baslik="Kime sattık?" sag=${html`<a href="#/musteriler" style="color:var(--ana)">Tümü →</a>`}>
          ${musteriSatir.length ? html`<${G.YatayCubuklar} satirlar=${musteriSatir} tikla=${musteriTikla} />` : bos}
        <//>
        <${K.Kart} sinif="p4" baslik="Ürünler">
          ${urunDilim.length ? html`<${G.Halka} dilimler=${urunDilim} merkez=${ton(toplam)} merkezAlt="ton" degerYaz=${kisa} boyut=${150} tikla=${(u) => detay(`${u} · ${donemAdi}`, satirlar.filter((x) => x.k.urun === u))} />` : bos}
        <//>
        <${K.Kart} sinif="p4" baslik="Ambalaj">
          ${ambalajlar.length ? html`<div class="pano-amb-izgara">${ambalajlar.map((a) => html`<button type="button" class="pano-amb-kutu" title=${`${a.adet} ${a.ad} · ${kg(a.net)}`}
              onClick=${() => detay(`${a.ad} · ${donemAdi}`, satirlar.filter((x) => x.k.ambalaj === a.id))}>
            <span class="cizim"><${AmbalajCizimi} tur=${a.id} boyut=${0.9 + 0.7 * (a.adet / enAdet)} /></span>
            <b>${a.adet}</b><span>${a.id === 'Dökme' ? 'Dökme' : a.ad}</span><small>${kisa(a.net)}</small></button>`)}</div>` : bos}
        <//>
        <${K.Kart} sinif="p4" baslik="Öne çıkan partiler" sag=${html`<a href="#/partiler" style="color:var(--ana)">Partiler →</a>`}>
          ${partiSatir.length ? html`<${G.YatayCubuklar} satirlar=${partiSatir} tikla=${partiTikla} />` : bos}
        <//>
        <${K.Kart} sinif="p7" baslik="Devam eden sevkiyatlar" sag=${html`<a href="#/sevkiyatlar" style="color:var(--ana)">Tümü →</a>`}>
          <div class="pano-hat">${hat.map((x, i) => html`${i > 0 && html`<span class="pano-hat-ok"><${Ikon} ad="ok" boyut=${18} /></span>`}
            <button type="button" class=${'pano-hat-adim' + (x.l.length ? ' dolu' : '')} onClick=${() => K.ac(ListePenceresi, { baslik: `${x.durum} · ${x.l.length} sevkiyat`, liste: x.l })}>
              <${Ikon} ad=${ikon[x.durum]} boyut=${20} /><b>${x.l.length}</b><span>${x.durum}</span><small>${x.net ? kisa(x.net) : '—'}</small></button>`)}</div>
          ${aktifler.length > 0 && html`<ul class="tz-akis" style="margin-top:12px">${[...aktifler].sort((a, x) => S.DURUMLAR.indexOf(x.durum) - S.DURUMLAR.indexOf(a.durum)).slice(0, 3).map((s) => html`<li onClick=${() => sevkAc(s)}>
            <span class="ik sevk"><${Ikon} ad=${ikon[s.durum]} /></span><span class="ne"><b>${s.firma}</b><small>${s.no} · ${s.durum}${s.durum === 'Yolda' && S.eksikler(s).length ? ` · ${S.eksikler(s).length} eksik belge` : ''}</small></span>
            <span class="miktar">${kisa(S.sevkNet(s))}</span></li>`)}</ul>`}
        <//>
        <${K.Kart} sinif="p5" baslik="Son sevkiyatlar">
          ${sonlar.length ? html`<ul class="tz-akis">${sonlar.map((x) => html`<li onClick=${() => sevkAc(x.s)}>
            <span class="ik sevk"><${Ikon} ad="sevk" /></span><span class="ne"><b>${x.s.firma}</b><small>${x.s.no} · ${tarihYaz(x.tarih)}</small></span>
            <span class="miktar">${kisa(S.sevkNet(x.s))}</span></li>`)}</ul>` : html`<p class="soluk" style="margin:0">Henüz sevkiyat yok.</p>`}
        <//>
      </div>`;
  }

  /* ---------------- Sevkiyatlar ---------------- */
  function Sevkiyatlar() {
    const d = depo();
    const [f, setF] = useState('aktif');
    const [q, setQ] = useState('');
    const tum = d.kayitlar('sevk').filter((s) => ara(`${s.no} ${s.firma} ${s.ulke} ${s.coaNo} ${s.irsaliyeNo} ${s.konteyner} ${s.plaka} ${s.sofor} ${(s.kalemler || []).map((k) => `${k.urun} ${k.parti} ${k.ambalaj}`).join(' ')}`, q));
    const g = { aktif: tum.filter(S.aktif), teslim: tum.filter((s) => !s.iptal && s.durum === 'Teslim edildi'), iptal: tum.filter((s) => s.iptal), hepsi: tum };
    const liste = [...g[f]].sort((a, x) => (f === 'aktif' ? (a.siparisTarihi < x.siparisTarihi ? -1 : 1) : S.sevkTarihi(a) < S.sevkTarihi(x) ? 1 : -1));
    return html`<${K.Selam} baslik="Sevkiyatlar" sag=${html`<button class="d" onClick=${() => excelSevk(liste)}><${Ikon} ad="indir" boyut=${15} />Excel</button>
        <button class="d ana-d tz-buyuk" onClick=${() => yeniSevk()}><${Ikon} ad="arti" />Yeni sevkiyat</button>`}>
        Her kartta bir sonraki aşamaya tek dokunuşla geçin. Satış, “Yolda” olduğu andan itibaren rapora girer.<//>
      <${K.Cipler} secenekler=${[['aktif', 'Devam eden', g.aktif.length], ['teslim', 'Teslim edildi', g.teslim.length], ['iptal', 'İptal', g.iptal.length], ['hepsi', 'Tümü', g.hepsi.length]]} deger=${f} degis=${setF}>
        <input class="girdi" style="max-width:320px;margin-left:8px;border-radius:99px" placeholder="Firma, parti, plaka, şoför…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      <//>
      ${liste.length ? html`<${KartIzgara} liste=${liste} />` : html`<div class="tz-kart"><p class="soluk" style="margin:0">Bu süzgeçte sevkiyat yok.</p></div>`}`;
  }

  /* ---------------- Müşteriler ---------------- */
  function Musteriler() {
    const d = depo();
    const [q, setQ] = useState('');
    const bilgi = new Map();
    for (const s of d.kayitlar('sevk')) {
      if (!S.satildi(s) || !s.musteri) continue;
      const x = bilgi.get(s.musteri) || { net: 0, n: 0, son: '' };
      x.net += S.sevkNet(s); x.n++; if (S.sevkTarihi(s) > x.son) x.son = S.sevkTarihi(s);
      bilgi.set(s.musteri, x);
    }
    const liste = d.kayitlar('musteri').filter((m) => ara(`${m.ad} ${m.ulke} ${m.yetkili} ${m.adres}`, q))
      .sort((a, x) => (bilgi.get(x.id)?.son || '').localeCompare(bilgi.get(a.id)?.son || '') || trSirala(a.ad, x.ad));
    return html`<${K.Selam} baslik="Müşteriler" sag=${html`<button class="d ana-d tz-buyuk" onClick=${() => K.ac(MusteriPenceresi, {})}><${Ikon} ad="arti" />Yeni müşteri</button>`}>
        Sevkiyatta yeni yazılan her firma buraya kendiliğinden eklenir. Karta tıklayıp iletişim bilgilerini ve geçmiş sevkiyatları görün.<//>
      <div class="tz-cipler"><input class="girdi" style="max-width:360px;border-radius:99px" placeholder="Firma, ülke, yetkili…" value=${q} onInput=${(e) => setQ(e.target.value)} /><span class="soluk kucuk">${liste.length} müşteri</span></div>
      ${liste.length ? html`<div class="st-musteriler">${liste.map((m) => { const x = bilgi.get(m.id); return html`<button class="st-musteri" onClick=${() => musteriAc(m)}>
          <span class="ad">${m.ad}</span><span class="soluk kucuk">${[m.ulke, m.yetkili].filter(Boolean).join(' · ') || '—'}</span>
          <span class="alt">${x ? html`<b>${ton(x.net)} ton</b> · ${x.n} sevkiyat · son ${tarihYaz(x.son)}` : html`<span class="soluk">Henüz sevkiyat yok</span>`}</span></button>`; })}</div>`
        : html`<${BosDurum} ikon="bina" baslik="Müşteri bulunamadı" />`}`;
  }

  /* ---------------- Partiler: her parti bir kart (yalnızca sevkiyatlardan; stok tutulmaz) ---------------- */
  function Partiler() {
    const d = depo();
    const [q, setQ] = useState('');
    const liste = S.partiler(d).filter((p) => ara(`${p.urun} ${p.parti} ${p.musteriler.join(' ')}`, q));
    const urunler = [...new Set(liste.map((p) => p.urun))];
    return html`<${K.Selam} baslik="Partiler">Her partiden ne kadar satıldığı ve kimlere gittiği. Partiler sevkiyatlardan derlenir; sevkiyatı olmayan parti görünmez.<//>
      <div class="tz-cipler"><input class="girdi" style="max-width:360px;border-radius:99px" placeholder="Ürün, parti, müşteri…" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
      ${urunler.length ? urunler.map((u) => { const l = liste.filter((p) => p.urun === u); const en = Math.max(1, ...l.map((p) => p.satilan + p.rezerve)); return html`
        <h2 class="st-parti-baslik">${u} <span class="soluk">· ${l.length} parti · ${kg(l.reduce((t, p) => t + p.satilan, 0))}</span></h2>
        <div class="st-parti-izgara">${l.map((p) => html`<button type="button" class="st-parti-kart" onClick=${() => K.ac(PartiPenceresi, { p })}>
          <span class="bas"><span class="parti">${p.parti || 'Partisiz'}</span>${p.uretimTarihi && html`<span class="soluk kucuk">üretim ${tarihYaz(p.uretimTarihi)}</span>`}</span>
          <span class="miktar">${ton(p.satilan)}<small> ton satıldı</small></span>
          <span class="iz"><i style=${{ width: (p.satilan / en) * 100 + '%' }} />${p.rezerve > 0 && html`<i class="hazir" style=${{ width: (p.rezerve / en) * 100 + '%' }} />`}</span>
          <span class="soluk kucuk">${p.sevkler.length} sevkiyat${p.son ? ` · son ${tarihYaz(p.son)}` : ''}${p.rezerve > 0 ? ` · ${kg(p.rezerve)} hazırlıkta` : ''}</span>
          ${p.musteriler.length > 0 && html`<span class="musteriler">${p.musteriler.map((m) => html`<span>${m}</span>`)}</span>`}
        </button>`)}</div>`; }) : html`<${BosDurum} ikon="kutu" baslik="Parti yok" aciklama="Sevkiyatlarda girilen partiler burada listelenir." />`}`;
  }

  /* ---------------- Rapor ---------------- */
  function Rapor() {
    const d = depo();
    const bg = bugun();
    const yillar = [...new Set(d.kayitlar('sevk').filter(S.satildi).map((s) => S.sevkTarihi(s).slice(0, 4)).concat(bg.slice(0, 4)))].sort().reverse();
    const [f, setF] = useState({ yil: bg.slice(0, 4), ay: '', musteri: '', urun: '' });
    const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
    const satirlar = S.raporSatirlari(d, f);
    const toplam = satirlar.reduce((t, x) => t + x.net, 0);
    const tutarlar = {};
    for (const x of satirlar) if (x.tutar) tutarlar[x.para || '₺'] = (tutarlar[x.para || '₺'] || 0) + x.tutar;
    const sevkSay = new Set(satirlar.map((x) => x.s.id)).size;
    const grup = (fn) => { const m = new Map(); for (const x of satirlar) m.set(fn(x), (m.get(fn(x)) || 0) + x.net); return [...m.entries()].sort((a, b2) => b2[1] - a[1]); };
    const musteriler = [...new Set(d.kayitlar('sevk').map((x) => x.firma))].sort(trSirala);
    return html`<${K.Selam} baslik="Satış raporu" sag=${html`<button class="d ana-d" onClick=${() => excelRapor(satirlar, f)}><${Ikon} ad="indir" boyut=${15} />Excel’e aktar</button>`}>
        Yola çıkmış ve teslim edilmiş sevkiyatlar, sevk tarihine göre.<//>
      <div class="tz-cipler">
        <select class="girdi kisa" value=${f.yil} onChange=${s('yil')}><option value="">Tüm yıllar</option>${yillar.map((y) => html`<option value=${y}>${y}</option>`)}</select>
        <select class="girdi kisa" value=${f.ay} onChange=${s('ay')}><option value="">Tüm aylar</option>${AYLAR.map((a, i) => html`<option value=${i + 1}>${['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][i]}</option>`)}</select>
        <select class="girdi kisa" value=${f.musteri} onChange=${s('musteri')}><option value="">Tüm müşteriler</option>${musteriler.map((m) => html`<option value=${m}>${m}</option>`)}</select>
        <select class="girdi kisa" value=${f.urun} onChange=${s('urun')}><option value="">Tüm ürünler</option>${S.urunler(d).map((u) => html`<option value=${u}>${u}</option>`)}</select>
      </div>
      <div class="kpi-sira">
        <${K.Kpi} vurgu ad="Toplam net" deger=${ton(toplam)} birim="ton" alt=${kg(toplam)} />
        <${K.Kpi} ad="Sevkiyat" deger=${sevkSay} alt=${`${satirlar.length} kalem`} />
        <${K.Kpi} ad="Müşteri" deger=${new Set(satirlar.map((x) => x.s.firma)).size} />
        <${K.Kpi} ad="Tutar (fiyat girilenler)" deger=${Object.keys(tutarlar).length ? Object.entries(tutarlar).map(([p, t]) => paraYaz(t, p)).join(' + ') : '—'} />
      </div>
      <div class="tz-izgara">
        <${K.Kart} baslik="Sevkiyat kalemleri">
          ${satirlar.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>Tarih</th><th>No</th><th>Müşteri</th><th>Ürün / parti</th><th>Ambalaj</th><th class="sag">Net</th><th class="sag">Tutar</th></tr></thead><tbody>
            ${satirlar.map((x) => html`<tr class="tik" onClick=${() => sevkAc(x.s)}><td>${tarihYaz(x.tarih)}</td><td><span class="etiket-kod">${x.s.no}</span></td><td>${x.s.firma}${x.s.ulke && x.s.ulke !== 'Türkiye' ? html`<div class="soluk kucuk">${x.s.ulke}</div>` : ''}</td>
              <td>${x.k.urun} <span class="parti">${S.partiYazi(x.k, true) || 'Partisiz'}</span></td><td>${x.k.adet} × ${x.k.ambalaj}</td><td class="sag sayi">${kg(x.net)}</td><td class="sag sayi">${x.tutar ? paraYaz(x.tutar, x.para) : html`<span class="soluk">—</span>`}</td></tr>`)}
            <tr><td colspan="5"><b>Toplam</b></td><td class="sag sayi"><b>${kg(toplam)}</b></td><td></td></tr>
          </tbody></table></div>` : html`<p class="soluk" style="margin:0">Bu süzgeçte satış yok.</p>`}
        <//>
        <div class="tz-sutun">
          <${K.Kart} baslik="Müşteriye göre">${grup((x) => x.s.firma).map(([a, n]) => html`<div class="st-grup"><span>${a}</span><b>${kg(n)}</b></div>`)}<//>
          <${K.Kart} baslik="Ürün ve partiye göre">${(() => { const m = new Map(); for (const x of satirlar) for (const p of S.kalemPartileri(x.k)) { const a = `${x.k.urun} · ${p.parti || 'Partisiz'}`; m.set(a, (m.get(a) || 0) + p.net); } return [...m.entries()].sort((a, b2) => b2[1] - a[1]); })().map(([a, n]) => html`<div class="st-grup"><span>${a}</span><b>${kg(n)}</b></div>`)}<//>
          <${K.Kart} baslik="Ambalaja göre">${grup((x) => x.k.ambalaj).map(([a, n]) => html`<div class="st-grup"><span style="display:flex;align-items:center;gap:8px"><${AmbalajCizimi} tur=${a} boyut=${0.55} />${a}</span><b>${kg(n)}</b></div>`)}<//>
        </div>
      </div>`;
  }

  /* ---------------- Excel ---------------- */
  const metin = (v, hiza) => ({ v: v ?? '', tur: 'metin', hiza });
  const tarihH = (v) => (v ? { v, tur: 'tarih' } : metin(''));
  const sayiH = (v) => ({ v: Number(v) || 0, tur: 'sayi' });
  // Belge sütunları: yüklendiyse "Var", eski kayıtta yalnızca numara varsa o numara, yurtdışı olmayan satışta packing list "—".
  const belgeH = (s, b) => metin((s[b.alan] || []).length ? 'Var' : b.eski && s[b.eski] ? s[b.eski] : b.yurtdisi && !S.yurtdisi(s) ? '—' : 'Yok');
  // CoA kalemin kendisinde; eski kayıtta sevkiyat geneline girilmiş no/belge bütün kalemler için geçerli.
  const coaH = (s, k) => metin((k.coaBelge || []).length ? 'Var' : s.coaNo ? s.coaNo : (s.coaBelge || []).length ? 'Var' : 'Yok');
  function excelSatirlari(satirlar) {
    return satirlar.map((x) => ({ hucreler: [tarihH(x.tarih), metin(x.s.no), metin(x.s.firma, 'sol'), metin(x.s.ulke), metin(x.k.urun), metin(S.partiYazi(x.k, true)), metin(x.k.ambalaj), sayiH(x.k.adet),
      sayiH(x.k.brut), sayiH(x.k.dara), sayiH(x.net), metin(x.s.plaka), metin(x.s.sofor), metin(x.s.konteyner), coaH(x.s, x.k), ...S.BELGELER.map((b) => belgeH(x.s, b)),
      x.tutar ? { v: x.tutar, tur: 'ondalik' } : metin(''), metin(x.tutar ? x.para : ''), metin(x.s.durum)] }));
  }
  const BASLIK = ['Sevk tarihi', 'Sevkiyat no', 'Müşteri', 'Ülke', 'Ürün', 'Parti', 'Ambalaj', 'Adet', 'Brüt kg', 'Dara kg', 'Net kg', 'Plaka', 'Şoför', 'Konteyner / isotank',
    'CoA', 'İrsaliye', 'Fatura', 'Kontrol formu', 'Kantar fişi', 'Packing list', 'Tutar', 'Para', 'Durum'];
  const GEN = [12, 14, 34, 12, 14, 26, 10, 7, 10, 9, 10, 12, 18, 15, 14, 13, 13, 12, 12, 12, 12, 6, 13].map((genislik) => ({ genislik }));
  function excelRapor(satirlar, f) {
    K.excel(`satis-raporu-${f.yil || 'tum'}${f.ay ? '-' + String(f.ay).padStart(2, '0') : ''}.xlsx`, { sayfa: 'Satış', sutunlar: GEN, baslik: BASLIK, satirlar: excelSatirlari(satirlar) });
  }
  function excelSevk(liste) {
    const satirlar = liste.flatMap((s) => (s.kalemler || []).map((k) => ({ s, k, tarih: S.sevkTarihi(s), net: S.kalemNet(k), tutar: sayi(s.birimFiyat) > 0 ? S.kalemNet(k) * sayi(s.birimFiyat) : 0, para: s.paraBirimi })));
    K.excel(`sevkiyatlar-${bugun()}.xlsx`, { sayfa: 'Sevkiyatlar', sutunlar: GEN, baslik: BASLIK, satirlar: excelSatirlari(satirlar).map((r, i) => ({ ...r, cizili: !!satirlar[i].s.iptal })) });
  }

  /* ---------------- Ayarlar ---------------- */
  function Ayarlar() {
    return html`<${K.AyarlarSayfasi} cop=${{
      sevk: { ad: 'Sevkiyat', ozet: (r) => `${r.firma} · ${kg(S.sevkNet(r))}` },
      musteri: { ad: 'Müşteri', ozet: (r) => r.ad },
      parti: { ad: 'Parti bilgisi', ozet: (r) => `${r.urun} ${r.parti}` },
    }} />`;
  }

  /* ---------------- Arama ---------------- */
  function arama(d, q) {
    const l = [];
    for (const m of d.kayitlar('musteri')) if (ara(`${m.ad} ${m.yetkili} ${m.ulke}`, q)) l.push({ tur: 'Müşteri', ad: m.ad, ek: m.ulke || '', fn: () => musteriAc(m) });
    for (const s of d.kayitlar('sevk')) {
      if (ara(`${s.no} ${s.firma} ${s.coaNo} ${s.irsaliyeNo} ${s.konteyner} ${s.faturaNo} ${s.plaka} ${s.sofor} ${(s.kalemler || []).map((k) => `${k.urun} ${k.parti}`).join(' ')}`, q)) {
        l.push({ tur: 'Sevkiyat', ad: `${s.no} · ${s.firma}`, ek: `${tarihYaz(S.sevkTarihi(s))} · ${kg(S.sevkNet(s))}`, fn: () => sevkAc(s) });
      }
    }
    return l;
  }

  NT.satisUI = { AmbalajCizimi, SevkFormu, MusteriPenceresi };
  K.calistir({
    sekmeler: [
      { id: 'genel', ad: 'Genel Bakış', ikon: 'ozet' },
      { id: 'sevkiyatlar', ad: 'Sevkiyatlar', ikon: 'sevk', sayac: (d) => d.kayitlar('sevk').filter(S.aktif).length },
      { id: 'musteriler', ad: 'Müşteriler', ikon: 'bina' },
      { id: 'partiler', ad: 'Partiler', ikon: 'kutu' },
      { id: 'rapor', ad: 'Rapor', ikon: 'rapor' },
      { id: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
    ],
    sayfalar: { genel: GenelBakis, sevkiyatlar: Sevkiyatlar, musteriler: Musteriler, partiler: Partiler, rapor: Rapor, ayarlar: Ayarlar },
    eylemler: [
      { ad: 'Yeni sevkiyat', alt: 'Sipariş / sevkiyat kaydı', ikon: 'sevk', tus: 'S', fn: () => yeniSevk() },
      { ad: 'Yeni müşteri', alt: 'Müşteri kartı', ikon: 'bina', tus: 'M', fn: () => K.ac(MusteriPenceresi, {}) },
    ],
    arama,
    uzakKoleksiyonlar: ['sevk', 'musteri', 'parti'],
  });
})();
