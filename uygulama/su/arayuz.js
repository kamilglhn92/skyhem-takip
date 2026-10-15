/* İçme Suyu — arayüz: genel bakış, siparişler, faturalar (ay sonu kontrol), fiyatlar, ayarlar. */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, useState } = window.htmPreact;
  const { Ikon, Modal, Alan, AdetGirdi, BosDurum, Ekler, GecmisBolumu, bildir } = NT.ui;
  const K = NT.kabuk;
  const S = NT.su;
  const { bugun, uid, sayi, tarihYaz, gunFarki, ara, AYLAR } = NT.c;
  const b = NT.baglanti;
  const depo = () => b.depo;
  const lt = (n) => `${K.sayiYaz(n)} L`;
  const tl = (n) => `${K.sayiYaz(n, Math.abs(n - Math.round(n)) > 0.004 ? 2 : 0)} ₺`;
  const isaretli = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + tl(Math.abs(n));
  const adetYazi = (x) => S.URUNLER.filter((u) => sayi(x[u.id]) > 0).map((u) => `${sayi(x[u.id])} ${u.birim}`).join(' + ') || '—';

  Object.assign(NT.ui.ALAN_ADLARI, {
    damacana: 'Damacana', bardak: 'Bardak su (koli)', siparis: 'Sipariş', kdv: 'KDV (%)', aciklama: 'Açıklama', kapandi: 'Kalanı kapatıldı', kapanisNot: 'Kapanış notu',
    tutar: 'Fatura tutarı', faturaNo: 'Fatura no', faturaTarihi: 'Fatura tarihi', ay: 'Dönem', tedarikci: 'Su firması', mesaj: 'WhatsApp mesajı',
    koliBardak: 'Koli içi bardak', bardakMl: 'Bardak (ml)', damacanaL: 'Damacana (L)',
  });
  NT.ui.DEGER_YAZ.siparis = (v) => depo()?.kayit('siparis', v)?.no || v;
  NT.ui.DEGER_YAZ.ay = (v) => S.ayAdi(v);

  /* ---------------- Çizimler: damacana ve bardak su kolisi ---------------- */
  const R = { s: 'var(--bilgi)', f: 'color-mix(in srgb, var(--bilgi) 30%, var(--yuzey))', z: 'var(--yuzey)', k: 'color-mix(in srgb, var(--bilgi) 75%, var(--murekkep))' };
  function Cizim({ tur, boyut = 1 }) {
    const g = (w, h, ic) => html`<svg width=${w * boyut} height=${h * boyut} viewBox=${`0 0 ${w} ${h}`} aria-hidden="true" class="su-cizim">${ic}</svg>`;
    if (tur === 'damacana') return g(30, 42, html`
      <rect x="11" y="1" width="8" height="4.5" rx="1.2" fill=${R.k} />
      <path d="M11.5 5.5h7v2.6Q26 10 26 16.5V36q0 4-4 4H8q-4 0-4-4V16.5Q4 10 11.5 8.1z" fill=${R.z} stroke=${R.s} stroke-width="1.5" stroke-linejoin="round" />
      <path d="M5.2 19q4.9-1.6 9.8 0t9.8 0V36q0 2.8-2.8 2.8H8q-2.8 0-2.8-2.8z" fill=${R.f} />
      <path d="M4 25.5h22M4 32h22" stroke=${R.s} stroke-width=".9" opacity=".7" />
      <path d="M8.5 13.5q-1.6 3-1.6 6" stroke=${R.z} stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".9" />`);
    /* Kapağı folyolu, konik plastik su bardağı */
    if (tur === 'bardak') return g(32, 42, html`
      <path d="M5 9.5h22l-3.4 29.2q-.2 1.8-2 1.8H10.4q-1.8 0-2-1.8z" fill=${R.z} stroke=${R.s} stroke-width="1.5" stroke-linejoin="round" />
      <path d="M6.4 17h19.2l-2.6 21.4q-.1 1-1.1 1H10.1q-1 0-1.1-1z" fill=${R.f} />
      <path d="M7.6 27.5h16.8M8.4 33.5h15.2" stroke=${R.s} stroke-width=".8" opacity=".55" />
      <rect x="3" y="5.5" width="26" height="4.5" rx="1.6" fill=${R.k} />
      <path d="M27.5 6.2l3.4-3.3q.6-.6 1 .2l-1.6 4.2z" fill=${R.k} />
      <path d="M16 20.5s2.4 2.6 2.4 4.1a2.4 2.4 0 01-4.8 0c0-1.5 2.4-4.1 2.4-4.1z" fill=${R.s} opacity=".85" />`);
    return null;
  }

  /* ---------------- Durum ---------------- */
  const ROZET = { Bekliyor: ['kritik', 'saat'], 'Kısmi geldi': ['mor', 'uyari'], Geldi: ['iyi', 'daire_tik'], Kapatıldı: ['', 'tik'], İptal: ['yok', 'kapat'] };
  function DurumRozeti({ ad }) {
    const [r, ik] = ROZET[ad] || ['', 'bilgi'];
    return html`<span class=${'rozet ' + r}><${Ikon} ad=${ik} />${ad}</span>`;
  }
  function KontrolRozeti({ x, buAy }) {
    if (x.kontrol === 'esit') return html`<span class="rozet iyi"><${Ikon} ad="daire_tik" />Eşleşiyor</span>`;
    if (x.kontrol === 'fark') return html`<span class="rozet yok"><${Ikon} ad="uyari" />Fark var</span>`;
    if (x.kontrol === 'bekliyor') return x.ay === buAy ? html`<span class="rozet bilgi"><${Ikon} ad="saat" />Ay sürüyor</span>` : html`<span class="rozet kritik"><${Ikon} ad="fatura" />Fatura bekleniyor</span>`;
    return html`<span class="soluk">—</span>`;
  }

  /* Bir sebep sorup onaylayan küçük pencere (iptal, kalanı kapatma). */
  function NedenPenceresi({ baslik, aciklama, evet, placeholder, tehlike, tamam, kapat }) {
    const [neden, setNeden] = useState('');
    return html`<${Modal} dar baslik=${baslik} kapat=${kapat} alt=${html`<button class="d hayalet" onClick=${kapat}>Vazgeç</button>
      <button class=${'d ' + (tehlike ? 'tehlike' : 'ana-d')} onClick=${async () => { await tamam(neden.trim()); kapat(); }}>${evet}</button>`}>
      <div class="modal-ic"><p style="margin:0 0 12px">${aciklama}</p>
        <${Alan} etiket="Not (isteğe bağlı)"><input class="girdi" value=${neden} onInput=${(e) => setNeden(e.target.value)} autofocus placeholder=${placeholder} /><//></div>
    <//>`;
  }
  function iptalEt(s) {
    K.ac(NedenPenceresi, {
      baslik: `${s.no} iptal edilsin mi?`, aciklama: 'Kayıt silinmez; Siparişler › İptal’de kalır, hesaba girmez.', evet: 'İptal et', tehlike: true, placeholder: 'Örn: Yanlışlıkla verildi',
      tamam: async (neden) => { await depo().kaydet([{ c: 'siparis', k: s.id, v: { iptal: true, iptalNeden: neden, iptalTarihi: bugun() } }]); bildir(`${s.no} iptal edildi.`); },
    });
  }
  function kalaniKapat(s) {
    const x = S.durum(depo(), s);
    K.ac(NedenPenceresi, {
      baslik: `${s.no}: kalan gelmeyecek mi?`, aciklama: `Bekleyen ${adetYazi(x.kalan)} gelmeyecek olarak işaretlenir ve sipariş kapanır. Gelenler hesapta kalır.`, evet: 'Siparişi kapat', placeholder: 'Örn: Kalanı bir sonraki siparişe eklendi',
      tamam: async (neden) => { await depo().kaydet([{ c: 'siparis', k: s.id, v: { kapandi: true, kapanisNot: neden } }]); bildir(`${s.no} kapatıldı.`); },
    });
  }

  /* ---------------- Sipariş kartı ---------------- */
  function SiparisKarti({ s }) {
    const d = depo();
    const x = S.durum(d, s);
    const f = S.fiyatBul(d, s.tarih);
    const miktar = x.acik ? s : x.gelen;
    const tutar = S.URUNLER.reduce((t, u) => t + sayi(miktar[u.id]) * sayi(f && f[u.id]), 0) * (1 + sayi(f && f.kdv) / 100);
    const gun = gunFarki(s.tarih || bugun(), bugun());
    const bilgi = s.iptal ? `İptal · ${s.iptalNeden || 'neden yazılmamış'}` : x.acik ? (gun <= 0 ? 'Bugün sipariş edildi' : `${gun} gündür bekleniyor`)
      : x.ad === 'Kapatıldı' ? `Kapatıldı · ${s.kapanisNot || 'kalanı gelmedi'}` : `Geldi ${tarihYaz(x.son)}`;
    return html`<div class="tz-gonderi su-kart" style=${s.iptal ? 'opacity:.72' : ''}>
      <div class="bas"><span class="etiket-kod">${s.no}</span><span class="firma" onClick=${() => siparisAc(s)}>${tarihYaz(s.tarih)}</span><${DurumRozeti} ad=${x.ad} />
        <span class=${'gun' + (x.acik && gun >= 3 ? ' gec' : '')}>${bilgi}</span></div>
      <div class="su-kalemler">${S.URUNLER.filter((u) => sayi(s[u.id]) > 0 || x.gelen[u.id] > 0).map((u) => html`<span class="su-kalem"><${Cizim} tur=${u.id} boyut=${0.75} />
          <span><b>${sayi(s[u.id])} ${u.birim}</b> ${u.ad}<small>${s.iptal ? 'iptal' : x.kalan[u.id] > 0 ? (x.gelen[u.id] ? `${x.gelen[u.id]} geldi · ${x.kalan[u.id]} ${s.kapandi ? 'gelmedi' : 'bekleniyor'}` : s.kapandi ? 'gelmedi' : 'bekleniyor') : x.gelen[u.id] > sayi(s[u.id]) ? `${x.gelen[u.id]} geldi` : 'tamamı geldi'}</small></span></span>`)}
        <span class="su-toplam">${lt(S.litre(d, miktar))}<small>${tl(tutar)}</small></span></div>
      <div class="alt">
        ${x.acik ? html`<button class="d ana-d kucuk-d" onClick=${() => teslimAc(s)}><${Ikon} ad="tik" boyut=${15} />Geldi</button>`
          : html`<span class="soluk kucuk">${x.teslimler.length > 1 ? `${x.teslimler.length} teslimatta geldi` : s.notlar || ''}</span>`}
        <span class="bosluk" />
        ${s.iptal && html`<button class="d hayalet kucuk-d" onClick=${() => depo().kaydet([{ c: 'siparis', k: s.id, v: { iptal: false } }])}><${Ikon} ad="geri" boyut=${15} />İptali geri al</button>`}
        ${x.acik && !x.teslimler.length && html`<button class="d hayalet kucuk-d" onClick=${() => iptalEt(s)}><${Ikon} ad="kapat" boyut=${15} />İptal et</button>`}
        ${x.acik && x.teslimler.length > 0 && html`<button class="d hayalet kucuk-d" onClick=${() => kalaniKapat(s)} title="Kalan gelmeyecek"><${Ikon} ad="kapat" boyut=${15} />Kalanı kapat</button>`}
        ${x.ad === 'Kapatıldı' && html`<button class="d hayalet kucuk-d" onClick=${() => depo().kaydet([{ c: 'siparis', k: s.id, v: { kapandi: false } }])}><${Ikon} ad="geri" boyut=${15} />Yeniden aç</button>`}
        <button class="d hayalet kucuk-d" onClick=${() => siparisAc(s)}><${Ikon} ad="kalem" boyut=${15} />Düzenle</button>
      </div>
    </div>`;
  }
  const KartIzgara = ({ liste }) => html`<div class="su-izgara">${liste.map((s) => html`<${SiparisKarti} key=${s.id} s=${s} />`)}</div>`;

  /* Ürün seçimi: çizim + adet */
  function UrunAdet({ u, deger, degis, ipucu, odak }) {
    return html`<div class=${'su-urun' + (sayi(deger) > 0 ? ' secili' : '')}>
      <${Cizim} tur=${u.id} boyut=${1.25} />
      <div class="su-urun-ad"><b>${u.ad}</b><span class="soluk kucuk">${ipucu}</span></div>
      <${AdetGirdi} deger=${deger} degis=${degis} otomatikOdak=${odak} />
      <span class="soluk kucuk su-birim">${u.birim}</span>
    </div>`;
  }

  /* ---------------- Sipariş penceresi (yeni: "Su sipariş et"; kayıtlı: düzenle + teslimatlar) ---------------- */
  function SiparisFormu({ kayit, kapat }) {
    const d = depo();
    const [f, setF] = useState(() => (kayit ? { ...kayit, notlar: kayit.notlar || '' } : { tarih: bugun(), ...S.sonAdetler(d), notlar: '' }));
    const [denendi, setDenendi] = useState(false);
    const [mesgul, setMesgul] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const fiyat = S.fiyatBul(d, f.tarih || bugun());
    const tutar = S.URUNLER.reduce((t, u) => t + sayi(f[u.id]) * sayi(fiyat && fiyat[u.id]), 0) * (1 + sayi(fiyat && fiyat.kdv) / 100);
    const bos = !S.URUNLER.some((u) => sayi(f[u.id]) > 0);
    const metin = S.whatsappMetni(d, f);
    const x = kayit ? S.durum(d, kayit) : null;
    const a = S.ayar(d);

    async function kaydet(whatsapp) {
      setDenendi(true);
      if (bos || !f.tarih) return;
      // Pencere tıklamayla aynı anda açılmalı; yoksa tarayıcı açılır pencereyi engeller.
      if (whatsapp) { window.open(S.whatsappAdresi(d, metin), '_blank'); navigator.clipboard?.writeText(metin).catch(() => {}); }
      setMesgul(true);
      try {
        const v = { tarih: f.tarih, damacana: sayi(f.damacana), bardak: sayi(f.bardak), notlar: f.notlar.trim() };
        if (kayit) {
          await d.kaydet([{ c: 'siparis', k: kayit.id, v }]);
          bildir(`${kayit.no} güncellendi.`);
        } else {
          const no = K.yeniNo(d, 'siparis', 'SU', f.tarih);
          await d.kaydet([{ c: 'siparis', k: uid(), v: { no, ...v } }]);
          bildir(`${no} kaydedildi · ${S.liste(v)}${whatsapp ? ' · mesaj WhatsApp’ta açıldı' : ''}`);
        }
        kapat();
      } finally { setMesgul(false); }
    }
    const silFn = async () => {
      if (x && x.teslimler.length && !(await NT.ui.onayla(`${kayit.no} siparişinin ${x.teslimler.length} teslimatı var; sipariş silinirse bunlar da hesaptan çıkar. Gelmiş bir siparişi silmek yerine düzeltmeniz önerilir.`, { baslik: 'Teslimatlı sipariş', evet: 'Yine de sil', tehlike: true }))) return;
      if (await K.sil('siparis', kayit, kayit.no)) kapat();
    };
    return html`<${Modal} genis baslik=${kayit ? `Sipariş ${kayit.no}` : 'Su sipariş et'} kapat=${kapat} sag=${x && html`<${DurumRozeti} ad=${x.ad} />`}
      alt=${kayit ? html`<${K.FormAlt} kayit=${kayit} sil=${silFn} kapat=${kapat} kaydet=${() => kaydet(false)} mesgul=${mesgul}
          ek=${x.acik && html`<button class="d" onClick=${() => { kapat(); teslimAc(kayit); }}><${Ikon} ad="tik" />Geldi</button>`} />`
        : html`<button class="d hayalet" onClick=${kapat}>Vazgeç</button>
          <button class="d" disabled=${mesgul} onClick=${() => kaydet(false)}><${Ikon} ad="tik" />Yalnızca kaydet</button>
          <button class="d ana-d" disabled=${mesgul} onClick=${() => kaydet(true)}><${Ikon} ad="whatsapp" />Kaydet ve WhatsApp’ta gönder</button>`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(false); }}>
        <div class="s12 su-urunler">${S.URUNLER.map((u, i) => html`<${UrunAdet} key=${u.id} u=${u} deger=${f[u.id]} degis=${s(u.id)} odak=${!kayit && i === 0}
          ipucu=${x ? (x.gelen[u.id] ? `${x.gelen[u.id]} geldi` : '') : u.id === 'bardak' ? `Koli içi ${a.koliBardak} bardak` : `${a.damacanaL} litre`} />`)}
          ${denendi && bos && html`<div class="hata-yazi">En az bir ürün için adet girin.</div>`}</div>
        <${Alan} etiket="Sipariş tarihi" sinif="s4" ipucu="Fiyat bu tarihe göre alınır"><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih')(e.target.value)} /><//>
        <${Alan} etiket="Tahmini" sinif="s8"><div class="girdi su-tahmin">${lt(S.litre(d, f))} · <b>${tl(tutar)}</b>
          <span class="soluk kucuk">${fiyat ? `(damacana ${tl(sayi(fiyat.damacana))}, koli ${tl(sayi(fiyat.bardak))}${sayi(fiyat.kdv) ? `, KDV %${fiyat.kdv}` : ''})` : '(fiyat girilmemiş)'}</span></div><//>
        <${Alan} etiket="Not"><input class="girdi" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} placeholder="Örn: Salı gelecekmiş" /><//>
        ${!kayit && html`<div class="s12 su-mesaj"><div class="su-mesaj-bas"><${Ikon} ad="whatsapp" boyut=${16} /><b>WhatsApp mesajı</b>
            <span class="soluk kucuk">${a.tedarikci || 'Su firması'}${a.telefon ? ' · ' + a.telefon : ' · numara Ayarlar’da girilmemiş, kişiyi WhatsApp’ta siz seçersiniz'}</span></div>
          <div class="su-balon">${metin}</div></div>`}
        ${kayit && html`<div class="s12 form-bolum">Teslimatlar</div>
          <div class="s12">${x.teslimler.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>Tarih</th><th class="sag">Damacana</th><th class="sag">Bardak koli</th><th class="sag">Litre</th><th class="sag">Tutar</th><th>Not</th></tr></thead><tbody>
            ${x.teslimler.map((t) => html`<tr class="tik" onClick=${() => teslimAc(kayit, t)}><td>${tarihYaz(t.tarih)}</td><td class="sag sayi">${sayi(t.damacana) || '—'}</td><td class="sag sayi">${sayi(t.bardak) || '—'}</td>
              <td class="sag sayi">${lt(S.litre(d, t))}</td><td class="sag sayi">${tl(S.teslimTutar(d, t).toplam)}</td><td class="kucuk">${t.notlar || ''}</td></tr>`)}
          </tbody></table></div>` : html`<p class="soluk" style="margin:0">Henüz teslimat yok. Su gelince “Geldi” ile işaretleyin.</p>`}</div>
          ${(kayit.iptal || kayit.kapandi) && html`<div class="s12 uyari-kutu bilgi"><${Ikon} ad="bilgi" /><span>${kayit.iptal ? `İptal edildi${kayit.iptalTarihi ? ' · ' + tarihYaz(kayit.iptalTarihi) : ''}${kayit.iptalNeden ? ' · ' + kayit.iptalNeden : ''}` : `Kalanı kapatıldı${kayit.kapanisNot ? ' · ' + kayit.kapanisNot : ''}`}</span></div>`}
          <${GecmisBolumu} kayit=${kayit} />`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const siparisAc = (s) => K.ac(SiparisFormu, { kayit: s });
  const yeniSiparis = () => K.ac(SiparisFormu, {});

  /* ---------------- "Geldi": teslimat girişi (kısmi teslim olabilir) ---------------- */
  function TeslimPenceresi({ siparis, kayit, kapat }) {
    const d = depo();
    const x = S.durum(d, siparis);
    // Düzenlemede bu teslimat "daha önce gelen"den düşülür ki kalan doğru görünsün.
    const onceki = (u) => x.gelen[u] - (kayit ? sayi(kayit[u]) : 0);
    const kalanIlk = (u) => Math.max(0, sayi(siparis[u]) - onceki(u));
    const [f, setF] = useState(() => (kayit ? { tarih: kayit.tarih, damacana: sayi(kayit.damacana), bardak: sayi(kayit.bardak), notlar: kayit.notlar || '' }
      : { tarih: bugun(), damacana: kalanIlk('damacana'), bardak: kalanIlk('bardak'), notlar: '' }));
    const [kapatSec, setKapatSec] = useState(false);
    const [denendi, setDenendi] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const bos = !S.URUNLER.some((u) => sayi(f[u.id]) > 0);
    const eksik = S.URUNLER.filter((u) => sayi(f[u.id]) < kalanIlk(u.id)).map((u) => ({ u, n: kalanIlk(u.id) - sayi(f[u.id]) }));
    async function kaydet() {
      setDenendi(true);
      if (bos || !f.tarih) return;
      const v = { siparis: siparis.id, tarih: f.tarih, damacana: sayi(f.damacana), bardak: sayi(f.bardak), notlar: f.notlar.trim() };
      const ops = [{ c: 'teslim', k: kayit ? kayit.id : uid(), v }];
      if (!kayit && kapatSec && eksik.length) ops.push({ c: 'siparis', k: siparis.id, v: { kapandi: true, kapanisNot: 'Kalanı gelmedi' } });
      await d.kaydet(ops);
      const kalanYazi = eksik.map((e) => `${e.n} ${e.u.birim}`).join(' + ');
      bildir(kayit ? 'Teslimat güncellendi.' : `${siparis.no}: ${S.liste(v)} geldi${eksik.length ? (kapatSec ? ' · sipariş kapatıldı' : ` · ${kalanYazi} bekleniyor`) : ''}.`);
      kapat();
    }
    const silFn = async () => (await K.sil('teslim', kayit, `${tarihYaz(kayit.tarih)} teslimatı`)) && kapat();
    return html`<${Modal} baslik=${kayit ? `Teslimat · ${siparis.no}` : `Su geldi · ${siparis.no}`} kapat=${kapat}
      alt=${html`<${K.FormAlt} kayit=${kayit} sil=${silFn} kapat=${kapat} kaydet=${kaydet} kaydetYazi=${kayit ? 'Kaydet' : 'Geldi olarak kaydet'} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <div class="s12 soluk">Sipariş: ${tarihYaz(siparis.tarih)} · ${S.liste(siparis) || '—'}</div>
        <div class="s12 su-urunler">${S.URUNLER.map((u, i) => html`<${UrunAdet} key=${u.id} u=${u} deger=${f[u.id]} degis=${s(u.id)} odak=${i === 0}
          ipucu=${`Sipariş ${sayi(siparis[u.id])}${onceki(u.id) ? ` · önce gelen ${onceki(u.id)}` : ''} · kalan ${kalanIlk(u.id)}`} />`)}
          ${denendi && bos && html`<div class="hata-yazi">Gelen adedi yazın.</div>`}</div>
        <${Alan} etiket="Geliş tarihi" sinif="s4" ipucu="Fatura dönemi bu tarihin ayıdır"><input class="girdi" type="date" value=${f.tarih} onInput=${(e) => s('tarih')(e.target.value)} /><//>
        <${Alan} etiket="Not" sinif="s8"><input class="girdi" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} placeholder="Örn: Kalan 5 koli Salı gelecek" /><//>
        ${!kayit && eksik.length > 0 && !bos && html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>
          Eksik geldi: <b>${eksik.map((e) => `${e.n} ${e.u.birim}`).join(' + ')}</b> bekleniyor olarak kalacak.
          <label style="display:flex;gap:8px;align-items:center;margin-top:6px;cursor:pointer"><input type="checkbox" checked=${kapatSec} onChange=${(e) => setKapatSec(e.target.checked)} />Kalanı gelmeyecek — siparişi kapat</label></span></div>`}
        ${kayit && html`<${GecmisBolumu} kayit=${kayit} />`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const teslimAc = (siparis, kayit) => K.ac(TeslimPenceresi, { siparis, kayit });
  /* Hızlı işlem "Su geldi": tek bekleyen sipariş varsa doğrudan açar. */
  function suGeldi() {
    const d = depo();
    const acik = d.kayitlar('siparis').filter((s) => S.acikMi(d, s));
    if (!acik.length) return bildir('Bekleyen sipariş yok. Önce “Su sipariş et” ile sipariş girin.');
    if (acik.length === 1) return teslimAc(acik[0]);
    location.hash = '#/siparisler';
  }

  /* ---------------- Ay sonu: fatura girişi ve karşılaştırma ---------------- */
  function FaturaPenceresi({ ay, kapat }) {
    const d = depo();
    const x = S.aylar(d).find((y) => y.ay === ay) || { ay, adet: { damacana: 0, bardak: 0 }, tutar: { damacana: 0, bardak: 0 }, haric: 0, kdv: 0, toplam: 0, litre: 0, teslimler: [], fatura: null };
    const fk = x.fatura;
    const [f, setF] = useState({ tutar: fk && fk.tutar !== '' && fk.tutar != null ? String(fk.tutar).replace('.', ',') : '', faturaNo: fk?.faturaNo || '', faturaTarihi: fk?.faturaTarihi || '', notlar: fk?.notlar || '', ekler: fk?.ekler || [] });
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const girildi = String(f.tutar).trim() !== '';
    const fark = girildi ? sayi(f.tutar) - x.toplam : 0;
    async function kaydet() {
      await d.kaydet([{ c: 'fatura', k: fk ? fk.id : S.faturaAnahtari(ay), v: { ay, tutar: girildi ? sayi(f.tutar) : '', faturaNo: f.faturaNo.trim(), faturaTarihi: f.faturaTarihi, notlar: f.notlar, ekler: f.ekler } }]);
      bildir(!girildi ? `${S.ayAdi(ay)} kaydedildi.` : Math.abs(fark) < 0.01 ? `${S.ayAdi(ay)} faturası eşleşiyor.` : `${S.ayAdi(ay)}: fatura hesaptan ${tl(Math.abs(fark))} ${fark > 0 ? 'fazla' : 'eksik'}.`, Math.abs(fark) >= 0.01 && girildi ? { tur: 'hata' } : {});
      kapat();
    }
    const liste = S.fiyatlar(d);
    return html`<${Modal} genis baslik=${`${S.ayAdi(ay)} · fatura kontrolü`} kapat=${kapat}
      alt=${html`<${K.FormAlt} kayit=${fk} sil=${async () => (await K.sil('fatura', fk, `${S.ayAdi(ay)} faturası`)) && kapat()} kapat=${kapat} kaydet=${kaydet} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <div class="s12 su-serit">
          ${S.URUNLER.map((u) => html`<div><small>${u.ad}</small><b>${x.adet[u.id]} ${u.birim}</b><span>${tl(x.tutar[u.id])}</span></div>`)}
          <div><small>Hesaplanan (KDV dahil)</small><b>${tl(x.toplam)}</b><span>${x.kdv ? `KDV ${tl(x.kdv)}` : 'KDV yok'}</span></div>
          <div><small>Su</small><b>${lt(x.litre)}</b><span>${x.teslimler.length} teslimat</span></div>
        </div>
        <${Alan} etiket="Fatura tutarı (KDV dahil, ₺)" sinif="s4" ipucu="Gelen faturadaki toplam"><input class="girdi sayi" inputmode="decimal" value=${f.tutar} onInput=${(e) => s('tutar')(e.target.value)} autofocus placeholder=${K.sayiYaz(x.toplam, 2)} /><//>
        <${Alan} etiket="Fatura no" sinif="s4"><input class="girdi mono" value=${f.faturaNo} onInput=${(e) => s('faturaNo')(e.target.value)} /><//>
        <${Alan} etiket="Fatura tarihi" sinif="s4"><input class="girdi" type="date" value=${f.faturaTarihi} onInput=${(e) => s('faturaTarihi')(e.target.value)} /><//>
        ${girildi && html`<div class=${'s12 uyari-kutu ' + (Math.abs(fark) < 0.01 ? 'iyi' : 'yok')}><${Ikon} ad=${Math.abs(fark) < 0.01 ? 'daire_tik' : 'uyari'} /><span>
          ${Math.abs(fark) < 0.01 ? html`<b>Eşleşiyor.</b> Fatura, teslimatların tutarıyla aynı.` : html`<b>Fark var: fatura ${tl(Math.abs(fark))} ${fark > 0 ? 'fazla' : 'eksik'}.</b> Aşağıdaki teslimatları ve Fiyatlar sayfasını kontrol edin.`}</span></div>`}
        <${Alan} etiket="Not"><input class="girdi" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} /><//>
        <${Alan} etiket="Ekler" ipucu="Fatura PDF’i veya fotoğrafı (en fazla 8 MB)"><${Ekler} ekler=${f.ekler} degis=${s('ekler')} /><//>
        <div class="s12 form-bolum">Bu ayın teslimatları</div>
        <div class="s12">${x.teslimler.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>Geliş</th><th>Sipariş</th><th class="sag">Damacana</th><th class="sag">Bardak koli</th><th class="sag">Birim fiyat</th><th class="sag">Tutar</th></tr></thead><tbody>
          ${x.teslimler.map((t) => { const sp = d.kayit('siparis', t.siparis); const h = S.teslimTutar(d, t, liste); return html`<tr class="tik" onClick=${() => teslimAc(sp, t)}>
            <td>${tarihYaz(t.tarih)}</td><td><span class="etiket-kod">${sp.no}</span> <span class="soluk kucuk">${tarihYaz(sp.tarih)}</span></td>
            <td class="sag sayi">${sayi(t.damacana) || '—'}</td><td class="sag sayi">${sayi(t.bardak) || '—'}</td>
            <td class="sag kucuk soluk">${h.fiyat ? `${tl(sayi(h.fiyat.damacana))} / ${tl(sayi(h.fiyat.bardak))}` : '—'}</td><td class="sag sayi">${tl(h.toplam)}</td></tr>`; })}
          <tr><td colspan="5"><b>Toplam</b></td><td class="sag sayi"><b>${tl(x.toplam)}</b></td></tr>
        </tbody></table></div>` : html`<p class="soluk" style="margin:0">Bu ay teslimat yok.</p>`}</div>
        ${fk && html`<${GecmisBolumu} kayit=${fk} />`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const faturaAc = (ay) => K.ac(FaturaPenceresi, { ay });
  /* Hızlı işlem "Fatura gir": faturası girilmemiş en eski geçmiş ay; yoksa geçen ay. */
  function faturaGir() {
    const d = depo();
    const bgAy = bugun().slice(0, 7);
    const bekleyen = S.aylar(d).find((x) => x.kontrol === 'bekliyor' && x.ay < bgAy);
    if (bekleyen) return faturaAc(bekleyen.ay);
    const g = new Date(); g.setDate(1); g.setMonth(g.getMonth() - 1);
    faturaAc(`${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}`);
  }

  /* ---------------- Fiyat penceresi (zam) ---------------- */
  function FiyatPenceresi({ kayit, kapat }) {
    const d = depo();
    const son = S.fiyatlar(d).slice(-1)[0];
    const [f, setF] = useState(() => (kayit ? { ...kayit, damacana: String(kayit.damacana ?? ''), bardak: String(kayit.bardak ?? ''), kdv: String(kayit.kdv ?? 0), aciklama: kayit.aciklama || '' }
      : { tarih: bugun(), damacana: son ? String(son.damacana) : '', bardak: son ? String(son.bardak) : '', kdv: son ? String(son.kdv ?? 0) : '0', aciklama: '' }));
    const [denendi, setDenendi] = useState(false);
    const s = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
    const ayni = d.kayitlar('fiyat').find((x) => x.tarih === f.tarih && x.id !== kayit?.id);
    const sonraki = S.fiyatlar(d).find((x) => x.tarih > f.tarih && x.id !== kayit?.id);
    const etkilenen = d.kayitlar('siparis').filter((x) => !x.iptal && x.tarih >= f.tarih && (!sonraki || x.tarih < sonraki.tarih)).length;
    const hata = !f.tarih ? 'Tarih seçin' : ayni ? 'Bu tarihte zaten bir fiyat var; onu düzenleyin' : !(sayi(f.damacana) > 0 || sayi(f.bardak) > 0) ? 'En az bir fiyat yazın' : '';
    async function kaydet() {
      setDenendi(true);
      if (hata) return;
      await d.kaydet([{ c: 'fiyat', k: kayit ? kayit.id : uid(), v: { tarih: f.tarih, damacana: sayi(f.damacana), bardak: sayi(f.bardak), kdv: sayi(f.kdv), aciklama: f.aciklama.trim() } }]);
      bildir(kayit ? 'Fiyat güncellendi.' : `${tarihYaz(f.tarih)} itibarıyla yeni fiyat kaydedildi.`);
      kapat();
    }
    return html`<${Modal} baslik=${kayit ? 'Fiyatı düzenle' : 'Yeni fiyat (zam)'} kapat=${kapat}
      alt=${html`<${K.FormAlt} kayit=${kayit} sil=${async () => (await K.sil('fiyat', kayit, `${tarihYaz(kayit.tarih)} fiyatı`)) && kapat()} kapat=${kapat} kaydet=${kaydet} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket="Geçerlilik başlangıcı" sinif="s6" hata=${denendi && hata}><input class="girdi" type="date" value=${f.tarih} onInput=${s('tarih')} /><//>
        <${Alan} etiket="KDV (%)" sinif="s6" ipucu="Fiyata KDV dahilse 0"><input class="girdi sayi" inputmode="decimal" value=${f.kdv} onInput=${s('kdv')} /><//>
        <${Alan} etiket="Damacana (₺)" sinif="s6"><input class="girdi sayi" inputmode="decimal" value=${f.damacana} onInput=${s('damacana')} autofocus /><//>
        <${Alan} etiket="Bardak su koli (₺)" sinif="s6"><input class="girdi sayi" inputmode="decimal" value=${f.bardak} onInput=${s('bardak')} /><//>
        <${Alan} etiket="Açıklama"><input class="girdi" value=${f.aciklama} onInput=${s('aciklama')} placeholder="Örn: Ekim zammı" /><//>
        <div class="s12 uyari-kutu bilgi"><${Ikon} ad="bilgi" /><span>Sipariş tarihi ${tarihYaz(f.tarih)}${sonraki ? ` – ${tarihYaz(sonraki.tarih)} öncesi` : ' ve sonrası'} olan siparişler bu fiyatla hesaplanır (şu an ${etkilenen} sipariş). Daha önceki siparişlerin tutarı değişmez.</span></div>
        ${kayit && html`<${GecmisBolumu} kayit=${kayit} />`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }

  /* ---------------- Genel bakış ---------------- */
  function GenelBakis() {
    const d = depo();
    const bg = bugun();
    const bgAy = bg.slice(0, 7);
    const l = S.aylar(d);
    const buAy = l.find((x) => x.ay === bgAy);
    const yil = l.filter((x) => x.ay.startsWith(bg.slice(0, 4)));
    const acik = d.kayitlar('siparis').filter((s) => S.acikMi(d, s)).sort((a, x) => (a.tarih < x.tarih ? -1 : 1));
    const fiyat = S.fiyatBul(d, bg);
    const grafik = S.aylikLitre(d);
    const kontrol = l.filter((x) => x.toplam > 0 || x.faturaVar).slice(-6).reverse();
    const bekleyenFatura = l.filter((x) => x.kontrol === 'bekliyor' && x.ay < bgAy);
    const farkli = l.filter((x) => x.kontrol === 'fark');
    const sonTeslim = S.gecerliTeslimler(d).sort((a, x) => (a.tarih < x.tarih ? 1 : a.tarih > x.tarih ? -1 : x._olusturma - a._olusturma)).slice(0, 6);
    const saat = new Date().getHours();
    const adK = (b.kullanici || '').split(' ')[0];
    const enEski = acik[0] ? gunFarki(acik[0].tarih, bg) : 0;
    return html`
      <${K.Selam} bant baslik=${`${saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar'}${adK ? ', ' + adK : ''}.`}
        sag=${html`${acik.length > 0 && html`<button class="d tz-buyuk" onClick=${suGeldi}><${Ikon} ad="tik" />Su geldi</button>`}
          <button class="d ana-d tz-buyuk" onClick=${yeniSiparis}><${Ikon} ad="dolum" />Su sipariş et</button>`}>
        Bu ay <b class="v">${lt(buAy ? buAy.litre : 0)}</b> su geldi.
        ${acik.length ? html` <b>${acik.length} sipariş</b> bekleniyor.` : ' Bekleyen sipariş yok.'}
        ${bekleyenFatura.length > 0 && html` <b>${bekleyenFatura.length} ayın</b> faturası girilmedi.`}
      <//>
      <div class="kpi-sira">
        <${K.Kpi} vurgu ikon="dolum" ad="Bu ay" deger=${K.sayiYaz(buAy ? buAy.litre : 0)} birim="L" alt=${buAy ? adetYazi(buAy.adet) : 'Henüz teslimat yok'} />
        <${K.Kpi} ikon="fatura" ad="Bu ay tutar" deger=${tl(buAy ? buAy.toplam : 0)} alt="Teslim edilenler, KDV dahil" />
        <${K.Kpi} ikon="saat" ad="Bekleyen sipariş" deger=${acik.length} alt=${acik.length ? `En eskisi ${enEski ? enEski + ' gündür' : 'bugün verildi'}` : 'Hepsi geldi'} />
        <${K.Kpi} ikon="rapor" ad=${`${bg.slice(0, 4)} toplamı`} deger=${K.sayiYaz(yil.reduce((t, x) => t + x.litre, 0))} birim="L" alt=${tl(yil.reduce((t, x) => t + x.toplam, 0))} />
      </div>
      <div class="tz-izgara">
        <div class="tz-sutun">
          <${K.Kart} baslik="Bekleyen siparişler" sag=${html`<a href="#/siparisler" style="color:var(--ana)">Tümü →</a>`}>
            ${acik.length ? html`<${KartIzgara} liste=${acik} />` : html`<p class="soluk" style="margin:0">Bekleyen sipariş yok. Su azalınca “Su sipariş et” ile WhatsApp mesajını tek dokunuşla hazırlayın.</p>`}
          <//>
          <${K.Kart} baslik="Aylık su (litre)" sag=${html`<a href="#/faturalar" style="color:var(--ana)">Faturalar →</a>`}>
            <${K.Cubuklar} veri=${grafik.map((x) => ({ ad: AYLAR[+x.ay.slice(5) - 1], deger: x.litre, etiket: K.sayiYaz(x.litre), ipucu: `${S.ayAdi(x.ay)}: ${lt(x.litre)} · ${tl(x.toplam)}`, vurgu: x.ay === bgAy }))} />
          <//>
        </div>
        <div class="tz-sutun">
          <${K.Kart} baslik="Güncel fiyat" sag=${html`<a href="#/fiyatlar" style="color:var(--ana)">Fiyatlar →</a>`}>
            ${fiyat ? html`<div class="su-fiyat">${S.URUNLER.map((u) => html`<div><${Cizim} tur=${u.id} boyut=${0.8} /><span>${u.ad}<small>${u.birim} başına</small></span><b>${tl(sayi(fiyat[u.id]))}</b></div>`)}</div>
              <p class="soluk kucuk" style="margin:10px 0 0">${tarihYaz(fiyat.tarih)} itibarıyla${sayi(fiyat.kdv) ? ` · KDV %${fiyat.kdv}` : ' · KDV dahil'}${fiyat.aciklama ? ' · ' + fiyat.aciklama : ''}</p>`
              : html`<p class="soluk" style="margin:0">Fiyat girilmemiş. <a href="#/fiyatlar">Fiyat ekleyin →</a></p>`}
          <//>
          <${K.Kart} baslik="Fatura kontrolü" sag=${farkli.length > 0 && html`<span class="rozet yok">${farkli.length} ayda fark</span>`}>
            ${kontrol.length ? html`<div class="su-kontrol">${kontrol.map((x) => html`<button onClick=${() => faturaAc(x.ay)}><span>${S.ayAdi(x.ay)}<small>${tl(x.toplam)}${x.faturaVar ? ` · fatura ${tl(sayi(x.fatura.tutar))}` : ''}</small></span><${KontrolRozeti} x=${x} buAy=${bgAy} /></button>`)}</div>`
              : html`<p class="soluk" style="margin:0">Henüz teslimat yok.</p>`}
          <//>
          <${K.Kart} baslik="Son gelenler">
            ${sonTeslim.length ? html`<ul class="tz-akis">${sonTeslim.map((t) => { const sp = d.kayit('siparis', t.siparis); return html`<li onClick=${() => teslimAc(sp, t)}>
              <span class="ik dolum"><${Ikon} ad="dolum" /></span><span class="ne"><b>${adetYazi(t)}</b><small>${sp.no} · ${tarihYaz(t.tarih)}</small></span>
              <span class="miktar">${lt(S.litre(d, t))}</span></li>`; })}</ul>` : html`<p class="soluk" style="margin:0">Henüz teslimat yok.</p>`}
          <//>
        </div>
      </div>`;
  }

  /* ---------------- Siparişler ---------------- */
  function Siparisler() {
    const d = depo();
    const [f, setF] = useState('acik');
    const [q, setQ] = useState('');
    const tum = d.kayitlar('siparis').filter((s) => ara(`${s.no} ${tarihYaz(s.tarih)} ${s.notlar || ''} ${S.liste(s)}`, q)).map((s) => ({ s, x: S.durum(d, s) }));
    const g = { acik: tum.filter((y) => y.x.acik), gelen: tum.filter((y) => !y.x.acik && !y.s.iptal), iptal: tum.filter((y) => y.s.iptal), hepsi: tum };
    const liste = [...g[f]].sort((a, x) => (f === 'acik' ? (a.s.tarih < x.s.tarih ? -1 : 1) : a.s.tarih < x.s.tarih ? 1 : a.s.tarih > x.s.tarih ? -1 : x.s._olusturma - a.s._olusturma)).map((y) => y.s);
    return html`<${K.Selam} baslik="Siparişler" sag=${html`<button class="d" onClick=${() => excelSiparis(d)}><${Ikon} ad="indir" boyut=${15} />Excel</button>
        <button class="d ana-d tz-buyuk" onClick=${yeniSiparis}><${Ikon} ad="dolum" />Su sipariş et</button>`}>
        Su gelince karttaki “Geldi” ile işaretleyin. Eksik gelirse gelen adedi yazın; kalan bekleniyor olarak kalır.<//>
      <${K.Cipler} secenekler=${[['acik', 'Bekleyen', g.acik.length], ['gelen', 'Gelen', g.gelen.length], ['iptal', 'İptal', g.iptal.length], ['hepsi', 'Tümü', g.hepsi.length]]} deger=${f} degis=${setF}>
        <input class="girdi" style="max-width:300px;margin-left:8px;border-radius:99px" placeholder="Sipariş no, tarih, not…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      <//>
      ${liste.length ? html`<${KartIzgara} liste=${liste} />` : html`<div class="tz-kart"><p class="soluk" style="margin:0">Bu süzgeçte sipariş yok.</p></div>`}`;
  }

  /* ---------------- Faturalar (ay sonu karşılaştırma + litre) ---------------- */
  function Faturalar() {
    const d = depo();
    const bg = bugun();
    const bgAy = bg.slice(0, 7);
    const hepsi = S.aylar(d);
    const yillar = [...new Set(hepsi.map((x) => x.ay.slice(0, 4)).concat(bg.slice(0, 4)))].sort().reverse();
    const [yil, setYil] = useState(bg.slice(0, 4));
    const satirlar = S.yilAylari(d, yil, hepsi);
    const top = (fn) => satirlar.reduce((t, x) => t + fn(x), 0);
    const faturali = satirlar.filter((x) => x.faturaVar);
    return html`<${K.Selam} baslik="Faturalar" sag=${html`<button class="d" onClick=${() => excelFatura(satirlar, yil)}><${Ikon} ad="indir" boyut=${15} />Excel</button>
        <select class="girdi kisa" value=${yil} onChange=${(e) => setYil(e.target.value)}>${yillar.map((y) => html`<option value=${y}>${y}</option>`)}</select>`}>
        Her ay gelen sular, siparişin tarihindeki fiyatla hesaplanır. Ay sonunda gelen faturanın tutarını aya tıklayıp girin; tutmazsa kırmızı görünür.<//>
      <div class="kpi-sira">
        <${K.Kpi} vurgu ikon="dolum" ad=${`${yil} su`} deger=${K.sayiYaz(top((x) => x.litre))} birim="L" alt=${adetYazi({ damacana: top((x) => x.adet.damacana), bardak: top((x) => x.adet.bardak) })} />
        <${K.Kpi} ikon="fatura" ad="Hesaplanan" deger=${tl(top((x) => x.toplam))} alt="KDV dahil" />
        <${K.Kpi} ikon="tik" ad="Girilen faturalar" deger=${tl(faturali.reduce((t, x) => t + sayi(x.fatura.tutar), 0))} alt=${`${faturali.length} ay`} />
        <${K.Kpi} ikon="uyari" ad="Kontrol" deger=${satirlar.filter((x) => x.kontrol === 'fark').length} alt=${`ayda fark · ${satirlar.filter((x) => x.kontrol === 'bekliyor' && x.ay < bgAy).length} ay fatura bekleniyor`} />
      </div>
      <${K.Kart}>
        ${satirlar.length ? html`<div class="tablo-kap"><table class="tablo su-fatura-tablo"><thead><tr><th>Dönem</th><th class="sag">Damacana</th><th class="sag">Bardak koli</th><th class="sag">Hesaplanan</th><th class="sag">Fatura</th><th class="sag">Fark</th><th>Durum</th><th class="sag">Litre</th><th class="sag">Yıl içi toplam</th></tr></thead><tbody>
          ${satirlar.map((x) => html`<tr class="tik" onClick=${() => faturaAc(x.ay)}><td><b>${S.ayAdi(x.ay)}</b></td>
            <td class="sag sayi">${x.adet.damacana ? html`${x.adet.damacana} <span class="soluk kucuk">· ${tl(x.tutar.damacana)}</span>` : html`<span class="soluk">—</span>`}</td>
            <td class="sag sayi">${x.adet.bardak ? html`${x.adet.bardak} <span class="soluk kucuk">· ${tl(x.tutar.bardak)}</span>` : html`<span class="soluk">—</span>`}</td>
            <td class="sag sayi"><b>${x.toplam ? tl(x.toplam) : '—'}</b></td><td class="sag sayi">${x.faturaVar ? tl(sayi(x.fatura.tutar)) : html`<span class="soluk">—</span>`}</td>
            <td class="sag sayi" style=${x.kontrol === 'fark' ? 'color:var(--yok);font-weight:700' : ''}>${x.faturaVar ? (Math.abs(x.fark) < 0.01 ? '0' : isaretli(x.fark)) : html`<span class="soluk">—</span>`}</td>
            <td><${KontrolRozeti} x=${x} buAy=${bgAy} /></td><td class="sag sayi">${x.litre ? lt(x.litre) : html`<span class="soluk">—</span>`}</td><td class="sag sayi soluk">${x.litre ? lt(x.kumulatif) : ''}</td></tr>`)}
          <tr><td><b>Toplam</b></td><td class="sag sayi">${top((x) => x.adet.damacana)}</td><td class="sag sayi">${top((x) => x.adet.bardak)}</td><td class="sag sayi"><b>${tl(top((x) => x.toplam))}</b></td>
            <td class="sag sayi">${tl(faturali.reduce((t, x) => t + sayi(x.fatura.tutar), 0))}</td><td></td><td></td><td class="sag sayi"><b>${lt(top((x) => x.litre))}</b></td><td></td></tr>
        </tbody></table></div>` : html`<${BosDurum} ikon="fatura" baslik=${`${yil} yılında kayıt yok`} />`}
      <//>`;
  }

  /* ---------------- Fiyatlar ---------------- */
  function Fiyatlar() {
    const d = depo();
    const liste = S.fiyatlar(d);
    const guncel = S.fiyatBul(d, bugun(), liste);
    const a = S.ayar(d);
    const kullanim = (f, i) => { const son = liste[i + 1]; return d.kayitlar('siparis').filter((s) => !s.iptal && s.tarih >= f.tarih && (!son || s.tarih < son.tarih)).length; };
    return html`<${K.Selam} baslik="Fiyatlar" sag=${html`<button class="d ana-d tz-buyuk" onClick=${() => K.ac(FiyatPenceresi, {})}><${Ikon} ad="arti" />Yeni fiyat (zam)</button>`}>
        Zam gelince yeni fiyatı geçerlilik tarihiyle ekleyin. Her sipariş, verildiği tarihteki fiyatla hesaplanır; eski siparişler değişmez.<//>
      <div class="tz-izgara">
        <${K.Kart} baslik="Fiyat geçmişi">
          ${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>Geçerlilik</th><th class="sag">Damacana</th><th class="sag">Bardak koli</th><th class="sag">KDV</th><th>Açıklama</th><th class="sag">Sipariş</th></tr></thead><tbody>
            ${liste.map((f, i) => [f, i]).reverse().map(([f, i]) => html`<tr class="tik" onClick=${() => K.ac(FiyatPenceresi, { kayit: f })}>
              <td>${tarihYaz(f.tarih)}${f === guncel ? html` <span class="rozet iyi">Güncel</span>` : ''}</td><td class="sag sayi">${tl(sayi(f.damacana))}</td><td class="sag sayi">${tl(sayi(f.bardak))}</td>
              <td class="sag sayi">%${sayi(f.kdv)}</td><td>${f.aciklama || html`<span class="soluk">—</span>`}</td><td class="sag sayi">${kullanim(f, i)}</td></tr>`)}
          </tbody></table></div>` : html`<${BosDurum} ikon="fatura" baslik="Fiyat girilmemiş" aciklama="Tutarların hesaplanması için en az bir fiyat ekleyin." />`}
        <//>
        <${K.Kart} baslik="Litre hesabı" sag=${html`<a href="#/ayarlar" style="color:var(--ana)">Değiştir →</a>`}>
          <div class="su-fiyat">
            <div><${Cizim} tur="damacana" boyut=${0.8} /><span>Damacana<small>bir damacana</small></span><b>${K.sayiYaz(sayi(a.damacanaL))} L</b></div>
            <div><${Cizim} tur="bardak" boyut=${0.8} /><span>Bardak su koli<small>${a.koliBardak} bardak × ${a.bardakMl} ml</small></span><b>${K.sayiYaz((sayi(a.koliBardak) * sayi(a.bardakMl)) / 1000, 1)} L</b></div>
          </div>
        <//>
      </div>`;
  }

  /* ---------------- Ayarlar ---------------- */
  function SuAyarlari() {
    const d = depo();
    const [f, setF] = useState(() => { const a = S.ayar(d); return { ...a, koliBardak: String(a.koliBardak), bardakMl: String(a.bardakMl), damacanaL: String(a.damacanaL) }; });
    const s = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
    const ornek = String(f.mesaj || S.VARSAYILAN.mesaj).replace(/\{liste\}/g, '10 damacana ve 10 koli bardak su');
    async function kaydet() {
      await d.kaydet([{ c: 'ayar', k: 'genel', v: { tedarikci: f.tedarikci.trim(), telefon: f.telefon.trim(), mesaj: f.mesaj.trim() || S.VARSAYILAN.mesaj,
        koliBardak: sayi(f.koliBardak) || S.VARSAYILAN.koliBardak, bardakMl: sayi(f.bardakMl) || S.VARSAYILAN.bardakMl, damacanaL: sayi(f.damacanaL) || S.VARSAYILAN.damacanaL } }]);
      bildir('Su ayarları kaydedildi.');
    }
    return html`<${K.AyarKarti} baslik="Su firması ve hesap" aciklama="Bu sistemi kullanan herkes için ortaktır." sag=${html`<button class="d ana-d kucuk-d" onClick=${kaydet}><${Ikon} ad="tik" boyut=${15} />Kaydet</button>`}>
      <div class="form-izgara">
        <${Alan} etiket="Su firması" sinif="s6"><input class="girdi" value=${f.tedarikci} onInput=${s('tedarikci')} placeholder="Siparişin verildiği bayi" /><//>
        <${Alan} etiket="WhatsApp numarası" sinif="s6" ipucu="Girilirse mesaj doğrudan bu kişiye açılır"><input class="girdi" type="tel" value=${f.telefon} onInput=${s('telefon')} placeholder="0 5xx xxx xx xx" /><//>
        <${Alan} etiket="Sipariş mesajı" ipucu=${`{liste} yerine sipariş yazılır. Örnek: ${ornek}`}><textarea class="girdi" rows="2" value=${f.mesaj} onInput=${s('mesaj')} /><//>
        <${Alan} etiket="Koli içi bardak" sinif="s4"><input class="girdi sayi" inputmode="numeric" value=${f.koliBardak} onInput=${s('koliBardak')} /><//>
        <${Alan} etiket="Bardak (ml)" sinif="s4"><input class="girdi sayi" inputmode="numeric" value=${f.bardakMl} onInput=${s('bardakMl')} /><//>
        <${Alan} etiket="Damacana (litre)" sinif="s4"><input class="girdi sayi" inputmode="decimal" value=${f.damacanaL} onInput=${s('damacanaL')} /><//>
      </div>
    <//>`;
  }
  function Ayarlar() {
    return html`<${K.AyarlarSayfasi} cop=${{
      siparis: { ad: 'Sipariş', ozet: (r) => `${tarihYaz(r.tarih)} · ${S.liste(r)}` },
      teslim: { ad: 'Teslimat', ozet: (r) => `${tarihYaz(r.tarih)} · ${S.liste(r)}` },
      fatura: { ad: 'Fatura', ozet: (r) => `${S.ayAdi(r.ay)} · ${r.tutar !== '' && r.tutar != null ? tl(sayi(r.tutar)) : 'tutarsız'}` },
      fiyat: { ad: 'Fiyat', ozet: (r) => `${tarihYaz(r.tarih)} · damacana ${tl(sayi(r.damacana))}, koli ${tl(sayi(r.bardak))}` },
    }}><${SuAyarlari} /><//>`;
  }

  /* ---------------- Excel ---------------- */
  const metin = (v, hiza) => ({ v: v ?? '', tur: 'metin', hiza });
  const tarihH = (v) => (v ? { v, tur: 'tarih' } : metin(''));
  const sayiH = (v) => (v === '' || v == null ? metin('') : { v: Number(v) || 0, tur: 'sayi' });
  /* Eski tablodaki gibi: her teslimat × ürün bir satır; sipariş adedi ilk satırda. */
  function excelSiparis(d) {
    const liste = S.fiyatlar(d);
    const a = S.ayar(d);
    const satirlar = [];
    const siparisler = d.kayitlar('siparis').sort((x, y) => (x.tarih < y.tarih ? -1 : x.tarih > y.tarih ? 1 : x._olusturma - y._olusturma));
    for (const s of siparisler) {
      const x = S.durum(d, s);
      for (const u of S.URUNLER) {
        const tl2 = x.teslimler.filter((t) => sayi(t[u.id]) > 0);
        if (!sayi(s[u.id]) && !tl2.length) continue;
        const f = S.fiyatBul(d, s.tarih, liste);
        const birim = sayi(f && f[u.id]);
        const kdvO = sayi(f && f.kdv) / 100;
        const satir = (t, ilk) => {
          const n = t ? sayi(t[u.id]) : 0;
          const haric = n * birim;
          return { cizili: !!s.iptal, hucreler: [tarihH(s.tarih), metin(s.no), metin(u.excel), ilk ? sayiH(sayi(s[u.id])) : metin(''), tarihH(t && t.tarih), t ? sayiH(n) : metin(''), sayiH(birim),
            t ? sayiH(haric) : metin(''), t ? sayiH(haric * kdvO) : metin(''), t ? sayiH(haric * (1 + kdvO)) : metin(''), metin(t ? S.ayAdi(t.tarih.slice(0, 7)) : ''),
            t ? sayiH(S.litre(d, { [u.id]: n }, a)) : metin(''), metin(x.ad), metin([ilk ? s.notlar : '', t && t.notlar].filter(Boolean).join(' · '), 'sol')] };
        };
        if (!tl2.length) satirlar.push(satir(null, true));
        tl2.forEach((t, i) => satirlar.push(satir(t, i === 0)));
      }
    }
    K.excel(`su-siparisleri-${bugun()}.xlsx`, {
      sayfa: 'Su siparişleri',
      sutunlar: [12, 14, 13, 9, 12, 9, 9, 11, 9, 11, 14, 8, 12, 34].map((genislik) => ({ genislik })),
      baslik: ['Sipariş tarihi', 'Sipariş no', 'Cinsi', 'Sipariş adedi', 'Teslim tarihi', 'Teslim adedi', 'Birim fiyat ₺', 'Tutar (KDV hariç) ₺', 'KDV ₺', 'Toplam ₺', 'Fatura dönemi', 'Litre', 'Durum', 'Açıklama'],
      satirlar,
    });
  }
  function excelFatura(satirlar, yil) {
    const durum = { esit: 'Eşleşiyor', fark: 'Fark var', bekliyor: 'Fatura bekleniyor', yok: '' };
    K.excel(`su-faturalari-${yil}.xlsx`, {
      sayfa: `Su ${yil}`,
      sutunlar: [14, 10, 12, 10, 12, 10, 14, 13, 11, 17, 14, 10, 12].map((genislik) => ({ genislik })),
      baslik: ['Dönem', 'Damacana adet', 'Damacana ₺', 'Bardak koli adet', 'Bardak koli ₺', 'KDV ₺', 'Hesaplanan (KDV dahil) ₺', 'Fatura tutarı ₺', 'Fark ₺', 'Durum', 'Fatura no', 'Litre', 'Yıl içi litre'],
      satirlar: satirlar.map((x) => ({ hucreler: [metin(S.ayAdi(x.ay)), sayiH(x.adet.damacana), sayiH(x.tutar.damacana), sayiH(x.adet.bardak), sayiH(x.tutar.bardak), sayiH(x.kdv), sayiH(x.toplam),
        x.faturaVar ? sayiH(sayi(x.fatura.tutar)) : metin(''), x.faturaVar ? sayiH(x.fark) : metin(''), metin(durum[x.kontrol]), metin(x.fatura?.faturaNo || ''), sayiH(x.litre), sayiH(x.kumulatif)] })),
    });
  }

  /* ---------------- Arama ---------------- */
  function arama(d, q) {
    const l = [];
    for (const s of d.kayitlar('siparis')) {
      if (ara(`${s.no} ${tarihYaz(s.tarih)} ${s.notlar || ''} ${S.liste(s)}`, q)) l.push({ tur: 'Sipariş', ad: `${s.no} · ${S.liste(s)}`, ek: `${tarihYaz(s.tarih)} · ${S.durum(d, s).ad}`, fn: () => siparisAc(s) });
    }
    for (const x of S.aylar(d)) if (ara(`${S.ayAdi(x.ay)} fatura ${x.fatura?.faturaNo || ''}`, q)) l.push({ tur: 'Fatura', ad: S.ayAdi(x.ay), ek: tl(x.toplam), fn: () => faturaAc(x.ay) });
    return l;
  }

  NT.suUI = { Cizim, SiparisFormu, TeslimPenceresi, FaturaPenceresi };
  K.calistir({
    sekmeler: [
      { id: 'genel', ad: 'Genel Bakış', ikon: 'ozet' },
      { id: 'siparisler', ad: 'Siparişler', ikon: 'dolum', sayac: (d) => d.kayitlar('siparis').filter((s) => S.acikMi(d, s)).length },
      { id: 'faturalar', ad: 'Faturalar', ikon: 'fatura', sayac: (d) => { const bgAy = bugun().slice(0, 7); return S.aylar(d).filter((x) => x.kontrol === 'fark' || (x.kontrol === 'bekliyor' && x.ay < bgAy)).length; } },
      { id: 'fiyatlar', ad: 'Fiyatlar', ikon: 'etiket' },
      { id: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
    ],
    sayfalar: { genel: GenelBakis, siparisler: Siparisler, faturalar: Faturalar, fiyatlar: Fiyatlar, ayarlar: Ayarlar },
    eylemler: [
      { ad: 'Su sipariş et', alt: 'Sipariş kaydı + WhatsApp mesajı', ikon: 'dolum', tus: 'S', fn: yeniSiparis },
      { ad: 'Su geldi', alt: 'Bekleyen siparişin teslimatı', ikon: 'tik', tus: 'G', fn: suGeldi },
      { ad: 'Fatura gir', alt: 'Ay sonu fatura kontrolü', ikon: 'fatura', tus: 'F', fn: faturaGir },
    ],
    arama,
    uzakKoleksiyonlar: ['siparis', 'teslim', 'fatura', 'fiyat'],
  });
})();
