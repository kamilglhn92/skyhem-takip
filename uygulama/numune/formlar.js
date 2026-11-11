/* Kayıt formları: dolum, sevkiyat, ambalaj alımı, sayım düzeltmesi. */
(function () {
  'use strict';
  const NT = window.NT;
  const cevir = NT.dil.t;
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
    if (!(await onayla(NT.dil.m("{0} silinsin mi? Stok hesabı buna göre güncellenir. Silinen kayıt Ayarlar › Çöp kutusundan geri alınabilir.", kayit.no || ad), { baslik: cevir("Kaydı sil"), evet: cevir("Sil"), tehlike: true }))) return false;
    await depo().kaydet([{ op: 'del', c, k: kayit.id }]);
    bildir(NT.dil.m("{0} silindi.", kayit.no || ad), { eylem: { yazi: 'Geri al', fn: () => depo().kaydet([{ op: 'undel', c, k: kayit.id }]) } });
    return true;
  }

  /* İptal: gönderi kaydı silinmez, "iptal edildi" olarak kalır; stoktan düşmez, rezerve tutmaz, yolda sayılmaz.
     Yanlış girilmiş kayıt için ise Sil kullanılır (çöp kutusuna gider). */
  async function iptalEt(s) {
    let neden = '';
    const detay = html`<input class="girdi" style="margin-top:12px" placeholder=${cevir("Neden? (isteğe bağlı, örn. müşteri vazgeçti)")} onInput=${(e) => { neden = e.target.value; }} />`;
    if (!(await onayla(NT.dil.m("{0} · {1} iptal edilsin mi? Kayıt silinmez; Gönderiler › İptal altında kalır ve şişeler rafa geri sayılır.", s.no, s.firma), { baslik: cevir("Gönderiyi iptal et"), evet: cevir("İptal et"), tehlike: true, detay }))) return false;
    await depo().kaydet([{ c: 'sevk', k: s.id, v: { iptal: true, iptalNeden: neden.trim(), iptalTarihi: bugun() } }]);
    bildir(NT.dil.m("{0} iptal edildi.", s.no), { eylem: { yazi: 'Geri al', fn: () => iptalGeriAl(s, true) } });
    return true;
  }
  async function iptalGeriAl(s, sessiz) {
    await depo().kaydet([{ c: 'sevk', k: s.id, v: { iptal: false, iptalNeden: '', iptalTarihi: '' } }]);
    if (!sessiz) bildir(NT.dil.m("{0} yeniden etkin.", s.no));
  }

  /* Ülke açılır listesi: Türkiye ve daha önce gönderilen ülkeler üstte. */
  function UlkeSecimi({ deger, degis, stil }) {
    const { sik, hepsi } = H.ulkeler(depo());
    const ekstra = deger && !sik.includes(deger) && !hepsi.includes(deger) ? [deger] : [];
    return html`<select class="girdi" style=${stil} value=${deger || ''} onChange=${(e) => degis(e.target.value)}>
      <option value="">${cevir("— Ülke seçin —")}</option>
      <optgroup label=${cevir("Sık kullanılan", "Frequently used")}>${[...sik, ...ekstra].map((u) => html`<option value=${u}>${cevir(u)}</option>`)}</optgroup>
      <optgroup label=${cevir("Tüm ülkeler", "All countries")}>${hepsi.map((u) => html`<option value=${u}>${cevir(u)}</option>`)}</optgroup>
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
      <select class="girdi" style="flex:0 0 150px;min-width:0" aria-label=${cevir("Ülke kodu")} value=${iso} onChange=${(e) => { setIso(e.target.value); degis(H.telefonBirlestir(e.target.value, numara)); }}>
        <optgroup label=${cevir("Sık kullanılan", "Frequently used")}>${ust.map(secenek)}</optgroup>
        <optgroup label=${cevir("Tüm ülkeler", "All countries")}>${liste.filter((u) => !ust.includes(u)).map(secenek)}</optgroup>
      </select>
      <input class="girdi" style="flex:1;min-width:0" type="tel" aria-label=${cevir("Telefon numarası")} value=${numara} placeholder=${cevir("Numara")} onInput=${(e) => degis(H.telefonBirlestir(iso, e.target.value))} />
    </div>`;
  }


  function Secenekler({ liste, deger, degis, ek }) {
    return html`<div class="secenekler">${liste.map((x) => {
      const id = typeof x === 'string' ? x : x.id;
      const ad = typeof x === 'string' ? x : x.ad;
      return html`<button type="button" class=${'secenek' + (deger === id ? ' secili' : '')} onClick=${() => degis(id)}>${cevir(ad)}${ek && html`<span class="ek">${ek(id)}</span>`}</button>`;
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
        <input class="girdi" placeholder=${cevir("Başka kişi…")} value=${yeni} onInput=${(e) => setYeni(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); ekle(); } }} />
        <button type="button" class="d kucuk-d" disabled=${!yeni.trim()} onClick=${ekle}><${Ikon} ad="arti" boyut=${14} />${cevir("Ekle")}</button>
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
      dolduranlar: (!kayit || (kayit.dolduranlar || []).length > 0) && !f.dolduranlar.length && 'Dolumu yapan kişiyi seçin',
    };
    const gecerli = !Object.values(hatalar).some(Boolean);

    async function kaydet() {
      setDenendi(true);
      if (!gecerli) return;
      if (yetersiz && !(await onayla(NT.dil.m('{0} boş şişe stokunda {1} adet görünüyor, {2} adet dolum girdiniz. Kaydederseniz boş şişe stoku eksiye düşer — sayım farkı olabilir.', H.ambalajAdi(d, f.ambalaj), bos, f.adet), { baslik: cevir("Boş şişe yetersiz"), evet: cevir("Yine de kaydet") }))) return;
      const v = { tarih: f.tarih, urun: f.urun, parti: partili ? f.parti.trim() : '', ambalaj: f.ambalaj, adet: sayi(f.adet), hazirlayan: f.hazirlayan.trim(), dolduranlar: f.dolduranlar, kaynakTur: f.kaynakTur, kaynakNo: f.kaynakTur ? f.kaynakNo.trim() : '', notlar: f.notlar.trim(), ekler: f.ekler };
      // Açık kap: kaynak kap korunur, alınan litre yeni adet/ambalaja göre; kaynak türü değişirse bağ kalkar.
      if (kayit?.kaynakKap) {
        if (f.kaynakTur === 'Numune') v.alinanLitre = sayi(f.adet) * sayi(amb.find((a) => a.id === f.ambalaj)?.litre ?? H.ambalajlar(d, { hepsi: true }).find((a) => a.id === f.ambalaj)?.litre);
        else v.kaynakKap = null;
      }
      if (kayit) {
        const fark = farklar(kayit, v);
        if (Object.keys(fark).length) await d.kaydet([{ c: 'dolum', k: kayit.id, v: fark }]);
        bildir(NT.dil.m("{0} güncellendi.", kayit.no));
      } else {
        const no = H.yeniNo(d, 'dolum', f.tarih);
        await d.kaydet([{ c: 'dolum', k: uid(), v: { no, ...v } }]);
        bildir(NT.dil.m("{0} kaydedildi · {1} × {2} {3}", no, v.adet, f.urun, H.ambalajAdi(d, f.ambalaj)));
      }
      kapat();
    }

    return html`<${Modal} baslik=${kayit ? NT.dil.m("Dolum {0}", kayit.no) : cevir("Yeni numune dolumu")} kapat=${kapat}
      alt=${html`
        ${kayit && html`<div class="sol"><button class="d tehlike" onClick=${async () => (await sil('dolum', kayit)) && kapat()}><${Ikon} ad="cop" />${cevir("Sil")}</button></div>`}
        <button class="d hayalet" onClick=${kapat}>${cevir("Vazgeç")}</button>
        <button class="d ana-d" onClick=${kaydet}><${Ikon} ad="tik" />${kayit ? cevir("Kaydet") : cevir("Dolumu kaydet")}</button>`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket=${cevir("Ürün")} hata=${denendi && hatalar.urun}>
          <${Secenekler} liste=${urunler.map((u) => u.ad)} deger=${f.urun} degis=${(v) => setF((p) => ({ ...p, urun: v, parti: '' }))} />
        <//>
        ${partili && html`<${Alan} etiket=${cevir("Parti (Batch) no")} hata=${denendi && hatalar.parti} ipucu=${cevir("Son partiler üstte. Yeni bir parti ise yazın veya önerilene tıklayın. Karışımsa “Batch #3 + Batch #20” biçiminde yazın.")}>
          <div class="secenekler">
            <button type="button" class=${'secenek' + (f.parti === sonraki ? ' secili' : '')} onClick=${() => s('parti')(sonraki)}><${Ikon} ad="arti" boyut=${12} /> ${sonraki}<span class="ek">${cevir("yeni")}</span></button>
            ${partiler.slice(0, 6).map((p) => html`<button type="button" class=${'secenek' + (f.parti === p ? ' secili' : '')} onClick=${() => s('parti')(p)}>${p}</button>`)}
          </div>
          <input class="girdi" list="partiler-dl" placeholder=${cevir("Örn: Batch #23")} value=${f.parti} onInput=${(e) => s('parti')(e.target.value)} />
          <${Oneri} id="partiler-dl" liste=${partiler} />
        <//>`}
        <${Alan} etiket=${cevir("Ambalaj")} ipucu=${cevir("Yanındaki sayı: raftaki boş şişe")}>
          <${Secenekler} liste=${amb} deger=${f.ambalaj} degis=${s('ambalaj')} ek=${(id) => H.bosMevcut(d, id)} />
        <//>
        <${Alan} etiket=${cevir("Doldurulan adet")} sinif="s4" hata=${denendi && hatalar.adet}><${AdetGirdi} deger=${f.adet} degis=${s('adet')} min=${1} /><//>
        <${Alan} etiket=${cevir("Dolum tarihi")} sinif="s4" hata=${denendi && hatalar.tarih}><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Hazırlayan")} sinif="s4">
          <input class="girdi" list="hazirlayan-dl" value=${f.hazirlayan} onInput=${(e) => s('hazirlayan')(e.target.value)} />
          <${Oneri} id="hazirlayan-dl" liste=${benzersiz(d.kayitlar('dolum').map((r) => r.hazirlayan))} />
        <//>
        <${Alan} etiket=${cevir("Dolumu yapanlar")} hata=${denendi && hatalar.dolduranlar} ipucu=${cevir("Birden fazla kişi seçilebilir. Hazırlayan: kaydı giren kişi.")}>
          <${DolduranSecimi} secili=${f.dolduranlar} degis=${s('dolduranlar')} />
        <//>
        ${yetersiz && html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${H.ambalajAdi(d, f.ambalaj)} ${cevir("boş şişe stoku")} ${bos} ${cevir("adet. Bu dolum stoku eksiye düşürür.")}</span></div>`}
        <${Alan} etiket=${cevir("Nereden dolduruldu?")} sinif=${f.kaynakTur ? 's8' : 's12'}>
          <${Secenekler} liste=${H.DOLUM_KAYNAKLARI} deger=${f.kaynakTur} degis=${(v) => s('kaynakTur')(f.kaynakTur === v ? '' : v)} />
        <//>
        ${f.kaynakTur && html`<${Alan} etiket=${H.DOLUM_KAYNAKLARI.find((x) => x.id === f.kaynakTur)?.no} sinif="s4">
          <input class="girdi mono" list="kaynakno-dl" value=${f.kaynakNo} onInput=${(e) => s('kaynakNo')(e.target.value)} />
          <${Oneri} id="kaynakno-dl" liste=${benzersiz(d.kayitlar('dolum').filter((r) => r.kaynakTur === f.kaynakTur).map((r) => r.kaynakNo))} />
        <//>`}
        ${kayit?.kaynakKap && f.kaynakTur === 'Numune' && html`<div class="s12 uyari-kutu bilgi"><${Ikon} ad="bilgi" /><span>${cevir("Kaynak kap:")} <b>${kayit.kaynakKap.urun} ${kayit.kaynakKap.parti || ''} · ${H.ambalajAdi(d, kayit.kaynakKap.ambalaj)}</b>${cevir(". Adedi değiştirirseniz açık kaptan alınan miktar da değişir.")}</span></div>`}
        <${Alan} etiket=${cevir("Not")}><textarea class="girdi" rows="2" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} placeholder=${cevir("Örn: Müşteri talebine istinaden hazırlandı, sevkiyat rafına alındı.")} /><//>
        <${Alan} etiket=${cevir("Ekler")} ipucu=${cevir("Analiz sertifikası vb. Buluta kaydedilir (en fazla 8 MB). Şişe etiketleri gönderi kaydına yüklenir.")}><${Ekler} ekler=${f.ekler} degis=${s('ekler')} /><//>
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
      <div class="alan"><label>${cevir("Ürün")}</label>
        <select class="girdi" value=${k.urun} onChange=${(e) => degis({ ...k, urun: e.target.value, parti: '' })}>
          ${urunler.map((x) => html`<option value=${x.ad}>${x.ad}</option>`)}
          ${k.urun && !u && html`<option value=${k.urun}>${k.urun}</option>`}
        </select></div>
      <div class="alan"><label>${cevir("Parti")}</label>
        ${u?.partili
          ? html`<select class="girdi" value=${k.parti} onChange=${(e) => s('parti')(e.target.value)}>
              <option value="">${cevir("Seçin…")}</option>
              ${partiSirali.map((p) => html`<option value=${p}>${p} (${partiToplam(p)} ${cevir("dolu)")}</option>`)}
              ${k.parti && !partiler.includes(k.parti) && html`<option value=${k.parti}>${k.parti}</option>`}
            </select>`
          : html`<div class="girdi soluk" style="background:var(--yuzey3)">${cevir("Partisiz")}</div>`}
      </div>
      <div class="alan"><label>${cevir("Ambalaj")}</label>
        <select class="girdi" value=${k.ambalaj} onChange=${(e) => s('ambalaj')(e.target.value)}>
          ${H.ambalajlar(d).map((a) => html`<option value=${a.id}>${a.ad} · ${mevcut(k.parti, a.id)} ${cevir("dolu")}</option>`)}
        </select></div>
      <div class="alan"><label>${cevir("Adet")}</label><${AdetGirdi} deger=${k.adet} degis=${s('adet')} min=${1} />
        <span class=${'mevcut ' + (sayi(k.adet) > m ? 'hata-yazi' : 'soluk')}>${cevir("Rafta")} ${m} ${cevir("adet")}</span></div>
      <div class="alan"><label> </label><button type="button" class="d hayalet ikon-d" disabled=${tekMi} onClick=${kaldir} title=${cevir("Kalemi kaldır")}><${Ikon} ad="cop" /></button></div>
      <${KalemBelgeleri} k=${k} degis=${degis} />
    </div>`;
  }

  /* Gönderinin her kaleminin kendi belgeleri (CoA / analiz, MSDS…): kalem satırının altında. */
  function KalemBelgeleri({ k, degis }) {
    return html`<div class="belge-izgara kalem-belgeleri">
      <${BelgeKutusu} baslik=${cevir("CoA / analiz (bu kalem)")} ekler=${k.coaBelge} degis=${(v) => degis({ ...k, coaBelge: v })} ipucu=${k.parti ? NT.dil.m("{0} için", k.parti) : cevir("Bu kalemin analiz sertifikası")} />
      <${BelgeKutusu} baslik=${cevir("Diğer belgeler (bu kalem)")} ekler=${k.belgeler} degis=${(v) => degis({ ...k, belgeler: v })} ipucu=${cevir("MSDS vb.")} />
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
      if (buyuk) return bildir(NT.dil.m("{0} 15 MB'tan büyük.", buyuk.name), { tur: 'hata' });
      if (dosyalar.length > hedefler.length) bildir(NT.dil.m("{0} dosya seçildi, {1} boş şişe var; fazlası yüklenmedi.", dosyalar.length, hedefler.length), { tur: 'hata' });
      setYukleniyor(true);
      try {
        const yeni = yuvalar.map((g) => g.map((x) => ({ ...x })));
        for (let n = 0; n < Math.min(dosyalar.length, hedefler.length); n++) {
          const [i, j] = hedefler[n];
          yeni[i][j].ek = await d.ekYaz(dosyalar[n]);
        }
        degis(yeni.flat());
      } catch (err) { bildir(cevir('Etiket yüklenemedi', 'Label upload failed') + ': ' + err.message, { tur: 'hata' }); }
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
    if (!hepsi.length) return html`<p class="soluk kucuk">${cevir("Önce gönderilecek şişeleri seçin.")}</p>`;
    const etiketli = hepsi.filter((x) => x.ek).length;
    return html`<div class="sise-etiketleri">
      <div class="dugmeler" style="margin-bottom:10px">
        <button type="button" class="d kucuk-d" disabled=${yukleniyor || !bosYuvalar.length} onClick=${() => dosyaSec(bosYuvalar, true)}><${Ikon} ad="yukle" boyut=${15} />${yukleniyor ? cevir("Yükleniyor…") : cevir("Etiketleri toplu yükle")}</button>
        <span class="kucuk soluk">${etiketli}/${hepsi.length} ${cevir("şişenin etiketi var. Toplu yüklemede dosyalar ada göre sıralanıp boş şişelere sırayla konur.")}</span>
      </div>
      ${yuvalar.map((g, i) => g.length > 0 && html`<div class="sise-grup">
        <div class="sise-grup-bas">${kalemler[i].urun}${kalemler[i].parti ? ' · ' + kalemler[i].parti : ''} · ${H.ambalajAdi(d, kalemler[i].ambalaj)}</div>
        <div class="sise-izgara">${g.map((x, j) => html`<div class=${'sise-yuva' + (x.ek ? ' dolu' : '')}>
          <button type="button" class="sise-gorsel" title=${x.ek ? cevir("Etiketi aç") : cevir("Etiket yükle")} disabled=${yukleniyor} onClick=${() => (x.ek ? ekAc(x.ek) : dosyaSec([[i, j]], false))}>
            ${x.ek ? html`<${EkOnizleme} ek=${x.ek} />` : html`<span class="ek-simge"><${Ikon} ad="yukle" boyut=${20} /><small>${cevir("Etiket yükle")}</small></span>`}
          </button>
          <div class="sise-alt">
            <input class="girdi mono" aria-label=${cevir("Şişe no")} value=${x.no} placeholder="Sample no" onInput=${(e) => yaz(i, j, { no: e.target.value })} />
            ${x.ek && html`<button type="button" class="d hayalet ikon-d" title=${cevir("Etiketi kaldır")} onClick=${() => yaz(i, j, { ek: null })}><${Ikon} ad="kapat" boyut=${14} /></button>`}
          </div>
        </div>`)}</div>
      </div>`)}
    </div>`;
  }

  function SevkFormu({ kayit, kapat, on = {} }) {
    const d = depo();
    const [f, setF] = useState(() => {
      // Ülke: yeni gönderide Türkiye; ülkesi girilmemiş eski kayıtlarda boş kalır (yanlışlıkla Türkiye yazılmasın).
      const bos = { tarih: bugun(), firma: '', yetkili: '', telefon: '', irtibatDetay: '', talepTarihi: '', sorumlu: '', geriBildirim: '', numuneYeri: '', sekil: 'Kargo', sebep: '', durum: 'Beklemede', kargoFirma: '', takipNo: '', kargoBelge: [], ulke: kayit ? '' : 'Türkiye', adres: '', notlar: '', ekler: [], siseler: [], kalemler: [bosKalem(d)] };
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
      tarih: !f.tarih && 'Tarih girin',
      sorumlu: (!kayit || String(kayit.sorumlu || '').trim()) && !f.sorumlu.trim() && 'Sorumlu kişiyi seçin',
      kalem: kalemler.some((k) => !k.urun || !(k.adet > 0) || (H.urunBul(d, k.urun)?.partili && !k.parti)) && 'Her kalemde ürün, parti (partili ürünlerde) ve adet olmalı',
    };
    const gecerli = !Object.values(hatalar).some(Boolean);

    async function kaydet() {
      setDenendi(true);
      if (!gecerli) return;
      if (f.durum === 'Gönderildi' && eksikler.length && !(await onayla(cevir("Bazı kalemlerde raftaki dolu numune yetersiz. Kaydederseniz stok eksiye düşer."), {
        baslik: cevir("Stok yetersiz"), evet: cevir("Yine de gönderildi olarak kaydet"),
        detay: html`<ul style="margin:10px 0 0;padding-left:18px">${eksikler.map((e) => html`<li>${e.urun} ${e.parti} ${H.ambalajAdi(d, e.ambalaj)}${cevir(": rafta")} ${e.mevcut}${cevir(", istenen")} ${e.istenen}</li>`)}</ul>`,
      }))) return;
      const v = { tarih: f.tarih, firma: f.firma.trim(), yetkili: f.yetkili.trim(), telefon: f.telefon.trim(), irtibatDetay: f.irtibatDetay.trim(), talepTarihi: f.talepTarihi, sorumlu: f.sorumlu.trim(), geriBildirim: f.geriBildirim.trim(), numuneYeri: f.numuneYeri.trim(), sekil: f.sekil, sebep: f.sebep.trim(), durum: f.durum, kargoFirma: f.kargoFirma.trim(), takipNo: f.takipNo.trim(), kargoBelge: f.kargoBelge, ulke: f.ulke, adres: f.adres.trim(), notlar: f.notlar.trim(), ekler: f.ekler, kalemler, siseler: H.siseTemizle(kalemler, f.siseler) };
      if (kayit) {
        const fark = farklar(kayit, v);
        if (Object.keys(fark).length) await d.kaydet([{ c: 'sevk', k: kayit.id, v: fark }]);
        bildir(NT.dil.m("{0} güncellendi.", kayit.no));
      } else {
        const no = H.yeniNo(d, 'sevk', f.tarih);
        await d.kaydet([{ c: 'sevk', k: uid(), v: { no, ...v } }]);
        bildir(NT.dil.m("{0} kaydedildi · {1}", no, v.firma));
      }
      kapat();
    }

    const kalemDegis = (i) => (k) => setF((p) => ({ ...p, kalemler: p.kalemler.map((x, j) => (j === i ? k : x)) }));
    return html`<${Modal} genis baslik=${kayit ? NT.dil.m("Sevkiyat {0}", kayit.no) : cevir("Yeni numune sevkiyatı")} kapat=${kapat}
      sag=${kayit && (kayit.iptal ? html`<span class="rozet yok"><${Ikon} ad="kapat" />${cevir("İptal edildi")}</span>` : html`<${SevkRozeti} durum=${kayit.durum} />`)}
      alt=${html`
        ${kayit && html`<div class="sol"><button class="d tehlike" title=${cevir("Yanlış girilmiş kayıt: çöp kutusuna gider")} onClick=${async () => (await sil('sevk', kayit)) && kapat()}><${Ikon} ad="cop" />${cevir("Sil")}</button>
          ${kayit.iptal ? html`<button class="d" onClick=${() => iptalGeriAl(kayit)}><${Ikon} ad="geri" />${cevir("İptali geri al")}</button>`
            : html`<button class="d" title=${cevir("Vazgeçilen gönderi: kayıt kalır, stoktan düşmez")} onClick=${async () => (await iptalEt(kayit)) && kapat()}><${Ikon} ad="kapat" />${cevir("İptal et")}</button>`}
          <button class="d" onClick=${() => NT.etiket.ac({ tur: 'sevk', kayit: { ...kayit, ...f, kalemler, siseler: H.siseTemizle(kalemler, f.siseler) } })}><${Ikon} ad="yazici" />${cevir("Gönderi etiketi")}</button></div>`}
        <button class="d hayalet" onClick=${kapat}>${cevir("Vazgeç")}</button>
        <button class="d ana-d" onClick=${kaydet}><${Ikon} ad="tik" />${kayit ? cevir("Kaydet") : cevir("Sevkiyatı kaydet")}</button>`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        ${kayit?.iptal && html`<div class="s12 uyari-kutu yok"><${Ikon} ad="kapat" /><span><b>${cevir("Bu gönderi iptal edildi")}</b>${kayit.iptalTarihi ? ` (${tarihYaz(kayit.iptalTarihi)})` : ''}${kayit.iptalNeden ? `: ${kayit.iptalNeden}` : ''}${cevir(". Stoku etkilemez.")}</span></div>`}
        <div class="form-bolum">${cevir("Alıcı")}</div>
        <${Alan} etiket=${cevir("Firma")} sinif="s6" hata=${denendi && hatalar.firma} ipucu=${cevir("Daha önce gönderilen firmada yetkili ve adres otomatik gelir.")}>
          <input class="girdi" list="firma-dl" value=${f.firma} onInput=${(e) => s('firma')(e.target.value)} onChange=${(e) => firmaSec(e.target.value)} placeholder=${cevir("Firma adı")} autofocus=${!kayit} />
          <${Oneri} id="firma-dl" liste=${firmalar} />
        <//>
        <${Alan} etiket=${cevir("İrtibat yetkilisi")} sinif="s6">
          <input class="girdi" list="yetkili-dl" value=${f.yetkili} onInput=${(e) => s('yetkili')(e.target.value)} placeholder=${cevir("Ad Soyad (Unvan)")} />
          <${Oneri} id="yetkili-dl" liste=${benzersiz(onceki.filter((r) => r.firma === f.firma).map((r) => r.yetkili))} />
        <//>
        <${Alan} etiket=${cevir("Telefon")} sinif="s6"><${TelefonGirdisi} deger=${f.telefon} degis=${s('telefon')} ulke=${f.ulke} /><//>
        <${Alan} etiket=${cevir("Talep sebebi")} sinif="s6">
          <input class="girdi" list="sebep-dl" value=${f.sebep} onInput=${(e) => s('sebep')(e.target.value)} placeholder=${cevir("Örn: Saha asfalt modifikasyonu denemesi")} />
          <${Oneri} id="sebep-dl" liste=${benzersiz(onceki.map((r) => r.sebep))} />
        <//>
        <${Alan} etiket=${cevir("Diğer iletişim bilgileri")} sinif="s12" ipucu=${cevir("Unvan, e-posta, ek telefon… Excel’de irtibat kişisinin altına yazılır.")}>
          <textarea class="girdi" rows="2" value=${f.irtibatDetay} onInput=${(e) => s('irtibatDetay')(e.target.value)} placeholder="Örn: Product Manager · ad.soyad@firma.com" />
        <//>
        <${Alan} etiket=${cevir("Talep tarihi")} sinif="s4"><input class="girdi" type="date" value=${f.talepTarihi} onInput=${(e) => s('talepTarihi')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Sorumlu")} sinif="s4" hata=${denendi && hatalar.sorumlu}>
          <${NT.ui.KisiSec} etiket=${cevir("Sorumlu")} deger=${f.sorumlu} degis=${s('sorumlu')} liste=${NT.ui.kisiListesi(onceki.map((r) => r.sorumlu))} />
        <//>
        <${Alan} etiket=${cevir("Geri bildirim")} sinif="s4">
          <input class="girdi" list="geribildirim-dl" value=${f.geriBildirim} onInput=${(e) => s('geriBildirim')(e.target.value)} placeholder=${cevir("Örn: Yes, Positive")} />
          <${Oneri} id="geribildirim-dl" liste=${benzersiz(['Yes, Positive', 'Yes, Negative', 'No', ...onceki.map((r) => r.geriBildirim)])} />
        <//>

        <div class="form-bolum">${cevir("Gönderilen numuneler")}</div>
        <div class="s12">
          ${f.kalemler.map((k, i) => html`<${KalemSatiri} key=${k.anahtar} k=${k} haricId=${kayit?.id} tekMi=${f.kalemler.length === 1} degis=${kalemDegis(i)} kaldir=${() => setF((p) => ({ ...p, kalemler: p.kalemler.filter((_, j) => j !== i) }))} />`)}
          <div class="dugmeler" style="margin-top:8px">
            <button type="button" class="d kucuk-d" onClick=${() => setF((p) => ({ ...p, kalemler: [...p.kalemler, bosKalem(d)] }))}><${Ikon} ad="arti" boyut=${15} />${cevir("Kalem ekle")}</button>
            ${denendi && hatalar.kalem && html`<span class="hata-yazi kucuk">${cevir(hatalar.kalem)}</span>`}
          </div>
        </div>
        <${Alan} etiket=${cevir("Numune noktası / parti açıklaması")} sinif="s12" ipucu=${cevir("İsteğe bağlı. Doluysa Excel’in “Batch / Point of sampling” sütununa parti yerine bu yazılır.")}>
          <input class="girdi" value=${f.numuneYeri} onInput=${(e) => s('numuneYeri')(e.target.value)} placeholder=${cevir("Örn: H-4 during of cooling of 3rd synthesis")} />
        <//>

        <div class="form-bolum">${cevir("Şişe etiketleri")}</div>
        <div class="s12"><${SiseEtiketleri} kalemler=${kalemler} siseler=${f.siseler} degis=${s('siseler')} haricId=${kayit?.id} /></div>

        <div class="form-bolum">${cevir("Gönderi")}</div>
        <${Alan} etiket=${cevir("Durum")} sinif="s8" ipucu=${cevir("Sadece “Gönderildi” olunca dolu stoktan düşer; diğerleri rezerve görünür.")}>
          <${Secenekler} liste=${H.SEVK_DURUMLARI} deger=${f.durum} degis=${s('durum')} />
        <//>
        <${Alan} etiket=${cevir("Tarih")} sinif="s4" hata=${denendi && !f.tarih && 'Tarih girin'}><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih')(e.target.value)} /><//>
        ${f.durum === 'Gönderildi' && eksikler.length > 0 && html`<div class="s12 uyari-kutu yok"><${Ikon} ad="uyari" /><span>${cevir("Rafta yetersiz:")} ${eksikler.map((e) => `${e.urun} ${e.parti} ${H.ambalajAdi(d, e.ambalaj)} (rafta ${e.mevcut}, istenen ${e.istenen})`).join(' · ')}</span></div>`}
        <${Alan} etiket=${cevir("Gönderi şekli")} sinif="s4"><${Secenekler} liste=${H.GONDERI_SEKILLERI} deger=${f.sekil} degis=${s('sekil')} /><//>
        ${f.sekil !== 'Elden' ? html`
          <${Alan} etiket=${f.sekil === 'Kurye' ? cevir("Kurye firması") : cevir("Kargo firması")} sinif="s8">
            <input class="girdi" list="kargo-dl" value=${f.kargoFirma} onInput=${(e) => s('kargoFirma')(e.target.value)} placeholder=${cevir("Yurtiçi / Aras / MNG")} />
            <${Oneri} id="kargo-dl" liste=${benzersiz(['Yurtiçi Kargo', 'Aras Kargo', 'MNG Kargo', 'Sürat Kargo', 'PTT Kargo', 'UPS', 'DHL', ...onceki.map((r) => r.kargoFirma)])} />
          <//>
          <div class="s12"><${BelgeKutusu} baslik=${f.sekil === 'Kurye' ? 'Kurye gönderi belgesi' : 'Kargo gönderi belgesi'} ekler=${f.kargoBelge} degis=${s('kargoBelge')}
            ipucu=${cevir("Kargo firmasından gelen belge (takip no içinde); gönderince de yüklenebilir")} eski=${f.takipNo && NT.dil.m('Eski kayıt: takip no {0}', f.takipNo)} /></div>`
        : html`<div class="s8"></div>`}
        <${Alan} etiket=${cevir("Ülke")} sinif="s4"><${UlkeSecimi} deger=${f.ulke} degis=${s('ulke')} /><//>
        <${Alan} etiket=${cevir("Teslim adresi")} sinif="s8"><textarea class="girdi" rows="2" value=${f.adres} onInput=${(e) => s('adres')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Not")} sinif="s12"><textarea class="girdi" rows="2" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} placeholder=${cevir("Örn: MSDS ve analiz sertifikası pakete eklendi.")} /><//>
        <${Alan} etiket=${cevir("Ekler")} ipucu=${cevir("İrsaliye vb. (kargo belgesi ve şişe etiketleri yukarıda)")}><${Ekler} ekler=${f.ekler} degis=${s('ekler')} /><//>
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
      ? { tarih: kayit.tarih || bugun(), kisi: kayit.kisi || '', ambalaj: kayit.ambalaj, adet: kayit.adet, tedarikci: kayit.tedarikci || '', faturaNo: kayit.faturaNo || '', birimFiyat: kayit.birimFiyat ?? '', notlar: kayit.notlar || '', ekler: kayit.ekler || [] }
      : { tarih: bugun(), kisi: '', ambalaj: '1L', adet: 10, tedarikci: '', faturaNo: '', birimFiyat: '', notlar: '', ekler: [], ...on });
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const [denendi, setDenendi] = useState(false);
    const hata = !(sayi(f.adet) > 0) && 'Adet 0’dan büyük olmalı';
    const kisiHata = (!kayit || kayit.kisi) && !f.kisi.trim() && 'Teslim alan kişiyi seçin';
    async function kaydet() {
      setDenendi(true);
      if (hata || !f.tarih || kisiHata) return;
      const v = { tarih: f.tarih, kisi: f.kisi.trim(), ambalaj: f.ambalaj, adet: sayi(f.adet), tedarikci: f.tedarikci.trim(), faturaNo: f.faturaNo.trim(), birimFiyat: f.birimFiyat === '' ? '' : sayi(f.birimFiyat), notlar: f.notlar.trim(), ekler: f.ekler };
      if (kayit) {
        const fark = farklar(kayit, v);
        if (Object.keys(fark).length) await d.kaydet([{ c: 'alim', k: kayit.id, v: fark }]);
        bildir(NT.dil.m("{0} güncellendi.", kayit.no));
      } else {
        const no = H.yeniNo(d, 'alim', f.tarih);
        await d.kaydet([{ c: 'alim', k: uid(), v: { no, ...v } }]);
        bildir(NT.dil.m('{0} kaydedildi · {1} × {2} boş şişe', no, v.adet, H.ambalajAdi(d, v.ambalaj)));
      }
      kapat();
    }
    const tedarikciler = benzersiz(d.kayitlar('alim').map((r) => r.tedarikci));
    return html`<${Modal} baslik=${kayit ? NT.dil.m("Alım {0}", kayit.no) : cevir("Boş ambalaj alımı")} kapat=${kapat}
      alt=${html`${kayit && html`<div class="sol"><button class="d tehlike" onClick=${async () => (await sil('alim', kayit)) && kapat()}><${Ikon} ad="cop" />${cevir("Sil")}</button></div>`}
        <button class="d hayalet" onClick=${kapat}>${cevir("Vazgeç")}</button><button class="d ana-d" onClick=${kaydet}><${Ikon} ad="tik" />${cevir("Kaydet")}</button>`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket=${cevir("Ambalaj")} ipucu=${cevir("Yanındaki sayı: raftaki mevcut boş şişe")}><${Secenekler} liste=${amb} deger=${f.ambalaj} degis=${s('ambalaj')} ek=${(id) => H.bosMevcut(d, id)} /><//>
        <${Alan} etiket=${cevir("Alınan adet")} sinif="s4" hata=${denendi && hata}><${AdetGirdi} deger=${f.adet} degis=${s('adet')} min=${1} /><//>
        <${Alan} etiket=${cevir("Tarih")} sinif="s4" hata=${denendi && !f.tarih && 'Tarih girin'}><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Birim fiyat (₺)")} sinif="s4"><input class="girdi" inputmode="decimal" value=${f.birimFiyat} onInput=${(e) => s('birimFiyat')(e.target.value)} placeholder=${cevir("İsteğe bağlı")} /><//>
        <${Alan} etiket=${cevir("Teslim alan")} hata=${denendi && kisiHata}><${NT.ui.KisiSec} etiket=${cevir("Teslim alan")} deger=${f.kisi} degis=${s('kisi')} liste=${NT.ui.kisiListesi(d.kayitlar('alim').map((r) => r.kisi))} /><//>
        <${Alan} etiket=${cevir("Tedarikçi")} sinif="s6"><input class="girdi" list="ted-dl" value=${f.tedarikci} onInput=${(e) => s('tedarikci')(e.target.value)} /><${Oneri} id="ted-dl" liste=${tedarikciler} /><//>
        <${Alan} etiket=${cevir("Fatura / irsaliye no")} sinif="s6"><input class="girdi mono" value=${f.faturaNo} onInput=${(e) => s('faturaNo')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Not")}><textarea class="girdi" rows="2" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} /><//>
        <${Alan} etiket=${cevir("Ekler")} ipucu=${cevir("Fatura PDF’i vb.")}><${Ekler} ekler=${f.ekler} degis=${s('ekler')} /><//>
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
    const [kisi, setKisi] = useState('');
    const [tarih, setTarih] = useState(bugun());
    const [denendi, setDenendi] = useState(false);
    const fark = sayilan === '' ? 0 : sayi(sayilan) - sistem;
    // Açık kap (yalnız dolu kalemde): kaptaki litre ayrıca sayılır; tam kap sayısından bağımsızdır.
    const acikSistem = bosMu ? 0 : H.stok(d).dolu.get(H.anahtar(hedef.urun, hedef.parti, hedef.ambalaj))?.acikL || 0;
    const [acikSayilan, setAcikSayilan] = useState(acikSistem);
    const acikFark = bosMu || acikSayilan === '' ? 0 : Math.round((sayi(acikSayilan) - acikSistem) * 1000) / 1000;
    const kapLitre = sayi(H.ambalajlar(d, { hepsi: true }).find((a) => a.id === hedef.ambalaj)?.litre);
    const acikHata = !bosMu && sayi(acikSayilan) > kapLitre && NT.dil.m('Kap {0}; daha fazlası olamaz', H.litreYazi(kapLitre));
    const ad = bosMu ? NT.dil.m('{0} boş şişe', H.ambalajAdi(d, hedef.ambalaj)) : `${hedef.urun}${hedef.parti ? ' · ' + hedef.parti : ''} · ${H.ambalajAdi(d, hedef.ambalaj)}`;
    async function kaydet() {
      if (fark === 0 && acikFark === 0) return kapat();
      setDenendi(true);
      if (!tarih || !kisi.trim() || acikHata) return undefined;
      const [on, yil, n] = H.yeniNo(d, 'sayim', tarih).split('-');
      const no = (i) => `${on}-${yil}-${String(+n + i).padStart(4, '0')}`;
      const ortak = { tarih, kisi: kisi.trim(), urun: hedef.urun || '', parti: hedef.parti || '', ambalaj: hedef.ambalaj, neden: neden.trim() || 'Fiziksel sayım' };
      const ops = [];
      if (fark !== 0) ops.push({ c: 'sayim', k: uid(), v: { no: no(ops.length), ...ortak, tur: bosMu ? 'bos' : 'dolu', onceki: sistem, sayilan: sayi(sayilan), fark } });
      if (acikFark !== 0) ops.push({ c: 'sayim', k: uid(), v: { no: no(ops.length), ...ortak, tur: 'acik', onceki: acikSistem, sayilan: sayi(acikSayilan), litre: sayi(acikSayilan), fark: acikFark } });
      await d.kaydet(ops);
      bildir(NT.dil.m("{0}: {1} olarak düzeltildi.", ad, [fark !== 0 && `${cevir('tam', 'full')} ${sistem} → ${sayilan}`, acikFark !== 0 && `${cevir('açık kap')} ${H.litreYazi(acikSistem)} → ${H.litreYazi(sayi(acikSayilan))}`].filter(Boolean).join(', ')));
      kapat();
    }
    return html`<${Modal} dar baslik=${cevir("Sayım düzeltmesi")} kapat=${kapat} alt=${html`<button class="d hayalet" onClick=${kapat}>${cevir("Vazgeç")}</button><button class="d ana-d" disabled=${fark === 0 && acikFark === 0} onClick=${kaydet}><${Ikon} ad="tik" />${cevir("Düzeltmeyi kaydet")}</button>`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <div class="s12"><div class="ust-satir">${ad}</div><div class="alt-satir">${cevir("Rafta fiilen saydığınız adedi girin. Sistem aradaki farkı bir düzeltme hareketi olarak kaydeder; geçmiş kayıtlar değişmez.")}</div></div>
        <${Alan} etiket=${cevir("Sayan kişi")} sinif="s6" hata=${denendi && !kisi.trim() && 'Kişiyi seçin'}><${NT.ui.KisiSec} etiket=${cevir("Sayan kişi")} deger=${kisi} degis=${setKisi} liste=${NT.ui.kisiListesi(d.kayitlar('sayim').map((r) => r.kisi))} /><//>
        <${Alan} etiket=${cevir("Tarih")} sinif="s6" hata=${denendi && !tarih && 'Tarih girin'}><input class="girdi" type="date" value=${tarih} onInput=${(e) => setTarih(e.target.value)} /><//>
        <${Alan} etiket=${bosMu ? cevir("Sistemdeki") : cevir("Sistemdeki tam kap")} sinif="s4"><div class="girdi sayi" style="background:var(--yuzey3);font-weight:700">${sistem}</div><//>
        <${Alan} etiket=${bosMu ? cevir("Sayılan") : cevir("Sayılan tam kap")} sinif="s4"><${AdetGirdi} deger=${sayilan} degis=${setSayilan} otomatikOdak /><//>
        <${Alan} etiket=${cevir("Fark")} sinif="s4"><div class="girdi sayi" style=${{ background: 'var(--yuzey3)', fontWeight: 700, color: fark < 0 ? 'var(--yok)' : fark > 0 ? 'var(--iyi)' : '' }}>${fark > 0 ? '+' : ''}${fark}</div><//>
        ${!bosMu && html`
          <${Alan} etiket=${cevir("Sistemde açık kap")} sinif="s4"><div class="girdi sayi" style="background:var(--yuzey3);font-weight:700">${H.litreYazi(acikSistem)}</div><//>
          <${Alan} etiket=${cevir("Açık kapta kalan (L)")} sinif="s8" hata=${acikHata} ipucu=${cevir("Yarım kullanılmış kap varsa içindeki litreyi yazın; yoksa 0. Açık kap tam kap sayısına dahil değildir.")}>
            <input class="girdi sayi" type="number" min="0" step="0.05" value=${acikSayilan} onFocus=${(e) => e.target.select()} onInput=${(e) => setAcikSayilan(e.target.value === '' ? '' : Number(e.target.value))} /><//>`}
        <${Alan} etiket=${cevir("Neden")}><input class="girdi" value=${neden} onInput=${(e) => setNeden(e.target.value)} placeholder=${cevir("Örn: Ay sonu sayımı, kırık şişe, kayıt dışı gönderim")} /><//>
      </form>
    <//>`;
  }

  /* Açık kap işlemleri (2026-11-09): açıklama, üstünü tamamla (tam kap +1), atığa ayır. Kayıt koleksiyonu 'acik'. */
  const ACIK_ISLEM = {
    not: { baslik: 'Açık kap açıklaması', dugme: 'Kaydet', metin: 'Açık kapla ilgili not (yeri, durumu…).' },
    tamamla: { baslik: 'Açık kabın üstünü tamamla', dugme: 'Tamamlandı', metin: 'Kap aynı partiden tam doluma tamamlandı; rafta yeniden tam kap sayılır.' },
    atik: { baslik: 'Açık kabı atığa ayır', dugme: 'Atığa ayır', metin: 'Kaptaki kalan numune atığa gider; açık kap kapanır.' },
  };
  function AcikKapFormu({ hedef, islem, kapat }) {
    const d = depo();
    const x = H.stok(d).dolu.get(H.anahtar(hedef.urun, hedef.parti, hedef.ambalaj));
    const t = ACIK_ISLEM[islem];
    const [f, setF] = useState({ tarih: bugun(), kisi: '', aciklama: islem === 'not' ? x?.acikAciklama || '' : '', kaynakTur: '', kaynakNo: '' });
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const [denendi, setDenendi] = useState(false);
    const hatalar = { tarih: !f.tarih && 'Tarih girin', kisi: !f.kisi.trim() && 'Kişiyi seçin', kaynakTur: islem === 'tamamla' && !f.kaynakTur && 'Nereden tamamlandığını seçin' };
    const ad = `${hedef.urun}${hedef.parti ? ' · ' + hedef.parti : ''} · ${H.ambalajAdi(d, hedef.ambalaj)}`;
    async function kaydet() {
      setDenendi(true);
      if (Object.values(hatalar).some(Boolean)) return;
      const no = H.yeniNo(d, 'acik', f.tarih);
      await d.kaydet([{ c: 'acik', k: uid(), v: { no, tarih: f.tarih, kisi: f.kisi.trim(), tur: islem, urun: hedef.urun, parti: hedef.parti || '', ambalaj: hedef.ambalaj,
        litre: x?.acikL || 0, aciklama: f.aciklama.trim(), ...(islem === 'tamamla' ? { kaynakTur: f.kaynakTur, kaynakNo: f.kaynakNo.trim() } : {}) } }]);
      bildir(`${no} · ${ad}: ${cevir(islem === 'not' ? 'açıklama kaydedildi' : islem === 'tamamla' ? 'üstü tamamlandı, rafa tam kap olarak döndü' : 'atığa ayrıldı')}.`);
      kapat();
    }
    return html`<${Modal} dar baslik=${t.baslik} kapat=${kapat} alt=${html`<button class="d hayalet" onClick=${kapat}>${cevir("Vazgeç")}</button><button class=${'d ' + (islem === 'atik' ? 'tehlike' : 'ana-d')} onClick=${kaydet}><${Ikon} ad="tik" />${cevir(t.dugme)}</button>`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <div class="s12"><div class="ust-satir">${ad}</div><div class="alt-satir">${cevir("Açık kapta")} ${H.litreYazi(x?.acikL || 0)} ${cevir("var.")} ${cevir(t.metin)}</div></div>
        <${Alan} etiket=${cevir("Kişi")} sinif="s6" hata=${denendi && hatalar.kisi}><${NT.ui.KisiSec} etiket=${cevir("Kişi")} deger=${f.kisi} degis=${s('kisi')} liste=${NT.ui.kisiListesi(d.kayitlar('acik').map((r) => r.kisi))} /><//>
        <${Alan} etiket=${cevir("Tarih")} sinif="s6" hata=${denendi && hatalar.tarih}><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih')(e.target.value)} /><//>
        ${islem === 'tamamla' && html`<${Alan} etiket=${cevir("Nereden tamamlandı?")} hata=${denendi && hatalar.kaynakTur}>
          <${Secenekler} liste=${H.DOLUM_KAYNAKLARI.filter((k) => k.id !== 'Numune')} deger=${f.kaynakTur} degis=${s('kaynakTur')} /><//>
          ${f.kaynakTur && html`<${Alan} etiket=${H.DOLUM_KAYNAKLARI.find((k) => k.id === f.kaynakTur)?.no + ' (isteğe bağlı)'}><input class="girdi mono" value=${f.kaynakNo} onInput=${(e) => s('kaynakNo')(e.target.value)} /><//>`}`}
        <${Alan} etiket=${islem === 'not' ? cevir("Açıklama") : cevir("Not (isteğe bağlı)")}><textarea class="girdi" rows="2" value=${f.aciklama} onInput=${(e) => s('aciklama')(e.target.value)} /><//>
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
    acikIslem: (hedef, islem) => ac(AcikKapFormu, { hedef, islem }),
  };
})();
