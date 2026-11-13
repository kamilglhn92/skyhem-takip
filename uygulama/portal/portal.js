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
  const { t: cevir, DilSecimi, useDil } = NT.dil;
  const { bugun } = NT.c;
  const q = new URLSearchParams(location.search);
  const demo = q.has('demo');
  const demoKim = q.get('kullanici') || 'Farukcan Bey';
  const yonetici = () => demo ? NT.hesap.emirAcabilir(demoKim) : K.yetkili();
  const demoAdres = (adres, ad = q.get('kullanici')) => adres + (ad ? '&kullanici=' + encodeURIComponent(ad) : '');
  const personelTalepleri = () => demoAdres(NT.c.adres('personel', { demo: true }) + '&gorunum=yonetim', demo ? demoKim : b.kullanici);

  /* Numune özeti numune/hesap.js'in kurallarıyla hesaplanır (numune koduna dokunmadan). */
  function numuneOzet(d) {
    const H = NT.hesap;
    const st = H.stok(d);
    const dolu = [...st.dolu.values()].reduce((t, x) => t + Math.max(0, x.mevcut), 0);
    const yolda = d.kayitlar('sevk').filter((s) => s.durum !== 'Gönderildi' && H.sevkEtkili(s)).length;
    return [(NT.dil?.m("Rafta {0} dolu numune", dolu) ?? `Rafta ${dolu} dolu numune`), yolda ? (NT.dil?.m("{0} gönderi hazırlanıyor", yolda) ?? `${yolda} gönderi hazırlanıyor`) : (NT.dil?.t('Bekleyen gönderi yok') ?? 'Bekleyen gönderi yok')];
  }
  function numuneDikkat(d) {
    const n = d.kayitlar('sevk').filter((s) => s.durum === 'Etiket Bekliyor' && NT.hesap.sevkEtkili(s)).length;
    return n ? [{ metin: (NT.dil?.m("{0} gönderi etiket bekliyor", n) ?? `${n} gönderi etiket bekliyor`), sekme: 'gonderiler' }] : [];
  }

  /* dikkat(d): karşılama ekranındaki "dikkat bekleyenler" şeridi için [{ metin, sekme }] (her modülün hesap.js'inde). */
  const MODULLER = [
    { id: 'numune', ad: 'Numune Takip', aciklama: 'Numune şişeleri: dolum, müşteriye gönderi, raf sayımı', ikon: 'dolum', hazir: true, ozet: numuneOzet, dikkat: numuneDikkat },
    { id: 'satis', ad: 'Satış Takip', aciklama: 'Sevkiyatlar, müşteriler, partiler, gümrük klipsleri ve satış raporu', ikon: 'sevk', hazir: true, ozet: (d) => NT.satis.ozet(d), dikkat: (d) => NT.satis.dikkat(d) },
    { id: 'su', ad: 'İçme Suyu', aciklama: 'Damacana ve bardak su siparişi, teslimat, fatura kontrolü', ikon: 'damacana', hazir: true, ozet: (d) => NT.su.ozet(d), dikkat: (d) => NT.su.dikkat(d) },
    { id: 'yemek', ad: 'Yemek', aciklama: 'Günlük öğün sayısı, Desbaş menüsü ve ay sonu fatura kontrolü', ikon: 'yemek', hazir: true, ozet: (d) => NT.yemek.ozet(d), dikkat: (d) => NT.yemek.dikkat(d) },
    { id: 'yoklama', ad: 'Yoklama', aciklama: 'Raporlu, izinli günler ve fazla mesai; İK için aylık çizelge', ikon: 'takvim', hazir: true, ozet: (d) => NT.yoklama.ozet(d), dikkat: (d) => NT.yoklama.dikkat(d) },
    { id: 'enerji', ad: 'Enerji', aciklama: 'Elektrik ve doğalgaz: tüketim, maliyet ve birim fiyat karşılaştırması', ikon: 'simsek', hazir: true, ozel: true, ozet: (d) => NT.enerji.ozet(d), dikkat: (d) => NT.enerji.dikkat(d) },
    /* sunum: bulut tablosu yok; kart doğrudan sunum modunu açar, özet sabittir (context/personel-paneli.md). Personel panelindeki taleplerin yönetim tarafı. */
    { id: 'personel', ad: 'Personel talepleri', aciklama: 'İzin, malzeme, arıza talepleri ve ramak kala / öneri bildirimleri; onaylar ve izin durumu', ikon: 'kisi', hazir: true, sunum: true,
      adres: personelTalepleri,
      ozet: () => [cevir('Sunum · örnek verilerle açılır', 'Demo · opens with sample data'), cevir('Onaydan sonra kişisel hesaplarla canlıya geçer', 'Goes live with personal accounts after approval')] },
  ];
  /* Karşılamanın 1. seviyesi: panel seçimi. Kişisel hesaplar gelince herkes yalnız kendi panelini görecek (context/personel-paneli.md). */
  const panel = new URLSearchParams(location.search).get('panel');
  if (demo && panel === 'yonetim' && NT.personelDemo.personelMi(demoKim)) {
    location.replace(NT.c.adres('personel', { kullanici: demoKim }));
    return;
  }
  const PANELLER = [
    { id: 'personel', ad: 'Personel', aciklama: 'İzin, malzeme isteği, arıza, ramak kala, öneri ve numune işleri', adres: () => NT.c.adres('personel', { demo: true, kullanici: demo && NT.personelDemo.personelMi(demoKim) ? demoKim : '' }), sunum: true },
    { id: 'yonetim', ad: 'Yönetim', aciklama: 'Numune, satış, içme suyu, yemek, yoklama, enerji ve personel talepleri',
      adres: () => NT.c.adres('portal', { panel: 'yonetim', kullanici: demo && NT.personelDemo.personelMi(demoKim) ? 'Kamil' : q.get('kullanici') }) },
  ];

  /* ozel: yalnız yetkililerin (Kamil, Farukcan) gördüğü sistem; diğerlerinde kartı, özeti ve uyarıları hiç yüklenmez. */
  // Sunum modunda yalnız örnek içerik vardır; yeni modülün görseli de incelenebilir.
  const gorunen = () => MODULLER.filter((m) => !m.ozel || K.yetkili() || demo);

  /* Sunum modunda şerit nasıl göründüğü anlaşılsın diye örnek uyarılar (gerçek veri değildir). */
  function demoDikkat() {
    const gecen = new Date(); gecen.setDate(1); gecen.setMonth(gecen.getMonth() - 1);
    const ay = gecen.toLocaleDateString(NT.dil.yerel(), { month: 'long', year: 'numeric' }).replace(/^./, (h) => h.toLocaleUpperCase('tr'));
    return { satis: [{ metin: '1 sevkiyatta eksik belge', sekme: 'sevkiyatlar' }], su: [{ metin: '2 ayın su faturası girilmedi', sekme: 'faturalar' }],
      yemek: [{ metin: cevir(`${ay} yemek faturası girilmedi`, `Meal invoice missing for ${ay}`), sekme: 'faturalar' }] };
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
    if (arife) return { not: /Ramazan|Kurban/.test(arife) ? `${cevir(arife)} · ${cevir('Şimdiden iyi bayramlar', 'Happy holidays in advance')}` : arife };
    return null;
  }

  /* Uyarı hesabı bozulursa kartın özeti yine görünsün. */
  function ozetAl(m, d) {
    try { return m.ozet(d); } catch (e) { console.warn(m.id, 'özet', e); return []; }
  }
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
      for (const m of gorunen().filter((x) => x.hazir && x.ozet && !x.sunum)) {
        (async () => {
          const d = b.depoOlustur(m.id, b.kod, b.kullanici);
          try {
            const kayitli = await d.onbellek.al().catch(() => null);
            if (kayitli && kayitli.olaylar) { for (const e of kayitli.olaylar) d.ekle(e); d.sonSira = kayitli.sonSira || 0; d.yenidenHesapla(); yaz(m.id, { d, eski: true }); }
            d.cevrimici = true;
            await d.tara();
            yaz(m.id, d.hata && !d.olaylar.size ? { hata: d.hata } : { d, eski: !!d.hata });
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
    const acik = gorunen();
    const listeler = demo ? demoDikkat() : Object.fromEntries(acik.map((m) => [m.id, ozet[m.id]?.d ? dikkatAl(m, ozet[m.id].d) : []]));
    const isler = acik.flatMap((m) => (listeler[m.id] || []).map((x) => ({ ...x, m })));
    const hepsiGeldi = demo || acik.every((m) => m.sunum || (ozet[m.id] && !ozet[m.id].hata));
    if (!isler.length && !hepsiGeldi) return null;
    return html`<div class="pt-dikkat" role="status">
      ${isler.length ? html`<span class="pt-dikkat-bas"><${Ikon} ad="uyari" boyut=${15} />${cevir("Dikkat bekleyen")} ${isler.length}</span>
        ${isler.map((x, i) => html`<a class="pt-dikkat-cip" style=${{ '--i': i }} href=${NT.c.adres(x.m.id, { kullanici: q.get('kullanici') }) + '#/' + x.sekme} title=${cevir(x.m.ad) + ' › ' + cevir(x.metin)}>
          <span class=${'pt-dikkat-ikon pt-' + x.m.id}><${Ikon} ad=${x.m.ikon} boyut=${14} /></span>${cevir(x.metin)}<${Ikon} ad="ok" boyut=${14} /></a>`)}`
      : html`<span class="pt-dikkat-bas tamam"><${Ikon} ad="tik" boyut=${15} />${cevir("Her şey yolunda · dikkat bekleyen bir iş yok")}</span>`}
    </div>`;
  }

  function PersonelBekleyen() {
    const [talepler, setTalepler] = useState([]);
    useEffect(() => {
      let aktif = true;
      let kapat;
      NT.personelDemo.depoAc(demo ? demoKim : b.kullanici).then((d) => {
        if (!aktif) { d.kapat(); return; }
        const guncelle = () => setTalepler(NT.personel.bekleyenler(d));
        const birak = d.abone(guncelle);
        kapat = () => { birak(); d.kapat(); };
        guncelle();
      }).catch(console.error);
      return () => { aktif = false; kapat?.(); };
    }, []);
    if (!talepler.length) return null;
    return html`<a class="pt-personel-bekleyen" href=${personelTalepleri() + '#/onaylar'}>
      <${Ikon} ad="uyari" boyut=${24} /><span><strong>${talepler.length} ${cevir('personel talebi karar bekliyor', 'staff requests awaiting a decision')}</strong>
      <span class="pt-personel-ozet">${talepler.slice(0, 3).map((t) => html`<span key=${t.id}>${t.sahip} · ${NT.personel.talepOzet(t)}</span>`)}</span>
      <small>${cevir('Sunum', 'Demo')}</small></span>
      <b>${cevir('Personel taleplerini aç', 'Open staff requests')} →</b></a>`;
  }

  function useDuyurular() {
    const [depo, setDepo] = useState(null);
    const [liste, setListe] = useState([]);
    useEffect(() => {
      if (!demo) return undefined;
      let aktif = true;
      let kapat;
      NT.personelDemo.depoAc(demoKim).then((d) => {
        if (!aktif) { d.kapat(); return; }
        const yenile = () => setListe(d.kayitlar('duyuru').sort((a, b) => b._olusturma - a._olusturma));
        const birak = d.abone(yenile);
        kapat = () => { birak(); d.kapat(); };
        yenile();
        setDepo(d);
      }).catch(console.error);
      return () => { aktif = false; kapat?.(); };
    }, []);
    return { depo, liste };
  }

  function DuyuruFormu({ depo, kapat }) {
    const [baslik, setBaslik] = useState('');
    const [metin, setMetin] = useState('');
    const [hata, setHata] = useState('');
    const [bekle, setBekle] = useState(false);
    const [gorsel, setGorsel] = useState(null);
    function gorselSec(e) {
      const dosya = e.target.files[0];
      setHata('');
      if (dosya && !/^image\/(jpeg|png|webp)$/.test(dosya.type)) {
        e.target.value = '';
        setGorsel(null);
        setHata(cevir('JPG, PNG veya WebP görseli seçin.', 'Choose a JPG, PNG or WebP image.'));
        return;
      }
      setGorsel(dosya || null);
    }
    async function kaydet(e) {
      e.preventDefault();
      if (bekle || !baslik.trim() || !metin.trim()) return;
      setBekle(true);
      try {
        const kucuk = gorsel && await NT.ui.resimKucult(gorsel, 1600);
        if (kucuk && kucuk.size > 8 * 1024 * 1024) {
          setHata(cevir('Görsel en fazla 8 MB olabilir.', 'The image can be up to 8 MB.'));
          return;
        }
        const ek = kucuk && await depo.ekYaz(kucuk);
        const ozet = metin.trim().replace(/\s+/g, ' ');
        await depo.kaydet([{ c: 'duyuru', k: NT.c.uid(), v: {
          baslik: [baslik.trim()], ozet: [ozet.length > 100 ? ozet.slice(0, 99) + '…' : ozet],
          metin: [metin.trim()], tarih: bugun(), ...(ek && { gorsel: ek }),
        } }]);
        kapat();
      } catch {
        setHata(cevir('Duyuru kaydedilemedi. Tekrar deneyin.', 'Could not save the announcement. Try again.'));
      } finally { setBekle(false); }
    }
    return html`<${NT.ui.Modal} baslik=${cevir('Yeni duyuru', 'New announcement')} kapat=${kapat}
      alt=${html`<button type="submit" form="pt-duyuru-form" class="d ana-d" disabled=${bekle || !baslik.trim() || !metin.trim()}>${cevir('Duyuruyu yayınla', 'Post announcement')}</button>`}>
      <form class="modal-ic form-izgara" id="pt-duyuru-form" onSubmit=${kaydet}>
        <label class="alan s12">${cevir('Başlık', 'Title')}<input class="girdi" maxLength="100" value=${baslik} onInput=${(e) => setBaslik(e.target.value)} required /></label>
        <label class="alan s12">${cevir('Duyuru metni', 'Announcement text')}<textarea class="girdi" rows="5" maxLength="2000" value=${metin} onInput=${(e) => setMetin(e.target.value)} required /></label>
        <label class="alan s12">${cevir('Görsel (isteğe bağlı)', 'Image (optional)')}<input class="girdi" type="file" accept="image/jpeg,image/png,image/webp" disabled=${bekle} onChange=${gorselSec} /></label>
        ${hata && html`<p role="alert" class="hata-yazi s12">${hata}</p>`}
      </form><//>`;
  }

  function Portal() {
    const { depo: duyuruDeposu } = useDuyurular();
    const [yeniDuyuru, setYeniDuyuru] = useState(false);
    const ozet = useOzetler();
    const simdi = useSimdi();
    const saat = simdi.getHours();
    const ad = (b.kullanici || '').split(' ')[0];
    const ozel = ozelGun(bugun());
    const git = (m) => { if (m.hazir) location.href = m.adres ? m.adres() : demo ? demoAdres(NT.c.adres(m.id)) : NT.c.adres(m.id); };
    const tarih = simdi.toLocaleDateString(NT.dil.yerel(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const saatYazi = simdi.toLocaleTimeString(NT.dil.yerel(), { hour: '2-digit', minute: '2-digit' });
    return html`<div class="pt-sayfa pt-yonetim">
      ${demo && html`<div class="sunum-seridi" role="alert"><${Ikon} ad="uyari" boyut=${16} /><span><b>${cevir("SUNUM MODU")}</b> ${cevir('· Sistemler örnek verilerle açılır.', '· Trackers open with sample data.')}</span><a href=${NT.c.adres(b.modul.id, { demo: false })}>${cevir("Gerçek verilerle aç →")}</a></div>`}
      <header class="pt-bant">
        ${BANT_SUS}
        <div class="pt-bant-ic">
          <div class="pt-ust">
            <span class="pt-marka">
              <span class="pt-logo-kutu"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" class="pt-logo" /></span>
              <span class="pt-marka-yazi"><b>${cevir("SKYHEM Takip")}</b><small>${cevir("Kimya · İş takip sistemleri")}</small></span>
            </span>
            <span style="flex:1" />
            <span class="pt-saat" title=${tarih}><${Ikon} ad="saat" boyut=${15} />${saatYazi}</span>
            <${DilSecimi} /><${K.TemaDugmesi} />
            <span class="pt-kisi"><${Avatar} ad=${(demo ? demoKim : b.kullanici) || '?'} kucuk />${demo ? demoKim : b.kullanici}</span>
          </div>
          <div class="pt-selam">
            <a class="pt-panel-geri" href=${NT.c.adres('portal')}><${Ikon} ad="geri" boyut=${14} />${cevir('Paneller', 'Panels')} · <b>${cevir('Yönetim paneli', 'Management panel')}</b></a>
            ${ozel && html`<span class="pt-ozel-gun"><${Ikon} ad="takvim" boyut=${14} />${cevir(ozel.not)}</span>`}
            <h1>${cevir((ozel && ozel.selam) || (saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar'))}${ad && !demo ? ', ' + ad : ''}.</h1>
            <p>${tarih} ${cevir("· Hangi sisteme gireceksiniz?")}</p>
          </div>
          <${DikkatSeridi} ozet=${ozet} />
        </div>
      </header>
      <main class="pt-icerik">
        ${demo && yonetici() && html`<${PersonelBekleyen} />`}
        ${duyuruDeposu && html`<div class="pt-duyuru-eylem"><button class="d" onClick=${() => setYeniDuyuru(true)}><${Ikon} ad="arti" boyut=${16} />${cevir('Yeni duyuru', 'New announcement')}</button></div>`}
        <div class="pt-kartlar">${gorunen().map((m, i) => {
          const o = ozet[m.id];
          return html`<button class=${'pt-kart' + (m.hazir ? '' : ' yakinda')} data-modul=${m.id} style=${{ '--i': i }} onClick=${() => git(m)} disabled=${!m.hazir}>
            <span class=${'pt-ikon pt-' + m.id}><${Ikon} ad=${m.ikon} boyut=${30} /></span>
            <span class="pt-baslik">${cevir(m.ad)}${!m.hazir && html`<span class="rozet">${cevir("Hazırlanıyor")}</span>`}</span>
            <span class="pt-aciklama">${cevir(m.aciklama)}</span>
            <span class="pt-ozet">${!m.hazir ? '' : demo || m.sunum ? html`<span class="soluk">${m.sunum ? m.ozet()[0] : cevir("Örnek verilerle açılır")}</span>`
              : !o ? html`<span class="soluk">${cevir("Yükleniyor…")}</span>` : o.hata ? html`<span class="pt-hata">${o.hata}</span>`
              : ozetAl(m, o.d).map((s, i) => html`<span class=${i ? 'soluk' : ''}>${cevir(s)}</span>`)}</span>
            ${m.hazir && html`<span class="pt-git">${cevir("Aç")} <${Ikon} ad="ok" boyut=${16} /></span>`}
          </button>`;
        })}</div>
        <p class="pt-not">${cevir('Sistemler birbirinden bağımsızdır; her birinin kayıtları ayrı tutulur. Ad ve erişim kodu hepsinde ortaktır.', 'Each tracker has its own records. Your name and access code are shared across trackers.')}${window.NT_SURUM_AKTIF ? ` · ${cevir('Program sürümü')} ${NT.c.surumYaz(window.NT_SURUM_AKTIF.surum)}` : ''}</p>
      </main>
      ${yeniDuyuru && html`<${DuyuruFormu} depo=${duyuruDeposu} kapat=${() => setYeniDuyuru(false)} />`}
    </div>`;
  }

  /* 1. seviye: Personel / Yönetim seçimi (aynı bant ve kart görünümü). */
  const ORNEK_DUYURULAR = [
    { tarih: '2026-11-13', baslik: ['Kasım yemek menüsü', 'November meal menu'], ozet: ['Günlük ve aylık menü personel panelinde.', 'Daily and monthly menus are in the staff panel.'],
      metin: ['Personel panelinde Yemek menüsü kartını açın. Üst bölümde bugünün öğle ve akşam yemekleri, altında aylık menü yer alır. Aylık tablodan istediğiniz güne dokunarak ayrıntısını görebilirsiniz.', 'Open Meal menu in the staff panel. Today’s lunch and dinner appear at the top, followed by the monthly menu. Select a day to see its details.'] },
    { tarih: '2026-11-12', ornekGorsel: true, baslik: ['Numune raf sayımı', 'Sample stocktake'], ozet: ['Boş şişeleri ve dolu numuneleri kontrol edin.', 'Check empty bottles and filled samples.'],
      metin: ['Numune Takip’te Raf sayımı’nı açıp saydığınız rafı seçin. Boş şişe adedini, tam dolu kapları ve varsa açık kapta kalan litreyi girin. Kaydettiğiniz fark iki panelde de stoğa yansır.', 'Open Stocktake in Sample Tracking and select the shelf. Enter empty bottles, full containers, and any litres remaining in an open container. Saved adjustments appear in both panels.'] },
    { tarih: '2026-11-11', baslik: ['Malzeme taleplerinde kalem notu', 'Notes on material request items'], ozet: ['Her malzeme için birim ve isteğe bağlı not girilebilir.', 'Each item can have its own unit and optional note.'],
      metin: ['Malzeme isteğinde her kalemin birimini seçin. Beden, ölçü veya kullanım yeri gibi bilgiler için kalemin altındaki Not ekle düğmesini kullanın. Yönetim notu ilgili kalemin yanında görür.', 'Choose a unit for each item in a material request. Use Add note for details such as size, dimensions, or where it will be used. Management sees the note beside the item.'] },
  ];

  function DuyuruGorseli({ duyuru, depo, detay = false }) {
    const [url, setUrl] = useState('');
    const dosya = duyuru.gorsel?.dosya;
    useEffect(() => {
      if (!depo || !dosya) return undefined;
      let aktif = true;
      let adres;
      setUrl('');
      depo.ekOku(dosya).then((blob) => {
        if (!aktif || !blob) return;
        adres = URL.createObjectURL(blob);
        setUrl(adres);
      }).catch(() => {});
      return () => { aktif = false; if (adres) URL.revokeObjectURL(adres); };
    }, [depo, dosya]);
    const sinif = detay ? 'pt-duyuru-tam-gorsel' : 'pt-duyuru-onizleme';
    if (duyuru.ornekGorsel) return html`<span class=${sinif + ' pt-duyuru-ornek-gorsel'} aria-hidden="true" />`;
    if (!url) return null;
    return html`<img class=${sinif} src=${url} alt=${detay ? duyuru.gorsel.ad : ''} decoding="async" />`;
  }

  function PanelSecimi() {
    const { depo, liste } = useDuyurular();
    const [duyuru, setDuyuru] = useState(null);
    const simdi = useSimdi();
    const saat = simdi.getHours();
    const ad = (b.kullanici || '').split(' ')[0];
    const tarih = simdi.toLocaleDateString(NT.dil.yerel(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return html`<div class="pt-sayfa pt-paneller">
      ${demo && html`<div class="sunum-seridi" role="alert"><${Ikon} ad="uyari" boyut=${16} /><span><b>${cevir("SUNUM MODU")}</b> ${cevir('· Sistemler örnek verilerle açılır.', '· Trackers open with sample data.')}</span><a href=${NT.c.adres('portal', { demo: false })}>${cevir("Gerçek verilerle aç →")}</a></div>`}
      <header class="pt-bant">${BANT_SUS}<div class="pt-bant-ic">
        <div class="pt-ust"><span class="pt-marka"><span class="pt-logo-kutu"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" class="pt-logo" /></span>
          <span class="pt-marka-yazi"><b>${cevir("SKYHEM Takip")}</b><small>${cevir("Kimya · İş takip sistemleri")}</small></span></span>
          <span style="flex:1" /><${DilSecimi} /><${K.TemaDugmesi} />${!demo && html`<span class="pt-kisi"><${Avatar} ad=${b.kullanici || '?'} kucuk />${b.kullanici}</span>`}</div>
        <div class="pt-selam"><h1>${cevir(saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar')}${ad && !demo ? ', ' + ad : ''}.</h1>
          <p>${tarih} ${cevir('· Hangi panele gireceksiniz?', '· Which panel do you want to open?')}</p></div>
      </div></header>
      <main class="pt-icerik"><div class="pt-kartlar pt-panel-kartlar">${PANELLER.map((p, i) => html`<button class="pt-kart" data-modul=${'panel-' + p.id} style=${{ '--i': i }} onClick=${() => { location.href = p.adres(); }}>
          <span class="pt-baslik">${cevir(p.ad, p.id === 'personel' ? 'Staff' : 'Management')}${p.sunum && html` <span class="rozet">${cevir('Sunum', 'Demo')}</span>`}</span>
          <span class="pt-aciklama">${cevir(p.aciklama)}</span>
          <span class="pt-ozet"><span class="soluk">${p.sunum ? cevir('Örnek verilerle açılır; kişisel hesaplar kurulunca canlıya geçer', 'Opens with sample data; goes live with personal accounts') : cevir('Bugün kullandığınız sistemler', 'The trackers you use today')}</span></span>
          <span class="pt-git">${cevir("Aç")} <${Ikon} ad="ok" boyut=${16} /></span></button>`)}</div>
        <section class="pt-duyurular" aria-labelledby="pt-duyuru-baslik">
          <h2 id="pt-duyuru-baslik"><${Ikon} ad="bilgi" boyut=${20} />${cevir('Duyuru panosu', 'Notice board')}</h2>
          ${demo ? html`<ul>${[...liste, ...ORNEK_DUYURULAR].map((x) => html`<li key=${x.id || x.baslik[0]}>
            <button type="button" onClick=${() => setDuyuru(x)}>
              <span class="pt-duyuru-tarih"><time dateTime=${x.tarih}>${NT.c.tarihYaz(x.tarih)}</time><${Ikon} ad="ok" boyut=${15} /></span>
              <span class="pt-duyuru-govde"><span><b>${cevir(...x.baslik)}</b><small>${cevir(...x.ozet)}</small></span>
                <${DuyuruGorseli} duyuru=${x} depo=${depo} /></span>
            </button></li>`)}</ul>`
            : html`<p>${cevir('Henüz duyuru yok.', 'No announcements yet.')}</p>`}
        </section>
      </main>
      <footer class="pt-not">${cevir('Personel ve yönetim panelleri aynı kayıtlarla çalışır. Kişisel hesaplar kurulunca herkes yalnız kendi panelini görecek.', 'Both panels share the same records. Once personal accounts are set up, everyone sees only their own panel.')}${window.NT_SURUM_AKTIF ? ` · ${cevir('Program sürümü')} ${NT.c.surumYaz(window.NT_SURUM_AKTIF.surum)}` : ''}</footer>
      ${duyuru && html`<${NT.ui.Modal} baslik=${cevir(...duyuru.baslik)} kapat=${() => setDuyuru(null)}>
        <div class="modal-ic"><time class="soluk kucuk" dateTime=${duyuru.tarih}>${NT.c.tarihYaz(duyuru.tarih)}</time>
          <p class="pt-duyuru-metin">${cevir(...duyuru.metin)}</p>
          <${DuyuruGorseli} key=${duyuru.id || duyuru.baslik[0]} duyuru=${duyuru} depo=${depo} detay />
        </div><//>`}
    </div>`;
  }

  function Kok() {
    useDil();
    const [, y] = useState(0);
    // Abone olduktan sonra bir kez yenile: baslat() bu effect'ten önce bitmiş olabilir (kodu kayıtlı bilgisayarda hemen "hazır" olur).
    useEffect(() => { const birak = b.abone(() => y((x) => x + 1)); y((x) => x + 1); return birak; }, []);
    const ic = demo || b.durum === 'hazir' ? (panel === 'yonetim' ? html`<${Portal} />` : html`<${PanelSecimi} />`)
      : b.durum === 'basliyor' ? html`<div style="display:grid;place-items:center;height:100vh;color:var(--soluk)">${cevir("Yükleniyor…")}</div>` : html`<${K.Kurulum} />`;
    return html`${ic}<${GlobalKatman} />`;
  }

  render(html`<${Kok} />`, document.getElementById('uygulama'));
  if (!demo) b.baslat();
})();
