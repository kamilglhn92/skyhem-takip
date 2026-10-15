/*
 * Karşılama ekranı: bütün sistemlerin düğmeleri ve her birinin kısa durumu.
 * Burada kayıt yazılmaz; her modülün tablosu yalnızca özet için okunur. Modüller bağımsızdır, burada sadece yan yana durur.
 */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, render, useState, useEffect } = window.htmPreact;
  const { Ikon, Avatar, GlobalKatman } = NT.ui;
  const K = NT.kabuk;
  const b = NT.baglanti;
  const { bugun } = NT.c;
  const demo = new URLSearchParams(location.search).has('demo');

  /* Numune özeti numune/hesap.js'in kurallarıyla hesaplanır (numune koduna dokunmadan). */
  function numuneOzet(d) {
    const H = NT.hesap;
    const st = H.stok(d);
    const dolu = [...st.dolu.values()].reduce((t, x) => t + Math.max(0, x.mevcut), 0);
    const yolda = d.kayitlar('sevk').filter((s) => s.durum !== 'Gönderildi' && H.sevkEtkili(s)).length;
    return [`Rafta ${dolu} dolu numune`, yolda ? `${yolda} gönderi hazırlanıyor` : 'Bekleyen gönderi yok'];
  }
  function numuneDikkat(d) {
    const n = d.kayitlar('sevk').filter((s) => s.durum === 'Etiket Bekliyor' && NT.hesap.sevkEtkili(s)).length;
    return n ? [{ metin: `${n} gönderi etiket bekliyor`, sekme: 'gonderiler' }] : [];
  }

  /* dikkat(d): karşılama ekranındaki "dikkat bekleyenler" şeridi için [{ metin, sekme }] (her modülün hesap.js'inde). */
  const MODULLER = [
    { id: 'numune', ad: 'Numune Takip', aciklama: 'Numune şişeleri: dolum, müşteriye gönderi, raf sayımı', ikon: 'dolum', hazir: true, ozet: numuneOzet, dikkat: numuneDikkat },
    { id: 'satis', ad: 'Satış Takip', aciklama: 'Sevkiyatlar, müşteriler, partiler ve satış raporu', ikon: 'sevk', hazir: true, ozet: (d) => NT.satis.ozet(d), dikkat: (d) => NT.satis.dikkat(d) },
    { id: 'su', ad: 'İçme Suyu', aciklama: 'Damacana ve bardak su siparişi, teslimat, fatura kontrolü', ikon: 'damacana', hazir: true, ozet: (d) => NT.su.ozet(d), dikkat: (d) => NT.su.dikkat(d) },
    { id: 'yemek', ad: 'Yemek', aciklama: 'Günlük öğün sayısı, Desbaş menüsü ve ay sonu fatura kontrolü', ikon: 'yemek', hazir: true, ozet: (d) => NT.yemek.ozet(d), dikkat: (d) => NT.yemek.dikkat(d) },
    { id: 'yoklama', ad: 'Yoklama', aciklama: 'Raporlu, izinli günler ve fazla mesai; İK için aylık çizelge', ikon: 'takvim', hazir: true, ozet: (d) => NT.yoklama.ozet(d), dikkat: (d) => NT.yoklama.dikkat(d) },
  ];

  /* Sunum modunda şerit nasıl göründüğü anlaşılsın diye örnek uyarılar (gerçek veri değildir). */
  function demoDikkat() {
    const gecen = new Date(); gecen.setDate(1); gecen.setMonth(gecen.getMonth() - 1);
    const ay = gecen.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }).replace(/^./, (h) => h.toLocaleUpperCase('tr'));
    return { satis: [{ metin: '1 sevkiyatta eksik belge', sekme: 'sevkiyatlar' }], su: [{ metin: '2 ayın su faturası girilmedi', sekme: 'faturalar' }],
      yemek: [{ metin: `${ay} yemek faturası girilmedi`, sekme: 'faturalar' }] };
  }

  /* Bayramlarda ve millî günlerde selam değişir (tatil listesi ortak/tatiller.js'ten). */
  const MILLI = {
    '04-23': 'Ulusal Egemenlik ve Çocuk Bayramımız kutlu olsun', '05-01': 'Emek ve Dayanışma Günü kutlu olsun',
    '05-19': 'Atatürk’ü Anma, Gençlik ve Spor Bayramımız kutlu olsun', '07-15': '15 Temmuz Demokrasi ve Millî Birlik Günü',
    '08-30': 'Zafer Bayramımız kutlu olsun', '10-29': 'Cumhuriyet Bayramımız kutlu olsun', '11-10': '10 Kasım · Atatürk’ü saygı ve özlemle anıyoruz',
  };
  function ozelGun(t) {
    const T = NT.tatil;
    const ad = T.tatil(t) || '';
    const arife = T.yarimGun(t);
    const dini = (ad.match(/(Ramazan|Kurban) Bayramı \d+\. gün/) || [])[0];
    if (dini) return { selam: 'İyi bayramlar', not: dini };
    if (t.slice(5) === '01-01') return { selam: 'Mutlu yıllar', not: 'Yeni yılınız kutlu olsun' };
    if (MILLI[t.slice(5)]) return { not: MILLI[t.slice(5)] };
    if (arife) return { not: /Ramazan|Kurban/.test(arife) ? `${arife} · Şimdiden iyi bayramlar` : arife };
    return null;
  }

  /* Uyarı hesabı bozulursa kartın özeti yine görünsün. */
  function dikkatAl(m, d) {
    try { return m.dikkat ? m.dikkat(d) : []; } catch (e) { console.warn(m.id, 'dikkat', e); return []; }
  }

  /* Her hazır modülün deposunu salt okunur açar; önce bu bilgisayardaki son kopyayla, sonra buluttan güncel özet. */
  function useOzetler() {
    const [ozet, setOzet] = useState({});
    useEffect(() => {
      if (demo || !b.kod) return undefined;
      let bitti = false;
      const yaz = (id, v) => !bitti && setOzet((o) => ({ ...o, [id]: v }));
      for (const m of MODULLER.filter((x) => x.hazir && x.ozet)) {
        (async () => {
          const d = b.depoOlustur(m.id, b.kod, b.kullanici);
          try {
            const kayitli = await d.onbellek.al().catch(() => null);
            if (kayitli && kayitli.olaylar) { for (const e of kayitli.olaylar) d.ekle(e); d.sonSira = kayitli.sonSira || 0; d.yenidenHesapla(); yaz(m.id, { satirlar: m.ozet(d), dikkat: dikkatAl(m, d), eski: true }); }
            d.cevrimici = true;
            await d.tara();
            yaz(m.id, d.hata && !d.olaylar.size ? { hata: d.hata } : { satirlar: m.ozet(d), dikkat: dikkatAl(m, d), eski: !!d.hata });
          } catch (e) { yaz(m.id, { hata: e.message }); }
        })();
      }
      return () => { bitti = true; };
    }, [b.kod]);
    return ozet;
  }

  /* Banttaki saat: dakikada bir yenilenir (selam da saate göre değiştiği için onu da tazeler). */
  function useSimdi() {
    const [simdi, setSimdi] = useState(() => new Date());
    useEffect(() => { const t = setInterval(() => setSimdi(new Date()), 15000); return () => clearInterval(t); }, []);
    return simdi;
  }

  /* Bantın arka planındaki süs: yumuşak dalgalar ve yaprak çizgileri (yalnızca görünüm). */
  const BANT_SUS = html`<svg class="pt-bant-sus" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path d="M0 250 C 260 190 520 300 780 240 S 1240 170 1440 220 L1440 320 L0 320 Z" fill="currentColor" opacity=".07" />
    <path d="M0 285 C 320 240 640 320 960 270 S 1300 250 1440 265 L1440 320 L0 320 Z" fill="currentColor" opacity=".06" />
    <g fill="none" stroke="currentColor" stroke-width="1.4" opacity=".16">
      <path d="M1180 40 C 1270 40 1330 100 1330 190 C 1240 190 1180 130 1180 40 Z" />
      <path d="M1180 40 L1330 190" />
      <path d="M1300 -10 C 1370 -10 1420 40 1420 110 C 1350 110 1300 60 1300 -10 Z" />
      <path d="M1300 -10 L1420 110" />
    </g>
    <g fill="currentColor" opacity=".12"><circle cx="1090" cy="70" r="5" /><circle cx="1130" cy="150" r="3" /><circle cx="1040" cy="190" r="4" /><circle cx="1400" cy="200" r="3" /></g>
  </svg>`;

  /* Bandın altındaki şerit: bütün sistemlerde dikkat bekleyen işler; tıklanınca ilgili sistemin ilgili sayfası açılır. */
  function DikkatSeridi({ ozet }) {
    const listeler = demo ? demoDikkat() : Object.fromEntries(MODULLER.map((m) => [m.id, (ozet[m.id] && ozet[m.id].dikkat) || []]));
    const isler = MODULLER.flatMap((m) => (listeler[m.id] || []).map((x) => ({ ...x, m })));
    const hepsiGeldi = demo || MODULLER.every((m) => ozet[m.id] && !ozet[m.id].hata);
    if (!isler.length && !hepsiGeldi) return null;
    return html`<div class="pt-dikkat" role="status">
      ${isler.length ? html`<span class="pt-dikkat-bas"><${Ikon} ad="uyari" boyut=${15} />Dikkat bekleyen ${isler.length} iş</span>
        ${isler.map((x, i) => html`<a class="pt-dikkat-cip" style=${{ '--i': i }} href=${NT.c.adres(x.m.id) + '#/' + x.sekme} title=${x.m.ad + ' › ' + x.metin}>
          <span class=${'pt-dikkat-ikon pt-' + x.m.id}><${Ikon} ad=${x.m.ikon} boyut=${14} /></span>${x.metin}<${Ikon} ad="ok" boyut=${14} /></a>`)}`
      : html`<span class="pt-dikkat-bas tamam"><${Ikon} ad="tik" boyut=${15} />Her şey yolunda · dikkat bekleyen bir iş yok</span>`}
    </div>`;
  }

  function Portal() {
    const ozet = useOzetler();
    const simdi = useSimdi();
    const saat = simdi.getHours();
    const ad = (b.kullanici || '').split(' ')[0];
    const ozel = ozelGun(bugun());
    const git = (m) => { if (m.hazir) location.href = NT.c.adres(m.id); };
    const tarih = simdi.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const saatYazi = simdi.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    return html`<div class="pt-sayfa">
      ${demo && html`<div class="sunum-seridi" role="alert"><${Ikon} ad="uyari" boyut=${16} /><span><b>SUNUM MODU</b> · Sistemler örnek verilerle açılır; hiçbir şey kaydedilmez.</span><a href=${NT.c.adres(b.modul.id, { demo: false })}>Gerçek verilerle aç →</a></div>`}
      <header class="pt-bant">
        ${BANT_SUS}
        <div class="pt-bant-ic">
          <div class="pt-ust">
            <span class="pt-marka">
              <span class="pt-logo-kutu"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" class="pt-logo" /></span>
              <span class="pt-marka-yazi"><b>SKYHEM Takip</b><small>Kimya · İş takip sistemleri</small></span>
            </span>
            <span style="flex:1" />
            <span class="pt-saat" title=${tarih}><${Ikon} ad="saat" boyut=${15} />${saatYazi}</span>
            <${K.TemaDugmesi} />
            ${!demo && html`<span class="pt-kisi"><${Avatar} ad=${b.kullanici || '?'} kucuk />${b.kullanici}</span>`}
          </div>
          <div class="pt-selam">
            ${ozel && html`<span class="pt-ozel-gun"><${Ikon} ad="takvim" boyut=${14} />${ozel.not}</span>`}
            <h1>${(ozel && ozel.selam) || (saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar')}${ad && !demo ? ', ' + ad : ''}.</h1>
            <p>${tarih} · Hangi sisteme gireceksiniz?</p>
          </div>
          <${DikkatSeridi} ozet=${ozet} />
        </div>
      </header>
      <main class="pt-icerik">
        <div class="pt-kartlar">${MODULLER.map((m, i) => {
          const o = ozet[m.id];
          return html`<button class=${'pt-kart' + (m.hazir ? '' : ' yakinda')} style=${{ '--i': i }} onClick=${() => git(m)} disabled=${!m.hazir}>
            <span class=${'pt-ikon pt-' + m.id}><${Ikon} ad=${m.ikon} boyut=${30} /></span>
            <span class="pt-baslik">${m.ad}${!m.hazir && html`<span class="rozet">Hazırlanıyor</span>`}</span>
            <span class="pt-aciklama">${m.aciklama}</span>
            <span class="pt-ozet">${!m.hazir ? '' : demo ? html`<span class="soluk">Örnek verilerle açılır</span>`
              : !o ? html`<span class="soluk">Yükleniyor…</span>` : o.hata ? html`<span class="pt-hata">${o.hata}</span>`
              : o.satirlar.map((s, i) => html`<span class=${i ? 'soluk' : ''}>${s}</span>`)}</span>
            ${m.hazir && html`<span class="pt-git">Aç <${Ikon} ad="ok" boyut=${16} /></span>`}
          </button>`;
        })}</div>
        <p class="pt-not">Sistemler birbirinden bağımsızdır; her birinin kayıtları ayrı tutulur. Ad ve erişim kodu hepsinde ortaktır.${window.NT_SURUM_AKTIF ? ` · Program sürümü ${window.NT_SURUM_AKTIF.surum}` : ''}</p>
      </main>
    </div>`;
  }

  function Kok() {
    const [, y] = useState(0);
    // Abone olduktan sonra bir kez yenile: baslat() bu effect'ten önce bitmiş olabilir (kodu kayıtlı bilgisayarda hemen "hazır" olur).
    useEffect(() => { const birak = b.abone(() => y((x) => x + 1)); y((x) => x + 1); return birak; }, []);
    const ic = demo || b.durum === 'hazir' ? html`<${Portal} />`
      : b.durum === 'basliyor' ? html`<div style="display:grid;place-items:center;height:100vh;color:var(--soluk)">Yükleniyor…</div>` : html`<${K.Kurulum} />`;
    return html`${ic}<${GlobalKatman} />`;
  }

  render(html`<${Kok} />`, document.getElementById('uygulama'));
  if (!demo) b.baslat();
})();
