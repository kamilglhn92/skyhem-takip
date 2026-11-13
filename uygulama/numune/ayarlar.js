/* Ayarlar: profil, veri klasörü, ürünler, ambalajlar, firma bilgisi, yedek/aktarım, çöp kutusu. */
(function () {
  'use strict';
  const NT = window.NT;
  const cevir = NT.dil.t;
  const { html, useState, useRef } = window.htmPreact;
  const { Ikon, Alan, Avatar, BosDurum, bildir, onayla } = NT.ui;
  const H = NT.hesap;
  const { onceYaz, zamanYaz, tarihYaz, bugun, indir, sayi, adetYaz } = NT.c;
  const { SayfaBasi, Segment } = NT.ekran;
  const depo = () => NT.baglanti.depo;

  function tema() {
    try { return localStorage.getItem('nt.tema') || 'oto'; } catch { return 'oto'; }
  }
  function temaUygula(t) {
    if (t === 'oto') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', t);
  }
  temaUygula(tema());

  function Kart({ baslik, aciklama, sag, children, ic = true }) {
    return html`<section class="kart" style="margin-bottom:16px">
      <div class="kart-bas"><div><h2>${baslik}</h2>${aciklama && html`<div class="kucuk soluk" style="margin-top:2px">${aciklama}</div>`}</div><div class="sag">${sag}</div></div>
      ${ic ? html`<div class="kart-ic">${children}</div>` : children}
    </section>`;
  }

  function Profil() {
    const b = NT.baglanti;
    const [ad, setAd] = useState(b.kullanici);
    const [t, setT] = useState(tema());
    return html`<${Kart} baslik=${cevir("Profil")} aciklama=${cevir("Adınız her kaydın geçmişinde “kim yaptı” olarak görünür.")}>
      <div class="form-izgara">
        <${Alan} etiket=${cevir("Adınız")} sinif="s6">${NT.numunePersonel ? html`<b>${b.kullanici}</b>` : html`<div style="display:flex;gap:8px"><input class="girdi" value=${ad} onInput=${(e) => setAd(e.target.value)} />
          <button class="d" disabled=${!ad.trim() || ad.trim() === b.kullanici} onClick=${() => { b.kullaniciAyarla(ad); bildir(cevir("Adınız güncellendi.")); }}>${cevir("Kaydet")}</button></div>`}<//>
        <${Alan} etiket=${cevir("Görünüm")} sinif="s6"><${Segment} secenekler=${[['oto', 'Sistem'], ['acik', 'Açık'], ['koyu', 'Koyu']]} deger=${t} degis=${(v) => { setT(v); try { localStorage.setItem('nt.tema', v); } catch { /* yoksay */ } temaUygula(v); }} /><//>
      </div>
    <//>`;
  }

  function VeriKlasoru() {
    const b = NT.baglanti;
    const d = depo();
    const cihazlar = new Map();
    for (const e of d.sirali) cihazlar.set(e.d, { d: e.d, u: e.u, t: e.t, n: (cihazlar.get(e.d)?.n || 0) + 1 });
    const kisiler = new Map((d.kisiler || []).map((k) => [k.cihaz, k]));
    return html`<${Kart} baslik=${cevir("Bulut bağlantısı")} aciklama=${cevir("Kayıtlar internet üzerinden (Supabase) tutulur; bu kodu kullanan her bilgisayar aynı kayıtları görür. İnternet yokken son kayıtlarla çalışır, yeni kayıtları bağlantı gelince gönderir.")}
      sag=${html`<button class="d kucuk-d" onClick=${async () => { await d.tara(); bildir(d.hata ? d.hata : cevir("Eşitlendi."), d.hata ? { tur: 'hata' } : {}); }}><${Ikon} ad="senkron" boyut=${15} />${cevir("Şimdi eşitle")}</button>`}>
      <div class="form-izgara">
        <div class="s6"><div class="alt-satir">${cevir("Bağlantı")}</div><div class="ust-satir" style="display:flex;align-items:center;gap:8px"><${Ikon} ad="senkron" />${b.mod === 'demo' ? cevir("Sunum modu (kaydedilmez)") : d.cevrimici ? cevir("Bulut · bağlı") : cevir("Bulut · bağlantı yok")}</div></div>
        <div class="s3"><div class="alt-satir">${cevir("Toplam hareket")}</div><div class="ust-satir sayi">${adetYaz(d.olaylar.size)}</div></div>
        <div class="s3"><div class="alt-satir">${cevir("Son eşitleme")}</div><div class="ust-satir">${d.sonEsitleme ? onceYaz(d.sonEsitleme) : '—'}</div></div>
        ${d.bekleyen.length > 0 && html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${d.bekleyen.length} ${cevir("değişiklik bu bilgisayarda bekliyor; internete ulaşılınca otomatik gönderilecek.")}</span></div>`}
        ${d.hata && html`<div class="s12 uyari-kutu yok"><${Ikon} ad="uyari" /><span>${d.hata}</span></div>`}
        <div class="s12"><div class="alt-satir" style="margin-bottom:6px">${cevir("Kayıt yapan bilgisayarlar")}</div>
          <div class="tablo-kap"><table class="tablo"><thead><tr><th>${cevir("Kullanıcı")}</th><th>${cevir("Cihaz kodu")}</th><th class="sag">${cevir("Hareket")}</th><th>${cevir("Son işlem")}</th><th>${cevir("Durum")}</th></tr></thead><tbody>
          ${[...cihazlar.values()].sort((a, b2) => b2.t - a.t).map((c) => {
            const k = kisiler.get(c.d);
            const cevrimici = k && Date.now() - k.t < 90000;
            return html`<tr><td><div style="display:flex;gap:8px;align-items:center"><${Avatar} ad=${k?.ad || c.u} kucuk />${k?.ad || c.u}${c.d === b.cihaz ? html` <span class="rozet bilgi">${cevir("bu bilgisayar")}</span>` : ''}</div></td>
              <td class="mono soluk">${c.d}</td><td class="sag sayi">${c.n}</td><td>${zamanYaz(c.t)}</td>
              <td>${cevrimici ? html`<span class="rozet iyi"><${Ikon} ad="daire_tik" />${cevir("Çevrimiçi")}</span>` : html`<span class="soluk kucuk">${k ? onceYaz(k.t) : '—'}</span>`}</td></tr>`;
          })}</tbody></table></div></div>
        ${b.mod === 'bulut' && html`<div class="s12 dugmeler">
          <button class="d hayalet" onClick=${async () => { if (await onayla(cevir("Bu bilgisayardaki erişim kodu silinir; uygulama bir dahaki açılışta kodu yeniden ister. Buluttaki kayıtlara dokunulmaz."), { baslik: cevir("Bağlantıyı kes"), evet: cevir("Bağlantıyı kes") })) b.ayril(); }}>${cevir("Bu bilgisayarın bağlantısını kes")}</button>
        </div>`}
      </div>
    <//>`;
  }

  function Urunler() {
    const d = depo();
    const [yeni, setYeni] = useState('');
    const kaydet = (u, v) => d.kaydet([{ c: 'urun', k: u.id, v }]);
    async function ekle() {
      const ad = yeni.trim();
      if (!ad) return;
      if (H.urunBul(d, ad)) return bildir(cevir("Bu ürün zaten var."), { tur: 'hata' });
      await d.kaydet([{ c: 'urun', k: H.kisaAd(ad) + '-' + NT.c.uid(4), v: { ad, partili: false, alarm: false, kritik: 5, aktif: true, sira: 99 } }]);
      setYeni('');
      bildir(NT.dil.m("{0} eklendi.", ad));
    }
    return html`<${Kart} ic=${false} baslik=${cevir("Ürünler")} aciklama=${cevir("Parti takibi: dolumda parti no zorunlu olur. Stok alarmı: dolu stok kritik seviyenin altına inince uyarır.")}>
      <div class="tablo-kap"><table class="tablo"><thead><tr><th>${cevir("Ürün")}</th><th>${cevir("Parti takibi")}</th><th>${cevir("Stok alarmı")}</th><th>${cevir("Kritik seviye")}</th><th>${cevir("Listede")}</th></tr></thead><tbody>
      ${H.urunler(d, { hepsi: true }).map((u) => html`<tr key=${u.id} class=${u.aktif === false ? 'silik' : ''}>
        <td><b>${u.ad}</b></td>
        <td><label class="onay-kutu"><input type="checkbox" checked=${!!u.partili} onChange=${(e) => kaydet(u, { partili: e.target.checked })} />${u.partili ? cevir("Partili") : cevir("Partisiz")}</label></td>
        <td><label class="onay-kutu"><input type="checkbox" checked=${!!u.alarm} onChange=${(e) => kaydet(u, { alarm: e.target.checked })} />${u.alarm ? cevir("Açık") : cevir("Kapalı")}</label></td>
        <td><input class="girdi" type="number" min="0" style="width:80px" value=${u.kritik ?? 5} disabled=${!u.alarm} onChange=${(e) => kaydet(u, { kritik: sayi(e.target.value) })} /></td>
        <td><label class="onay-kutu"><input type="checkbox" checked=${u.aktif !== false} onChange=${(e) => kaydet(u, { aktif: e.target.checked })} />${u.aktif !== false ? cevir("Görünür") : cevir("Gizli")}</label></td>
      </tr>`)}
      </tbody></table></div>
      <div class="kart-ic dugmeler" style="border-top:1px solid var(--cizgi)">
        <input class="girdi" style="max-width:300px" placeholder=${cevir("Yeni ürün adı")} value=${yeni} onInput=${(e) => setYeni(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && ekle()} />
        <button class="d" onClick=${ekle}><${Ikon} ad="arti" />${cevir("Ürün ekle")}</button>
        <span class="kucuk soluk">${cevir("Ürün adı kayıtlarda geçtiği için sonradan değiştirilemez; kullanılmayan ürünü “Gizli” yapın.")}</span>
      </div>
    <//>`;
  }

  function Ambalajlar() {
    const d = depo();
    const [yeni, setYeni] = useState({ ad: '', litre: '' });
    const kaydet = (a, v) => d.kaydet([{ c: 'ambalaj', k: a.id, v }]);
    async function ekle() {
      const litre = sayi(yeni.litre);
      if (!yeni.ad.trim() || !(litre > 0)) return bildir(cevir("Ad ve litre girin (örn: 2 L, 2)."), { tur: 'hata' });
      const id = litre < 1 ? `${Math.round(litre * 1000)}ml` : `${String(litre).replace('.', ',')}L`;
      if (H.ambalajlar(d, { hepsi: true }).some((a) => a.id === id)) return bildir(cevir("Bu hacimde ambalaj zaten var."), { tur: 'hata' });
      await d.kaydet([{ c: 'ambalaj', k: id, v: { ad: yeni.ad.trim(), litre, kritik: 5, aktif: true } }]);
      setYeni({ ad: '', litre: '' });
    }
    return html`<${Kart} ic=${false} baslik=${cevir("Ambalajlar")} aciklama=${cevir("Boş şişe stoku kritik seviyenin altına inince uyarı verir.")}>
      <div class="tablo-kap"><table class="tablo"><thead><tr><th>${cevir("Ambalaj")}</th><th>${cevir("Kod")}</th><th>${cevir("Kritik seviye")}</th><th>${cevir("Listede")}</th></tr></thead><tbody>
      ${H.ambalajlar(d, { hepsi: true }).map((a) => html`<tr key=${a.id} class=${a.aktif === false ? 'silik' : ''}>
        <td><b>${a.ad}</b></td><td class="mono soluk">${a.id}</td>
        <td><input class="girdi" type="number" min="0" style="width:80px" value=${a.kritik ?? 5} onChange=${(e) => kaydet(a, { kritik: sayi(e.target.value) })} /></td>
        <td><label class="onay-kutu"><input type="checkbox" checked=${a.aktif !== false} onChange=${(e) => kaydet(a, { aktif: e.target.checked })} />${a.aktif !== false ? cevir("Görünür") : cevir("Gizli")}</label></td>
      </tr>`)}
      </tbody></table></div>
      <div class="kart-ic dugmeler" style="border-top:1px solid var(--cizgi)">
        <input class="girdi" style="max-width:160px" placeholder=${cevir("Ad (örn: 2 L)")} value=${yeni.ad} onInput=${(e) => setYeni({ ...yeni, ad: e.target.value })} />
        <input class="girdi" style="max-width:120px" placeholder=${cevir("Litre (örn: 2)")} inputmode="decimal" value=${yeni.litre} onInput=${(e) => setYeni({ ...yeni, litre: e.target.value })} />
        <button class="d" onClick=${ekle}><${Ikon} ad="arti" />${cevir("Ambalaj ekle")}</button>
      </div>
    <//>`;
  }

  function FirmaBilgisi() {
    const d = depo();
    const a = NT.etiket.ayarlar();
    const kaydet = (k) => (e) => d.kaydet([{ c: 'ayar', k: 'genel', v: { [k]: e.target.value.trim() } }]);
    return html`<${Kart} baslik=${cevir("Etiket bilgileri")} aciklama=${cevir("Gönderi (koli) etiketinde gönderen olarak basılır.")}>
      <div class="form-izgara">
        <${Alan} etiket=${cevir("Firma unvanı")} sinif="s6"><input class="girdi" value=${a.firmaAdi} onChange=${kaydet('firmaAdi')} /><//>
        <${Alan} etiket="Web" sinif="s6"><input class="girdi" value=${a.web} onChange=${kaydet('web')} /><//>
        <${Alan} etiket=${cevir("Adres")} sinif="s8"><input class="girdi" value=${a.adres} onChange=${kaydet('adres')} /><//>
        <${Alan} etiket=${cevir("Telefon")} sinif="s4"><input class="girdi" value=${a.telefon} onChange=${kaydet('telefon')} /><//>
      </div>
    <//>`;
  }

  function DosyaDugmesi({ yazi, ikon, kabul, fn }) {
    const g = useRef();
    return html`<button class="d" onClick=${() => g.current.click()}><${Ikon} ad=${ikon} />${cevir(yazi)}</button>
      <input ref=${g} type="file" accept=${kabul} class="gizli" onChange=${async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await fn(f); }} />`;
  }

  function Yedek() {
    const d = depo();
    async function jsonOku(f) {
      try { return JSON.parse(await f.text()); } catch { throw new Error(cevir('Dosya okunamadı (geçerli JSON değil).', 'The file could not be read (not valid JSON).')); }
    }
    return html`<${Kart} baslik=${cevir("Yedek ve aktarım")} aciklama=${cevir("Kayıtlar bulutta durur; yine de ay sonlarında tam yedek indirip saklamanızı öneririz.")}>
      <div class="dugmeler">
        <button class="d" onClick=${() => { indir(`numune-takip-yedek-${bugun()}.json`, H.yedek(d), 'application/json'); bildir(cevir("Yedek indirildi.")); }}><${Ikon} ad="indir" />${cevir("Tam yedek indir")}</button>
        <${DosyaDugmesi} yazi="Yedekten geri yükle" ikon="yukle" kabul=".json,application/json" fn=${async (f) => {
          try {
            const n = await H.yedektenYukle(d, await jsonOku(f));
            bildir(n ? NT.dil.m("{0} hareket geri yüklendi.", n) : cevir("Yedekteki her şey zaten mevcut."));
          } catch (e) { bildir(e.message, { tur: 'hata' }); }
        }} />
        <${DosyaDugmesi} yazi="Eski sistemden aktar (numune_data.json)" ikon="yukle" kabul=".json,application/json" fn=${async (f) => {
          try {
            const veri = await jsonOku(f);
            if (!(await onayla(NT.dil.m('Eski sistemden {0} alım, {1} dolum ve {2} sevkiyat GEÇMİŞ olarak aktarılacak: Gönderiler ve Geçmiş ekranlarında görünür, stoku değiştirmez (stok açılış sayımıyla başladı). Aynı dosyayı iki kez aktarmak kopya oluşturmaz.', veri.purchases?.length ?? 0, veri.fillings?.length ?? 0, veri.shipments?.length ?? 0), { baslik: cevir("Eski verileri aktar"), evet: cevir("Geçmiş olarak aktar") }))) return;
            const s = await H.eskiVeriyiAktar(d, veri, { gecmis: true });
            bildir(NT.dil.m('Aktarıldı: {0} alım, {1} dolum, {2} sevkiyat.', s.alim, s.dolum, s.sevk));
          } catch (e) { bildir(e.message, { tur: 'hata' }); }
        }} />
      </div>
      <p class="kucuk soluk" style="margin:12px 0 0">${cevir("Eski AI Studio uygulamasında “JSON Tam Veritabanı Yedeği” ile indirdiğiniz veya ortak klasördeki")} <code>numune_data.json</code> ${cevir("dosyasını seçin.")}</p>
    <//>`;
  }

  function CopKutusu() {
    const d = depo();
    const silinen = (NT.numunePersonel ? ['dolum', 'alim', 'sayim'] : ['dolum', 'sevk', 'alim', 'sayim']).flatMap((c) => d.kayitlar(c, { silinenler: true }).filter((r) => r._silindi).map((r) => ({ c, r })))
      .sort((a, b) => b.r._degisim - a.r._degisim);
    const AD = { dolum: 'Dolum', sevk: 'Sevkiyat', alim: 'Alım', sayim: 'Sayım' };
    return html`<${Kart} ic=${false} baslik=${cevir("Çöp kutusu")} aciklama=${cevir("Silinen kayıtlar kalıcı olarak kaybolmaz; buradan geri alınabilir.")}>
      ${silinen.length ? html`<div class="tablo-kap" style="max-height:340px"><table class="tablo"><thead><tr><th>${cevir("Kayıt")}</th><th>${cevir("Tür")}</th><th>${cevir("İçerik")}</th><th>${cevir("Silen")}</th><th></th></tr></thead><tbody>
        ${silinen.map(({ c, r }) => html`<tr key=${r.id}><td><span class="etiket-kod">${r.no}</span></td><td>${cevir(AD[c])}</td>
          <td>${c === 'sevk' ? r.firma : c === 'alim' ? `${r.adet} × ${H.ambalajAdi(d, r.ambalaj)}` : `${r.adet ?? r.fark} × ${r.urun || ''} ${r.parti || ''} ${H.ambalajAdi(d, r.ambalaj)}`} <span class="soluk kucuk">· ${tarihYaz(r.tarih)}</span></td>
          <td>${r._degistiren} <span class="soluk kucuk">· ${onceYaz(r._degisim)}</span></td>
          <td class="sag"><button class="d kucuk-d" onClick=${async () => { if (await NT.form.kayitDurumu(c, r, 'undel')) bildir(NT.dil.m("{0} geri alındı.", r.no)); }}><${Ikon} ad="geri" boyut=${15} />${cevir("Geri al")}</button></td></tr>`)}
      </tbody></table></div>` : html`<${BosDurum} ikon="cop" baslik=${cevir("Çöp kutusu boş")} />`}
    <//>`;
  }

  function Ayarlar() {
    return html`<${SayfaBasi} baslik=${cevir("Ayarlar")} aciklama=${cevir("Buradaki ürün, ambalaj ve etiket ayarları tüm kullanıcılar için ortaktır.")} />
      <${Profil} /><${VeriKlasoru} /><${Urunler} /><${Ambalajlar} />${!NT.numunePersonel && html`<${FirmaBilgisi} /><${Yedek} />`}<${CopKutusu} />`;
  }

  NT.ekran.Ayarlar = Ayarlar;
})();
