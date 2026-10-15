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
  const depo = () => b.depo;
  const litreYaz = (n) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  document.documentElement.classList.add('tezgah');

  const SEKMELER = [
    { id: 'genel', ad: 'Genel Bakış', ikon: 'ozet' },
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
    return html`<${B} ...${props} kapat=${sihirbazKapat} />`;
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
      try { if ((await kaydet()) !== false) kapat(); } finally { setMesgul(false); }
    };
    useEffect(() => {
      const f = (e) => {
        if (document.querySelector('.perde')) return; // üstte onay penceresi açık
        if (e.key === 'Escape') { e.preventDefault(); kapat(); }
        else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.target.closest('.tz-secimler')) { e.preventDefault(); ileri(); }
      };
      window.addEventListener('keydown', f);
      return () => window.removeEventListener('keydown', f);
    });
    return html`<div class="tz-sihirbaz" onMouseDown=${(e) => e.target === e.currentTarget && kapat()}>
      <div class="tz-panel" role="dialog" aria-modal="true" aria-label=${baslik}>
        <div class="tz-panel-bas">
          <span class="baslik">${baslik}</span>
          <div class="tz-noktalar">${adimlar.map((_, j) => html`<span class=${j <= i ? 'gecti' : ''} />`)}</div>
          <button class="d hayalet ikon-d" onClick=${kapat} aria-label="Kapat"><${Ikon} ad="kapat" /></button>
        </div>
        <div class="tz-panel-ic" key=${i}>
          <h2 class="tz-soru">${adim.soru}</h2>
          ${adim.ipucu && html`<p class="tz-ipucu">${adim.ipucu}</p>`}
          ${adim.icerik({ ileri: () => setI((x) => Math.min(x + 1, adimlar.length - 1)) })}
        </div>
        <div class="tz-panel-alt">
          ${i > 0 ? html`<button class="d hayalet tz-buyuk" onClick=${() => setI(i - 1)}>← Geri</button>` : html`<button class="d hayalet tz-buyuk" onClick=${kapat}>Vazgeç</button>`}
          <span class="bosluk" />
          <span class="kucuk soluk">Adım ${i + 1} / ${adimlar.length}</span>
          <button class="d ana-d tz-buyuk" disabled=${!gecerli || mesgul} onClick=${ileri}>${son ? html`<${Ikon} ad="tik" />${mesgul ? 'Kaydediliyor…' : kaydetYazi}` : 'Devam →'}</button>
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
        <button type="button" class="yuvar" onClick=${() => degis(Math.max(0, n - 1))} aria-label="Azalt">−</button>
        <input type="number" min="0" inputmode="numeric" autofocus value=${deger} onFocus=${(e) => e.target.select()} onInput=${(e) => degis(e.target.value === '' ? '' : Number(e.target.value))} />
        <button type="button" class="yuvar" onClick=${() => degis(n + 1)} aria-label="Artır">+</button>
      </div>
      <div class="tz-hizli">${hizli.map((x) => html`<button type="button" class=${'tz-cip' + (n === x ? ' secili' : '')} onClick=${() => degis(x)}>${x}</button>`)}</div>
    </div>`;
  }

  /* ---------------- Dolum sihirbazı ---------------- */
  const KAYNAK_IKON = { IBC: 'kutu', Varil: 'stok', İsotank: 'sevk', Numune: 'dolum', Diğer: 'bilgi' };
  const KAYNAK_ALT = { IBC: 'IBC tankından', Varil: 'Varilden', İsotank: 'İsotanktan', Numune: 'Büyük şişeyi küçüklere böldük', Diğer: 'Reaktör, tank…' };
  function DolumSihirbazi({ kapat, on = {} }) {
    const d = depo();
    const urunler = H.urunler(d);
    const [f, setF] = useState({ urun: '', parti: '', ambalaj: '', adet: 1, tarih: bugun(), hazirlayan: b.kullanici, kaynakTur: '', kaynakNo: '', notlar: '', karisim: null, ...on });
    const s = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const u = H.urunBul(d, f.urun);
    const partili = !!u?.partili;
    const st = H.stok(d);
    const bos = H.bosMevcut(d, f.ambalaj);
    const adimlar = [
      {
        soru: 'Hangi ürünü doldurdunuz?', gecerli: () => !!f.urun,
        icerik: ({ ileri }) => html`<div class="tz-secimler">${urunler.map((x) => {
          const toplam = [...st.dolu.values()].filter((k) => k.urun === x.ad).reduce((t, k) => t + Math.max(0, k.mevcut), 0);
          return html`<${Secim} secili=${f.urun === x.ad} baslik=${x.ad} alt=${`${x.partili ? 'Parti takipli · ' : ''}rafta ${toplam} dolu`} onClick=${() => { setF((p) => ({ ...p, urun: x.ad, parti: '' })); ileri(); }} />`;
        })}</div>`,
      },
      partili && {
        soru: 'Hangi parti?', ipucu: 'Yeni üretim ise önerilen sıradaki parti numarasını seçin.', gecerli: () => !!f.parti.trim() && (!f.karisim || f.karisim.length > 1),
        icerik: ({ ileri }) => {
          const sonraki = H.sonrakiParti(d, f.urun);
          const partiler = H.partiler(d, f.urun).slice(0, 7);
          // Karışım: birden fazla partiden doldurulduysa partiler seçilir, parti adı "Batch #3 + Batch #20" olur.
          if (f.karisim) {
            const tum = H.partiler(d, f.urun).filter((p) => !p.includes('+')).slice(0, 14);
            const sec = (p) => setF((x) => { const l = x.karisim.includes(p) ? x.karisim.filter((y) => y !== p) : [...x.karisim, p]; return { ...x, karisim: l, parti: l.join(' + ') }; });
            return html`<p class="tz-ipucu" style="margin-top:0">Karışımdaki partilere dokunun (en az iki).</p>
              <div class="tz-hizli">${tum.map((p) => html`<button type="button" class=${'tz-cip' + (f.karisim.includes(p) ? ' secili' : '')} onClick=${() => sec(p)}>${p}</button>`)}</div>
              <div style="margin-top:16px;max-width:420px"><input class="girdi" placeholder="Batch #3 + Batch #20" value=${f.parti} onInput=${(e) => setF((x) => ({ ...x, parti: e.target.value, karisim: e.target.value.split('+').map((y) => y.trim()).filter(Boolean) }))} /></div>
              <button type="button" class="d hayalet kucuk-d" style="margin-top:12px" onClick=${() => setF((x) => ({ ...x, karisim: null, parti: '' }))}>← Tek parti</button>`;
          }
          return html`<div class="tz-secimler">
            <${Secim} oneri secili=${f.parti === sonraki} baslik=${sonraki} alt="Yeni parti" onClick=${() => { s('parti', sonraki); ileri(); }} />
            ${partiler.map((p) => html`<${Secim} secili=${f.parti === p} baslik=${p} alt=${`rafta ${[...st.dolu.values()].filter((k) => k.urun === f.urun && k.parti === p).reduce((t, k) => t + k.mevcut, 0)}`} onClick=${() => { s('parti', p); ileri(); }} />`)}
          </div>
          <div style="margin-top:16px;max-width:320px"><input class="girdi" placeholder="Başka parti no yazın…" value=${partiler.includes(f.parti) || f.parti === sonraki ? '' : f.parti} onInput=${(e) => s('parti', e.target.value)} /></div>
          <button type="button" class="d kucuk-d" style="margin-top:12px" onClick=${() => setF((x) => ({ ...x, karisim: [], parti: '' }))}><${Ikon} ad="arti" boyut=${14} />Birden fazla partinin karışımı</button>`;
        },
      },
      {
        soru: 'Hangi ambalaja?', ipucu: 'Altındaki sayı: raftaki boş şişe.', gecerli: () => !!f.ambalaj,
        icerik: ({ ileri }) => html`<div class="tz-secimler">${H.ambalajlar(d).map((a) => {
          const n = H.bosMevcut(d, a.id);
          return html`<${Secim} sise litre=${a.litre} secili=${f.ambalaj === a.id} baslik=${a.ad} alt=${`${n} boş şişe`} uyari=${n <= 0} onClick=${() => { s('ambalaj', a.id); ileri(); }} />`;
        })}</div>`,
      },
      {
        soru: 'Nereden doldurdunuz?', ipucu: 'İsotanktan dolduysa isotank numarasını yazın. Diğerlerinde no / açıklama isteğe bağlı.', gecerli: () => !!f.kaynakTur,
        icerik: () => {
          const k = H.DOLUM_KAYNAKLARI.find((x) => x.id === f.kaynakTur);
          const onceki = [...new Set(d.kayitlar('dolum').filter((r) => r.kaynakTur === f.kaynakTur).map((r) => String(r.kaynakNo || '').trim()).filter(Boolean))];
          return html`<div class="tz-secimler">${H.DOLUM_KAYNAKLARI.map((x) => html`<${Secim} ikon=${KAYNAK_IKON[x.id]} secili=${f.kaynakTur === x.id} baslik=${x.ad} alt=${KAYNAK_ALT[x.id]}
              onClick=${() => setF((p) => ({ ...p, kaynakTur: x.id, kaynakNo: p.kaynakTur === x.id ? p.kaynakNo : '' }))} />`)}</div>
            ${k && html`<div class="alan" style="margin-top:20px;max-width:440px"><label>${k.no}${f.kaynakTur === 'İsotank' ? '' : ' (isteğe bağlı)'}</label>
              <input class="girdi mono" style="font-size:18px;padding:12px 14px" key=${f.kaynakTur} ref=${(el) => { if (el && !el.dataset.odak) { el.dataset.odak = '1'; setTimeout(() => el.focus(), 0); } }} list="tz-kaynakno" value=${f.kaynakNo} onInput=${(e) => s('kaynakNo', e.target.value)} />
              <datalist id="tz-kaynakno">${onceki.map((x) => html`<option value=${x} />`)}</datalist></div>`}`;
        },
      },
      {
        soru: 'Kaç şişe doldurdunuz?', gecerli: () => sayi(f.adet) > 0,
        icerik: () => html`<${SayiSecici} deger=${f.adet} degis=${(v) => s('adet', v)} />
          ${sayi(f.adet) > bos && html`<div class="uyari-kutu kritik" style="margin-top:18px"><${Ikon} ad="uyari" /><span>Rafta ${bos} boş ${amb(f.ambalaj)} şişe görünüyor. Kaydederseniz boş şişe stoku eksiye düşer; bir sayım farkı olabilir.</span></div>`}`,
      },
      {
        soru: 'Kontrol edip kaydedin',
        icerik: () => html`<p class="tz-ozet"><em>${f.adet} şişe</em> ${f.urun}${f.parti ? html` · <em>${f.parti}</em>` : ''}, <em>${amb(f.ambalaj)}</em> ambalaja dolduruldu${f.kaynakTur ? html` (kaynak: <em>${H.dolumKaynagi(f)}</em>)` : ''}.<br />
            <span class="soluk" style="font-size:16px">Boş ${amb(f.ambalaj)} şişe: ${bos} → ${bos - sayi(f.adet)}</span></p>
          <div class="form-izgara">
            <div class="alan s4"><label>Tarih</label><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih', e.target.value)} /></div>
            <div class="alan s8"><label>Hazırlayan</label><input class="girdi" value=${f.hazirlayan} onInput=${(e) => s('hazirlayan', e.target.value)} /></div>
            <div class="alan s12"><label>Not (isteğe bağlı)</label><textarea class="girdi" rows="2" value=${f.notlar} onInput=${(e) => s('notlar', e.target.value)} /></div>
          </div>`,
      },
    ].filter(Boolean);
    async function kaydet() {
      if (sayi(f.adet) > bos && !(await onayla(`Boş ${amb(f.ambalaj)} şişe stoku eksiye düşecek. Yine de kaydedilsin mi?`, { baslik: 'Boş şişe yetersiz', evet: 'Kaydet' }))) return false;
      const no = H.yeniNo(d, 'dolum', f.tarih);
      const v = { no, tarih: f.tarih, urun: f.urun, parti: partili ? f.parti.trim() : '', ...(partili && f.karisim?.length > 1 ? { karisim: f.karisim } : {}), ambalaj: f.ambalaj, adet: sayi(f.adet), hazirlayan: f.hazirlayan.trim(), kaynakTur: f.kaynakTur, kaynakNo: f.kaynakNo.trim(), notlar: f.notlar.trim(), ekler: [] };
      await d.kaydet([{ c: 'dolum', k: uid(), v }]);
      bildir(`${no} · ${v.adet} × ${v.urun} ${amb(v.ambalaj)} rafa eklendi.`);
    }
    return html`<${Sihirbaz} baslik="Dolum yaptım" adimlar=${adimlar} kapat=${kapat} kaydet=${kaydet} kaydetYazi="Rafa ekle" />`;
  }

  /* ---------------- Gönderi sihirbazı ---------------- */
  function GonderSihirbazi({ kapat, on = {} }) {
    const d = depo();
    const onceki = d.kayitlar('sevk');
    const sonFirmalar = [...new Map([...onceki].sort((a, x) => (a.tarih < x.tarih ? 1 : -1)).map((r) => [r.firma, r])).values()].slice(0, 8);
    const [f, setF] = useState({ firma: '', yetkili: '', telefon: '', irtibatDetay: '', talepTarihi: bugun(), sorumlu: b.kullanici || '', adres: '', sebep: '', sekil: 'Kargo', kargoFirma: '', takipNo: '', kargoBelge: [], ulke: 'Türkiye', durum: 'Beklemede', tarih: bugun(), sepet: [], siseler: [], ...on });
    const s = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const [filtre, setFiltre] = useState('');
    const st = H.stok(d);
    const firmaSec = (ad) => setF((p) => {
      const son = H.firmaBilgisi(d, ad);
      return { ...p, firma: ad, yetkili: son.yetkili || p.yetkili, telefon: son.telefon || p.telefon, irtibatDetay: son.irtibatDetay || p.irtibatDetay, adres: son.adres || p.adres, ulke: son.ulke || p.ulke };
    });
    const stokListesi = [...st.dolu.values()].filter((x) => x.mevcut > 0 && ara(`${x.urun} ${x.parti} ${amb(x.ambalaj)}`, filtre))
      .sort((a, x) => trSirala(a.urun, x.urun) || H.partiNo(x.parti) - H.partiNo(a.parti));
    const sepeteEkle = (x) => setF((p) => {
      const var_ = p.sepet.find((k) => k.anahtar === x.anahtar);
      return { ...p, sepet: var_ ? p.sepet.map((k) => (k === var_ ? { ...k, adet: k.adet + 1 } : k)) : [...p.sepet, { anahtar: x.anahtar, urun: x.urun, parti: x.parti, ambalaj: x.ambalaj, adet: 1 }] };
    });
    const sepetAdet = (k, n) => setF((p) => ({ ...p, sepet: n <= 0 ? p.sepet.filter((x) => x !== k) : p.sepet.map((x) => (x === k ? { ...x, adet: n } : x)) }));
    const kalemler = f.sepet.map(({ anahtar, ...k }) => k);
    const eksikler = H.sevkKontrol(d, kalemler);
    const toplam = kalemler.reduce((t, k) => t + k.adet, 0);

    const adimlar = [
      {
        soru: 'Kime gönderiyorsunuz?', ipucu: 'Daha önce gönderdiğiniz bir firmayı seçerseniz yetkili ve adres kendiliğinden gelir.', gecerli: () => !!f.firma.trim(),
        icerik: () => html`<input class="girdi" style="font-size:20px;padding:14px 16px" list="tz-firmalar" autofocus placeholder="Firma adı" value=${f.firma} onInput=${(e) => s('firma', e.target.value)} onChange=${(e) => firmaSec(e.target.value)} />
          <datalist id="tz-firmalar">${[...new Set(onceki.map((r) => r.firma))].map((x) => html`<option value=${x} />`)}</datalist>
          ${sonFirmalar.length > 0 && html`<div class="tz-hizli" style="margin-top:14px">${sonFirmalar.map((r) => html`<button type="button" class=${'tz-cip' + (f.firma === r.firma ? ' secili' : '')} onClick=${() => firmaSec(r.firma)}>${r.firma}</button>`)}</div>`}
          <div class="form-izgara" style="margin-top:22px">
            <div class="alan s6"><label>İrtibat yetkilisi</label><input class="girdi" value=${f.yetkili} onInput=${(e) => s('yetkili', e.target.value)} placeholder="Ad Soyad (Unvan)" /></div>
            <div class="alan s6"><label>Telefon</label><${F.TelefonGirdisi} deger=${f.telefon} degis=${(v) => s('telefon', v)} ulke=${f.ulke} /></div>
            <div class="alan s12"><label>Talep sebebi</label><input class="girdi" list="tz-sebepler" value=${f.sebep} onInput=${(e) => s('sebep', e.target.value)} placeholder="Örn: Laboratory testing, saha denemesi" />
              <datalist id="tz-sebepler">${[...new Set(onceki.map((r) => (r.sebep || '').trim()).filter(Boolean))].sort(trSirala).map((x) => html`<option value=${x} />`)}</datalist></div>
            <div class="alan s6"><label>Talep tarihi</label><input class="girdi" type="date" value=${f.talepTarihi} onInput=${(e) => s('talepTarihi', e.target.value)} /></div>
            <div class="alan s6"><label>Sorumlu</label><input class="girdi" list="tz-sorumlular" value=${f.sorumlu} onInput=${(e) => s('sorumlu', e.target.value)} placeholder="Talebi takip eden kişi" />
              <datalist id="tz-sorumlular">${[...new Set([b.kullanici, ...onceki.map((r) => (r.sorumlu || '').trim())].filter(Boolean))].sort(trSirala).map((x) => html`<option value=${x} />`)}</datalist></div>
          </div>`,
      },
      {
        soru: 'Neleri gönderiyorsunuz?', ipucu: 'Raftan dokunarak ekleyin; her dokunuş bir şişe ekler.', gecerli: () => kalemler.length > 0,
        icerik: () => html`<div class="tz-sepet">
          <div>
            <input class="girdi" placeholder="Ürün, parti veya ambalaj ara…" value=${filtre} onInput=${(e) => setFiltre(e.target.value)} style="margin-bottom:10px" />
            <div class="tz-stok-listesi">${stokListesi.map((x) => {
              const sepette = f.sepet.find((k) => k.anahtar === x.anahtar);
              return html`<button type="button" class=${'tz-stok-satir' + (sepette ? ' sepette' : '')} onClick=${() => sepeteEkle(x)}>
                <${Sise} litre=${H.ambalajlar(d, { hepsi: true }).find((a) => a.id === x.ambalaj)?.litre} boyut=${0.7} />
                <span class="bilgi"><b>${x.urun}${x.parti ? ' · ' + x.parti : ''}</b><small>${amb(x.ambalaj)}${x.rezerve ? ` · ${x.rezerve} rezerve` : ''}</small></span>
                <span class="n">${x.mevcut}${sepette ? html` <span style="color:var(--ana)">−${sepette.adet}</span>` : ''}</span>
              </button>`;
            })}${!stokListesi.length && html`<p class="soluk">Rafta eşleşen dolu numune yok.</p>`}</div>
          </div>
          <div class="tz-sepet-kutu"><h4>Gönderilecekler ${toplam ? `· ${toplam} şişe · ${litreYaz(H.sevkLitre(d, kalemler))} L` : ''}</h4>
            ${f.sepet.length ? f.sepet.map((k) => html`<div class="tz-sepet-kalem">
              <span class="ad">${k.urun}<small>${k.parti || 'Partisiz'} · ${amb(k.ambalaj)}</small></span>
              <span class="tz-mini-sayac"><button type="button" onClick=${() => sepetAdet(k, k.adet - 1)}>−</button><span>${k.adet}</span><button type="button" onClick=${() => sepetAdet(k, k.adet + 1)}>+</button></span>
            </div>`) : html`<p class="soluk kucuk">Henüz bir şey eklenmedi.</p>`}
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
            ${[['Kargo', 'sevk'], ['Elden', 'kisi'], ['Kurye', 'sevk']].map(([x, ik]) => html`<${Secim} ikon=${ik} secili=${f.sekil === x} baslik=${x} onClick=${() => s('sekil', x)} />`)}
          </div>
          <div class="form-izgara" style="margin-top:22px">
            ${f.sekil !== 'Elden' && html`<div class="alan s6"><label>${f.sekil === 'Kurye' ? 'Kurye' : 'Kargo'} firması</label><input class="girdi" list="tz-kargo" value=${f.kargoFirma} onInput=${(e) => s('kargoFirma', e.target.value)} />
              <datalist id="tz-kargo">${['Yurtiçi Kargo', 'Aras Kargo', 'MNG Kargo', 'Sürat Kargo', 'PTT Kargo', 'UPS', 'DHL'].map((x) => html`<option value=${x} />`)}</datalist></div>
              <div class="s6"><${BelgeKutusu} baslik=${(f.sekil === 'Kurye' ? 'Kurye' : 'Kargo') + ' gönderi belgesi'} ekler=${f.kargoBelge} degis=${(v) => s('kargoBelge', v)}
                ipucu="Takip no içindeki belge; sonra da yüklenebilir" /></div>`}
            <div class="alan s4"><label>Ülke</label><${F.UlkeSecimi} deger=${f.ulke} degis=${(v) => s('ulke', v)} /></div>
            <div class="alan s8"><label>Teslim adresi</label><textarea class="girdi" rows="2" value=${f.adres} onInput=${(e) => s('adres', e.target.value)} /></div>
          </div>`,
      },
      {
        soru: 'Şu an ne durumda?', ipucu: 'Sadece “Yola çıktı” stoktan düşer. Diğerlerinde şişeler rafta ayrılmış (rezerve) görünür.',
        icerik: () => html`<div class="tz-secimler">
            <${Secim} ikon="saat" secili=${f.durum === 'Karar Aşaması'} baslik="Karar aşamasında" alt="Gönderilip gönderilmeyeceği belli değil" onClick=${() => s('durum', 'Karar Aşaması')} />
            <${Secim} ikon="dolum" secili=${f.durum === 'Beklemede'} baslik="Hazırlanıyor" alt="Paketlenecek" onClick=${() => s('durum', 'Beklemede')} />
            <${Secim} ikon="etiket" secili=${f.durum === 'Etiket Bekliyor'} baslik="Etiket bekliyor" alt="Paket hazır" onClick=${() => s('durum', 'Etiket Bekliyor')} />
            <${Secim} ikon="daire_tik" secili=${f.durum === 'Gönderildi'} baslik="Yola çıktı" alt="Stoktan düşer" onClick=${() => s('durum', 'Gönderildi')} />
          </div>
          <p class="tz-ozet" style="margin-top:26px"><em>${f.firma}</em> firmasına <em>${toplam} şişe (${litreYaz(H.sevkLitre(d, kalemler))} L)</em>: ${kalemler.map(kalemYazi).join(', ')}.</p>
          ${f.durum === 'Gönderildi' && eksikler.length > 0 && html`<div class="uyari-kutu yok"><${Ikon} ad="uyari" /><span>Rafta yetersiz: ${eksikler.map((e) => `${e.urun} ${e.parti} ${amb(e.ambalaj)} (rafta ${e.mevcut}, istenen ${e.istenen})`).join(' · ')}</span></div>`}`,
      },
    ];
    async function kaydet() {
      if (f.durum === 'Gönderildi' && eksikler.length && !(await onayla('Bazı kalemlerde rafta yeterli şişe görünmüyor. Kaydederseniz stok eksiye düşer.', { baslik: 'Stok yetersiz', evet: 'Yine de kaydet' }))) return false;
      const no = H.yeniNo(d, 'sevk', f.tarih);
      const v = { no, tarih: f.tarih, firma: f.firma.trim(), yetkili: f.yetkili.trim(), telefon: f.telefon.trim(), irtibatDetay: f.irtibatDetay.trim(), talepTarihi: f.talepTarihi, sorumlu: f.sorumlu.trim(), sekil: f.sekil, sebep: f.sebep.trim(), durum: f.durum, kargoFirma: f.kargoFirma.trim(), takipNo: '', kargoBelge: f.kargoBelge, ulke: f.ulke, adres: f.adres.trim(), notlar: '', ekler: [], kalemler, siseler: H.siseTemizle(kalemler, f.siseler) };
      await d.kaydet([{ c: 'sevk', k: uid(), v }]);
      bildir(`${no} · ${v.firma} kaydedildi.`, { eylem: { yazi: 'Gönderi etiketi', fn: () => NT.etiket.ac({ tur: 'sevk', kayit: v }) }, sure: 8000 });
    }
    return html`<${Sihirbaz} baslik="Numune gönder" adimlar=${adimlar} kapat=${kapat} kaydet=${kaydet} kaydetYazi="Gönderiyi kaydet" />`;
  }

  /* ---------------- Şişe geldi ---------------- */
  function AlimSihirbazi({ kapat, on = {} }) {
    const d = depo();
    const [f, setF] = useState({ ambalaj: '', adet: 10, tedarikci: '', faturaNo: '', birimFiyat: '', tarih: bugun(), ...on });
    const s = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const tedarikciler = [...new Set(d.kayitlar('alim').map((r) => r.tedarikci).filter(Boolean))];
    const adimlar = [
      { soru: 'Hangi şişeler geldi?', gecerli: () => !!f.ambalaj,
        icerik: ({ ileri }) => html`<div class="tz-secimler">${H.ambalajlar(d).map((a) => html`<${Secim} sise litre=${a.litre} secili=${f.ambalaj === a.id} baslik=${a.ad} alt=${`şu an ${H.bosMevcut(d, a.id)} boş`} onClick=${() => { s('ambalaj', a.id); ileri(); }} />`)}</div>` },
      { soru: 'Kaç adet?', gecerli: () => sayi(f.adet) > 0, icerik: () => html`<${SayiSecici} deger=${f.adet} degis=${(v) => s('adet', v)} hizli=${[5, 10, 20, 50, 100]} />` },
      { soru: 'Nereden geldi?', ipucu: 'İsteğe bağlı; boş bırakabilirsiniz.',
        icerik: () => html`${tedarikciler.length > 0 && html`<div class="tz-hizli" style="margin-bottom:16px">${tedarikciler.map((x) => html`<button type="button" class=${'tz-cip' + (f.tedarikci === x ? ' secili' : '')} onClick=${() => s('tedarikci', x)}>${x}</button>`)}</div>`}
          <div class="form-izgara">
            <div class="alan s6"><label>Tedarikçi</label><input class="girdi" value=${f.tedarikci} onInput=${(e) => s('tedarikci', e.target.value)} /></div>
            <div class="alan s3"><label>Fatura no</label><input class="girdi mono" value=${f.faturaNo} onInput=${(e) => s('faturaNo', e.target.value)} /></div>
            <div class="alan s3"><label>Birim fiyat ₺</label><input class="girdi" inputmode="decimal" value=${f.birimFiyat} onInput=${(e) => s('birimFiyat', e.target.value)} /></div>
          </div>
          <p class="tz-ozet" style="margin-top:24px"><em>${f.adet} adet ${amb(f.ambalaj)}</em> boş şişe rafa eklenecek (${H.bosMevcut(d, f.ambalaj)} → ${H.bosMevcut(d, f.ambalaj) + sayi(f.adet)}).</p>` },
    ];
    async function kaydet() {
      const no = H.yeniNo(d, 'alim', f.tarih);
      await d.kaydet([{ c: 'alim', k: uid(), v: { no, tarih: f.tarih, ambalaj: f.ambalaj, adet: sayi(f.adet), tedarikci: f.tedarikci.trim(), faturaNo: f.faturaNo.trim(), birimFiyat: f.birimFiyat === '' ? '' : sayi(f.birimFiyat), notlar: '', ekler: [] } }]);
      bildir(`${no} · ${f.adet} × ${amb(f.ambalaj)} boş şişe rafa eklendi.`);
    }
    return html`<${Sihirbaz} baslik="Şişe geldi" adimlar=${adimlar} kapat=${kapat} kaydet=${kaydet} kaydetYazi="Rafa ekle" />`;
  }

  /* ---------------- Raf sayımı: tek seferde bir bölümü say ---------------- */
  function SayimSihirbazi({ kapat }) {
    const d = depo();
    const st = H.stok(d);
    const [bolum, setBolum] = useState('');
    const [sayilan, setSayilan] = useState({});
    const bolumler = [{ id: 'bos', ad: 'Boş şişeler', alt: `${H.ambalajlar(d).length} ambalaj` },
      ...H.urunler(d).map((u) => ({ id: u.ad, ad: u.ad, alt: `${[...st.dolu.values()].filter((x) => x.urun === u.ad && x.mevcut !== 0).length} kalem rafta` }))];
    const satirlar = bolum === 'bos'
      ? H.ambalajlar(d).map((a) => ({ k: a.id, ad: `${a.ad} boş şişe`, sistem: st.bos.get(a.id)?.mevcut ?? 0, hedef: { bos: true, ambalaj: a.id } }))
      : [...st.dolu.values()].filter((x) => x.urun === bolum && (x.mevcut !== 0 || x.rezerve)).sort((a, x) => H.partiNo(x.parti) - H.partiNo(a.parti))
        .map((x) => ({ k: x.anahtar, ad: `${x.parti || 'Partisiz'} · ${amb(x.ambalaj)}`, sistem: x.mevcut, hedef: x }));
    const farklar = satirlar.map((r) => ({ ...r, s: sayilan[r.k] ?? r.sistem })).filter((r) => r.s !== '' && sayi(r.s) !== r.sistem);
    const adimlar = [
      { soru: 'Hangi rafı sayıyorsunuz?', gecerli: () => !!bolum,
        icerik: ({ ileri }) => html`<div class="tz-secimler">${bolumler.map((x) => html`<${Secim} secili=${bolum === x.id} baslik=${x.ad} alt=${x.alt} onClick=${() => { setBolum(x.id); setSayilan({}); ileri(); }} />`)}</div>` },
      { soru: 'Rafta ne sayıyorsunuz?', ipucu: 'Sadece farklı olanları değiştirin. Sistem aradaki farkı düzeltme olarak kaydeder, eski kayıtlar değişmez.', gecerli: () => true,
        icerik: () => satirlar.length ? html`<table class="tz-sayim-tablo"><tbody>${satirlar.map((r) => {
          const v = sayilan[r.k] ?? r.sistem;
          const fark = v === '' ? 0 : sayi(v) - r.sistem;
          return html`<tr><td><b>${r.ad}</b></td><td class="soluk sayi">sistem ${r.sistem}</td>
            <td><input class="girdi sayi" type="number" min="0" value=${v} onFocus=${(e) => e.target.select()} onInput=${(e) => setSayilan((p) => ({ ...p, [r.k]: e.target.value === '' ? '' : Number(e.target.value) }))} /></td>
            <td class="fark" style=${{ color: fark < 0 ? 'var(--yok)' : fark > 0 ? 'var(--iyi)' : 'var(--soluk)' }}>${fark > 0 ? '+' : ''}${fark || '—'}</td></tr>`;
        })}</tbody></table>` : html`<p class="soluk">Bu rafta kayıtlı numune yok.</p>` },
      { soru: farklar.length ? `${farklar.length} fark kaydedilecek` : 'Her şey tutuyor 👌', gecerli: () => true,
        icerik: () => farklar.length ? html`<ul class="tz-akis">${farklar.map((r) => html`<li style="cursor:default"><span class="ik sayim"><${Ikon} ad="sayim" /></span><span class="ne">${r.ad}<small>sistemde ${r.sistem}, sayılan ${r.s}</small></span><span class=${'miktar ' + (r.s - r.sistem > 0 ? 'arti' : 'eksi')}>${r.s - r.sistem > 0 ? '+' : ''}${r.s - r.sistem}</span></li>`)}</ul>`
          : html`<p class="tz-ozet">Sayım sistemle aynı. Kaydedilecek bir fark yok.</p>` },
    ];
    async function kaydet() {
      if (!farklar.length) return;
      let no = H.yeniNo(d, 'sayim');
      const [on, yil, n] = no.split('-');
      const ops = farklar.map((r, i) => ({ c: 'sayim', k: uid(), v: {
        no: `${on}-${yil}-${String(+n + i).padStart(4, '0')}`, tarih: bugun(), tur: r.hedef.bos ? 'bos' : 'dolu', urun: r.hedef.urun || '', parti: r.hedef.parti || '',
        ambalaj: r.hedef.ambalaj, onceki: r.sistem, sayilan: sayi(r.s), fark: sayi(r.s) - r.sistem, neden: 'Raf sayımı' } }));
      await d.kaydet(ops);
      bildir(`Raf sayımı kaydedildi: ${ops.length} düzeltme.`);
    }
    return html`<${Sihirbaz} baslik="Raf sayımı" adimlar=${adimlar} kapat=${kapat} kaydet=${kaydet} kaydetYazi=${farklar.length ? 'Düzeltmeleri kaydet' : 'Bitir'} />`;
  }

  // Ortak parçalar (hareket defteri vb.) "Dolum yaptım / Numune gönder / Şişe geldi"yi bu sihirbazlarla açar.
  NT.eylem = {
    dolum: (on) => sihirbazAc(DolumSihirbazi, { on }),
    sevk: (on) => sihirbazAc(GonderSihirbazi, { on }),
    alim: (on) => sihirbazAc(AlimSihirbazi, { on }),
  };

  const EYLEMLER = [
    { ad: 'Dolum yaptım', alt: 'Şişeye numune doldurdum', ikon: 'dolum', tus: 'N', B: DolumSihirbazi, birincil: true },
    { ad: 'Numune gönder', alt: 'Firmaya gönderi hazırla', ikon: 'sevk', tus: 'S', B: GonderSihirbazi },
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
      if (eksik.length && !(await onayla(`Rafta yetersiz: ${eksik.map((e) => `${e.urun} ${e.parti} ${amb(e.ambalaj)}`).join(', ')}. Yine de yola çıktı olarak işaretlensin mi?`, { baslik: 'Stok yetersiz', evet: 'Evet' }))) return;
      if (s.tarih < bugun()) v.tarih = bugun();
    }
    await d.kaydet([{ c: 'sevk', k: s.id, v }]);
    bildir(`${s.no} · ${s.firma}: ${DURUM_ADI[sonraki]}`, { eylem: { yazi: 'Geri al', fn: () => d.kaydet([{ c: 'sevk', k: s.id, v: { durum: s.durum, tarih: s.tarih } }]) } });
  }
  function GonderiKarti({ s }) {
    const yer = DURUMLAR.indexOf(s.durum);
    const gun = gunFarki(s.tarih || bugun(), bugun());
    const sonraki = s.iptal ? null : DURUMLAR[yer + 1];
    return html`<div class="tz-gonderi" style=${s.iptal ? 'opacity:.75' : ''}>
      <div class="bas"><span class="etiket-kod">${s.no}</span><span class="firma" onClick=${() => F.kayitAc('sevk', s)}>${s.firma}</span>
        ${s.ulke && s.ulke !== 'Türkiye' && html`<span class="soluk kucuk">${s.ulke}</span>`}
        ${s.iptal ? html`<span class="gun"><span class="rozet yok" title=${s.iptalNeden || ''}><${Ikon} ad="kapat" />İptal edildi</span></span>`
          : html`<span class=${'gun' + (s.durum !== 'Gönderildi' && gun >= 7 ? ' gec' : '')}>${s.durum === 'Gönderildi' ? tarihYaz(s.tarih) : gun === 0 ? 'bugün' : `${gun} gündür`}</span>`}</div>
      <div class="tz-sise-cipler">${(s.kalemler || []).map((k) => html`<span class="tz-sise-cip"><b>${k.adet}</b>${kalemYazi(k)}</span>`)}
        <span class="tz-sise-cip" title="Toplam hacim">${litreYaz(H.sevkLitre(depo(), s.kalemler))} L</span>
        ${(() => { const t = (s.kalemler || []).reduce((n, k) => n + sayi(k.adet), 0), e = (s.siseler || []).filter((x) => x.ek).length;
          return e > 0 && html`<span class=${'tz-sise-cip etiket-sayac' + (e < t ? ' eksik' : '')} title="Şişe etiketi yüklenen şişe"><${Ikon} ad="etiket" boyut=${13} />${e}/${t}</span>`; })()}</div>
      <div class="tz-adimlar">${DURUMLAR.map((x, i) => html`${i > 0 && html`<span class=${'tz-cizgi' + (i <= yer ? ' gecti' : '')} />`}
        <span class=${'tz-adim' + (i < yer || (i === yer && x === 'Gönderildi') ? ' gecti' : i === yer ? ' simdi' : '')}><span class="o">${i < yer || x === s.durum && x === 'Gönderildi' ? html`<${Ikon} ad="tik" boyut=${12} />` : ''}</span><span class="yazi">${DURUM_ADI[x]}</span></span>`)}</div>
      <div class="alt">
        ${s.iptal ? html`<span class="soluk kucuk">${s.iptalNeden || 'Neden yazılmamış'}${s.iptalTarihi ? ` · ${tarihYaz(s.iptalTarihi)}` : ''}</span>`
        : sonraki ? html`<button class="d ana-d kucuk-d" onClick=${() => ilerlet(s)}>→ ${DURUM_ADI[sonraki]}</button>` : s.sekil === 'Kargo' && !s.takipNo && !(s.kargoBelge || []).length ? html`<button class="tz-alarm" style="border:0;cursor:pointer" title="Kargo firmasından gelen gönderi belgesini yükleyin" onClick=${() => F.kayitAc('sevk', s)}><${Ikon} ad="bilgi" />Kargo belgesi yok</button>`
          : html`<span class="soluk kucuk">${[s.kargoFirma, s.takipNo, (s.kargoBelge || []).length && 'kargo belgesi var'].filter(Boolean).join(' · ') || s.sekil}</span>`}
        <span class="bosluk" />
        ${s.iptal ? html`<button class="d hayalet kucuk-d" onClick=${() => F.iptalGeriAl(s)}><${Ikon} ad="geri" boyut=${15} />İptali geri al</button>`
          : s.durum !== 'Gönderildi' && html`<button class="d hayalet kucuk-d" title="Vazgeçildi: kayıt kalır, şişeler rafa döner" onClick=${() => F.iptalEt(s)}><${Ikon} ad="kapat" boyut=${15} />İptal et</button>`}
        <button class="d hayalet kucuk-d" onClick=${() => NT.etiket.ac({ tur: 'sevk', kayit: s })}><${Ikon} ad="yazici" boyut=${15} />Gönderi etiketi</button>
        <button class="d hayalet kucuk-d" onClick=${() => F.kayitAc('sevk', s)}><${Ikon} ad="kalem" boyut=${15} />Düzenle</button>
      </div>
    </div>`;
  }

  /* ---------------- Hareket listesi (akış ve geçmiş) ---------------- */
  function hareketler(d) {
    const l = [];
    for (const r of d.kayitlar('dolum')) l.push({ c: 'dolum', r, tarih: r.tarih, metin: html`<b>${r.adet} × ${r.urun}</b> ${r.parti || ''} · ${amb(r.ambalaj)} dolduruldu${r.kaynakTur ? html` <span class="soluk">(${H.dolumKaynagi(r)})</span>` : ''}`, miktar: `+${r.adet}`, tur: 'arti' });
    for (const r of d.kayitlar('sevk')) {
      const n = (r.kalemler || []).reduce((t, k) => t + sayi(k.adet), 0);
      l.push({ c: 'sevk', r, tarih: r.tarih, metin: html`<b>${r.firma}</b> firmasına ${n} şişe · ${DURUM_ADI[r.durum] || r.durum}`, miktar: r.durum === 'Gönderildi' ? `−${n}` : `${n} rezerve`, tur: r.durum === 'Gönderildi' ? 'eksi' : 'notr' });
    }
    for (const r of d.kayitlar('alim')) l.push({ c: 'alim', r, tarih: r.tarih, metin: html`<b>${r.adet} × ${amb(r.ambalaj)}</b> boş şişe geldi${r.tedarikci ? ' · ' + r.tedarikci : ''}`, miktar: `+${r.adet}`, tur: 'arti' });
    for (const r of d.kayitlar('sayim')) l.push({ c: 'sayim', r, tarih: r.tarih, metin: html`Sayım: <b>${r.tur === 'bos' ? amb(r.ambalaj) + ' boş' : `${r.urun} ${r.parti || ''} ${amb(r.ambalaj)}`}</b> ${r.onceki} → ${r.sayilan}`, miktar: `${r.fark > 0 ? '+' : ''}${r.fark}`, tur: r.fark > 0 ? 'arti' : 'eksi' });
    // Eski sistemden "sadece geçmiş" aktarılanlar listede kalır ama stok etkisi yok.
    for (const h of l) if (h.r.iptal) { h.miktar = 'iptal'; h.tur = 'notr'; }
    return l.sort((a, x) => (a.tarih < x.tarih ? 1 : a.tarih > x.tarih ? -1 : x.r._degisim - a.r._degisim));
  }
  function HareketSatiri({ h }) {
    const ac = () => (h.c === 'sayim' ? E.defterAc(h.r.tur === 'bos' ? { bos: true, ambalaj: h.r.ambalaj } : h.r) : F.kayitAc(h.c, h.r));
    return html`<li onClick=${ac}>
      <span class=${'ik ' + h.c}><${Ikon} ad=${h.c} /></span>
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
    const raf = partililer.map((u) => {
      const kalemler = dolu.filter((x) => x.urun === u.ad && (x.mevcut !== 0 || x.rezerve));
      const partiler = [...new Set(kalemler.map((x) => x.parti))].sort((a, x) => H.partiNo(x) - H.partiNo(a));
      return { u, satirlar: partiler.map((p) => ({ ad: p || 'Partisiz', kalemler: kalemler.filter((x) => x.parti === p) })) };
    }).filter((g) => g.satirlar.length);
    const digerAdlar = new Set(partililer.map((u) => u.ad));
    const diger = [...new Set(dolu.filter((x) => !digerAdlar.has(x.urun) && (x.mevcut !== 0 || x.rezerve)).map((x) => x.urun))].sort(trSirala)
      .map((ad) => ({ ad, duz: true, kalemler: dolu.filter((x) => x.urun === ad && (x.mevcut !== 0 || x.rezerve)) }));
    const siraAmb = new Map(ambalajlar.map((a, i) => [a.id, i]));
    const Satir = ({ s }) => html`<div class="tz-raf-satir"><span class=${'ad' + (s.duz ? ' duz' : '')}>${s.ad}</span>
      <div class="tz-yuvalar">${[...s.kalemler].sort((a, x) => (siraAmb.get(a.ambalaj) ?? 99) - (siraAmb.get(x.ambalaj) ?? 99)).map((x) => html`<button class="tz-yuva" title=${`${x.urun} ${x.parti} ${amb(x.ambalaj)}: rafta ${x.mevcut}${x.rezerve ? `, ${x.rezerve} rezerve` : ''}. Geçmiş için tıklayın.`} onClick=${() => E.defterAc(x)}>
        <span class=${'rozet-n' + (x.mevcut < 0 ? ' eksi' : '')}>${x.mevcut}</span><${Sise} litre=${litre(x.ambalaj)} boyut=${0.9} /><span class="a">${amb(x.ambalaj)}</span>${x.rezerve > 0 && html`<span class="r">${x.rezerve} ayrıldı</span>`}
      </button>`)}</div></div>`;

    return html`
      <div class="tz-selam tz-selam-bant"><${NT.ui.BantSus} /><div>
        <h1>${saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar'}${ad ? ', ' + ad : ''}.</h1>
        <p>Rafta <b class="v">${adetYaz(hazir)} dolu numune</b> ve <b>${adetYaz(bos)} boş şişe</b> var.
          ${yolda.length ? html` <b>${yolda.length} gönderi</b> yolda bekliyor.` : ' Bekleyen gönderi yok.'}
          ${uyarilar.length + bosUyari.length ? html` <b class="u">${uyarilar.length + bosUyari.length} kalem</b> azalıyor.` : ''}</p>
      </div></div>

      <div class="tz-izgara">
        <section class="tz-kart">
          <div class="tz-kart-bas"><h2>Raf</h2><div class="sag"><span class="raf-ipucu">rozetteki sayı: rafta · şişeye tıklayınca geçmişi açılır</span>
            <button class="d kucuk-d" onClick=${E.whatsappKopyala} title="Eski WhatsApp sayım biçiminde panoya kopyalar"><${Ikon} ad="whatsapp" boyut=${15} />Sayım listesi</button>
            <button class="d kucuk-d" onClick=${E.disaAktar.stok} title="Raftaki stok (Excel dosyası)"><${Ikon} ad="indir" boyut=${15} />Excel</button></div></div>
          <div class="tz-bos-serit">${ambalajlar.map((a) => {
            const x = st.bos.get(a.id) || { mevcut: 0, durum: 'yok' };
            return html`<button class=${'tz-bos ' + (x.durum !== 'iyi' && bosIzleniyor(x) ? x.durum : '')} onClick=${() => E.defterAc({ bos: true, ambalaj: a.id })} title=${`${a.ad}: ${x.mevcut} boş şişe`}>
              <span class="s"><${Sise} litre=${a.litre} /></span><span class="n">${x.mevcut}</span><span class="a">${a.ad} boş</span></button>`;
          })}</div>
          ${raf.map((g) => html`<div class="tz-urun">
            <div class="tz-urun-bas"><h3>${g.u.ad}</h3><span class="toplam">${g.satirlar.reduce((t, s) => t + s.kalemler.reduce((a, x) => a + x.mevcut, 0), 0)} şişe · ${g.satirlar.length} parti</span>
              <span class="sag">${uyarilar.filter((t) => t.urun === g.u.ad).map((t) => html`<span class=${'tz-alarm ' + t.durum}><${Ikon} ad="uyari" />${amb(t.ambalaj)}: toplam ${t.mevcut}</span>`)}</span></div>
            <div class="tz-raf-izgara">${g.satirlar.map((s) => html`<${Satir} s=${s} />`)}</div>
          </div>`)}
          ${diger.length > 0 && html`<div class="tz-urun"><div class="tz-urun-bas"><h3>Ar-Ge ve diğer ürünler</h3></div><div class="tz-raf-izgara">${diger.map((s) => html`<${Satir} s=${s} />`)}</div></div>`}
          ${!raf.length && !diger.length && (d.olaylar.size > 20
            ? html`<p class="soluk">Rafta dolu numune yok. “Dolum yaptım” ile ekleyin.</p>`
            : html`<div class="uyari-kutu bilgi"><${Ikon} ad="bilgi" /><span><b>Raf boş — ilk adım:</b>
                eski sistemdeki kayıtlarınızı <a href="#/ayarlar">Ayarlar › Yedek ve aktarım › “Eski sistemden aktar”</a> ile yükleyin
                (<code>numune_data.json</code>). Sıfırdan başlıyorsanız önce “Şişe geldi” ile boş şişeleri, sonra “Dolum yaptım” ile dolumları girin.</span></div>`)}
        </section>

        <div class="tz-sutun">
          <section class="tz-kart">
            <div class="tz-kart-bas"><h2>Yoldaki gönderiler</h2><div class="sag"><a href="#/gonderiler" style="color:var(--ana)">Tümü →</a></div></div>
            ${yolda.length ? yolda.slice(0, 4).map((s) => html`<${GonderiKarti} key=${s.id} s=${s} />`) : html`<p class="soluk" style="margin:0">Bekleyen gönderi yok.</p>`}
            ${yolda.length > 4 && html`<p class="kucuk soluk" style="margin:12px 0 0">+ ${yolda.length - 4} gönderi daha</p>`}
          </section>
          <section class="tz-kart">
            <div class="tz-kart-bas"><h2>Son hareketler</h2><div class="sag"><a href="#/gecmis" style="color:var(--ana)">Geçmiş →</a></div></div>
            ${hareketler(d).length ? html`<ul class="tz-akis">${hareketler(d).sort((a, x) => x.r._degisim - a.r._degisim).slice(0, 7).map((h) => html`<${HareketSatiri} key=${h.c + h.r.id} h=${h} />`)}</ul>`
              : html`<p class="soluk" style="margin:0">Henüz hareket yok. Girilen her dolum, gönderi ve şişe girişi burada kimin yaptığıyla görünür.</p>`}
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
    return html`<div class="tz-selam"><div><h1>Gönderiler</h1><p>Her kartta bir sonraki adıma tek dokunuşla geçin. Yalnızca “Yola çıktı” stoktan düşer.</p></div>
        <div style="margin-left:auto;display:flex;gap:8px;align-items:center"><button class="d" onClick=${E.disaAktar.sevk} title="Farukcan’ın SAMPLES tablosu düzeninde Excel dosyası"><${Ikon} ad="indir" boyut=${15} />Excel</button>
          <button class="d ana-d tz-buyuk" onClick=${() => sihirbazAc(GonderSihirbazi)}><${Ikon} ad="arti" />Numune gönder</button></div></div>
      <div class="tz-cipler">
        ${[['yolda', 'Yolda'], ['gitti', 'Gönderildi'], ['iptal', 'İptal'], ['hepsi', 'Tümü']].map(([id, ad]) => html`<button class=${'tz-cip' + (f === id ? ' secili' : '')} onClick=${() => setF(id)}>${ad}<span class="n">${gruplar[id].length}</span></button>`)}
        <input class="girdi" style="max-width:320px;margin-left:8px;border-radius:99px" placeholder="Firma, ürün, takip no…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      </div>
      ${liste.length ? html`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr));gap:14px">${liste.map((s) => html`<div key=${s.id} style="display:contents"><${GonderiKarti} s=${s} /></div>`)}</div>`
        : html`<div class="tz-kart"><p class="soluk" style="margin:0">Bu filtrede gönderi yok.</p></div>`}`;
  }

  /* ---------------- Geçmiş ---------------- */
  function Gecmis() {
    const d = depo();
    const [tur, setTur] = useState('');
    const [q, setQ] = useState('');
    const [limit, setLimit] = useState(80);
    const tum = hareketler(d);
    const sayilar = { dolum: 0, sevk: 0, alim: 0, sayim: 0 };
    for (const h of tum) sayilar[h.c]++;
    const liste = tum.filter((h) => (!tur || h.c === tur) && ara(`${h.r.no} ${h.r.urun || ''} ${h.r.parti || ''} ${h.r.firma || ''} ${h.r.tedarikci || ''} ${(h.r.kalemler || []).map(kalemYazi).join(' ')}`, q));
    const gunler = [];
    for (const h of liste.slice(0, limit)) {
      const son = gunler[gunler.length - 1];
      if (son && son.tarih === h.tarih) son.l.push(h); else gunler.push({ tarih: h.tarih, l: [h] });
    }
    const gunAdi = (t) => (t === bugun() ? 'Bugün' : t === gunEkle(bugun(), -1) ? 'Dün' : tarihYaz(t));
    return html`<div class="tz-selam"><div><h1>Geçmiş</h1><p>Tüm dolum, gönderi, şişe girişi ve sayımlar tek zaman çizgisinde. Bir satıra tıklayıp düzenleyebilir veya silebilirsiniz.</p></div></div>
      <div class="tz-cipler">
        ${[['', 'Hepsi', tum.length], ['dolum', 'Dolum', sayilar.dolum], ['sevk', 'Gönderi', sayilar.sevk], ['alim', 'Şişe girişi', sayilar.alim], ['sayim', 'Sayım', sayilar.sayim]].map(([id, ad, n]) =>
          html`<button class=${'tz-cip' + (tur === id ? ' secili' : '')} onClick=${() => setTur(id)}>${ad}<span class="n">${n}</span></button>`)}
        <input class="girdi" style="max-width:320px;margin-left:8px;border-radius:99px" placeholder="Ara…" value=${q} onInput=${(e) => setQ(e.target.value)} />
        <span style="flex:1" /><span class="kucuk soluk">Excel’e aktar:</span>
        <button class="d kucuk-d" onClick=${E.disaAktar.dolum}><${Ikon} ad="indir" boyut=${15} />Dolumlar</button>
        <button class="d kucuk-d" onClick=${E.disaAktar.sevk}><${Ikon} ad="indir" boyut=${15} />Gönderiler</button>
        <button class="d kucuk-d" onClick=${E.disaAktar.alim}><${Ikon} ad="indir" boyut=${15} />Şişe girişleri</button>
      </div>
      <section class="tz-kart">${gunler.length ? gunler.map((g) => html`<div class="tz-gun-bas">${gunAdi(g.tarih)}</div><ul class="tz-akis">${g.l.map((h) => html`<${HareketSatiri} key=${h.c + h.r.id} h=${h} />`)}</ul>`)
        : html`<p class="soluk" style="margin:0">Kayıt yok.</p>`}
        ${liste.length > limit && html`<button class="d" style="margin-top:14px" onClick=${() => setLimit(limit + 80)}>Daha eski ${Math.min(80, liste.length - limit)} kayıt</button>`}
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
      for (const x of H.stok(d).dolu.values()) if (x.mevcut > 0 && ara(`${x.urun} ${x.parti} ${amb(x.ambalaj)}`, q)) l.unshift({ tur: 'Raf', ad: `${x.urun} ${x.parti} · ${amb(x.ambalaj)}`, ek: `${x.mevcut} şişe`, fn: () => E.defterAc(x) });
      return l.slice(0, 12);
    }, [q, d.surum]);
    const calistir = (x) => { setQ(''); setAcik(false); girdi.current?.blur(); x.fn && x.fn(); };
    return html`<div class="tz-ara"><${Ikon} ad="ara" boyut=${16} />
      <input ref=${girdi} placeholder="Ara: firma, parti, kayıt no…  (Ctrl K)" value=${q} onFocus=${() => setAcik(true)} onBlur=${() => setTimeout(() => setAcik(false), 150)}
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
    return html`<button class="tz-tema" onClick=${degistir} title=${koyu ? 'Aydınlık moda geç' : 'Karanlık moda geç'} aria-label="Temayı değiştir"><${Ikon} ad=${koyu ? 'gunes' : 'ay'} boyut=${17} /></button>`;
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
          return bildir(`Okutulan kod bulunamadı: ${kod}`, { tur: 'hata' });
        }
        if (e.key.length !== 1) return;
        const hizli = simdi - son < 80;
        tampon = hizli ? tampon + e.key : e.key;
        son = simdi;
        clearTimeout(bekleyen);
        if (hizli) return;
        const x = EYLEMLER.find((a) => a.tus.toLowerCase() === e.key.toLowerCase());
        if (x) { e.preventDefault(); bekleyen = setTimeout(() => tampon.length === 1 && sihirbazAc(x.B), 120); }
      };
      window.addEventListener('keydown', f);
      return () => { window.removeEventListener('keydown', f); clearTimeout(bekleyen); };
    }, [d]);

    const yolda = d.kayitlar('sevk').filter((s) => s.durum !== 'Gönderildi' && H.sevkEtkili(s)).length;
    const cevrimici = (d.kisiler || []).filter((k) => Date.now() - k.t < 90000);
    const durum = d.hata ? 'hata' : d.bekleyen.length ? 'bekliyor' : '';
    const Sayfa = { genel: GenelBakis, gonderiler: Gonderiler, gecmis: Gecmis, ayarlar: E.Ayarlar }[sekme] || GenelBakis;
    return html`<div class="tz-iskelet tz-m-numune">
      <aside class="tz-yan">
        <a class="tz-marka" href="#/genel"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" /><span>Numune Takip</span></a>
        <${NT.ui.AnaEkranLinki} />
        <nav class="tz-menu" aria-label="Sayfalar">${SEKMELER.map((s) => html`<a href=${'#/' + s.id} class=${sekme === s.id ? 'aktif' : ''}>
          <${Ikon} ad=${s.ikon} />${s.ad}${s.id === 'gonderiler' && yolda > 0 ? html`<span class="n" title="Yoldaki gönderi">${yolda}</span>` : ''}</a>`)}</nav>
        <div class="tz-menu-baslik">Hızlı işlem</div>
        <nav class="tz-menu tz-hizli-menu" aria-label="Hızlı işlem">${EYLEMLER.map((x) => html`<button type="button" onClick=${() => sihirbazAc(x.B)} title=${x.alt}>
          <${Ikon} ad=${x.ikon} />${x.ad}<kbd>${x.tus}</kbd></button>`)}</nav>
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
        ${b.mod === 'demo' && html`<div class="sunum-seridi" role="alert"><${Ikon} ad="uyari" boyut=${16} /><span><b>SUNUM MODU</b> · Örnek veriler. Burada girdiğiniz hiçbir şey kaydedilmez; sayfa kapanınca silinir.</span><a href=${NT.c.adres('numune', { demo: false })}>Gerçek verilerle aç →</a></div>`}
        <header class="tz-ust"><${Arama} /><span style="flex:1" /><${TemaDugmesi} /></header>
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
      if (ad.trim().length < 2) return setHata('Önce adınızı yazın.');
      if (kod.trim().length < 4) return setHata('Erişim kodunu yazın.');
      setHata(''); setBekle(true);
      try { await b.girisYap(ad, kod); } catch (e) { console.error(e); setHata(e); } finally { setBekle(false); }
    };
    // Kod sonradan değiştirildiyse ya da sunucuya ulaşılamadıysa: aynı ekran, nedeniyle birlikte.
    const hataVar = b.durum === 'hata';
    const girisFormu = !hataVar || b.hataKod;
    const enter = (e) => e.key === 'Enter' && giris();
    return html`<div class="tz-kurulum"><div class="tz-kurulum-kutu">
      <img src="uygulama/ortak/logo.svg" alt="SKYHEM" />
      <h1>${hataVar && !b.hataKod ? 'Sunucuya bağlanılamadı' : 'Numune Takip’e hoş geldiniz'}</h1>
      <p>${hataVar ? b.hataMesaji : 'Adınızı ve size verilen erişim kodunu bir kez yazın. Kayıtlar internet üzerinden herkesle otomatik eşitlenir.'}</p>
      ${girisFormu && html`
        <input class="girdi" style="font-size:17px;padding:12px 14px" placeholder="Adınız Soyadınız" value=${ad} onInput=${(e) => setAd(e.target.value)} onKeyDown=${enter} autofocus />
        <input class="girdi mono" style="font-size:17px;padding:12px 14px;text-transform:uppercase" placeholder="Erişim kodu (örn. SKY-XXXX-XXXX)" value=${kod} onInput=${(e) => setKod(e.target.value)} onKeyDown=${enter} autocomplete="off" spellcheck="false" />
        <button class="d ana-d tz-buyuk" disabled=${bekle} onClick=${giris}>${bekle ? 'Bağlanıyor…' : 'Başla'}</button>`}
      ${!girisFormu && html`<button class="d ana-d tz-buyuk" onClick=${() => b.baslat()}>Tekrar dene</button>`}
      <${NT.ui.HataKutusu} hata=${hata} />
    </div></div>`;
  }

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
        const uzak = (yeni || []).filter((e) => e.d !== b.cihaz && e.t > baslangic - 5000 && ['dolum', 'sevk', 'alim', 'sayim'].includes(e.c));
        if (uzak.length) bildir(`${[...new Set(uzak.map((e) => e.u))].join(', ')} ${uzak.length === 1 ? 'bir işlem' : uzak.length + ' işlem'} yaptı · raf güncellendi`, { eylem: { yazi: 'Geçmiş', fn: () => { location.hash = '#/gecmis'; } } });
      });
    }, [b.depo]);
    const ic = b.durum === 'hazir' && b.depo ? html`<${Uygulama} />`
      : b.durum === 'basliyor' ? html`<div style="display:grid;place-items:center;height:100vh;color:var(--soluk)">Yükleniyor…</div>` : html`<${Kurulum} />`;
    return html`${ic}<${SihirbazKatmani} /><${F.FormKatmani} /><${GlobalKatman} />`;
  }

  render(html`<${Kok} />`, document.getElementById('uygulama'));
  b.baslat();
})();
