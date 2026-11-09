/*
 * Klips Takip — kayıt pencereleri. İki modül aynı dosyayı kullanır:
 *   Klips Takip: kendi deposuyla çalışır, Satış'ı yalnızca okur.
 *   Satış Takip: sevkiyat kartından klips girer; kayıt doğrudan Klips Takip'in tablosuna (olaylar_klips) yazılır,
 *                bu yüzden tek liste ve tek stok vardır. Satış'ın kendi kayıtlarına klips yazılmaz.
 */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, useState, useEffect } = window.htmPreact;
  const { Ikon, Modal, Alan, Oneri, Ekler, GecmisBolumu, bildir, onayla } = NT.ui;
  const K = NT.kabuk;
  const S = NT.klips;
  const { bugun, uid, tarihYaz, ara } = NT.c;
  const b = NT.baglanti;
  /* cfg.depo: klipslerin yazıldığı depo; cfg.useSevkler: sevkiyat listesi (Satış içinde kendi deposu). */
  const cfg = { depo: () => b.depo, useSevkler: null };
  const depo = () => cfg.depo();
  const tarihVeya = (t) => (t ? tarihYaz(t) : 'Tarih yok');
  /* Klipsi herkes girer (2026-11-05 kararı): pencere alt düğmeleri Satış'ın yazma kısıtına takılmaz. */
  const FormAlt = (p) => K.FormAlt({ ...p, serbest: true });
  /* Çöp kutusuna gönderir; K.sil modülün kendi deposunda çalıştığı için burada ayrıca yazılıdır. */
  async function sil(c, r, ad) {
    if (!(await onayla(`${ad} silinsin mi? Numara yeniden boşa düşer; Satış › Klipsler › Ayarlar bölümündeki çöp kutusundan geri alınabilir.`, { baslik: 'Sil', evet: 'Sil', tehlike: true }))) return false;
    const d = depo();
    await d.kaydet([{ op: 'del', c, k: r.id }]);
    bildir(`${ad} silindi.`, { eylem: { yazi: 'Geri al', fn: () => d.kaydet([{ op: 'undel', c, k: r.id }]) } });
    return true;
  }

  Object.assign(NT.ui.ALAN_ADLARI, {
    tur: 'Ambalaj türü', numara: 'Numara', urun: 'Ürün', parti: 'Parti', sevk: 'Sevkiyat kaydı', sevkNo: 'Sevkiyat no', firma: 'Müşteri', takan: 'Takan', ambalaj: 'Ambalaj',
    durum: 'Durum', neden: 'Neden', yerine: 'Yerine takılan', eskisi: 'Yerine takıldığı', cikisTarihi: 'Çıkış tarihi', bas: 'Başlangıç', bit: 'Bitiş', uyariSiniri: 'Stok uyarı sınırı',
  });

  /* ---------------- Satış'tan sevkiyat listesi (yalnızca okunur; Satış'a hiçbir şey yazılmaz) ---------------- */
  const satis = { liste: [], durum: 'bos', son: 0, dinle: new Set() };
  const satisYaz = (l, durum) => { satis.liste = l; satis.durum = durum; satis.dinle.forEach((f) => f()); };
  async function satisYukle() {
    if (satis.durum === 'yukleniyor' || Date.now() - satis.son < 30000) return;
    satis.son = Date.now();
    if (b.mod === 'demo') { satisYaz(NT.klipsDemoSevk ? NT.klipsDemoSevk() : [], 'hazir'); return; }
    satis.durum = 'yukleniyor';
    try {
      const sd = b.depoOlustur('satis', b.kod, b.kullanici);
      const kayitli = await sd.onbellek.al().catch(() => null);
      if (kayitli && kayitli.olaylar) {
        for (const e of kayitli.olaylar) sd.ekle(e);
        sd.sonSira = kayitli.sonSira || 0;
        sd.yenidenHesapla();
        satisYaz(sd.kayitlar('sevk'), 'yukleniyor');
      }
      sd.cevrimici = true;
      await sd.tara();
      satisYaz(sd.kayitlar('sevk'), sd.hata && !sd.olaylar.size ? 'hata' : 'hazir');
    } catch (e) {
      console.warn('Satış okunamadı', e);
      satisYaz(satis.liste, 'hata');
    }
  }
  function useSatisSevkleri() {
    const [, y] = useState(0);
    useEffect(() => { const f = () => y((x) => x + 1); satis.dinle.add(f); satisYukle(); return () => satis.dinle.delete(f); }, []);
    return satis.liste.filter((s) => !s.iptal);
  }
  const useSevkler = () => (cfg.useSevkler ? cfg.useSevkler() : useSatisSevkleri());
  const sevkKalemleri = (s) => (s.kalemler || []).map((k) => `${k.adet || ''} ${k.ambalaj || ''} ${k.urun || ''}`.trim()).join(', ');
  /* Satış'ta adı "Dökme" olan ambalaj burada Tanker'dir. */
  const turCevir = (t) => (t === 'Dökme' ? 'Tanker' : S.TURLER.includes(t) ? t : '');

  /* ---------------- Numara denetimi ---------------- */
  /* Kullanılmış veya aralık dışı numarada sorar; true dönerse kaydedilir. */
  async function numaraDenetle(d, liste) {
    const s = S.stok(d);
    const kullanilan = liste.filter((n) => s.harita.has(n));
    const disi = s.toplam > 0 ? liste.filter((n) => !s.aralikNo.has(+n) && !s.harita.has(n)) : [];
    if (!kullanilan.length && !disi.length) return true;
    const p = [];
    if (kullanilan.length) p.push(`${kullanilan.join(', ')} daha önce girilmiş; aynı numara iki kez görünecek.`);
    if (disi.length) p.push(`${disi.join(', ')} tanımlı klips numaraları arasında değil.`);
    return onayla(`${p.join(' ')} Yine de kaydedilsin mi?`, { baslik: 'Numarayı kontrol edin', evet: 'Yine de kaydet' });
  }
  /* Tek numaranın formda gösterilecek uyarısı. */
  function numaraNotu(d, no) {
    const n = S.klipsNo(no);
    if (!String(no || '').trim()) return '';
    if (!n) return 'Geçersiz numara';
    const s = S.stok(d);
    if (s.harita.has(n)) return `${n} daha önce girilmiş`;
    if (s.toplam > 0 && !s.aralikNo.has(+n)) return `${n} tanımlı aralıkta değil`;
    return '';
  }

  /* ---------------- Ortak parçalar ---------------- */
  function KlipsCip({ k, cakisan }) {
    return html`<span class=${`km-cip km-${k.durum}${cakisan ? ' km-cakisan' : ''}`} title=${`${S.DURUMLAR[k.durum] || ''}${k.yerine ? ' · yerine ' + k.yerine : ''}${cakisan ? ' · iki kez girilmiş' : ''}`}>${k.numara}</span>`;
  }
  function AmbalajKart({ a }) {
    const d = depo();
    const klipsler = S.ambalajKlipsleri(d, a.id);
    const eksik = S.eksikler(a);
    const c = new Set(S.stok(d).cakisan);
    return html`<button type="button" class="km-kart" onClick=${() => ambalajAc(a)}>
      <div class="km-kart-bas"><span class="km-tur">${a.tur || 'Ambalaj'}</span><b>${a.numara || 'Numarasız'}</b>
        ${eksik.length > 0 && html`<span class="km-eksik" title=${eksik.join(', ')}>${eksik.length} eksik</span>`}</div>
      <div class="km-cipler">${klipsler.map((k) => html`<${KlipsCip} key=${k.id} k=${k} cakisan=${c.has(k.numara)} />`)}${!klipsler.length && html`<span class="soluk kucuk">Klips yok</span>`}</div>
      <div class="km-meta"><span>${[a.urun, a.parti].filter(Boolean).join(' · ') || 'Ürün ve parti yok'}</span>
        <span>${[a.firma, a.sevkNo].filter(Boolean).join(' · ') || 'Sevkiyat yok'}</span><span>${tarihVeya(a.tarih)}</span></div>
    </button>`;
  }
  const KartIzgara = ({ liste }) => html`<div class="km-izgara">${liste.map((a) => html`<${AmbalajKart} key=${a.id} a=${a} />`)}</div>`;
  const urunOnerileri = (d, sevkler = []) => [...new Set(['Ecosky 3103', 'Ecosky 2108', 'Ecophalt', 'Ecotall', ...d.kayitlar('ambalaj').map((a) => a.urun), ...sevkler.flatMap((s) => (s.kalemler || []).map((k) => k.urun))].filter(Boolean))];
  const partiOnerileri = (d, sevkler = []) => [...new Set([...d.kayitlar('ambalaj').map((a) => a.parti), ...sevkler.flatMap((s) => (s.kalemler || []).map((k) => k.parti))].filter(Boolean))];
  /* Takan listesi: yalnız Yoklama personeli + "Başka kişi" ile yazılmış adlar; programa girenler ve beyaz yakalılar alınmaz. */
  const takanListesi = (d) => NT.ui.kisiListesi([...d.kayitlar('ambalaj').map((a) => a.takan), ...d.kayitlar('klips').map((k) => k.takan), ...d.kayitlar('aralik').map((a) => a.kisi)], { kullanici: false });
  const TakanSec = ({ d, deger, degis, etiket = 'Takan' }) => html`<${NT.ui.KisiSec} etiket=${etiket} deger=${deger} degis=${degis} liste=${takanListesi(d)} />`;

  /* Yeni kayıt ve düzenleme penceresinin üst alanları: sevkiyat, müşteri, ürün, parti, tarih, takan. */
  function OrtakAlanlar({ f, setF, sevkler, sevkSecildi }) {
    const d = depo();
    const s = (k) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); };
    const oneriler = sevkler.filter((x) => ara(`${x.no} ${x.firma}`, f.sevkNo || ''))
      .sort((x, y) => String(y.no).localeCompare(String(x.no))).map((x) => ({ ad: x.no, alt: `${x.firma || ''}${sevkKalemleri(x) ? ' · ' + sevkKalemleri(x) : ''}`, x }));
    const sec = ({ x }) => {
      const urunler = [...new Set((x.kalemler || []).map((k) => k.urun).filter(Boolean))];
      const partiler = [...new Set((x.kalemler || []).map((k) => k.parti).filter(Boolean))];
      setF((p) => ({ ...p, sevk: x.id, sevkNo: x.no || '', firma: x.firma || '', urun: urunler.length === 1 ? urunler[0] : p.urun, parti: partiler.length === 1 ? partiler[0] : p.parti }));
      if (sevkSecildi) sevkSecildi(x);
    };
    return html`
      <${Oneri} id="km-urunler" liste=${urunOnerileri(d, sevkler)} /><${Oneri} id="km-partiler" liste=${partiOnerileri(d, sevkler)} />
      <${Alan} etiket="Sevkiyat" sinif="s6" ipucu=${!cfg.useSevkler && satis.durum === 'hata' ? 'Satış’taki sevkiyatlar okunamadı; elle yazabilirsiniz' : 'Satış’tan seçin ya da elle yazın; sonra da girilebilir'}>
        <${K.OneriGirdi} deger=${f.sevkNo} oneriler=${oneriler} sec=${sec} placeholder="SV-2026-0014" degis=${(v) => setF((p) => ({ ...p, sevkNo: v, sevk: '' }))} /><//>
      <${Alan} etiket="Müşteri" sinif="s6"><input class="girdi" value=${f.firma} onInput=${s('firma')} placeholder="Sevkiyat seçilince dolar" /><//>
      <${Alan} etiket="Ürün" sinif="s6"><input class="girdi" list="km-urunler" value=${f.urun} onInput=${s('urun')} /><//>
      <${Alan} etiket="Parti" sinif="s6"><input class="girdi" list="km-partiler" value=${f.parti} onInput=${s('parti')} placeholder="SKY.PR.0071" /><//>
      <${Alan} etiket="Takıldığı tarih" sinif="s6" ipucu="Zorunlu"><input class="girdi" type="date" value=${f.tarih} onInput=${s('tarih')} /><//>
      <${Alan} etiket="Takan" sinif="s6"><${TakanSec} d=${d} deger=${f.takan} degis=${(v) => setF((p) => ({ ...p, takan: v }))} /><//>`;
  }

  /* ---------------- Klips takma penceresi: bir sevkiyatın ambalajları ve klipsleri tek seferde ---------------- */
  const yeniSatir = (on = {}) => ({ id: uid(), tur: on.tur || 'IBC', no: on.no || '', klipsler: on.klipsler || [''] });

  function KlipsSatiri({ r, i, degis, sil, d, tekrar }) {
    const klipsDegis = (j, v) => degis({ ...r, klipsler: r.klipsler.map((x, n) => (n === j ? v : x)) });
    const notlar = [...new Set(r.klipsler.map((x) => (tekrar.has(S.klipsNo(x)) ? `${S.klipsNo(x)} bu pencerede iki kez yazılmış` : numaraNotu(d, x))).filter(Boolean))];
    return html`<div class="km-satir">
      <div class="km-satir-sira">${i + 1}</div>
      <div class="km-satir-ic">
        <div class="km-satir-ust">
          <select class="girdi km-tur-sec" aria-label="Ambalaj türü" value=${r.tur} onChange=${(e) => degis({ ...r, tur: e.target.value })}>${S.TURLER.map((t) => html`<option value=${t}>${t}</option>`)}</select>
          <input class="girdi km-ambalaj-no" aria-label="Ambalaj numarası" value=${r.no} placeholder="Ambalaj no" onInput=${(e) => degis({ ...r, no: e.target.value })} onBlur=${(e) => degis({ ...r, no: S.ambalajNo(e.target.value, r.tur) })} />
        </div>
        <div class="km-klips-girdiler">
          ${r.klipsler.map((x, j) => html`<span class="km-klips-girdi" key=${j}>
            <input class="girdi mono" inputmode="numeric" aria-label=${`Klips numarası ${j + 1}`} value=${x} placeholder="Klips no" onInput=${(e) => klipsDegis(j, e.target.value)} onBlur=${(e) => { const n = S.klipsNo(e.target.value); if (n) klipsDegis(j, n); }} />
            ${r.klipsler.length > 1 && html`<button type="button" class="km-x" title="Bu klipsi çıkar" onClick=${() => degis({ ...r, klipsler: r.klipsler.filter((_, n) => n !== j) })}><${Ikon} ad="kapat" boyut=${13} /></button>`}
          </span>`)}
          <button type="button" class="d kucuk-d" onClick=${() => degis({ ...r, klipsler: [...r.klipsler, ''] })}><${Ikon} ad="arti" boyut=${14} />Klips</button>
        </div>
        ${notlar.map((n) => html`<div class="km-not">${n}</div>`)}
      </div>
      ${sil && html`<button type="button" class="d hayalet ikon-d" title="Bu ambalajı çıkar" onClick=${sil}><${Ikon} ad="kapat" boyut=${16} /></button>`}
    </div>`;
  }

  function KlipsTakFormu({ kapat, on = {} }) {
    const d = depo();
    const sevkler = useSevkler();
    const [f, setF] = useState({ sevk: on.sevk || '', sevkNo: on.sevkNo || '', firma: on.firma || '', urun: on.urun || '', parti: on.parti || '', tarih: bugun(), takan: '', notlar: '', ekler: [] });
    const [satirlar, setSatirlar] = useState([yeniSatir({ tur: on.tur })]);
    const [hata, setHata] = useState('');
    const [mesgul, setMesgul] = useState(false);
    const tum = satirlar.flatMap((r) => r.klipsler.map(S.klipsNo)).filter(Boolean);
    const tekrar = new Set(tum.filter((n, i) => tum.indexOf(n) !== i));
    const dolu = satirlar.reduce((t, r) => t + r.klipsler.filter((x) => String(x).trim()).length, 0);
    const bos = satirlar.reduce((t, r) => t + r.klipsler.filter((x) => !String(x).trim()).length, 0);

    function ambalajEkle() {
      setSatirlar((l) => {
        const son = l[l.length - 1];
        return [...l, yeniSatir({ tur: son.tur, no: S.sonrakiAmbalajNo(S.ambalajNo(son.no, son.tur)), klipsler: son.klipsler.map(() => '') })];
      });
    }
    function siradanDoldur() {
      setSatirlar((l) => {
        const yazili = new Set(l.flatMap((r) => r.klipsler.map(S.klipsNo)).filter(Boolean));
        const adet = l.reduce((t, r) => t + r.klipsler.filter((x) => !String(x).trim()).length, 0);
        const bosNo = S.siradakiler(d, adet, yazili);
        let i = 0;
        return l.map((r) => ({ ...r, klipsler: r.klipsler.map((x) => (String(x).trim() ? x : bosNo[i++] || '')) }));
      });
    }
    async function kaydet() {
      setHata('');
      const dolular = satirlar.filter((r) => String(r.no).trim() || r.klipsler.some((x) => String(x).trim()));
      if (!f.tarih) return setHata('Takıldığı tarihi seçin.');
      if (!f.takan.trim()) return setHata('Takan kişiyi seçin.');
      if (!dolular.length) return setHata('En az bir ambalaj ve klips girin.');
      for (const [i, r] of dolular.entries()) {
        const yazili = r.klipsler.filter((x) => String(x).trim());
        if (!yazili.length) return setHata(`${i + 1}. ambalajda klips numarası yok.`);
        const gecersiz = yazili.find((x) => !S.klipsNo(x));
        if (gecersiz) return setHata(`“${gecersiz}” geçerli bir klips numarası değil.`);
      }
      if (tekrar.size) return setHata(`${[...tekrar].join(', ')} bu pencerede iki kez yazılmış.`);
      if (!(await numaraDenetle(d, tum))) return undefined;
      setMesgul(true);
      try {
        const ortak = { sevk: f.sevk, sevkNo: f.sevkNo.trim(), firma: f.firma.trim(), urun: f.urun.trim(), parti: f.parti.trim(), tarih: f.tarih, takan: f.takan.trim(), notlar: f.notlar.trim(), ekler: f.ekler };
        const ops = [];
        let klipsSay = 0;
        for (const r of dolular) {
          const id = uid();
          ops.push({ c: 'ambalaj', k: id, v: { ...ortak, tur: r.tur, numara: S.ambalajNo(r.no, r.tur) } });
          for (const x of r.klipsler.filter((y) => String(y).trim())) {
            ops.push({ c: 'klips', k: uid(), v: { numara: S.klipsNo(x), ambalaj: id, durum: 'takili', tarih: f.tarih, takan: ortak.takan } });
            klipsSay++;
          }
        }
        await d.kaydet(ops);
        bildir(`${dolular.length} ambalaj, ${klipsSay} klips kaydedildi.`);
        kapat();
      } finally { setMesgul(false); }
      return undefined;
    }
    const sevkSecildi = (x) => {
      const k = (x.kalemler || [])[0];
      const tur = k && turCevir(k.ambalaj);
      if (tur) setSatirlar((l) => (l.length === 1 && !String(l[0].no).trim() ? [{ ...l[0], tur }] : l));
    };
    return html`<${Modal} genis baslik="Klips tak" kapat=${kapat}
      alt=${html`<${FormAlt} kapat=${kapat} kaydet=${kaydet} mesgul=${mesgul} kaydetYazi=${`Kaydet${dolu ? ` · ${dolu} klips` : ''}`} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${OrtakAlanlar} f=${f} setF=${setF} sevkler=${sevkler} sevkSecildi=${sevkSecildi} />
        <div class="s12 form-bolum">Ambalajlar ve klipsler</div>
        <div class="s12 km-satirlar">
          ${satirlar.map((r, i) => html`<${KlipsSatiri} key=${r.id} r=${r} i=${i} d=${d} tekrar=${tekrar} degis=${(y) => setSatirlar((l) => l.map((z) => (z.id === r.id ? y : z)))} sil=${satirlar.length > 1 ? () => setSatirlar((l) => l.filter((z) => z.id !== r.id)) : null} />`)}
        </div>
        <div class="s12 km-satir-alt">
          <button type="button" class="d" onClick=${ambalajEkle}><${Ikon} ad="arti" boyut=${15} />Ambalaj ekle</button>
          <button type="button" class="d" disabled=${!bos} onClick=${siradanDoldur}><${Ikon} ad="sayim" boyut=${15} />Boşları sıradan doldur</button>
          <span class="soluk kucuk">${S.stok(d).sirada ? `Sıradaki boş klips: ${S.stok(d).sirada}` : 'Boşta klips görünmüyor'}</span>
        </div>
        <${Alan} etiket="Not"><input class="girdi" value=${f.notlar} onInput=${(e) => { const v = e.target.value; setF((p) => ({ ...p, notlar: v })); }} /><//>
        <${Alan} etiket="Fotoğraf veya belge" ipucu="İsteğe bağlı; bütün ambalajlara eklenir (en fazla 8 MB)"><${Ekler} ekler=${f.ekler} degis=${(v) => setF((p) => ({ ...p, ekler: v }))} /><//>
        ${hata && html`<div class="s12 hata-yazi">${hata}</div>`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const klipsTak = (on) => K.ac(KlipsTakFormu, { on });

  /* ---------------- Ambalaj kaydı: düzenleme, klips ekleme/değiştirme ---------------- */
  function KlipsEklePenceresi({ a, kapat }) {
    const d = depo();
    const [metin, setMetin] = useState(S.stok(d).sirada);
    const [tarih, setTarih] = useState(a.tarih || bugun());
    const [takan, setTakan] = useState(a.takan || '');
    const [hata, setHata] = useState('');
    async function kaydet() {
      const { liste, hata: h } = S.numaraListesi(metin);
      if (h || !liste.length) return setHata(h || 'Numara yazın.');
      if (!tarih) return setHata('Tarih seçin.');
      if (!takan.trim()) return setHata('Takan kişiyi seçin.');
      if (!(await numaraDenetle(d, liste))) return undefined;
      await d.kaydet(liste.map((no) => ({ c: 'klips', k: uid(), v: { numara: no, ambalaj: a.id, durum: 'takili', tarih, takan: takan.trim() } })));
      bildir(`${liste.length} klips eklendi.`);
      kapat();
      return undefined;
    }
    return html`<${Modal} dar baslik=${`${a.numara || 'Ambalaj'} · klips ekle`} kapat=${kapat} alt=${html`<${FormAlt} kapat=${kapat} kaydet=${kaydet} kaydetYazi="Ekle" />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket="Klips numaraları" ipucu="Birden fazlaysa virgülle: 23, 24 veya 23-24" hata=${hata}><input class="girdi mono" value=${metin} onInput=${(e) => setMetin(e.target.value)} autofocus /><//>
        <${Alan} etiket="Takan" sinif="s6"><${TakanSec} d=${d} deger=${takan} degis=${setTakan} /><//>
        <${Alan} etiket="Tarih" sinif="s6"><input class="girdi" type="date" value=${tarih} onInput=${(e) => setTarih(e.target.value)} /><//>
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  /* Gümrükte kesilen klips: eski kayıt “Değiştirildi”, yenisi aynı ambalaja takılır; ikisi birbirini gösterir. */
  function DegistirPenceresi({ k, kapat }) {
    const d = depo();
    const [f, setF] = useState({ yeni: S.stok(d).sirada, neden: '', tarih: bugun(), takan: '' });
    const [hata, setHata] = useState('');
    const s = (a) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [a]: v })); };
    async function kaydet() {
      const no = S.klipsNo(f.yeni);
      if (!no) return setHata('Yeni klips numarasını yazın.');
      if (!f.tarih) return setHata('Tarih seçin.');
      if (!f.takan.trim()) return setHata('Takan kişiyi seçin.');
      if (!(await numaraDenetle(d, [no]))) return undefined;
      await d.kaydet([{ c: 'klips', k: k.id, v: { durum: 'degisti', yerine: no, neden: f.neden.trim(), cikisTarihi: f.tarih } },
        { c: 'klips', k: uid(), v: { numara: no, ambalaj: k.ambalaj, durum: 'takili', tarih: f.tarih, takan: f.takan.trim(), eskisi: k.numara } }]);
      bildir(`${k.numara} yerine ${no} takıldı.`);
      kapat();
      return undefined;
    }
    return html`<${Modal} dar baslik=${`${k.numara} klipsini değiştir`} kapat=${kapat} alt=${html`<${FormAlt} kapat=${kapat} kaydet=${kaydet} kaydetYazi="Değiştir" />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket="Yeni klips no" sinif="s6" hata=${hata}><input class="girdi mono" inputmode="numeric" value=${f.yeni} onInput=${s('yeni')} autofocus /><//>
        <${Alan} etiket="Tarih" sinif="s6"><input class="girdi" type="date" value=${f.tarih} onInput=${s('tarih')} /><//>
        <${Alan} etiket="Takan"><${TakanSec} d=${d} deger=${f.takan} degis=${(v) => setF((p) => ({ ...p, takan: v }))} /><//>
        <${Alan} etiket="Neden"><input class="girdi" value=${f.neden} onInput=${s('neden')} placeholder="Örn: Gümrük kontrolünde kesildi" /><//>
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  function AmbalajPenceresi({ a, kapat }) {
    const d = depo();
    const sevkler = useSevkler();
    const [f, setF] = useState({ tur: a.tur || "IBC", numara: a.numara || '', sevk: a.sevk || '', sevkNo: a.sevkNo || '', firma: a.firma || '', urun: a.urun || '', parti: a.parti || '', tarih: a.tarih || '', takan: a.takan || '', notlar: a.notlar || '', ekler: a.ekler || [] });
    const [mesgul, setMesgul] = useState(false);
    const [hata, setHata] = useState('');
    const guncel = d.kayit('ambalaj', a.id) || a;
    const klipsler = S.ambalajKlipsleri(d, a.id);
    const eksik = S.eksikler(f);
    const c = new Set(S.stok(d).cakisan);
    async function kaydet() {
      /* Aktarılan eski kayıtlarda boş olabilir; girilmiş tarih ve kişi silinemez. */
      if (a.tarih && !f.tarih) return setHata('Tarih boş bırakılamaz.');
      if (a.takan && !f.takan.trim()) return setHata('Takan kişi boş bırakılamaz.');
      setHata('');
      setMesgul(true);
      try {
        await d.kaydet([{ c: 'ambalaj', k: a.id, v: { tur: f.tur, numara: S.ambalajNo(f.numara, f.tur), sevk: f.sevk, sevkNo: f.sevkNo.trim(), firma: f.firma.trim(), urun: f.urun.trim(), parti: f.parti.trim(), tarih: f.tarih, takan: f.takan.trim(), notlar: f.notlar.trim(), ekler: f.ekler } }]);
        bildir('Kayıt güncellendi.');
        kapat();
      } finally { setMesgul(false); }
    }
    async function silFn() {
      const ad = guncel.numara || 'Bu ambalaj';
      if (!(await onayla(`${ad} ve ${klipsler.length} klipsi silinsin mi? Numaralar yeniden boşa düşer; Ayarlar › Çöp kutusu’ndan geri alınabilir.`, { baslik: 'Sil', evet: 'Sil', tehlike: true }))) return;
      const ops = [{ op: 'del', c: 'ambalaj', k: a.id }, ...klipsler.map((k) => ({ op: 'del', c: 'klips', k: k.id }))];
      await d.kaydet(ops);
      bildir(`${ad} silindi.`, { eylem: { yazi: 'Geri al', fn: () => d.kaydet(ops.map((o) => ({ ...o, op: 'undel' }))) } });
      kapat();
    }
    return html`<${Modal} genis baslik=${guncel.numara || 'Ambalaj kaydı'} kapat=${kapat}
      sag=${eksik.length > 0 && html`<span class="km-eksik">Eksik: ${eksik.join(', ')}</span>`}
      alt=${html`<${FormAlt} kayit=${a} sil=${silFn} kapat=${kapat} kaydet=${kaydet} mesgul=${mesgul} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket="Ambalaj türü" sinif="s6"><select class="girdi" value=${f.tur} onChange=${(e) => { const v = e.target.value; setF((p) => ({ ...p, tur: v })); }}>${S.TURLER.map((t) => html`<option value=${t}>${t}</option>`)}</select><//>
        <${Alan} etiket="Ambalaj no" sinif="s6"><input class="girdi" value=${f.numara} placeholder="IBC 00186" onInput=${(e) => { const v = e.target.value; setF((p) => ({ ...p, numara: v })); }} onBlur=${(e) => { const v = S.ambalajNo(e.target.value, f.tur); setF((p) => ({ ...p, numara: v })); }} /><//>
        <${OrtakAlanlar} f=${f} setF=${setF} sevkler=${sevkler} />
        <div class="s12 form-bolum">Klipsler</div>
        <div class="s12">
          ${klipsler.length ? html`<div class="km-klips-liste">${klipsler.map((k) => html`<div key=${k.id} class="km-klips-satir">
            <${KlipsCip} k=${k} cakisan=${c.has(k.numara)} />
            <span class="km-klips-bilgi"><b>${S.DURUMLAR[k.durum] || k.durum}</b>
              ${k.yerine && html` · yerine ${k.yerine}`}${k.eskisi && html` · ${k.eskisi} yerine takıldı`}${k.neden && html` · ${k.neden}`}${c.has(k.numara) && html` · <span class="hata-yazi">Bu numara iki kez girilmiş</span>`}
              <small>${tarihVeya(k.cikisTarihi || k.tarih)}${k.takan ? ' · ' + k.takan : ''}</small></span>
            ${k.durum === 'takili' && html`<button type="button" class="d kucuk-d" onClick=${() => K.ac(DegistirPenceresi, { k })}><${Ikon} ad="senkron" boyut=${14} />Değiştir</button>`}
            <button type="button" class="d hayalet ikon-d" title="Yanlış girildiyse çıkar; numara boşa düşer" onClick=${() => sil('klips', k, `${k.numara} klipsi`)}><${Ikon} ad="cop" boyut=${15} /></button>
          </div>`)}</div>` : html`<p class="soluk" style="margin:0 0 8px">Bu ambalajda klips yok.</p>`}
          <button type="button" class="d kucuk-d" style="margin-top:8px" onClick=${() => K.ac(KlipsEklePenceresi, { a: guncel })}><${Ikon} ad="arti" boyut=${14} />Klips ekle</button>
        </div>
        <${Alan} etiket="Not"><input class="girdi" value=${f.notlar} onInput=${(e) => { const v = e.target.value; setF((p) => ({ ...p, notlar: v })); }} /><//>
        <${Alan} etiket="Fotoğraf veya belge" ipucu="İsteğe bağlı (en fazla 8 MB)"><${Ekler} ekler=${f.ekler} degis=${(v) => setF((p) => ({ ...p, ekler: v }))} /><//>
        ${hata && html`<div class="s12 hata-yazi">${hata}</div>`}
        <${GecmisBolumu} kayit=${guncel} />
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const ambalajAc = (a) => K.ac(AmbalajPenceresi, { a });

  function klipsTakSevk(x) {
    const k = x.kalemler || [];
    const urunler = [...new Set(k.map((y) => y.urun).filter(Boolean))];
    const partiler = [...new Set(k.map((y) => y.parti).filter(Boolean))];
    klipsTak({ sevk: x.id, sevkNo: x.no, firma: x.firma, urun: urunler.length === 1 ? urunler[0] : '', parti: partiler.length === 1 ? partiler[0] : '', tur: k[0] ? turCevir(k[0].ambalaj) : '' });
  }

  /* ---------------- Satış Takip içinden kullanım ---------------- */
  const bag = { d: null, durum: 'bos', hata: '' };
  async function bagBaslat() {
    if (bag.durum !== 'bos') return;
    bag.durum = 'yukleniyor';
    try {
      let d;
      if (b.mod === 'demo') {
        d = new NT.Depo({ dizin: null, cihaz: b.cihaz, kullanici: b.kullanici });
        await d.kaydet([{ c: 'aralik', k: uid(), v: { bas: '00001', bit: '01000', tarih: '', notlar: 'Örnek' } }]);
      } else {
        d = b.depoOlustur('klips', b.kod, b.kullanici);
        await d.hazirla();
        await d.tara();
        const tara = () => { if (!document.hidden) d.tara(); };
        setInterval(tara, 15000);
        window.addEventListener('focus', tara);
        window.addEventListener('online', tara);
      }
      d.abone(() => b.bildir());
      bag.d = d;
      bag.durum = 'hazir';
    } catch (e) {
      console.warn('Klips kayıtları açılamadı', e);
      bag.durum = 'hata';
      bag.hata = e.message || 'Klips kayıtları açılamadı.';
    }
    b.bildir();
  }
  /* Satış modülü bir kez çağırır: bundan sonra pencereler klips deposuna yazar, sevkiyatları Satış deposundan alır. */
  function satisIcinKur() {
    cfg.depo = () => { if (bag.d) bag.d.kullanici = b.kullanici; return bag.d; };
    cfg.useSevkler = () => b.depo.kayitlar('sevk').filter((s) => !s.iptal);
  }
  const sevkinAmbalajlari = (s) => (bag.d ? S.ambalajlar(bag.d).filter((a) => a.sevk === s.id || (s.no && a.sevkNo === s.no)) : []);
  const takiliSayisi = (l) => l.reduce((t, a) => t + S.ambalajKlipsleri(bag.d, a.id).filter((k) => k.durum === 'takili').length, 0);
  /* Sevkiyatın klips listesi: Satış'ta sevkiyat penceresinin ve kısayol penceresinin içeriği. */
  function SevkKlipsListesi({ s }) {
    useEffect(() => { bagBaslat(); }, []);
    if (bag.durum === 'hata') return html`<div class="uyari-kutu yok"><${Ikon} ad="uyari" /><span>${bag.hata}</span></div>`;
    if (!bag.d) return html`<p class="soluk" style="margin:0">Klips kayıtları yükleniyor…</p>`;
    const l = sevkinAmbalajlari(s);
    const c = new Set(S.stok(bag.d).cakisan);
    return html`<div class="km-sevk-klips">
      ${l.length ? html`<div class="km-klips-liste">${l.map((a) => html`<button type="button" key=${a.id} class="km-sevk-satir" onClick=${() => ambalajAc(a)}>
          <span class="km-sevk-ambalaj"><span class="km-tur">${a.tur || 'Ambalaj'}</span><b>${a.numara || 'Numarasız'}</b></span>
          <span class="km-cipler">${S.ambalajKlipsleri(bag.d, a.id).map((k) => html`<${KlipsCip} key=${k.id} k=${k} cakisan=${c.has(k.numara)} />`)}</span>
        </button>`)}</div>` : html`<p class="soluk" style="margin:0">Bu sevkiyata henüz klips girilmedi.</p>`}
      <div class="km-satir-alt" style="margin-top:10px">
        <button type="button" class="d kucuk-d" onClick=${() => klipsTakSevk(s)}><${Ikon} ad="etiket" boyut=${15} />Klips ekle</button>
        <span class="soluk kucuk">${l.length ? `${l.length} ambalaj · ${takiliSayisi(l)} klips · ` : ''}${S.stok(bag.d).sirada ? `sıradaki ${S.stok(bag.d).sirada}` : 'boşta klips görünmüyor'}</span>
        <a class="kucuk" style="color:var(--ana);margin-left:auto" href="#/klipsler">Klipsler sayfası →</a>
      </div>
    </div>`;
  }
  function SevkKlipsPenceresi({ s, kapat }) {
    return html`<${Modal} baslik=${`Klipsler · ${s.no}`} kapat=${kapat} alt=${html`<button class="d hayalet" onClick=${kapat}>Kapat</button>`}>
      <div class="modal-ic"><p class="soluk" style="margin:0 0 10px">${[s.firma, sevkKalemleri(s)].filter(Boolean).join(' · ')}</p><${SevkKlipsListesi} s=${s} /></div>
    <//>`;
  }
  /* Sevkiyat kartındaki düğme: kaç klips girildiğini gösterir. */
  function KlipsDugmesi({ s }) {
    useEffect(() => { bagBaslat(); }, []);
    const n = bag.d ? takiliSayisi(sevkinAmbalajlari(s)) : 0;
    return html`<button type="button" class="d hayalet kucuk-d" title="Gümrük klipsleri" onClick=${() => K.ac(SevkKlipsPenceresi, { s })}><${Ikon} ad="etiket" boyut=${15} />${n ? `${n} klips` : 'Klips'}</button>`;
  }
  /* Satış'ın üst aramasında klips numarasıyla sevkiyat bulmak için. */
  function klipsAra(q) {
    if (!bag.d) return [];
    return bag.d.kayitlar('klips').filter((k) => k.ambalaj && ara(k.numara, q)).map((k) => {
      const a = bag.d.kayit('ambalaj', k.ambalaj);
      return a && { tur: 'Klips', ad: k.numara, ek: [a.numara, a.sevkNo, a.firma].filter(Boolean).join(' · '), fn: () => ambalajAc(a) };
    }).filter(Boolean);
  }

  NT.klipsUI = { depo, sil, bag, bagBaslat, FormAlt, TakanSec, useSevkler, KlipsCip, KartIzgara, sevkKalemleri, klipsTak, klipsTakSevk, ambalajAc, satisIcinKur, SevkKlipsListesi, SevkKlipsPenceresi, KlipsDugmesi, klipsAra };
})();
