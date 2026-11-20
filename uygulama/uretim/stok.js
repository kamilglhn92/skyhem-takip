/* Üretim Stoku paneli. Açılışta tüm bakiyeler boş gelir. */
(function () {
  'use strict';
  const NT = window.NT;
  const S = NT.uretimStoku;
  const K = NT.kabuk;
  const b = NT.baglanti;
  const { html, useState, useRef, useEffect } = window.htmPreact;
  const { Ikon, Modal, BosDurum, bildir } = NT.ui;
  const { t: c, m } = NT.dil;
  const { uid, bugun, tarihYaz, ara } = NT.c;
  const turlar = { giris: 'Stok girişi', aktar: 'İsotanka aktarım', tuketim: 'Hammadde tüketimi', dolum: 'Ambalaj dolumu',
    bos_giris: 'Boş ambalaj girişi', acilis_ibc: 'Dolu ambalaj açılışı', ayir: 'Siparişe ayırma', birak: 'Ayırmayı kaldırma', sevk: 'Sevk çıkışı' };
  const durumlar = { serbest: 'Serbest', ayrildi: 'Siparişe ayrıldı', sevk: 'Sevk edildi' };
  const kgDegeri = (g) => (g / 1000).toLocaleString(NT.dil.yerel(), { maximumFractionDigits: 3 });
  const kg = (g) => kgDegeri(g) + ' kg';
  const aktif = (s) => [...s.kaynaklar.values()].filter((k) => k.gram > 0);
  const veri = () => S.hesapla(b.depo);
  function formAc(Pencere, props) {
    if (b.mod !== 'demo' && !b.depo.cevrimici) {
      bildir(c(b.depo.tabloEksik ? 'Üretim Stoku’nun bulut kurulumu bekleniyor.' : 'İşlem için sunucu bağlantısı gerekir.'), { tur: 'hata' });
      return;
    }
    K.ac(Pencere, props);
  }
  const dugme = (etiket, ikon, eylem, ana = false) => html`<button type="button" class=${'d ' + (ana ? 'ana-d' : '')} onClick=${eylem}><${Ikon} ad=${ikon} />${c(etiket)}</button>`;
  const girisAc = (p = {}) => formAc(Giris, p);
  const dolumAc = (k) => formAc(Dolum, { kaynak: k?.id });
  const acilisIbcAc = () => formAc(Dolum, { acilis: true });
  const aktarmaAc = (k) => formAc(KaynakCikisi, { kaynak: k?.id, aktar: true });
  const tuketimAc = (k) => formAc(KaynakCikisi, { kaynak: k?.id });
  const ibcAc = (tip) => formAc(IbcIslemi, { tip });
  const kaynakAdi = (k) => k.tur === 'uretim' ? c('Üretim çıkışı') + ' · ' + k.yer : k.yer;

  const siparisAdi = (no) => no?.startsWith('EMIR/') ? b.depo.kayitlar('dolumEmri').find((e) => e.tip==='plan' && e.satis===no.slice(5))?.no || no : no;
  function KayitFormu({ baslik, onay, kapat, children, bos = false }) {
    const [bekle, setBekle] = useState(false);
    const [hata, setHata] = useState('');
    const anahtar = useRef(uid(16));
    const aktif = useRef(false);
    async function kaydet() {
      if (aktif.current) return;
      const d = b.depo;
      aktif.current = true;
      setBekle(true);
      setHata('');
      try {
        if (b.mod !== 'demo') {
          await d.tara();
          if (!d.cevrimici) throw new Error('İşlem için sunucu bağlantısı gerekir.');
        }
        const koleksiyon = bos ? 'bosAmbalaj' : 'stok';
        if (!d.kayit(koleksiyon, anahtar.current)) {
          const hareket = onay();
          const sorun = S.dogrula(veri(), hareket);
          if (sorun) throw new Error(sorun);
          if (b.mod === 'demo') {
            await d.numuneIslem(() => {
              if (hareket.emir) NT.stokAkisi.dolumKontrol(d,hareket);
              const hata = S.dogrula(veri(), hareket);
              if (hata) throw new Error(hata);
              return [{ c: koleksiyon, k: anahtar.current, v: hareket }];
            });
          } else {
            const adetIslemi = (bos && hareket.ambalaj !== 'İsotank') || ['dolum','acilis_ibc'].includes(hareket.tip);
            const rpc = adetIslemi ? 'uretim_ambalaj_adet_kaydet' : bos ? 'uretim_bos_ambalaj_kaydet' : 'uretim_stok_kaydet';
            await d.rpc(rpc, { anahtar: anahtar.current, cihaz: b.cihaz, kaydeden: b.kullanici, hareket });
            await d.tara();
          }
        }
        kapat();
        bildir(c('Stok hareketi kaydedildi.'));
      } catch (e) {
        let mesaj = e.message;
        try { mesaj = JSON.parse(e.detay || 'null')?.message || mesaj; } catch { /* Kesilen hata gövdesi. */ }
        if (/PGRST202|Could not find the function/.test(e.detay || mesaj)) mesaj = 'Boş ambalaj kaydı için bulut kurulumu bekleniyor.';
        setHata(c(mesaj));
      } finally {
        aktif.current = false;
        setBekle(false);
      }
    }
    return html`<${Modal} baslik=${c(baslik)} kapat=${() => { if (!aktif.current) kapat(); }} sinif="us-form" odagiKoru
      alt=${html`${hata && html`<div class="uyari-kutu kritik us-hata" role="alert">${hata}</div>`}
        <button class="d" disabled=${bekle} onClick=${kapat}>${c('Vazgeç')}</button>
        <button class="d ana-d" disabled=${bekle} onClick=${kaydet}>${c(bekle ? 'Kaydediliyor…' : 'Kaydet')}</button>`}>
      <div class="modal-ic us-form-ic">${children}</div><//>`;
  }
  const Metin = ({ ad, deger, degis, tur = 'text', placeholder, inputmode, liste }) => html`<label class="us-alan">${c(ad)}
    <input class="girdi" type=${tur} list=${liste} inputmode=${inputmode} value=${deger} placeholder=${placeholder && c(placeholder)} onInput=${(e) => degis(e.currentTarget.value)} /></label>`;
  const Sec = ({ ad, liste, deger, degis }) => html`<label class="us-alan">${c(ad)}
    <select class="girdi" value=${deger} onChange=${(e) => degis(e.currentTarget.value)}>${liste.map(([id, etiket, sabit]) => html`<option value=${id}>${sabit ? etiket : c(etiket)}</option>`)}</select></label>`;
  const Tarih = ({ tarih, degis }) => html`<${Metin} ad="Fiili tarih" tur="date" deger=${tarih} degis=${degis} />`;

  const Konum = ({ deger, degis, tumu }) => html`<${Sec} ad="Stok konumu" liste=${[...(tumu ? [['','Tümü'],['?','Konum belirtilmedi']] : []), ...S.konumlar.map((v) => [v,v])]} deger=${deger} degis=${degis} />`;
  function Giris({ kapat, kaynak }) {
    const [f, set] = useState({ cins: kaynak?.cins || 'cto', urun: kaynak?.urun || '', tur: kaynak?.tur || 'isotank', yer: kaynak?.yer || '',
      konum: kaynak?.konum || S.konumlar[0], parti: '', kg: '', tarih: bugun(), acilis: !kaynak, not: '' });
    const s = (ad) => (v) => set((p) => ({ ...p, [ad]: v }));
    const coklu = f.acilis && f.cins === 'urun' && f.tur === 'isotank';
    const son = f.cins === 'urun';
    const uretim = son && f.tur === 'uretim';
    function hareket() {
      const partiler = [...new Set((coklu ? f.parti.split(/[,\n]/) : [f.parti]).map(S.kod).filter(Boolean))];
      const urun = son ? f.urun.trim() : S.cinsler[f.cins];
      const yer = uretim ? partiler[0] : S.kod(f.yer);
      return { tip: 'giris', konum: f.konum, cins: f.cins, urun, tur: uretim ? 'uretim' : 'isotank', yer, parti: partiler[0] || '',
        partiler, kaynak: uretim ? S.uretimId(urun, yer) : S.tankId(yer), gram: S.gram(f.kg), tarih: f.tarih, acilis: f.acilis, not: f.not.trim() };
    }
    return html`<${KayitFormu} baslik="Stok girişi" onay=${hareket} kapat=${kapat}>
      <div class="us-iki"><${Sec} ad="Stok grubu" liste=${Object.entries(S.cinsler)} deger=${f.cins} degis=${s('cins')} />
        <${Sec} ad="Giriş türü" liste=${[['acilis', 'Açılış stoku'], ['normal', 'Yeni giriş']]} deger=${f.acilis ? 'acilis' : 'normal'} degis=${(v) => s('acilis')(v === 'acilis')} /></div>
      ${son && html`<div class="us-iki"><${Metin} ad="Ürün" deger=${f.urun} degis=${s('urun')} liste="us-urunler" />
        <datalist id="us-urunler">${S.urunler.map((u) => html`<option value=${u} />`)}</datalist>
        <${Sec} ad="Stok nerede?" liste=${[['isotank', 'İsotank'], ['uretim', 'Üretim çıkışı']]} deger=${f.tur} degis=${s('tur')} /></div>`}
      <div class="us-iki">${!uretim && html`<${Metin} ad="İsotank numarası" deger=${f.yer} degis=${s('yer')} />`}
        <${Metin} ad=${coklu ? 'Tanktaki batch’ler' : (son ? 'Batch' : 'Lot numarası')} deger=${f.parti} degis=${s('parti')} />
      </div>
      <${Konum} deger=${f.konum} degis=${s('konum')} />
      ${coklu && html`<p class="soluk kucuk">${c('Batch’leri virgülle ayırın. Net kg, tankın toplam bakiyesidir.')}</p>`}
      <div class="us-iki"><${Metin} ad="Net kg" inputmode="decimal" deger=${f.kg} degis=${s('kg')} /><${Tarih} tarih=${f.tarih} degis=${s('tarih')} /></div>
      <${Metin} ad="Açıklama (isteğe bağlı)" deger=${f.not} degis=${s('not')} />
    <//>`;
  }

  function KaynakCikisi({ kapat, kaynak, aktar }) {
    const liste = aktif(veri()).filter((k) => aktar ? k.tur === 'uretim' : k.cins !== 'urun');
    const [id, setId] = useState(kaynak || liste[0]?.id || '');
    const [net, setNet] = useState('');
    const [konum, setKonum] = useState(S.konumlar[0]);
    const [yer, setYer] = useState('');
    const [tarih, setTarih] = useState(bugun());
    const k = veri().kaynaklar.get(id);
    return html`<${KayitFormu} baslik=${aktar ? 'İsotanka aktarım' : 'Hammadde tüketimi'} kapat=${kapat}
      onay=${() => ({ tip: aktar ? 'aktar' : 'tuketim', kaynak: id, gram: S.gram(net), yer: aktar ? S.kod(yer) : '',
        konum: aktar ? konum : undefined, hedef: aktar ? S.tankId(yer) : '', parti: aktar ? '' : S.kod(yer), tarih })}>
      <${Sec} ad="Kaynak" liste=${[['', 'Seçin'], ...liste.map((x) => [x.id, kaynakAdi(x) + ' · ' + x.urun + ' · ' + kg(x.gram), true])]} deger=${id} degis=${setId} />
      ${k && html`<div class="us-bilgi">${kg(k.gram)} · ${[...k.partiler.keys()].join(' + ')}</div>`}
       ${aktar && html`<${Konum} deger=${konum} degis=${setKonum} />`}
      <${Metin} ad=${aktar ? 'Hedef isotank numarası' : 'Kullanıldığı üretim batch’i'} deger=${yer} degis=${setYer} />
      <div class="us-iki"><${Metin} ad="Net kg" inputmode="decimal" deger=${net} degis=${setNet} /><${Tarih} tarih=${tarih} degis=${setTarih} /></div>
    <//>`;
  }

  function Dolum({ kaynak, acilis, kapat, emir }) {
    const s = veri();
    const liste = aktif(s).filter((k) => k.cins === 'urun');
    const [id, setId] = useState(acilis ? '' : (kaynak || liste[0]?.id || ''));
    const [ilk, setIlk] = useState('');
    const [adet, setAdet] = useState(emir ? String(emir.eksik) : '');
    const [ortak, setOrtak] = useState('');
    const [ambalaj, setAmbalaj] = useState(emir?.ambalaj || 'IBC');
    const [konum, setKonum] = useState(S.konumlar[0]);
    const varilSerisi = useRef('VAR-' + S.kod(uid(7)) + '-001');
    const [elleSatirlar, setElleSatirlar] = useState(null);
    const [seriHata, setSeriHata] = useState(false);
    const [siparis, setSiparis] = useState('');
    const [urun, setUrun] = useState('');
    const [partiler, setPartiler] = useState('');
    const [tarih, setTarih] = useState(bugun());
    const k = s.kaynaklar.get(id);
    const [seciliBosKonum, setBosKonum] = useState(null);
    const boslar = [...s.bos.values()].filter((x) => x.ambalaj === ambalaj && x.adet > 0);
    const bosKonum = seciliBosKonum ?? boslar[0]?.konum ?? konum;
    const ilkNo = ilk || (ambalaj === 'Varil' ? varilSerisi.current : '');
    const seri = S.seri(ilkNo, Number(adet), S.gram(ortak));
    const satirlar = elleSatirlar ?? seri;
    const ibcler = () => satirlar.map((i) => ({ no: S.kod(i.no), gram: S.gram(i.kg) }));
    const g = S.toplam(ibcler());
    function seriYaz() {
      setSeriHata(!seri.length);
      if (seri.length) setElleSatirlar(null);
    }
    const elleDegis = (fn) => setElleSatirlar((onceki) => fn(onceki ?? seri));
    const degis = (i, alan) => (v) => elleDegis((l) => l.map((x, j) => j === i ? { ...x, [alan]: v } : x));
    return html`<${KayitFormu} baslik=${acilis ? 'Dolu ambalaj açılışı' : 'Ambalaj dolumu'} kapat=${kapat}
      onay=${() => ({ ...(emir ? {emir:emir.satis} : {}), ...(acilis ? {bosStoktanDus:false} : {bosKonum}), tip: acilis ? 'acilis_ibc' : 'dolum', konum, ambalaj, kaynak: id, tarih, siparis: emir ? NT.stokAkisi.bag(emir.satis) : S.kod(siparis), gram: g, ibcler: ibcler(),
        ...(acilis ? { urun: urun.trim(), partiler: [...new Set(partiler.split(',').map(S.kod).filter(Boolean))] } : {}) })}>
      <div class="us-iki">${acilis ? html`<${Metin} ad="Ürün" deger=${urun} degis=${setUrun} />`
        : emir ? html`<b>${emir.no} · ${k?.yer} · ${emir.eksik} × ${c(emir.ambalaj)}</b>` : html`<${Sec} ad="Dolum kaynağı" liste=${[['', 'Seçin'], ...liste.map((x) => [x.id, kaynakAdi(x) + ' · ' + x.urun, true])]} deger=${id} degis=${setId} />`}
        <${Tarih} tarih=${tarih} degis=${setTarih} /></div>
      ${acilis && html`<${Metin} ad="Batch listesi" deger=${partiler} degis=${setPartiler} />`}
      ${k && html`<div class="us-bilgi"><b>${kg(k.gram)}</b> · ${[...k.partiler.keys()].join(' + ')}</div>`}
      <${Sec} ad="Ambalaj" liste=${[['IBC', 'IBC'], ['Varil', 'Varil']]} deger=${ambalaj}
        degis=${(v) => { setAmbalaj(v); setBosKonum(null); setIlk(''); setElleSatirlar(null); }} />
      <${Konum} deger=${konum} degis=${setKonum} />
      ${!acilis && html`<label class="us-alan">${c('Boş ambalajın alındığı konum')}
        <select class="girdi" value=${bosKonum} onChange=${(e) => setBosKonum(e.currentTarget.value)}>
          ${boslar.length ? boslar.map((x) => html`<option value=${x.konum}>${c(x.konum || 'Konum belirtilmedi')} · ${x.adet}</option>`)
            : html`<option value=${bosKonum}>${c('Boş ambalaj')} · 0</option>`}
        </select></label>`}
      <div class="us-seri">
        <${Metin} ad=${ambalaj === 'IBC' ? 'İlk IBC numarası' : 'İlk varil numarası (isteğe bağlı)'} deger=${ilk} degis=${setIlk} />
        <${Metin} ad=${ambalaj === 'IBC' ? 'IBC adedi' : 'Varil adedi'} inputmode="numeric" deger=${adet} degis=${setAdet} />
        <${Metin} ad="Ortak net kg" inputmode="decimal" deger=${ortak} degis=${setOrtak} />
        ${dugme(elleSatirlar !== null ? 'Listeyi yeniden oluştur' : 'Listeyi oluştur', 'liste', seriYaz)}
      </div>
      ${seriHata && !seri.length && html`<div class="uyari-kutu kritik" role="alert">${c('Sonu rakamla biten bir numara ve 1–100 arası adet girin.')}</div>`}
      ${satirlar.map((i, j) => html`<div class="us-ibc-satir" key=${j}>
        <${Metin} ad=${ambalaj === 'IBC' ? 'IBC numarası' : 'Varil numarası'} deger=${i.no} degis=${degis(j, 'no')} />
        <${Metin} ad="Net kg" inputmode="decimal" deger=${i.kg} degis=${degis(j, 'kg')} />
        <button type="button" class="d ikon-d" aria-label=${c('Kaldır')} onClick=${() => elleDegis((l) => l.filter((_, a) => a !== j))}><${Ikon} ad="kapat" /></button>
      </div>`)}
      <div class="us-islemler">${dugme('Tek ambalaj ekle', 'arti', () => elleDegis((l) => [...l, { no: ambalaj === 'Varil' ? 'VAR-' + S.kod(uid(10)) : '', kg: ortak }]))}
        <b aria-live="polite">${satirlar.length} ${c(ambalaj)} · ${kg(g)} ${k && '· ' + c('Kaynakta kalacak') + ' ' + kg(k.gram - g)}</b></div>
      ${!emir && html`<${Metin} ad="Sipariş no (isteğe bağlı)" deger=${siparis} degis=${setSiparis} />`}
    <//>`;
  }

  function IbcIslemi({ tip, kapat }) {
    const liste = [...veri().ibcler.values()].filter((i) => !i.siparis?.startsWith('EMIR/') && i.durum === (tip === 'ayir' ? 'serbest' : 'ayrildi'));
    const [secili, setSecili] = useState([]);
    const [siparis, setSiparis] = useState('');
    const [tarih, setTarih] = useState(bugun());
    return html`<${KayitFormu} baslik=${turlar[tip]} kapat=${kapat}
      onay=${() => ({ tip, tarih, siparis: S.kod(siparis), numaralar: secili })}>
      <div class="us-iki">${tip !== 'birak' && html`<${Metin} ad=${tip === 'sevk' ? 'Sevkiyat no' : 'Sipariş no'} deger=${siparis} degis=${setSiparis} />`}
        <${Tarih} tarih=${tarih} degis=${setTarih} /></div>
      ${liste.length ? liste.map((i) => html`<label class="us-secim" key=${i.no}><input type="checkbox" checked=${secili.includes(i.no)}
        onChange=${(e) => setSecili(e.currentTarget.checked ? [...secili, i.no] : secili.filter((no) => no !== i.no))} />
        <b>${i.no}</b> · ${c(i.ambalaj)} · ${i.urun} · ${kg(i.gram)} ${i.siparis && '· ' + i.siparis}</label>`) : html`<${BosDurum} ikon="stok" baslik=${c('Seçilebilecek dolu ambalaj yok')} />`}
    <//>`;
  }

  const kapTurleri = ['Varil', 'IBC', 'İsotank'];
  const { AmbalajCizimi } = NT.ui;
  function BosGiris({ kapat, tur = 'Varil', ilkKonum }) {
    const [ambalaj, setAmbalaj] = useState(tur);
    const [konum, setKonum] = useState(S.konumlar.includes(ilkKonum) ? ilkKonum : S.konumlar[0]);
    const [ilk, setIlk] = useState('');
    const [adet, setAdet] = useState('1');
    const [tarih, setTarih] = useState(bugun());
    const tank = ambalaj === 'İsotank';
    return html`<${KayitFormu} bos baslik="Boş ambalaj girişi" kapat=${kapat}
      onay=${() => ({ tip: 'bos_giris', konum, ambalaj, tarih, ...(tank ? {numaralar:[S.kod(ilk)]} : {adet:Number(adet)}) })}>
      <${Sec} ad="Ambalaj" liste=${kapTurleri.map((t) => [t,t])} deger=${ambalaj} degis=${setAmbalaj} />
      ${tank ? html`<${Metin} ad="İsotank numarası" deger=${ilk} degis=${setIlk} />`
        : html`<${Metin} ad="Adet" inputmode="numeric" deger=${adet} degis=${setAdet} />`}
      <${Konum} deger=${konum} degis=${setKonum} />
      <${Tarih} tarih=${tarih} degis=${setTarih} /><//>`;
  }
  function KaynakKartlari({ kaynaklar }) {
    return kaynaklar.length ? html`<div class="us-kaplar">${kaynaklar.map((k) => html`<article class="us-kap" key=${k.id}>
      <div class="us-kap-bas">${k.tur === 'isotank' ? html`<${AmbalajCizimi} tur="İsotank" />` : html`<${Ikon} ad="dolum" />`}
        <div><strong>${kaynakAdi(k)}</strong><small>${c(k.urun)} · ${c(k.konum || 'Konum belirtilmedi')}</small></div></div>
      <b>${kg(k.gram)}</b><div class="us-batch">${[...k.partiler].map(([p,g]) => html`<span class="rozet bilgi">${p}${g != null ? ' · ' + kg(g) : ''}</span>`)}</div>
      <div class="us-islemler">${k.cins === 'urun' ? html`${dugme('Ambalaj doldur', 'dolum', () => dolumAc(k))}
            ${k.tur === 'uretim' ? dugme('İsotanka aktar', 'sevk', () => aktarmaAc(k)) : dugme('Batch ekle', 'arti', () => girisAc({ kaynak: k }))}`
            : dugme('Tüketim gir', 'eksi', () => tuketimAc(k))}</div>
    </article>`)}</div>` : html`<${BosDurum} ikon="stok" baslik=${c('Stok kaydı yok')} />`;
  }
  function AmbalajKartlari({ liste }) {
    return html`<div class="us-kaplar">${liste.map((i) => html`<article key=${i.no} class="us-kap">
      <div class="us-kap-bas"><${AmbalajCizimi} tur=${i.ambalaj} /><div><strong>${i.no}</strong><small>${i.urun} · ${c(i.konum || 'Konum belirtilmedi')}</small></div></div>
      <div><b>${kg(i.gram)}</b> <span class=${'rozet ' + (i.durum === 'ayrildi' ? 'kritik' : i.durum === 'sevk' ? 'bilgi' : 'iyi')}>${c(durumlar[i.durum])}</span></div>
      <small>${i.kaynakTur === 'acilis' ? c('Açılış stoku') : kaynakAdi({tur:i.kaynakTur, yer:i.kaynak})}</small>
      <div class="us-batch">${i.partiler.map((p) => html`<span class="rozet bilgi">${p}</span>`)}</div>
      ${i.siparis && html`<small>${c('Sipariş / sevkiyat')} · ${[...new Set([siparisAdi(i.siparis),i.sevk].filter(Boolean))].join(' / ')}</small>`}
    </article>`)}</div>`;
  }
  function raftakiler(s, tur, bos, konum) {
    const uygun = (x) => !konum || (x.konum || '?') === konum;
    if (bos) return [...s.bos.values()].filter((x) => x.ambalaj === tur && uygun(x));
    if (tur === 'İsotank') return aktif(s).filter((x) => x.tur === 'isotank' && uygun(x));
    return [...s.ibcler.values()].filter((x) => x.ambalaj === tur && x.durum !== 'sevk' && uygun(x));
  }
  function RafDetayi({ tur, bos, konum, kapat }) {
    const liste = raftakiler(veri(), tur, bos, konum);
    return html`<${Modal} genis baslik=${c(bos ? 'Boş ambalaj' : 'Dolu stok') + ' · ' + c(tur)} kapat=${kapat}>
      <div class="modal-ic">${bos && html`<div class="us-islemler">${dugme('Boş ambalaj girişi','arti',() => { kapat(); formAc(BosGiris,{tur,ilkKonum:konum}); })}</div>`}
      ${!liste.length ? html`<${BosDurum} ikon="kutu" baslik=${c('Stok kaydı yok')} />`
        : bos ? html`<div class="us-bos-birimler">${liste.map((x) => html`<span class="us-birim"><${AmbalajCizimi} tur=${tur} /><b>${tur === 'İsotank' ? x.no : x.adet + ' × ' + c(tur)}</b> · ${c(x.konum || 'Konum belirtilmedi')}</span>`)}</div>`
        : tur === 'İsotank' ? html`<${KaynakKartlari} kaynaklar=${liste} />` : html`<${AmbalajKartlari} liste=${liste} />`}
      </div><//>`;
  }
  function Raf({ s, bos = false, konum }) {
    return html`<${K.Kart} baslik=${c(bos ? 'Boş ambalaj' : 'Dolu stok')}>
      <div class="us-raf">${kapTurleri.map((tur) => {
        const l = raftakiler(s,tur,bos,konum);
        return html`<button type="button" class="tz-yuva us-yuva" onClick=${() => K.ac(RafDetayi,{tur,bos,konum})}>
          <span class="rozet-n">${bos ? l.reduce((n,x) => n+x.adet,0) : l.length}</span><${AmbalajCizimi} tur=${tur} boyut=${1.5} />
          <strong>${c(tur)}</strong>${!bos && html`<small>${kg(S.toplam(l))}</small>`}</button>`;
      })}</div><//>`;
  }
  function Genel() {
    const [konum, setKonum] = useState('');
    const uygun = (x) => !konum || (x.konum || '?') === konum;
    const s = veri();
    useEffect(() => {
      if (yogunSunum) S.bosSunumuHazirla(b.depo).catch((e) => bildir(e.message));
    }, []);
    const doluSayisi = kapTurleri.reduce((n,tur) => n + raftakiler(s,tur,false,konum).length,0);
    const bosSayisi = [...s.bos.values()].filter(uygun).reduce((n,x) => n+x.adet,0);
    return html`<${K.Selam} bant baslik=${NT.ui.karsilama(b.kullanici)}>
      ${c('Dolu ambalaj')} <b>${doluSayisi}</b> · ${c('Boş ambalaj')} <b>${bosSayisi}</b><//>
      <div class="ur-pano-araclar"><${Konum} tumu deger=${konum} degis=${setKonum} /><div class="us-islemler">
      ${!yogunSunum && html`<a class="d" href=${NT.c.adres('uretimstok',{demo:true,kullanici:b.kullanici})+'&ornek=yogun'}>${c('Yoğun sunumu aç','Open sample inventory','Открыть демоверсию с примерами')}</a>`}
      ${yogunSunum && K.yetkili() && html`<a class="d" href=${NT.c.adres('satis',{kullanici:b.kullanici})+'#/sevkiyatlar'}>${c('Satış Takip')}</a>`}
      ${dugme('Boş ambalaj girişi','kutu',() => formAc(BosGiris,{ilkKonum:konum}))}
      ${dugme('Stok girişi','arti',() => girisAc(),true)}</div></div>
      <div class="us-raf-izgara"><${Raf} s=${s} konum=${konum} bos /><${Raf} s=${s} konum=${konum} /></div>
      <${K.Kart} baslik=${c('Malzeme bakiyeleri')}><div class="us-malzemeler">${Object.entries(S.cinsler).map(([id,ad]) => {
        const g = S.toplam(aktif(s).filter((k) => k.cins === id && uygun(k))) + (id === 'urun' ? S.toplam([...s.ibcler.values()].filter((i) => i.durum !== 'sevk' && uygun(i))) : 0);
        return html`<div><small>${c(ad)}</small><b>${kg(g)}</b></div>`;
      })}</div><//>
      <${K.Kart} baslik=${c('Son hareketler')} sag=${html`<a class="d" href="#/hareketler">${c('Tümü')}</a>`}>
        <${HareketAkisi} hareketler=${s.hareketler.slice(-4)} kaynaklar=${s.kaynaklar} /><//>`;
  }
  function Stok() {
    const s = veri();
    const [filtre, setFiltre] = useState('');
    const kaynaklar = aktif(s).filter((k) => !filtre || k.cins === filtre);
    const dolu = [...s.ibcler.values()].filter((i) => i.durum !== 'sevk');
    return html`<${K.Selam} bant baslik=${c('Üretim Stoku')} sag=${html`<div class="us-islemler">
        ${!yogunSunum && html`<a class="d" href=${NT.c.adres('uretimstok', { demo: true, kullanici: b.kullanici }) + '&ornek=yogun'}>${c('Yoğun sunumu aç', 'Open sample inventory', 'Открыть демоверсию с примерами')}</a>`}
        ${dugme('Stok girişi', 'arti', () => girisAc(), true)}</div>`}>
      ${c('CTO, gliserin ve son ürün bakiyeleri') }<//>
      <div class="kpi-sira">${Object.entries(S.cinsler).map(([id, ad]) => {
        const g = S.toplam(aktif(s).filter((k) => k.cins === id)) + (id === 'urun' ? S.toplam(dolu) : 0);
        return html`<${K.Kpi} ad=${c(ad)} ikon=${id === 'urun' ? 'stok' : 'dolum'} deger=${kgDegeri(g)} birim="kg"
          alt=${id === 'urun' ? m('{0} IBC · {1} varil', dolu.filter((i) => i.ambalaj === 'IBC').length, dolu.filter((i) => i.ambalaj === 'Varil').length) : ''} />`;
      })}</div>
      <${K.Kart} baslik=${c('Kaynak bakiyeleri')} sag=${html`<${Sec} ad="Stok grubu" liste=${[['', 'Tümü'], ...Object.entries(S.cinsler)]} deger=${filtre} degis=${setFiltre} />`}>
        ${kaynaklar.some((k) => k.partiler.size > 1) && html`<div class="us-bilgi">${c('Karışımlı tankta batch satırları yüklemeyi, kalan net kg tankın güncel toplamını gösterir.')}</div>`}
        <${KaynakKartlari} kaynaklar=${kaynaklar} /><//>`;
  }
  function Ibcler() {
    const [q, setQ] = useState('');
    const [durum, setDurum] = useState('dolu');
    const l = [...veri().ibcler.values()].filter((i) => (durum === 'hepsi' || (durum === 'dolu' ? i.durum !== 'sevk' : i.durum === durum))
      && ara([i.no, i.urun, i.kaynak, ...i.partiler, siparisAdi(i.siparis), i.sevk].join(' '), q));
    return html`<${K.Selam} baslik=${c('IBC ve Variller')} sag=${html`<div class="us-islemler">${dugme('Dolu ambalaj açılışı', 'arti', acilisIbcAc)}
      ${dugme('Ambalaj dolumu', 'dolum', () => dolumAc(), true)}</div>`}>
      ${c('Dolum kaynağı, batch listesi, net kg ve sipariş durumu')}<//>
      <div class="us-islemler us-ibc-araclar">
        <${Metin} ad="Ara" deger=${q} degis=${setQ} placeholder="Ambalaj no, batch, sipariş…" />
        <${Sec} ad="Durum" liste=${[['dolu', 'Tesisteki ambalajlar'], ['hepsi', 'Tümü'], ...Object.entries(durumlar)]} deger=${durum} degis=${setDurum} />
        ${dugme('Siparişe ayır', 'kutu', () => ibcAc('ayir'))}
        ${dugme('Ayırmayı kaldır', 'geri', () => ibcAc('birak'))}
        ${dugme('Sevk çıkışı', 'sevk', () => ibcAc('sevk'))}
      </div>
      <${K.Kart}>${l.length ? html`<${AmbalajKartlari} liste=${l} />`
        : html`<${BosDurum} ikon="kutu" baslik=${c('Bu görünümde dolu ambalaj yok')} />`}<//>`;
  }
  function HareketAkisi({ hareketler, kaynaklar }) {
    function numaraListesi(numaralar) {
      if (numaralar.length <= 3) return numaralar.join(', ');
      return html`<details><summary>${NT.dil.m('{0} ambalaj', numaralar.length)} · ${numaralar[0]} …</summary>${numaralar.join(', ')}</details>`;
    }
    function ayrinti(h) {
      if (h.tip === 'bos_giris') return html`<span>${c(h.ambalaj)}</span> ${h.ambalaj === 'İsotank' ? numaraListesi(h.numaralar) : (h.adet ?? h.numaralar.length) + ' · ' + c(h.konum || 'Konum belirtilmedi')}`;
      if (h.tip === 'giris') return [h.yer, h.urun, ...(h.partiler || [h.parti]), h.not].filter(Boolean).join(' · ');
      if (h.tip === 'dolum') return html`${[kaynaklar.get(h.kaynak)?.yer,siparisAdi(h.siparis)].filter(Boolean).join(' · ')} ${numaraListesi(h.ibcler.map((i) => i.no))}`;
      if (h.tip === 'acilis_ibc') return html`${h.urun} · ${h.partiler.join(' + ')} ${numaraListesi(h.ibcler.map((i) => i.no))}`;
      if (h.tip === 'tuketim' || h.tip === 'aktar') return [kaynaklar.get(h.kaynak)?.yer, h.parti || h.yer].filter(Boolean).join(' → ');
      return html`${siparisAdi(h.siparis)} ${numaraListesi(h.numaralar)}`;
    }
    return hareketler.length ? html`<ol class="us-akis">${[...hareketler].reverse().map((h) => html`<li key=${h.id}>
      <div><b>${c(h.acilis ? 'Açılış stoku' : turlar[h.tip])}</b><small>${tarihYaz(h.tarih)} · ${h._olusturan || h._degistiren}</small></div>
      <div class="us-akis-detay">${ayrinti(h)}</div>${h.gram ? html`<strong>${kg(h.gram)}</strong>` : null}</li>`)}</ol>`
      : html`<${BosDurum} ikon="liste" baslik=${c('Stok hareketi yok')} />`;
  }
  function DolumEmirleri() {
    const liste = NT.stokAkisi.emirler(b.depo);
    return html`<${K.Selam} bant baslik=${c('Dolum iş emirleri')} /><${K.Kart}>
      ${liste.length ? html`<div class="us-kaplar">${liste.map((e) => html`<article class="us-kap">
        <strong>${e.no} · ${e.urun}</strong><b>${e.eksik} × ${c(e.ambalaj)}</b>
        <small>${c('Dolum kaynağı')} · ${veri().kaynaklar.get(e.kaynak)?.yer || e.kaynak}</small>
        ${dugme('Dolumu kaydet','dolum',()=>formAc(Dolum,{kaynak:e.kaynak,emir:e}))}</article>`)}</div>`
        : html`<${BosDurum} ikon="liste" baslik=${c('Açık dolum emri yok')} />`}<//>`;
  }
  function Hareketler() {
    const s = veri();
    return html`<${K.Selam} baslik=${c('Stok hareketleri')} /><${K.Kart}><${HareketAkisi} hareketler=${s.hareketler} kaynaklar=${s.kaynaklar} /><//>`;
  }

  const bulutlu = (Sayfa) => () => {
    const d = b.depo;
    if (b.mod === 'demo' || (!d.tabloEksik && (d.sonEsitleme || d.cevrimici))) return html`<${Sayfa} />`;
    return html`<${K.Selam} bant baslik=${c('Üretim Stoku')} />
      <${K.Kart}><${BosDurum} ikon="uyari"
        baslik=${c(d.tabloEksik ? 'Bulut kurulumu bekleniyor' : 'Stok bakiyeleri alınamadı')}
        aciklama=${c(d.tabloEksik ? 'Üretim Stoku etkinleştirildikten sonra açılış stokunu girebilirsiniz.' : 'Bağlantınız geldiğinde stok bakiyeleri yeniden alınır.')} /><//>`;
  };

  const sorgu = new URLSearchParams(location.search);
  const yogunSunum = sorgu.has('demo') && sorgu.get('ornek') === 'yogun';
  K.demoTanimla(yogunSunum ? S.yogunSunum : async () => {}, {
    paylas: true, depoAdi: yogunSunum ? 'uretimstok-yogun' : undefined,
  });
  K.calistir({
    sekmeler: [{ id: 'genel', ad: 'Genel Bakış', ikon: 'ozet' }, { id: 'stok', ad: 'Stok', ikon: 'stok' }, { id: 'ibcler', ad: 'IBC ve Variller', ikon: 'kutu' }, { id: 'emirler', ad: 'Dolum iş emirleri', ikon: 'liste' }, { id: 'hareketler', ad: 'Hareketler', ikon: 'liste' }],
    sayfalar: { emirler: bulutlu(DolumEmirleri), genel: bulutlu(Genel), stok: bulutlu(Stok), ibcler: bulutlu(Ibcler), hareketler: bulutlu(Hareketler) },
    eylemler: [{ ad: 'Stok girişi', alt: 'Açılış stoku veya yeni giriş', ikon: 'arti', fn: () => girisAc() },
      { ad: 'Ambalaj dolumu', alt: 'İsotanktan veya üretimden', ikon: 'dolum', fn: () => dolumAc() }],
    geri: { yazi: c('Üretim paneli'), adres: NT.c.adres('portal', { panel: 'uretim', kullanici: new URLSearchParams(location.search).get('kullanici') }) },
    uzakKoleksiyonlar: ['stok','bosAmbalaj','dolumEmri'],
  });
})();
