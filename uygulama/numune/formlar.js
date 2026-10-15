/* Kayıt formları: dolum, sevkiyat, ambalaj alımı, sayım düzeltmesi. */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, useState, useMemo } = window.htmPreact;
  const { Ikon, Modal, Alan, AdetGirdi, Oneri, Gecmis, GecmisBolumu, Ekler, BelgeKutusu, SevkRozeti, EkOnizleme, ekAc, bildir, onayla } = NT.ui;
  const H = NT.hesap;
  const { bugun, uid, sayi, trSirala, tarihYaz } = NT.c;

  const depo = () => NT.baglanti.depo;
  NT.ui.DEGER_YAZ.kaynakTur = (v) => H.DOLUM_KAYNAKLARI.find((x) => x.id === v)?.ad || v;
  const kullanici = () => NT.baglanti.kullanici;

  function farklar(eski, yeni) {
    const v = {};
    for (const [k, d] of Object.entries(yeni)) if (JSON.stringify(eski[k] ?? '') !== JSON.stringify(d ?? '')) v[k] = d;
    return v;
  }
  function benzersiz(liste) {
    return [...new Set(liste.filter(Boolean).map((x) => String(x).trim()).filter(Boolean))].sort(trSirala);
  }

  async function sil(c, kayit, ad) {
    if (!(await onayla(`${kayit.no || ad} silinsin mi? Stok hesabı buna göre güncellenir. Silinen kayıt Ayarlar › Çöp kutusundan geri alınabilir.`, { baslik: 'Kaydı sil', evet: 'Sil', tehlike: true }))) return false;
    await depo().kaydet([{ op: 'del', c, k: kayit.id }]);
    bildir(`${kayit.no || ad} silindi.`, { eylem: { yazi: 'Geri al', fn: () => depo().kaydet([{ op: 'undel', c, k: kayit.id }]) } });
    return true;
  }

  /* İptal: gönderi kaydı silinmez, "iptal edildi" olarak kalır; stoktan düşmez, rezerve tutmaz, yolda sayılmaz.
     Yanlış girilmiş kayıt için ise Sil kullanılır (çöp kutusuna gider). */
  async function iptalEt(s) {
    let neden = '';
    const detay = html`<input class="girdi" style="margin-top:12px" placeholder="Neden? (isteğe bağlı, örn. müşteri vazgeçti)" onInput=${(e) => { neden = e.target.value; }} />`;
    if (!(await onayla(`${s.no} · ${s.firma} iptal edilsin mi? Kayıt silinmez; Gönderiler › İptal altında kalır ve şişeler rafa geri sayılır.`, { baslik: 'Gönderiyi iptal et', evet: 'İptal et', tehlike: true, detay }))) return false;
    await depo().kaydet([{ c: 'sevk', k: s.id, v: { iptal: true, iptalNeden: neden.trim(), iptalTarihi: bugun() } }]);
    bildir(`${s.no} iptal edildi.`, { eylem: { yazi: 'Geri al', fn: () => iptalGeriAl(s, true) } });
    return true;
  }
  async function iptalGeriAl(s, sessiz) {
    await depo().kaydet([{ c: 'sevk', k: s.id, v: { iptal: false, iptalNeden: '', iptalTarihi: '' } }]);
    if (!sessiz) bildir(`${s.no} yeniden etkin.`);
  }

  /* Ülke açılır listesi: Türkiye ve daha önce gönderilen ülkeler üstte. */
  function UlkeSecimi({ deger, degis, stil }) {
    const { sik, hepsi } = H.ulkeler(depo());
    const ekstra = deger && !sik.includes(deger) && !hepsi.includes(deger) ? [deger] : [];
    return html`<select class="girdi" style=${stil} value=${deger || ''} onChange=${(e) => degis(e.target.value)}>
      <option value="">— Ülke seçin —</option>
      <optgroup label="Sık kullanılan">${[...sik, ...ekstra].map((u) => html`<option value=${u}>${u}</option>`)}</optgroup>
      <optgroup label="Tüm ülkeler">${hepsi.map((u) => html`<option value=${u}>${u}</option>`)}</optgroup>
    </select>`;
  }

  /* Telefon: ülke kodu açılır listesi + numara. Kayıtta tek metin olarak "+<kod> <numara>" tutulur.
     Numara boşken gönderinin ülkesi değişirse kod da o ülkeye geçer. */
  function TelefonGirdisi({ deger, degis, ulke }) {
    const [iso, setIso] = useState(() => H.telefonCoz(deger, ulke).iso || H.ulkeIso(ulke) || 'TR');
    const liste = H.ulkeTelefonlari();
    const tel = liste.find((u) => u.iso === iso)?.tel;
    const metin = String(deger || '');
    const onEk = new RegExp('^\\+\\s*' + (tel || '').split('').join('\\s*') + '\\s*');
    const numara = tel && onEk.test(metin) ? metin.replace(onEk, '') : H.telefonCoz(metin, ulke).numara;
    window.htmPreact.useEffect(() => {
      const u = H.ulkeIso(ulke);
      if (u && !numara.trim()) setIso(u);
    }, [ulke]);
    // Numara dışarıdan geldiyse (ör. aynı firmanın önceki gönderisinden) kodu ona göre ayarla.
    window.htmPreact.useEffect(() => {
      if (metin.startsWith('+') && !onEk.test(metin)) {
        const c = H.telefonCoz(metin, ulke);
        if (c.iso) setIso(c.iso);
      }
    }, [deger]);
    const { sik } = H.ulkeler(depo());
    const ust = sik.map((ad) => liste.find((u) => u.ad === ad)).filter(Boolean);
    const secenek = (u) => html`<option value=${u.iso}>${u.ad} +${u.tel}</option>`;
    return html`<div style="display:flex;gap:6px">
      <select class="girdi" style="flex:0 0 150px;min-width:0" aria-label="Ülke kodu" value=${iso} onChange=${(e) => { setIso(e.target.value); degis(H.telefonBirlestir(e.target.value, numara)); }}>
        <optgroup label="Sık kullanılan">${ust.map(secenek)}</optgroup>
        <optgroup label="Tüm ülkeler">${liste.filter((u) => !ust.includes(u)).map(secenek)}</optgroup>
      </select>
      <input class="girdi" style="flex:1;min-width:0" type="tel" aria-label="Telefon numarası" value=${numara} placeholder="Numara" onInput=${(e) => degis(H.telefonBirlestir(iso, e.target.value))} />
    </div>`;
  }


  function Secenekler({ liste, deger, degis, ek }) {
    return html`<div class="secenekler">${liste.map((x) => {
      const id = typeof x === 'string' ? x : x.id;
      const ad = typeof x === 'string' ? x : x.ad;
      return html`<button type="button" class=${'secenek' + (deger === id ? ' secili' : '')} onClick=${() => degis(id)}>${ad}${ek && html`<span class="ek">${ek(id)}</span>`}</button>`;
    })}</div>`;
  }

  /* Dolumu yapanlar: çoklu seçim (dokununca seçilir / bırakılır); listede olmayan kişi "Başka kişi" ile eklenir. */
  function DolduranSecimi({ secili, degis }) {
    const [yeni, setYeni] = useState('');
    const liste = [...new Set([...H.dolumKisileri(depo()), ...secili])];
    const sec = (a) => degis(secili.includes(a) ? secili.filter((x) => x !== a) : [...secili, a]);
    const ekle = () => { const a = yeni.trim().replace(/\s+/g, ' '); if (a && !secili.includes(a)) degis([...secili, a]); setYeni(''); };
    return html`<div class="secenekler">${liste.map((a) => html`<button type="button" class=${'secenek' + (secili.includes(a) ? ' secili' : '')} aria-pressed=${secili.includes(a)} onClick=${() => sec(a)}>${secili.includes(a) && html`<${Ikon} ad="tik" boyut=${12} /> `}${a}</button>`)}</div>
      <div style="display:flex;gap:6px;margin-top:8px;max-width:360px">
        <input class="girdi" placeholder="Başka kişi…" value=${yeni} onInput=${(e) => setYeni(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); ekle(); } }} />
        <button type="button" class="d kucuk-d" disabled=${!yeni.trim()} onClick=${ekle}><${Ikon} ad="arti" boyut=${14} />Ekle</button>
      </div>`;
  }
  NT.ui.DolduranSecimi = DolduranSecimi;
  NT.ui.DEGER_YAZ.dolduranlar = (v) => (Array.isArray(v) && v.length ? v.join(', ') : '—');

  /* ---------------- Dolum ---------------- */
  function DolumFormu({ kayit, kapat, on = {} }) {
    const d = depo();
    const urunler = H.urunler(d);
    const amb = H.ambalajlar(d);
    const [f, setF] = useState(() => kayit
      ? { tarih: kayit.tarih || bugun(), urun: kayit.urun, parti: kayit.parti || '', ambalaj: kayit.ambalaj, adet: kayit.adet, hazirlayan: kayit.hazirlayan || '', dolduranlar: kayit.dolduranlar || [], kaynakTur: kayit.kaynakTur || '', kaynakNo: kayit.kaynakNo || '', notlar: kayit.notlar || '', ekler: kayit.ekler || [] }
      : { tarih: bugun(), urun: urunler[0]?.ad || '', parti: '', ambalaj: '1L', adet: 1, hazirlayan: kullanici(), dolduranlar: [], kaynakTur: '', kaynakNo: '', notlar: '', ekler: [], ...on });
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const [denendi, setDenendi] = useState(false);
    const urun = H.urunBul(d, f.urun);
    const partili = !!urun?.partili;
    const partiler = useMemo(() => (partili ? H.partiler(d, f.urun) : []), [f.urun, d.surum]);
    const sonraki = partili ? H.sonrakiParti(d, f.urun) : '';

    const bos = H.bosMevcut(d, f.ambalaj) + (kayit && kayit.ambalaj === f.ambalaj ? sayi(kayit.adet) : 0);
    const yetersiz = sayi(f.adet) > bos;
    const hatalar = {
      urun: !f.urun && 'Ürün seçin',
      parti: partili && !f.parti.trim() && 'Bu ürün parti takipli; parti numarası girin',
      adet: !(sayi(f.adet) > 0) && 'Adet 0’dan büyük olmalı',
      tarih: !f.tarih && 'Tarih girin',
      dolduranlar: !kayit && !f.dolduranlar.length && 'Dolumu yapan kişiyi seçin',
    };
    const gecerli = !Object.values(hatalar).some(Boolean);

    async function kaydet() {
      setDenendi(true);
      if (!gecerli) return;
      if (yetersiz && !(await onayla(`${H.ambalajAdi(d, f.ambalaj)} boş şişe stokunda ${bos} adet görünüyor, ${f.adet} adet dolum girdiniz. Kaydederseniz boş şişe stoku eksiye düşer — sayım farkı olabilir.`, { baslik: 'Boş şişe yetersiz', evet: 'Yine de kaydet' }))) return;
      const v = { tarih: f.tarih, urun: f.urun, parti: partili ? f.parti.trim() : '', ambalaj: f.ambalaj, adet: sayi(f.adet), hazirlayan: f.hazirlayan.trim(), dolduranlar: f.dolduranlar, kaynakTur: f.kaynakTur, kaynakNo: f.kaynakTur ? f.kaynakNo.trim() : '', notlar: f.notlar.trim(), ekler: f.ekler };
      if (kayit) {
        const fark = farklar(kayit, v);
        if (Object.keys(fark).length) await d.kaydet([{ c: 'dolum', k: kayit.id, v: fark }]);
        bildir(`${kayit.no} güncellendi.`);
      } else {
        const no = H.yeniNo(d, 'dolum', f.tarih);
        await d.kaydet([{ c: 'dolum', k: uid(), v: { no, ...v } }]);
        bildir(`${no} kaydedildi · ${v.adet} × ${f.urun} ${H.ambalajAdi(d, f.ambalaj)}`);
      }
      kapat();
    }

    return html`<${Modal} baslik=${kayit ? `Dolum ${kayit.no}` : 'Yeni numune dolumu'} kapat=${kapat}
      alt=${html`
        ${kayit && html`<div class="sol"><button class="d tehlike" onClick=${async () => (await sil('dolum', kayit)) && kapat()}><${Ikon} ad="cop" />Sil</button></div>`}
        <button class="d hayalet" onClick=${kapat}>Vazgeç</button>
        <button class="d ana-d" onClick=${kaydet}><${Ikon} ad="tik" />${kayit ? 'Kaydet' : 'Dolumu kaydet'}</button>`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket="Ürün" hata=${denendi && hatalar.urun}>
          <${Secenekler} liste=${urunler.map((u) => u.ad)} deger=${f.urun} degis=${(v) => setF((p) => ({ ...p, urun: v, parti: '' }))} />
        <//>
        ${partili && html`<${Alan} etiket="Parti (Batch) no" hata=${denendi && hatalar.parti} ipucu="Son partiler üstte. Yeni bir parti ise yazın veya önerilene tıklayın. Karışımsa “Batch #3 + Batch #20” biçiminde yazın.">
          <div class="secenekler">
            <button type="button" class=${'secenek' + (f.parti === sonraki ? ' secili' : '')} onClick=${() => s('parti')(sonraki)}><${Ikon} ad="arti" boyut=${12} /> ${sonraki}<span class="ek">yeni</span></button>
            ${partiler.slice(0, 6).map((p) => html`<button type="button" class=${'secenek' + (f.parti === p ? ' secili' : '')} onClick=${() => s('parti')(p)}>${p}</button>`)}
          </div>
          <input class="girdi" list="partiler-dl" placeholder="Örn: Batch #23" value=${f.parti} onInput=${(e) => s('parti')(e.target.value)} />
          <${Oneri} id="partiler-dl" liste=${partiler} />
        <//>`}
        <${Alan} etiket="Ambalaj" ipucu="Yanındaki sayı: raftaki boş şişe">
          <${Secenekler} liste=${amb} deger=${f.ambalaj} degis=${s('ambalaj')} ek=${(id) => H.bosMevcut(d, id)} />
        <//>
        <${Alan} etiket="Doldurulan adet" sinif="s4" hata=${denendi && hatalar.adet}><${AdetGirdi} deger=${f.adet} degis=${s('adet')} min=${1} /><//>
        <${Alan} etiket="Dolum tarihi" sinif="s4" hata=${denendi && hatalar.tarih}><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih')(e.target.value)} /><//>
        <${Alan} etiket="Hazırlayan" sinif="s4">
          <input class="girdi" list="hazirlayan-dl" value=${f.hazirlayan} onInput=${(e) => s('hazirlayan')(e.target.value)} />
          <${Oneri} id="hazirlayan-dl" liste=${benzersiz(d.kayitlar('dolum').map((r) => r.hazirlayan))} />
        <//>
        <${Alan} etiket="Dolumu yapanlar" hata=${denendi && hatalar.dolduranlar} ipucu="Birden fazla kişi seçilebilir. Hazırlayan: kaydı giren kişi.">
          <${DolduranSecimi} secili=${f.dolduranlar} degis=${s('dolduranlar')} />
        <//>
        ${yetersiz && html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${H.ambalajAdi(d, f.ambalaj)} boş şişe stoku ${bos} adet. Bu dolum stoku eksiye düşürür.</span></div>`}
        <${Alan} etiket="Nereden dolduruldu?" sinif=${f.kaynakTur ? 's8' : 's12'}>
          <${Secenekler} liste=${H.DOLUM_KAYNAKLARI} deger=${f.kaynakTur} degis=${(v) => s('kaynakTur')(f.kaynakTur === v ? '' : v)} />
        <//>
        ${f.kaynakTur && html`<${Alan} etiket=${H.DOLUM_KAYNAKLARI.find((x) => x.id === f.kaynakTur)?.no} sinif="s4">
          <input class="girdi mono" list="kaynakno-dl" value=${f.kaynakNo} onInput=${(e) => s('kaynakNo')(e.target.value)} />
          <${Oneri} id="kaynakno-dl" liste=${benzersiz(d.kayitlar('dolum').filter((r) => r.kaynakTur === f.kaynakTur).map((r) => r.kaynakNo))} />
        <//>`}
        <${Alan} etiket="Not"><textarea class="girdi" rows="2" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} placeholder="Örn: Müşteri talebine istinaden hazırlandı, sevkiyat rafına alındı." /><//>
        <${Alan} etiket="Ekler" ipucu="Analiz sertifikası vb. Buluta kaydedilir (en fazla 8 MB). Şişe etiketleri gönderi kaydına yüklenir."><${Ekler} ekler=${f.ekler} degis=${s('ekler')} /><//>
        <${GecmisBolumu} kayit=${kayit} />
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }

  /* ---------------- Sevkiyat ---------------- */
  function bosKalem(d) {
    const u = H.urunler(d)[0];
    return { anahtar: uid(6), urun: u?.ad || '', parti: '', ambalaj: '1L', adet: 1 };
  }

  function KalemSatiri({ k, degis, kaldir, tekMi, haricId }) {
    const d = depo();
    const urunler = H.urunler(d);
    const u = H.urunBul(d, k.urun);
    const st = H.stok(d).dolu;
    const eski = haricId ? d.kayit('sevk', haricId) : null;
    const geriEkle = (p, a) => (eski && eski.durum === 'Gönderildi' ? (eski.kalemler || []).filter((x) => x.urun === k.urun && (x.parti || '') === (p || '') && x.ambalaj === a).reduce((t, x) => t + sayi(x.adet), 0) : 0);
    const mevcut = (p, a) => (st.get(H.anahtar(k.urun, p, a))?.mevcut ?? 0) + geriEkle(p, a);
    const partiler = u?.partili ? H.partiler(d, k.urun) : [];
    const partiToplam = (p) => H.ambalajlar(d).reduce((t, a) => t + Math.max(0, mevcut(p, a.id)), 0);
    const partiSirali = [...partiler].sort((a, b) => (partiToplam(b) > 0) - (partiToplam(a) > 0) || H.partiNo(b) - H.partiNo(a));
    const m = mevcut(k.parti, k.ambalaj);
    const s = (a) => (v) => degis({ ...k, [a]: v });
    return html`<div class="kalem-satir">
      <div class="alan"><label>Ürün</label>
        <select class="girdi" value=${k.urun} onChange=${(e) => degis({ ...k, urun: e.target.value, parti: '' })}>
          ${urunler.map((x) => html`<option value=${x.ad}>${x.ad}</option>`)}
          ${k.urun && !u && html`<option value=${k.urun}>${k.urun}</option>`}
        </select></div>
      <div class="alan"><label>Parti</label>
        ${u?.partili
          ? html`<select class="girdi" value=${k.parti} onChange=${(e) => s('parti')(e.target.value)}>
              <option value="">Seçin…</option>
              ${partiSirali.map((p) => html`<option value=${p}>${p} (${partiToplam(p)} dolu)</option>`)}
              ${k.parti && !partiler.includes(k.parti) && html`<option value=${k.parti}>${k.parti}</option>`}
            </select>`
          : html`<div class="girdi soluk" style="background:var(--yuzey3)">Partisiz</div>`}
      </div>
      <div class="alan"><label>Ambalaj</label>
        <select class="girdi" value=${k.ambalaj} onChange=${(e) => s('ambalaj')(e.target.value)}>
          ${H.ambalajlar(d).map((a) => html`<option value=${a.id}>${a.ad} · ${mevcut(k.parti, a.id)} dolu</option>`)}
        </select></div>
      <div class="alan"><label>Adet</label><${AdetGirdi} deger=${k.adet} degis=${s('adet')} min=${1} />
        <span class=${'mevcut ' + (sayi(k.adet) > m ? 'hata-yazi' : 'soluk')}>Rafta ${m} adet</span></div>
      <div class="alan"><label> </label><button type="button" class="d hayalet ikon-d" disabled=${tekMi} onClick=${kaldir} title="Kalemi kaldır"><${Ikon} ad="cop" /></button></div>
      <${KalemBelgeleri} k=${k} degis=${degis} />
    </div>`;
  }

  /* Gönderinin her kaleminin kendi belgeleri (CoA / analiz, MSDS…): kalem satırının altında. */
  function KalemBelgeleri({ k, degis }) {
    return html`<div class="belge-izgara kalem-belgeleri">
      <${BelgeKutusu} baslik="CoA / analiz (bu kalem)" ekler=${k.coaBelge} degis=${(v) => degis({ ...k, coaBelge: v })} ipucu=${k.parti ? `${k.parti} için` : 'Bu kalemin analiz sertifikası'} />
      <${BelgeKutusu} baslik="Diğer belgeler (bu kalem)" ekler=${k.belgeler} degis=${(v) => degis({ ...k, belgeler: v })} ipucu="MSDS vb." />
    </div>`;
  }

  /* ---------------- Şişe etiketleri: gönderilen her şişeye kullanıcının (Canva vb.) etiketi + şişe no ----------------
     Yuvalar kalemlerden türetilir (adet kadar). Durum tüm yuvaları (boşlar dahil) tutar; kaydederken H.siseTemizle. */
  /* Şişe (sample) numaralarını kullanıcı belirler; sistem numara önermez ya da kendiliğinden doldurmaz (2026-10-12). */
  function SiseEtiketleri({ kalemler, siseler, degis }) {
    const d = depo();
    const [yukleniyor, setYukleniyor] = useState(false);
    const yuvalar = H.siseSlotlari(kalemler, siseler);
    const hepsi = yuvalar.flat();
    const yaz = (i, j, v) => degis(yuvalar.map((g, a) => g.map((x, b) => (a === i && b === j ? { ...x, ...v } : x))).flat());
    async function yukle(dosyalar, hedefler) {
      dosyalar = [...dosyalar].sort((a, b) => trSirala(a.name, b.name));
      const buyuk = dosyalar.find((f) => f.size > 15 * 1024 * 1024);
      if (buyuk) return bildir(`${buyuk.name} 15 MB'tan büyük.`, { tur: 'hata' });
      if (dosyalar.length > hedefler.length) bildir(`${dosyalar.length} dosya seçildi, ${hedefler.length} boş şişe var; fazlası yüklenmedi.`, { tur: 'hata' });
      setYukleniyor(true);
      try {
        const yeni = yuvalar.map((g) => g.map((x) => ({ ...x })));
        for (let n = 0; n < Math.min(dosyalar.length, hedefler.length); n++) {
          const [i, j] = hedefler[n];
          yeni[i][j].ek = await d.ekYaz(dosyalar[n]);
        }
        degis(yeni.flat());
      } catch (err) { bildir('Etiket yüklenemedi: ' + err.message, { tur: 'hata' }); }
      setYukleniyor(false);
    }
    const bosYuvalar = yuvalar.flatMap((g, i) => g.map((x, j) => (x.ek ? null : [i, j]))).filter(Boolean);
    const dosyaSec = (hedefler, coklu) => {
      const g = document.createElement('input');
      g.type = 'file'; g.multiple = coklu; g.accept = 'image/*,application/pdf'; g.className = 'gizli';
      g.onchange = () => { const l = [...g.files]; g.remove(); if (l.length) yukle(l, hedefler); };
      document.body.appendChild(g); // bağlı olmayan girdide bazı tarayıcılar change olayını atmıyor
      g.click();
    };
    if (!hepsi.length) return html`<p class="soluk kucuk">Önce gönderilecek şişeleri seçin.</p>`;
    const etiketli = hepsi.filter((x) => x.ek).length;
    return html`<div class="sise-etiketleri">
      <div class="dugmeler" style="margin-bottom:10px">
        <button type="button" class="d kucuk-d" disabled=${yukleniyor || !bosYuvalar.length} onClick=${() => dosyaSec(bosYuvalar, true)}><${Ikon} ad="yukle" boyut=${15} />${yukleniyor ? 'Yükleniyor…' : 'Etiketleri toplu yükle'}</button>
        <span class="kucuk soluk">${etiketli}/${hepsi.length} şişenin etiketi var. Toplu yüklemede dosyalar ada göre sıralanıp boş şişelere sırayla konur.</span>
      </div>
      ${yuvalar.map((g, i) => g.length > 0 && html`<div class="sise-grup">
        <div class="sise-grup-bas">${kalemler[i].urun}${kalemler[i].parti ? ' · ' + kalemler[i].parti : ''} · ${H.ambalajAdi(d, kalemler[i].ambalaj)}</div>
        <div class="sise-izgara">${g.map((x, j) => html`<div class=${'sise-yuva' + (x.ek ? ' dolu' : '')}>
          <button type="button" class="sise-gorsel" title=${x.ek ? 'Etiketi aç' : 'Etiket yükle'} disabled=${yukleniyor} onClick=${() => (x.ek ? ekAc(x.ek) : dosyaSec([[i, j]], false))}>
            ${x.ek ? html`<${EkOnizleme} ek=${x.ek} />` : html`<span class="ek-simge"><${Ikon} ad="yukle" boyut=${20} /><small>Etiket yükle</small></span>`}
          </button>
          <div class="sise-alt">
            <input class="girdi mono" aria-label="Şişe no" value=${x.no} placeholder="Sample no" onInput=${(e) => yaz(i, j, { no: e.target.value })} />
            ${x.ek && html`<button type="button" class="d hayalet ikon-d" title="Etiketi kaldır" onClick=${() => yaz(i, j, { ek: null })}><${Ikon} ad="kapat" boyut=${14} /></button>`}
          </div>
        </div>`)}</div>
      </div>`)}
    </div>`;
  }

  function SevkFormu({ kayit, kapat, on = {} }) {
    const d = depo();
    const [f, setF] = useState(() => {
      // Ülke: yeni gönderide Türkiye; ülkesi girilmemiş eski kayıtlarda boş kalır (yanlışlıkla Türkiye yazılmasın).
      const bos = { tarih: bugun(), firma: '', yetkili: '', telefon: '', irtibatDetay: '', talepTarihi: '', sorumlu: kayit ? '' : kullanici(), geriBildirim: '', numuneYeri: '', sekil: 'Kargo', sebep: '', durum: 'Beklemede', kargoFirma: '', takipNo: '', kargoBelge: [], ulke: kayit ? '' : 'Türkiye', adres: '', notlar: '', ekler: [], siseler: [], kalemler: [bosKalem(d)] };
      if (!kayit) return { ...bos, ...on };
      const temiz = Object.fromEntries(Object.keys(bos).map((k) => [k, kayit[k] ?? bos[k]]));
      return { ...temiz, kalemler: (kayit.kalemler || []).map((k) => ({ ...k, parti: k.parti || '', anahtar: uid(6) })) };
    });
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const [denendi, setDenendi] = useState(false);
    const onceki = d.kayitlar('sevk').filter((r) => r.id !== kayit?.id);
    const firmalar = benzersiz(onceki.map((r) => r.firma));

    function firmaSec(v) {
      setF((p) => {
        const son = H.firmaBilgisi(d, v, kayit?.id);
        if (!son.var) return { ...p, firma: v };
        return { ...p, firma: v, yetkili: p.yetkili || son.yetkili || '', telefon: p.telefon || son.telefon || '', irtibatDetay: p.irtibatDetay || son.irtibatDetay || '', adres: p.adres || son.adres || '', ulke: p.adres ? p.ulke : son.ulke || p.ulke };
      });
    }

    const kalemler = f.kalemler.map(({ anahtar, ...k }) => ({ ...k, adet: sayi(k.adet) }));
    const eksikler = H.sevkKontrol(d, kalemler, kayit?.id);
    const hatalar = {
      firma: !f.firma.trim() && 'Firma adı girin',
      kalem: kalemler.some((k) => !k.urun || !(k.adet > 0) || (H.urunBul(d, k.urun)?.partili && !k.parti)) && 'Her kalemde ürün, parti (partili ürünlerde) ve adet olmalı',
    };
    const gecerli = !Object.values(hatalar).some(Boolean);

    async function kaydet() {
      setDenendi(true);
      if (!gecerli) return;
      if (f.durum === 'Gönderildi' && eksikler.length && !(await onayla('Bazı kalemlerde raftaki dolu numune yetersiz. Kaydederseniz stok eksiye düşer.', {
        baslik: 'Stok yetersiz', evet: 'Yine de gönderildi olarak kaydet',
        detay: html`<ul style="margin:10px 0 0;padding-left:18px">${eksikler.map((e) => html`<li>${e.urun} ${e.parti} ${H.ambalajAdi(d, e.ambalaj)}: rafta ${e.mevcut}, istenen ${e.istenen}</li>`)}</ul>`,
      }))) return;
      const v = { tarih: f.tarih, firma: f.firma.trim(), yetkili: f.yetkili.trim(), telefon: f.telefon.trim(), irtibatDetay: f.irtibatDetay.trim(), talepTarihi: f.talepTarihi, sorumlu: f.sorumlu.trim(), geriBildirim: f.geriBildirim.trim(), numuneYeri: f.numuneYeri.trim(), sekil: f.sekil, sebep: f.sebep.trim(), durum: f.durum, kargoFirma: f.kargoFirma.trim(), takipNo: f.takipNo.trim(), kargoBelge: f.kargoBelge, ulke: f.ulke, adres: f.adres.trim(), notlar: f.notlar.trim(), ekler: f.ekler, kalemler, siseler: H.siseTemizle(kalemler, f.siseler) };
      if (kayit) {
        const fark = farklar(kayit, v);
        if (Object.keys(fark).length) await d.kaydet([{ c: 'sevk', k: kayit.id, v: fark }]);
        bildir(`${kayit.no} güncellendi.`);
      } else {
        const no = H.yeniNo(d, 'sevk', f.tarih);
        await d.kaydet([{ c: 'sevk', k: uid(), v: { no, ...v } }]);
        bildir(`${no} kaydedildi · ${v.firma}`);
      }
      kapat();
    }

    const kalemDegis = (i) => (k) => setF((p) => ({ ...p, kalemler: p.kalemler.map((x, j) => (j === i ? k : x)) }));
    return html`<${Modal} genis baslik=${kayit ? `Sevkiyat ${kayit.no}` : 'Yeni numune sevkiyatı'} kapat=${kapat}
      sag=${kayit && (kayit.iptal ? html`<span class="rozet yok"><${Ikon} ad="kapat" />İptal edildi</span>` : html`<${SevkRozeti} durum=${kayit.durum} />`)}
      alt=${html`
        ${kayit && html`<div class="sol"><button class="d tehlike" title="Yanlış girilmiş kayıt: çöp kutusuna gider" onClick=${async () => (await sil('sevk', kayit)) && kapat()}><${Ikon} ad="cop" />Sil</button>
          ${kayit.iptal ? html`<button class="d" onClick=${() => iptalGeriAl(kayit)}><${Ikon} ad="geri" />İptali geri al</button>`
            : html`<button class="d" title="Vazgeçilen gönderi: kayıt kalır, stoktan düşmez" onClick=${async () => (await iptalEt(kayit)) && kapat()}><${Ikon} ad="kapat" />İptal et</button>`}
          <button class="d" onClick=${() => NT.etiket.ac({ tur: 'sevk', kayit: { ...kayit, ...f, kalemler, siseler: H.siseTemizle(kalemler, f.siseler) } })}><${Ikon} ad="yazici" />Gönderi etiketi</button></div>`}
        <button class="d hayalet" onClick=${kapat}>Vazgeç</button>
        <button class="d ana-d" onClick=${kaydet}><${Ikon} ad="tik" />${kayit ? 'Kaydet' : 'Sevkiyatı kaydet'}</button>`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        ${kayit?.iptal && html`<div class="s12 uyari-kutu yok"><${Ikon} ad="kapat" /><span><b>Bu gönderi iptal edildi</b>${kayit.iptalTarihi ? ` (${tarihYaz(kayit.iptalTarihi)})` : ''}${kayit.iptalNeden ? `: ${kayit.iptalNeden}` : ''}. Stoku etkilemez.</span></div>`}
        <div class="form-bolum">Alıcı</div>
        <${Alan} etiket="Firma" sinif="s6" hata=${denendi && hatalar.firma} ipucu="Daha önce gönderilen firmada yetkili ve adres otomatik gelir.">
          <input class="girdi" list="firma-dl" value=${f.firma} onInput=${(e) => s('firma')(e.target.value)} onChange=${(e) => firmaSec(e.target.value)} placeholder="Firma adı" autofocus=${!kayit} />
          <${Oneri} id="firma-dl" liste=${firmalar} />
        <//>
        <${Alan} etiket="İrtibat yetkilisi" sinif="s6">
          <input class="girdi" list="yetkili-dl" value=${f.yetkili} onInput=${(e) => s('yetkili')(e.target.value)} placeholder="Ad Soyad (Unvan)" />
          <${Oneri} id="yetkili-dl" liste=${benzersiz(onceki.filter((r) => r.firma === f.firma).map((r) => r.yetkili))} />
        <//>
        <${Alan} etiket="Telefon" sinif="s6"><${TelefonGirdisi} deger=${f.telefon} degis=${s('telefon')} ulke=${f.ulke} /><//>
        <${Alan} etiket="Talep sebebi" sinif="s6">
          <input class="girdi" list="sebep-dl" value=${f.sebep} onInput=${(e) => s('sebep')(e.target.value)} placeholder="Örn: Saha asfalt modifikasyonu denemesi" />
          <${Oneri} id="sebep-dl" liste=${benzersiz(onceki.map((r) => r.sebep))} />
        <//>
        <${Alan} etiket="Diğer iletişim bilgileri" sinif="s12" ipucu="Unvan, e-posta, ek telefon… Excel’de irtibat kişisinin altına yazılır.">
          <textarea class="girdi" rows="2" value=${f.irtibatDetay} onInput=${(e) => s('irtibatDetay')(e.target.value)} placeholder="Örn: Product Manager · ad.soyad@firma.com" />
        <//>
        <${Alan} etiket="Talep tarihi" sinif="s4"><input class="girdi" type="date" value=${f.talepTarihi} onInput=${(e) => s('talepTarihi')(e.target.value)} /><//>
        <${Alan} etiket="Sorumlu" sinif="s4">
          <input class="girdi" list="sorumlu-dl" value=${f.sorumlu} onInput=${(e) => s('sorumlu')(e.target.value)} placeholder="Talebi takip eden kişi" />
          <${Oneri} id="sorumlu-dl" liste=${benzersiz([kullanici(), ...onceki.map((r) => r.sorumlu)])} />
        <//>
        <${Alan} etiket="Geri bildirim" sinif="s4">
          <input class="girdi" list="geribildirim-dl" value=${f.geriBildirim} onInput=${(e) => s('geriBildirim')(e.target.value)} placeholder="Örn: Yes, Positive" />
          <${Oneri} id="geribildirim-dl" liste=${benzersiz(['Yes, Positive', 'Yes, Negative', 'No', ...onceki.map((r) => r.geriBildirim)])} />
        <//>

        <div class="form-bolum">Gönderilen numuneler</div>
        <div class="s12">
          ${f.kalemler.map((k, i) => html`<${KalemSatiri} key=${k.anahtar} k=${k} haricId=${kayit?.id} tekMi=${f.kalemler.length === 1} degis=${kalemDegis(i)} kaldir=${() => setF((p) => ({ ...p, kalemler: p.kalemler.filter((_, j) => j !== i) }))} />`)}
          <div class="dugmeler" style="margin-top:8px">
            <button type="button" class="d kucuk-d" onClick=${() => setF((p) => ({ ...p, kalemler: [...p.kalemler, bosKalem(d)] }))}><${Ikon} ad="arti" boyut=${15} />Kalem ekle</button>
            ${denendi && hatalar.kalem && html`<span class="hata-yazi kucuk">${hatalar.kalem}</span>`}
          </div>
        </div>
        <${Alan} etiket="Numune noktası / parti açıklaması" sinif="s12" ipucu="İsteğe bağlı. Doluysa Excel’in “Batch / Point of sampling” sütununa parti yerine bu yazılır.">
          <input class="girdi" value=${f.numuneYeri} onInput=${(e) => s('numuneYeri')(e.target.value)} placeholder="Örn: H-4 during of cooling of 3rd synthesis" />
        <//>

        <div class="form-bolum">Şişe etiketleri</div>
        <div class="s12"><${SiseEtiketleri} kalemler=${kalemler} siseler=${f.siseler} degis=${s('siseler')} haricId=${kayit?.id} /></div>

        <div class="form-bolum">Gönderi</div>
        <${Alan} etiket="Durum" sinif="s8" ipucu="Sadece “Gönderildi” olunca dolu stoktan düşer; diğerleri rezerve görünür.">
          <${Secenekler} liste=${H.SEVK_DURUMLARI} deger=${f.durum} degis=${s('durum')} />
        <//>
        <${Alan} etiket="Tarih" sinif="s4"><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih')(e.target.value)} /><//>
        ${f.durum === 'Gönderildi' && eksikler.length > 0 && html`<div class="s12 uyari-kutu yok"><${Ikon} ad="uyari" /><span>Rafta yetersiz: ${eksikler.map((e) => `${e.urun} ${e.parti} ${H.ambalajAdi(d, e.ambalaj)} (rafta ${e.mevcut}, istenen ${e.istenen})`).join(' · ')}</span></div>`}
        <${Alan} etiket="Gönderi şekli" sinif="s4"><${Secenekler} liste=${H.GONDERI_SEKILLERI} deger=${f.sekil} degis=${s('sekil')} /><//>
        ${f.sekil !== 'Elden' ? html`
          <${Alan} etiket=${f.sekil === 'Kurye' ? 'Kurye firması' : 'Kargo firması'} sinif="s8">
            <input class="girdi" list="kargo-dl" value=${f.kargoFirma} onInput=${(e) => s('kargoFirma')(e.target.value)} placeholder="Yurtiçi / Aras / MNG" />
            <${Oneri} id="kargo-dl" liste=${benzersiz(['Yurtiçi Kargo', 'Aras Kargo', 'MNG Kargo', 'Sürat Kargo', 'PTT Kargo', 'UPS', 'DHL', ...onceki.map((r) => r.kargoFirma)])} />
          <//>
          <div class="s12"><${BelgeKutusu} baslik=${(f.sekil === 'Kurye' ? 'Kurye' : 'Kargo') + ' gönderi belgesi'} ekler=${f.kargoBelge} degis=${s('kargoBelge')}
            ipucu="Kargo firmasından gelen belge (takip no içinde); gönderince de yüklenebilir" eski=${f.takipNo && `Eski kayıt: takip no ${f.takipNo}`} /></div>`
        : html`<div class="s8"></div>`}
        <${Alan} etiket="Ülke" sinif="s4"><${UlkeSecimi} deger=${f.ulke} degis=${s('ulke')} /><//>
        <${Alan} etiket="Teslim adresi" sinif="s8"><textarea class="girdi" rows="2" value=${f.adres} onInput=${(e) => s('adres')(e.target.value)} /><//>
        <${Alan} etiket="Not" sinif="s12"><textarea class="girdi" rows="2" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} placeholder="Örn: MSDS ve analiz sertifikası pakete eklendi." /><//>
        <${Alan} etiket="Ekler" ipucu="İrsaliye vb. (kargo belgesi ve şişe etiketleri yukarıda)"><${Ekler} ekler=${f.ekler} degis=${s('ekler')} /><//>
        <${GecmisBolumu} kayit=${kayit} />
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }

  /* ---------------- Ambalaj alımı ---------------- */
  function AlimFormu({ kayit, kapat, on = {} }) {
    const d = depo();
    const amb = H.ambalajlar(d);
    const [f, setF] = useState(() => kayit
      ? { tarih: kayit.tarih || bugun(), ambalaj: kayit.ambalaj, adet: kayit.adet, tedarikci: kayit.tedarikci || '', faturaNo: kayit.faturaNo || '', birimFiyat: kayit.birimFiyat ?? '', notlar: kayit.notlar || '', ekler: kayit.ekler || [] }
      : { tarih: bugun(), ambalaj: '1L', adet: 10, tedarikci: '', faturaNo: '', birimFiyat: '', notlar: '', ekler: [], ...on });
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const [denendi, setDenendi] = useState(false);
    const hata = !(sayi(f.adet) > 0) && 'Adet 0’dan büyük olmalı';
    async function kaydet() {
      setDenendi(true);
      if (hata || !f.tarih) return;
      const v = { tarih: f.tarih, ambalaj: f.ambalaj, adet: sayi(f.adet), tedarikci: f.tedarikci.trim(), faturaNo: f.faturaNo.trim(), birimFiyat: f.birimFiyat === '' ? '' : sayi(f.birimFiyat), notlar: f.notlar.trim(), ekler: f.ekler };
      if (kayit) {
        const fark = farklar(kayit, v);
        if (Object.keys(fark).length) await d.kaydet([{ c: 'alim', k: kayit.id, v: fark }]);
        bildir(`${kayit.no} güncellendi.`);
      } else {
        const no = H.yeniNo(d, 'alim', f.tarih);
        await d.kaydet([{ c: 'alim', k: uid(), v: { no, ...v } }]);
        bildir(`${no} kaydedildi · ${v.adet} × ${H.ambalajAdi(d, v.ambalaj)} boş şişe`);
      }
      kapat();
    }
    const tedarikciler = benzersiz(d.kayitlar('alim').map((r) => r.tedarikci));
    return html`<${Modal} baslik=${kayit ? `Alım ${kayit.no}` : 'Boş ambalaj alımı'} kapat=${kapat}
      alt=${html`${kayit && html`<div class="sol"><button class="d tehlike" onClick=${async () => (await sil('alim', kayit)) && kapat()}><${Ikon} ad="cop" />Sil</button></div>`}
        <button class="d hayalet" onClick=${kapat}>Vazgeç</button><button class="d ana-d" onClick=${kaydet}><${Ikon} ad="tik" />Kaydet</button>`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket="Ambalaj" ipucu="Yanındaki sayı: raftaki mevcut boş şişe"><${Secenekler} liste=${amb} deger=${f.ambalaj} degis=${s('ambalaj')} ek=${(id) => H.bosMevcut(d, id)} /><//>
        <${Alan} etiket="Alınan adet" sinif="s4" hata=${denendi && hata}><${AdetGirdi} deger=${f.adet} degis=${s('adet')} min=${1} /><//>
        <${Alan} etiket="Tarih" sinif="s4"><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih')(e.target.value)} /><//>
        <${Alan} etiket="Birim fiyat (₺)" sinif="s4"><input class="girdi" inputmode="decimal" value=${f.birimFiyat} onInput=${(e) => s('birimFiyat')(e.target.value)} placeholder="İsteğe bağlı" /><//>
        <${Alan} etiket="Tedarikçi" sinif="s6"><input class="girdi" list="ted-dl" value=${f.tedarikci} onInput=${(e) => s('tedarikci')(e.target.value)} /><${Oneri} id="ted-dl" liste=${tedarikciler} /><//>
        <${Alan} etiket="Fatura / irsaliye no" sinif="s6"><input class="girdi mono" value=${f.faturaNo} onInput=${(e) => s('faturaNo')(e.target.value)} /><//>
        <${Alan} etiket="Not"><textarea class="girdi" rows="2" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} /><//>
        <${Alan} etiket="Ekler" ipucu="Fatura PDF’i vb."><${Ekler} ekler=${f.ekler} degis=${s('ekler')} /><//>
        <${GecmisBolumu} kayit=${kayit} />
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }

  /* ---------------- Sayım düzeltmesi ---------------- */
  function SayimFormu({ hedef, kapat }) {
    const d = depo();
    const bosMu = !!hedef.bos;
    const sistem = bosMu ? H.bosMevcut(d, hedef.ambalaj) : H.doluMevcut(d, hedef.urun, hedef.parti, hedef.ambalaj);
    const [sayilan, setSayilan] = useState(Math.max(0, sistem));
    const [neden, setNeden] = useState('');
    const fark = sayi(sayilan) - sistem;
    const ad = bosMu ? `${H.ambalajAdi(d, hedef.ambalaj)} boş şişe` : `${hedef.urun}${hedef.parti ? ' · ' + hedef.parti : ''} · ${H.ambalajAdi(d, hedef.ambalaj)}`;
    async function kaydet() {
      if (sayilan === '' || fark === 0) return kapat();
      const no = H.yeniNo(d, 'sayim');
      await d.kaydet([{ c: 'sayim', k: uid(), v: { no, tarih: bugun(), tur: bosMu ? 'bos' : 'dolu', urun: hedef.urun || '', parti: hedef.parti || '', ambalaj: hedef.ambalaj, onceki: sistem, sayilan: sayi(sayilan), fark, neden: neden.trim() || 'Fiziksel sayım' } }]);
      bildir(`${ad}: ${sistem} → ${sayilan} olarak düzeltildi.`);
      kapat();
    }
    return html`<${Modal} dar baslik="Sayım düzeltmesi" kapat=${kapat} alt=${html`<button class="d hayalet" onClick=${kapat}>Vazgeç</button><button class="d ana-d" disabled=${fark === 0} onClick=${kaydet}><${Ikon} ad="tik" />Düzeltmeyi kaydet</button>`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <div class="s12"><div class="ust-satir">${ad}</div><div class="alt-satir">Rafta fiilen saydığınız adedi girin. Sistem aradaki farkı bir düzeltme hareketi olarak kaydeder; geçmiş kayıtlar değişmez.</div></div>
        <${Alan} etiket="Sistemdeki" sinif="s4"><div class="girdi sayi" style="background:var(--yuzey3);font-weight:700">${sistem}</div><//>
        <${Alan} etiket="Sayılan" sinif="s4"><${AdetGirdi} deger=${sayilan} degis=${setSayilan} otomatikOdak /><//>
        <${Alan} etiket="Fark" sinif="s4"><div class="girdi sayi" style=${{ background: 'var(--yuzey3)', fontWeight: 700, color: fark < 0 ? 'var(--yok)' : fark > 0 ? 'var(--iyi)' : '' }}>${fark > 0 ? '+' : ''}${fark}</div><//>
        <${Alan} etiket="Neden"><input class="girdi" value=${neden} onInput=${(e) => setNeden(e.target.value)} placeholder="Örn: Ay sonu sayımı, kırık şişe, kayıt dışı gönderim" /><//>
      </form>
    <//>`;
  }

  /* Modal yönetimi: tek yerden aç/kapat */
  /* Pencere yığını: etiket penceresi açık formun üstüne açılır, form kaybolmaz. */
  const acik = { yigin: [], dinle: new Set() };
  const yay = () => acik.dinle.forEach((f) => f());
  function ac(bilesen, props = {}) { acik.yigin = [...acik.yigin, { bilesen, props, id: uid(6) }]; yay(); }
  function kapat() { acik.yigin = acik.yigin.slice(0, -1); yay(); }
  function FormKatmani() {
    const [, yenile] = useState(0);
    window.htmPreact.useEffect(() => { const f = () => yenile((x) => x + 1); acik.dinle.add(f); return () => acik.dinle.delete(f); }, []);
    return html`${acik.yigin.map(({ bilesen: B, props, id }, i) => html`<div key=${id} style=${i < acik.yigin.length - 1 ? 'display:none' : ''}><${B} ...${props} kapat=${kapat} /></div>`)}`;
  }

  NT.form = {
    KalemBelgeleri,
    DolumFormu, SevkFormu, AlimFormu, SiseEtiketleri, SayimFormu, FormKatmani, ac, kapat, sil, tarihYaz, iptalEt, iptalGeriAl, UlkeSecimi, TelefonGirdisi,
    yeniDolum: (on) => ac(DolumFormu, { on }),
    yeniSevk: (on) => ac(SevkFormu, { on }),
    yeniAlim: (on) => ac(AlimFormu, { on }),
    kayitAc: (c, kayit) => ac({ dolum: DolumFormu, sevk: SevkFormu, alim: AlimFormu }[c], { kayit, key: kayit.id }),
    sayim: (hedef) => ac(SayimFormu, { hedef }),
  };
})();
