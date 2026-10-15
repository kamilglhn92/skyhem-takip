/* Ayarlar: profil, veri klasörü, ürünler, ambalajlar, firma bilgisi, yedek/aktarım, çöp kutusu. */
(function () {
  'use strict';
  const NT = window.NT;
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
    return html`<${Kart} baslik="Profil" aciklama="Adınız her kaydın geçmişinde “kim yaptı” olarak görünür.">
      <div class="form-izgara">
        <${Alan} etiket="Adınız" sinif="s6"><div style="display:flex;gap:8px"><input class="girdi" value=${ad} onInput=${(e) => setAd(e.target.value)} />
          <button class="d" disabled=${!ad.trim() || ad.trim() === b.kullanici} onClick=${() => { b.kullaniciAyarla(ad); bildir('Adınız güncellendi.'); }}>Kaydet</button></div><//>
        <${Alan} etiket="Görünüm" sinif="s6"><${Segment} secenekler=${[['oto', 'Sistem'], ['acik', 'Açık'], ['koyu', 'Koyu']]} deger=${t} degis=${(v) => { setT(v); try { localStorage.setItem('nt.tema', v); } catch { /* yoksay */ } temaUygula(v); }} /><//>
      </div>
    <//>`;
  }

  function VeriKlasoru() {
    const b = NT.baglanti;
    const d = depo();
    const cihazlar = new Map();
    for (const e of d.sirali) cihazlar.set(e.d, { d: e.d, u: e.u, t: e.t, n: (cihazlar.get(e.d)?.n || 0) + 1 });
    const kisiler = new Map((d.kisiler || []).map((k) => [k.cihaz, k]));
    return html`<${Kart} baslik="Bulut bağlantısı" aciklama="Kayıtlar internet üzerinden (Supabase) tutulur; bu kodu kullanan her bilgisayar aynı kayıtları görür. İnternet yokken son kayıtlarla çalışır, yeni kayıtları bağlantı gelince gönderir."
      sag=${html`<button class="d kucuk-d" onClick=${async () => { await d.tara(); bildir(d.hata ? d.hata : 'Eşitlendi.', d.hata ? { tur: 'hata' } : {}); }}><${Ikon} ad="senkron" boyut=${15} />Şimdi eşitle</button>`}>
      <div class="form-izgara">
        <div class="s6"><div class="alt-satir">Bağlantı</div><div class="ust-satir" style="display:flex;align-items:center;gap:8px"><${Ikon} ad="senkron" />${b.mod === 'demo' ? 'Sunum modu (kaydedilmez)' : d.cevrimici ? 'Bulut · bağlı' : 'Bulut · bağlantı yok'}</div></div>
        <div class="s3"><div class="alt-satir">Toplam hareket</div><div class="ust-satir sayi">${adetYaz(d.olaylar.size)}</div></div>
        <div class="s3"><div class="alt-satir">Son eşitleme</div><div class="ust-satir">${d.sonEsitleme ? onceYaz(d.sonEsitleme) : '—'}</div></div>
        ${d.bekleyen.length > 0 && html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${d.bekleyen.length} değişiklik bu bilgisayarda bekliyor; internete ulaşılınca otomatik gönderilecek.</span></div>`}
        ${d.hata && html`<div class="s12 uyari-kutu yok"><${Ikon} ad="uyari" /><span>${d.hata}</span></div>`}
        <div class="s12"><div class="alt-satir" style="margin-bottom:6px">Kayıt yapan bilgisayarlar</div>
          <div class="tablo-kap"><table class="tablo"><thead><tr><th>Kullanıcı</th><th>Cihaz kodu</th><th class="sag">Hareket</th><th>Son işlem</th><th>Durum</th></tr></thead><tbody>
          ${[...cihazlar.values()].sort((a, b2) => b2.t - a.t).map((c) => {
            const k = kisiler.get(c.d);
            const cevrimici = k && Date.now() - k.t < 90000;
            return html`<tr><td><div style="display:flex;gap:8px;align-items:center"><${Avatar} ad=${k?.ad || c.u} kucuk />${k?.ad || c.u}${c.d === b.cihaz ? html` <span class="rozet bilgi">bu bilgisayar</span>` : ''}</div></td>
              <td class="mono soluk">${c.d}</td><td class="sag sayi">${c.n}</td><td>${zamanYaz(c.t)}</td>
              <td>${cevrimici ? html`<span class="rozet iyi"><${Ikon} ad="daire_tik" />Çevrimiçi</span>` : html`<span class="soluk kucuk">${k ? onceYaz(k.t) : '—'}</span>`}</td></tr>`;
          })}</tbody></table></div></div>
        ${b.mod === 'bulut' && html`<div class="s12 dugmeler">
          <button class="d hayalet" onClick=${async () => { if (await onayla('Bu bilgisayardaki erişim kodu silinir; uygulama bir dahaki açılışta kodu yeniden ister. Buluttaki kayıtlara dokunulmaz.', { baslik: 'Bağlantıyı kes', evet: 'Bağlantıyı kes' })) b.ayril(); }}>Bu bilgisayarın bağlantısını kes</button>
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
      if (H.urunBul(d, ad)) return bildir('Bu ürün zaten var.', { tur: 'hata' });
      await d.kaydet([{ c: 'urun', k: H.kisaAd(ad) + '-' + NT.c.uid(4), v: { ad, partili: false, alarm: false, kritik: 5, aktif: true, sira: 99 } }]);
      setYeni('');
      bildir(`${ad} eklendi.`);
    }
    return html`<${Kart} ic=${false} baslik="Ürünler" aciklama="Parti takibi: dolumda parti no zorunlu olur. Stok alarmı: dolu stok kritik seviyenin altına inince uyarır.">
      <div class="tablo-kap"><table class="tablo"><thead><tr><th>Ürün</th><th>Parti takibi</th><th>Stok alarmı</th><th>Kritik seviye</th><th>Listede</th></tr></thead><tbody>
      ${H.urunler(d, { hepsi: true }).map((u) => html`<tr key=${u.id} class=${u.aktif === false ? 'silik' : ''}>
        <td><b>${u.ad}</b></td>
        <td><label class="onay-kutu"><input type="checkbox" checked=${!!u.partili} onChange=${(e) => kaydet(u, { partili: e.target.checked })} />${u.partili ? 'Partili' : 'Partisiz'}</label></td>
        <td><label class="onay-kutu"><input type="checkbox" checked=${!!u.alarm} onChange=${(e) => kaydet(u, { alarm: e.target.checked })} />${u.alarm ? 'Açık' : 'Kapalı'}</label></td>
        <td><input class="girdi" type="number" min="0" style="width:80px" value=${u.kritik ?? 5} disabled=${!u.alarm} onChange=${(e) => kaydet(u, { kritik: sayi(e.target.value) })} /></td>
        <td><label class="onay-kutu"><input type="checkbox" checked=${u.aktif !== false} onChange=${(e) => kaydet(u, { aktif: e.target.checked })} />${u.aktif !== false ? 'Görünür' : 'Gizli'}</label></td>
      </tr>`)}
      </tbody></table></div>
      <div class="kart-ic dugmeler" style="border-top:1px solid var(--cizgi)">
        <input class="girdi" style="max-width:300px" placeholder="Yeni ürün adı" value=${yeni} onInput=${(e) => setYeni(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && ekle()} />
        <button class="d" onClick=${ekle}><${Ikon} ad="arti" />Ürün ekle</button>
        <span class="kucuk soluk">Ürün adı kayıtlarda geçtiği için sonradan değiştirilemez; kullanılmayan ürünü “Gizli” yapın.</span>
      </div>
    <//>`;
  }

  function Ambalajlar() {
    const d = depo();
    const [yeni, setYeni] = useState({ ad: '', litre: '' });
    const kaydet = (a, v) => d.kaydet([{ c: 'ambalaj', k: a.id, v }]);
    async function ekle() {
      const litre = sayi(yeni.litre);
      if (!yeni.ad.trim() || !(litre > 0)) return bildir('Ad ve litre girin (örn: 2 L, 2).', { tur: 'hata' });
      const id = litre < 1 ? `${Math.round(litre * 1000)}ml` : `${String(litre).replace('.', ',')}L`;
      if (H.ambalajlar(d, { hepsi: true }).some((a) => a.id === id)) return bildir('Bu hacimde ambalaj zaten var.', { tur: 'hata' });
      await d.kaydet([{ c: 'ambalaj', k: id, v: { ad: yeni.ad.trim(), litre, kritik: 5, aktif: true } }]);
      setYeni({ ad: '', litre: '' });
    }
    return html`<${Kart} ic=${false} baslik="Ambalajlar" aciklama="Boş şişe stoku kritik seviyenin altına inince uyarı verir.">
      <div class="tablo-kap"><table class="tablo"><thead><tr><th>Ambalaj</th><th>Kod</th><th>Kritik seviye</th><th>Listede</th></tr></thead><tbody>
      ${H.ambalajlar(d, { hepsi: true }).map((a) => html`<tr key=${a.id} class=${a.aktif === false ? 'silik' : ''}>
        <td><b>${a.ad}</b></td><td class="mono soluk">${a.id}</td>
        <td><input class="girdi" type="number" min="0" style="width:80px" value=${a.kritik ?? 5} onChange=${(e) => kaydet(a, { kritik: sayi(e.target.value) })} /></td>
        <td><label class="onay-kutu"><input type="checkbox" checked=${a.aktif !== false} onChange=${(e) => kaydet(a, { aktif: e.target.checked })} />${a.aktif !== false ? 'Görünür' : 'Gizli'}</label></td>
      </tr>`)}
      </tbody></table></div>
      <div class="kart-ic dugmeler" style="border-top:1px solid var(--cizgi)">
        <input class="girdi" style="max-width:160px" placeholder="Ad (örn: 2 L)" value=${yeni.ad} onInput=${(e) => setYeni({ ...yeni, ad: e.target.value })} />
        <input class="girdi" style="max-width:120px" placeholder="Litre (örn: 2)" inputmode="decimal" value=${yeni.litre} onInput=${(e) => setYeni({ ...yeni, litre: e.target.value })} />
        <button class="d" onClick=${ekle}><${Ikon} ad="arti" />Ambalaj ekle</button>
      </div>
    <//>`;
  }

  function FirmaBilgisi() {
    const d = depo();
    const a = NT.etiket.ayarlar();
    const kaydet = (k) => (e) => d.kaydet([{ c: 'ayar', k: 'genel', v: { [k]: e.target.value.trim() } }]);
    return html`<${Kart} baslik="Etiket bilgileri" aciklama="Gönderi (koli) etiketinde gönderen olarak basılır.">
      <div class="form-izgara">
        <${Alan} etiket="Firma unvanı" sinif="s6"><input class="girdi" value=${a.firmaAdi} onChange=${kaydet('firmaAdi')} /><//>
        <${Alan} etiket="Web" sinif="s6"><input class="girdi" value=${a.web} onChange=${kaydet('web')} /><//>
        <${Alan} etiket="Adres" sinif="s8"><input class="girdi" value=${a.adres} onChange=${kaydet('adres')} /><//>
        <${Alan} etiket="Telefon" sinif="s4"><input class="girdi" value=${a.telefon} onChange=${kaydet('telefon')} /><//>
      </div>
    <//>`;
  }

  function DosyaDugmesi({ yazi, ikon, kabul, fn }) {
    const g = useRef();
    return html`<button class="d" onClick=${() => g.current.click()}><${Ikon} ad=${ikon} />${yazi}</button>
      <input ref=${g} type="file" accept=${kabul} class="gizli" onChange=${async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await fn(f); }} />`;
  }

  function Yedek() {
    const d = depo();
    async function jsonOku(f) {
      try { return JSON.parse(await f.text()); } catch { throw new Error('Dosya okunamadı (geçerli JSON değil).'); }
    }
    return html`<${Kart} baslik="Yedek ve aktarım" aciklama="Kayıtlar bulutta durur; yine de ay sonlarında tam yedek indirip saklamanızı öneririz.">
      <div class="dugmeler">
        <button class="d" onClick=${() => { indir(`numune-takip-yedek-${bugun()}.json`, H.yedek(d), 'application/json'); bildir('Yedek indirildi.'); }}><${Ikon} ad="indir" />Tam yedek indir</button>
        <${DosyaDugmesi} yazi="Yedekten geri yükle" ikon="yukle" kabul=".json,application/json" fn=${async (f) => {
          try {
            const n = await H.yedektenYukle(d, await jsonOku(f));
            bildir(n ? `${n} hareket geri yüklendi.` : 'Yedekteki her şey zaten mevcut.');
          } catch (e) { bildir(e.message, { tur: 'hata' }); }
        }} />
        <${DosyaDugmesi} yazi="Eski sistemden aktar (numune_data.json)" ikon="yukle" kabul=".json,application/json" fn=${async (f) => {
          try {
            const veri = await jsonOku(f);
            if (!(await onayla(`Eski sistemden ${veri.purchases?.length ?? 0} alım, ${veri.fillings?.length ?? 0} dolum ve ${veri.shipments?.length ?? 0} sevkiyat GEÇMİŞ olarak aktarılacak: Gönderiler ve Geçmiş ekranlarında görünür, stoku değiştirmez (stok açılış sayımıyla başladı). Aynı dosyayı iki kez aktarmak kopya oluşturmaz.`, { baslik: 'Eski verileri aktar', evet: 'Geçmiş olarak aktar' }))) return;
            const s = await H.eskiVeriyiAktar(d, veri, { gecmis: true });
            bildir(`Aktarıldı: ${s.alim} alım, ${s.dolum} dolum, ${s.sevk} sevkiyat.`);
          } catch (e) { bildir(e.message, { tur: 'hata' }); }
        }} />
      </div>
      <p class="kucuk soluk" style="margin:12px 0 0">Eski AI Studio uygulamasında “JSON Tam Veritabanı Yedeği” ile indirdiğiniz veya ortak klasördeki <code>numune_data.json</code> dosyasını seçin.</p>
    <//>`;
  }

  function CopKutusu() {
    const d = depo();
    const silinen = ['dolum', 'sevk', 'alim', 'sayim'].flatMap((c) => d.kayitlar(c, { silinenler: true }).filter((r) => r._silindi).map((r) => ({ c, r })))
      .sort((a, b) => b.r._degisim - a.r._degisim);
    const AD = { dolum: 'Dolum', sevk: 'Sevkiyat', alim: 'Alım', sayim: 'Sayım' };
    return html`<${Kart} ic=${false} baslik="Çöp kutusu" aciklama="Silinen kayıtlar kalıcı olarak kaybolmaz; buradan geri alınabilir.">
      ${silinen.length ? html`<div class="tablo-kap" style="max-height:340px"><table class="tablo"><thead><tr><th>Kayıt</th><th>Tür</th><th>İçerik</th><th>Silen</th><th></th></tr></thead><tbody>
        ${silinen.map(({ c, r }) => html`<tr key=${r.id}><td><span class="etiket-kod">${r.no}</span></td><td>${AD[c]}</td>
          <td>${c === 'sevk' ? r.firma : c === 'alim' ? `${r.adet} × ${H.ambalajAdi(d, r.ambalaj)}` : `${r.adet ?? r.fark} × ${r.urun || ''} ${r.parti || ''} ${H.ambalajAdi(d, r.ambalaj)}`} <span class="soluk kucuk">· ${tarihYaz(r.tarih)}</span></td>
          <td>${r._degistiren} <span class="soluk kucuk">· ${onceYaz(r._degisim)}</span></td>
          <td class="sag"><button class="d kucuk-d" onClick=${async () => { await d.kaydet([{ op: 'undel', c, k: r.id }]); bildir(`${r.no} geri alındı.`); }}><${Ikon} ad="geri" boyut=${15} />Geri al</button></td></tr>`)}
      </tbody></table></div>` : html`<${BosDurum} ikon="cop" baslik="Çöp kutusu boş" />`}
    <//>`;
  }

  function Ayarlar() {
    return html`<${SayfaBasi} baslik="Ayarlar" aciklama="Buradaki ürün, ambalaj ve etiket ayarları tüm kullanıcılar için ortaktır." />
      <${Profil} /><${VeriKlasoru} /><${Urunler} /><${Ambalajlar} /><${FirmaBilgisi} /><${Yedek} /><${CopKutusu} />`;
  }

  NT.ekran.Ayarlar = Ayarlar;
})();
