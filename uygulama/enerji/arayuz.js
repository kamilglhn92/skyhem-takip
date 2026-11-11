/* Enerji — arayüz: genel bakış, kayıtlar, rapor (yıl × ay), ayarlar. Sistemi yalnız Kamil ve Farukcan görür ve kullanır. */
(function () {
  'use strict';
  const NT = window.NT;
  const cevir = NT.dil.t;
  const { html, useState } = window.htmPreact;
  const { Ikon, Modal, Alan, BosDurum, BelgeKutusu, GecmisBolumu, bildir } = NT.ui;
  const K = NT.kabuk;
  const E = NT.enerji;
  const { bugun, uid, sayi, tarihYaz, ara } = NT.c;
  const b = NT.baglanti;
  const depo = () => b.depo;
  K.yazmaKisitla({ gizli: true });
  const yaz = K.yazabilir;

  const usd = (n, basamak = 0) => E.dolar(n, basamak);
  const kw = (n) => `${K.sayiYaz(n)} kWh`;
  const fiyatYaz = (n, birim = '$/kWh') => (n == null ? '—' : `${K.sayiYaz(n, 3)} ${birim}`);
  const kesirli = (n) => K.sayiYaz(n, Math.abs(n - Math.round(n)) > 0.004 ? 2 : 0);
  const miktarYaz = (k) => `${kesirli(sayi(k.miktar))} ${E.BIRIM_YAZ[E.birimi(k)]}`;
  const girdiYaz = (v) => (v === '' || v == null ? '' : String(v).replace('.', ','));
  const yuzde = (o) => `${o >= 0 ? '+' : '−'}%${K.sayiYaz(Math.abs(o) * 100)}`;
  const cizgi = html`<span class="soluk">—</span>`;

  Object.assign(NT.ui.ALAN_ADLARI, { tip: 'Enerji tipi', miktar: 'Tüketim', birim: 'Birim', tutar: 'Tutar (USD)', belge: 'Belge', katsayi: 'Çevrim katsayısı (kWh/m³)', tedarikci: 'Tedarikçi' });
  NT.ui.DEGER_YAZ.tip = (v) => E.tipBul(v).ad;
  NT.ui.DEGER_YAZ.birim = (v) => E.BIRIM_YAZ[v] || v;

  const TipRozeti = ({ tip }) => { const t = E.tipBul(tip); return html`<span class=${'en-tip ' + t.id}><${Ikon} ad=${t.ikon} boyut=${14} />${t.ad}</span>`; };

  /* İki serili sütun grafik (elektrik + doğalgaz): yan yana ya da üst üste (yigin). veri: [{ anahtar, ad, a, b, ipucu }] */
  function IkiSeri({ veri, yigin, olcekYaz = (n) => n, yukseklik = 210 }) {
    const en = Math.max(1e-9, ...veri.map((x) => (yigin ? x.a + x.b : Math.max(x.a, x.b))));
    const bos = veri.every((x) => !(x.a > 0) && !(x.b > 0));
    const h = (n) => (n > 0 ? Math.max(2, (n / en) * (yukseklik - 46)) : 0);
    return html`<div class="en-grafik">
      <div class="gr-lejant">${E.TIPLER.map((t) => html`<span><i class="gr-kare" style=${{ background: t.renk }} />${t.ad}</span>`)}</div>
      <div class=${'en-sutunlar' + (yigin ? ' yigin' : '')} style=${{ height: yukseklik + 'px' }}>
        <div class="en-izgara">${[1, 0.5, 0].map((o) => html`<div style=${{ bottom: `calc(${o} * (100% - 46px) + 22px)` }}><span>${bos ? '' : olcekYaz(en * o)}</span></div>`)}</div>
        ${bos && html`<div class="gr-bos">${cevir("Henüz veri yok")}</div>`}
        ${veri.map((x) => html`<div class="en-sutun" key=${x.anahtar} title=${x.ipucu}>
          <span class="en-cubuklar"><i class="a" style=${{ height: h(x.a) + 'px' }} /><i class="b" style=${{ height: h(x.b) + 'px' }} /></span>
          <span class="gr-ad">${x.ad}</span>
        </div>`)}
      </div>
    </div>`;
  }

  /* ---------------- Kayıt penceresi ---------------- */
  function KayitFormu({ kayit, kapat }) {
    const d = depo();
    const a = E.ayar(d);
    const [f, setF] = useState(() => (kayit
      ? { tarih: kayit.tarih || '', tip: kayit.tip || 'elektrik', miktar: girdiYaz(kayit.miktar), birim: E.birimi(kayit), tutar: girdiYaz(kayit.tutar), notlar: kayit.notlar || '', belge: kayit.belge || [] }
      : { tarih: bugun(), tip: 'elektrik', miktar: '', birim: 'kWh', tutar: '', notlar: '', belge: [] }));
    const [denendi, setDenendi] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const g = (k) => (e) => s(k)(e.target.value);
    const tipSec = (tip) => setF((p) => ({ ...p, tip, birim: tip === 'dogalgaz' ? (p.tip === 'dogalgaz' ? p.birim : 'm3') : 'kWh' }));
    const gaz = f.tip === 'dogalgaz';
    const miktarVar = String(f.miktar).trim() !== '', tutarVar = String(f.tutar).trim() !== '';
    const taslak = { id: kayit && kayit.id, tarih: f.tarih, tip: f.tip, miktar: sayi(f.miktar), birim: f.birim, tutar: sayi(f.tutar) };
    const kat = sayi(a.katsayi);
    const e = E.kwh(taslak, kat), hacim = E.m3(taslak, kat);
    const uyarilar = miktarVar && tutarVar ? E.uyarilar(d, taslak) : E.uyarilar(d, { ...taslak, tutar: 0 });
    const hata = { tarih: !f.tarih && 'Tarih seçin', miktar: (!miktarVar && 'Tüketimi yazın (yoksa 0)') || (sayi(f.miktar) < 0 && 'Eksi olamaz'), tutar: (!tutarVar && 'Tutarı yazın (yoksa 0)') || (sayi(f.tutar) < 0 && 'Eksi olamaz') };
    async function kaydet() {
      setDenendi(true);
      if (hata.tarih || hata.miktar || hata.tutar) return;
      const no = (kayit && kayit.no) || K.yeniNo(d, 'kayit', 'EN', f.tarih);
      await d.kaydet([{ c: 'kayit', k: kayit ? kayit.id : uid(), v: { no, tarih: f.tarih, tip: f.tip, miktar: sayi(f.miktar), birim: gaz ? f.birim : 'kWh', tutar: sayi(f.tutar), notlar: f.notlar.trim(), belge: f.belge } }]);
      bildir(kayit ? `${no} güncellendi.` : `${no} kaydedildi: ${E.ayAdi(f.tarih.slice(0, 7))} ${E.tipBul(f.tip).ad.toLocaleLowerCase('tr')}.`);
      kapat();
    }
    return html`<${Modal} baslik=${kayit ? `${kayit.no || 'Kayıt'} · ${E.tipBul(kayit.tip).ad}` : 'Enerji kaydı ekle'} kapat=${kapat}
      alt=${html`<${K.FormAlt} kayit=${kayit} sil=${async () => (await K.sil('kayit', kayit, `${kayit.no || 'Kayıt'}`)) && kapat()} kapat=${kapat} kaydet=${kaydet} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(ev) => { ev.preventDefault(); kaydet(); }}>
        <div class="s12 en-tipler">${E.TIPLER.map((t) => html`<button type="button" class=${'en-tip-sec ' + t.id + (f.tip === t.id ? ' secili' : '')} onClick=${() => tipSec(t.id)}>
          <${Ikon} ad=${t.ikon} boyut=${22} /><span><b>${t.ad}</b><small>${t.id === 'dogalgaz' ? 'm³ ya da kWh ile girilir' : 'kWh ile girilir'}</small></span></button>`)}</div>
        <${Alan} etiket="Fatura / sayaç okuma tarihi" sinif="s4" ipucu="Ayı dönem sayılır" hata=${denendi && hata.tarih}><input class="girdi" type="date" value=${f.tarih} onInput=${g('tarih')} /><//>
        <${Alan} etiket=${cevir("Tüketim")} sinif="s4" hata=${denendi && hata.miktar}>
          <div class="en-miktar"><input class="girdi sayi" inputmode="decimal" value=${f.miktar} onInput=${g('miktar')} autofocus=${!kayit} placeholder="0" />
            ${gaz ? html`<div class="segment">${['m3', 'kWh'].map((x) => html`<button type="button" class=${f.birim === x ? 'secili' : ''} onClick=${() => s('birim')(x)}>${E.BIRIM_YAZ[x]}</button>`)}</div>` : html`<span class="en-birim">kWh</span>`}</div><//>
        <${Alan} etiket="Tutar (USD)" sinif="s4" hata=${denendi && hata.tutar}><input class="girdi sayi" inputmode="decimal" value=${f.tutar} onInput=${g('tutar')} placeholder="0,00" /><//>
        <div class="s12 en-serit">
          ${gaz && html`<div><small>${f.birim === 'm3' ? 'kWh eşdeğeri' : 'm³ karşılığı'}</small><b>${miktarVar ? (f.birim === 'm3' ? kw(e) : `${kesirli(hacim)} m³`) : '—'}</b><span>1 m³ = ${K.sayiYaz(kat, 2)} kWh</span></div>`}
          <div><small>${cevir("Birim fiyat")}</small><b>${miktarVar && tutarVar && e > 0 ? fiyatYaz(sayi(f.tutar) / e) : '—'}</b><span>${gaz && miktarVar && tutarVar && hacim > 0 ? fiyatYaz(sayi(f.tutar) / hacim, '$/m³') : 'tutar ÷ tüketim'}</span></div>
          <div><small>${cevir("Dönem")}</small><b>${f.tarih ? E.ayAdi(f.tarih.slice(0, 7)) : '—'}</b><span>${a.tedarikci || ''}</span></div>
        </div>
        ${uyarilar.map((u) => html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${u}</span></div>`)}
        <div class="s12"><${BelgeKutusu} baslik="Sayaç okuma belgesi / fatura" ekler=${f.belge} degis=${s('belge')} ipucu="PDF veya fotoğraf; rakamın kaynağı kaydın yanında dursun" /></div>
        <${Alan} etiket=${cevir("Not")}><input class="girdi" value=${f.notlar} onInput=${g('notlar')} placeholder="Örn: Yüksek tüketim, sayaç değişti" /><//>
        ${kayit && html`<${GecmisBolumu} kayit=${kayit} />`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const kayitAc = (kayit) => K.ac(KayitFormu, { kayit });
  const yeniKayit = () => K.ac(KayitFormu, {});
  const EkleDugmesi = () => yaz() && html`<button class="d ana-d tz-buyuk" onClick=${yeniKayit}><${Ikon} ad="arti" />${cevir("Kayıt ekle")}</button>`;

  /* ---------------- Genel bakış ---------------- */
  function GenelBakis() {
    const d = depo();
    const s = E.son12(d);
    const saat = new Date().getHours();
    const adK = (b.kullanici || '').split(' ')[0];
    const selam = `${cevir(saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar')}${adK ? ', ' + adK : ''}.`;
    if (!s) return html`<${K.Selam} bant baslik=${selam} sag=${html`<${EkleDugmesi} />`}>${cevir("Henüz enerji kaydı yok.")}<//>
      <${K.Kart}><${BosDurum} ikon="simsek" baslik=${cevir("Kayıt yok")} aciklama="Elektrik ve doğalgaz faturalarını girdikçe tüketim, maliyet ve birim fiyat burada görünür." /><//>`;
    const l = E.aylar(d);
    const a = E.ayar(d);
    const eksik = E.eksikAy(d, l);
    const t = s.toplam, o = s.onceki;
    const son24 = E.pencere(l, s.bitis, 24);
    const sonKayitlar = E.satirlar(d, a).slice(-6).reverse();
    const yillar = E.yillar(d);
    return html`
      <${K.Selam} bant baslik=${selam} sag=${html`<${EkleDugmesi} />`}>
        ${E.ayAdi(s.baslangic)} – ${E.ayAdi(s.bitis)} arasında <b class="v">${usd(t.usd)}</b> enerji gideri.
        ${eksik > 0 ? html` <b>${eksik} ayın</b> kaydı girilmedi.` : ' Kayıtlar güncel.'}
      <//>
      <div class="kpi-sira">
        <${K.Kpi} vurgu ikon="fatura" ad="Toplam maliyet · son 12 ay" deger=${usd(t.usd)} alt=${s.degisim == null ? 'Önceki 12 ayda kayıt yok' : `Önceki 12 aya göre ${yuzde(s.degisim)} (${usd(o.usd)})`} />
        <${K.Kpi} ikon="rapor" ad="Toplam enerji" deger=${K.sayiYaz(t.kwh)} birim="kWh" alt="Elektrik + doğalgaz eşdeğeri" />
        <${K.Kpi} ikon="simsek" ad="Elektrik" deger=${s.elFiyat == null ? '—' : K.sayiYaz(s.elFiyat, 3)} birim="$/kWh" alt=${`${kw(t.elektrik.kwh)} · ${usd(t.elektrik.usd)}`} />
        <${K.Kpi} ikon="alev" ad="Doğalgaz" deger=${s.gazFiyat == null ? '—' : K.sayiYaz(s.gazFiyat, 3)} birim="$/kWh" alt=${`${K.sayiYaz(t.dogalgaz.m3)} m³ · ${fiyatYaz(s.gazFiyatM3, '$/m³')}`} />
      </div>
      <div class="tz-izgara">
        <div class="tz-sutun">
          <${K.Kart} baslik="Birim fiyat ($/kWh) · son 24 ay" sag=${html`<a href="#/rapor" style="color:var(--ana)">${cevir("Rapor →")}</a>`}>
            <${IkiSeri} olcekYaz=${(n) => K.sayiYaz(n, 2)} veri=${son24.map((x, i) => { const ef = x.elektrik.kwh > 0 ? x.elektrik.usd / x.elektrik.kwh : 0, gf = x.dogalgaz.kwh > 0 ? x.dogalgaz.usd / x.dogalgaz.kwh : 0;
              return { anahtar: x.ay, ad: i % 3 === 0 ? E.ayKisa(x.ay) : '', a: ef, b: gf, ipucu: `${E.ayAdi(x.ay)}: elektrik ${ef ? fiyatYaz(ef) : 'yok'} · doğalgaz ${gf ? fiyatYaz(gf) : 'yok'}` }; })} />
            <p class="soluk kucuk" style="margin:10px 0 0">Tüketim olmayan ayda sütun çizilmez. Doğalgazın $/kWh değeri satın alınan yakıt enerjisinin fiyatıdır; kazan verimi dahil değildir.</p>
          <//>
          <${K.Kart} baslik="Aylık maliyet (USD) · son 12 ay">
            <${IkiSeri} yigin olcekYaz=${(n) => K.sayiYaz(n)} veri=${s.aylar.map((x) => ({ anahtar: x.ay, ad: E.AY_KISA[+x.ay.slice(5, 7) - 1], a: x.elektrik.usd, b: x.dogalgaz.usd,
              ipucu: `${E.ayAdi(x.ay)}: ${x.n ? `elektrik ${usd(x.elektrik.usd)} · doğalgaz ${usd(x.dogalgaz.usd)} · toplam ${usd(x.usd)}` : 'kayıt yok'}` }))} />
          <//>
        </div>
        <div class="tz-sutun">
          <${K.Kart} baslik=${cevir("Durum")}>
            <div class="en-durum">
              <div><span class=${'rozet ' + (eksik ? 'kritik' : 'iyi')}><${Ikon} ad=${eksik ? 'saat' : 'daire_tik'} />${eksik ? `${eksik} ay girilmedi` : 'Güncel'}</span><span>Son kayıt ${E.ayAdi(s.bitis)}</span></div>
              <div><span class="rozet"><${Ikon} ad="liste" />${t.n} kayıt</span><span>son 12 ayda; önceki 12 ayda ${o.n}${o.n < t.n * 0.75 ? '. Eksik dönemde yüzde değişim yanıltıcı olabilir' : ''}</span></div>
              <div><span class="rozet"><${Ikon} ad="ayar" />1 m³ = ${K.sayiYaz(sayi(a.katsayi), 2)} kWh</span><a href="#/ayarlar" style="color:var(--ana)">${cevir("Değiştir →")}</a></div>
            </div>
          <//>
          <${K.Kart} baslik=${cevir("Son kayıtlar")} sag=${html`<a href="#/kayitlar" style="color:var(--ana)">${cevir("Tümü →")}</a>`}>
            <ul class="tz-akis">${sonKayitlar.map((x) => html`<li onClick=${() => kayitAc(x.k)}>
              <span class=${'ik en-ik ' + x.k.tip}><${Ikon} ad=${E.tipBul(x.k.tip).ikon} /></span>
              <span class="ne"><b>${E.ayAdi(x.ay)} · ${E.tipBul(x.k.tip).ad}</b><small>${miktarYaz(x.k)}${x.fiyat != null ? ' · ' + fiyatYaz(x.fiyat) : ''}</small></span>
              <span class="miktar">${usd(x.usd, 2)}</span></li>`)}</ul>
          <//>
          <${K.Kart} baslik=${cevir("Yıllık karşılaştırma")}>
            <div class="tablo-kap"><table class="tablo"><thead><tr><th>${cevir("Yıl")}</th><th class="sag">Elek. $/kWh</th><th class="sag">Gaz $/m³</th><th class="sag">${cevir("Toplam")}</th></tr></thead><tbody>
              ${yillar.map((y) => html`<tr><td><b>${y.yil}</b></td><td class="sag sayi">${y.elFiyat == null ? cizgi : K.sayiYaz(y.elFiyat, 3)}</td>
                <td class="sag sayi">${y.gazFiyatM3 == null ? cizgi : K.sayiYaz(y.gazFiyatM3, 3)}</td><td class="sag sayi"><b>${usd(y.usd)}</b></td></tr>`)}
            </tbody></table></div>
          <//>
        </div>
      </div>`;
  }

  /* ---------------- Kayıtlar ---------------- */
  function Kayitlar() {
    const d = depo();
    const [tip, setTip] = useState('hepsi');
    const [yil, setYil] = useState('hepsi');
    const [q, setQ] = useState('');
    const tum = E.satirlar(d);
    const yillar = [...new Set(tum.map((x) => x.ay.slice(0, 4)))].sort().reverse();
    const suz = tum.filter((x) => (yil === 'hepsi' || x.ay.startsWith(yil)) && ara(`${x.k.no || ''} ${E.ayAdi(x.ay)} ${tarihYaz(x.k.tarih)} ${E.tipBul(x.k.tip).ad} ${x.k.notlar || ''}`, q));
    const liste = suz.filter((x) => tip === 'hepsi' || x.k.tip === tip).reverse();
    const eksik = E.eksikAy(d);
    const son = E.sonAy(d);
    const top = E.topla(E.aylar(d, liste));
    return html`<${K.Selam} baslik=${cevir("Kayıtlar")} sag=${html`${liste.length > 0 && html`<button class="d" onClick=${() => excelKayitlar(d, liste)}><${Ikon} ad="indir" boyut=${15} />Excel</button>`}<${EkleDugmesi} />`}>
        Her fatura ya da sayaç okuma belgesi bir kayıttır. Satıra tıklayıp düzeltin; doğalgazda girilen birimin karşılığı kendiliğinden hesaplanır.<//>
      ${eksik > 0 && html`<div class="uyari-kutu kritik" style="margin-bottom:14px"><${Ikon} ad="saat" /><span><b>${eksik} ayın kaydı girilmedi.</b> Son kayıt ${E.ayAdi(son)}; sonraki ayların faturalarını ekleyin.</span></div>`}
      <${K.Cipler} secenekler=${[['hepsi', 'Tümü', suz.length], ...E.TIPLER.map((t) => [t.id, t.ad, suz.filter((x) => x.k.tip === t.id).length])]} deger=${tip} degis=${setTip}>
        <select class="girdi kisa" style="margin-left:8px;min-width:110px" value=${yil} onChange=${(e) => setYil(e.target.value)}><option value="hepsi">Bütün yıllar</option>${yillar.map((y) => html`<option value=${y}>${y}</option>`)}</select>
        <input class="girdi" style="max-width:260px;margin-left:8px;border-radius:99px" placeholder="No, dönem, not…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      <//>
      <${K.Kart}>
        ${liste.length ? html`<div class="tablo-kap"><table class="tablo en-tablo"><thead><tr><th>No</th><th>${cevir("Dönem")}</th><th>${cevir("Tür")}</th><th class="sag">${cevir("Tüketim")}</th><th class="sag">kWh</th><th class="sag">${cevir("Tutar")}</th><th class="sag">${cevir("Birim fiyat")}</th><th>${cevir("Belge")}</th><th>${cevir("Not")}</th></tr></thead><tbody>
          ${liste.map((x) => html`<tr class="tik" key=${x.k.id} onClick=${() => kayitAc(x.k)}>
            <td><span class="etiket-kod">${x.k.no || '—'}</span></td><td><b>${E.ayAdi(x.ay)}</b> <span class="soluk kucuk">${tarihYaz(x.k.tarih)}</span></td><td><${TipRozeti} tip=${x.k.tip} /></td>
            <td class="sag sayi">${miktarYaz(x.k)}</td><td class="sag sayi soluk">${K.sayiYaz(x.kwh)}</td><td class="sag sayi"><b>${usd(x.usd, 2)}</b></td>
            <td class="sag sayi">${x.fiyat == null ? cizgi : html`${K.sayiYaz(x.fiyat, 3)}${x.k.tip === 'dogalgaz' && x.m3 > 0 ? html` <span class="soluk kucuk">· ${K.sayiYaz(x.usd / x.m3, 3)} $/m³</span>` : ''}`}</td>
            <td>${(x.k.belge || []).length ? html`<span class="rozet iyi"><${Ikon} ad="belge" />${cevir("Var")}</span>` : html`<span class="soluk kucuk">${cevir("Yok")}</span>`}</td>
            <td class="kucuk">${x.k.notlar || ''}</td></tr>`)}
          <tr><td colspan="4"><b>${cevir("Toplam")}</b> <span class="soluk kucuk">${liste.length} kayıt</span></td><td class="sag sayi"><b>${K.sayiYaz(top.kwh)}</b></td><td class="sag sayi"><b>${usd(top.usd, 2)}</b></td><td class="sag sayi">${top.kwh > 0 ? K.sayiYaz(top.usd / top.kwh, 3) : ''}</td><td></td><td></td></tr>
        </tbody></table></div>` : html`<${BosDurum} ikon="simsek" baslik=${cevir("Bu süzgeçte kayıt yok")} />`}
      <//>`;
  }

  /* ---------------- Rapor: yıllık tablo + yıl × ay ---------------- */
  function Matris({ baslik, satirlar, renk, yazdir = (n) => K.sayiYaz(n) }) {
    const en = Math.max(1e-9, ...satirlar.flatMap((r) => r.aylar.map((v) => v || 0)));
    return html`<${K.Kart} baslik=${baslik}>
      <div class="tablo-kap"><table class="tablo en-matris"><thead><tr><th>${cevir("Yıl")}</th>${E.AY_KISA.map((m) => html`<th class="sag">${m}</th>`)}<th class="sag">${cevir("Toplam")}</th></tr></thead><tbody>
        ${satirlar.map((r) => html`<tr><td><b>${r.yil}</b></td>${r.aylar.map((v) => html`<td class="sag sayi" style=${v > 0 ? { background: `color-mix(in srgb, ${renk} ${Math.round(8 + (v / en) * 42)}%, transparent)` } : null}>${v == null ? html`<span class="soluk">–</span>` : yazdir(v)}</td>`)}
          <td class="sag sayi"><b>${yazdir(r.toplam)}</b></td></tr>`)}
      </tbody></table></div>
    <//>`;
  }
  function Rapor() {
    const d = depo();
    const yillar = E.yillar(d);
    if (!yillar.length) return html`<${K.Selam} baslik=${cevir("Rapor")}>Kayıt girildikçe yıllık ve aylık tablolar burada oluşur.<//><${K.Kart}><${BosDurum} ikon="rapor" baslik=${cevir("Kayıt yok")} /><//>`;
    const a = E.ayar(d);
    return html`<${K.Selam} baslik=${cevir("Rapor")} sag=${html`<button class="d" onClick=${() => excelAylik(d)}><${Ikon} ad="indir" boyut=${15} />Excel</button>`}>
        Yıllara ve aylara göre tüketim, maliyet ve birim fiyat. Tablolarda “–” o ay kayıt olmadığını, 0 kayıt olup tüketim olmadığını gösterir.<//>
      <div class="tz-sutun"><${K.Kart} baslik=${cevir("Yıllık karşılaştırma")}>
        <div class="tablo-kap"><table class="tablo en-tablo"><thead><tr><th>${cevir("Yıl")}</th><th class="sag">Elektrik kWh</th><th class="sag">Elektrik USD</th><th class="sag">$/kWh</th><th class="sag">Doğalgaz m³</th><th class="sag">Doğalgaz USD</th><th class="sag">$/m³</th><th class="sag">$/kWh</th><th class="sag">Toplam kWh</th><th class="sag">Toplam USD</th><th class="sag">${cevir("Kayıt")}</th></tr></thead><tbody>
          ${yillar.map((y) => html`<tr><td><b>${y.yil}</b></td><td class="sag sayi">${K.sayiYaz(y.elektrik.kwh)}</td><td class="sag sayi">${usd(y.elektrik.usd)}</td><td class="sag sayi">${y.elFiyat == null ? cizgi : K.sayiYaz(y.elFiyat, 3)}</td>
            <td class="sag sayi">${K.sayiYaz(y.dogalgaz.m3)}</td><td class="sag sayi">${usd(y.dogalgaz.usd)}</td><td class="sag sayi">${y.gazFiyatM3 == null ? cizgi : K.sayiYaz(y.gazFiyatM3, 3)}</td><td class="sag sayi">${y.gazFiyat == null ? cizgi : K.sayiYaz(y.gazFiyat, 3)}</td>
            <td class="sag sayi">${K.sayiYaz(y.kwh)}</td><td class="sag sayi"><b>${usd(y.usd)}</b></td><td class="sag sayi soluk">${y.n}</td></tr>`)}
        </tbody></table></div>
        <p class="soluk kucuk" style="margin:10px 0 0">Doğalgaz kWh eşdeğeri: 1 m³ = ${K.sayiYaz(sayi(a.katsayi), 2)} kWh (Ayarlar’dan değişir). Doğalgazın $/kWh değeri yakıt enerjisinin fiyatıdır; kazan verimi dahil değildir.</p>
      <//>
      <${Matris} baslik=${cevir("Elektrik tüketimi (kWh)")} renk="var(--gr-1)" satirlar=${E.matris(d, (x) => (x.elektrik.n ? x.elektrik.kwh : null))} />
      <${Matris} baslik=${cevir("Doğalgaz tüketimi (m³)")} renk="var(--gr-2)" satirlar=${E.matris(d, (x) => (x.dogalgaz.n ? x.dogalgaz.m3 : null))} />
      <${Matris} baslik=${cevir("Toplam maliyet (USD)")} renk="var(--ana)" satirlar=${E.matris(d, (x) => x.usd)} /></div>`;
  }

  /* ---------------- Ayarlar ---------------- */
  function EnerjiAyarlari() {
    const d = depo();
    const [f, setF] = useState(() => { const a = E.ayar(d); return { tedarikci: a.tedarikci, katsayi: girdiYaz(a.katsayi) }; });
    const s = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
    const gecerli = sayi(f.katsayi) > 0;
    async function kaydet() {
      if (!gecerli) { bildir('Katsayı sıfırdan büyük olmalı.', { tur: 'hata' }); return; }
      await d.kaydet([{ c: 'ayar', k: 'genel', v: { tedarikci: f.tedarikci.trim(), katsayi: sayi(f.katsayi) } }]);
      bildir('Enerji ayarları kaydedildi.');
    }
    return html`<${K.AyarKarti} baslik="Tedarikçi ve çevrim" aciklama="Bu sistemi kullanan herkes için ortaktır." sag=${yaz() && html`<button class="d ana-d kucuk-d" onClick=${kaydet}><${Ikon} ad="tik" boyut=${15} />${cevir("Kaydet")}</button>`}>
      <div class="form-izgara">
        <${Alan} etiket=${cevir("Tedarikçi")} sinif="s6"><input class="girdi" value=${f.tedarikci} onInput=${s('tedarikci')} placeholder="Elektrik ve doğalgazı faturalayan kurum" /><//>
        <${Alan} etiket="Çevrim katsayısı (kWh / m³)" sinif="s6" ipucu="1 m³ doğalgaz kaç kWh eder. Faturalamada kullanılan standart değer 10,64; belgede farklı yazıyorsa onu girin. Değişince bütün doğalgaz kayıtları yeniden hesaplanır."
          hata=${!gecerli && 'Sıfırdan büyük bir sayı yazın'}><input class="girdi sayi" inputmode="decimal" value=${f.katsayi} onInput=${s('katsayi')} /><//>
      </div>
    <//>`;
  }
  function Ayarlar() {
    return html`<${K.AyarlarSayfasi} cop=${{ kayit: { ad: 'Enerji kaydı', ozet: (r) => `${r.tarih ? E.ayAdi(r.tarih.slice(0, 7)) : ''} · ${E.tipBul(r.tip).ad} · ${usd(sayi(r.tutar), 2)}` } }}><${EnerjiAyarlari} /><//>`;
  }

  /* ---------------- Excel ---------------- */
  const metin = (v, hiza) => ({ v: v ?? '', tur: 'metin', hiza });
  const tarihH = (v) => (v ? { v, tur: 'tarih' } : metin(''));
  const sayiH = (v) => (v === '' || v == null ? metin('') : { v: Number(v) || 0, tur: 'sayi' });
  const yuvarla = (n, b = 4) => (n == null ? null : Math.round(n * 10 ** b) / 10 ** b);
  function excelKayitlar(d, liste) {
    K.excel(`enerji-kayitlari-${bugun()}.xlsx`, {
      sayfa: 'Enerji kayıtları',
      sutunlar: [14, 12, 14, 11, 11, 8, 11, 10, 12, 11, 11, 8, 34, 18].map((genislik) => ({ genislik })),
      baslik: ['No', 'Tarih', 'Dönem', 'Enerji tipi', 'Tüketim', 'Birim', 'kWh', 'm³', 'Tutar USD', '$/kWh', '$/m³', 'Belge', 'Not', 'Giren'],
      satirlar: [...liste].reverse().map((x) => ({ hucreler: [metin(x.k.no || ''), tarihH(x.k.tarih), metin(E.ayAdi(x.ay)), metin(E.tipBul(x.k.tip).ad), sayiH(sayi(x.k.miktar)), metin(E.BIRIM_YAZ[E.birimi(x.k)]),
        sayiH(yuvarla(x.kwh, 2)), sayiH(yuvarla(x.m3, 2)), sayiH(x.usd), sayiH(yuvarla(x.fiyat)), sayiH(x.m3 > 0 ? yuvarla(x.usd / x.m3) : null), metin((x.k.belge || []).length ? 'Var' : 'Yok'), metin(x.k.notlar || '', 'sol'), metin(x.k._olusturan || x.k._degistiren || '')] })),
    });
  }
  function excelAylik(d) {
    const bolum = (a, c) => (c > 0 ? yuvarla(a / c) : null);
    K.excel(`enerji-aylik-${bugun()}.xlsx`, {
      sayfa: 'Enerji aylık',
      sutunlar: [14, 12, 12, 10, 12, 12, 12, 10, 10, 12, 12].map((genislik) => ({ genislik })),
      baslik: ['Dönem', 'Elektrik kWh', 'Elektrik USD', 'Elektrik $/kWh', 'Doğalgaz m³', 'Doğalgaz kWh', 'Doğalgaz USD', 'Doğalgaz $/m³', 'Doğalgaz $/kWh', 'Toplam kWh', 'Toplam USD'],
      satirlar: E.aylar(d).map((x) => ({ hucreler: [metin(E.ayAdi(x.ay)), x.elektrik.n ? sayiH(yuvarla(x.elektrik.kwh, 2)) : metin(''), x.elektrik.n ? sayiH(x.elektrik.usd) : metin(''), sayiH(bolum(x.elektrik.usd, x.elektrik.kwh)),
        x.dogalgaz.n ? sayiH(yuvarla(x.dogalgaz.m3, 2)) : metin(''), x.dogalgaz.n ? sayiH(yuvarla(x.dogalgaz.kwh, 2)) : metin(''), x.dogalgaz.n ? sayiH(x.dogalgaz.usd) : metin(''), sayiH(bolum(x.dogalgaz.usd, x.dogalgaz.m3)), sayiH(bolum(x.dogalgaz.usd, x.dogalgaz.kwh)),
        sayiH(yuvarla(x.kwh, 2)), sayiH(yuvarla(x.usd, 2))] })),
    });
  }

  /* ---------------- Arama ---------------- */
  function arama(d, q) {
    return E.satirlar(d).filter((x) => ara(`${x.k.no || ''} ${E.ayAdi(x.ay)} ${E.tipBul(x.k.tip).ad} ${x.k.notlar || ''}`, q)).reverse()
      .map((x) => ({ tur: E.tipBul(x.k.tip).ad, ad: `${x.k.no || ''} · ${E.ayAdi(x.ay)}`, ek: `${miktarYaz(x.k)} · ${usd(x.usd, 2)}`, fn: () => kayitAc(x.k) }));
  }

  NT.enerjiUI = { KayitFormu, IkiSeri };
  K.calistir({
    sekmeler: [
      { id: 'genel', ad: 'Genel Bakış', ikon: 'ozet' },
      { id: 'kayitlar', ad: 'Kayıtlar', ikon: 'simsek', sayac: (d) => E.eksikAy(d) },
      { id: 'rapor', ad: 'Rapor', ikon: 'rapor' },
      { id: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
    ],
    sayfalar: { genel: GenelBakis, kayitlar: Kayitlar, rapor: Rapor, ayarlar: Ayarlar },
    eylemler: [{ ad: 'Kayıt ekle', alt: 'Elektrik veya doğalgaz faturası', ikon: 'arti', tus: 'K', fn: yeniKayit }],
    arama,
    uzakKoleksiyonlar: ['kayit'],
  });
})();
