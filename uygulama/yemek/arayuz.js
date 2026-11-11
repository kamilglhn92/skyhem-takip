/* Yemek — arayüz: genel bakış (bugün), takvim, menü (Desbaş resmi), faturalar (ay sonu), ayarlar. */
(function () {
  'use strict';
  const NT = window.NT;
  const cevir = NT.dil.t;
  const { html, useState, useEffect, useMemo, useRef } = window.htmPreact;
  const { Ikon, Modal, Alan, AdetGirdi, BosDurum, Ekler, GecmisBolumu, bildir, onayla, ekAc } = NT.ui;
  const K = NT.kabuk;
  const Y = NT.yemek;
  const T = NT.tatil;
  const M = NT.menuOku;
  const { bugun, sayi, tarihYaz, gunEkle, ara, AYLAR } = NT.c;
  const b = NT.baglanti;
  const depo = () => b.depo;
  K.yazmaKisitla();
  const yaz = K.yazabilir;
  const kisaTarih = (t) => `${+t.slice(8, 10)} ${cevir(AYLAR[+t.slice(5, 7) - 1])}`;
  const ogunYazi = (g) => (g && g.yemekYok ? 'Yemek yok' : Y.OGUNLER.filter((o) => sayi(g && g[o.id]) > 0).map((o) => `${sayi(g[o.id])} ${cevir(o.ad).toLocaleLowerCase(NT.dil.yerel())}`).join(' · ') || '—');

  Object.assign(NT.ui.ALAN_ADLARI, { ogle: 'Öğle', kahvalti: 'Kahvaltı', aksam: 'Akşam', yemekYok: 'Yemek yok', yemekler: 'Menü', eksikBaslangic: 'Eksik gün uyarısı başlangıcı', otoOgle: 'Otomatik öğle sayısı', otoBaslangic: 'Otomatik doldurma başlangıcı', baslangic: 'Başlangıç', bitis: 'Bitiş', faturaNo: 'Fatura no', faturaTarihi: 'Fatura tarihi', ay: 'Dönem', ogun: 'Öğün', kesitler: 'Menü yerleşimi', en: 'Genişlik', boy: 'Yükseklik', ek: 'Menü resmi' });
  NT.ui.DEGER_YAZ.yemekler = (v) => (v || []).join(', ');
  NT.ui.DEGER_YAZ.kesitler = (v) => NT.dil.m('{0} gün', Object.keys(v || {}).length);
  NT.ui.DEGER_YAZ.ek = (v) => (v && v.ad) || 'resim';
  NT.ui.DEGER_YAZ.ay = (v) => Y.ayAdi(v);
  NT.ui.DEGER_YAZ.ogun = (v) => Y.OGUNLER.find((o) => o.id === v)?.ad || v;

  /* ---------------- Menü resminden bir günün kutusu ---------------- */
  function Kesit({ tarih, ogun, genislik = 260 }) {
    const d = depo();
    const k = Y.kesit(d, tarih, ogun);
    const ref = useRef();
    const [hata, setHata] = useState('');
    const anahtar = k ? `${k.menu.ek.dosya}|${k.kutu.join(',')}` : '';
    useEffect(() => {
      if (!k) return undefined;
      let iptal = false;
      setHata('');
      M.kayitliResim(k.menu.ek).then((img) => {
        const cv = ref.current;
        if (iptal || !cv) return;
        const [x, y, w, h] = k.kutu;
        const o = (genislik / w) * (window.devicePixelRatio || 1);
        cv.width = Math.round(w * o); cv.height = Math.round(h * o);
        const cx = cv.getContext('2d');
        cx.imageSmoothingQuality = 'high';
        cx.drawImage(img, x, y, w, h, 0, 0, cv.width, cv.height);
      }).catch(() => !iptal && setHata(cevir("Menü resmi açılamadı.")));
      return () => { iptal = true; };
    }, [anahtar, genislik]);
    if (!k) return null;
    if (hata) return html`<span class="soluk kucuk">${hata}</span>`;
    return html`<canvas ref=${ref} class="ym-kesit" style=${{ width: genislik + 'px', aspectRatio: `${k.kutu[2]} / ${k.kutu[3]}` }} />`;
  }

  /* Bir öğünün menüsü: yazı + (varsa) resimden kesit */
  function MenuKutusu({ tarih, ogun, resim = false, genislik = 240 }) {
    const d = depo();
    const l = Y.yemekler(d, tarih, ogun);
    const k = Y.kesit(d, tarih, ogun);
    const [goster, setGoster] = useState(resim);
    const o = Y.OGUNLER.find((x) => x.id === ogun);
    return html`<div class="ym-menu">
      <div class="ym-menu-bas"><b>${cevir(o.ad)} ${cevir("menüsü")}</b>${k && html`<button type="button" class="d hayalet kucuk-d" onClick=${() => setGoster(!goster)}><${Ikon} ad="goz" boyut=${14} />${goster ? cevir("Yazıyı göster") : cevir("Resmi göster")}</button>`}</div>
      ${goster && k ? html`<${Kesit} tarih=${tarih} ogun=${ogun} genislik=${genislik} />`
        : l.length ? html`<ul class="ym-yemekler">${l.map((x) => html`<li>${x}</li>`)}</ul>` : html`<span class="soluk kucuk">${k ? cevir("Yazıya çevrilmemiş; resmi görün") : cevir("Menü yüklenmemiş")}</span>`}
    </div>`;
  }

  /* ---------------- Gün penceresi: adetler, not, menüler ---------------- */
  function GunPenceresi({ tarih, kapat }) {
    const d = depo();
    const g = Y.gun(d, tarih);
    const on = Y.oneri(d, tarih);
    const [f, setF] = useState(() => (g ? { ogle: g.ogle ?? '', kahvalti: g.kahvalti ?? '', aksam: g.aksam ?? '', notlar: g.notlar || '', yemekYok: !!g.yemekYok }
      : { ogle: T.isGunu(tarih) ? on.ogle : 0, kahvalti: T.isGunu(tarih) ? on.kahvalti : 0, aksam: T.isGunu(tarih) ? on.aksam : 0, notlar: '', yemekYok: false }));
    const [menuler, setMenuler] = useState(() => Object.fromEntries(Y.MENULU.map((o) => [o.id, Y.yemekler(d, tarih, o.id).join('\n')])));
    const [mesgul, setMesgul] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const tatilAd = T.tatil(tarih) || T.yarimGun(tarih);
    async function kaydet() {
      setMesgul(true);
      try {
        const ops = [{ c: 'gun', k: tarih, v: { tarih, ogle: f.yemekYok ? 0 : sayi(f.ogle), kahvalti: f.yemekYok ? 0 : sayi(f.kahvalti), aksam: f.yemekYok ? 0 : sayi(f.aksam), notlar: f.notlar.trim(), yemekYok: f.yemekYok } }];
        for (const o of Y.MENULU) {
          const yeni = M.satirlar(menuler[o.id]);
          if (yeni.join('\n') !== Y.yemekler(d, tarih, o.id).join('\n')) ops.push({ c: 'menugun', k: Y.menuGunAnahtari(tarih, o.id), v: { tarih, ogun: o.id, yemekler: yeni } });
        }
        await d.kaydet(ops);
        bildir(NT.dil.m("{0} kaydedildi · {1}", tarihYaz(tarih), f.yemekYok ? 'yemek yok' : ogunYazi({ ogle: f.ogle, kahvalti: f.kahvalti, aksam: f.aksam })));
        kapat();
      } finally { setMesgul(false); }
    }
    const silFn = async () => (await K.sil('gun', g, NT.dil.m('{0} kaydı', tarihYaz(tarih)))) && kapat();
    return html`<${Modal} genis baslik=${`${tarihYaz(tarih)} · ${Y.gunAdi(tarih)}`} kapat=${kapat} sag=${tatilAd && html`<span class="rozet bilgi">${tatilAd}</span>`}
      alt=${html`<${K.FormAlt} kayit=${g} sil=${silFn} kapat=${kapat} kaydet=${kaydet} mesgul=${mesgul} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <div class="s12 ym-adetler">${Y.OGUNLER.map((o, i) => html`<div class=${'ym-adet' + (f.yemekYok ? ' pasif' : '')}><span>${cevir(o.ad)}</span>
          <${AdetGirdi} deger=${f[o.id]} degis=${s(o.id)} otomatikOdak=${i === 0} /></div>`)}</div>
        ${!g && on.oto && html`<div class="s12 soluk kucuk">${cevir("Bu gün girilmezse otomatik")} <b>${on.ogle} ${cevir("öğle")}</b> ${cevir("sayılır")}${on.kural ? html` ${cevir("(geçici sayı")}${on.kural.notlar ? ': ' + on.kural.notlar : ''})` : cevir(" (Ayarlar › Otomatik doldurma)")}${cevir(". Farklıysa değiştirip kaydedin.")}</div>`}
        ${!g && !on.oto && on.tarih && T.isGunu(tarih) && html`<div class="s12 soluk kucuk">${cevir("Adetler son girilen günden (")}${kisaTarih(on.tarih)}${cevir(") önerildi; değiştirip kaydedin.")}</div>`}
        <label class="s12 ym-onay"><input type="checkbox" checked=${f.yemekYok} onChange=${(e) => s('yemekYok')(e.target.checked)} />${cevir("Bu gün yemek gelmedi (tatil, izin…) — eksik gün sayılmaz")}</label>
        <${Alan} etiket=${cevir("Açıklama")}><input class="girdi" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} placeholder=${cevir("Örn: Bacacılar için +2 sipariş verildi")} /><//>
        <div class="s12 form-bolum">${cevir("Menü")}</div>
        ${Y.MENULU.map((o) => html`<div class="s6 ym-menu-duzen">
          <label>${cevir(o.ad)} ${cevir("menüsü")} <span class="soluk kucuk">${cevir("(her satıra bir yemek)")}</span></label>
          <textarea class="girdi" rows="6" value=${menuler[o.id]} onInput=${(e) => setMenuler((p) => ({ ...p, [o.id]: e.target.value }))} placeholder=${cevir("Menü yüklenmemiş")} />
          <${Kesit} tarih=${tarih} ogun=${o.id} genislik=${300} />
        </div>`)}
        <${GunKafe} tarih=${tarih} />
        <${GecmisBolumu} kayit=${g} />
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const gunAc = (tarih) => K.ac(GunPenceresi, { tarih });

  /* ---------------- Bugün kutusu (genel bakışta, pencere açmadan) ---------------- */
  function BugunKutusu() {
    const d = depo();
    const bg = bugun();
    const g = Y.gun(d, bg);
    const on = Y.oneri(d, bg);
    const bas = () => (g ? { ogle: sayi(g.ogle), kahvalti: sayi(g.kahvalti), aksam: sayi(g.aksam) } : { ogle: on.ogle, kahvalti: on.kahvalti, aksam: on.aksam });
    const [f, setF] = useState(bas);
    // Kayıt başka yerden değişirse ya da otomatik sayı değişirse (geçici sayı, ayar) kutu yenilenir.
    const anahtar = `${g ? g._degisim : 0}|${on.ogle}`;
    const [surum, setSurum] = useState(anahtar);
    if (anahtar !== surum) { setSurum(anahtar); setF(bas()); }
    const [mesgul, setMesgul] = useState(false);
    const kayitli = Y.girildiMi(g);
    const degisti = !kayitli || Y.OGUNLER.some((o) => sayi(f[o.id]) !== sayi(g[o.id]));
    const isGunu = T.isGunu(bg);
    async function kaydet() {
      setMesgul(true);
      try {
        await d.kaydet([{ c: 'gun', k: bg, v: { tarih: bg, ogle: sayi(f.ogle), kahvalti: sayi(f.kahvalti), aksam: sayi(f.aksam), yemekYok: false } }]);
        bildir(NT.dil.m("Bugün kaydedildi · {0}", ogunYazi(f)));
      } finally { setMesgul(false); }
    }
    return html`<${K.Kart} baslik=${`${cevir('Bugün')} · ${tarihYaz(bg)} ${Y.gunAdi(bg)}`} sinif="ym-bugun"
      sag=${kayitli ? html`<span class="rozet iyi"><${Ikon} ad="daire_tik" />${cevir("Girildi")}</span>` : on.oto ? html`<span class="rozet bilgi"><${Ikon} ad="senkron" />${cevir("Otomatik")}</span>`
        : html`<span class=${'rozet ' + (isGunu ? 'kritik' : '')}>${isGunu ? cevir("Girilmedi") : T.tatil(bg) || cevir("Hafta sonu")}</span>`}>
      <div class="ym-adetler">${Y.OGUNLER.map((o) => html`<div class="ym-adet"><span>${cevir(o.ad)}</span><${AdetGirdi} deger=${f[o.id]} degis=${(v) => setF((p) => ({ ...p, [o.id]: v }))} /></div>`)}</div>
      <div class="ym-bugun-alt">
        <span class="soluk kucuk">${kayitli ? `${g._degistiren} · ${NT.c.onceYaz(g._degisim)}`
          : on.oto ? NT.dil.m('Girilmezse otomatik {0} öğle sayılır{1}. Farklıysa değiştirip kaydedin.', on.ogle, on.kural?.notlar ? ` (${on.kural.notlar})` : '')
          : on.tarih ? NT.dil.m("Son girilen günden ({0}) önerildi", kisaTarih(on.tarih)) : ''}</span>
        <span style="flex:1" />
        <button class="d hayalet kucuk-d" onClick=${() => gunAc(bg)}><${Ikon} ad="kalem" boyut=${15} />${cevir("Ayrıntı")}</button>
        ${yaz() && html`<button class="d ana-d" disabled=${mesgul || (kayitli && !degisti)} onClick=${kaydet}><${Ikon} ad="tik" />${kayitli ? cevir("Güncelle") : cevir("Kaydet")}</button>`}
      </div>
    <//>`;
  }

  /* ---------------- Geçici sayı: belirli iş günlerinde otomatik öğle sayısı farklı (örn. biri yıllık izinde: 8) ---------------- */
  const aralikYaz = (k) => (k.baslangic === k.bitis ? kisaTarih(k.baslangic) : `${kisaTarih(k.baslangic)} – ${kisaTarih(k.bitis)}`);
  function OtoPenceresi({ kayit, kapat }) {
    const d = depo();
    const a = Y.ayar(d);
    const ilk = T.isGunu(bugun()) ? bugun() : Y.sonrakiIsGunu(bugun());
    const [f, setF] = useState(() => (kayit ? { baslangic: kayit.baslangic, gun: Y.isGunuSay(kayit.baslangic, kayit.bitis), ogle: kayit.ogle, notlar: kayit.notlar || '' }
      : { baslangic: ilk, gun: 5, ogle: Math.max(0, sayi(a.otoOgle) - 1), notlar: '' }));
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const n = Math.max(1, sayi(f.gun) || 1);
    const bitis = f.baslangic ? Y.isGunuSonu(f.baslangic, n) : '';
    const hata = !f.baslangic ? 'Başlangıç tarihi seçin' : !(sayi(f.gun) > 0) ? 'Kaç iş günü olduğunu yazın' : '';
    const cakisan = Y.otoKurallar(d).filter((k) => k.id !== kayit?.id && k.baslangic <= bitis && f.baslangic <= k.bitis);
    async function kaydet() {
      if (hata) return;
      const v = { baslangic: f.baslangic, bitis, ogle: sayi(f.ogle), notlar: f.notlar.trim() };
      await d.kaydet([{ c: 'oto', k: kayit ? kayit.id : NT.c.uid(), v }]);
      bildir(NT.dil.m("{0} ({1} iş günü): öğle {2}", aralikYaz(v), n, v.ogle));
      kapat();
    }
    const silFn = async () => (await K.sil('oto', kayit, NT.dil.m('{0} geçici sayısı', aralikYaz(kayit)))) && kapat();
    return html`<${Modal} baslik=${kayit ? cevir("Geçici sayı") : cevir("Geçici yemek sayısı")} kapat=${kapat} alt=${html`<${K.FormAlt} kayit=${kayit} sil=${silFn} kapat=${kapat} kaydet=${kaydet} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <p class="s12 soluk" style="margin:0">${cevir("Normalde her iş gününe otomatik")} <b>${sayi(a.otoOgle)}</b> ${cevir("öğle sayılır. Biri izne çıktığında o günler için farklı sayı girin; süre bitince kendiliğinden")} ${sayi(a.otoOgle)}${cevir("’a döner. Elle girilen günler değişmez.")}</p>
        <${Alan} etiket=${cevir("Başlangıç")} sinif="s4"><input class="girdi" type="date" value=${f.baslangic} onInput=${(e) => s('baslangic')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Kaç iş günü")} sinif="s4" ipucu=${bitis ? NT.dil.m("Bitiş: {0} {1}", tarihYaz(bitis), Y.gunAdi(bitis)) : ''}><${AdetGirdi} deger=${f.gun} degis=${s('gun')} min=${1} /><//>
        <${Alan} etiket=${cevir("Öğle sayısı")} sinif="s4"><${AdetGirdi} deger=${f.ogle} degis=${s('ogle')} min=${0} /><//>
        <${Alan} etiket=${cevir("Açıklama")}><input class="girdi" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} placeholder=${cevir("Örn: Onur yıllık izinde")} /><//>
        ${hata && html`<div class="s12 hata-yazi">${hata}</div>`}
        ${cakisan.length > 0 && html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${cevir("Bu tarihlerde başka bir geçici sayı da var (")}${cakisan.map((k) => `${aralikYaz(k)}: ${k.ogle}`).join(', ')}${cevir("). Çakışan günlerde son girilen geçerli olur; iki kişi birden izindeyse sayıyı buna göre yazın.")}</span></div>`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const otoAc = (kayit) => K.ac(OtoPenceresi, { kayit });
  /* Genel bakışta: süren ve gelecekteki geçici sayılar. */
  function OtoKarti() {
    const d = depo();
    const bg = bugun();
    const l = Y.otoKurallar(d).filter((k) => k.bitis >= bg).sort((x, y) => (x.baslangic < y.baslangic ? -1 : 1));
    if (!l.length) return null;
    return html`<${K.Kart} baslik=${cevir("Geçici yemek sayıları")} sag=${html`${yaz() && html`<button class="d hayalet kucuk-d" onClick=${() => otoAc()}><${Ikon} ad="arti" boyut=${15} />${cevir("Ekle")}</button>`}`}>
      <div class="ym-kafe-liste">${l.map((k) => html`<button type="button" class="ym-kafe-satir" onClick=${() => otoAc(k)}>
        <${Ikon} ad="takvim" boyut=${16} /><b>${cevir("Öğle")} ${k.ogle}</b><span class="soluk">${aralikYaz(k)} · ${Y.isGunuSay(k.baslangic, k.bitis)} ${cevir("iş günü")}${k.notlar ? ' · ' + k.notlar : ''}</span>
        <span class="sag">${k.baslangic <= bg ? html`<span class="rozet bilgi">${cevir("Sürüyor")}</span>` : html`<span class="soluk kucuk">${cevir("Başlamadı")}</span>`}</span></button>`)}</div>
    <//>`;
  }

  /* ---------------- Menü yükleme (Desbaş resmi → her güne) ---------------- */
  function varsayilanAy() { const bg = bugun(); return +bg.slice(8, 10) >= 20 ? Y.ayKaydir(bg.slice(0, 7), 1) : bg.slice(0, 7); }
  function MenuParcasi({ x, degis }) {
    const esle = useMemo(() => M.gunlereEsle(x.c, x.ay), [x.c, x.ay]);
    const resim = useMemo(() => M.onizleme(x.c, esle.kesitler), [x.c, esle]);
    useEffect(() => { degis({ esle }); }, [esle]);
    return html`<div class="ym-yukle-parca">
      <img src=${resim} alt=${cevir("Menü önizlemesi")} onClick=${() => window.open(resim, '_blank')} />
      <div class="ym-yukle-bilgi">
        <b>${x.c.dosya.name}</b>
        <div class="form-izgara">
          <${Alan} etiket=${cevir("Öğün")} sinif="s6"><div class="secenekler">${Y.MENULU.map((o) => html`<button type="button" class=${'secenek' + (x.ogun === o.id ? ' secili' : '')} onClick=${() => degis({ ogun: o.id })}>${cevir(o.ad)}</button>`)}</div><//>
          <${Alan} etiket=${cevir("Ay")} sinif="s6"><input class="girdi" type="month" value=${x.ay} onInput=${(e) => e.target.value && degis({ ay: e.target.value })} /><//>
        </div>
        ${esle.hata ? html`<div class="uyari-kutu yok"><${Ikon} ad="uyari" /><span>${esle.hata}</span></div>`
          : html`<div class=${'uyari-kutu ' + (esle.uyari ? 'kritik' : 'iyi')}><${Ikon} ad=${esle.uyari ? 'uyari' : 'daire_tik'} /><span>${esle.uyari || NT.dil.m("{0} günün menüsü bulundu. Mavi kutular ve numaralar doğru günlere denk geliyorsa devam edin.", Object.keys(esle.kesitler).length)}</span></div>`}
        ${x.c.ocrHata && html`<div class="uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${cevir("Yazı tanıma çalışmadı (")}${x.c.ocrHata}${cevir("). Menü yine her güne resim olarak yerleştirilir; ayı ve öğünü kendiniz seçin.")}</span></div>`}
      </div>
    </div>`;
  }
  function MenuYukle({ kapat, bitince }) {
    const d = depo();
    const [parcalar, setParcalar] = useState([]);
    const [mesaj, setMesaj] = useState('');
    const [mesgul, setMesgul] = useState(false);
    const girdi = useRef();
    const guncelle = (i) => (v) => setParcalar((l) => l.map((x, j) => (j === i ? { ...x, ...v } : x)));
    async function sec(e) {
      const dosyalar = [...e.target.files];
      e.target.value = '';
      if (!dosyalar.length) return;
      setMesgul(true);
      try {
        for (const dosya of dosyalar) {
          setMesaj(`${dosya.name} inceleniyor…`);
          const c = await M.cozumle(dosya, setMesaj);
          setParcalar((l) => [...l, { c, ay: c.ay || varsayilanAy(), ogun: c.ogun, esle: null }]);
        }
      } catch (err) { bildir(err.message, { tur: 'hata' }); }
      finally { setMesaj(''); setMesgul(false); }
    }
    const hazir = parcalar.length > 0 && parcalar.every((x) => x.esle && !x.esle.hata);
    const cakisan = parcalar.some((x, i) => parcalar.some((y, j) => j !== i && y.ay === x.ay && y.ogun === x.ogun));
    async function kaydet() {
      const var_ = parcalar.filter((x) => Y.menu(d, x.ay, x.ogun) || Y.ayGunleri(x.ay).some((t) => Y.yemekler(d, t, x.ogun).length));
      if (var_.length && !(await onayla(NT.dil.m("{0} menüsü zaten var. Yenisiyle değiştirilsin mi? (Elle yaptığınız düzeltmeler de yenisiyle değişir.)", var_.map((x) => `${Y.ayAdi(x.ay)} ${x.ogun === 'aksam' ? 'akşam' : 'öğle'}`).join(', ')), { baslik: cevir("Menü değiştirilsin mi?"), evet: cevir("Değiştir") }))) return;
      setMesgul(true);
      try {
        const ops = [];
        let okunamayan = 0;
        for (const x of parcalar) {
          const ad = `${Y.ayAdi(x.ay)} ${x.ogun === 'aksam' ? 'akşam' : 'öğle'}`;
          setMesaj(`${ad}: resim kaydediliyor…`);
          const ek = await d.ekYaz(x.c.dosya);
          let metin = {};
          try { metin = await M.yaziyaCevir(x.c, (m) => setMesaj(`${ad}: ${m}`)); } catch (e) { okunamayan++; console.error(e); }
          ops.push({ c: 'menu', k: Y.menuAnahtari(x.ay, x.ogun), v: { ay: x.ay, ogun: x.ogun, ek, en: x.c.en, boy: x.c.boy, kesitler: x.esle.kesitler } });
          for (const gg of Object.keys(x.esle.kesitler)) {
            const tarih = `${x.ay}-${gg}`;
            ops.push({ c: 'menugun', k: Y.menuGunAnahtari(tarih, x.ogun), v: { tarih, ogun: x.ogun, yemekler: metin[gg] || [] } });
          }
        }
        setMesaj('Kaydediliyor…');
        await d.kaydet(ops);
        await M.kapat();
        bildir(okunamayan ? cevir("Menü günlere resim olarak yerleştirildi; yazıya çevrilemedi (internet?). Günlere tıklayıp yazabilirsiniz.") : NT.dil.m("Menü her güne yerleştirildi ({0}). Yazı tanıma hatası görürseniz güne tıklayıp düzeltin.", parcalar.map((x) => `${Y.ayAdi(x.ay)} ${x.ogun === 'aksam' ? 'akşam' : 'öğle'}`).join(', ')), { sure: 7000 });
        kapat();
        bitince && bitince(parcalar[0].ay);
      } catch (e) { console.error(e); bildir(cevir('Menü kaydedilemedi', 'The menu could not be saved') + ': ' + e.message, { tur: 'hata' }); }
      finally { setMesgul(false); setMesaj(''); }
    }
    return html`<${Modal} genis baslik=${cevir("Menü yükle")} kapat=${() => { M.kapat(); kapat(); }}
      alt=${html`${mesaj && html`<div class="sol ym-ilerleme"><span class="ym-donen" />${mesaj}</div>`}
        <button class="d hayalet" onClick=${() => { M.kapat(); kapat(); }}>${cevir("Vazgeç")}</button>
        <button class="d ana-d" disabled=${mesgul || !hazir || cakisan} onClick=${kaydet}><${Ikon} ad="tik" />${cevir("Yazıya çevir ve günlere yerleştir")}</button>`}>
      <div class="modal-ic">
        <p style="margin:0 0 12px">${cevir("Desbaş’ın gönderdiği menü resimlerini seçin (öğle ve akşam birlikte seçilebilir). Program takvimi bulur, ayı ve öğünü başlıktan okur, her günün menüsünü o güne yerleştirir.")}</p>
        ${parcalar.map((x, i) => html`<${MenuParcasi} key=${i} x=${x} degis=${guncelle(i)} />`)}
        ${cakisan && html`<div class="uyari-kutu yok" style="margin-bottom:12px"><${Ikon} ad="uyari" /><span>${cevir("Aynı ay ve öğün için iki resim seçildi; birinin öğününü değiştirin.")}</span></div>`}
        <button type="button" class="d" disabled=${mesgul} onClick=${() => girdi.current.click()}><${Ikon} ad="yukle" />${parcalar.length ? cevir("Başka resim ekle") : cevir("Menü resmi seç")}</button>
        <input ref=${girdi} type="file" accept="image/*" multiple class="gizli" onChange=${sec} />
      </div>
    <//>`;
  }
  const menuYukle = (bitince) => K.ac(MenuYukle, { bitince });

  /* ---------------- Ay sonu: Desbaş faturası ---------------- */
  function FaturaPenceresi({ ay, kapat }) {
    const d = depo();
    const x = Y.ayOzet(d, ay);
    const fk = x.fatura;
    const [f, setF] = useState(() => ({ ogle: fk?.ogle ?? '', kahvalti: fk?.kahvalti ?? '', aksam: fk?.aksam ?? '', faturaNo: fk?.faturaNo || '', faturaTarihi: fk?.faturaTarihi || '', notlar: fk?.notlar || '', ekler: fk?.ekler || [] }));
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const eksik = Y.eksikGunler(d, ay);
    async function kaydet() {
      const v = { ay, faturaNo: f.faturaNo.trim(), faturaTarihi: f.faturaTarihi, notlar: f.notlar, ekler: f.ekler };
      for (const o of Y.OGUNLER) v[o.id] = String(f[o.id]).trim() === '' ? '' : sayi(f[o.id]);
      await d.kaydet([{ c: 'fatura', k: Y.faturaAnahtari(ay), v }]);
      const farklar = Y.OGUNLER.filter((o) => v[o.id] !== '' && v[o.id] !== x.adet[o.id]);
      bildir(farklar.length ? `${Y.ayAdi(ay)}: ${farklar.map((o) => NT.dil.m('{0} faturada {1}, bizde {2}', cevir(o.ad), v[o.id], x.adet[o.id])).join(' · ')}` : NT.dil.m('{0} faturası kaydedildi', Y.ayAdi(ay)) + (Y.OGUNLER.some((o) => v[o.id] !== '') ? ' · ' + cevir('adetler tutuyor', 'counts match') : '') + '.', farklar.length ? { tur: 'hata', sure: 7000 } : {});
      kapat();
    }
    return html`<${Modal} baslik=${`${Y.ayAdi(ay)} · ${cevir('Desbaş faturası', 'Desbaş invoice')}`} kapat=${kapat}
      alt=${html`<${K.FormAlt} kayit=${fk} sil=${async () => (await K.sil('fatura', fk, NT.dil.m('{0} faturası', Y.ayAdi(ay)))) && kapat()} kapat=${kapat} kaydet=${kaydet} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <div class="s12 soluk">${cevir("Faturadaki öğün adetlerini yazın; bizim saydıklarımızla karşılaştırılır.")}</div>
        ${Y.OGUNLER.map((o, i) => {
          const girildi = String(f[o.id]).trim() !== '';
          const fark = girildi ? sayi(f[o.id]) - x.adet[o.id] : 0;
          return html`<${Alan} etiket=${NT.dil.m("{0} (bizde {1})", o.ad, x.adet[o.id])} sinif="s4" hata=${girildi && fark !== 0 ? `Fatura ${Math.abs(fark)} ${fark > 0 ? 'fazla' : 'eksik'}` : ''} ipucu=${girildi && fark === 0 ? cevir("Tutuyor ✓") : ''}>
            <input class="girdi sayi" inputmode="numeric" value=${f[o.id]} onInput=${(e) => s(o.id)(e.target.value)} placeholder=${String(x.adet[o.id])} autofocus=${i === 0} /><//>`;
        })}
        ${eksik.length > 0 && html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${cevir("Bu ayda")} ${eksik.length} ${cevir("iş günü girilmemiş (")}${eksik.slice(0, 6).map(kisaTarih).join(', ')}${eksik.length > 6 ? '…' : ''}${cevir("); karşılaştırma eksik olabilir.")}</span></div>`}
        <${Alan} etiket=${cevir("Fatura no")} sinif="s6"><input class="girdi mono" value=${f.faturaNo} onInput=${(e) => s('faturaNo')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Fatura tarihi")} sinif="s6"><input class="girdi" type="date" value=${f.faturaTarihi} onInput=${(e) => s('faturaTarihi')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Not")}><input class="girdi" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Ekler")} ipucu=${cevir("Fatura PDF’i veya fotoğrafı (en fazla 8 MB)")}><${Ekler} ekler=${f.ekler} degis=${s('ekler')} /><//>
        ${fk && html`<${GecmisBolumu} kayit=${fk} />`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const faturaAc = (ay) => K.ac(FaturaPenceresi, { ay });
  function KontrolRozeti({ x }) {
    const gecenAy = Y.ayKaydir(bugun().slice(0, 7), -1);
    if (x.kontrol === 'esit') return html`<span class="rozet iyi"><${Ikon} ad="daire_tik" />${cevir("Tutuyor")}</span>`;
    if (x.kontrol === 'fark') return html`<span class="rozet yok"><${Ikon} ad="uyari" />${cevir("Fark var")}</span>`;
    if (x.kontrol === 'bekliyor') return x.ay === bugun().slice(0, 7) ? html`<span class="rozet bilgi"><${Ikon} ad="saat" />${cevir("Ay sürüyor")}</span>`
      : x.ay === gecenAy ? html`<span class="rozet kritik"><${Ikon} ad="fatura" />${cevir("Fatura bekleniyor")}</span>` : html`<span class="soluk kucuk">${cevir("Fatura girilmedi")}</span>`;
    return html`<span class="soluk">—</span>`;
  }

  /* ---------------- Desbaş Kafe: menü dışı siparişler ---------------- */
  const tl = (n) => `${K.sayiYaz(n, Math.abs(n - Math.round(n)) > 0.004 ? 2 : 0)} ₺`;
  const tlSayi = (v) => sayi(String(v).replace(/\.(?=\d{3}(\D|$))/g, '')); // binlik noktası atılır: "1.250,50" → 1250,5; "12.5" → 12,5
  const kafeYazi = (k) => `${sayi(k.adet) > 1 ? sayi(k.adet) + '× ' : ''}${k.urun || 'Sipariş'}`;

  /* Kişi seçimi: önceki adlar dokunmatik çip; yeni ad yazılıp Enter ile eklenir. */
  function KisiSecici({ secili, degis, oneriler }) {
    const [yazi, setYazi] = useState('');
    const ekle = (ad) => { const a = ad.trim().replace(/\s+/g, ' '); if (a && !secili.some((x) => x.toLocaleLowerCase('tr') === a.toLocaleLowerCase('tr'))) degis([...secili, a]); setYazi(''); };
    const digerleri = oneriler.filter((a) => !secili.includes(a)).slice(0, 10);
    return html`<div class="ym-kisi-sec">
      <div class="secenekler">
        ${secili.map((a) => html`<button type="button" class="secenek secili" onClick=${() => degis(secili.filter((x) => x !== a))} title=${cevir("Çıkar")}>${a} ×</button>`)}
        ${digerleri.map((a) => html`<button type="button" class="secenek" onClick=${() => ekle(a)}>+ ${a}</button>`)}
      </div>
      <input class="girdi" value=${yazi} placeholder=${secili.length ? cevir("Başka kişi ekle (yazıp Enter)") : cevir("Kim söyledi? (yazıp Enter)")} onInput=${(e) => setYazi(e.target.value)}
        onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); ekle(yazi); } }} onBlur=${() => yazi.trim() && ekle(yazi)} />
    </div>`;
  }

  function KafePenceresi({ kayit, tarih, kapat }) {
    const d = depo();
    const on = Y.kafeOnerileri(d);
    const [f, setF] = useState(() => (kayit ? { tarih: kayit.tarih, kisiler: kayit.kisiler || [], urun: kayit.urun || '', adet: sayi(kayit.adet) || 1, tutar: kayit.tutar !== '' && kayit.tutar != null ? String(kayit.tutar).replace('.', ',') : '', notlar: kayit.notlar || '', ekler: kayit.ekler || [] }
      : { tarih: tarih || bugun(), kisiler: [], urun: '', adet: 1, tutar: '', notlar: '', ekler: [] }));
    const [tutarElle, setTutarElle] = useState(!!kayit);
    const [denendi, setDenendi] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    // Ürünün daha önceki birim fiyatı varsa tutar önerilir (elle yazılınca öneri durur).
    const birim = Y.kafeBirimFiyat(d, f.urun);
    useEffect(() => { if (!tutarElle && birim > 0) setF((p) => ({ ...p, tutar: K.sayiYaz(birim * (sayi(p.adet) || 1), 2).replace(/\./g, '') })); }, [f.urun, f.adet, birim]);
    const hata = !f.urun.trim() ? 'Ne söylendiğini yazın' : !f.kisiler.length ? 'Kimin söylediğini seçin' : !(sayi(f.adet) > 0) ? 'Adet yazın' : '';
    async function kaydet() {
      setDenendi(true);
      if (hata || !f.tarih) return;
      const v = { tarih: f.tarih, kisiler: f.kisiler, urun: f.urun.trim(), adet: sayi(f.adet), tutar: String(f.tutar).trim() === '' ? '' : tlSayi(f.tutar), notlar: f.notlar.trim(), ekler: f.ekler };
      await d.kaydet([{ c: 'kafe', k: kayit ? kayit.id : NT.c.uid(), v }]);
      bildir(`${kayit ? cevir('Kafe siparişi güncellendi', 'Café order updated') : cevir('Kafe siparişi kaydedildi', 'Café order saved')} · ${kafeYazi(v)} · ${v.kisiler.join(', ')}${v.tutar !== '' ? ' · ' + tl(v.tutar) : ''}`);
      kapat();
    }
    return html`<${Modal} baslik=${kayit ? cevir("Kafe siparişi") : cevir("Desbaş Kafe siparişi")} kapat=${kapat}
      alt=${html`<${K.FormAlt} kayit=${kayit} sil=${async () => (await K.sil('kafe', kayit, `${tarihYaz(kayit.tarih)} ${kafeYazi(kayit)}`)) && kapat()} kapat=${kapat} kaydet=${kaydet} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <div class="s12 soluk">${cevir("Menü dışında Desbaş Kafe’den ayrıca söylenenler. Öğün sayılarına karışmaz; ay sonunda kafe faturasıyla karşılaştırılır.")}</div>
        <${Alan} etiket=${cevir("Kim(ler) söyledi")} hata=${denendi && !f.kisiler.length ? 'Kimin söylediğini seçin' : ''} ipucu=${cevir("Birden fazla kişi seçilebilir; tutar kişilere eşit bölünür")}><${KisiSecici} secili=${f.kisiler} degis=${s('kisiler')} oneriler=${on.kisiler} /><//>
        <${Alan} etiket=${cevir("Ne söylendi")} sinif="s8" hata=${denendi && !f.urun.trim() ? 'Ne söylendiğini yazın' : ''}><input class="girdi" list="ym-kafe-urun" value=${f.urun} onInput=${(e) => s('urun')(e.target.value)} placeholder=${cevir("Örn: Kaşarlı tost + ayran")} autofocus=${!kayit} /><${NT.ui.Oneri} id="ym-kafe-urun" liste=${on.urunler} /><//>
        <${Alan} etiket=${cevir("Adet")} sinif="s4"><${AdetGirdi} deger=${f.adet} degis=${s('adet')} min=${1} /><//>
        <${Alan} etiket=${cevir("Tarih")} sinif="s4"><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih')(e.target.value)} /><//>
        <${Alan} etiket="Tutar (₺, isteğe bağlı)" sinif="s4" ipucu=${!tutarElle && birim > 0 ? NT.dil.m("Önceki fiyattan önerildi ({0} / adet)", tl(birim)) : cevir("Siparişin toplamı")}><input class="girdi sayi" inputmode="decimal" value=${f.tutar} onInput=${(e) => { setTutarElle(true); s('tutar')(e.target.value); }} placeholder=${cevir("Bilinmiyorsa boş")} /><//>
        <${Alan} etiket=${cevir("Not")} sinif="s4"><input class="girdi" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} placeholder=${cevir("Örn: Mesai")} /><//>
        <${Alan} etiket=${cevir("Fiş")} ipucu=${cevir("Fiş fotoğrafı (isteğe bağlı)")}><${Ekler} ekler=${f.ekler} degis=${s('ekler')} /><//>
        ${kayit && html`<${GecmisBolumu} kayit=${kayit} />`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const kafeAc = (kayit) => K.ac(KafePenceresi, { kayit });
  const yeniKafe = (tarih) => K.ac(KafePenceresi, { tarih });

  function KafeFaturaPenceresi({ ay, kapat }) {
    const d = depo();
    const x = Y.kafeOzet(d, ay);
    const fk = x.fatura;
    const [f, setF] = useState(() => ({ tutar: fk && fk.tutar !== '' && fk.tutar != null ? String(fk.tutar).replace('.', ',') : '', faturaNo: fk?.faturaNo || '', faturaTarihi: fk?.faturaTarihi || '', notlar: fk?.notlar || '', ekler: fk?.ekler || [] }));
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const girildi = String(f.tutar).trim() !== '';
    const fark = girildi ? tlSayi(f.tutar) - x.tutar : 0;
    async function kaydet() {
      await d.kaydet([{ c: 'kafefatura', k: Y.faturaAnahtari(ay), v: { ay, tutar: girildi ? tlSayi(f.tutar) : '', faturaNo: f.faturaNo.trim(), faturaTarihi: f.faturaTarihi, notlar: f.notlar, ekler: f.ekler } }]);
      bildir(!girildi ? cevir("Kaydedildi.") : Math.abs(fark) < 0.01 ? NT.dil.m("{0} kafe faturası tutuyor.", Y.ayAdi(ay)) : NT.dil.m('{0} kafe faturası bizim kayıtlardan {1} {2}.', Y.ayAdi(ay), tl(Math.abs(fark)), fark > 0 ? cevir('fazla', 'higher') : cevir('eksik', 'lower')), girildi && Math.abs(fark) >= 0.01 ? { tur: 'hata', sure: 7000 } : {});
      kapat();
    }
    return html`<${Modal} baslik=${`${Y.ayAdi(ay)} · ${cevir('Desbaş Kafe faturası', 'Desbaş Café invoice')}`} kapat=${kapat}
      alt=${html`<${K.FormAlt} kayit=${fk} sil=${async () => (await K.sil('kafefatura', fk, NT.dil.m('{0} kafe faturası', Y.ayAdi(ay)))) && kapat()} kapat=${kapat} kaydet=${kaydet} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <div class="s12 ym-serit"><div><small>${cevir("Bizim kayıtlar")}</small><b>${tl(x.tutar)}</b><span>${x.siparis} ${cevir("sipariş ·")} ${K.sayiYaz(x.adet)} ${cevir("adet")}</span></div></div>
        ${x.tutarsiz > 0 && html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${x.tutarsiz} ${cevir("siparişin tutarı girilmemiş; karşılaştırma eksik olur. Kafe sayfasında o siparişlere tutar yazın.")}</span></div>`}
        <${Alan} etiket=${cevir("Fatura tutarı (₺)")} sinif="s6" hata=${girildi && Math.abs(fark) >= 0.01 ? `Fatura ${tl(Math.abs(fark))} ${fark > 0 ? 'fazla' : 'eksik'}` : ''} ipucu=${girildi && Math.abs(fark) < 0.01 ? cevir("Tutuyor ✓") : ''}>
          <input class="girdi sayi" inputmode="decimal" value=${f.tutar} onInput=${(e) => s('tutar')(e.target.value)} autofocus placeholder=${K.sayiYaz(x.tutar, 2)} /><//>
        <${Alan} etiket=${cevir("Fatura / fiş no")} sinif="s6"><input class="girdi mono" value=${f.faturaNo} onInput=${(e) => s('faturaNo')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Fatura tarihi")} sinif="s6"><input class="girdi" type="date" value=${f.faturaTarihi} onInput=${(e) => s('faturaTarihi')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Not")} sinif="s6"><input class="girdi" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Ekler")}><${Ekler} ekler=${f.ekler} degis=${s('ekler')} /><//>
        ${fk && html`<${GecmisBolumu} kayit=${fk} />`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const kafeFaturaAc = (ay) => K.ac(KafeFaturaPenceresi, { ay });

  /* Bir günün kafe siparişleri (gün penceresinde) */
  function GunKafe({ tarih }) {
    const l = Y.kafeler(depo(), tarih);
    return html`<div class="s12 form-bolum">${cevir("Desbaş Kafe")} <span class="soluk" style="font-weight:500;text-transform:none;letter-spacing:0">${cevir("· menü dışı siparişler")}</span></div>
      <div class="s12">${l.length ? html`<div class="ym-kafe-liste">${l.map((k) => html`<button type="button" class="ym-kafe-satir" onClick=${() => kafeAc(k)}>
          <${Ikon} ad="kahve" boyut=${16} /><b>${kafeYazi(k)}</b><span class="soluk">${(k.kisiler || []).join(', ')}</span><span class="sag">${k.tutar !== '' && k.tutar != null ? tl(sayi(k.tutar)) : ''}</span></button>`)}</div>` : ''}
        ${yaz() && html`<button type="button" class="d kucuk-d" style="margin-top:${l.length ? 8 : 0}px" onClick=${() => yeniKafe(tarih)}><${Ikon} ad="arti" boyut=${15} />${cevir("Kafe siparişi ekle")}</button>`}</div>`;
  }

  function KafeSayfasi() {
    const d = depo();
    const [ay, setAy] = useState(bugun().slice(0, 7));
    const x = Y.kafeOzet(d, ay);
    return html`<${K.Selam} baslik=${cevir("Desbaş Kafe")} sag=${html`<button class="d" onClick=${() => excelKafe(x)}><${Ikon} ad="indir" boyut=${15} />Excel</button>
        ${yaz() && html`<button class="d ana-d tz-buyuk" onClick=${() => yeniKafe(ay === bugun().slice(0, 7) ? bugun() : `${ay}-01`)}><${Ikon} ad="arti" />${cevir("Kafe siparişi")}</button>`}`}>
        ${cevir("Menü dışında Desbaş Kafe’den kişilerin ayrıca söylediği yemekler. Öğün sayılarına karışmaz; ay sonunda kafe faturasıyla karşılaştırılır.")}<//>
      <${AySecici} ay=${ay} setAy=${setAy} />
      <div class="kpi-sira">
        <${K.Kpi} vurgu ikon="kahve" ad="Sipariş" deger=${x.siparis} alt=${NT.dil.m("{0} adet", K.sayiYaz(x.adet))} />
        <${K.Kpi} ikon="fatura" ad="Tutar" deger=${tl(x.tutar)} alt=${x.tutarsiz ? NT.dil.m("{0} siparişin tutarı yok", x.tutarsiz) : cevir("Bütün tutarlar girildi")} />
        <${K.Kpi} ikon="kisi" ad="Kişi" deger=${x.kisiler.length} alt=${x.kisiler.slice(0, 3).map((k) => k.ad).join(', ') || '—'} />
        <${K.Kpi} ikon="tik" ad="Kafe faturası" deger=${x.faturaVar ? tl(sayi(x.fatura.tutar)) : '—'} alt=${x.kontrol === 'esit' ? cevir("Tutuyor") : x.kontrol === 'fark' ? NT.dil.m("Fark {0}", tl(Math.abs(x.fark))) : x.siparis ? cevir("Girilmedi") : ''} />
      </div>
      <div class="tz-izgara">
        <${K.Kart} baslik=${cevir("Siparişler")} sag=${html`<button class="d kucuk-d" onClick=${() => kafeFaturaAc(ay)}><${Ikon} ad="fatura" boyut=${15} />${cevir("Kafe faturası")}</button>`}>
          ${x.liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>${cevir("Tarih")}</th><th>${cevir("Ne")}</th><th>${cevir("Kim")}</th><th class="sag">${cevir("Adet")}</th><th class="sag">${cevir("Tutar")}</th><th></th></tr></thead><tbody>
            ${x.liste.map((k) => html`<tr class="tik" onClick=${() => kafeAc(k)}><td>${kisaTarih(k.tarih)} <span class="soluk kucuk">${Y.gunAdi(k.tarih).slice(0, 3)}</span></td><td>${k.urun}${k.notlar ? html`<div class="soluk kucuk">${k.notlar}</div>` : ''}</td>
              <td>${(k.kisiler || []).join(', ')}</td><td class="sag sayi">${sayi(k.adet)}</td><td class="sag sayi">${k.tutar !== '' && k.tutar != null ? tl(sayi(k.tutar)) : html`<span class="soluk">—</span>`}</td>
              <td>${(k.ekler || []).length > 0 && html`<${Ikon} ad="etiket" boyut=${14} />`}</td></tr>`)}
            <tr><td colspan="3"><b>${cevir("Toplam")}</b></td><td class="sag sayi"><b>${K.sayiYaz(x.adet)}</b></td><td class="sag sayi"><b>${tl(x.tutar)}</b></td><td></td></tr>
          </tbody></table></div>` : html`<p class="soluk" style="margin:0">${cevir("Bu ay kafe siparişi yok.")}</p>`}
        <//>
        <${K.Kart} baslik=${cevir("Kişi başı")}>
          ${x.kisiler.length ? html`${x.kisiler.map((k) => html`<div class="ym-kisi-satir"><span>${k.ad}<small>${k.siparis} ${cevir("sipariş ·")} ${K.sayiYaz(k.adet, Number.isInteger(k.adet) ? 0 : 1)} ${cevir("adet")}</small></span><b>${k.tutar ? tl(k.tutar) : '—'}</b></div>`)}
            <p class="soluk kucuk" style="margin:10px 0 0">${cevir("Birden fazla kişinin söylediği siparişin tutarı kişilere eşit bölünür.")}</p>` : html`<p class="soluk" style="margin:0">—</p>`}
        <//>
      </div>`;
  }
  function excelKafe(x) {
    K.excel(`desbas-kafe-${x.ay}.xlsx`, { sayfa: `Kafe ${Y.ayAdi(x.ay)}`, sutunlar: [12, 11, 34, 28, 8, 11, 26].map((genislik) => ({ genislik })),
      baslik: ['Tarih', 'Gün', 'Ne söylendi', 'Kim', 'Adet', 'Tutar ₺', 'Not'],
      satirlar: [...x.liste.map((k) => ({ hucreler: [{ v: k.tarih, tur: 'tarih' }, metin(Y.gunAdi(k.tarih)), metin(k.urun, 'sol'), metin((k.kisiler || []).join(', '), 'sol'), sayiH(k.adet), sayiH(k.tutar), metin(k.notlar, 'sol')] })),
        { hucreler: [metin('TOPLAM'), metin(''), metin(''), metin(''), sayiH(x.adet), sayiH(x.tutar), metin('')] }] });
  }

  /* ---------------- Genel bakış ---------------- */
  function GenelBakis() {
    const d = depo();
    const bg = bugun();
    const bgAy = bg.slice(0, 7);
    const ay = Y.ayOzet(d, bgAy);
    const gecen = Y.ayOzet(d, Y.ayKaydir(bgAy, -1));
    const eksik = Y.tumEksikler(d);
    const yarin = Y.sonrakiIsGunu(bg);
    const grafik = Array.from({ length: 12 }, (_, i) => Y.ayKaydir(bgAy, i - 11)).map((a) => ({ a, x: Y.ayOzet(d, a) }));
    const saat = new Date().getHours();
    const adK = (b.kullanici || '').split(' ')[0];
    const g = Y.gun(d, bg);
    const e = Y.etkin(d, bg);
    const kafe = Y.kafeOzet(d, bgAy);
    return html`
      <${K.Selam} bant baslik=${`${cevir(saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar')}${adK ? ', ' + adK : ''}.`}
        sag=${html`${yaz() && html`<button class="d tz-buyuk" onClick=${() => otoAc()}><${Ikon} ad="takvim" />${cevir("Geçici sayı")}</button>`}
          ${yaz() && html`<button class="d tz-buyuk" onClick=${() => yeniKafe()}><${Ikon} ad="kahve" />${cevir("Kafe siparişi")}</button>`}
          ${yaz() && html`<button class="d tz-buyuk" onClick=${() => menuYukle((a) => { location.hash = '#/menu'; })}><${Ikon} ad="yukle" />${cevir("Menü yükle")}</button>`}`}>
        ${Y.girildiMi(g) ? html`${cevir("Bugün")} <b class="v">${ogunYazi(g)}</b> ${cevir("girildi.")}` : e && e.oto ? html`${cevir("Bugün otomatik")} <b class="v">${e.ogle} ${cevir("öğle")}</b> ${cevir("sayılıyor")}${e.kural ? cevir(" (geçici sayı)") : ''}${cevir("; farklıysa aşağıdan değiştirin.")}`
          : T.isGunu(bg) ? html`${cevir("Bugünün yemek sayısı")} <b>${cevir("henüz girilmedi")}</b>.` : html`${cevir("Bugün")} ${T.tatil(bg) || cevir("hafta sonu")}.`}
        ${eksik.length > 0 && html` <a href="#/takvim" class="tz-uyari-link" style="color:var(--kritik);font-weight:700">${eksik.length} ${cevir("iş günü girilmemiş →")}</a>`}
      <//>
      <div class="kpi-sira">
        <${K.Kpi} vurgu ikon="yemek" ad="Bu ay" deger=${ay.toplam} birim="öğün" alt=${Y.OGUNLER.map((o) => `${ay.adet[o.id]} ${cevir(o.ad).toLocaleLowerCase(NT.dil.yerel())}`).join(' · ')} />
        <${K.Kpi} ikon="kisi" ad="Öğle ortalaması" deger=${ay.gunSay ? K.sayiYaz(ay.adet.ogle / ay.gunSay, 1) : '—'} alt=${NT.dil.m("{0} günde", ay.gunSay)} />
        <${K.Kpi} ikon="uyari" ad="Girilmemiş gün" deger=${eksik.length} alt=${eksik.length ? eksik.slice(0, 3).map(kisaTarih).join(', ') + (eksik.length > 3 ? '…' : '') : cevir("Hepsi girildi")} />
        <${K.Kpi} ikon="fatura" ad=${Y.ayAdi(gecen.ay)} deger=${gecen.toplam} birim="öğün" alt=${gecen.kontrol === 'esit' ? cevir("Fatura tutuyor") : gecen.kontrol === 'fark' ? cevir("Faturada fark var") : gecen.toplam ? cevir("Fatura girilmedi") : '—'} />
      </div>
      <div class="tz-izgara">
        <div class="tz-sutun">
          <${BugunKutusu} />
          <${OtoKarti} />
          <${K.Kart} baslik=${cevir("Aylık öğün")} sag=${html`<a href="#/faturalar" style="color:var(--ana)">${cevir("Faturalar →")}</a>`}>
            <${K.Cubuklar} veri=${grafik.map(({ a, x }) => ({ ad: AYLAR[+a.slice(5) - 1], deger: x.toplam, ipucu: `${Y.ayAdi(a)}: ${Y.OGUNLER.map((o) => `${x.adet[o.id]} ${cevir(o.ad).toLocaleLowerCase(NT.dil.yerel())}`).join(', ')}`, vurgu: a === bgAy }))} />
          <//>
        </div>
        <div class="tz-sutun">
          <${K.Kart} baslik=${cevir("Bugünün menüsü")} sag=${html`<a href="#/menu" style="color:var(--ana)">${cevir("Ayın menüsü →")}</a>`}>
            <div class="ym-menuler">${Y.MENULU.map((o) => html`<${MenuKutusu} key=${o.id} tarih=${bg} ogun=${o.id} genislik=${200} />`)}</div>
          <//>
          <${K.Kart} baslik=${`${yarin === gunEkle(bg, 1) ? cevir('Yarın', 'Tomorrow') : Y.gunAdi(yarin)} · ${kisaTarih(yarin)}`}>
            <div class="ym-menuler">${Y.MENULU.map((o) => html`<${MenuKutusu} key=${o.id} tarih=${yarin} ogun=${o.id} genislik=${200} />`)}</div>
          <//>
          <${K.Kart} baslik=${cevir("Desbaş Kafe · bu ay")} sag=${html`<a href="#/kafe" style="color:var(--ana)">${cevir("Tümü →")}</a>`}>
            ${kafe.siparis ? html`<div class="ym-kafe-liste">${kafe.liste.slice(-4).reverse().map((k) => html`<button type="button" class="ym-kafe-satir" onClick=${() => kafeAc(k)}>
                <${Ikon} ad="kahve" boyut=${16} /><b>${kafeYazi(k)}</b><span class="soluk">${kisaTarih(k.tarih)} · ${(k.kisiler || []).join(', ')}</span><span class="sag">${k.tutar !== '' && k.tutar != null ? tl(sayi(k.tutar)) : ''}</span></button>`)}</div>
              <p class="soluk kucuk" style="margin:10px 0 0">${kafe.siparis} ${cevir("sipariş")}${kafe.tutar ? ' · ' + tl(kafe.tutar) : ''}${kafe.kisiler.length ? ' · ' + kafe.kisiler.map((k) => k.ad).join(', ') : ''}</p>`
              : html`<p class="soluk" style="margin:0">${cevir("Bu ay kafe siparişi yok. Menü dışında Desbaş Kafe’den ayrıca bir şey söylenince “Kafe siparişi” ile girin.")}</p>`}
          <//>
        </div>
      </div>`;
  }

  /* ---------------- Takvim ---------------- */
  function AySecici({ ay, setAy }) {
    return html`<div class="ym-ay-sec"><button class="d hayalet ikon-d" onClick=${() => setAy(Y.ayKaydir(ay, -1))} aria-label=${cevir("Önceki ay")}><${Ikon} ad="geri" /></button>
      <b>${Y.ayAdi(ay)}</b><button class="d hayalet ikon-d" onClick=${() => setAy(Y.ayKaydir(ay, 1))} aria-label=${cevir("Sonraki ay")}><${Ikon} ad="ok" /></button>
      ${ay !== bugun().slice(0, 7) && html`<button class="d kucuk-d" onClick=${() => setAy(bugun().slice(0, 7))}>${cevir("Bu ay")}</button>`}</div>`;
  }
  function Takvim() {
    const d = depo();
    const [ay, setAy] = useState(bugun().slice(0, 7));
    const bg = bugun();
    const gunler = Y.ayGunleri(ay);
    const bosluk = (new Date(`${ay}-01T12:00:00`).getDay() + 6) % 7;
    const x = Y.ayOzet(d, ay);
    const eksik = Y.eksikGunler(d, ay);
    const a = Y.ayar(d);
    const kafe = Y.kafeOzet(d, ay);
    const kafeSay = (t) => kafe.liste.filter((k) => k.tarih === t).length;
    return html`<${K.Selam} baslik=${cevir("Takvim")} sag=${html`<button class="d" onClick=${() => excelAy(d, ay)}><${Ikon} ad="indir" boyut=${15} />Excel</button>`}>
        ${cevir("Elle girilmeyen iş günlerine otomatik sayı yazılır (“oto”); farklıysa güne tıklayıp düzeltin. Hafta sonu ve resmî tatiller kendiliğinden ayrılır.")}<//>
      <${AySecici} ay=${ay} setAy=${setAy} />
      <div class="kpi-sira">${Y.OGUNLER.map((o) => html`<${K.Kpi} ad=${cevir(o.ad)} deger=${x.adet[o.id]} birim="öğün" />`)}
        <${K.Kpi} vurgu ad="Toplam" deger=${x.toplam} birim="öğün" alt=${eksik.length ? NT.dil.m("{0} iş günü girilmedi", eksik.length) : NT.dil.m("{0} günde", x.gunSay)} /></div>
      <div class="ym-takvim">
        ${['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((g) => html`<div class="ym-gun-adi">${cevir(g)}</div>`)}
        ${Array.from({ length: bosluk }, () => html`<div />`)}
        ${gunler.map((t) => {
          const g = Y.etkin(d, t, a);
          const kapali = !T.isGunu(t);
          const ek = Y.eksikMi(d, t, a);
          const ad = T.tatil(t) || T.yarimGun(t);
          return html`<button class=${'ym-gun' + (kapali ? ' kapali' : '') + (ek ? ' eksik' : '') + (t === bg ? ' bugun' : '') + (t > bg ? ' gelecek' : '')} onClick=${() => gunAc(t)}>
            <span class="no">${+t.slice(8)}</span>${ad && html`<span class="tatil">${ad}</span>`}
            <span class="sayilar">${g && g.yemekYok ? html`<span class="soluk">${cevir("Yemek yok")}</span>` : Y.OGUNLER.filter((o) => sayi(g && g[o.id]) > 0).map((o) => html`<span class=${'ym-cip ' + o.id + (g.oto && o.id === 'ogle' ? ' oto' : '')}
                title=${g.oto && o.id === 'ogle' ? NT.dil.m("Otomatik{0}", g.kural ? ' · ' + cevir('geçici sayı', 'temporary count') + (g.kural.notlar ? ': ' + g.kural.notlar : '') : '') : ''}>${o.kisa} ${sayi(g[o.id])}${g.oto && o.id === 'ogle' ? html`<small> ${cevir("oto")}</small>` : ''}</span>`)}
              ${kafeSay(t) > 0 && html`<span class="ym-cip kafe" title=${cevir("Desbaş Kafe siparişi")}><${Ikon} ad="kahve" boyut=${11} /> ${kafeSay(t)}</span>`}</span>
            ${ek && html`<span class="eksik-yazi">${cevir("Girilmedi")}</span>`}
            ${g && g.notlar && html`<span class="not" title=${g.notlar}><${Ikon} ad="bilgi" boyut=${13} /></span>`}
          </button>`;
        })}
      </div>
      <div class="ym-takvim-alt">
        <span class="soluk kucuk">${a.eksikBaslangic ? NT.dil.m("Eksik gün uyarısı {0} tarihinden itibaren (Ayarlar).", tarihYaz(a.eksikBaslangic)) : ''}</span>
        <span style="flex:1" />
        ${kafe.siparis > 0 && html`<a href="#/kafe" class="soluk kucuk"><${Ikon} ad="kahve" boyut=${13} /> ${kafe.siparis} ${cevir("kafe siparişi")}${kafe.tutar ? ' · ' + tl(kafe.tutar) : ''}</a>`}
        <span>${cevir("Fatura:")} <${KontrolRozeti} x=${x} /></span>
        <button class="d kucuk-d" onClick=${() => faturaAc(ay)}><${Ikon} ad="fatura" boyut=${15} />${cevir("Desbaş faturası")}</button>
      </div>`;
  }

  /* ---------------- Menü (ayın menüsü) ---------------- */
  function MenuSayfasi() {
    const d = depo();
    const [ay, setAy] = useState(() => { const bg = bugun().slice(0, 7); const sonraki = Y.ayKaydir(bg, 1); return Y.menu(d, sonraki, 'ogle') && !Y.menu(d, bg, 'ogle') ? sonraki : bg; });
    const bg = bugun();
    const gunler = Y.ayGunleri(ay);
    const varMi = gunler.some((t) => Y.MENULU.some((o) => Y.yemekler(d, t, o.id).length || Y.kesit(d, t, o.id)));
    return html`<${K.Selam} baslik=${cevir("Menü")} sag=${html`${yaz() && html`<button class="d ana-d tz-buyuk" onClick=${() => menuYukle(setAy)}><${Ikon} ad="yukle" />${cevir("Menü yükle")}</button>`}`}>
        ${cevir("Desbaş’ın her ay gönderdiği menü resmini yükleyin; her günün menüsü kendiliğinden o güne yerleşir. Yazı tanıma hatası varsa güne tıklayıp düzeltin.")}<//>
      <${AySecici} ay=${ay} setAy=${setAy} />
      <div class="ym-menu-resimler">${Y.MENULU.map((o) => { const m = Y.menu(d, ay, o.id); return html`<div class="ym-menu-resim">
        <${Ikon} ad=${o.id === 'aksam' ? 'ay' : 'gunes'} /><span><b>${cevir(o.ad)} ${cevir("menüsü")}</b><small>${m ? `${NT.dil.m('{0} güne yerleşti', Object.keys(m.kesitler || {}).length)} · ${m._degistiren}, ${NT.c.onceYaz(m._degisim)}` : cevir("Resim yüklenmedi")}</small></span>
        ${m && html`<button class="d kucuk-d" onClick=${() => ekAc(m.ek)}><${Ikon} ad="goz" boyut=${15} />${cevir("Resmi aç")}</button>`}</div>`; })}</div>
      ${varMi ? html`<div class="ym-menu-izgara">${gunler.map((t) => {
          const kapali = !T.isGunu(t);
          return html`<button class=${'ym-menu-gun' + (t === bg ? ' bugun' : '') + (kapali ? ' kapali' : '')} onClick=${() => gunAc(t)}>
            <span class="bas"><b>${+t.slice(8)} ${cevir(AYLAR[+t.slice(5, 7) - 1])}</b> ${Y.gunAdi(t)}${(T.tatil(t) || T.yarimGun(t)) && html` · <span class="soluk">${T.tatil(t) || T.yarimGun(t)}</span>`}</span>
            ${Y.MENULU.map((o) => { const l = Y.yemekler(d, t, o.id); return html`<span class="ogun"><small>${cevir(o.ad)}</small>${l.length ? l.join(' · ') : html`<span class="soluk">${Y.kesit(d, t, o.id) ? cevir("resimde") : '—'}</span>`}</span>`; })}
          </button>`;
        })}</div>`
        : html`<${BosDurum} ikon="yemek" baslik=${NT.dil.m("{0} menüsü yok", Y.ayAdi(ay))} aciklama=${cevir("“Menü yükle” ile Desbaş’ın gönderdiği resmi seçin.")} />`}`;
  }

  /* ---------------- Faturalar ---------------- */
  function Faturalar() {
    const d = depo();
    const liste = Y.aylar(d).slice().reverse().map((a) => Y.ayOzet(d, a)).filter((x) => x.toplam || x.fatura);
    return html`<${K.Selam} baslik=${cevir("Faturalar")} sag=${html`<button class="d" onClick=${() => excelFatura(liste)}><${Ikon} ad="indir" boyut=${15} />Excel</button>`}>
        ${cevir("Ay sonunda Desbaş’ın faturasındaki öğün adetlerini girin; bizim günlük kayıtlarımızın toplamıyla karşılaştırılır.")}<//>
      <${K.Kart}>
        ${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>${cevir("Dönem")}</th>${Y.OGUNLER.map((o) => html`<th class="sag">${cevir(o.ad)}</th>`)}<th class="sag">${cevir("Toplam")}</th><th>${cevir("Durum")}</th><th>${cevir("Fatura no")}</th></tr></thead><tbody>
          ${liste.map((x) => html`<tr class="tik" onClick=${() => faturaAc(x.ay)}><td><b>${Y.ayAdi(x.ay)}</b></td>
            ${Y.OGUNLER.map((o) => { const f = x.girilen.includes(o) ? sayi(x.fatura[o.id]) : null; return html`<td class="sag sayi">${x.adet[o.id] || (f != null ? 0 : html`<span class="soluk">—</span>`)}${f != null && html`<div class=${'kucuk ' + (f === x.adet[o.id] ? 'soluk' : '')} style=${f !== x.adet[o.id] ? 'color:var(--yok);font-weight:700' : ''}>${cevir("fatura")} ${f}</div>`}</td>`; })}
            <td class="sag sayi"><b>${x.toplam}</b>${x.girilen.length > 0 && html`<div class="kucuk soluk">${cevir("fatura")} ${x.faturaToplam}</div>`}</td>
            <td><${KontrolRozeti} x=${x} /></td><td class="mono kucuk">${x.fatura?.faturaNo || ''}</td></tr>`)}
        </tbody></table></div>` : html`<${BosDurum} ikon="fatura" baslik=${cevir("Kayıt yok")} />`}
      <//>`;
  }

  /* ---------------- Ayarlar ---------------- */
  function YemekAyarlari() {
    const d = depo();
    const a = Y.ayar(d);
    const [bas, setBas] = useState(a.eksikBaslangic || '');
    const [yil, setYil] = useState(+bugun().slice(0, 4));
    const [oto, setOto] = useState({ ogle: a.otoOgle, bas: a.otoBaslangic || '' });
    const otoDegisti = sayi(oto.ogle) !== sayi(a.otoOgle) || oto.bas !== (a.otoBaslangic || '');
    return html`<${K.AyarKarti} baslik=${cevir("Otomatik doldurma")} aciklama=${cevir("Başlangıç tarihinden itibaren, elle girilmeyen her iş gününe (hafta içi, resmî tatil hariç) bu kadar öğle sayılır. Bir güne elle sayı girilirse o geçerli olur. 0 yazılırsa otomatik doldurma kapanır; izin gibi dönemler için Genel Bakış › “Geçici sayı”.")}>
        <div class="form-izgara">
          <${Alan} etiket=${cevir("İş günü başına öğle")} sinif="s4"><${AdetGirdi} deger=${oto.ogle} degis=${(v) => setOto((p) => ({ ...p, ogle: v }))} min=${0} /><//>
          <${Alan} etiket=${cevir("Başlangıç")} sinif="s4"><input class="girdi" type="date" value=${oto.bas} onInput=${(e) => setOto((p) => ({ ...p, bas: e.target.value }))} /><//>
          <div class="alan s4"><label> </label><button class="d" disabled=${!otoDegisti} onClick=${async () => { await d.kaydet([{ c: 'ayar', k: 'genel', v: { otoOgle: sayi(oto.ogle), otoBaslangic: oto.bas } }]); bildir(cevir("Kaydedildi.")); }}>${cevir("Kaydet")}</button></div>
        </div>
      <//>
      <${K.AyarKarti} baslik=${cevir("Eksik gün uyarısı")} aciklama=${cevir("Bu tarihten önceki girilmemiş iş günleri uyarı vermez (eski tablodan aktarılan aylarda bazı günler hiç yazılmamıştı).")}>
        <div class="form-izgara"><${Alan} etiket=${cevir("Uyarı başlangıcı")} sinif="s6"><div style="display:flex;gap:8px"><input class="girdi" type="date" value=${bas} onInput=${(e) => setBas(e.target.value)} />
          <button class="d" disabled=${bas === (a.eksikBaslangic || '')} onClick=${async () => { await d.kaydet([{ c: 'ayar', k: 'genel', v: { eksikBaslangic: bas } }]); bildir(cevir("Kaydedildi.")); }}>${cevir("Kaydet")}</button></div><//></div>
      <//>
      <${K.AyarKarti} ic=${false} baslik=${cevir("Resmî tatiller")} aciklama=${cevir("Hafta sonu ve bu günler iş günü sayılmaz. Arife günleri yarım gündür, iş günü sayılır.")} sag=${html`<select class="girdi kisa" value=${yil} onChange=${(e) => setYil(+e.target.value)}>${[-1, 0, 1].map((i) => html`<option value=${+bugun().slice(0, 4) + i}>${+bugun().slice(0, 4) + i}</option>`)}</select>`}>
        ${!T.bilinenYil(yil) && html`<div class="uyari-kutu kritik" style="margin:0 16px 12px"><${Ikon} ad="uyari" /><span>${yil} ${cevir("dinî bayram tarihleri programa henüz eklenmedi; yalnızca sabit tatiller görünüyor.")}</span></div>`}
        <div class="tablo-kap" style="max-height:320px"><table class="tablo"><tbody>${T.liste(yil).map((x) => html`<tr><td>${tarihYaz(x.tarih)}</td><td>${Y.gunAdi(x.tarih)}</td><td>${cevir(x.ad)}${x.yarim ? html` <span class="soluk kucuk">${cevir("(yarım gün)")}</span>` : ''}</td></tr>`)}</tbody></table></div>
      <//>`;
  }
  function Ayarlar() {
    return html`<${K.AyarlarSayfasi} cop=${{
      gun: { ad: 'Gün kaydı', ozet: (r) => `${tarihYaz(r.tarih)} · ${ogunYazi(r)}` },
      menugun: { ad: 'Günün menüsü', ozet: (r) => `${tarihYaz(r.tarih)} ${r.ogun === 'aksam' ? 'akşam' : 'öğle'} · ${(r.yemekler || []).slice(0, 2).join(', ')}` },
      menu: { ad: 'Menü resmi', ozet: (r) => `${Y.ayAdi(r.ay)} ${r.ogun === 'aksam' ? 'akşam' : 'öğle'}` },
      fatura: { ad: 'Fatura', ozet: (r) => Y.ayAdi(r.ay) },
      kafe: { ad: 'Kafe siparişi', ozet: (r) => `${tarihYaz(r.tarih)} · ${kafeYazi(r)} · ${(r.kisiler || []).join(', ')}` },
      kafefatura: { ad: 'Kafe faturası', ozet: (r) => Y.ayAdi(r.ay) },
      oto: { ad: 'Geçici yemek sayısı', ozet: (r) => `${aralikYaz(r)} · ${cevir('öğle', 'lunch')} ${r.ogle}${r.notlar ? ' · ' + r.notlar : ''}` },
    }}>${yaz() && html`<${YemekAyarlari} />`}<//>`;
  }

  /* ---------------- Excel ---------------- */
  const metin = (v, hiza) => ({ v: v ?? '', tur: 'metin', hiza });
  const sayiH = (v) => (v === '' || v == null ? metin('') : { v: Number(v) || 0, tur: 'sayi' });
  function excelAy(d, ay) {
    const satirlar = Y.ayGunleri(ay).map((t) => {
      const g = Y.etkin(d, t);
      return { hucreler: [{ v: t, tur: 'tarih' }, metin(Y.gunAdi(t)), sayiH(g ? g.ogle : ''), sayiH(g ? g.kahvalti : ''), sayiH(g ? g.aksam : ''), sayiH(g ? Y.toplam(g) : ''),
        metin([g && g.yemekYok ? cevir('Yemek yok') : '', g && g.oto ? `${cevir('öğle otomatik', 'lunch automatic')}${g.kural?.notlar ? ' (' + g.kural.notlar + ')' : ''}` : '', T.tatil(t) || T.yarimGun(t) || '', g && g.notlar].filter(Boolean).join(' · '), 'sol'),
        metin(Y.kafeler(d, t).map((k) => `${kafeYazi(k)} (${(k.kisiler || []).join(', ')})${k.tutar !== '' && k.tutar != null ? ' ' + tl(sayi(k.tutar)) : ''}`).join('; '), 'sol'),
        metin(Y.yemekler(d, t, 'ogle').join(', '), 'sol'), metin(Y.yemekler(d, t, 'aksam').join(', '), 'sol')] };
    });
    const x = Y.ayOzet(d, ay);
    const kafe = Y.kafeOzet(d, ay);
    satirlar.push({ hucreler: [metin('TOPLAM'), metin(''), sayiH(x.adet.ogle), sayiH(x.adet.kahvalti), sayiH(x.adet.aksam), sayiH(x.toplam), metin(''), metin(kafe.siparis ? `${kafe.siparis} ${cevir('sipariş')}${kafe.tutar ? ' · ' + tl(kafe.tutar) : ''}` : ''), metin(''), metin('')] });
    K.excel(`yemek-${ay}.xlsx`, { sayfa: Y.ayAdi(ay), sutunlar: [12, 11, 8, 9, 8, 8, 30, 34, 60, 60].map((genislik) => ({ genislik })),
      baslik: ['Tarih', 'Gün', 'Öğle', 'Kahvaltı', 'Akşam', 'Toplam', 'Açıklama', 'Desbaş Kafe', 'Öğle menüsü', 'Akşam menüsü'], satirlar });
  }
  function excelFatura(liste) {
    K.excel(`yemek-faturalari-${bugun()}.xlsx`, { sayfa: 'Yemek faturaları', sutunlar: [14, 9, 9, 9, 9, 9, 9, 9, 9, 14, 14].map((genislik) => ({ genislik })),
      baslik: ['Dönem', 'Öğle (biz)', 'Öğle (fatura)', 'Kahvaltı (biz)', 'Kahvaltı (fatura)', 'Akşam (biz)', 'Akşam (fatura)', 'Toplam (biz)', 'Toplam (fatura)', 'Durum', 'Fatura no'],
      satirlar: liste.map((x) => ({ hucreler: [metin(Y.ayAdi(x.ay)), ...Y.OGUNLER.flatMap((o) => [sayiH(x.adet[o.id]), sayiH(x.girilen.includes(o) ? x.fatura[o.id] : '')]), sayiH(x.toplam), sayiH(x.girilen.length ? x.faturaToplam : ''),
        metin({ esit: 'Tutuyor', fark: 'Fark var', bekliyor: 'Fatura girilmedi', yok: '' }[x.kontrol]), metin(x.fatura?.faturaNo || '')] })) });
  }

  /* ---------------- Arama: menüde yemek, gün notu ---------------- */
  function arama(d, q) {
    const l = [];
    for (const m of d.kayitlar('menugun')) {
      if ((m.yemekler || []).length && ara((m.yemekler || []).join(' '), q)) l.push({ tur: m.ogun === 'aksam' ? 'Akşam' : 'Öğle', ad: (m.yemekler || []).find((x) => ara(x, q)) || m.yemekler[0], ek: `${tarihYaz(m.tarih)} ${Y.gunAdi(m.tarih)}`, fn: () => gunAc(m.tarih), t: m.tarih });
    }
    for (const g of d.kayitlar('gun')) if (g.notlar && ara(g.notlar, q)) l.push({ tur: 'Not', ad: g.notlar, ek: tarihYaz(g.tarih), fn: () => gunAc(g.tarih), t: g.tarih });
    for (const k of d.kayitlar('kafe')) if (ara(`${k.urun} ${(k.kisiler || []).join(' ')} ${k.notlar || ''} kafe`, q)) l.push({ tur: 'Kafe', ad: `${kafeYazi(k)} · ${(k.kisiler || []).join(', ')}`, ek: tarihYaz(k.tarih), fn: () => kafeAc(k), t: k.tarih });
    return l.sort((a, x) => (a.t < x.t ? 1 : -1));
  }

  NT.yemekUI = { GunPenceresi, MenuYukle, FaturaPenceresi, Kesit, KafePenceresi, KafeFaturaPenceresi };
  K.calistir({
    sekmeler: [
      { id: 'genel', ad: 'Genel Bakış', ikon: 'ozet' },
      { id: 'takvim', ad: 'Takvim', ikon: 'takvim', sayac: (d) => Y.tumEksikler(d).length },
      { id: 'menu', ad: 'Menü', ikon: 'yemek' },
      { id: 'kafe', ad: 'Kafe', ikon: 'kahve' },
      { id: 'faturalar', ad: 'Faturalar', ikon: 'fatura', sayac: (d) => { const g = Y.ayOzet(d, Y.ayKaydir(bugun().slice(0, 7), -1)); return d.kayitlar('fatura').filter((f) => Y.ayOzet(d, f.ay).kontrol === 'fark').length + (g.kontrol === 'bekliyor' ? 1 : 0); } },
      { id: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
    ],
    sayfalar: { genel: GenelBakis, takvim: Takvim, menu: MenuSayfasi, kafe: KafeSayfasi, faturalar: Faturalar, ayarlar: Ayarlar },
    eylemler: [
      { ad: 'Bugünü gir', alt: 'Bugünün yemek sayısı', ikon: 'yemek', tus: 'B', fn: () => gunAc(bugun()) },
      { ad: 'Menü yükle', alt: 'Desbaş’ın aylık menü resmi', ikon: 'yukle', tus: 'M', fn: () => menuYukle(() => { location.hash = '#/menu'; }) },
      { ad: 'Kafe siparişi', alt: 'Menü dışı Desbaş Kafe siparişi', ikon: 'kahve', tus: 'K', fn: () => yeniKafe() },
      { ad: 'Fatura gir', alt: 'Ay sonu Desbaş faturası', ikon: 'fatura', tus: 'F', fn: () => faturaAc(Y.ayKaydir(bugun().slice(0, 7), -1)) },
    ],
    arama,
    uzakKoleksiyonlar: ['gun', 'menu', 'menugun', 'fatura', 'kafe', 'kafefatura'],
  });
})();
