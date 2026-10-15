/*
 * Yeni modüllerin (Satış, Su, Yemek, Yoklama) ortak iskeleti: sol menü, üst çubuk, giriş ekranı, pencere katmanı,
 * silme/çöp kutusu, ayarlar ve Excel yardımcıları. Numune kendi iskeletini (numune/tezgah.js) kullanır; görünüm aynıdır.
 *
 * Bir modül şunu çağırır:
 *   NT.kabuk.calistir({ sekmeler, sayfalar, eylemler, arama, uzakKoleksiyonlar })
 * Modüller birbirini tanımaz; ortak olan yalnızca bu dosya, bağlantı ve görünümdür.
 */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, render, useState, useEffect, useMemo, useRef } = window.htmPreact;
  const { Ikon, Avatar, Alan, BosDurum, GlobalKatman, AnaEkranLinki, bildir, onayla } = NT.ui;
  const { onceYaz, zamanYaz, tarihYaz, bugun, adetYaz, indir } = NT.c;
  const b = NT.baglanti;
  const depo = () => b.depo;
  document.documentElement.classList.add('tezgah');

  /* ---------------- Tema ---------------- */
  const temaAl = () => { try { return localStorage.getItem('nt.tema') || 'oto'; } catch { return 'oto'; } };
  function temaUygula(t) {
    try { localStorage.setItem('nt.tema', t); } catch { /* yoksay */ }
    if (t === 'oto') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', t);
  }
  const koyuMu = () => {
    const t = document.documentElement.getAttribute('data-tema');
    return t ? t === 'koyu' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  };
  function TemaDugmesi() {
    const [, y] = useState(0);
    const koyu = koyuMu();
    return html`<button class="tz-tema" onClick=${() => { temaUygula(koyu ? 'acik' : 'koyu'); y((x) => x + 1); }} title=${koyu ? 'Aydınlık moda geç' : 'Karanlık moda geç'} aria-label="Temayı değiştir"><${Ikon} ad=${koyu ? 'gunes' : 'ay'} boyut=${17} /></button>`;
  }

  /* ---------------- Pencere katmanı (iç içe açılabilir: müşteri kartından sevkiyat açmak gibi) ---------------- */
  const katman = { yigin: [], dinle: new Set() };
  const katmanGuncelle = () => katman.dinle.forEach((f) => f());
  function ac(B, props = {}) {
    const id = Math.random();
    const kapat = () => { katman.yigin = katman.yigin.filter((x) => x.id !== id); katmanGuncelle(); };
    katman.yigin = [...katman.yigin, { id, B, props: { ...props, kapat } }];
    katmanGuncelle();
    return kapat;
  }
  function Katman() {
    const [, y] = useState(0);
    useEffect(() => { const f = () => y((x) => x + 1); katman.dinle.add(f); return () => katman.dinle.delete(f); }, []);
    return html`${katman.yigin.map((x) => html`<${x.B} key=${x.id} ...${x.props} />`)}`;
  }

  /* ---------------- Kayıt yardımcıları ---------------- */
  /* ÖNEK-YYYY-NNNN; silinenler de sayılır ki numara tekrar verilmesin. */
  function yeniNo(d, c, onEk, tarih = bugun()) {
    const yil = String(tarih || bugun()).slice(0, 4);
    const re = new RegExp(`^${onEk}-${yil}-(\\d+)`);
    let en = 0;
    for (const r of d.kayitlar(c, { silinenler: true })) {
      const m = re.exec(r._asilNo || r.no || '');
      if (m) en = Math.max(en, +m[1]);
    }
    return `${onEk}-${yil}-${String(en + 1).padStart(4, '0')}`;
  }
  /* Çöp kutusuna gönderir; bildirimde "Geri al" vardır. */
  async function sil(c, r, ad) {
    const ne = ad || r.no || r.ad || 'Kayıt';
    if (!(await onayla(`${ne} silinsin mi? Çöp kutusuna gider; Ayarlar › Çöp kutusu’ndan geri alınabilir.`, { baslik: 'Sil', evet: 'Sil', tehlike: true }))) return false;
    const d = depo();
    await d.kaydet([{ op: 'del', c, k: r.id }]);
    bildir(`${ne} silindi.`, { eylem: { yazi: 'Geri al', fn: () => d.kaydet([{ op: 'undel', c, k: r.id }]) } });
    return true;
  }
  /* Gelişmiş Excel: NT.xlsx üzerine dosya adı + indirme. */
  function excel(dosyaAdi, secenek) {
    indir(dosyaAdi, NT.xlsx(secenek));
    bildir('Excel dosyası indirildi.');
  }
  const sayiYaz = (n, basamak = 0) => (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: basamak, maximumFractionDigits: basamak });

  /* ---------------- Sayfa parçaları ---------------- */
  /* bant: Genel Bakış'ın başlığı, karşılama ekranındaki bandın küçüğü (modülün yeşil tonunda; renkler tezgah.css › .tz-m-<modül>). */
  function Selam({ baslik, children, sag, bant }) {
    return html`<div class=${'tz-selam' + (bant ? ' tz-selam-bant' : '')}>${bant && html`<${NT.ui.BantSus} />`}<div><h1>${baslik}</h1>${children && html`<p>${children}</p>`}</div>
      ${sag && html`<div style="margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${sag}</div>`}</div>`;
  }
  function Kart({ baslik, sag, children, sinif = '', stil }) {
    return html`<section class=${'tz-kart ' + sinif} style=${stil}>
      ${(baslik || sag) && html`<div class="tz-kart-bas">${baslik && html`<h2>${baslik}</h2>`}<div class="sag">${sag}</div></div>`}
      ${children}
    </section>`;
  }
  /* Süzgeç çipleri: [[id, ad, sayı]] */
  function Cipler({ secenekler, deger, degis, children }) {
    return html`<div class="tz-cipler">${secenekler.map(([id, ad, n]) => html`<button class=${'tz-cip' + (deger === id ? ' secili' : '')} onClick=${() => degis(id)}>${ad}${n != null && html`<span class="n">${n}</span>`}</button>`)}${children}</div>`;
  }
  function Kpi({ ad, deger, birim, alt, vurgu, ikon }) {
    return html`<div class=${'kart kpi' + (vurgu ? ' vurgu' : '')}><div class="ad">${ikon && html`<${Ikon} ad=${ikon} boyut=${15} />`}${ad}</div>
      <div class="deger">${deger}${birim && html`<small>${birim}</small>`}</div>${alt && html`<div class="alt">${alt}</div>`}</div>`;
  }
  /* Basit çubuk grafik: [{ ad, deger, etiket, ipucu, vurgu }] */
  function Cubuklar({ veri, yukseklik = 150 }) {
    const en = Math.max(1, ...veri.map((x) => x.deger));
    return html`<div class="cubuk-grafik" style=${{ height: yukseklik + 'px' }}>${veri.map((x) => html`<div class=${'sutun' + (x.vurgu ? ' bu-ay' : '')}>
      ${x.ipucu && html`<span class="ipucu-kutu">${x.ipucu}</span>`}
      <span class="deger">${x.deger ? x.etiket ?? x.deger : ''}</span>
      <div class="cubuk" style=${{ height: `${(x.deger / en) * (yukseklik - 40)}px` }} /><span class="ay">${x.ad}</span></div>`)}</div>`;
  }
  /* Kayıt penceresinin alt düğmeleri: Sil (varsa) · Vazgeç · Kaydet */
  function FormAlt({ kayit, sil: silFn, kapat, kaydet, mesgul, ek, kaydetYazi = 'Kaydet' }) {
    return html`${(kayit && silFn || ek) && html`<div class="sol">${kayit && silFn && html`<button class="d tehlike" onClick=${silFn}><${Ikon} ad="cop" />Sil</button>`}${ek}</div>`}
      <button class="d hayalet" onClick=${kapat}>Vazgeç</button>
      <button class="d ana-d" disabled=${mesgul} onClick=${kaydet}><${Ikon} ad="tik" />${mesgul ? 'Kaydediliyor…' : kaydetYazi}</button>`;
  }

  /* Yazdıkça altta öneri listesi açılan metin kutusu (datalist'ten farkı: ek bilgi ve klavyeyle seçim). */
  function OneriGirdi({ deger, degis, oneriler, sec, placeholder, otomatikOdak, sinif = '' }) {
    const [acik, setAcik] = useState(false);
    const [i, setI] = useState(0);
    const liste = oneriler.slice(0, 8);
    const secVe = (x) => { setAcik(false); sec(x); };
    return html`<div class="oneri-kap">
      <input class=${'girdi ' + sinif} value=${deger} placeholder=${placeholder} autofocus=${otomatikOdak} autocomplete="off"
        onFocus=${() => setAcik(true)} onBlur=${() => setTimeout(() => setAcik(false), 150)}
        onInput=${(e) => { degis(e.target.value); setAcik(true); setI(0); }}
        onKeyDown=${(e) => {
          if (!acik || !liste.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(i + 1, liste.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(i - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); secVe(liste[i]); }
          else if (e.key === 'Escape') setAcik(false);
        }} />
      ${acik && liste.length > 0 && html`<div class="oneri-liste">${liste.map((x, j) => html`<button type="button" class=${j === i ? 'secili' : ''} onMouseDown=${(e) => { e.preventDefault(); secVe(x); }}>
        <b>${x.ad}</b>${x.alt && html`<span>${x.alt}</span>`}</button>`)}</div>`}
    </div>`;
  }

  /* ---------------- Üst çubuk araması ---------------- */
  function Arama({ kaynak }) {
    const d = depo();
    const [q, setQ] = useState('');
    const [acik, setAcik] = useState(false);
    const [sec, setSec] = useState(0);
    const girdi = useRef();
    useEffect(() => {
      const f = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); girdi.current?.focus(); } };
      window.addEventListener('keydown', f);
      return () => window.removeEventListener('keydown', f);
    }, []);
    const sonuc = useMemo(() => (q.trim() ? kaynak(d, q).slice(0, 12) : []), [q, d.surum]);
    const calistir = (x) => { setQ(''); setAcik(false); girdi.current?.blur(); x.fn && x.fn(); };
    return html`<div class="tz-ara"><${Ikon} ad="ara" boyut=${16} />
      <input ref=${girdi} placeholder="Ara…  (Ctrl K)" value=${q} onFocus=${() => setAcik(true)} onBlur=${() => setTimeout(() => setAcik(false), 150)}
        onInput=${(e) => { setQ(e.target.value); setSec(0); setAcik(true); }}
        onKeyDown=${(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSec(Math.min(sec + 1, sonuc.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSec(Math.max(sec - 1, 0)); }
          else if (e.key === 'Enter' && sonuc[sec]) calistir(sonuc[sec]);
          else if (e.key === 'Escape') { setQ(''); e.target.blur(); }
        }} />
      ${acik && q.trim() && html`<div class="tz-ara-sonuc">${sonuc.length ? sonuc.map((x, i) => html`<button class=${i === sec ? 'secili' : ''} onMouseDown=${(e) => { e.preventDefault(); calistir(x); }}><span class="tur">${x.tur}</span><span>${x.ad}</span><span class="ek">${x.ek}</span></button>`)
        : html`<div class="soluk kucuk" style="padding:10px 12px">Sonuç yok</div>`}</div>`}
    </div>`;
  }

  /* ---------------- Ayarlar: profil, bulut, çöp kutusu (modül kendi bölümlerini araya ekler) ---------------- */
  function AyarKarti({ baslik, aciklama, sag, children, ic = true }) {
    return html`<section class="kart" style="margin-bottom:16px">
      <div class="kart-bas"><div><h2>${baslik}</h2>${aciklama && html`<div class="kucuk soluk" style="margin-top:2px">${aciklama}</div>`}</div><div class="sag">${sag}</div></div>
      ${ic ? html`<div class="kart-ic">${children}</div>` : children}
    </section>`;
  }
  function Profil() {
    const [ad, setAd] = useState(b.kullanici);
    const [t, setT] = useState(temaAl());
    return html`<${AyarKarti} baslik="Profil" aciklama="Adınız her kaydın geçmişinde “kim yaptı” olarak görünür. Bütün sistemlerde ortaktır.">
      <div class="form-izgara">
        <${Alan} etiket="Adınız" sinif="s6"><div style="display:flex;gap:8px"><input class="girdi" value=${ad} onInput=${(e) => setAd(e.target.value)} />
          <button class="d" disabled=${!ad.trim() || ad.trim() === b.kullanici} onClick=${() => { b.kullaniciAyarla(ad); bildir('Adınız güncellendi.'); }}>Kaydet</button></div><//>
        <${Alan} etiket="Görünüm" sinif="s6"><div class="segment">${[['oto', 'Sistem'], ['acik', 'Açık'], ['koyu', 'Koyu']].map(([id, yazi]) => html`<button class=${t === id ? 'secili' : ''} onClick=${() => { setT(id); temaUygula(id); }}>${yazi}</button>`)}</div><//>
      </div>
    <//>`;
  }
  function Bulut() {
    const d = depo();
    return html`<${AyarKarti} baslik="Bulut bağlantısı" aciklama="Kayıtlar internet üzerinden tutulur; bu sistemi açan herkes aynı kayıtları görür. İnternet yokken son kayıtlarla çalışır, yenileri bağlantı gelince gönderir."
      sag=${html`<button class="d kucuk-d" onClick=${async () => { await d.tara(); bildir(d.hata ? d.hata : 'Eşitlendi.', d.hata ? { tur: 'hata' } : {}); }}><${Ikon} ad="senkron" boyut=${15} />Şimdi eşitle</button>`}>
      <div class="form-izgara">
        <div class="s6"><div class="alt-satir">Bağlantı</div><div class="ust-satir">${b.mod === 'demo' ? 'Sunum modu (kaydedilmez)' : d.cevrimici ? 'Bulut · bağlı' : 'Bulut · bağlantı yok'}</div></div>
        <div class="s3"><div class="alt-satir">Toplam hareket</div><div class="ust-satir sayi">${adetYaz(d.olaylar.size)}</div></div>
        <div class="s3"><div class="alt-satir">Son eşitleme</div><div class="ust-satir">${d.sonEsitleme ? onceYaz(d.sonEsitleme) : '—'}</div></div>
        ${window.NT_SURUM_AKTIF && html`<div class="s12 kucuk soluk">Program sürümü ${window.NT_SURUM_AKTIF.surum} · güncellemeler kendiliğinden gelir</div>`}
        ${d.bekleyen.length > 0 && html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${d.bekleyen.length} değişiklik bu bilgisayarda bekliyor; internete ulaşılınca otomatik gönderilecek.</span></div>`}
        ${d.hata && html`<div class="s12 uyari-kutu yok"><${Ikon} ad="uyari" /><span>${d.hata}</span></div>`}
        ${b.mod === 'bulut' && html`<div class="s12 dugmeler"><button class="d hayalet" onClick=${async () => { if (await onayla('Bu bilgisayardaki erişim kodu silinir (bütün sistemler için); bir dahaki açılışta kod yeniden sorulur. Buluttaki kayıtlara dokunulmaz.', { baslik: 'Bağlantıyı kes', evet: 'Bağlantıyı kes' })) b.ayril(); }}>Bu bilgisayarın bağlantısını kes</button></div>`}
      </div>
    <//>`;
  }
  /* turler: { koleksiyon: { ad: 'Sevkiyat', ozet: (r) => metin } } */
  function CopKutusu({ turler }) {
    const d = depo();
    const silinen = Object.keys(turler).flatMap((c) => d.kayitlar(c, { silinenler: true }).filter((r) => r._silindi).map((r) => ({ c, r })))
      .sort((a, x) => x.r._degisim - a.r._degisim);
    return html`<${AyarKarti} ic=${false} baslik="Çöp kutusu" aciklama="Silinen kayıtlar kalıcı olarak kaybolmaz; buradan geri alınabilir.">
      ${silinen.length ? html`<div class="tablo-kap" style="max-height:340px"><table class="tablo"><thead><tr><th>Tür</th><th>Kayıt</th><th>Silen</th><th></th></tr></thead><tbody>
        ${silinen.map(({ c, r }) => html`<tr key=${r.id}><td>${turler[c].ad}</td><td>${r.no && html`<span class="etiket-kod">${r.no}</span> `}${turler[c].ozet(r)}</td>
          <td>${r._degistiren} <span class="soluk kucuk">· ${onceYaz(r._degisim)}</span></td>
          <td class="sag"><button class="d kucuk-d" onClick=${async () => { await d.kaydet([{ op: 'undel', c, k: r.id }]); bildir('Geri alındı.'); }}><${Ikon} ad="geri" boyut=${15} />Geri al</button></td></tr>`)}
      </tbody></table></div>` : html`<${BosDurum} ikon="cop" baslik="Çöp kutusu boş" />`}
    <//>`;
  }
  function Yedek({ onEk }) {
    const d = depo();
    return html`<${AyarKarti} baslik="Yedek" aciklama="Kayıtlar bulutta durur; yine de ara sıra tam yedek indirip saklamanızı öneririz.">
      <button class="d" onClick=${() => { indir(`${onEk}-yedek-${bugun()}.json`, JSON.stringify({ uygulama: 'SKYHEM Takip', modul: b.modul.id, tarih: new Date().toISOString(), olaylar: d.sirali }, null, 1), 'application/json'); bildir('Yedek indirildi.'); }}><${Ikon} ad="indir" />Tam yedek indir</button>
    <//>`;
  }
  function AyarlarSayfasi({ aciklama, cop, children }) {
    return html`<${Selam} baslik="Ayarlar">${aciklama || 'Buradaki ayarlar bu sistemi kullanan herkes için ortaktır (profil ve görünüm hariç).'}<//>
      <${Profil} />${children}<${Bulut} />${cop && html`<${CopKutusu} turler=${cop} />`}<${Yedek} onEk=${b.modul.id} />`;
  }

  /* ---------------- İskelet ---------------- */
  const sekmeAl = (sekmeler) => { const s = (location.hash.match(/^#\/(\w+)/) || [])[1]; return sekmeler.some((x) => x.id === s) ? s : sekmeler[0].id; };
  function Iskelet({ ayar }) {
    const { sekmeler, sayfalar, eylemler = [], arama } = ayar;
    const [sekme, setSekme] = useState(sekmeAl(sekmeler));
    const d = depo();
    useEffect(() => {
      const f = () => { setSekme(sekmeAl(sekmeler)); window.scrollTo(0, 0); };
      window.addEventListener('hashchange', f);
      return () => window.removeEventListener('hashchange', f);
    }, []);
    // Tek tuş kısayolları (yazı alanında ve açık pencerede çalışmaz)
    useEffect(() => {
      const f = (e) => {
        if (e.target.closest && e.target.closest('input, textarea, select')) return;
        if (document.querySelector('.perde') || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
        const x = eylemler.find((a) => a.tus && a.tus.toLowerCase() === e.key.toLowerCase());
        if (x) { e.preventDefault(); x.fn(); }
      };
      window.addEventListener('keydown', f);
      return () => window.removeEventListener('keydown', f);
    }, []);
    const cevrimici = (d.kisiler || []).filter((k) => Date.now() - k.t < 90000);
    const durum = d.hata ? 'hata' : d.bekleyen.length ? 'bekliyor' : '';
    const Sayfa = sayfalar[sekme] || sayfalar[sekmeler[0].id];
    return html`<div class=${'tz-iskelet tz-m-' + b.modul.id}>
      <aside class="tz-yan">
        <a class="tz-marka" href=${'#/' + sekmeler[0].id}><img src="uygulama/ortak/logo.svg" alt="SKYHEM" /><span>${b.modul.ad}</span></a>
        <${AnaEkranLinki} />
        <nav class="tz-menu" aria-label="Sayfalar">${sekmeler.map((s) => {
          const n = s.sayac ? s.sayac(d) : 0;
          return html`<a href=${'#/' + s.id} class=${sekme === s.id ? 'aktif' : ''}><${Ikon} ad=${s.ikon} />${s.ad}${n > 0 ? html`<span class="n">${n}</span>` : ''}</a>`;
        })}</nav>
        ${eylemler.length > 0 && html`<div class="tz-menu-baslik">Hızlı işlem</div>
        <nav class="tz-menu tz-hizli-menu" aria-label="Hızlı işlem">${eylemler.map((x) => html`<button type="button" onClick=${x.fn} title=${x.alt}>
          <${Ikon} ad=${x.ikon} />${x.ad}${x.tus && html`<kbd>${x.tus}</kbd>`}</button>`)}</nav>`}
        <div class="tz-yan-alt">
          ${b.mod === 'bulut' && html`<div class="kisiler" title=${cevrimici.map((k) => k.ad).join(', ')}>
            ${cevrimici.slice(0, 5).map((k) => html`<${Avatar} key=${k.cihaz} ad=${k.ad} kucuk />`)}
            <span class="yazi">${cevrimici.length <= 1 ? 'Şu an sadece siz' : `${cevrimici.length} kişi çevrimiçi`}</span></div>`}
          <button class=${'tz-canli ' + durum} onClick=${() => d.tara()} title=${d.hata || 'Şimdi eşitle'}><span class="nokta" />
            <span><b>${b.mod === 'demo' ? 'Sunum modu' : d.hata ? 'Bağlantı sorunu' : d.bekleyen.length ? `${d.bekleyen.length} değişiklik bekliyor` : 'Eşitlendi'}</b>
              ${b.mod === 'demo' ? 'Örnek veri · kaydedilmez' : `Bulut · ${d.sonEsitleme ? onceYaz(d.sonEsitleme) : '—'}`}</span></button>
          <a class="tz-kullanici" href="#/ayarlar"><${Avatar} ad=${b.kullanici || '?'} kucuk /><span>${b.kullanici}</span></a>
        </div>
      </aside>
      <div class="tz-ana">
        ${b.mod === 'demo' && html`<div class="sunum-seridi" role="alert"><${Ikon} ad="uyari" boyut=${16} /><span><b>SUNUM MODU</b> · Örnek veriler. Burada girdiğiniz hiçbir şey kaydedilmez; sayfa kapanınca silinir.</span><a href=${NT.c.adres(b.modul.id, { demo: false })}>Gerçek verilerle aç →</a></div>`}
        <header class="tz-ust">${arama ? html`<${Arama} kaynak=${arama} />` : ''}<span style="flex:1" /><${TemaDugmesi} /></header>
        <main class=${'tz-icerik' + (sekme === 'ayarlar' ? ' tz-klasik' : '')}><${Sayfa} /></main>
      </div>
    </div>`;
  }

  /* ---------------- Giriş (ad + erişim kodu; bütün sistemlerde ortak) ---------------- */
  function Kurulum({ baslik }) {
    const [ad, setAd] = useState(b.kullanici);
    const [kod, setKod] = useState(b.kod);
    const [hata, setHata] = useState('');
    const [bekle, setBekle] = useState(false);
    const giris = async () => {
      if (ad.trim().length < 2) return setHata('Önce adınızı yazın.');
      if (kod.trim().length < 4) return setHata('Erişim kodunu yazın.');
      setHata(''); setBekle(true);
      try { await b.girisYap(ad, kod); } catch (e) { console.error(e); setHata(e); } finally { setBekle(false); }
    };
    const hataVar = b.durum === 'hata';
    const girisFormu = !hataVar || b.hataKod;
    const enter = (e) => e.key === 'Enter' && giris();
    return html`<div class="tz-kurulum"><div class="tz-kurulum-kutu">
      <img src="uygulama/ortak/logo.svg" alt="SKYHEM" />
      <h1>${hataVar && !b.hataKod ? 'Sunucuya bağlanılamadı' : baslik || 'SKYHEM Takip’e hoş geldiniz'}</h1>
      <p>${hataVar ? b.hataMesaji : 'Adınızı ve size verilen erişim kodunu bir kez yazın. Kayıtlar internet üzerinden herkesle otomatik eşitlenir.'}</p>
      ${girisFormu && html`
        <input class="girdi" style="font-size:17px;padding:12px 14px" placeholder="Adınız Soyadınız" value=${ad} onInput=${(e) => setAd(e.target.value)} onKeyDown=${enter} autofocus />
        <input class="girdi mono" style="font-size:17px;padding:12px 14px;text-transform:uppercase" placeholder="Erişim kodu (örn. SKY-XXXX-XXXX)" value=${kod} onInput=${(e) => setKod(e.target.value)} onKeyDown=${enter} autocomplete="off" spellcheck="false" />
        <button class="d ana-d tz-buyuk" disabled=${bekle} onClick=${giris}>${bekle ? 'Bağlanıyor…' : 'Başla'}</button>`}
      ${!girisFormu && html`<button class="d ana-d tz-buyuk" onClick=${() => b.baslat()}>Tekrar dene</button>`}
      <${NT.ui.HataKutusu} hata=${hata} />
    </div></div>`;
  }

  /* ---------------- Sunum modu: bellekte depo + modülün örnek senaryosu ---------------- */
  class BellekDosya {
    constructor(ad) { this.kind = 'file'; this.name = ad; this.veri = new Blob([]); this.zaman = Date.now(); }
    async getFile() { return new File([this.veri], this.name, { lastModified: this.zaman }); }
    async createWritable({ keepExistingData = false } = {}) {
      const parcalar = keepExistingData ? [this.veri] : [];
      return { seek: async () => {}, write: async (v) => { parcalar.push(v); }, close: async () => { this.veri = new Blob(parcalar); this.zaman = Date.now(); } };
    }
  }
  class BellekDizin {
    constructor(ad) { this.kind = 'directory'; this.name = ad; this.c = new Map(); }
    async getDirectoryHandle(ad, { create } = {}) { return this.al(ad, create, () => new BellekDizin(ad)); }
    async getFileHandle(ad, { create } = {}) { return this.al(ad, create, () => new BellekDosya(ad)); }
    al(ad, create, yeni) {
      if (!this.c.has(ad)) {
        if (!create) throw Object.assign(new Error('Bulunamadı: ' + ad), { name: 'NotFoundError' });
        this.c.set(ad, yeni());
      }
      return this.c.get(ad);
    }
    async *entries() { yield* this.c.entries(); }
  }
  /* senaryo(depo, { kim, zamanla }) — kim(ad): kaydı yapan kişi; zamanla(evs, tarih): olayları o güne taşır. */
  function demoTanimla(senaryo) {
    NT.demo = {
      aktif: new URLSearchParams(location.search).has('demo'),
      async kur(bag) {
        bag.kullanici = new URLSearchParams(location.search).get('kullanici') || 'Farukcan Bey';
        const d = new NT.Depo({ dizin: new BellekDizin('Demo'), cihaz: bag.cihaz, kullanici: bag.kullanici });
        await bag.ac(d, 'demo', { hazirYap: false });
        const zamanli = [];
        await senaryo(d, {
          kim: (ad) => { d.kullanici = ad; },
          kaydet: async (ops, tarih) => { const evs = await d.kaydet(ops); if (tarih) zamanli.push(...evs.map((e) => [e, tarih])); return evs; },
        });
        const bg = bugun();
        for (const [e, t] of zamanli) {
          const z = Date.parse(t + 'T09:00:00') + ((e.id.charCodeAt(0) * 7919) % (8 * 3600e3));
          e.t = t >= bg ? Math.min(z, Date.now() - 60e3) : z;
        }
        d.yenidenHesapla();
        d.kullanici = bag.kullanici;
        d.kisiler = [{ cihaz: 'demo-k', ad: 'Kamil Gülhan', t: Date.now() }, { cihaz: bag.cihaz, ad: bag.kullanici, t: Date.now() }];
        bag.durdur();
        bag.durumYap('hazir');
      },
    };
  }

  /* ---------------- Başlat ---------------- */
  function calistir(ayar) {
    function Kok() {
      const [, y] = useState(0);
      const tik = () => y((x) => x + 1);
      useEffect(() => { const birak = b.abone(tik); tik(); return birak; }, []);
      useEffect(() => {
        if (!b.depo) return undefined;
        const baslangic = Date.now();
        tik();
        return b.depo.abone(({ yeni }) => {
          tik();
          const uzak = (yeni || []).filter((e) => e.d !== b.cihaz && e.t > baslangic - 5000 && (ayar.uzakKoleksiyonlar || []).includes(e.c));
          if (uzak.length) bildir(`${[...new Set(uzak.map((e) => e.u))].join(', ')} ${uzak.length === 1 ? 'bir değişiklik' : uzak.length + ' değişiklik'} yaptı.`);
        });
      }, [b.depo]);
      const ic = b.durum === 'hazir' && b.depo ? html`<${Iskelet} ayar=${ayar} />`
        : b.durum === 'basliyor' ? html`<div style="display:grid;place-items:center;height:100vh;color:var(--soluk)">Yükleniyor…</div>` : html`<${Kurulum} />`;
      return html`${ic}<${Katman} /><${GlobalKatman} />`;
    }
    render(html`<${Kok} />`, document.getElementById('uygulama'));
    b.baslat();
  }

  NT.kabuk = {
    calistir, ac, sil, yeniNo, excel, sayiYaz, demoTanimla, temaUygula, temaAl,
    Selam, Kart, Cipler, Kpi, Cubuklar, FormAlt, OneriGirdi, AyarKarti, AyarlarSayfasi, Kurulum, TemaDugmesi, Katman,
  };
})();

/* Ülke listesi (Türkçe adlar, tarayıcının kendi çevirisiyle). Kayıtta Türkçe ad saklanır. */
(function () {
  'use strict';
  const NT = window.NT;
  const KODLAR = ('AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ ' +
    'DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH ' +
    'KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA ' +
    'PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG ' +
    'US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW').split(' ');
  let liste;
  NT.kabuk.ulkeler = () => {
    if (!liste) {
      let ad = (k) => k;
      try { const dn = new Intl.DisplayNames(['tr'], { type: 'region' }); ad = (k) => (k === 'XK' ? 'Kosova' : dn.of(k)); } catch { /* eski tarayıcı */ }
      liste = [...new Set(KODLAR.map(ad))].sort(NT.c.trSirala);
    }
    return liste;
  };
})();
