/* Uygulamanın arayüzü (iç adı "tezgah"; kullanıcıya görünen ad "Numune Takip", ana sayfa "Genel Bakış").
   Fikir: tablo yerine "raf" görünümü; her işlem adım adım bir sihirbaz. */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, render, useState, useEffect, useMemo, useRef } = window.htmPreact;
  const { Ikon, Sise, Avatar, GlobalKatman, BelgeKutusu, bildir, onayla } = NT.ui;
  const H = NT.hesap;
  const F = NT.form;
  const E = NT.ekran;
  const { bugun, uid, sayi, tarihYaz, onceYaz, gunFarki, ara, adetYaz, trSirala, gunEkle } = NT.c;
  const b = NT.baglanti;
  const { t: cevir, DilSecimi, useDil } = NT.dil;
  const depo = () => b.depo;
  const litreYaz = (n) => n.toLocaleString(NT.dil?.yerel() ?? 'tr-TR', { maximumFractionDigits: 2 });
  document.documentElement.classList.add('tezgah');

  const SEKMELER = [
    { id: 'genel', ad: 'Genel Bakış', ikon: 'ozet' },
    { id: 'isemirleri', ad: 'İş Emirleri', en: 'Work Orders', ikon: 'dolum' },
    { id: 'gonderiler', ad: 'Gönderiler', ikon: 'sevk' },
    { id: 'gecmis', ad: 'Geçmiş', ikon: 'saat' },
    { id: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
  ];
  const sekmeAl = () => { const s = (location.hash.match(/^#\/(\w+)/) || [])[1]; return !s || s === 'tezgah' ? 'genel' : s; }; // #/tezgah: eski yer imleri
  const amb = (id) => H.ambalajAdi(depo(), id);
  const kalemYazi = (k) => `${k.urun}${k.parti ? ' ' + k.parti : ''} · ${amb(k.ambalaj)}`;

  /* ---------------- Sihirbaz iskeleti ---------------- */
  const sihirbaz = { aktif: null, dinle: new Set() };
  const sihirbazAc = (B, props = {}) => { sihirbaz.aktif = { B, props }; sihirbaz.dinle.forEach((f) => f()); };
  const sihirbazKapat = () => { sihirbaz.aktif = null; sihirbaz.dinle.forEach((f) => f()); };
  function SihirbazKatmani() {
    const [, y] = useState(0);
    useEffect(() => { const f = () => y((x) => x + 1); sihirbaz.dinle.add(f); return () => sihirbaz.dinle.delete(f); }, []);
    if (!sihirbaz.aktif) return null;
    const { B, props } = sihirbaz.aktif;
    return html`<${B} key=${props.emir?.id || B.name} ...${props} kapat=${sihirbazKapat} />`;
  }

  function Sihirbaz({ baslik, adimlar, kapat, kaydet, kaydetYazi = 'Kaydet' }) {
    const [i, setI] = useState(0);
    const [mesgul, setMesgul] = useState(false);
    const adim = adimlar[Math.min(i, adimlar.length - 1)];
    const son = i >= adimlar.length - 1;
    const gecerli = adim.gecerli ? adim.gecerli() : true;
    const ileri = async () => {
      if (!gecerli || mesgul) return;
      if (!son) return setI(i + 1);
      setMesgul(true);
      try { if ((await kaydet()) !== false) kapat(); }
      catch (e) { bildir(cevir(e.message), { tur: 'hata' }); }
      finally { setMesgul(false); }
    };
    useEffect(() => {
      const f = (e) => {
        if (document.querySelector('.perde')) return; // üstte onay penceresi açık
        if (e.key === 'Escape') { e.preventDefault(); kapat(); }
        // Sayımdaki "kalem ekle" kutularında Enter (telefonda Git/İleri) sayfa atlatmaz; kalemi ekler (2026-11-09 hatası).
        else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.target.closest('.tz-secimler') && !e.target.closest('.tz-sayim-ekle')) { e.preventDefault(); ileri(); }
      };
      window.addEventListener('keydown', f);
      return () => window.removeEventListener('keydown', f);
    });
    return html`<div class="tz-sihirbaz" onMouseDown=${(e) => e.target === e.currentTarget && kapat()}>
      <div class="tz-panel" role="dialog" aria-modal="true" aria-label=${baslik}>
        <div class="tz-panel-bas">
          <span class="baslik">${baslik}</span>
          <div class="tz-noktalar">${adimlar.map((_, j) => html`<span class=${j <= i ? 'gecti' : ''} />`)}</div>
          <button class="d hayalet ikon-d" onClick=${kapat} aria-label=${cevir("Kapat")}><${Ikon} ad="kapat" /></button>
        </div>
        <div class="tz-panel-ic" key=${i}>
          <h2 class="tz-soru">${cevir(adim.soru)}</h2>
          ${adim.ipucu && html`<p class="tz-ipucu">${cevir(adim.ipucu)}</p>`}
          ${adim.icerik({ ileri: () => setI((x) => Math.min(x + 1, adimlar.length - 1)) })}
        </div>
        <div class="tz-panel-alt">
          ${i > 0 ? html`<button class="d hayalet tz-buyuk" onClick=${() => setI(i - 1)}>${cevir("← Geri")}</button>` : html`<button class="d hayalet tz-buyuk" onClick=${kapat}>${cevir("Vazgeç")}</button>`}
          <span class="bosluk" />
          <span class="kucuk soluk">${cevir("Adım")} ${i + 1} / ${adimlar.length}</span>
          <button class="d ana-d tz-buyuk" disabled=${!gecerli || mesgul} onClick=${ileri}>${son ? html`<${Ikon} ad="tik" />${mesgul ? cevir("Kaydediliyor…") : kaydetYazi}` : cevir("Devam →")}</button>
        </div>
      </div>
    </div>`;
  }

  function Secim({ secili, onClick, baslik, alt, uyari, oneri, sise, litre, ikon }) {
    return html`<button type="button" class=${`tz-secim${secili ? ' secili' : ''}${oneri ? ' oneri' : ''}${sise ? ' sise' : ''}`} onClick=${onClick}>
      ${sise && html`<${Sise} litre=${litre} boyut=${1.2} />`}
      ${ikon && html`<${Ikon} ad=${ikon} boyut=${22} />`}
      <b>${baslik}</b>${alt && html`<small class=${uyari ? 'uyari' : ''}>${alt}</small>`}
      ${secili && html`<span class="kose"><${Ikon} ad="daire_tik" boyut=${20} /></span>`}
    </button>`;
  }

  function SayiSecici({ deger, degis, hizli = [1, 2, 3, 5, 10, 20] }) {
    const n = sayi(deger);
    return html`<div>
      <div class="tz-sayi-kutu">
        <button type="button" class="yuvar" onClick=${() => degis(Math.max(0, n - 1))} aria-label=${cevir("Azalt")}>−</button>
        <input type="number" min="0" inputmode="numeric" autofocus value=${deger} onFocus=${(e) => e.target.select()} onInput=${(e) => degis(e.target.value === '' ? '' : Number(e.target.value))} />
        <button type="button" class="yuvar" onClick=${() => degis(n + 1)} aria-label=${cevir("Artır")}>+</button>
      </div>
      <div class="tz-hizli">${hizli.map((x) => html`<button type="button" class=${'tz-cip' + (n === x ? ' secili' : '')} onClick=${() => degis(x)}>${x}</button>`)}</div>
    </div>`;
  }

  /* ---------------- Dolum sihirbazı ---------------- */
  const KAYNAK_IKON = { IBC: 'kutu', Varil: 'stok', İsotank: 'sevk', Numune: 'dolum', Diğer: 'bilgi' };
  const KAYNAK_ALT = { IBC: 'IBC tankından', Varil: 'Varilden', İsotank: 'İsotanktan', Numune: 'Büyük şişeyi küçüklere böldük', Diğer: 'Reaktör, tank…' };
  function DolumSihirbazi({ kapat, emir }) {
    const d = depo();
    const [f, setF] = useState({ ...emir, tarih: bugun(), hazirlayan: b.kullanici, dolduranlar: [],
      kaynakTur: '', kaynakNo: '', notlar: '', kaynakKap: null, kaynakElle: false, acikAciklama: '' });
    const s = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const u = H.urunBul(d, f.urun);
    const partili = !!u?.partili;
    const bos = H.bosMevcut(d, f.ambalaj);
    // Büyük numuneden dolum: kaynak kap listeden seçilir; kalan litre "açık kap" olarak izlenir.
    const hedefLitre = sayi(H.ambalajlar(d, { hepsi: true }).find((a) => a.id === f.ambalaj)?.litre);
    const kaynaklar = f.kaynakTur === 'Numune' && f.ambalaj ? H.kaynakKaplar(d, { urun: f.urun, parti: partili ? f.parti.trim() : '', ambalaj: f.ambalaj }) : [];
    const kaynakKap = f.kaynakTur === 'Numune' && !f.kaynakElle ? kaynaklar.find((x) => f.kaynakKap && x.anahtar === H.anahtar(f.kaynakKap.urun, f.kaynakKap.parti, f.kaynakKap.ambalaj)) || null : null;
    const alinanLitre = sayi(f.adet) * hedefLitre;
    const oniz = kaynakKap ? H.acikOnizleme(d, kaynakKap, alinanLitre) : null;
    const kaynakYetersiz = oniz && oniz.acilan > oniz.ayrilabilir;
    const kaynakGecerli = !kaynakYetersiz && (f.kaynakTur !== 'Numune' || f.kaynakElle || !kaynaklar.length || !!kaynakKap);
    const OnizYazi = () => oniz && html`<div class=${'uyari-kutu ' + (kaynakYetersiz ? 'kritik' : 'bilgi')} style="margin-top:18px"><${Ikon} ad=${kaynakYetersiz ? 'uyari' : 'bilgi'} /><span>
      ${cevir("Kaynak")} <b>${kaynakKap.parti ? kaynakKap.parti + ' · ' : ''}${amb(kaynakKap.ambalaj)}</b> ${cevir("kaptan")} <b>${H.litreYazi(alinanLitre)}</b> ${cevir("alınıyor.\r\n      Açık kap:")} ${H.litreYazi(oniz.oncekiAcik)} → <b>${H.litreYazi(oniz.sonrakiAcik)}</b>${oniz.acilan ? NT.dil.m(' · {0} tam kap açılacak (tam: {1} → {2})', oniz.acilan, oniz.tam, oniz.tamSonra) : ''}${oniz.biten ? NT.dil.m(" · {0} kap biter (atık)", oniz.biten) : ''}.
      ${kaynakYetersiz ? cevir(' Kaynakta kullanılabilir kap yetersiz. Ayrılmış kaplar kullanılamaz.', ' There are not enough available source containers. Reserved bottles cannot be used.') : ''}</span></div>`;
    const adimlar = [
      {
        soru: 'Nereden doldurdunuz?', ipucu: 'İsotanktan dolduysa isotank numarasını yazın. Büyük numuneden dolduysa kaynak kabı seçin; kalan miktar açık kap olarak izlenir.', gecerli: () => !!f.kaynakTur && kaynakGecerli,
        icerik: () => {
          const k = H.DOLUM_KAYNAKLARI.find((x) => x.id === f.kaynakTur);
          const onceki = [...new Set(d.kayitlar('dolum').filter((r) => r.kaynakTur === f.kaynakTur).map((r) => String(r.kaynakNo || '').trim()).filter(Boolean))];
          const kapSecimi = f.kaynakTur === 'Numune' && !f.kaynakElle && (kaynaklar.length
            ? html`<p class="tz-ipucu" style="margin:20px 0 8px">${cevir("Hangi kaptan aldınız?")}</p>
              <div class="tz-secimler">${kaynaklar.map((x) => html`<${Secim} sise litre=${H.ambalajlar(d, { hepsi: true }).find((a) => a.id === x.ambalaj)?.litre} secili=${kaynakKap?.anahtar === x.anahtar}
                baslik=${`${x.parti ? x.parti + ' · ' : ''}${amb(x.ambalaj)}`} alt=${[
                  x.mevcut > 0 && NT.dil.m('{0} tam', Math.max(0, x.kullanilabilir)), x.acikL > 0 && `${cevir('açık kap')} ${H.litreYazi(x.acikL)}`,
                  x.rezerve > 0 && `${x.rezerve} ${cevir('ayrıldı')}`].filter(Boolean).join(' · ')}
                onClick=${() => setF((p) => ({ ...p, kaynakKap: { urun: x.urun, parti: x.parti || '', ambalaj: x.ambalaj }, kaynakNo: `${amb(x.ambalaj)} kap${x.parti ? ' · ' + x.parti : ''}` }))} />`)}</div>
              <div class="alan" style="margin-top:16px;max-width:520px"><label>${cevir("Açık kap açıklaması (isteğe bağlı)")}</label>
                <input class="girdi" placeholder=${cevir("Örn: alt rafta, kapağı kırık")} value=${f.acikAciklama} onInput=${(e) => s('acikAciklama', e.target.value)} /></div>
              <button type="button" class="d hayalet kucuk-d" style="margin-top:10px" onClick=${() => setF((p) => ({ ...p, kaynakElle: true, kaynakKap: null }))}>${cevir("Kaynak kap listede yok")}</button>`
            : html`<div class="uyari-kutu bilgi" style="margin-top:20px"><${Ikon} ad="bilgi" /><span>${cevir("Rafta bu ürün")}${partili ? cevir(" ve partiden") : cevir("den")} ${cevir("daha büyük bir kap görünmüyor. Kaynağı aşağıya yazabilirsiniz; açık kap izlenmez. Kap rafta varsa önce Raf sayımı ile ekleyin.")}</span></div>`);
          return html`<div class="tz-secimler">${H.DOLUM_KAYNAKLARI.map((x) => html`<${Secim} ikon=${KAYNAK_IKON[x.id]} secili=${f.kaynakTur === x.id} baslik=${cevir(x.ad)} alt=${cevir(KAYNAK_ALT[x.id])}
              onClick=${() => setF((p) => ({ ...p, kaynakTur: x.id, kaynakNo: p.kaynakTur === x.id ? p.kaynakNo : '', kaynakKap: p.kaynakTur === x.id ? p.kaynakKap : null, kaynakElle: p.kaynakTur === x.id ? p.kaynakElle : false }))} />`)}</div>
            ${kapSecimi}<${OnizYazi} />
            ${k && (f.kaynakTur !== 'Numune' || f.kaynakElle || !kaynaklar.length) && html`<div class="alan" style="margin-top:20px;max-width:440px"><label>${k.no}${f.kaynakTur === 'İsotank' ? '' : cevir(" (isteğe bağlı)")}</label>
              <input class="girdi mono" style="font-size:18px;padding:12px 14px" key=${f.kaynakTur} ref=${(el) => { if (el && !el.dataset.odak) { el.dataset.odak = '1'; setTimeout(() => el.focus(), 0); } }} list="tz-kaynakno" value=${f.kaynakNo} onInput=${(e) => s('kaynakNo', e.target.value)} />
              <datalist id="tz-kaynakno">${onceki.map((x) => html`<option value=${x} />`)}</datalist></div>`}`;
        },
      },
      {
        soru: 'Dolumu kimler yaptı?', ipucu: 'Dolumu yapan herkese dokunun; birden fazla kişi seçilebilir.', gecerli: () => f.dolduranlar.length > 0,
        icerik: () => html`<${NT.ui.DolduranSecimi} secili=${f.dolduranlar} degis=${(v) => s('dolduranlar', v)} />`,
      },
      {
        soru: 'Kontrol edip kaydedin', gecerli: () => !!f.tarih,
        icerik: () => html`<p class="tz-ozet"><em>${f.adet} ${cevir("şişe")}</em> ${f.urun}${f.parti ? html` · <em>${f.parti}</em>` : ''}, <em>${amb(f.ambalaj)}</em> ambalaja dolduruldu${f.kaynakTur ? html` ${cevir("(kaynak:")} <em>${H.dolumKaynagi(f)}</em>)` : ''}${cevir(".\r\n            Dolduran:")} <em>${H.dolduranYaz(f)}</em>.<br />
            <span class="soluk" style="font-size:16px">${cevir("Boş")} ${amb(f.ambalaj)} ${cevir("şişe:")} ${bos} → ${bos - sayi(f.adet)}</span></p>
          <${OnizYazi} />
          <div class="form-izgara">
            <div class="alan s4"><label>${cevir("Tarih")}</label><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih', e.target.value)} /></div>
            <div class="alan s8"><label>${cevir("Hazırlayan")}</label><input class="girdi" value=${f.hazirlayan} onInput=${(e) => s('hazirlayan', e.target.value)} /></div>
            <div class="alan s12"><label>${cevir("Not (isteğe bağlı)")}</label><textarea class="girdi" rows="2" value=${f.notlar} onInput=${(e) => s('notlar', e.target.value)} /></div>
          </div>`,
      },
    ];
    async function kaydet() {
      if (sayi(f.adet) > bos && !(await onayla(NT.dil.m("Boş {0} şişe stoku eksiye düşecek. Yine de kaydedilsin mi?", amb(f.ambalaj)), { baslik: cevir("Boş şişe yetersiz"), evet: cevir("Kaydet") }))) return false;
      const karisim = f.parti.split('+').map((p) => p.trim()).filter(Boolean);
      const v = { tarih: f.tarih, ...(partili && karisim.length > 1 ? { karisim } : {}), hazirlayan: f.hazirlayan.trim(),
        kaynakTur: f.kaynakTur, kaynakNo: f.kaynakNo.trim(), notlar: f.notlar.trim(), ekler: [],
        ...(kaynakKap ? { kaynakKap: { urun: kaynakKap.urun, parti: kaynakKap.parti || '', ambalaj: kaynakKap.ambalaj }, alinanLitre, acikAciklama: f.acikAciklama.trim() } : {}) };
      await H.emirYaz(d, emir.id, 'tamamla', { dolum: v, yapanlar: f.dolduranlar, bosStokOnayi: f.adet > bos });
      bildir(NT.dil.m('{0} rafa eklendi.', `${f.adet} × ${kalemYazi(f)}`));
    }
    return html`<${Sihirbaz} baslik=${`${emir.no} · ${emir.adet} × ${kalemYazi(emir)}`} adimlar=${adimlar} kapat=${kapat} kaydet=${kaydet} kaydetYazi=${cevir("Dolumu tamamla", "Complete filling")} />`;
  }

  /* ---------------- Gönderi sihirbazı ---------------- */
  function GonderSihirbazi({ kapat, emir }) {
    const d = depo();
    const id = useRef(uid()).current;
    const onceki = d.kayitlar('sevk');
    const sonFirmalar = [...new Map([...onceki].sort((a, x) => (a.tarih < x.tarih ? 1 : -1)).map((r) => [r.firma, r])).values()].slice(0, 8);
    const kalemeDonustur = ({ urun, parti, ambalaj, adet }) => ({ urun, parti, ambalaj, adet, anahtar: H.anahtar(urun, parti, ambalaj) });
    const [f, setF] = useState(() => {
      const firma = emir?.firma || '';
      const son = firma ? H.firmaBilgisi(d, firma) : {};
      return { firma, yetkili: son.yetkili || '', telefon: son.telefon || '', irtibatDetay: son.irtibatDetay || '',
        talepTarihi: bugun(), sorumlu: b.kullanici || '', adres: son.adres || '', sebep: '', sekil: 'Kargo', kargoFirma: '',
        kargoBelge: [], ulke: son.ulke || 'Türkiye', durum: 'Etiket Bekliyor', tarih: bugun(), siseler: [],
        emirIds: emir ? [emir.id] : [], sepet: emir ? [kalemeDonustur(emir)] : [] };
    });
    const s = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const firmaUyar = (e, firma) => !e.firma || NT.c.kucuk(e.firma) === NT.c.kucuk(firma.trim());
    const emirler = d.kayitlar('isemri').filter((e) => H.emirSevkeHazir(e) && firmaUyar(e, f.firma));
    const kalemleriTopla = (ids, oncekiKalemler) => {
      const kalemler = new Map();
      for (const emirId of ids) {
        const e = d.kayit('isemri', emirId);
        if (!e) continue;
        const k = kalemeDonustur(e);
        const varOlan = kalemler.get(k.anahtar);
        if (varOlan) varOlan.adet += k.adet;
        else kalemler.set(k.anahtar, { ...oncekiKalemler.find((x) => x.anahtar === k.anahtar), ...k });
      }
      return [...kalemler.values()];
    };
    const firmaSec = (ad) => setF((p) => {
      const son = H.firmaBilgisi(d, ad);
      const emirIds = p.emirIds.filter((id) => {
        const e = d.kayit('isemri', id);
        return e && firmaUyar(e, ad);
      });
      return { ...p, firma: ad, yetkili: son.yetkili || p.yetkili, telefon: son.telefon || p.telefon,
        irtibatDetay: son.irtibatDetay || p.irtibatDetay, adres: son.adres || p.adres, ulke: son.ulke || p.ulke,
        emirIds, sepet: kalemleriTopla(emirIds, p.sepet) };
    });
    const emirSec = (id) => setF((p) => {
      const emirIds = p.emirIds.includes(id) ? p.emirIds.filter((x) => x !== id) : [...p.emirIds, id];
      return { ...p, emirIds, sepet: kalemleriTopla(emirIds, p.sepet) };
    });
    const kalemler = f.sepet.map(({ anahtar, ...k }) => k);
    const eksikler = H.sevkKontrol(d, kalemler);
    const toplam = kalemler.reduce((t, k) => t + k.adet, 0);

    const adimlar = [
      {
        soru: 'Kime gönderiyorsunuz?', ipucu: 'Daha önce gönderdiğiniz bir firmayı seçerseniz yetkili ve adres kendiliğinden gelir.', gecerli: () => !!f.firma.trim(),
        icerik: () => html`<input class="girdi" style="font-size:20px;padding:14px 16px" list="tz-firmalar" autofocus placeholder=${cevir("Firma adı")} value=${f.firma} onInput=${(e) => s('firma', e.target.value)} onChange=${(e) => firmaSec(e.target.value)} />
          <datalist id="tz-firmalar">${[...new Set(onceki.map((r) => r.firma))].map((x) => html`<option value=${x} />`)}</datalist>
          ${sonFirmalar.length > 0 && html`<div class="tz-hizli" style="margin-top:14px">${sonFirmalar.map((r) => html`<button type="button" class=${'tz-cip' + (f.firma === r.firma ? ' secili' : '')} onClick=${() => firmaSec(r.firma)}>${r.firma}</button>`)}</div>`}
          <div class="form-izgara" style="margin-top:22px">
            <div class="alan s6"><label>${cevir("İrtibat yetkilisi")}</label><input class="girdi" value=${f.yetkili} onInput=${(e) => s('yetkili', e.target.value)} placeholder=${cevir("Ad Soyad (Unvan)")} /></div>
            <div class="alan s6"><label>${cevir("Telefon")}</label><${F.TelefonGirdisi} deger=${f.telefon} degis=${(v) => s('telefon', v)} ulke=${f.ulke} /></div>
            <div class="alan s12"><label>${cevir("Talep sebebi")}</label><input class="girdi" list="tz-sebepler" value=${f.sebep} onInput=${(e) => s('sebep', e.target.value)} placeholder=${cevir("Örn: Laboratory testing, saha denemesi")} />
              <datalist id="tz-sebepler">${[...new Set(onceki.map((r) => (r.sebep || '').trim()).filter(Boolean))].sort(trSirala).map((x) => html`<option value=${x} />`)}</datalist></div>
            <div class="alan s6"><label>${cevir("Talep tarihi")}</label><input class="girdi" type="date" value=${f.talepTarihi} onInput=${(e) => s('talepTarihi', e.target.value)} /></div>
          </div>`,
      },
      {
        soru: 'Neleri gönderiyorsunuz?', ipucu: cevir('Bu gönderiye girecek tamamlanmış iş emirlerini seçin.', 'Select the completed work orders for this shipment.'),
        gecerli: () => f.emirIds.length > 0 && f.emirIds.every((id) => emirler.some((e) => e.id === id)),
        icerik: () => html`<div class="tz-sepet">
          <div class="tz-stok-listesi">${emirler.map((e) => html`<button type="button" class=${'tz-stok-satir' + (f.emirIds.includes(e.id) ? ' sepette' : '')}
              aria-pressed=${f.emirIds.includes(e.id)} onClick=${() => emirSec(e.id)}>
              <span class="bilgi"><b>${kalemYazi(e)}</b><small>${e.no}</small></span><span class="n">${e.adet}</span>
            </button>`)}
            ${!emirler.length && html`<p class="soluk">${cevir('Bu firma için hazır iş emri yok.', 'No work orders are ready for this company.')}</p>`}</div>
          <div class="tz-sepet-kutu"><h4>${cevir("Gönderilecekler")} ${toplam ? NT.dil.m("· {0} şişe · {1} L", toplam, litreYaz(H.sevkLitre(d, kalemler))) : ''}</h4>
            ${f.sepet.length ? f.sepet.map((k) => html`<div class="tz-sepet-kalem">
              <span class="ad">${k.urun}<small>${k.parti || cevir("Partisiz")} · ${amb(k.ambalaj)}</small></span>
              <b>${k.adet}</b>
            </div>`) : html`<p class="soluk kucuk">${cevir("Henüz bir şey eklenmedi.")}</p>`}
          </div>
        </div>`,
      },
      {
        soru: 'Şişe etiketleri, sample no ve belgeler', ipucu: 'Her şişenin sample numarasını (örn. 0608261/1) yazın ve Canva’dan çıkardığınız etiketi yükleyin; her kalemin CoA’sını altına ekleyin. İsterseniz atlayıp sonra gönderi kaydından eklersiniz.', gecerli: () => true,
        icerik: () => html`<${F.SiseEtiketleri} kalemler=${kalemler} siseler=${f.siseler} degis=${(v) => s('siseler', v)} />
          <div class="tz-kalem-belgeler">${f.sepet.map((k) => html`<div key=${k.anahtar}><h4>${k.adet} × ${kalemYazi(k)}</h4>
            <${F.KalemBelgeleri} k=${k} degis=${(y) => setF((p) => ({ ...p, sepet: p.sepet.map((x) => (x.anahtar === k.anahtar ? y : x)) }))} /></div>`)}</div>`,
      },
      {
        soru: 'Nasıl gönderiliyor?', gecerli: () => true,
        icerik: () => html`<div class="tz-secimler" style="grid-template-columns:repeat(3,1fr)">
            ${[['Kargo', 'sevk'], ['Elden', 'kisi'], ['Kurye', 'sevk']].map(([x, ik]) => html`<${Secim} ikon=${ik} secili=${f.sekil === x} baslik=${cevir(x)} onClick=${() => s('sekil', x)} />`)}
          </div>
          <div class="form-izgara" style="margin-top:22px">
            ${f.sekil !== 'Elden' && html`<div class="alan s6"><label>${f.sekil === 'Kurye' ? cevir("Kurye") : cevir("Kargo")} ${cevir("firması")}</label><input class="girdi" list="tz-kargo" value=${f.kargoFirma} onInput=${(e) => s('kargoFirma', e.target.value)} />
              <datalist id="tz-kargo">${['Yurtiçi Kargo', 'Aras Kargo', 'MNG Kargo', 'Sürat Kargo', 'PTT Kargo', 'UPS', 'DHL'].map((x) => html`<option value=${x} />`)}</datalist></div>
              <div class="s6"><${BelgeKutusu} baslik=${f.sekil === 'Kurye' ? 'Kurye gönderi belgesi' : 'Kargo gönderi belgesi'} ekler=${f.kargoBelge} degis=${(v) => s('kargoBelge', v)}
                ipucu=${cevir("Takip no içindeki belge; sonra da yüklenebilir")} /></div>`}
            <div class="alan s4"><label>${cevir("Ülke")}</label><${F.UlkeSecimi} deger=${f.ulke} degis=${(v) => s('ulke', v)} /></div>
            <div class="alan s8"><label>${cevir("Teslim adresi")}</label><textarea class="girdi" rows="2" value=${f.adres} onInput=${(e) => s('adres', e.target.value)} /></div>
          </div>`,
      },
      {
        soru: 'Şu an ne durumda?', ipucu: 'Sadece “Yola çıktı” stoktan düşer. Diğerlerinde şişeler rafta ayrılmış (rezerve) görünür. Sorumlu ve tarih zorunludur.', gecerli: () => !!f.tarih && !!f.sorumlu.trim(),
        icerik: () => html`<div class="tz-secimler">
            <${Secim} ikon="saat" secili=${f.durum === 'Karar Aşaması'} baslik=${cevir("Karar aşamasında")} alt=${cevir("Gönderilip gönderilmeyeceği belli değil")} onClick=${() => s('durum', 'Karar Aşaması')} />
            <${Secim} ikon="dolum" secili=${f.durum === 'Beklemede'} baslik=${cevir("Hazırlanıyor")} alt=${cevir("Paketlenecek")} onClick=${() => s('durum', 'Beklemede')} />
            <${Secim} ikon="etiket" secili=${f.durum === 'Etiket Bekliyor'} baslik=${cevir("Etiket bekliyor")} alt=${cevir("Paket hazır")} onClick=${() => s('durum', 'Etiket Bekliyor')} />
            <${Secim} ikon="daire_tik" secili=${f.durum === 'Gönderildi'} baslik=${cevir("Yola çıktı")} alt=${cevir("Stoktan düşer")} onClick=${() => s('durum', 'Gönderildi')} />
          </div>
          <div class="form-izgara" style="margin-top:22px">
            <div class="alan s6"><label>${cevir("Sorumlu (zorunlu)")}</label><${NT.ui.KisiSec} etiket=${cevir("Sorumlu")} deger=${f.sorumlu} degis=${(v) => s('sorumlu', v)} liste=${NT.ui.kisiListesi(onceki.map((r) => r.sorumlu))} /></div>
            <div class="alan s6"><label>${cevir("Tarih (zorunlu)")}</label><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih', e.target.value)} /></div>
          </div>
          <p class="tz-ozet" style="margin-top:26px"><em>${f.firma}</em> ${cevir("firmasına")} <em>${toplam} ${cevir("şişe (")}${litreYaz(H.sevkLitre(d, kalemler))} L)</em>: ${kalemler.map(kalemYazi).join(', ')}.</p>
          ${f.durum === 'Gönderildi' && eksikler.length > 0 && html`<div class="uyari-kutu yok"><${Ikon} ad="uyari" /><span>${cevir("Rafta yetersiz:")} ${eksikler.map((e) => `${e.urun} ${e.parti} ${amb(e.ambalaj)} (rafta ${e.mevcut}, istenen ${e.istenen})`).join(' · ')}</span></div>`}`,
      },
    ];
    async function kaydet() {
      const v = { tarih: f.tarih, firma: f.firma.trim(), yetkili: f.yetkili.trim(), telefon: f.telefon.trim(), irtibatDetay: f.irtibatDetay.trim(), talepTarihi: f.talepTarihi, sorumlu: f.sorumlu.trim(), sekil: f.sekil, sebep: f.sebep.trim(), durum: f.durum, kargoFirma: f.kargoFirma.trim(), takipNo: '', kargoBelge: f.kargoBelge, ulke: f.ulke, adres: f.adres.trim(), notlar: '', ekler: [], kalemler, siseler: H.siseTemizle(kalemler, f.siseler) };
      await H.sevkYaz(d, id, v, { emirIds: f.emirIds });
      const kayit = d.kayit('sevk', id);
      bildir(NT.dil.m("{0} · {1} kaydedildi.", kayit.no, kayit.firma), { eylem: { yazi: 'Gönderi etiketi', fn: () => NT.etiket.ac({ tur: 'sevk', kayit }) }, sure: 8000 });
    }
    return html`<${Sihirbaz} baslik=${cevir("Numune gönder")} adimlar=${adimlar} kapat=${kapat} kaydet=${kaydet} kaydetYazi=${cevir("Gönderiyi kaydet")} />`;
  }

  /* ---------------- Şişe geldi ---------------- */
  function AlimSihirbazi({ kapat, on = {} }) {
    const d = depo();
    const [f, setF] = useState({ ambalaj: '', adet: 10, tedarikci: '', faturaNo: '', birimFiyat: '', tarih: bugun(), kisi: '', ...on });
    const s = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const tedarikciler = [...new Set(d.kayitlar('alim').map((r) => r.tedarikci).filter(Boolean))];
    const adimlar = [
      { soru: 'Hangi şişeler geldi?', gecerli: () => !!f.ambalaj,
        icerik: ({ ileri }) => html`<div class="tz-secimler">${H.ambalajlar(d).map((a) => html`<${Secim} sise litre=${a.litre} secili=${f.ambalaj === a.id} baslik=${a.ad} alt=${NT.dil.m("şu an {0} boş", H.bosMevcut(d, a.id))} onClick=${() => { s('ambalaj', a.id); ileri(); }} />`)}</div>` },
      { soru: 'Kaç adet?', gecerli: () => sayi(f.adet) > 0, icerik: () => html`<${SayiSecici} deger=${f.adet} degis=${(v) => s('adet', v)} hizli=${[5, 10, 20, 50, 100]} />` },
      { soru: 'Kim teslim aldı, nereden geldi?', ipucu: 'Teslim alan ve tarih zorunlu; tedarikçi ve fatura isteğe bağlı.', gecerli: () => !!f.tarih && !!f.kisi.trim(),
        icerik: () => html`${tedarikciler.length > 0 && html`<div class="tz-hizli" style="margin-bottom:16px">${tedarikciler.map((x) => html`<button type="button" class=${'tz-cip' + (f.tedarikci === x ? ' secili' : '')} onClick=${() => s('tedarikci', x)}>${x}</button>`)}</div>`}
          <div class="form-izgara">
            <div class="alan s6"><label>${cevir("Teslim alan (zorunlu)")}</label><${NT.ui.KisiSec} etiket=${cevir("Teslim alan")} deger=${f.kisi} degis=${(v) => s('kisi', v)} liste=${NT.ui.kisiListesi(d.kayitlar('alim').map((r) => r.kisi))} /></div>
            <div class="alan s6"><label>${cevir("Tarih (zorunlu)")}</label><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih', e.target.value)} /></div>
            <div class="alan s6"><label>${cevir("Tedarikçi")}</label><input class="girdi" value=${f.tedarikci} onInput=${(e) => s('tedarikci', e.target.value)} /></div>
            <div class="alan s3"><label>${cevir("Fatura no")}</label><input class="girdi mono" value=${f.faturaNo} onInput=${(e) => s('faturaNo', e.target.value)} /></div>
            <div class="alan s3"><label>${cevir("Birim fiyat ₺")}</label><input class="girdi" inputmode="decimal" value=${f.birimFiyat} onInput=${(e) => s('birimFiyat', e.target.value)} /></div>
          </div>
          <p class="tz-ozet" style="margin-top:24px"><em>${f.adet} ${cevir("adet")} ${amb(f.ambalaj)}</em> ${cevir("boş şişe rafa eklenecek (")}${H.bosMevcut(d, f.ambalaj)} → ${H.bosMevcut(d, f.ambalaj) + sayi(f.adet)}).</p>` },
    ];
    async function kaydet() {
      const no = H.yeniNo(d, 'alim', f.tarih);
      await d.kaydet([{ c: 'alim', k: uid(), v: { no, tarih: f.tarih, kisi: f.kisi.trim(), ambalaj: f.ambalaj, adet: sayi(f.adet), tedarikci: f.tedarikci.trim(), faturaNo: f.faturaNo.trim(), birimFiyat: f.birimFiyat === '' ? '' : sayi(f.birimFiyat), notlar: '', ekler: [] } }]);
      bildir(NT.dil.m('{0} boş şişe rafa eklendi.', `${no} · ${f.adet} × ${amb(f.ambalaj)}`));
    }
    return html`<${Sihirbaz} baslik=${cevir("Şişe geldi")} adimlar=${adimlar} kapat=${kapat} kaydet=${kaydet} kaydetYazi=${cevir("Rafa ekle")} />`;
  }

  /* ---------------- Raf sayımı: tek seferde bir bölümü say ---------------- */
  function SayimSihirbazi({ kapat }) {
    const d = depo();
    const st = H.stok(d);
    const [bolum, setBolum] = useState('');
    const [sayilan, setSayilan] = useState({});
    const [kisi, setKisi] = useState('');
    const [tarih, setTarih] = useState(bugun());
    // Açık kap litresi (dolu kalemlerde) ve sayımda rafta bulunan ama sistemde olmayan yeni kalemler (2026-11-09).
    const [acikSayilan, setAcikSayilan] = useState({});
    const [ekKalemler, setEkKalemler] = useState([]);
    const [yeni, setYeni] = useState({ parti: '', ambalaj: '' });
    const bolumUrun = bolum && bolum !== 'bos' ? H.urunBul(d, bolum) : null;
    const kapLitre = (id) => sayi(H.ambalajlar(d, { hepsi: true }).find((a) => a.id === id)?.litre);
    const bolumler = [{ id: 'bos', ad: 'Boş şişeler', alt: `${H.ambalajlar(d).length} ambalaj` },
      ...H.urunler(d).map((u) => ({ id: u.ad, ad: u.ad, alt: `${[...st.dolu.values()].filter((x) => x.urun === u.ad && (x.mevcut !== 0 || x.acikL > 0)).length} kalem rafta` }))];
    const doluSatirlar = bolum === 'bos' ? [] : [...st.dolu.values()].filter((x) => x.urun === bolum && (x.mevcut !== 0 || x.rezerve || x.acikL > 0));
    for (const e of ekKalemler) if (e.urun === bolum && !doluSatirlar.some((x) => x.anahtar === e.anahtar)) doluSatirlar.push({ ...e, mevcut: 0, acikL: 0, yeni: true });
    const satirlar = bolum === 'bos'
      ? H.ambalajlar(d).map((a) => ({ k: a.id, ad: NT.dil.m('{0} boş şişe', a.ad), sistem: st.bos.get(a.id)?.mevcut ?? 0, hedef: { bos: true, ambalaj: a.id } }))
      : doluSatirlar.sort((a, x) => H.partiNo(x.parti) - H.partiNo(a.parti) || kapLitre(a.ambalaj) - kapLitre(x.ambalaj))
        .map((x) => ({ k: x.anahtar, ad: `${x.parti || 'Partisiz'} · ${amb(x.ambalaj)}`, sistem: x.mevcut, acik: x.acikL || 0, yeni: !!x.yeni, hedef: x }));
    const farklar = satirlar.map((r) => ({ ...r, s: sayilan[r.k] ?? r.sistem })).filter((r) => r.s !== '' && sayi(r.s) !== r.sistem);
    const acikFarklar = bolum === 'bos' ? [] : satirlar.map((r) => ({ ...r, a: acikSayilan[r.k] ?? r.acik }))
      .filter((r) => r.a !== '' && Math.abs(sayi(r.a) - r.acik) > 1e-9);
    const acikHatali = acikFarklar.filter((r) => sayi(r.a) > kapLitre(r.hedef.ambalaj) || sayi(r.a) < 0);
    const degisenSayisi = farklar.length + acikFarklar.length;
    const yeniEkle = () => {
      const parti = bolumUrun?.partili ? yeni.parti.trim() : '';
      if (!yeni.ambalaj || (bolumUrun?.partili && !parti)) return;
      const anahtar = H.anahtar(bolum, parti, yeni.ambalaj);
      setEkKalemler((l) => (l.some((x) => x.anahtar === anahtar) ? l : [...l, { anahtar, urun: bolum, parti, ambalaj: yeni.ambalaj }]));
      setYeni({ parti: '', ambalaj: '' });
      // Eklenen kalemin "Tam kap" kutusuna geç (telefonda klavye açık kalır).
      setTimeout(() => { const el = document.querySelector(`.tz-sayim-tablo tr[data-k="${CSS.escape(anahtar)}"] td.tam input`); if (el) { el.focus(); el.select(); } }, 60);
    };
    const yeniEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); yeniEkle(); } };
    // İlerlemeyi durduran durumlar: kalem ekleme kutuları doldurulmuş ama "Kalem ekle"ye basılmamış; eklenen kalemde adet girilmemiş.
    const eklenmemis = bolum !== 'bos' && (!!yeni.ambalaj || !!yeni.parti.trim());
    const adetsizYeni = satirlar.filter((r) => r.yeni && sayi(sayilan[r.k] ?? 0) === 0 && sayi(acikSayilan[r.k] ?? 0) === 0);
    const adimlar = [
      { soru: 'Hangi rafı sayıyorsunuz?', gecerli: () => !!bolum,
        icerik: ({ ileri }) => html`<div class="tz-secimler">${bolumler.map((x) => html`<${Secim} secili=${bolum === x.id} baslik=${x.ad} alt=${x.alt} onClick=${() => { setBolum(x.id); setSayilan({}); setAcikSayilan({}); ileri(); }} />`)}</div>` },
      { soru: 'Rafta ne sayıyorsunuz?', ipucu: bolum === 'bos' ? 'Sadece farklı olanları değiştirin. Sistem aradaki farkı düzeltme olarak kaydeder, eski kayıtlar değişmez.'
          : 'Tam kapları sayın; yarım kullanılmış (açık) kap varsa içindeki litreyi yazın. Rafta olup listede olmayan kalemi alttan ekleyin.', gecerli: () => !acikHatali.length && !eklenmemis && !adetsizYeni.length,
        icerik: () => html`${satirlar.length ? html`<table class="tz-sayim-tablo"><tbody>
          ${bolum !== 'bos' && html`<tr class="soluk kucuk sayim-baslik"><td></td><td></td><td>${cevir("Tam kap")}</td><td></td><td>${cevir("Açık kap (L)")}</td></tr>`}
          ${satirlar.map((r) => {
          const v = sayilan[r.k] ?? r.sistem;
          const fark = v === '' ? 0 : sayi(v) - r.sistem;
          const a = acikSayilan[r.k] ?? r.acik;
          return html`<tr class=${bolum !== 'bos' ? 'acikli' : ''} data-k=${r.k}><td class="ad"><b>${r.ad}</b>${r.yeni && html` <span class="rozet bilgi">${cevir("yeni")}</span>`}</td><td class="soluk sayi sistem">${cevir("sistem")} ${r.sistem}${r.acik > 0 ? ` + ${H.litreYazi(r.acik)}` : ''}</td>
            <td class="tam"><input class="girdi sayi" type="number" min="0" value=${v} onFocus=${(e) => e.target.select()} onInput=${(e) => setSayilan((p) => ({ ...p, [r.k]: e.target.value === '' ? '' : Number(e.target.value) }))} /></td>
            <td class="fark" style=${{ color: fark < 0 ? 'var(--yok)' : fark > 0 ? 'var(--iyi)' : 'var(--soluk)' }}>${fark > 0 ? '+' : ''}${fark || '—'}</td>
            ${bolum !== 'bos' && html`<td class="acik"><input class="girdi sayi" type="number" min="0" step="0.05" max=${kapLitre(r.hedef.ambalaj)} title=${NT.dil.m("Açık kapta kalan litre (kap {0})", H.litreYazi(kapLitre(r.hedef.ambalaj)))}
              style=${acikHatali.some((x) => x.k === r.k) ? 'border-color:var(--yok)' : ''} value=${a} onFocus=${(e) => e.target.select()}
              onInput=${(e) => setAcikSayilan((p) => ({ ...p, [r.k]: e.target.value === '' ? '' : Number(e.target.value) }))} /></td>`}</tr>`;
        })}</tbody></table>` : html`<p class="soluk">${cevir("Bu rafta kayıtlı numune yok.")}</p>`}
          ${acikHatali.length > 0 && html`<div class="uyari-kutu kritik" style="margin-top:12px"><${Ikon} ad="uyari" /><span>${cevir("Açık kaptaki litre kabın hacminden büyük olamaz.")}</span></div>`}
          ${adetsizYeni.length > 0 && html`<div class="uyari-kutu kritik" style="margin-top:12px"><${Ikon} ad="uyari" /><span>${cevir("Eklediğiniz")} ${adetsizYeni.map((r) => r.ad).join(', ')} ${cevir("için rafta saydığınız adedi (ya da açık kaptaki litreyi) yazın.")}</span></div>`}
          ${eklenmemis && html`<div class="uyari-kutu kritik" style="margin-top:12px"><${Ikon} ad="uyari" /><span>${cevir("Kalem henüz eklenmedi: “Kalem ekle”ye dokunun ya da kutuları boşaltın.")}</span></div>`}
          ${bolum !== 'bos' && html`<div class="tz-sayim-ekle" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:16px">
            <span class="kucuk soluk" style="width:100%">${cevir("Rafta olup listede olmayan kalem:")}</span>
            ${bolumUrun?.partili && html`<div style="flex:1;min-width:150px"><input class="girdi" list="tz-sayim-parti" placeholder=${cevir("Parti (örn. Batch #8)")} value=${yeni.parti} onInput=${(e) => setYeni((p) => ({ ...p, parti: e.target.value }))} onKeyDown=${yeniEnter} enterkeyhint="done" />
              <datalist id="tz-sayim-parti">${H.partiler(d, bolum).map((p) => html`<option value=${p} />`)}</datalist></div>`}
            <select class="girdi" style="width:auto" value=${yeni.ambalaj} onKeyDown=${yeniEnter} onChange=${(e) => setYeni((p) => ({ ...p, ambalaj: e.target.value }))}>
              <option value="">${cevir("Ambalaj…")}</option>${H.ambalajlar(d, { hepsi: true }).map((a) => html`<option value=${a.id}>${a.ad}</option>`)}</select>
            <button type="button" class="d kucuk-d" disabled=${!yeni.ambalaj || (bolumUrun?.partili && !yeni.parti.trim())} onClick=${yeniEkle}><${Ikon} ad="arti" boyut=${14} />${cevir("Kalem ekle")}</button>
          </div>`}` },
      { soru: degisenSayisi ? NT.dil.m('{0} fark kaydedilecek', degisenSayisi) : 'Her şey tutuyor 👌', ipucu: degisenSayisi ? 'Sayan kişi ve tarih zorunlu.' : '', gecerli: () => !degisenSayisi || (!!tarih && !!kisi.trim()),
        icerik: () => degisenSayisi ? html`<div class="form-izgara" style="margin-bottom:16px">
            <div class="alan s6"><label>${cevir("Sayan kişi (zorunlu)")}</label><${NT.ui.KisiSec} etiket=${cevir("Sayan kişi")} deger=${kisi} degis=${setKisi} liste=${NT.ui.kisiListesi(d.kayitlar('sayim').map((r) => r.kisi))} /></div>
            <div class="alan s6"><label>${cevir("Tarih (zorunlu)")}</label><input class="girdi" type="date" value=${tarih} onInput=${(e) => setTarih(e.target.value)} /></div>
          </div><ul class="tz-akis">${farklar.map((r) => html`<li style="cursor:default"><span class="ik sayim"><${Ikon} ad="sayim" /></span><span class="ne">${r.ad}<small>${cevir("sistemde")} ${r.sistem}${cevir(", sayılan")} ${r.s}</small></span><span class=${'miktar ' + (r.s - r.sistem > 0 ? 'arti' : 'eksi')}>${r.s - r.sistem > 0 ? '+' : ''}${r.s - r.sistem}</span></li>`)}
            ${acikFarklar.map((r) => html`<li style="cursor:default"><span class="ik acik"><${Ikon} ad="kutu" /></span><span class="ne">${r.ad} ${cevir("· açık kap")}<small>${cevir("sistemde")} ${H.litreYazi(r.acik)}${cevir(", sayılan")} ${H.litreYazi(sayi(r.a))}</small></span><span class="miktar notr">${H.litreYazi(sayi(r.a))}</span></li>`)}</ul>`
          : html`<p class="tz-ozet">${cevir("Sayım sistemle aynı. Kaydedilecek bir fark yok.")}</p>` },
    ];
    async function kaydet() {
      if (!degisenSayisi) return;
      const [on, yil, n] = H.yeniNo(d, 'sayim', tarih).split('-');
      let i = 0;
      const no = () => `${on}-${yil}-${String(+n + i++).padStart(4, '0')}`;
      const ortak = (r) => ({ tarih, kisi: kisi.trim(), urun: r.hedef.urun || '', parti: r.hedef.parti || '', ambalaj: r.hedef.ambalaj, neden: 'Raf sayımı' });
      const ops = [
        ...farklar.map((r) => ({ c: 'sayim', k: uid(), v: { no: no(), ...ortak(r), tur: r.hedef.bos ? 'bos' : 'dolu', onceki: r.sistem, sayilan: sayi(r.s), fark: sayi(r.s) - r.sistem } })),
        ...acikFarklar.map((r) => ({ c: 'sayim', k: uid(), v: { no: no(), ...ortak(r), tur: 'acik', onceki: r.acik, sayilan: sayi(r.a), litre: sayi(r.a), fark: Math.round((sayi(r.a) - r.acik) * 1000) / 1000 } })),
      ];
      await d.kaydet(ops);
      bildir(NT.dil.m("Raf sayımı kaydedildi: {0} düzeltme.", ops.length));
    }
    return html`<${Sihirbaz} baslik=${cevir("Raf sayımı")} adimlar=${adimlar} kapat=${kapat} kaydet=${kaydet} kaydetYazi=${cevir(degisenSayisi ? 'Düzeltmeleri kaydet' : 'Bitir')} />`;
  }

  const isEmirlerineGit = () => { location.hash = '#/isemirleri'; };
  const emirTuru = (tur) => tur === 'dolum' ? cevir('Dolum', 'Filling') : cevir('Stoktan hazırlama', 'Prepare from stock');
  async function emirIsle(id, islem, veri) {
    try { await H.emirYaz(depo(), id, islem, veri); return true; }
    catch (e) { bildir(cevir(e.message), { tur: 'hata' }); return false; }
  }

  function IsEmriFormu({ kapat, on = {} }) {
    const d = depo();
    const id = useRef(uid()).current;
    const mesgul = useRef(false);
    const [bekliyor, setBekliyor] = useState(false);
    const [f, setF] = useState({ tur: 'dolum', urun: '', parti: '', ambalaj: '', adet: 1, firma: '', notlar: '', ...on });
    const s = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
    const urun = H.urunBul(d, f.urun);
    const sevk = f.sevkId && d.kayit('sevk', f.sevkId);
    const st = H.stok(d).dolu.get(H.kalemAnahtari(f));
    const kendi = sevk ? H.kalemAdedi(sevk.kalemler, H.kalemAnahtari(f)) : 0;
    const ayrilabilir = Math.max(0, (st?.kullanilabilir || 0) + kendi);
    const gecerli = urun && (!urun.partili || f.parti.trim()) && f.ambalaj && Number.isSafeInteger(Number(f.adet)) && Number(f.adet) > 0;
    const kaydet = async (ev) => {
      ev.preventDefault();
      if (!gecerli || mesgul.current) return;
      mesgul.current = true;
      setBekliyor(true);
      try {
        if (await emirIsle(id, 'ac', { ...f, parti: f.parti.trim(), adet: Number(f.adet), firma: f.firma.trim(), notlar: f.notlar.trim() })) {
          kapat();
          isEmirlerineGit();
        }
      } finally { mesgul.current = false; setBekliyor(false); }
    };
    return html`<${NT.ui.Modal} dar baslik=${cevir('Yeni iş emri', 'New work order')} kapat=${kapat}
      alt=${html`<button class="d hayalet" onClick=${kapat}>${cevir('Vazgeç')}</button>
        <button type="submit" form=${'emir-' + id} class="d ana-d" disabled=${!gecerli || bekliyor}>${cevir('İş emrini aç', 'Create work order')}</button>`}>
      <form id=${'emir-' + id} class="modal-ic form-izgara" onSubmit=${kaydet}>
        <label class="alan s12">${cevir('Yapılacak iş', 'Task')}
          <select class="girdi" aria-label=${cevir('Yapılacak iş', 'Task')} value=${f.tur} onChange=${s('tur')}>
            <option value="dolum">${emirTuru('dolum')}</option><option value="hazirla">${emirTuru('hazirla')}</option>
          </select>
        </label>
        ${sevk ? html`<p class="s12" style="margin:0"><b>${sevk.no} · ${sevk.firma}</b><br />${kalemYazi(f)}</p>` : html`
          <label class="alan s6">${cevir('Ürün')}
            <select class="girdi" aria-label=${cevir('Ürün')} value=${f.urun} onChange=${(e) => setF((p) => ({ ...p, urun: e.target.value, parti: '' }))}>
              <option value="">${cevir('Seçin', 'Select')}</option>
              ${H.urunler(d, { hepsi: !!on.urun }).map((u) => html`<option value=${u.ad}>${u.ad}</option>`)}
            </select>
          </label>
          ${urun?.partili && html`<label class="alan s6">${cevir('Parti')}
            <input class="girdi" value=${f.parti} onInput=${s('parti')} list=${'emir-parti-' + id} placeholder="Batch #21" required />
            <datalist id=${'emir-parti-' + id}>${H.partiler(d, f.urun).map((p) => html`<option value=${p} />`)}</datalist>
          </label>`}
          <label class="alan s6">${cevir('Ambalaj')}
            <select class="girdi" aria-label=${cevir('Ambalaj')} value=${f.ambalaj} onChange=${s('ambalaj')}>
              <option value="">${cevir('Seçin', 'Select')}</option>
              ${H.ambalajlar(d, { hepsi: !!on.ambalaj }).map((a) => html`<option value=${a.id}>${a.ad}</option>`)}
            </select>
          </label>`}
        <label class="alan s6">${cevir('Adet')}<input class="girdi" type="number" min="1" max=${sevk ? kendi : null} step="1" value=${f.adet} onInput=${s('adet')} required /></label>
        ${f.tur === 'hazirla' && f.urun && f.ambalaj && html`<p class="s12 soluk kucuk" style="margin:0">${cevir('Ayrılabilir stok', 'Available stock')} · ${ayrilabilir}</p>`}
        ${!sevk && html`<label class="alan s12">${cevir('Alıcı firma (isteğe bağlı)', 'Recipient company (optional)')}
          <input class="girdi" value=${f.firma} onInput=${s('firma')} />
        </label>`}
        <label class="alan s12">${cevir('Not (isteğe bağlı)')}<textarea class="girdi" rows="2" value=${f.notlar} onInput=${s('notlar')} /></label>
      </form>
    <//>`;
  }

  function stokHazirlaFormu({ kapat }) {
    return html`<${IsEmriFormu} kapat=${kapat} on=${{ tur: 'hazirla' }} />`;
  }

  function HazirlamaTamamla({ id, kapat }) {
    const [yapanlar, setYapanlar] = useState([]);
    const [bekliyor, setBekliyor] = useState(false);
    return html`<${NT.ui.Modal} dar baslik=${cevir('Hazırlamayı kimler yaptı?', 'Who prepared the samples?')} kapat=${kapat}
      alt=${html`<button class="d ana-d" disabled=${!yapanlar.length || bekliyor} onClick=${async () => {
        setBekliyor(true);
        try { if (await emirIsle(id, 'tamamla', { yapanlar })) kapat(); }
        finally { setBekliyor(false); }
      }}>${cevir('Hazırlamayı tamamla', 'Complete preparation')}</button>`}>
      <div class="modal-ic"><${NT.ui.DolduranSecimi} secili=${yapanlar} degis=${setYapanlar} /></div>
    <//>`;
  }

  function IsEmriKarti({ emir: e }) {
    const d = depo();
    const sevk = e.sevkId && d.kayit('sevk', e.sevkId);
    const dolum = e.dolumId && d.kayit('dolum', e.dolumId);
    const [mesgul, setMesgul] = useState(false);
    const durum = {
      bekliyor: cevir('Üstlenilmeyi bekliyor', 'Awaiting pickup'),
      ustlenildi: cevir('Üstlenildi', 'Claimed'),
      tamamlandi: e.dolumSilindi ? cevir('Dolum kaydı silindi', 'Fill record deleted')
        : e.ayirmaKaldirildi ? cevir('Ayırma kaldırıldı', 'Stock released')
        : sevk?.iptal || sevk?._silindi ? cevir('Gönderi iptal edildi', 'Shipment cancelled')
        : sevk?.durum === 'Gönderildi' ? cevir('Gönderildi', 'Shipped')
        : e.tur === 'dolum' && !e.firma ? cevir('Dolduruldu', 'Filled') : cevir('Gönderime hazır', 'Ready to ship'),
      iptal: cevir('İptal edildi', 'Cancelled'),
    }[e.durum];
    const isle = async (islem) => {
      setMesgul(true);
      try { await emirIsle(e.id, islem); } finally { setMesgul(false); }
    };
    return html`<article class="tz-gonderi tz-detay-kart">
      <div class="bas"><span class="etiket-kod">${e.no}</span><b>${emirTuru(e.tur)}</b><span class="gun">${tarihYaz(e.tarih)}</span></div>
      <div class="tz-sise-cipler"><span class="tz-sise-cip"><b>${e.adet}</b>${kalemYazi(e)}</span><span class="rozet">${durum}</span></div>
      <p class="soluk kucuk" style="margin:8px 0">
        ${cevir('Açan', 'Opened by')} · ${e._olusturan}
        ${e.ustlenen && html`<br />${cevir('Üstlenen', 'Claimed by')} · ${e.ustlenen}`}
        ${e.yapanlar?.length && html`<br />${cevir('İşi yapanlar', 'Completed by')} · ${e.yapanlar.join(', ')}`}
        ${e.firma && html`<br />${cevir('Firma')} · ${e.firma}`}
        ${e.notlar && html`<br />${e.notlar}`}
      </p>
      <div class="alt">
        ${e.durum === 'bekliyor' && html`<button class="d ana-d kucuk-d" disabled=${mesgul} onClick=${() => isle('ustlen')}>${cevir('Üstlen', 'Claim')}</button>`}
        ${e.durum === 'ustlenildi' && html`<button class="d ana-d kucuk-d" onClick=${() => e.tur === 'dolum'
          ? sihirbazAc(DolumSihirbazi, { emir: e }) : F.ac(HazirlamaTamamla, { id: e.id })}>${cevir('Tamamla', 'Complete')}</button>`}
        ${H.emirSevkeHazir(e) && html`<button class="d ana-d kucuk-d" onClick=${() => sihirbazAc(GonderSihirbazi, { emir: e })}>${cevir('Gönderi oluştur', 'Create shipment')}</button>`}
        ${sevk && !sevk._silindi && html`<button class="d kucuk-d" onClick=${() => F.ac(GonderiDetayi, { s: sevk })}>${sevk.no}${sevk.iptal ? ' · ' + cevir('İptal edildi') : ''}</button>`}
        ${dolum && !dolum._silindi && html`<button class="d kucuk-d" onClick=${() => F.kayitAc('dolum', dolum)}>${dolum.no}</button>`}
        ${(H.emirAcik(e) || H.emirSevkeHazir(e)) && html`<button class="d hayalet kucuk-d" disabled=${mesgul} onClick=${async () => {
          const acik = H.emirAcik(e);
          const yazi = acik ? cevir('Bu iş emri iptal edilsin mi?', 'Cancel this work order?')
            : cevir('Bu iş emri için ayrılan şişeler serbest bırakılsın mı?', 'Release the bottles reserved for this work order?');
          if (await onayla(yazi)) await isle(acik ? 'iptal' : 'ayirmayiKaldir');
        }}>${H.emirAcik(e) ? cevir('İptal et') : cevir('Ayırmayı kaldır', 'Release stock')}</button>`}
      </div>
    </article>`;
  }

  function IsEmirleri() {
    const d = depo();
    const [filtre, setFiltre] = useState('hepsi');
    const tum = d.kayitlar('isemri').sort((a, b) => Number(H.emirAcik(b)) - Number(H.emirAcik(a)) || b._olusturma - a._olusturma);
    const gruplar = {
      acik: tum.filter(H.emirAcik), hazir: tum.filter(H.emirSevkeHazir), hepsi: tum,
    };
    return html`<div class="tz-selam"><div><h1>${cevir('İş Emirleri', 'Work Orders')}</h1></div>
      ${H.emirAcabilir(b.kullanici) && html`<button class="d ana-d tz-buyuk" onClick=${() => F.ac(IsEmriFormu)}><${Ikon} ad="arti" />${cevir('Yeni iş emri', 'New work order')}</button>`}</div>
      <div class="tz-cipler">
        ${[['acik', cevir('Açık', 'Open')], ['hazir', cevir('Gönderime hazır', 'Ready to ship')], ['hepsi', cevir('Hepsi')]].map(([id, yazi]) =>
          html`<button class=${'tz-cip' + (filtre === id ? ' secili' : '')} onClick=${() => setFiltre(id)}>${yazi}<span class="n">${gruplar[id].length}</span></button>`)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr));gap:14px">${gruplar[filtre].map((e) => html`<${IsEmriKarti} key=${e.id} emir=${e} />`)}</div>
      ${!gruplar[filtre].length && html`<div class="tz-kart soluk">${cevir('Bu görünümde iş emri yok.', 'No work orders in this view.')}</div>`}`;
  }

  function GenelBakisIsEmirleri() {
    const acik = depo().kayitlar('isemri').filter(H.emirAcik)
      .sort((a, b) => Number(a.durum !== 'bekliyor') - Number(b.durum !== 'bekliyor') || b._olusturma - a._olusturma);
    if (!acik.length) return null;

    return html`<section class="tz-genel-is-emirleri" aria-labelledby="genel-is-emirleri">
      <div class="tz-kart-bas">
        <h2 id="genel-is-emirleri"><${Ikon} ad="dolum" boyut=${22} />${cevir('Açık iş emirleri', 'Open work orders')} <span>${acik.length}</span></h2>
        <a class="d kucuk-d" href="#/isemirleri">${cevir('Tüm iş emirleri', 'All work orders')} →</a>
      </div>
      <div class="tz-genel-is-emri-kartlari">${acik.slice(0, 3).map((e) => html`<${IsEmriKarti} key=${e.id} emir=${e} />`)}</div>
    </section>`;
  }

  const yeniEmirAc = (on) => H.emirAcabilir(b.kullanici) ? F.ac(IsEmriFormu, { on }) : isEmirlerineGit();
  // Hareket defteri dolum ve hazırlama işlerini aynı kart üzerinden başlatır.
  NT.eylem = {
    dolum: (on) => yeniEmirAc({ ...on, tur: 'dolum' }),
    sevk: (on) => yeniEmirAc({ ...on?.sepet?.[0], tur: 'hazirla' }),
    alim: (on) => sihirbazAc(AlimSihirbazi, { on }),
  };

  const EYLEMLER = [
    { ad: 'Dolum iş emri', en: 'Fill work order', alt: 'Dolum iş emri', ikon: 'dolum', tus: 'N', B: IsEmriFormu, birincil: true, emir: true },
    { ad: 'Hazırlama iş emri', en: 'Preparation work order', alt: 'Hazırlama iş emri', ikon: 'sevk', tus: 'S', B: stokHazirlaFormu, emir: true },
    { ad: 'Şişe geldi', alt: 'Boş ambalaj alımı', ikon: 'alim', tus: 'A', B: AlimSihirbazi },
    { ad: 'Raf sayımı', alt: 'Say, farkları düzelt', ikon: 'sayim', tus: 'R', B: SayimSihirbazi },
  ];

  /* ---------------- Gönderi kartı ---------------- */
  const DURUMLAR = H.SEVK_DURUMLARI;
  const DURUM_ADI = { 'Karar Aşaması': 'Karar', Beklemede: 'Hazırlanıyor', 'Etiket Bekliyor': 'Etiket', Gönderildi: 'Yola çıktı' };
  async function ilerlet(s) {
    const d = depo();
    const sonraki = DURUMLAR[DURUMLAR.indexOf(s.durum) + 1];
    if (!sonraki) return;
    const v = { durum: sonraki };
    if (sonraki === 'Gönderildi') {
      const eksik = H.sevkKontrol(d, s.kalemler || [], s.id);
      if (eksik.length && !(await onayla(NT.dil.m("Rafta yetersiz: {0}. Yine de yola çıktı olarak işaretlensin mi?", eksik.map((e) => `${e.urun} ${e.parti} ${amb(e.ambalaj)}`).join(', ')), { baslik: cevir("Stok yetersiz"), evet: cevir("Evet") }))) return;
      if (s.tarih < bugun()) v.tarih = bugun();
    }
    try {
      await H.sevkYaz(d, s.id, v, { mevcut: true, beklenenDurum: s.durum, eskiEksigeIzin: true });
      bildir(`${s.no} · ${s.firma}: ${cevir(DURUM_ADI[sonraki])}`, { eylem: { yazi: 'Geri al', fn: async () => {
        try { await H.sevkYaz(d, s.id, { durum: s.durum, tarih: s.tarih }, { mevcut: true, beklenenDurum: sonraki }); }
        catch (e) { bildir(cevir(e.message), { tur: 'hata' }); }
      } } });
    } catch (e) { bildir(cevir(e.message), { tur: 'hata' }); }
  }
  function GonderiDetayi({ s, kapat }) {
    const { KayitDetay, DetayBolumu, SevkRozeti, DetayEkleri } = NT.ui;
    const baslik = [s.no, s.firma].filter(Boolean).join(' · ');
    const durum = s.iptal ? html`<span class="rozet yok">${cevir('İptal edildi')}</span>` : html`<${SevkRozeti} durum=${s.durum} />`;
    const kalemler = s.kalemler || [];
    const alanlar = [
      [cevir('İrtibat yetkilisi'), s.yetkili], [cevir('Telefon'), s.telefon],
      [cevir('Ülke'), cevir(s.ulke)],
      [cevir('Talep sebebi'), s.sebep], [cevir('Talep tarihi'), s.talepTarihi && tarihYaz(s.talepTarihi)],
      [cevir('Sorumlu'), s.sorumlu], [cevir('Geri bildirim'), s.geriBildirim],
      [cevir('Teslim adresi'), s.adres, true], [cevir('Diğer iletişim bilgileri'), s.irtibatDetay, true],
    ];
    const gonderi = [
      [cevir('Gönderi şekli'), cevir(s.sekil)],
      [cevir('Taşıyıcı', 'Carrier'), s.kargoFirma], [cevir('Takip no', 'Tracking number'), s.takipNo],
      [cevir('Numune noktası / parti açıklaması'), s.numuneYeri, true],
      [cevir('İptal tarihi', 'Cancellation date'), s.iptal && s.iptalTarihi && tarihYaz(s.iptalTarihi)],
      [cevir('İptal nedeni', 'Cancellation reason'), s.iptal && s.iptalNeden, true],
    ];
    const ozet = [
      [cevir('Toplam hacim'), `${litreYaz(H.sevkLitre(depo(), kalemler))} L`],
      [cevir('Adet'), kalemler.reduce((t, k) => t + sayi(k.adet), 0)],
      [cevir('Tarih'), s.tarih && tarihYaz(s.tarih)],
    ];
    return html`<${KayitDetay} ozet=${ozet} baslik=${baslik} durum=${durum} kapat=${kapat}>
      ${kalemler.length > 0 && html`<${DetayBolumu} baslik=${cevir('Gönderilen numuneler', 'Samples shipped')} ikon="dolum">
        ${H.siseSlotlari(kalemler, s.siseler || []).map((yuvalar, i) => {
          const k = kalemler[i];
          const siseler = yuvalar.filter((x) => x.no || x.ek);
          return html`<div class="tz-detay-kalem"><${DetayBolumu} baslik=${`${k.adet} × ${kalemYazi(k)}`}
            gorsel=${html`<${NT.ui.Sise} litre=${H.sevkLitre(depo(), [{ ...k, adet: 1 }])} boyut=${0.7} />`}
            belgeler=${[['CoA', k.coaBelge], [cevir('Diğer ekler'), k.belgeler]]}>
            ${siseler.length > 0 && html`<ul class="tz-detay-etiketler">${siseler.map((x) => html`<li>
              ${x.no}${x.ek && html`<${DetayEkleri} ekler=${[x.ek]} />`}
            </li>`)}</ul>`}
          <//></div>`;
        })}
      <//>`}
      <${DetayBolumu} baslik=${cevir('Alıcı', 'Recipient')} ikon="kisi" alanlar=${alanlar} />
      <${DetayBolumu} baslik=${cevir('Gönderi', 'Shipment')} ikon="sevk" alanlar=${gonderi} />
      <${DetayBolumu} baslik=${cevir('Ekler')} ikon="belge"
        belgeler=${[[cevir('Kargo belgesi', 'Shipping document'), s.kargoBelge], [cevir('Diğer ekler'), s.ekler]]} />
      <${DetayBolumu} baslik=${cevir('Not')} ikon="kalem">
        ${s.notlar && html`<p class="tz-detay-not">${s.notlar}</p>`}
      <//>
      <${NT.ui.GecmisBolumu} kayit=${s} />
    <//>`;
  }

  function GonderiKarti({ s }) {
    const d = depo();
    const emirler = H.sevkEmirleri(d, s.id);
    const acikEmir = emirler.some(H.emirAcik);
    const emirAcilabilir = H.emirAcabilir(b.kullanici) && H.sevkEtkili(s) && s.durum !== 'Gönderildi';
    const yeniEmirKalemleri = [...new Map((s.kalemler || []).map((k) => [H.kalemAnahtari(k), k])).values()]
      .filter((k) => !emirler.some((e) => H.kalemAnahtari(e) === H.kalemAnahtari(k)));
    const yer = DURUMLAR.indexOf(s.durum);
    const gun = gunFarki(s.tarih || bugun(), bugun());
    const sonraki = s.iptal ? null : DURUMLAR[yer + 1];
    return html`<div class="tz-gonderi tz-detay-kart" style=${s.iptal ? 'opacity:.75' : ''}>
      <div class="bas"><span class="etiket-kod">${s.no}</span><${NT.ui.KartDetayDugmesi} no=${s.no} firma=${s.firma} ac=${() => F.ac(GonderiDetayi, { s })} />
        ${s.ulke && s.ulke !== 'Türkiye' && html`<span class="soluk kucuk">${cevir(s.ulke)}</span>`}
        ${s.iptal ? html`<span class="gun"><span class="rozet yok" title=${s.iptalNeden || ''}><${Ikon} ad="kapat" />${cevir("İptal edildi")}</span></span>`
          : html`<span class=${'gun' + (s.durum !== 'Gönderildi' && gun >= 7 ? ' gec' : '')}>${s.durum === 'Gönderildi' ? tarihYaz(s.tarih) : gun === 0 ? cevir("bugün") : NT.dil.m("{0} gündür", gun)}</span>`}</div>
      <div class="tz-sise-cipler">${(s.kalemler || []).map((k) => html`<span class="tz-sise-cip"><b>${k.adet}</b>${kalemYazi(k)}</span>`)}
        <span class="tz-sise-cip" title=${cevir("Toplam hacim")}>${litreYaz(H.sevkLitre(depo(), s.kalemler))} L</span>
        ${(() => { const t = (s.kalemler || []).reduce((n, k) => n + sayi(k.adet), 0), e = (s.siseler || []).filter((x) => x.ek).length;
          return e > 0 && html`<span class=${'tz-sise-cip etiket-sayac' + (e < t ? ' eksik' : '')} title=${cevir("Şişe etiketi yüklenen şişe")}><${Ikon} ad="etiket" boyut=${13} />${e}/${t}</span>`; })()}</div>
      <div class="tz-adimlar">${DURUMLAR.map((x, i) => html`${i > 0 && html`<span class=${'tz-cizgi' + (i <= yer ? ' gecti' : '')} />`}
        <span class=${'tz-adim' + (i < yer || (i === yer && x === 'Gönderildi') ? ' gecti' : i === yer ? ' simdi' : '')}><span class="o">${i < yer || x === s.durum && x === 'Gönderildi' ? html`<${Ikon} ad="tik" boyut=${12} />` : ''}</span><span class="yazi">${cevir(DURUM_ADI[x])}</span></span>`)}</div>
      <div class="alt">
        ${s.iptal ? html`<span class="soluk kucuk">${s.iptalNeden || cevir("Neden yazılmamış")}${s.iptalTarihi ? ` · ${tarihYaz(s.iptalTarihi)}` : ''}</span>`
        : sonraki ? html`<button class="d ana-d kucuk-d" disabled=${acikEmir && sonraki !== 'Beklemede'} onClick=${() => ilerlet(s)}>→ ${cevir(DURUM_ADI[sonraki])}</button>` : s.sekil === 'Kargo' && !s.takipNo && !(s.kargoBelge || []).length ? html`<button class="tz-alarm" style="border:0;cursor:pointer" title=${cevir("Kargo firmasından gelen gönderi belgesini yükleyin")} onClick=${() => F.kayitAc('sevk', s)}><${Ikon} ad="bilgi" />${cevir("Kargo belgesi yok")}</button>`
          : html`<span class="soluk kucuk">${[s.kargoFirma, s.takipNo, (s.kargoBelge || []).length && 'kargo belgesi var'].filter(Boolean).join(' · ') || s.sekil}</span>`}
        <span class="bosluk" />
        ${emirler.length > 0 && html`<a class="d kucuk-d" href="#/isemirleri">${cevir('İş Emirleri', 'Work Orders')} · ${emirler.length}</a>`}
        ${emirAcilabilir && yeniEmirKalemleri.map((k) => html`<button class="d hayalet kucuk-d" title=${kalemYazi(k)} onClick=${() => {
          const adet = H.kalemAdedi(s.kalemler, H.kalemAnahtari(k));
          const eksik = Math.min(adet, Math.max(0, -(H.stok(d).dolu.get(H.kalemAnahtari(k))?.kullanilabilir || 0)));
          yeniEmirAc({ ...k, sevkId: s.id, adet: eksik || adet, tur: eksik ? 'dolum' : 'hazirla' });
        }}>${cevir('İş emri aç', 'Open work order')}${yeniEmirKalemleri.length > 1 ? ` · ${kalemYazi(k)}` : ''}</button>`)}
        ${s.iptal ? html`<button class="d hayalet kucuk-d" onClick=${() => F.iptalGeriAl(s)}><${Ikon} ad="geri" boyut=${15} />${cevir("İptali geri al")}</button>`
          : s.durum !== 'Gönderildi' && html`<button class="d hayalet kucuk-d" title=${cevir("Vazgeçildi: kayıt kalır, şişeler rafa döner")} onClick=${() => F.iptalEt(s)}><${Ikon} ad="kapat" boyut=${15} />${cevir("İptal et")}</button>`}
        <button class="d hayalet kucuk-d" onClick=${() => NT.etiket.ac({ tur: 'sevk', kayit: s })}><${Ikon} ad="yazici" boyut=${15} />${cevir("Gönderi etiketi")}</button>
        <button class="d hayalet kucuk-d" onClick=${() => F.kayitAc('sevk', s)}><${Ikon} ad="kalem" boyut=${15} />${cevir("Düzenle")}</button>
      </div>
    </div>`;
  }

  /* ---------------- Hareket listesi (akış ve geçmiş) ---------------- */
  function hareketler(d) {
    const l = [];
    for (const r of d.kayitlar('dolum')) l.push({ c: 'dolum', r, tarih: r.tarih, metin: html`<b>${r.adet} × ${r.urun}</b> ${r.parti || ''} · ${amb(r.ambalaj)} ${cevir("dolduruldu")}${r.kaynakTur ? html` <span class="soluk">(${H.dolumKaynagi(r)})</span>` : ''}${r.dolduranlar?.length ? html` <span class="soluk">· ${H.dolduranYaz(r)}</span>` : ''}`, miktar: `+${r.adet}`, tur: 'arti' });
    for (const r of d.kayitlar('sevk')) {
      const n = (r.kalemler || []).reduce((t, k) => t + sayi(k.adet), 0);
      l.push({ c: 'sevk', r, tarih: r.tarih, metin: html`<b>${r.firma}</b> ${cevir("firmasına")} ${n} ${cevir("şişe ·")} ${cevir(DURUM_ADI[r.durum] || r.durum)}`, miktar: r.durum === 'Gönderildi' ? `−${n}` : `${n} rezerve`, tur: r.durum === 'Gönderildi' ? 'eksi' : 'notr' });
    }
    for (const r of d.kayitlar('alim')) l.push({ c: 'alim', r, tarih: r.tarih, metin: html`<b>${r.adet} × ${amb(r.ambalaj)}</b> ${cevir("boş şişe geldi")}${r.tedarikci ? ' · ' + r.tedarikci : ''}`, miktar: `+${r.adet}`, tur: 'arti' });
    for (const r of d.kayitlar('sayim')) l.push(r.tur === 'acik'
      ? { c: 'sayim', r, tarih: r.tarih, metin: html`${cevir("Sayım:")} <b>${r.urun} ${r.parti || ''} ${amb(r.ambalaj)}</b> ${cevir("açık kap")} ${H.litreYazi(sayi(r.onceki))} → ${H.litreYazi(sayi(r.litre))}`, miktar: cevir('açık', 'open'), tur: 'notr' }
      : { c: 'sayim', r, tarih: r.tarih, metin: html`${cevir("Sayım:")} <b>${r.tur === 'bos' ? amb(r.ambalaj) + ' ' + cevir('boş', 'empty') : `${r.urun} ${r.parti || ''} ${amb(r.ambalaj)}`}</b> ${r.onceki} → ${r.sayilan}`, miktar: `${r.fark > 0 ? '+' : ''}${r.fark}`, tur: r.fark > 0 ? 'arti' : 'eksi' });
    const ACIK_AD = { tamamla: 'üstü tamamlandı', atik: 'atığa ayrıldı', not: 'açıklama' };
    for (const r of d.kayitlar('acik')) l.push({ c: 'acik', ikon: r.tur === 'atik' ? 'cop' : r.tur === 'tamamla' ? 'dolum' : 'kalem', r, tarih: r.tarih,
      metin: html`${cevir("Açık kap:")} <b>${r.urun} ${r.parti || ''} ${amb(r.ambalaj)}</b> ${cevir(ACIK_AD[r.tur] || r.tur)}${r.aciklama ? html` <span class="soluk">· ${r.aciklama}</span>` : ''}`,
      miktar: r.tur === 'tamamla' ? '+1' : r.tur === 'atik' ? `${H.litreYazi(sayi(r.litre))} ${cevir('atık', 'waste')}` : '', tur: r.tur === 'tamamla' ? 'arti' : 'notr' });
    // Eski sistemden "sadece geçmiş" aktarılanlar listede kalır ama stok etkisi yok.
    for (const h of l) if (h.r.iptal) { h.miktar = 'iptal'; h.tur = 'notr'; }
    return l.sort((a, x) => (a.tarih < x.tarih ? 1 : a.tarih > x.tarih ? -1 : x.r._degisim - a.r._degisim));
  }
  function HareketSatiri({ h }) {
    const ac = () => (h.c === 'sayim' || h.c === 'acik' ? E.defterAc(h.r.tur === 'bos' ? { bos: true, ambalaj: h.r.ambalaj } : h.r) : F.kayitAc(h.c, h.r));
    return html`<li onClick=${ac}>
      <span class=${'ik ' + h.c}><${Ikon} ad=${h.ikon || h.c} /></span>
      <span class="ne">${h.metin}<small>${h.r.no} · ${h.r._degistiren} · ${onceYaz(h.r._degisim)}</small></span>
      <span class=${'miktar ' + h.tur}>${h.miktar}</span>
    </li>`;
  }

  /* ---------------- Genel Bakış (ana ekran, raf) ---------------- */
  function GenelBakis() {
    const d = depo();
    const st = H.stok(d);
    const ambalajlar = H.ambalajlar(d);
    const litre = (id) => H.ambalajlar(d, { hepsi: true }).find((a) => a.id === id)?.litre;
    const dolu = [...st.dolu.values()];
    const hazir = dolu.reduce((t, x) => t + Math.max(0, x.mevcut), 0);
    const bos = ambalajlar.reduce((t, a) => t + Math.max(0, st.bos.get(a.id)?.mevcut ?? 0), 0);
    const yolda = d.kayitlar('sevk').filter((s) => s.durum !== 'Gönderildi' && H.sevkEtkili(s)).sort((a, x) => (a.tarih < x.tarih ? -1 : 1));
    const uyarilar = [...st.urunAmbalaj.values()].filter((t) => t.alarm && t.durum !== 'iyi' && (t.durum !== 'yok' || (t.sonDolum || '') >= gunEkle(bugun(), -365)));
    // Hiç girişi olmamış ambalaj "azalıyor" sayılmaz (ilk kurulumda her şey kırmızı yanmasın); eksiye düşen hep sayılır.
    const bosIzleniyor = (x) => !!x && (x.alinan > 0 || x.duzeltme !== 0 || x.kullanilan > 0);
    const bosUyari = ambalajlar.filter((a) => { const x = st.bos.get(a.id); return x && x.durum !== 'iyi' && bosIzleniyor(x); });
    const saat = new Date().getHours();
    const ad = (b.kullanici || '').split(' ')[0];

    const urunler = H.urunler(d, { hepsi: true });
    const partililer = urunler.filter((u) => u.partili);
    const gorunur = (x) => x.mevcut !== 0 || x.rezerve || x.acikL > 0;
    const raf = partililer.map((u) => {
      const kalemler = dolu.filter((x) => x.urun === u.ad && gorunur(x));
      const partiler = [...new Set(kalemler.map((x) => x.parti))].sort((a, x) => H.partiNo(x) - H.partiNo(a));
      return { u, satirlar: partiler.map((p) => ({ ad: p || 'Partisiz', kalemler: kalemler.filter((x) => x.parti === p) })) };
    }).filter((g) => g.satirlar.length);
    const digerAdlar = new Set(partililer.map((u) => u.ad));
    const diger = [...new Set(dolu.filter((x) => !digerAdlar.has(x.urun) && gorunur(x)).map((x) => x.urun))].sort(trSirala)
      .map((ad) => ({ ad, duz: true, kalemler: dolu.filter((x) => x.urun === ad && gorunur(x)) }));
    const siraAmb = new Map(ambalajlar.map((a, i) => [a.id, i]));
    const Satir = ({ s }) => html`<div class="tz-raf-satir"><span class=${'ad' + (s.duz ? ' duz' : '')}>${s.ad}</span>
      <div class="tz-yuvalar">${[...s.kalemler].sort((a, x) => (siraAmb.get(a.ambalaj) ?? 99) - (siraAmb.get(x.ambalaj) ?? 99)).map((x) => html`<button class="tz-yuva" title=${NT.dil.m("{0} {1} {2}: rafta {3} tam kap{4}{5}. Geçmiş için tıklayın.", x.urun, x.parti, amb(x.ambalaj), x.mevcut, x.acikL > 0 ? ` + ${cevir('açık kap')} ${H.litreYazi(x.acikL)}${x.acikAciklama ? ' (' + x.acikAciklama + ')' : ''}` : '', x.rezerve ? `, ${x.rezerve} ${cevir('rezerve', 'reserved')}` : '')} onClick=${() => E.defterAc(x)}>
        <span class=${'rozet-n' + (x.mevcut < 0 ? ' eksi' : '')}>${x.mevcut}</span><${Sise} litre=${litre(x.ambalaj)} boyut=${0.9} /><span class="a">${amb(x.ambalaj)}</span>${x.acikL > 0 && html`<span class="r acik">${cevir("+ açık")} ${H.litreYazi(x.acikL)}</span>`}${x.rezerve > 0 && html`<span class="r">${x.rezerve} ${cevir("ayrıldı")}</span>`}
      </button>`)}</div></div>`;

    return html`
      <div class="tz-selam tz-selam-bant"><${NT.ui.BantSus} /><div>
        <h1>${cevir(saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar')}${ad ? ', ' + ad : ''}.</h1>
        <p>${cevir("Rafta")} <b class="v">${adetYaz(hazir)} ${cevir("dolu numune")}</b> ${cevir("ve")} <b>${adetYaz(bos)} ${cevir("boş şişe")}</b> ${cevir("var.")}
          ${yolda.length ? html` <b>${yolda.length} ${cevir("gönderi")}</b> ${cevir("yolda bekliyor.")}` : cevir(" Bekleyen gönderi yok.")}
          ${uyarilar.length + bosUyari.length ? html` <b class="u">${uyarilar.length + bosUyari.length} ${cevir("kalem")}</b> ${cevir("azalıyor.")}` : ''}</p>
      </div></div>

      <${GenelBakisIsEmirleri} />
      <div class="tz-izgara">
        <section class="tz-kart">
          <div class="tz-kart-bas"><h2>${cevir("Boş şişe stok")}</h2><div class="sag"><span class="raf-ipucu">${cevir("rozetteki sayı: rafta · şişeye tıklayınca geçmişi açılır")}</span>
            <button class="d kucuk-d" onClick=${E.whatsappKopyala} title=${cevir("Eski WhatsApp sayım biçiminde panoya kopyalar")}><${Ikon} ad="whatsapp" boyut=${15} />${cevir("Sayım listesi")}</button>
            <button class="d kucuk-d" onClick=${E.disaAktar.stok} title=${cevir("Raftaki stok (Excel dosyası)")}><${Ikon} ad="indir" boyut=${15} />Excel</button></div></div>
          <div class="tz-bos-serit">${ambalajlar.map((a) => {
            const x = st.bos.get(a.id) || { mevcut: 0, durum: 'yok' };
            return html`<button class=${'tz-bos ' + (x.durum !== 'iyi' && bosIzleniyor(x) ? x.durum : '')} onClick=${() => E.defterAc({ bos: true, ambalaj: a.id })} title=${NT.dil.m("{0}: {1} boş şişe", a.ad, x.mevcut)}>
              <span class="s"><${Sise} litre=${a.litre} /></span><span class="n">${x.mevcut}</span><span class="a">${a.ad} ${cevir("boş")}</span></button>`;
          })}</div>
          ${(raf.length > 0 || diger.length > 0) && html`<h2 class="tz-ara-baslik">${cevir("Dolu numune stok")}</h2>`}
          ${raf.map((g) => html`<div class="tz-urun">
            <div class="tz-urun-bas"><h3>${g.u.ad}</h3><span class="toplam">${g.satirlar.reduce((t, s) => t + s.kalemler.reduce((a, x) => a + x.mevcut, 0), 0)} ${cevir("şişe ·")} ${g.satirlar.length} ${cevir("parti")}</span>
              <span class="sag">${uyarilar.filter((t) => t.urun === g.u.ad).map((t) => html`<span class=${'tz-alarm ' + t.durum}><${Ikon} ad="uyari" />${amb(t.ambalaj)}${cevir(": toplam")} ${t.mevcut}</span>`)}</span></div>
            <div class="tz-raf-izgara">${g.satirlar.map((s) => html`<${Satir} s=${s} />`)}</div>
          </div>`)}
          ${diger.length > 0 && html`<div class="tz-urun"><div class="tz-urun-bas"><h3>${cevir("Ar-Ge ve diğer ürünler")}</h3></div><div class="tz-raf-izgara">${diger.map((s) => html`<${Satir} s=${s} />`)}</div></div>`}
          ${!raf.length && !diger.length && (d.olaylar.size > 20
            ? html`<p class="soluk">${cevir("Rafta dolu numune yok. “Dolum yaptım” ile ekleyin.")}</p>`
            : html`<div class="uyari-kutu bilgi"><${Ikon} ad="bilgi" /><span><b>${cevir("Raf boş — ilk adım:")}</b>
                ${cevir("eski sistemdeki kayıtlarınızı")} <a href="#/ayarlar">${cevir("Ayarlar › Yedek ve aktarım › “Eski sistemden aktar”")}</a> ${cevir("ile yükleyin\r\n                (")}<code>numune_data.json</code>${cevir("). Sıfırdan başlıyorsanız önce “Şişe geldi” ile boş şişeleri, sonra “Dolum yaptım” ile dolumları girin.")}</span></div>`)}
        </section>

        <div class="tz-sutun">
          <section class="tz-kart">
            <div class="tz-kart-bas"><h2>${cevir("Yoldaki gönderiler")}</h2><div class="sag"><a href="#/gonderiler" style="color:var(--ana)">${cevir("Tümü →")}</a></div></div>
            ${yolda.length ? yolda.slice(0, 4).map((s) => html`<${GonderiKarti} key=${s.id} s=${s} />`) : html`<p class="soluk" style="margin:0">${cevir("Bekleyen gönderi yok.")}</p>`}
            ${yolda.length > 4 && html`<p class="kucuk soluk" style="margin:12px 0 0">+ ${yolda.length - 4} ${cevir("gönderi daha")}</p>`}
          </section>
          <section class="tz-kart">
            <div class="tz-kart-bas"><h2>${cevir("Son hareketler")}</h2><div class="sag"><a href="#/gecmis" style="color:var(--ana)">${cevir("Geçmiş →")}</a></div></div>
            ${hareketler(d).length ? html`<ul class="tz-akis">${hareketler(d).sort((a, x) => x.r._degisim - a.r._degisim).slice(0, 7).map((h) => html`<${HareketSatiri} key=${h.c + h.r.id} h=${h} />`)}</ul>`
              : html`<p class="soluk" style="margin:0">${cevir("Henüz hareket yok. Girilen her dolum, gönderi ve şişe girişi burada kimin yaptığıyla görünür.")}</p>`}
          </section>
        </div>
      </div>`;
  }

  /* ---------------- Gönderiler ---------------- */
  function Gonderiler() {
    const d = depo();
    const [f, setF] = useState('yolda');
    const [q, setQ] = useState('');
    const tum = d.kayitlar('sevk').filter((s) => ara(`${s.no} ${s.firma} ${s.takipNo} ${(s.kalemler || []).map(kalemYazi).join(' ')}`, q));
    // Eski sistemden "sadece geçmiş" aktarılan gönderiler yolda sayılmaz; Tümü'nde görünür.
    const gruplar = { yolda: tum.filter((s) => s.durum !== 'Gönderildi' && H.sevkEtkili(s)), gitti: tum.filter((s) => s.durum === 'Gönderildi' && !s.iptal), iptal: tum.filter((s) => s.iptal), hepsi: tum };
    const liste = [...gruplar[f]].sort((a, x) => (f === 'yolda' ? (a.tarih < x.tarih ? -1 : 1) : a.tarih < x.tarih ? 1 : -1));
    return html`<div class="tz-selam"><div><h1>${cevir("Gönderiler")}</h1><p>${cevir("Her kartta bir sonraki adıma tek dokunuşla geçin. Yalnızca “Yola çıktı” stoktan düşer.")}</p></div>
        <div style="margin-left:auto;display:flex;gap:8px;align-items:center"><button class="d" onClick=${E.disaAktar.sevk} title=${cevir("Farukcan’ın SAMPLES tablosu düzeninde Excel dosyası")}><${Ikon} ad="indir" boyut=${15} />Excel</button>
          <button class="d ana-d tz-buyuk" onClick=${() => d.kayitlar('isemri').some(H.emirSevkeHazir) ? sihirbazAc(GonderSihirbazi) : isEmirlerineGit()}><${Ikon} ad="arti" />${cevir("Numune gönder")}</button></div></div>
      <div class="tz-cipler">
        ${[['yolda', 'Yolda'], ['gitti', 'Gönderildi'], ['iptal', 'İptal'], ['hepsi', 'Tümü']].map(([id, ad]) => html`<button class=${'tz-cip' + (f === id ? ' secili' : '')} onClick=${() => setF(id)}>${cevir(ad)}<span class="n">${gruplar[id].length}</span></button>`)}
        <input class="girdi" style="max-width:320px;margin-left:8px;border-radius:99px" placeholder=${cevir("Firma, ürün, takip no…")} value=${q} onInput=${(e) => setQ(e.target.value)} />
      </div>
      ${liste.length ? html`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr));gap:14px">${liste.map((s) => html`<div key=${s.id} style="display:contents"><${GonderiKarti} s=${s} /></div>`)}</div>`
        : html`<div class="tz-kart"><p class="soluk" style="margin:0">${cevir("Bu filtrede gönderi yok.")}</p></div>`}`;
  }

  /* ---------------- Geçmiş ---------------- */
  function Gecmis() {
    const d = depo();
    const [tur, setTur] = useState('');
    const [q, setQ] = useState('');
    const [limit, setLimit] = useState(80);
    const tum = hareketler(d);
    const sayilar = { dolum: 0, sevk: 0, alim: 0, sayim: 0, acik: 0 };
    for (const h of tum) sayilar[h.c]++;
    const liste = tum.filter((h) => (!tur || h.c === tur) && ara(`${h.r.no} ${h.r.urun || ''} ${h.r.parti || ''} ${h.r.firma || ''} ${h.r.tedarikci || ''} ${(h.r.kalemler || []).map(kalemYazi).join(' ')}`, q));
    const gunler = [];
    for (const h of liste.slice(0, limit)) {
      const son = gunler[gunler.length - 1];
      if (son && son.tarih === h.tarih) son.l.push(h); else gunler.push({ tarih: h.tarih, l: [h] });
    }
    const gunAdi = (t) => (t === bugun() ? cevir('Bugün') : t === gunEkle(bugun(), -1) ? cevir('Dün', 'Yesterday') : tarihYaz(t));
    return html`<div class="tz-selam"><div><h1>${cevir("Geçmiş")}</h1><p>${cevir("Tüm dolum, gönderi, şişe girişi ve sayımlar tek zaman çizgisinde. Bir satıra tıklayıp düzenleyebilir veya silebilirsiniz.")}</p></div></div>
      <div class="tz-cipler">
        ${[['', 'Hepsi', tum.length], ['dolum', 'Dolum', sayilar.dolum], ['sevk', 'Gönderi', sayilar.sevk], ['alim', 'Şişe girişi', sayilar.alim], ['sayim', 'Sayım', sayilar.sayim], ...(sayilar.acik ? [['acik', 'Açık kap', sayilar.acik]] : [])].map(([id, ad, n]) =>
          html`<button class=${'tz-cip' + (tur === id ? ' secili' : '')} onClick=${() => setTur(id)}>${cevir(ad)}<span class="n">${n}</span></button>`)}
        <input class="girdi" style="max-width:320px;margin-left:8px;border-radius:99px" placeholder=${cevir("Ara…")} value=${q} onInput=${(e) => setQ(e.target.value)} />
        <span style="flex:1" /><span class="kucuk soluk">${cevir("Excel’e aktar:")}</span>
        <button class="d kucuk-d" onClick=${E.disaAktar.dolum}><${Ikon} ad="indir" boyut=${15} />${cevir("Dolumlar")}</button>
        <button class="d kucuk-d" onClick=${E.disaAktar.sevk}><${Ikon} ad="indir" boyut=${15} />${cevir("Gönderiler")}</button>
        <button class="d kucuk-d" onClick=${E.disaAktar.alim}><${Ikon} ad="indir" boyut=${15} />${cevir("Şişe girişleri")}</button>
      </div>
      <section class="tz-kart">${gunler.length ? gunler.map((g) => html`<div class="tz-gun-bas">${gunAdi(g.tarih)}</div><ul class="tz-akis">${g.l.map((h) => html`<${HareketSatiri} key=${h.c + h.r.id} h=${h} />`)}</ul>`)
        : html`<p class="soluk" style="margin:0">${cevir("Kayıt yok.")}</p>`}
        ${liste.length > limit && html`<button class="d" style="margin-top:14px" onClick=${() => setLimit(limit + 80)}>${cevir("Daha eski")} ${Math.min(80, liste.length - limit)} ${cevir("kayıt")}</button>`}
      </section>`;
  }

  /* ---------------- Üst çubuk araması ---------------- */
  function Arama() {
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
    const sonuc = useMemo(() => {
      if (!q.trim()) return [];
      const l = [];
      for (const h of hareketler(d)) {
        const r = h.r;
        if (ara(`${r.no} ${r.urun || ''} ${r.parti || ''} ${r.firma || ''} ${r.takipNo || ''} ${r.tedarikci || ''} ${(r.kalemler || []).map(kalemYazi).join(' ')} ${(r.siseler || []).map((x) => x.no).join(' ')}`, q)) l.push({ tur: { dolum: 'Dolum', sevk: 'Gönderi', alim: 'Şişe', sayim: 'Sayım' }[h.c], ad: html`${r.no} · ${h.metin}`, ek: tarihYaz(r.tarih), fn: () => (h.c === 'sayim' ? null : F.kayitAc(h.c, r)) });
        if (l.length > 30) break;
      }
      for (const x of H.stok(d).dolu.values()) if (x.mevcut > 0 && ara(`${x.urun} ${x.parti} ${amb(x.ambalaj)}`, q)) l.unshift({ tur: 'Raf', ad: `${x.urun} ${x.parti} · ${amb(x.ambalaj)}`, ek: NT.dil.m('{0} şişe', x.mevcut), fn: () => E.defterAc(x) });
      return l.slice(0, 12);
    }, [q, d.surum]);
    const calistir = (x) => { setQ(''); setAcik(false); girdi.current?.blur(); x.fn && x.fn(); };
    return html`<div class="tz-ara"><${Ikon} ad="ara" boyut=${16} />
      <input ref=${girdi} placeholder=${cevir("Ara: firma, parti, kayıt no…  (Ctrl K)")} value=${q} onFocus=${() => setAcik(true)} onBlur=${() => setTimeout(() => setAcik(false), 150)}
        onInput=${(e) => { setQ(e.target.value); setSec(0); setAcik(true); }}
        onKeyDown=${(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSec(Math.min(sec + 1, sonuc.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSec(Math.max(sec - 1, 0)); }
          else if (e.key === 'Enter' && sonuc[sec]) calistir(sonuc[sec]);
          else if (e.key === 'Escape') { setQ(''); e.target.blur(); }
        }} />
      ${acik && q.trim() && html`<div class="tz-ara-sonuc">${sonuc.length ? sonuc.map((x, i) => html`<button class=${i === sec ? 'secili' : ''} onMouseDown=${(e) => { e.preventDefault(); calistir(x); }}><span class="tur">${cevir(x.tur)}</span><span>${x.ad}</span><span class="ek">${x.ek}</span></button>`)
        : html`<div class="soluk kucuk" style="padding:10px 12px">${cevir("Sonuç yok")}</div>`}</div>`}
    </div>`;
  }

  /* ---------------- Tema: Klasik ile aynı ayar (nt.tema: oto / acik / koyu) ---------------- */
  const koyuMu = () => {
    const t = document.documentElement.getAttribute('data-tema');
    return t ? t === 'koyu' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  };
  function TemaDugmesi() {
    const [, y] = useState(0);
    const koyu = koyuMu();
    const degistir = () => {
      const yeni = koyu ? 'acik' : 'koyu';
      document.documentElement.setAttribute('data-tema', yeni);
      try { localStorage.setItem('nt.tema', yeni); } catch { /* yoksay */ }
      y((x) => x + 1);
    };
    return html`<button class="tz-tema" onClick=${degistir} title=${koyu ? cevir("Aydınlık moda geç") : cevir("Karanlık moda geç")} aria-label=${cevir("Temayı değiştir")}><${Ikon} ad=${koyu ? 'gunes' : 'ay'} boyut=${17} /></button>`;
  }

  /* ---------------- Uygulama ---------------- */
  function Uygulama() {
    const [sekme, setSekme] = useState(sekmeAl());
    const d = depo();
    useEffect(() => {
      const f = () => { setSekme(sekmeAl()); window.scrollTo(0, 0); };
      window.addEventListener('hashchange', f);
      return () => window.removeEventListener('hashchange', f);
    }, []);
    // Kısayollar + el tipi barkod okuyucu (kısayollar 120 ms bekler; hızlı gelen karakterler barkoddur).
    useEffect(() => {
      let tampon = '', son = 0, bekleyen = null;
      const f = (e) => {
        if (e.target.closest && e.target.closest('input, textarea, select')) return;
        if (document.querySelector('.perde, .tz-sihirbaz') || e.ctrlKey || e.metaKey || e.altKey) return;
        const simdi = performance.now();
        if (e.key === 'Enter' && tampon.length >= 4) {
          const kod = tampon.toUpperCase(); tampon = '';
          for (const c of ['sevk', 'dolum', 'alim']) {
            const r = d.kayitlar(c).find((x) => x.no && NT.barkod.asciiYap(x.no).toUpperCase() === kod);
            if (r) return F.kayitAc(c, r);
          }
          const sise = H.siseBul(d, kod);
          if (sise) return F.kayitAc('sevk', sise.sevk);
          return bildir(NT.dil.m("Okutulan kod bulunamadı: {0}", kod), { tur: 'hata' });
        }
        if (e.key.length !== 1) return;
        const hizli = simdi - son < 80;
        tampon = hizli ? tampon + e.key : e.key;
        son = simdi;
        clearTimeout(bekleyen);
        if (hizli) return;
        const x = EYLEMLER.find((a) => a.tus.toLowerCase() === e.key.toLowerCase());
        if (x && (!x.emir || H.emirAcabilir(b.kullanici))) { e.preventDefault(); bekleyen = setTimeout(() => tampon.length === 1 && sihirbazAc(x.B), 120); }
      };
      window.addEventListener('keydown', f);
      return () => { window.removeEventListener('keydown', f); clearTimeout(bekleyen); };
    }, [d]);

    const yolda = d.kayitlar('sevk').filter((s) => s.durum !== 'Gönderildi' && H.sevkEtkili(s)).length;
    const cevrimici = (d.kisiler || []).filter((k) => Date.now() - k.t < 90000);
    const durum = d.hata ? 'hata' : d.bekleyen.length ? 'bekliyor' : '';
    const acikEmirler = d.kayitlar('isemri').filter(H.emirAcik).length;
    const Sayfa = { genel: GenelBakis, isemirleri: IsEmirleri, gonderiler: Gonderiler, gecmis: Gecmis, ayarlar: E.Ayarlar }[sekme] || GenelBakis;
    return html`<div class="tz-iskelet tz-m-numune">
      <aside class="tz-yan">
        <a class="tz-marka" href="#/genel"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" /><span>${cevir("Numune Takip")}</span></a>
        <${NT.ui.AnaEkranLinki} />
        <nav class="tz-menu" aria-label=${cevir("Sayfalar")}>${SEKMELER.map((s) => html`<a href=${'#/' + s.id} class=${sekme === s.id ? 'aktif' : ''}>
          <${Ikon} ad=${s.ikon} />${cevir(s.ad, s.en)}${s.id === 'gonderiler' && yolda > 0 ? html`<span class="n" title=${cevir("Yoldaki gönderi")}>${yolda}</span>` : ''}
          ${s.id === 'isemirleri' && acikEmirler > 0 && html`<span class="n">${acikEmirler}</span>`}</a>`)}</nav>
        <div class="tz-menu-baslik">${cevir("Hızlı işlem")}</div>
        <nav class="tz-menu tz-hizli-menu" aria-label=${cevir("Hızlı işlem")}>${EYLEMLER.filter((x) => !x.emir || H.emirAcabilir(b.kullanici)).map((x) => html`<button type="button" onClick=${() => sihirbazAc(x.B)} title=${cevir(x.alt, x.en)}>
          <${Ikon} ad=${x.ikon} />${cevir(x.ad, x.en)}<kbd>${x.tus}</kbd></button>`)}</nav>
        <div class="tz-yan-alt">
          ${b.mod === 'bulut' && html`<div class="kisiler" title=${cevrimici.map((k) => k.ad).join(', ')}>
            ${cevrimici.slice(0, 5).map((k) => html`<${Avatar} key=${k.cihaz} ad=${k.ad} kucuk />`)}
            <span class="yazi">${cevrimici.length <= 1 ? cevir("Şu an sadece siz") : cevir(`${cevrimici.length} kişi çevrimiçi`, `${cevrimici.length} people online`)}</span></div>`}
          <button class=${'tz-canli ' + durum} onClick=${() => d.tara()} title=${d.hata || cevir("Şimdi eşitle")}><span class="nokta" />
            <span><b>${b.mod === 'demo' ? cevir("Sunum modu") : d.hata ? cevir("Bağlantı sorunu") : d.bekleyen.length ? NT.dil.m("{0} değişiklik bekliyor", d.bekleyen.length) : cevir("Eşitlendi")}</b>
              ${b.mod === 'demo' ? cevir("Örnek veri · kaydedilmez") : NT.dil.m("Bulut · {0}", d.sonEsitleme ? onceYaz(d.sonEsitleme) : '—')}</span></button>
          <a class="tz-kullanici" href="#/ayarlar"><${Avatar} ad=${b.kullanici || '?'} kucuk /><span>${b.kullanici}</span></a>
        </div>
      </aside>
      <div class="tz-ana">
        ${b.mod === 'demo' && html`<div class="sunum-seridi" role="alert"><${Ikon} ad="uyari" boyut=${16} /><span><b>${cevir("SUNUM MODU")}</b> ${cevir("· Örnek veriler. Burada girdiğiniz hiçbir şey kaydedilmez; sayfa kapanınca silinir.")}</span><a href=${NT.c.adres('numune', { demo: false })}>${cevir("Gerçek verilerle aç →")}</a></div>`}
        <header class="tz-ust"><${Arama} /><span style="flex:1" /><${DilSecimi} /><${TemaDugmesi} /></header>
        <main class=${'tz-icerik' + (sekme === 'ayarlar' ? ' tz-klasik' : '')}><${Sayfa} /></main>
      </div>
    </div>`;
  }

  /* ---------------- Kurulum ---------------- */
  function Kurulum() {
    const [ad, setAd] = useState(b.kullanici);
    const [kod, setKod] = useState(b.kod);
    const [hata, setHata] = useState('');
    const [bekle, setBekle] = useState(false);
    const giris = async () => {
      if (ad.trim().length < 2) return setHata(cevir("Önce adınızı yazın."));
      if (kod.trim().length < 4) return setHata(cevir("Erişim kodunu yazın."));
      setHata(''); setBekle(true);
      try { await b.girisYap(ad, kod); } catch (e) { console.error(e); setHata(e); } finally { setBekle(false); }
    };
    // Kod sonradan değiştirildiyse ya da sunucuya ulaşılamadıysa: aynı ekran, nedeniyle birlikte.
    const hataVar = b.durum === 'hata';
    const girisFormu = !hataVar || b.hataKod;
    const enter = (e) => e.key === 'Enter' && giris();
    return html`<div class="tz-kurulum"><div class="tz-kurulum-kutu">
      <div class="tz-kurulum-dil"><${DilSecimi} /></div>
      <img src="uygulama/ortak/logo.svg" alt="SKYHEM" />
      <h1>${hataVar && !b.hataKod ? cevir('Sunucuya bağlanılamadı') : cevir('Numune Takip’e hoş geldiniz')}</h1>
      <p>${hataVar ? cevir(b.hataMesaji) : cevir("Adınızı ve size verilen erişim kodunu bir kez yazın. Kayıtlar internet üzerinden herkesle otomatik eşitlenir.")}</p>
      ${girisFormu && html`
        <input class="girdi" style="font-size:17px;padding:12px 14px" placeholder=${cevir("Adınız Soyadınız")} value=${ad} onInput=${(e) => setAd(e.target.value)} onKeyDown=${enter} autofocus />
        <input class="girdi mono" style="font-size:17px;padding:12px 14px;text-transform:uppercase" placeholder=${cevir("Erişim kodu (örn. SKY-XXXX-XXXX)")} value=${kod} onInput=${(e) => setKod(e.target.value)} onKeyDown=${enter} autocomplete="off" spellcheck="false" />
        <button class="d ana-d tz-buyuk" disabled=${bekle} onClick=${giris}>${bekle ? cevir("Bağlanıyor…") : cevir("Başla")}</button>`}
      ${!girisFormu && html`<button class="d ana-d tz-buyuk" onClick=${() => b.baslat()}>${cevir("Tekrar dene")}</button>`}
      <${NT.ui.HataKutusu} hata=${hata} />
    </div></div>`;
  }

  function Kok() {
    useDil();
    const [, y] = useState(0);
    const tik = () => y((x) => x + 1);
    useEffect(() => { const birak = b.abone(tik); tik(); return birak; }, []);
    useEffect(() => {
      if (!b.depo) return undefined;
      const baslangic = Date.now();
      tik();
      return b.depo.abone(({ yeni }) => {
        tik();
        const uzak = (yeni || []).filter((e) => e.d !== b.cihaz && e.t > baslangic - 5000 && ['dolum', 'sevk', 'alim', 'sayim'].includes(e.c));
        if (uzak.length) bildir(NT.dil.m('{0} {1} yaptı · raf güncellendi', [...new Set(uzak.map((e) => e.u))].join(', '), uzak.length === 1 ? cevir('bir işlem', 'one action') : NT.dil.m('{0} işlem', uzak.length)), { eylem: { yazi: 'Geçmiş', fn: () => { location.hash = '#/gecmis'; } } });
      });
    }, [b.depo]);
    const ic = b.durum === 'hazir' && b.depo ? html`<${Uygulama} />`
      : b.durum === 'basliyor' ? html`<div style="display:grid;place-items:center;height:100vh;color:var(--soluk)">${cevir("Yükleniyor…")}</div>` : html`<${Kurulum} />`;
    return html`${ic}<${SihirbazKatmani} /><${F.FormKatmani} /><${GlobalKatman} />`;
  }

  render(html`<${Kok} />`, document.getElementById('uygulama'));
  b.baslat();
})();
