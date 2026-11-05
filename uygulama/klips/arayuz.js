/* Klips Takip — arayüz: genel bakış, kayıtlar, sevkiyata göre liste, stok, ayarlar (pencereler `formlar.js`te). Satış kayıtları yalnızca okunur. */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, useState, useEffect, useMemo } = window.htmPreact;
  const { Ikon, Modal, Alan, BosDurum, bildir } = NT.ui;
  const K = NT.kabuk;
  const S = NT.klips;
  const { bugun, uid, tarihYaz, ara } = NT.c;
  const b = NT.baglanti;
  const depo = () => b.depo;
  const sayiYaz = (n) => K.sayiYaz(n);
  const tarihVeya = (t) => (t ? tarihYaz(t) : 'Tarih yok');

  const { TakanSec, useSevkler, KlipsCip, KartIzgara, sevkKalemleri, klipsTak, klipsTakSevk, ambalajAc } = NT.klipsUI;

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
    const saat = new Date().getHours();
    const adK = (b.kullanici || '').split(' ')[0];
    const kullanilan = s.toplam ? Math.round(((s.toplam - s.bosta.length) / s.toplam) * 100) : 0;
    return html`
      <${K.Selam} bant baslik=${`${saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar'}${adK ? ', ' + adK : ''}.`}
        sag=${html`<button class="d ana-d tz-buyuk" onClick=${() => klipsTak()}><${Ikon} ad="etiket" />Klips tak</button>`}>
        ${s.sirada ? html`Sıradaki klips <b class="v">${s.sirada}</b>. ` : ''}<b>${sayiYaz(s.takili)}</b> klips takılı, <b>${sayiYaz(s.bosta.length)}</b> klips boşta.
      <//>
      ${!s.toplam && html`<div class="uyari-kutu bilgi" style="margin-bottom:14px"><${Ikon} ad="bilgi" /><span>Klips numaraları tanımlı değil. <a href="#/stok">Stok sayfasından ekleyin →</a></span></div>`}
      ${s.cakisan.length > 0 && html`<div class="uyari-kutu yok" style="margin-bottom:14px"><${Ikon} ad="uyari" /><span>${s.cakisan.join(', ')} numarası iki kez girilmiş. <a href="#/kayitlar">Kayıtlara bak →</a></span></div>`}
      ${s.toplam > 0 && sinir > 0 && s.bosta.length <= sinir && html`<div class="uyari-kutu kritik" style="margin-bottom:14px"><${Ikon} ad="uyari" /><span>Boşta ${sayiYaz(s.bosta.length)} klips kaldı.</span></div>`}
      <div class="kpi-sira">
        <${K.Kpi} vurgu ikon="etiket" ad="Takılı" deger=${sayiYaz(s.takili)} alt=${`${d.kayitlar('ambalaj').length} ambalajda`} />
        <${K.Kpi} ikon="stok" ad="Boşta" deger=${sayiYaz(s.bosta.length)} alt=${s.sirada ? `Sıradaki ${s.sirada}` : 'Boş numara yok'} />
        <${K.Kpi} ikon="senkron" ad="Değiştirildi" deger=${sayiYaz(s.degisti)} alt="Kesilip yerine yenisi takılan" />
        <${K.Kpi} ikon="cop" ad="Fire" deger=${sayiYaz(s.fire)} alt="Kullanılamadan ıskartaya çıkan" />
      </div>
      <div class="tz-izgara">
        <div class="tz-sutun">
          <${K.Kart} baslik="Son takılanlar" sag=${html`<a href="#/kayitlar" style="color:var(--ana)">Tümü →</a>`}>
            ${son.length ? html`<${KartIzgara} liste=${son} />` : html`<p class="soluk" style="margin:0">Tarihli kayıt yok. “Klips tak” ile başlayın.</p>`}
          <//>
        </div>
        <div class="tz-sutun">
          ${s.toplam > 0 && html`<${K.Kart} baslik="Klips stoğu" sag=${html`<a href="#/stok" style="color:var(--ana)">Stok →</a>`}>
            <div class="km-doluluk" role="img" aria-label=${`Yüzde ${kullanilan} kullanıldı`}><span style=${{ width: `${kullanilan}%` }} /></div>
            <p class="soluk kucuk" style="margin:8px 0 0">${sayiYaz(s.toplam)} numaranın ${sayiYaz(s.toplam - s.bosta.length)} tanesi kullanıldı.</p>
          <//>`}
          ${klipssiz.length > 0 && html`<${K.Kart} baslik="Klipsi girilmemiş sevkiyatlar" sag=${html`<span class="km-eksik">${klipssiz.length} yolda</span>`}>
            <ul class="km-sevk-liste">${klipssiz.map((x) => html`<li key=${x.id}><span><b>${x.no}</b><small>${x.firma || ''}${sevkKalemleri(x) ? ' · ' + sevkKalemleri(x) : ''}</small></span>
              <button class="d kucuk-d" onClick=${() => klipsTakSevk(x)}><${Ikon} ad="arti" boyut=${14} />Klips</button></li>`)}</ul>
          <//>`}
          ${(eksikli.length > 0 || cakisan.length > 0) && html`<${K.Kart} baslik="Tamamlanacak kayıtlar">
            <p class="soluk" style="margin:0 0 8px">${eksikli.length} ambalajda tarih, sevkiyat veya ürün gibi bilgiler eksik.</p>
            <a href="#/kayitlar" style="color:var(--ana)" onClick=${() => { kayitSuzgec.deger = 'eksik'; }}>Eksikleri göster →</a>
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
    return html`<${K.Selam} baslik="Kayıtlar" sag=${html`<button class="d" onClick=${() => excelKayitlar(d, g[f], f === 'hepsi' && !q)}><${Ikon} ad="indir" boyut=${15} />Excel</button>
        <button class="d ana-d tz-buyuk" onClick=${() => klipsTak()}><${Ikon} ad="etiket" />Klips tak</button>`}>Klips numarası, ambalaj numarası, parti veya müşteriyle arayın.<//>
      <${K.Cipler} secenekler=${[['hepsi', 'Tümü', g.hepsi.length], ['eksik', 'Eksik bilgili', g.eksik.length], ['cakisan', 'Çakışan', g.cakisan.length]]} deger=${f} degis=${setF}>
        <input class="girdi km-ara" placeholder="Klips, ambalaj, parti, müşteri…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      <//>
      ${g[f].length ? html`<${KartIzgara} liste=${g[f]} />` : html`<div class="tz-kart"><p class="soluk" style="margin:0">Bu süzgeçte kayıt yok.</p></div>`}`;
  }

  /* ---------------- Sevkiyata göre ---------------- */
  function Sevkiyatlar() {
    const d = depo();
    const [q, setQ] = useState('');
    const c = new Set(S.stok(d).cakisan);
    const gruplar = S.sevkGruplari(d).filter((g) => !q.trim() || g.ambalajlar.some((a) => ara(ambalajMetni(d, a), q)));
    return html`<${K.Selam} baslik="Sevkiyata göre">Her sevkiyatın ambalajları ve klipsleri; listeyi Excel olarak alabilirsiniz.<//>
      <div class="tz-cipler"><input class="girdi km-ara" style="margin-left:0" placeholder="Sevkiyat, müşteri, klips…" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
      ${gruplar.length ? gruplar.map((g) => {
        const klipsSay = g.ambalajlar.reduce((t, a) => t + S.ambalajKlipsleri(d, a.id).filter((k) => k.durum === 'takili').length, 0);
        return html`<${K.Kart} key=${g.anahtar || 'yok'} baslik=${g.anahtar ? [g.sevkNo, g.firma].filter(Boolean).join(' · ') : 'Sevkiyatı girilmemiş'}
          sag=${html`<span class="soluk kucuk">${g.ambalajlar.length} ambalaj · ${klipsSay} klips</span>
            <button class="d kucuk-d" onClick=${() => excelSevk(d, g)}><${Ikon} ad="indir" boyut=${14} />Excel</button>`}>
          <div class="tablo-kap"><table class="tablo"><thead><tr><th>Ambalaj</th><th>Klipsler</th><th>Ürün</th><th>Parti</th><th>Tarih</th></tr></thead><tbody>
            ${g.ambalajlar.map((a) => html`<tr class="tik" key=${a.id} onClick=${() => ambalajAc(a)}><td><b>${a.numara || 'Numarasız'}</b></td>
              <td><div class="km-cipler">${S.ambalajKlipsleri(d, a.id).map((k) => html`<${KlipsCip} key=${k.id} k=${k} cakisan=${c.has(k.numara)} />`)}</div></td>
              <td>${a.urun || '—'}</td><td>${a.parti || '—'}</td><td>${a.tarih ? tarihYaz(a.tarih) : '—'}</td></tr>`)}
          </tbody></table></div>
        <//>`;
      }) : html`<div class="tz-kart"><p class="soluk" style="margin:0">Kayıt yok.</p></div>`}`;
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
      if (!bas || !bit) return setHata('Başlangıç ve bitiş numarasını yazın.');
      if (!kayit && !f.tarih) return setHata('Tarih seçin.');
      if (!kayit && !f.kisi.trim()) return setHata('Teslim alan kişiyi seçin.');
      if (+bit < +bas) return setHata('Bitiş numarası başlangıçtan küçük olamaz.');
      if (adet > S.ARALIK_SINIRI) return setHata(`Tek seferde en fazla ${S.ARALIK_SINIRI} numara eklenebilir.`);
      const cakisan = liste.find((a) => a.id !== (kayit && kayit.id) && +bas <= +a.bit && +bit >= +a.bas);
      if (cakisan) return setHata(`${cakisan.bas}–${cakisan.bit} aralığıyla çakışıyor.`);
      await d.kaydet([{ c: 'aralik', k: kayit ? kayit.id : uid(), v: { bas, bit, tarih: f.tarih, kisi: f.kisi.trim(), notlar: f.notlar.trim() } }]);
      bildir(`${bas}–${bit} kaydedildi · ${sayiYaz(adet)} klips.`);
      kapat();
      return undefined;
    }
    return html`<${Modal} dar baslik=${kayit ? 'Klips aralığı' : 'Yeni klips aralığı'} kapat=${kapat}
      alt=${html`<${K.FormAlt} kayit=${kayit} sil=${async () => (await K.sil('aralik', kayit, `${kayit.bas}–${kayit.bit} aralığı`)) && kapat()} kapat=${kapat} kaydet=${kaydet} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket="İlk numara" sinif="s6"><input class="girdi mono" inputmode="numeric" value=${f.bas} onInput=${s('bas')} /><//>
        <${Alan} etiket="Son numara" sinif="s6" ipucu=${adet ? `${sayiYaz(adet)} klips` : ''}><input class="girdi mono" inputmode="numeric" value=${f.bit} onInput=${s('bit')} autofocus=${!kayit} /><//>
        <${Alan} etiket="Alındığı tarih" sinif="s6"><input class="girdi" type="date" value=${f.tarih} onInput=${s('tarih')} /><//>
        <${Alan} etiket="Teslim alan" sinif="s6"><${TakanSec} etiket="Teslim alan" d=${d} deger=${f.kisi} degis=${(v) => setF((p) => ({ ...p, kisi: v }))} /><//>
        <${Alan} etiket="Not"><input class="girdi" value=${f.notlar} onInput=${s('notlar')} /><//>
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
      if (h || !liste.length) return setHata(h || 'Numara yazın.');
      if (ver && !f.neden.trim()) return setHata('Kime gönderildiğini yazın.');
      if (!f.tarih) return setHata('Tarih seçin.');
      if (!f.kisi.trim()) return setHata('Kişiyi seçin.');
      const st = S.stok(d);
      const kullanilan = liste.filter((n) => st.harita.has(n));
      if (kullanilan.length) return setHata(`${kullanilan.join(', ')} zaten kayıtlı. Takılı klips kesildiyse ambalaj kaydından “Değiştir” kullanın.`);
      await d.kaydet(liste.map((no) => ({ c: 'klips', k: uid(), v: { numara: no, ambalaj: '', durum: tur, tarih: f.tarih, neden: f.neden.trim(), takan: f.kisi.trim() } })));
      bildir(`${liste.length} klips ${ver ? 'verildi' : 'fire'} olarak işlendi.`);
      kapat();
      return undefined;
    }
    return html`<${Modal} dar baslik=${ver ? 'Başka firmaya ver' : 'Fire işle'} kapat=${kapat} alt=${html`<${K.FormAlt} kapat=${kapat} kaydet=${kaydet} kaydetYazi=${ver ? 'Verildi olarak kaydet' : 'Fire olarak kaydet'} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket="Klips numaraları" ipucu="Örn: 1-7, 9" hata=${hata}><input class="girdi mono" value=${f.metin} onInput=${s('metin')} autofocus /><//>
        <${Alan} etiket=${ver ? 'Kime gönderildi' : 'Neden'} sinif="s8"><input class="girdi" value=${f.neden} onInput=${s('neden')} placeholder=${ver ? 'Örn: Kor Kimya’ya gönderildi' : 'Örn: Takarken kırıldı'} /><//>
        <${Alan} etiket="Tarih" sinif="s4"><input class="girdi" type="date" value=${f.tarih} onInput=${s('tarih')} /><//>
        <${Alan} etiket="İşleyen kişi"><${TakanSec} etiket="İşleyen kişi" d=${d} deger=${f.kisi} degis=${(v) => setF((p) => ({ ...p, kisi: v }))} /><//>
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
    if (aktif == null) return html`<p class="soluk" style="margin:0">Henüz numara yok.</p>`;
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
          title=${h.l.length ? `${h.no} · ${S.DURUMLAR[h.l[0].durum] || ''}${ambalaj && ambalaj.numara ? ' · ' + ambalaj.numara : ''}${h.l[0].neden ? ' · ' + h.l[0].neden : ''}` : `${h.no} · Boşta`}>${h.no}</button>`;
      })}</div>
      <div class="km-anahtar"><span><i class="km-bos" />Boşta</span><span><i class="km-takili" />Takılı</span><span><i class="km-degisti" />Değiştirildi</span><span><i class="km-fire" />Fire</span><span><i class="km-verildi" />Verildi</span><span><i class="km-cakisan" />İki kez girilmiş</span></div>`;
  }
  function Stok() {
    const d = depo();
    const s = S.stok(d);
    const liste = S.araliklar(d);
    const fireler = d.kayitlar('klips').filter((k) => k.durum === 'fire').sort((a, c) => +a.numara - +c.numara);
    const verilen = S.verilenler(d);
    async function verilenGeriAl(g) {
      if (!(await NT.ui.onayla(`${g.araliklar.join(', ')} (${g.adet} klips) yeniden boşa düşsün mü? Ayarlar › Çöp kutusu’ndan geri alınabilir.`, { baslik: 'Geri al', evet: 'Geri al' }))) return;
      await d.kaydet(g.kayitlar.map((k) => ({ op: 'del', c: 'klips', k: k.id })));
      bildir(`${g.adet} klips yeniden boşta.`);
    }
    return html`<${K.Selam} baslik="Stok" sag=${html`<button class="d" onClick=${() => K.ac(FirePenceresi, {})}><${Ikon} ad="cop" boyut=${15} />Fire işle</button>
        <button class="d" onClick=${() => K.ac(FirePenceresi, { tur: 'verildi' })}><${Ikon} ad="sevk" boyut=${15} />Başka firmaya ver</button>
        <button class="d ana-d tz-buyuk" onClick=${() => K.ac(AralikPenceresi, {})}><${Ikon} ad="arti" />Yeni klips aralığı</button>`}>Stok kayıtlardan hesaplanır: tanımlı numaralardan takılı, değiştirilmiş, fire ve başka firmaya verilenler düşer.<//>
      <div class="kpi-sira">
        <${K.Kpi} vurgu ikon="stok" ad="Boşta" deger=${sayiYaz(s.bosta.length)} alt=${s.sirada ? `Sıradaki ${s.sirada}` : 'Boş numara yok'} />
        <${K.Kpi} ikon="etiket" ad="Takılı" deger=${sayiYaz(s.takili)} />
        <${K.Kpi} ikon="senkron" ad="Değiştirildi" deger=${sayiYaz(s.degisti)} />
        <${K.Kpi} ikon="cop" ad="Fire" deger=${sayiYaz(s.fire)} />
        ${s.verildi > 0 && html`<${K.Kpi} ikon="sevk" ad="Verildi" deger=${sayiYaz(s.verildi)} alt="Başka firmaya gönderilen" />`}
      </div>
      ${s.disinda.length > 0 && html`<div class="uyari-kutu bilgi" style="margin-bottom:14px"><${Ikon} ad="bilgi" /><span>Tanımlı aralık dışında kullanılan numaralar: ${s.disinda.join(', ')}</span></div>`}
      <${K.Kart} baslik="Numaralar"><${NumaraHaritasi} /><//>
      <div class="tz-izgara">
        <div class="tz-sutun">
          <${K.Kart} baslik="Klips aralıkları">
            ${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>Aralık</th><th class="sag">Adet</th><th>Tarih</th><th>Not</th></tr></thead><tbody>
              ${liste.map((a) => html`<tr class="tik" key=${a.id} onClick=${() => K.ac(AralikPenceresi, { kayit: a })}><td class="mono"><b>${a.bas}–${a.bit}</b></td><td class="sag sayi">${sayiYaz(+a.bit - +a.bas + 1)}</td><td>${a.tarih ? tarihYaz(a.tarih) : '—'}</td><td class="kucuk">${a.notlar || ''}</td></tr>`)}
            </tbody></table></div>` : html`<${BosDurum} ikon="stok" baslik="Aralık tanımlı değil" aciklama="Elinizdeki klipslerin ilk ve son numarasını girin." />`}
          <//>
        </div>
        <div class="tz-sutun">
          ${verilen.length > 0 && html`<${K.Kart} baslik="Başka firmaya verilenler">
            <div class="km-fire-liste">${verilen.map((g) => html`<div key=${g.neden} class="km-klips-satir">
              <span class="km-klips-bilgi"><b>${g.araliklar.join(', ')}</b><small>${g.neden} · ${sayiYaz(g.adet)} klips</small></span>
              <button type="button" class="d hayalet kucuk-d" onClick=${() => verilenGeriAl(g)}><${Ikon} ad="geri" boyut=${14} />Geri al</button></div>`)}</div>
          <//>`}
          <${K.Kart} baslik="Fire" sag=${html`<span class="soluk kucuk">${fireler.length} klips</span>`}>
            ${fireler.length ? html`<div class="km-fire-liste">${fireler.map((k) => html`<div key=${k.id} class="km-klips-satir">
              <${KlipsCip} k=${k} /><span class="km-klips-bilgi">${k.neden || 'Neden yazılmamış'}<small>${tarihVeya(k.tarih)}</small></span>
              <button type="button" class="d hayalet ikon-d" title="Yanlış girildiyse çıkar; numara boşa düşer" onClick=${() => K.sil('klips', k, `${k.numara} fire kaydı`)}><${Ikon} ad="cop" boyut=${15} /></button></div>`)}</div>` : html`<p class="soluk" style="margin:0">Fire yok.</p>`}
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
      bildir('Klips ayarları kaydedildi.');
    }
    return html`<${K.AyarKarti} baslik="Stok uyarısı" aciklama="Bu sistemi kullanan herkes için ortaktır." sag=${html`<button class="d ana-d kucuk-d" onClick=${kaydet}><${Ikon} ad="tik" boyut=${15} />Kaydet</button>`}>
      <div class="form-izgara"><${Alan} etiket="Boşta klips bu sayıya inince uyar" sinif="s6" ipucu="0 yazılırsa uyarı verilmez"><input class="girdi sayi" inputmode="numeric" value=${sinir} onInput=${(e) => setSinir(e.target.value)} /><//></div>
    <//>`;
  }
  function Ayarlar() {
    return html`<${K.AyarlarSayfasi} cop=${{
      ambalaj: { ad: 'Ambalaj', ozet: (r) => `${r.numara || 'Numarasız'}${r.parti ? ' · ' + r.parti : ''}` },
      klips: { ad: 'Klips', ozet: (r) => `${r.numara} · ${S.DURUMLAR[r.durum] || ''}` },
      aralik: { ad: 'Aralık', ozet: (r) => `${r.bas}–${r.bit}` },
    }}><${KlipsAyarlari} /><//>`;
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
  function excelSevk(d, g) {
    K.excel(`klipsler-${(g.sevkNo || g.firma || 'sevkiyatsiz').replace(/[^\p{L}\p{N}-]+/gu, '-')}.xlsx`, { sayfa: 'Klipsler', sutunlar: GENISLIK, baslik: BASLIK, satirlar: ambalajSatirlari(d, g.ambalajlar) });
  }

  /* ---------------- Arama ---------------- */
  function arama(d, q) {
    const l = [];
    for (const k of d.kayitlar('klips')) {
      if (ara(k.numara, q)) {
        const a = k.ambalaj ? d.kayit('ambalaj', k.ambalaj) : null;
        l.push({ tur: 'Klips', ad: k.numara, ek: `${S.DURUMLAR[k.durum] || ''}${a ? ' · ' + (a.numara || 'Numarasız') : ''}`, fn: () => (a ? ambalajAc(a) : (location.hash = '#/stok')) });
      }
    }
    for (const a of S.ambalajlar(d)) {
      if (ara(`${a.numara} ${a.urun} ${a.parti} ${a.firma} ${a.sevkNo}`, q)) l.push({ tur: 'Ambalaj', ad: a.numara || 'Numarasız', ek: [a.parti, a.firma].filter(Boolean).join(' · '), fn: () => ambalajAc(a) });
    }
    return l;
  }

  K.calistir({
    sekmeler: [
      { id: 'genel', ad: 'Genel Bakış', ikon: 'ozet' },
      { id: 'kayitlar', ad: 'Kayıtlar', ikon: 'etiket', sayac: (d) => S.cakisanAmbalajlar(d).length + S.eksikliAmbalajlar(d).length },
      { id: 'sevkiyatlar', ad: 'Sevkiyata göre', ikon: 'sevk' },
      { id: 'stok', ad: 'Stok', ikon: 'stok' },
      { id: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
    ],
    sayfalar: { genel: GenelBakis, kayitlar: Kayitlar, sevkiyatlar: Sevkiyatlar, stok: Stok, ayarlar: Ayarlar },
    eylemler: [
      { ad: 'Klips tak', alt: 'Sevkiyatın ambalajlarına klips gir', ikon: 'etiket', tus: 'K', fn: () => klipsTak() },
      { ad: 'Fire işle', alt: 'Kullanılamayan klipsi düş', ikon: 'cop', tus: 'F', fn: () => K.ac(FirePenceresi, {}) },
    ],
    arama,
    uzakKoleksiyonlar: ['ambalaj', 'klips', 'aralik'],
  });
})();
