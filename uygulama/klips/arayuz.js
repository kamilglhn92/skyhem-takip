/* Klipsler — Satış Takip içindeki sayfa (2026-11-09, sekreter kararı: ayrı Klips Takip modülü kaldırıldı).
   Alt bölümler: genel bakış, kayıtlar, stok, ayarlar (pencereler `formlar.js`te). Kayıtlar Satış'ın klips bağlantısıyla
   `olaylar_klips` tablosuna yazılır; klipsi herkes girer. Eski Klips Takip adresi Satış › Klipsler'e yönlenir. */
(function () {
  'use strict';
  const NT = window.NT;
  const cevir = NT.dil.t;
  const { html, useState, useEffect, useMemo } = window.htmPreact;
  const { Ikon, Modal, Alan, BosDurum, bildir } = NT.ui;
  const K = NT.kabuk;
  const S = NT.klips;
  const { bugun, uid, tarihYaz, ara } = NT.c;
  const b = NT.baglanti;
  // Eski Klips Takip adresi (yer imi, kısayol) açılırsa Satış › Klipsler'e git.
  if (b.modul && b.modul.id === 'klips') { location.replace(NT.c.adres('satis') + '#/klipsler'); return; }
  const depo = () => NT.klipsUI.depo();
  const sayiYaz = (n) => K.sayiYaz(n);
  const tarihVeya = (t) => (t ? tarihYaz(t) : 'Tarih yok');

  const { TakanSec, useSevkler, KlipsCip, KartIzgara, sevkKalemleri, klipsTak, klipsTakSevk, ambalajAc, FormAlt, sil } = NT.klipsUI;

  /* Alt bölüm seçimi (sayfa içi; Satış'ın adres çubuğu #/klipsler kalır). */
  const alt = { deger: 'genel', dinle: new Set() };
  const git = (x) => (e) => { if (e) e.preventDefault(); alt.deger = x; alt.dinle.forEach((f) => f()); };

  /* ---------------- Genel Bakış ---------------- */
  function GenelBakis() {
    const d = depo();
    const sevkler = useSevkler();
    const s = S.stok(d);
    const son = S.ambalajlar(d).filter((a) => a.tarih).slice(0, 6);
    const eksikli = S.eksikliAmbalajlar(d);
    const cakisan = S.cakisanAmbalajlar(d);
    const sinir = S.ayar(d).uyariSiniri;
    const bagliSevk = new Set(d.kayitlar('ambalaj').flatMap((a) => [a.sevk, a.sevkNo]).filter(Boolean));
    const klipssiz = sevkler.filter((x) => x.durum === 'Yolda' && !bagliSevk.has(x.id) && !bagliSevk.has(x.no));
    const kullanilan = s.toplam ? Math.round(((s.toplam - s.bosta.length) / s.toplam) * 100) : 0;
    return html`
      <${K.Selam} baslik=${cevir("Klipsler")}
        sag=${html`<button class="d ana-d tz-buyuk" onClick=${() => klipsTak()}><${Ikon} ad="etiket" />${cevir("Klips tak")}</button>`}>
        ${s.sirada ? html`${cevir("Sıradaki klips")} <b class="v">${s.sirada}</b>. ` : ''}<b>${sayiYaz(s.takili)}</b> ${cevir("klips takılı,")} <b>${sayiYaz(s.bosta.length)}</b> ${cevir("klips boşta.")}
      <//>
      ${!s.toplam && html`<div class="uyari-kutu bilgi" style="margin-bottom:14px"><${Ikon} ad="bilgi" /><span>${cevir("Klips numaraları tanımlı değil.")} <a href="#" onClick=${git('stok')}>${cevir("Stok bölümünden ekleyin →")}</a></span></div>`}
      ${s.cakisan.length > 0 && html`<div class="uyari-kutu yok" style="margin-bottom:14px"><${Ikon} ad="uyari" /><span>${s.cakisan.join(', ')} ${cevir("numarası iki kez girilmiş.")} <a href="#" onClick=${git('kayitlar')}>${cevir("Kayıtlara bak →")}</a></span></div>`}
      ${s.toplam > 0 && sinir > 0 && s.bosta.length <= sinir && html`<div class="uyari-kutu kritik" style="margin-bottom:14px"><${Ikon} ad="uyari" /><span>${cevir("Boşta")} ${sayiYaz(s.bosta.length)} ${cevir("klips kaldı.")}</span></div>`}
      <div class="kpi-sira">
        <${K.Kpi} vurgu ikon="etiket" ad="Takılı" deger=${sayiYaz(s.takili)} alt=${NT.dil.m("{0} ambalajda", d.kayitlar('ambalaj').length)} />
        <${K.Kpi} ikon="stok" ad="Boşta" deger=${sayiYaz(s.bosta.length)} alt=${s.sirada ? NT.dil.m("Sıradaki {0}", s.sirada) : cevir("Boş numara yok")} />
        <${K.Kpi} ikon="senkron" ad="Değiştirildi" deger=${sayiYaz(s.degisti)} alt=${cevir("Kesilip yerine yenisi takılan")} />
        <${K.Kpi} ikon="cop" ad="Fire" deger=${sayiYaz(s.fire)} alt="Kullanılamadan ıskartaya çıkan" />
      </div>
      <div class="tz-izgara">
        <div class="tz-sutun">
          <${K.Kart} baslik=${cevir("Son takılanlar")} sag=${html`<a href="#" style="color:var(--ana)" onClick=${git('kayitlar')}>${cevir("Tümü →")}</a>`}>
            ${son.length ? html`<${KartIzgara} liste=${son} />` : html`<p class="soluk" style="margin:0">${cevir("Tarihli kayıt yok. “Klips tak” ile başlayın.")}</p>`}
          <//>
        </div>
        <div class="tz-sutun">
          ${s.toplam > 0 && html`<${K.Kart} baslik=${cevir("Klips stoğu")} sag=${html`<a href="#" style="color:var(--ana)" onClick=${git('stok')}>${cevir("Stok →")}</a>`}>
            <div class="km-doluluk" role="img" aria-label=${NT.dil.m("Yüzde {0} kullanıldı", kullanilan)}><span style=${{ width: `${kullanilan}%` }} /></div>
            <p class="soluk kucuk" style="margin:8px 0 0">${sayiYaz(s.toplam)} ${cevir("numaranın")} ${sayiYaz(s.toplam - s.bosta.length)} ${cevir("tanesi kullanıldı.")}</p>
          <//>`}
          ${klipssiz.length > 0 && html`<${K.Kart} baslik=${cevir("Klipsi girilmemiş sevkiyatlar")} sag=${html`<span class="km-eksik">${klipssiz.length} ${cevir("yolda")}</span>`}>
            <ul class="km-sevk-liste">${klipssiz.map((x) => html`<li key=${x.id}><span><b>${x.no}</b><small>${x.firma || ''}${sevkKalemleri(x) ? ' · ' + sevkKalemleri(x) : ''}</small></span>
              <button class="d kucuk-d" onClick=${() => klipsTakSevk(x)}><${Ikon} ad="arti" boyut=${14} />${cevir("Klips")}</button></li>`)}</ul>
          <//>`}
          ${(eksikli.length > 0 || cakisan.length > 0) && html`<${K.Kart} baslik=${cevir("Tamamlanacak kayıtlar")}>
            <p class="soluk" style="margin:0 0 8px">${eksikli.length} ${cevir("ambalajda tarih, sevkiyat veya ürün gibi bilgiler eksik.")}</p>
            <a href="#" style="color:var(--ana)" onClick=${(e) => { kayitSuzgec.deger = 'eksik'; git('kayitlar')(e); }}>${cevir("Eksikleri göster →")}</a>
          <//>`}
        </div>
      </div>`;
  }

  /* ---------------- Kayıtlar ---------------- */
  const kayitSuzgec = { deger: 'hepsi' };
  const ambalajMetni = (d, a) => `${a.numara} ${a.tur} ${a.urun} ${a.parti} ${a.firma} ${a.sevkNo} ${a.takan} ${a.notlar} ${tarihYaz(a.tarih)} ${S.ambalajKlipsleri(d, a.id).map((k) => k.numara).join(' ')}`;
  function Kayitlar() {
    const d = depo();
    const [f, setF] = useState(kayitSuzgec.deger);
    const [q, setQ] = useState('');
    useEffect(() => { kayitSuzgec.deger = 'hepsi'; }, []);
    const uygun = (l) => l.filter((a) => ara(ambalajMetni(d, a), q));
    const g = { hepsi: uygun(S.ambalajlar(d)), eksik: uygun(S.eksikliAmbalajlar(d)), cakisan: uygun(S.cakisanAmbalajlar(d)) };
    return html`<${K.Selam} baslik=${cevir("Kayıtlar")} sag=${html`<button class="d" onClick=${() => excelKayitlar(d, g[f], f === 'hepsi' && !q)}><${Ikon} ad="indir" boyut=${15} />Excel</button>
        <button class="d ana-d tz-buyuk" onClick=${() => klipsTak()}><${Ikon} ad="etiket" />${cevir("Klips tak")}</button>`}>${cevir("Klips numarası, ambalaj numarası, parti veya müşteriyle arayın.")}<//>
      <${K.Cipler} secenekler=${[['hepsi', 'Tümü', g.hepsi.length], ['eksik', 'Eksik bilgili', g.eksik.length], ['cakisan', 'Çakışan', g.cakisan.length]]} deger=${f} degis=${setF}>
        <input class="girdi km-ara" placeholder=${cevir("Klips, ambalaj, parti, müşteri…")} value=${q} onInput=${(e) => setQ(e.target.value)} />
      <//>
      ${g[f].length ? html`<${KartIzgara} liste=${g[f]} />` : html`<div class="tz-kart"><p class="soluk" style="margin:0">${cevir("Bu süzgeçte kayıt yok.")}</p></div>`}`;
  }

  /* ---------------- Stok ---------------- */
  function AralikPenceresi({ kayit, kapat }) {
    const d = depo();
    const liste = S.araliklar(d);
    const enBuyuk = liste.reduce((t, a) => Math.max(t, +a.bit), 0);
    const [f, setF] = useState(kayit ? { bas: kayit.bas, bit: kayit.bit, tarih: kayit.tarih || '', kisi: kayit.kisi || '', notlar: kayit.notlar || '' } : { bas: S.klipsNo(enBuyuk + 1), bit: '', tarih: bugun(), kisi: '', notlar: '' });
    const [hata, setHata] = useState('');
    const s = (a) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [a]: v })); };
    const bas = S.klipsNo(f.bas);
    const bit = S.klipsNo(f.bit);
    const adet = bas && bit && +bit >= +bas ? +bit - +bas + 1 : 0;
    async function kaydet() {
      if (!bas || !bit) return setHata(cevir("Başlangıç ve bitiş numarasını yazın."));
      if (!kayit && !f.tarih) return setHata(cevir("Tarih seçin."));
      if (!kayit && !f.kisi.trim()) return setHata(cevir("Teslim alan kişiyi seçin."));
      if (+bit < +bas) return setHata(cevir("Bitiş numarası başlangıçtan küçük olamaz."));
      if (adet > S.ARALIK_SINIRI) return setHata(NT.dil.m("Tek seferde en fazla {0} numara eklenebilir.", S.ARALIK_SINIRI));
      const cakisan = liste.find((a) => a.id !== (kayit && kayit.id) && +bas <= +a.bit && +bit >= +a.bas);
      if (cakisan) return setHata(NT.dil.m("{0}–{1} aralığıyla çakışıyor.", cakisan.bas, cakisan.bit));
      await d.kaydet([{ c: 'aralik', k: kayit ? kayit.id : uid(), v: { bas, bit, tarih: f.tarih, kisi: f.kisi.trim(), notlar: f.notlar.trim() } }]);
      bildir(NT.dil.m("{0}–{1} kaydedildi · {2} klips.", bas, bit, sayiYaz(adet)));
      kapat();
      return undefined;
    }
    return html`<${Modal} dar baslik=${kayit ? cevir("Klips aralığı") : cevir("Yeni klips aralığı")} kapat=${kapat}
      alt=${html`<${FormAlt} kayit=${kayit} sil=${async () => (await sil('aralik', kayit, `${kayit.bas}–${kayit.bit} aralığı`)) && kapat()} kapat=${kapat} kaydet=${kaydet} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket=${cevir("İlk numara")} sinif="s6"><input class="girdi mono" inputmode="numeric" value=${f.bas} onInput=${s('bas')} /><//>
        <${Alan} etiket=${cevir("Son numara")} sinif="s6" ipucu=${adet ? NT.dil.m("{0} klips", sayiYaz(adet)) : ''}><input class="girdi mono" inputmode="numeric" value=${f.bit} onInput=${s('bit')} autofocus=${!kayit} /><//>
        <${Alan} etiket=${cevir("Alındığı tarih")} sinif="s6"><input class="girdi" type="date" value=${f.tarih} onInput=${s('tarih')} /><//>
        <${Alan} etiket=${cevir("Teslim alan")} sinif="s6"><${TakanSec} etiket=${cevir("Teslim alan")} d=${d} deger=${f.kisi} degis=${(v) => setF((p) => ({ ...p, kisi: v }))} /><//>
        <${Alan} etiket=${cevir("Not")}><input class="girdi" value=${f.notlar} onInput=${s('notlar')} /><//>
        ${hata && html`<div class="s12 hata-yazi">${hata}</div>`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  /* tur: fire = kullanılamadan ıskarta; verildi = başka firmaya gönderildi (ikisi de stoktan düşer). */
  function FirePenceresi({ kapat, tur = 'fire' }) {
    const ver = tur === 'verildi';
    const d = depo();
    const [f, setF] = useState({ metin: '', neden: '', tarih: bugun(), kisi: '' });
    const [hata, setHata] = useState('');
    const s = (a) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [a]: v })); };
    async function kaydet() {
      const { liste, hata: h } = S.numaraListesi(f.metin);
      if (h || !liste.length) return setHata(h || cevir("Numara yazın."));
      if (ver && !f.neden.trim()) return setHata(cevir("Kime gönderildiğini yazın."));
      if (!f.tarih) return setHata(cevir("Tarih seçin."));
      if (!f.kisi.trim()) return setHata(cevir("Kişiyi seçin."));
      const st = S.stok(d);
      const kullanilan = liste.filter((n) => st.harita.has(n));
      if (kullanilan.length) return setHata(NT.dil.m("{0} zaten kayıtlı. Takılı klips kesildiyse ambalaj kaydından “Değiştir” kullanın.", kullanilan.join(', ')));
      await d.kaydet(liste.map((no) => ({ c: 'klips', k: uid(), v: { numara: no, ambalaj: '', durum: tur, tarih: f.tarih, neden: f.neden.trim(), takan: f.kisi.trim() } })));
      bildir(NT.dil.m("{0} klips {1} olarak işlendi.", liste.length, ver ? 'verildi' : 'fire'));
      kapat();
      return undefined;
    }
    return html`<${Modal} dar baslik=${ver ? cevir("Başka firmaya ver") : cevir("Fire işle")} kapat=${kapat} alt=${html`<${FormAlt} kapat=${kapat} kaydet=${kaydet} kaydetYazi=${ver ? cevir("Verildi olarak kaydet") : cevir("Fire olarak kaydet")} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket=${cevir("Klips numaraları")} ipucu=${cevir("Örn: 1-7, 9")} hata=${hata}><input class="girdi mono" value=${f.metin} onInput=${s('metin')} autofocus /><//>
        <${Alan} etiket=${ver ? cevir("Kime gönderildi") : cevir("Neden")} sinif="s8"><input class="girdi" value=${f.neden} onInput=${s('neden')} placeholder=${ver ? cevir("Örn: Kor Kimya’ya gönderildi") : cevir("Örn: Takarken kırıldı")} /><//>
        <${Alan} etiket=${cevir("Tarih")} sinif="s4"><input class="girdi" type="date" value=${f.tarih} onInput=${s('tarih')} /><//>
        <${Alan} etiket=${cevir("İşleyen kişi")}><${TakanSec} etiket=${cevir("İşleyen kişi")} d=${d} deger=${f.kisi} degis=${(v) => setF((p) => ({ ...p, kisi: v }))} /><//>
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  /* Yüzlük sayfalarla bütün numaraların durumu: boşta, takılı, değiştirildi, fire, çakışan. */
  function NumaraHaritasi() {
    const d = depo();
    const s = S.stok(d);
    const sayfalar = useMemo(() => [...new Set([...s.aralikNo, ...[...s.harita.keys()].map(Number)].map((n) => Math.floor((n - 1) / 100)))].sort((a, c) => a - c), [d.surum]);
    const baslangic = s.sirada ? Math.floor((+s.sirada - 1) / 100) : sayfalar[0];
    const [sayfa, setSayfa] = useState(baslangic);
    const aktif = sayfalar.includes(sayfa) ? sayfa : sayfalar[0];
    if (aktif == null) return html`<p class="soluk" style="margin:0">${cevir("Henüz numara yok.")}</p>`;
    const hucreler = [];
    for (let i = aktif * 100 + 1; i <= aktif * 100 + 100; i++) {
      const no = String(i).padStart(5, '0');
      const l = s.harita.get(no) || [];
      if (!l.length && !s.aralikNo.has(i)) continue;
      hucreler.push({ no, l, sinif: l.length > 1 ? 'km-cakisan' : l.length ? `km-${l[0].durum}` : 'km-bos' });
    }
    return html`
      <div class="km-sayfa-sec">${sayfalar.map((p) => html`<button type="button" key=${p} class=${'tz-cip' + (p === aktif ? ' secili' : '')} onClick=${() => setSayfa(p)}>${String(p * 100 + 1).padStart(5, '0')}–${String(p * 100 + 100).padStart(5, '0')}</button>`)}</div>
      <div class="km-harita">${hucreler.map((h) => {
        const ambalaj = h.l[0] && h.l[0].ambalaj ? d.kayit('ambalaj', h.l[0].ambalaj) : null;
        return html`<button type="button" key=${h.no} class=${`km-hucre ${h.sinif}`} disabled=${!ambalaj} onClick=${() => ambalaj && ambalajAc(ambalaj)}
          title=${h.l.length ? `${h.no} · ${S.DURUMLAR[h.l[0].durum] || ''}${ambalaj && ambalaj.numara ? ' · ' + ambalaj.numara : ''}${h.l[0].neden ? ' · ' + h.l[0].neden : ''}` : NT.dil.m("{0} · Boşta", h.no)}>${h.no}</button>`;
      })}</div>
      <div class="km-anahtar"><span><i class="km-bos" />${cevir("Boşta")}</span><span><i class="km-takili" />${cevir("Takılı")}</span><span><i class="km-degisti" />${cevir("Değiştirildi")}</span><span><i class="km-fire" />${cevir("Fire")}</span><span><i class="km-verildi" />${cevir("Verildi")}</span><span><i class="km-cakisan" />${cevir("İki kez girilmiş")}</span></div>`;
  }
  function Stok() {
    const d = depo();
    const s = S.stok(d);
    const liste = S.araliklar(d);
    const fireler = d.kayitlar('klips').filter((k) => k.durum === 'fire').sort((a, c) => +a.numara - +c.numara);
    const verilen = S.verilenler(d);
    async function verilenGeriAl(g) {
      if (!(await NT.ui.onayla(`${g.araliklar.join(', ')} (${g.adet} klips) yeniden boşa düşsün mü? Klipsler › Ayarlar › Çöp kutusu’ndan geri alınabilir.`, { baslik: 'Geri al', evet: 'Geri al' }))) return;
      await d.kaydet(g.kayitlar.map((k) => ({ op: 'del', c: 'klips', k: k.id })));
      bildir(NT.dil.m("{0} klips yeniden boşta.", g.adet));
    }
    return html`<${K.Selam} baslik=${cevir("Stok")} sag=${html`<button class="d" onClick=${() => K.ac(FirePenceresi, {})}><${Ikon} ad="cop" boyut=${15} />${cevir("Fire işle")}</button>
        <button class="d" onClick=${() => K.ac(FirePenceresi, { tur: 'verildi' })}><${Ikon} ad="sevk" boyut=${15} />${cevir("Başka firmaya ver")}</button>
        <button class="d ana-d tz-buyuk" onClick=${() => K.ac(AralikPenceresi, {})}><${Ikon} ad="arti" />${cevir("Yeni klips aralığı")}</button>`}>${cevir("Stok kayıtlardan hesaplanır: tanımlı numaralardan takılı, değiştirilmiş, fire ve başka firmaya verilenler düşer.")}<//>
      <div class="kpi-sira">
        <${K.Kpi} vurgu ikon="stok" ad="Boşta" deger=${sayiYaz(s.bosta.length)} alt=${s.sirada ? NT.dil.m("Sıradaki {0}", s.sirada) : cevir("Boş numara yok")} />
        <${K.Kpi} ikon="etiket" ad="Takılı" deger=${sayiYaz(s.takili)} />
        <${K.Kpi} ikon="senkron" ad="Değiştirildi" deger=${sayiYaz(s.degisti)} />
        <${K.Kpi} ikon="cop" ad="Fire" deger=${sayiYaz(s.fire)} />
        ${s.verildi > 0 && html`<${K.Kpi} ikon="sevk" ad="Verildi" deger=${sayiYaz(s.verildi)} alt=${cevir("Başka firmaya gönderilen")} />`}
      </div>
      ${s.disinda.length > 0 && html`<div class="uyari-kutu bilgi" style="margin-bottom:14px"><${Ikon} ad="bilgi" /><span>${cevir("Tanımlı aralık dışında kullanılan numaralar:")} ${s.disinda.join(', ')}</span></div>`}
      <${K.Kart} baslik=${cevir("Numaralar")}><${NumaraHaritasi} /><//>
      <div class="tz-izgara">
        <div class="tz-sutun">
          <${K.Kart} baslik=${cevir("Klips aralıkları")}>
            ${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>${cevir("Aralık")}</th><th class="sag">${cevir("Adet")}</th><th>${cevir("Tarih")}</th><th>${cevir("Not")}</th></tr></thead><tbody>
              ${liste.map((a) => html`<tr class="tik" key=${a.id} onClick=${() => K.ac(AralikPenceresi, { kayit: a })}><td class="mono"><b>${a.bas}–${a.bit}</b></td><td class="sag sayi">${sayiYaz(+a.bit - +a.bas + 1)}</td><td>${a.tarih ? tarihYaz(a.tarih) : '—'}</td><td class="kucuk">${a.notlar || ''}</td></tr>`)}
            </tbody></table></div>` : html`<${BosDurum} ikon="stok" baslik=${cevir("Aralık tanımlı değil")} aciklama=${cevir("Elinizdeki klipslerin ilk ve son numarasını girin.")} />`}
          <//>
        </div>
        <div class="tz-sutun">
          ${verilen.length > 0 && html`<${K.Kart} baslik=${cevir("Başka firmaya verilenler")}>
            <div class="km-fire-liste">${verilen.map((g) => html`<div key=${g.neden} class="km-klips-satir">
              <span class="km-klips-bilgi"><b>${g.araliklar.join(', ')}</b><small>${g.neden} · ${sayiYaz(g.adet)} ${cevir("klips")}</small></span>
              <button type="button" class="d hayalet kucuk-d" onClick=${() => verilenGeriAl(g)}><${Ikon} ad="geri" boyut=${14} />${cevir("Geri al")}</button></div>`)}</div>
          <//>`}
          <${K.Kart} baslik=${cevir("Fire")} sag=${html`<span class="soluk kucuk">${fireler.length} ${cevir("klips")}</span>`}>
            ${fireler.length ? html`<div class="km-fire-liste">${fireler.map((k) => html`<div key=${k.id} class="km-klips-satir">
              <${KlipsCip} k=${k} /><span class="km-klips-bilgi">${k.neden || cevir("Neden yazılmamış")}<small>${tarihVeya(k.tarih)}</small></span>
              <button type="button" class="d hayalet ikon-d" title=${cevir("Yanlış girildiyse çıkar; numara boşa düşer")} onClick=${() => sil('klips', k, `${k.numara} fire kaydı`)}><${Ikon} ad="cop" boyut=${15} /></button></div>`)}</div>` : html`<p class="soluk" style="margin:0">${cevir("Fire yok.")}</p>`}
          <//>
        </div>
      </div>`;
  }

  /* ---------------- Ayarlar ---------------- */
  function KlipsAyarlari() {
    const d = depo();
    const [sinir, setSinir] = useState(String(S.ayar(d).uyariSiniri));
    async function kaydet() {
      await d.kaydet([{ c: 'ayar', k: 'genel', v: { uyariSiniri: Math.max(0, Number(sinir) || 0) } }]);
      bildir(cevir("Klips ayarları kaydedildi."));
    }
    return html`<${K.AyarKarti} baslik=${cevir("Stok uyarısı")} aciklama=${cevir("Bu sistemi kullanan herkes için ortaktır.")} sag=${html`<button class="d ana-d kucuk-d" onClick=${kaydet}><${Ikon} ad="tik" boyut=${15} />${cevir("Kaydet")}</button>`}>
      <div class="form-izgara"><${Alan} etiket=${cevir("Boşta klips bu sayıya inince uyar")} sinif="s6" ipucu=${cevir("0 yazılırsa uyarı verilmez")}><input class="girdi sayi" inputmode="numeric" value=${sinir} onInput=${(e) => setSinir(e.target.value)} /><//></div>
    <//>`;
  }
  function Ayarlar() {
    return html`<${KlipsAyarlari} />
      <${K.CopKutusu} depo=${depo()} turler=${{
        ambalaj: { ad: 'Ambalaj', ozet: (r) => `${r.numara || 'Numarasız'}${r.parti ? ' · ' + r.parti : ''}` },
        klips: { ad: 'Klips', ozet: (r) => `${r.numara} · ${S.DURUMLAR[r.durum] || ''}` },
        aralik: { ad: 'Aralık', ozet: (r) => `${r.bas}–${r.bit}` },
      }} />`;
  }

  /* ---------------- Excel: her klips bir satır ---------------- */
  const metin = (v, hiza) => ({ v: v ?? '', tur: 'metin', hiza });
  const tarihH = (v) => (v ? { v, tur: 'tarih' } : metin(''));
  const BASLIK = ['Klips no', 'Durum', 'Ambalaj türü', 'Ambalaj no', 'Ürün', 'Parti', 'Sevkiyat no', 'Müşteri', 'Tarih', 'Takan', 'Yerine takılan / takıldığı', 'Neden / not'];
  const GENISLIK = [11, 13, 12, 18, 16, 16, 15, 28, 12, 18, 16, 34].map((genislik) => ({ genislik }));
  const satirYap = (k, a) => ({ cizili: k.durum === 'fire', hucreler: [metin(k.numara), metin(S.DURUMLAR[k.durum] || ''), metin(a ? a.tur : ''), metin(a ? a.numara : ''), metin(a ? a.urun : ''), metin(a ? a.parti : ''), metin(a ? a.sevkNo : ''),
    metin(a ? a.firma : '', 'sol'), tarihH(k.durum === 'degisti' ? k.cikisTarihi || k.tarih : k.tarih), metin(k.takan || (a && a.takan) || ''), metin(k.yerine || k.eskisi || ''), metin([k.neden, a && a.notlar].filter(Boolean).join(' · '), 'sol')] });
  function ambalajSatirlari(d, liste) {
    return liste.flatMap((a) => S.ambalajKlipsleri(d, a.id).map((k) => satirYap(k, a)));
  }
  function excelKayitlar(d, liste, fireIle) {
    const fire = fireIle ? d.kayitlar('klips').filter((k) => !k.ambalaj).sort((a, c) => +a.numara - +c.numara).map((k) => satirYap(k, null)) : [];
    const satirlar = [...ambalajSatirlari(d, liste), ...fire].sort((x, y) => (x.hucreler[0].v < y.hucreler[0].v ? -1 : 1));
    K.excel(`klipsler-${bugun()}.xlsx`, { sayfa: 'Klipsler', sutunlar: GENISLIK, baslik: BASLIK, satirlar });
  }

  /* ---------------- Satış › Klipsler sayfası ---------------- */
  const BOLUMLER = [['genel', 'Genel bakış'], ['kayitlar', 'Kayıtlar'], ['stok', 'Stok'], ['ayarlar', 'Ayarlar']];
  const SAYFA = { genel: GenelBakis, kayitlar: Kayitlar, stok: Stok, ayarlar: Ayarlar };
  function KlipslerSayfasi() {
    const [, y] = useState(0);
    useEffect(() => { const f = () => y((x) => x + 1); alt.dinle.add(f); NT.klipsUI.bagBaslat(); return () => alt.dinle.delete(f); }, []);
    const bag = NT.klipsUI.bag;
    if (bag.durum === 'hata') return html`<div class="uyari-kutu yok"><${Ikon} ad="uyari" /><span>${bag.hata}</span></div>`;
    if (!bag.d) return html`<p class="soluk">${cevir("Klips kayıtları yükleniyor…")}</p>`;
    const d = depo();
    const uyari = S.cakisanAmbalajlar(d).length + S.eksikliAmbalajlar(d).length;
    const B = SAYFA[alt.deger] || GenelBakis;
    return html`<${K.Cipler} secenekler=${BOLUMLER.map(([id, ad]) => [id, ad, id === 'kayitlar' && uyari ? uyari : null])} deger=${alt.deger} degis=${(x) => git(x)()} />
      <${B} />`;
  }
  /* Satış menüsündeki sayaç: çakışan + eksik bilgili ambalaj (klips bağlantısı hazırsa). */
  const sayac = () => (NT.klipsUI.bag.d ? S.cakisanAmbalajlar(NT.klipsUI.bag.d).length + S.eksikliAmbalajlar(NT.klipsUI.bag.d).length : 0);
  NT.klipsSayfa = { KlipslerSayfasi, sayac, klipsTak, fireIsle: () => K.ac(FirePenceresi, {}) };
})();
