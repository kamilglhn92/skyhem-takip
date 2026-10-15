/* Ortak ekran parçaları: hareket defteri, WhatsApp sayım listesi, Excel (.xlsx) dışa aktarma, sayfa başlığı.
   (Klasik tasarımın tablo ekranları 01.10.2026'da kaldırıldı; arayüz tezgah.js'tir.) */
(function () {
  'use strict';
  const NT = window.NT;
  const { html } = window.htmPreact;
  const { Ikon, StokRozeti, Modal, BosDurum, bildir } = NT.ui;
  const H = NT.hesap;
  const F = NT.form;
  const { tarihYaz, bugun, trSirala, indir } = NT.c;
  const depo = () => NT.baglanti.depo;

  /* tezgah.js kendi sihirbazlarını buraya bağlar; yoksa klasik formlar açılır. */
  const eylem = (ad, on) => (NT.eylem && NT.eylem[ad] ? NT.eylem[ad](on) : { dolum: F.yeniDolum, sevk: F.yeniSevk, alim: F.yeniAlim }[ad](on));

  async function whatsappKopyala() {
    const metin = H.whatsappMetni(depo());
    try {
      await navigator.clipboard.writeText(metin);
      bildir('Sayım listesi panoya kopyalandı. WhatsApp’a yapıştırabilirsiniz.');
    } catch {
      NT.form.ac(({ kapat }) => html`<${Modal} baslik="WhatsApp sayım metni" kapat=${kapat}><div class="modal-ic"><textarea class="girdi mono" rows="18" readonly onFocus=${(e) => e.target.select()}>${metin}</textarea></div><//>`);
    }
  }

  function SayfaBasi({ baslik, aciklama, children }) {
    return html`<div class="sayfa-bas"><div><h1>${baslik}</h1>${aciklama && html`<p>${aciklama}</p>`}</div><div class="sag">${children}</div></div>`;
  }
  function Segment({ secenekler, deger, degis }) {
    return html`<div class="segment" role="tablist">${secenekler.map(([id, ad, n]) => html`<button role="tab" aria-selected=${deger === id} class=${deger === id ? 'secili' : ''} onClick=${() => degis(id)}>${ad}${n != null && html`<span class="n">${n}</span>`}</button>`)}</div>`;
  }
  /* ---------------- Defter: bir kalemin hareketleri, yürüyen bakiyeyle (tablo değil, zaman çizgisi) ---------------- */
  const TUR = { alim: 'Şişe girişi', dolum: 'Dolum', sevk: 'Gönderi', sayim: 'Sayım' };
  function DefterPenceresi({ hedef, kapat }) {
    const d = depo();
    const bosMu = !!hedef.bos;
    const satirlar = H.defter(d, hedef);
    const st = H.stok(d);
    const kalem = bosMu ? st.bos.get(hedef.ambalaj) : st.dolu.get(H.anahtar(hedef.urun, hedef.parti, hedef.ambalaj));
    const mevcut = kalem?.mevcut ?? 0;
    const baslik = bosMu ? `${H.ambalajAdi(d, hedef.ambalaj)} boş şişe` : `${hedef.urun} ${hedef.parti ? '· ' + hedef.parti + ' ' : ''}· ${H.ambalajAdi(d, hedef.ambalaj)}`;
    const ozet = bosMu
      ? [['Rafta', mevcut], ['Toplam gelen', kalem?.alinan ?? 0], ['Dolumda kullanılan', kalem?.kullanilan ?? 0]]
      : [['Rafta', mevcut], ['Doldurulan', kalem?.doldurulan ?? 0], ['Gönderilen', kalem?.gonderilen ?? 0], ['Ayrılmış (bekleyen gönderi)', kalem?.rezerve ?? 0]];
    return html`<${Modal} genis baslik=${baslik} kapat=${kapat}
      sag=${bosMu ? kalem && html`<${StokRozeti} durum=${kalem.durum} />` : (() => {
        const t = st.urunAmbalaj.get(`${hedef.urun}|${hedef.ambalaj}`);
        return html`${kalem?.durum === 'eksi' && html`<${StokRozeti} durum="eksi" />`}${t && t.alarm && html`<span class="kucuk soluk">Tüm partiler: ${t.mevcut}</span> <${StokRozeti} durum=${t.durum} />`}`;
      })()}
      alt=${html`<div class="sol"><button class="d" onClick=${() => F.sayim(hedef)}><${Ikon} ad="sayim" />Sayım düzelt</button></div>
        ${bosMu ? html`<button class="d" onClick=${() => { kapat(); eylem('alim', { ambalaj: hedef.ambalaj }); }}><${Ikon} ad="alim" />Şişe geldi</button>`
          : html`<button class="d" onClick=${() => { kapat(); eylem('sevk', { sepet: [{ anahtar: H.anahtar(hedef.urun, hedef.parti, hedef.ambalaj), urun: hedef.urun, parti: hedef.parti || '', ambalaj: hedef.ambalaj, adet: 1 }] }); }}><${Ikon} ad="sevk" />Numune gönder</button>`}
        <button class="d ana-d" onClick=${() => { kapat(); eylem('dolum', { urun: hedef.urun || H.urunler(d)[0]?.ad || '', parti: hedef.parti || '', ambalaj: hedef.ambalaj }); }}><${Ikon} ad="dolum" />Dolum yaptım</button>`}>
      <div class="modal-ic">
        <div class="defter-ozet">${ozet.map(([ad, n], i) => html`<div class=${i === 0 ? 'ana-sayi' : ''}><span>${ad}</span><b>${n}</b></div>`)}</div>
        ${satirlar.length ? html`<ul class="tz-akis defter-akis">${satirlar.map((x) => {
          const acilir = ['dolum', 'sevk', 'alim'].includes(x.c);
          const tur = x.adet > 0 ? 'arti' : x.adet < 0 ? 'eksi' : 'notr';
          return html`<li class=${acilir ? '' : 'sabit'} onClick=${() => acilir && F.kayitAc(x.c, x.r)}>
            <span class=${'ik ' + x.c}><${Ikon} ad=${x.c} /></span>
            <span class="ne">${x.aciklama}${x.rezerve ? html` <span class="rozet bilgi">${x.rezerve} ayrıldı</span>` : ''}
              <small>${tarihYaz(x.tarih)} · ${TUR[x.c]}${x.r.no ? ' · ' + x.r.no : ''}</small></span>
            <span class="defter-sag"><span class=${'miktar ' + tur}>${x.adet > 0 ? '+' : ''}${x.adet || '—'}</span><small>bakiye ${x.bakiye}</small></span>
          </li>`;
        })}</ul>`
        : html`<${BosDurum} baslik="Hareket yok" aciklama="Bu kalem için henüz dolum, gönderi veya şişe girişi yok." />`}
      </div>
    <//>`;
  }
  const defterAc = (hedef) => F.ac(DefterPenceresi, { hedef });

  /* ---------------- Excel (.xlsx) dışa aktarma ----------------
     Gerçek .xlsx üretilir (xlsx.js): Excel CSV'deki gibi sample no'ların baştaki sıfırını silmeye
     ya da tarihleri sayıya çevirmeye kalkmaz. */
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const yeniden = (a, b) => (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : b._olusturma - a._olusturma);
  /* kolonlar: [{ baslik, deger(r), tur?: 'metin'|'sayi'|'tarih'|'kod', genislik?, hiza? }] */
  function tabloIndir(ad, sayfa, kayitlar, kolonlar) {
    const blob = NT.xlsx({
      sayfa, renkli: true, baslik: kolonlar.map((k) => k.baslik), baslikYukseklik: 30,
      sutunlar: kolonlar.map((k) => ({ genislik: k.genislik || 14 })),
      satirlar: kayitlar.map((r) => ({ hucreler: kolonlar.map((k) => ({ v: k.deger(r) ?? '', tur: k.tur, hiza: k.hiza })) })),
    });
    indir(`${ad}-${bugun()}.xlsx`, blob, XLSX);
  }

  /* "Batch #21" → "21st batch" (Farukcan'ın tablosundaki yazım) */
  function partiIngilizce(p) {
    const m = /^Batch #(\d+)$/.exec(p || '');
    if (!m) return p === 'Diğer' ? '' : p || '';
    const n = +m[1], son = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th';
    return `${n}${son} batch`;
  }

  const disaAktar = {
    stok() {
      const d = depo();
      const l = [...H.stok(d).dolu.values()].filter((x) => x.mevcut !== 0 || x.rezerve).sort((a, b) => trSirala(a.urun, b.urun) || H.partiNo(b.parti) - H.partiNo(a.parti));
      const bos = H.ambalajlar(d).map((a) => ({ urun: 'BOŞ ŞİŞE', parti: '', ambalaj: a.id, doldurulan: '', gonderilen: '', duzeltme: H.stok(d).bos.get(a.id)?.duzeltme ?? 0, mevcut: H.stok(d).bos.get(a.id)?.mevcut ?? 0, rezerve: '', sonDolum: '' }));
      tabloIndir('raf-stok', 'Raf', [...bos, ...l], [
        { baslik: 'Ürün', deger: (x) => x.urun, genislik: 18 }, { baslik: 'Parti', deger: (x) => x.parti }, { baslik: 'Ambalaj', deger: (x) => H.ambalajAdi(d, x.ambalaj), genislik: 10 },
        { baslik: 'Doldurulan', deger: (x) => x.doldurulan, tur: 'sayi', genislik: 11 }, { baslik: 'Gönderilen', deger: (x) => x.gonderilen, tur: 'sayi', genislik: 11 },
        { baslik: 'Sayım düzeltmesi', deger: (x) => x.duzeltme, tur: 'sayi', genislik: 11 }, { baslik: 'Rafta', deger: (x) => x.mevcut, tur: 'sayi', genislik: 9 },
        { baslik: 'Ayrılmış', deger: (x) => x.rezerve, tur: 'sayi', genislik: 9 }, { baslik: 'Son dolum', deger: (x) => x.sonDolum || '', tur: 'tarih', genislik: 12 }]);
    },
    dolum() {
      const d = depo();
      tabloIndir('dolumlar', 'Dolumlar', d.kayitlar('dolum').sort(yeniden), [
        { baslik: 'No', deger: (r) => r.no, genislik: 15 }, { baslik: 'Tarih', deger: (r) => r.tarih, tur: 'tarih', genislik: 12 }, { baslik: 'Ürün', deger: (r) => r.urun, genislik: 18 },
        { baslik: 'Parti', deger: (r) => r.parti }, { baslik: 'Ambalaj', deger: (r) => H.ambalajAdi(d, r.ambalaj), genislik: 10 }, { baslik: 'Adet', deger: (r) => r.adet, tur: 'sayi', genislik: 8 },
        { baslik: 'Hazırlayan', deger: (r) => r.hazirlayan, genislik: 18 }, { baslik: 'Nereden dolduruldu', deger: (r) => H.dolumKaynagi(r), genislik: 26, hiza: 'sol' }, { baslik: 'Not', deger: (r) => r.notlar, genislik: 36, hiza: 'sol' }, { baslik: 'Kaydeden', deger: (r) => r._olusturan, genislik: 18 }]);
    },
    /* Farukcan'ın !SAMPLES.xlsx şablonu: aynı 15 sütun, sıra, genişlik ve gizli sütunlar (Request date,
       Responsible person, Feedback), aynı renkler. Gönderi başına bir satır; yalnızca yola çıkmış ve iptal
       edilen gönderiler (iptaller üstü çizili, şablondaki gibi). */
    sevk() {
      const d = depo();
      const gonderiler = d.kayitlar('sevk').filter((s) => s.durum === 'Gönderildi' || s.iptal)
        .sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : (a.no || '') < (b.no || '') ? -1 : 1));
      const benzersiz = (l) => [...new Set(l.filter(Boolean))];
      const hucreler = (s, n) => {
        const kalemler = s.kalemler || [];
        const nolar = H.siseSlotlari(kalemler, s.siseler || []).flat().map((x) => x.no).filter(Boolean);
        const sise = kalemler.map((k) => `${k.adet} bottle${+k.adet > 1 ? 's' : ''} x ${H.ambalajAdi(d, k.ambalaj).toLocaleLowerCase('tr-TR')}`);
        const notlar = String(s.notlar || '').split('\n').filter((x) => x.trim() && !/^Excel №/.test(x));
        return [
          { v: n, tur: 'sayi' },
          { v: benzersiz(kalemler.map((k) => k.urun)).join('\n') },
          { v: s.talepTarihi || '', tur: 'tarih' },
          { v: s.sorumlu || '' },
          { v: s.tarih, tur: 'tarih' },
          { v: H.ulkeIngilizce(s.ulke) },
          { v: s.firma },
          { v: s.adres, hiza: 'sol' },
          { v: [s.yetkili, s.irtibatDetay, s.telefon].filter(Boolean).join('\n'), hiza: 'sol' },
          { v: s.sebep, hiza: 'sol' },
          { v: H.sevkLitre(d, kalemler), tur: 'ondalik' },
          { v: s.numuneYeri || benzersiz(kalemler.map((k) => partiIngilizce(k.parti))).join('\n'), hiza: 'sol' },
          { v: [...sise, ...notlar].join('\n'), hiza: 'sol' },
          { v: nolar.join('\n'), tur: 'kod' },
          { v: s.geriBildirim || '' },
        ];
      };
      const blob = NT.xlsx({
        sayfa: 'SAMPLES', yakinlastir: 70,
        baslik: ['№', 'Product name', 'Request date', 'Responsible person', 'Dispatch date', 'Country', 'Company', 'Destination', 'Contact person', 'Aim', 'Quantity, liters', 'Batch / Point of sampling', 'Comments', 'Identification number', 'Feedback'],
        sutunlar: [4.33, 13, [13.11, 1], [13.11, 1], 14.66, 13.11, 24.33, 30.44, 35.33, 22.11, 9.44, 25.44, 36.66, 24, [1.33, 1]]
          .map((x) => (Array.isArray(x) ? { genislik: x[0], gizli: true } : { genislik: x })),
        satirlar: gonderiler.map((s, i) => ({ hucreler: hucreler(s, i + 1), cizili: !!s.iptal })),
      });
      indir(`gonderiler-${bugun()}.xlsx`, blob, XLSX);
    },
    alim() {
      const d = depo();
      tabloIndir('sise-girisleri', 'Şişe girişleri', d.kayitlar('alim').sort(yeniden), [
        { baslik: 'No', deger: (r) => r.no, genislik: 15 }, { baslik: 'Tarih', deger: (r) => r.tarih, tur: 'tarih', genislik: 12 }, { baslik: 'Ambalaj', deger: (r) => H.ambalajAdi(d, r.ambalaj), genislik: 10 },
        { baslik: 'Adet', deger: (r) => r.adet, tur: 'sayi', genislik: 8 }, { baslik: 'Tedarikçi', deger: (r) => r.tedarikci, genislik: 22 }, { baslik: 'Fatura no', deger: (r) => r.faturaNo, tur: 'kod' },
        { baslik: 'Birim fiyat', deger: (r) => r.birimFiyat, tur: 'sayi', genislik: 11 }, { baslik: 'Not', deger: (r) => r.notlar, genislik: 36, hiza: 'sol' }]);
    },
  };

  NT.ekran = { defterAc, whatsappKopyala, disaAktar, SayfaBasi, Segment };
})();
