/*
 * Personel paneli — arayüz. İki görünüm:
 *   personel (varsayılan): telefon önce; kartlar, formlar, taleplerim, bildirimlerim, profil, alt gezinme.
 *   yonetim (&gorunum=yonetim): kenar menülü iskelet; bekleyen onaylar, talepler, bildirimler, izin durumu.
 * Şimdilik yalnız sunum modunda (?demo) açılır; gerçek hesap ve yetki altyapısı sonraki adımdır (context/personel-paneli.md).
 */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, render, useState, useEffect } = window.htmPreact;
  const { Ikon, Modal, Alan, BosDurum, BelgeKutusu, Avatar, GlobalKatman, bildir } = NT.ui;
  const K = NT.kabuk;
  const P = NT.personel;
  const { c, adi } = P;
  const { bugun, uid, tarihYaz, onceYaz, ara } = NT.c;
  const b = NT.baglanti;
  const depo = () => b.depo;
  const cm = (tr, en, ...a) => c(tr, en).replace(/\{(\d+)\}/g, (_, i) => String(a[i] ?? ''));

  const url = new URLSearchParams(location.search);
  const YONETIM = url.get('gorunum') === 'yonetim' && !NT.personelDemo.personelMi(url.get('kullanici'));
  /* Onay yalnız Yönetici'de (Kamil, Farukcan). Canlıda rol tablosundan gelecek; şimdilik mevcut ad kuralı. */
  const yonetici = () => K.yetkili();
  const anonimAnahtar = () => 'nt.sunum.anonim.' + b.kullanici;
  const anonimKodlar = () => {
    try { return JSON.parse(localStorage.getItem(anonimAnahtar()) || '[]'); } catch { return []; }
  };

  /* ---------------- Ortak parçalar ---------------- */
  const Rozet = ({ durum, tablo = P.TALEP_DURUM }) => { const x = tablo[durum] || Object.values(tablo)[0]; return html`<span class=${'rozet ' + x.rozet}><${Ikon} ad=${x.ikon} />${adi(x)}</span>`; };
  const TurSimge = ({ tur, bildirim, buyuk }) => {
    const x = bildirim ? P.bildirimTuru(tur) : P.talepTuru(tur);
    return html`<span class=${`pn-simge pn-${tur}${buyuk ? ' buyuk' : ''}`} aria-hidden="true"><${Ikon} ad=${x.ikon} boyut=${buyuk ? 26 : 18} /></span>`;
  };
  const Secenekler = ({ liste, deger, degis, sinif = '' }) => html`<div class=${'pn-secenekler ' + sinif} role="radiogroup">${liste.map((x) => html`
    <button type="button" role="radio" aria-checked=${deger === x.id} class=${deger === x.id ? 'secili' : ''} onClick=${() => degis(x.id)}>${adi(x)}</button>`)}</div>`;
  const Anahtar = ({ deger, degis, children }) => html`<label class="pn-anahtar"><input type="checkbox" checked=${deger} onChange=${(e) => degis(e.target.checked)} /><span class="iz" aria-hidden="true" /><span>${children}</span></label>`;
  const YERLER = ['Dolum alanı', 'Depo', 'Üretim / reaktör', 'Kazan dairesi', 'Laboratuvar', 'Ofis', 'Bahçe / dış alan'];

  /* Gönderim sonrası kısa teşekkür + (isimsizde) takip kodu. */
  function Gonderildi({ baslik, metin, kod, kapat }) {
    return html`<${Modal} dar baslik=${baslik} kapat=${kapat} alt=${html`<button class="d ana-d" onClick=${kapat}>${c('Tamam', 'OK')}</button>`}>
      <div class="modal-ic pn-tesekkur"><span class="pn-tik"><${Ikon} ad="daire_tik" boyut=${40} /></span><p>${metin}</p>
        ${kod && html`<div class="pn-kod"><small>${c('Takip kodunuz', 'Your tracking code')}</small><b class="mono">${kod}</b>
          <span>${c('Gerektiğinde kodu Bildirimler sekmesindeki sorguda kullanabilirsiniz.', 'You can also look up the report by code in the Reports tab.')}</span></div>`}
      </div><//>`;
  }

  /* ---------------- Formlar (personel) ---------------- */
  function IzinFormu({ kapat }) {
    const d = depo();
    const [f, setF] = useState({ izinTur: 'yillik', bas: '', bit: '', aciklama: '', rapor: [] });
    const [denendi, setDenendi] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const bit = f.bit || f.bas;
    const gun = P.gunSay(f.bas, bit, f.izinTur);
    const durum = P.izinDurumu(d, b.kullanici);
    const hata = { bas: !f.bas && c('Başlangıç tarihini seçin', 'Choose a start date'), bit: f.bit && f.bit < f.bas && c('Bitiş başlangıçtan önce olamaz', 'End cannot be before start'),
      gun: f.bas && !gun && c('Seçilen aralıkta iş günü yok', 'No working days in this range') };
    async function gonder() {
      setDenendi(true);
      if (hata.bas || hata.bit || hata.gun) return;
      const no = await talepYaz(d, 'izin', { izinTur: f.izinTur, bas: f.bas, bit, gun, aciklama: f.aciklama.trim(), rapor: f.rapor });
      kapat();
      K.ac(Gonderildi, { baslik: c('Talebiniz gönderildi', 'Request sent'), metin: cm('{0} numaralı izin talebiniz yönetime iletildi. Onaylanınca burada ve yoklamada görünür.', 'Your leave request {0} has been sent. Once approved it shows here and in attendance.', no) });
    }
    return html`<${Modal} baslik=${c('İzin talebi', 'Leave request')} kapat=${kapat} sinif="pn-form"
      alt=${html`<button class="d hayalet" onClick=${kapat}>${c('Vazgeç', 'Cancel')}</button><button class="d ana-d pn-gonder" onClick=${gonder}><${Ikon} ad="tik" />${c('Talebi gönder', 'Send request')}</button>`}>
      <div class="modal-ic pn-alanlar">
        <${Alan} etiket=${c('İzin türü', 'Leave type')}><${Secenekler} sinif="iki" liste=${P.IZIN_TURLERI} deger=${f.izinTur} degis=${s('izinTur')} /><//>
        <div class="pn-yanyana">
          <${Alan} etiket=${c('Başlangıç', 'From')} hata=${denendi && hata.bas}><input class="girdi" type="date" value=${f.bas} min=${bugun()} onInput=${(e) => s('bas')(e.target.value)} /><//>
          <${Alan} etiket=${c('Bitiş', 'To')} hata=${(denendi || f.bit) && hata.bit} ipucu=${!f.bit && f.bas ? c('Boş bırakırsanız tek gün', 'Leave empty for a single day') : ''}><input class="girdi" type="date" value=${f.bit} min=${f.bas || bugun()} onInput=${(e) => s('bit')(e.target.value)} /><//>
        </div>
        <div class=${'pn-hesap' + (denendi && hata.gun ? ' hata' : '')}>
          <b>${f.bas ? (hata.gun || cm(f.izinTur === 'raporlu' ? '{0} gün' : '{0} iş günü', f.izinTur === 'raporlu' ? '{0} days' : '{0} working days', gun)) : c('Tarih seçince gün sayısı hesaplanır', 'Pick dates to count the days')}</b>
          ${f.izinTur === 'yillik' && durum && html`<span>${cm('Yıllık izin hakkınız: {0} gün · kalan {1}', 'Annual leave: {0} days · {1} left', durum.hak, durum.kalan - durum.bekleyen)}${f.bas && gun ? cm(' → bu talepten sonra {0}', ' → {0} after this request', durum.kalan - durum.bekleyen - gun) : ''}</span>`}
          ${f.izinTur === 'yillik' && durum && durum.kalan - durum.bekleyen - gun < 0 && html`<span class="kirmizi">${c('Hakkınızdan fazla gün istiyorsunuz; yönetim ayrıca değerlendirir.', 'This exceeds your entitlement; management will review it.')}</span>`}
        </div>
        <${Alan} etiket=${c('Açıklama', 'Note')}><textarea class="girdi" rows="3" value=${f.aciklama} onInput=${(e) => s('aciklama')(e.target.value)} placeholder=${c('İsteğe bağlı', 'Optional')} /><//>
        ${f.izinTur === 'raporlu' && html`<div class="pn-gizli-ek"><${BelgeKutusu} foto baslik=${c('Rapor fotoğrafı', 'Sick note photo')} ekler=${f.rapor} degis=${s('rapor')} ipucu=${c('Fotoğrafını çekip ekleyin', 'Take a photo and attach it')} />
          <span class="pn-kilit"><${Ikon} ad="goz" boyut=${14} />${c('Yalnız yönetim görür (sağlık bilgisi).', 'Only management can see it (health data).')}</span></div>`}
      </div><//>`;
  }

  function MalzemeFormu({ kapat }) {
    const d = depo();
    const yeni = () => ({ id: uid(), ad: '', adet: '1', birim: 'adet', not: '' });
    const [kalemler, setKalemler] = useState(() => [yeni()]);
    const [notAcik, setNotAcik] = useState(null);
    const [acil, setAcil] = useState(false);
    const [denendi, setDenendi] = useState(false);
    const dolu = kalemler.filter((k) => k.ad.trim());
    const miktarGecerli = (k) => Number(k.adet) > 0 && Number.isFinite(Number(k.adet)) &&
      (['kg', 'm'].includes(k.birim) || Number.isSafeInteger(Number(k.adet)));
    const kalemDegis = (i, alan) => (e) => setKalemler((l) => l.map((k, j) => (j === i ? { ...k, [alan]: e.target.value } : k)));
    async function gonder() {
      setDenendi(true);
      if (!dolu.length || !dolu.every(miktarGecerli)) return;
      const no = await talepYaz(d, 'malzeme', { kalemler: dolu.map((k) => ({ ad: k.ad.trim(), adet: Number(k.adet), birim: k.birim, not: k.not.trim() })), acil });
      kapat();
      K.ac(Gonderildi, { baslik: c('İsteğiniz gönderildi', 'Request sent'), metin: cm('{0} numaralı malzeme isteğiniz yönetime iletildi.', 'Your material request {0} has been sent.', no) });
    }
    return html`<${Modal} baslik=${c('Malzeme isteği', 'Material request')} kapat=${kapat} sinif="pn-form"
      alt=${html`<button class="d hayalet" onClick=${kapat}>${c('Vazgeç', 'Cancel')}</button><button class="d ana-d pn-gonder" onClick=${gonder}><${Ikon} ad="tik" />${c('İsteği gönder', 'Send request')}</button>`}>
      <div class="modal-ic pn-alanlar">
        <${Alan} etiket=${c('Neye ihtiyacınız var?', 'What do you need?')} hata=${denendi && (!dolu.length ? c('En az bir malzeme yazın', 'Add at least one item') : !dolu.every(miktarGecerli) && c('Her kalemin miktarını ve birimini kontrol edin.', 'Check the quantity and unit for each item.'))}>
          <div class="pn-kalemler">${kalemler.map((k, i) => html`<div class="pn-kalem" key=${k.id}>
            <input class="girdi" value=${k.ad} onInput=${kalemDegis(i, 'ad')} placeholder=${c('Örn: Nitril eldiven (L)', 'e.g. Nitrile gloves (L)')} />
            <input class="girdi sayi" type="number" min="0" step=${['kg', 'm'].includes(k.birim) ? 'any' : '1'} inputmode="decimal" value=${k.adet} onInput=${kalemDegis(i, 'adet')} aria-label=${c('Miktar', 'Quantity')} />
            <select class="girdi" aria-label=${c('Birim', 'Unit')} value=${k.birim} onChange=${kalemDegis(i, 'birim')}>${P.BIRIMLER.map((x) => html`<option value=${x.id}>${adi(x)}</option>`)}</select>
            ${kalemler.length > 1 && html`<button type="button" class="d hayalet ikon-d" aria-label=${c('Kaldır', 'Remove')} onClick=${() => setKalemler((l) => l.filter((_, j) => j !== i))}><${Ikon} ad="kapat" /></button>`}
            <button type="button" class=${'d hayalet kucuk-d pn-not-ekle' + (k.not ? ' var' : '')} aria-expanded=${notAcik === k.id} onClick=${() => setNotAcik(notAcik === k.id ? null : k.id)}>${k.not ? c('Notu düzenle', 'Edit note') : c('Not ekle', 'Add note')}</button>
            ${notAcik === k.id && html`<textarea class="girdi pn-kalem-notu" rows="2" value=${k.not} onInput=${kalemDegis(i, 'not')} aria-label=${c('Kalem notu', 'Item note')} />`}
          </div>`)}
          <button type="button" class="d kucuk-d" onClick=${() => setKalemler((l) => [...l, yeni()])}><${Ikon} ad="arti" boyut=${15} />${c('Bir malzeme daha', 'Add another item')}</button></div><//>
        <${Anahtar} deger=${acil} degis=${setAcil}>${c('Acil — iş bunun yüzünden duruyor', 'Urgent — work is blocked without it')}<//>
      </div><//>`;
  }

  function MalzemeKalemleri({ t }) {
    return html`<span class="pn-malzeme-ozet">${(t.kalemler || []).map((k) => html`<span class="pn-malzeme-kalem">
      ${P.kalemYazi(k)}${k.not && html` <span class="pn-not">
        <button type="button" class="pn-not-dugme" onClick=${(e) => { e.stopPropagation(); e.currentTarget.focus(); }}>${c('Not', 'Note')}</button>
        <span class="pn-not-metin" role="tooltip">${k.not}</span>
      </span>`}</span>`)}</span>`;
  }

  function ArizaFormu({ kapat }) {
    const d = depo();
    const [f, setF] = useState({ yer: '', aciklama: '', foto: [], durdu: false });
    const [denendi, setDenendi] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const hata = { yer: !f.yer.trim() && c('Yeri seçin ya da yazın', 'Choose or type a location'), aciklama: f.aciklama.trim().length < 5 && c('Ne olduğunu kısaca yazın', 'Briefly describe the problem') };
    async function gonder() {
      setDenendi(true);
      if (hata.yer || hata.aciklama) return;
      const no = await talepYaz(d, 'ariza', { yer: f.yer.trim(), aciklama: f.aciklama.trim(), foto: f.foto, durdu: f.durdu });
      kapat();
      K.ac(Gonderildi, { baslik: c('Arıza bildirildi', 'Fault reported'), metin: cm('{0} numaralı bildiriminiz yönetime iletildi.', 'Your report {0} has been sent to management.', no) });
    }
    return html`<${Modal} baslik=${c('Arıza bildir', 'Report a fault')} kapat=${kapat} sinif="pn-form"
      alt=${html`<button class="d hayalet" onClick=${kapat}>${c('Vazgeç', 'Cancel')}</button><button class="d ana-d pn-gonder" onClick=${gonder}><${Ikon} ad="tik" />${c('Bildir', 'Report')}</button>`}>
      <div class="modal-ic pn-alanlar">
        <${BelgeKutusu} foto baslik=${c('Fotoğraf', 'Photo')} ekler=${f.foto} degis=${s('foto')} ipucu=${c('Arızanın fotoğrafını çekin', 'Take a photo of the fault')} />
        <${Alan} etiket=${c('Nerede?', 'Where?')} hata=${denendi && hata.yer}>
          <div class="pn-yerler">${YERLER.map((y) => html`<button type="button" class=${'tz-cip' + (f.yer === y ? ' secili' : '')} onClick=${() => s('yer')(y)}>${c(y, { 'Dolum alanı': 'Filling area', Depo: 'Warehouse', 'Üretim / reaktör': 'Production / reactor', 'Kazan dairesi': 'Boiler room', Laboratuvar: 'Laboratory', Ofis: 'Office', 'Bahçe / dış alan': 'Yard / outside' }[y])}</button>`)}</div>
          <input class="girdi" value=${f.yer} onInput=${(e) => s('yer')(e.target.value)} placeholder=${c('Ya da yazın: ekipman, makine…', 'Or type: equipment, machine…')} /><//>
        <${Alan} etiket=${c('Ne oldu?', 'What happened?')} hata=${denendi && hata.aciklama}><textarea class="girdi" rows="3" value=${f.aciklama} onInput=${(e) => s('aciklama')(e.target.value)} /><//>
        <${Anahtar} deger=${f.durdu} degis=${s('durdu')}>${c('Makine / iş durdu', 'Machine / work has stopped')}<//>
      </div><//>`;
  }

  /* Ramak kala, öneri, şikâyet. İsimsizde kimlik yazılmaz (canlıda sunucu işleviyle); yalnız takip kodu verilir. */
  function BildirimFormu({ kapat, ramak }) {
    const d = depo();
    const [f, setF] = useState({ tur: ramak ? 'ramak' : 'oneri', metin: '', yer: '', foto: [], isimsiz: false });
    const [denendi, setDenendi] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const kisa = f.metin.trim().length < 10;
    async function gonder() {
      setDenendi(true);
      if (kisa) return;
      const kod = P.takipKodu();
      await d.numuneIslem(() => [{ c: 'bildirim', k: uid(), u: f.isimsiz ? 'İsimsiz' : b.kullanici, v: {
        no: K.yeniNo(d, 'bildirim', 'BD'), tur: f.tur, isimsiz: f.isimsiz, sahip: f.isimsiz ? '' : b.kullanici,
        takipKodu: kod, tarih: bugun(), metin: f.metin.trim(), yer: f.yer.trim(), foto: f.foto, durum: 'yeni',
      } }]);
      if (f.isimsiz) {
        try { localStorage.setItem(anonimAnahtar(), JSON.stringify([...anonimKodlar(), kod])); } catch { /* Takip kodu aşağıda gösterilir. */ }
      }
      kapat();
      K.ac(Gonderildi, { baslik: c('Teşekkürler', 'Thank you'), kod: f.isimsiz ? kod : '',
        metin: f.isimsiz ? c('Bildiriminiz yönetime isimsiz iletildi. Bildirimler sekmesinden takip edebilirsiniz.', 'Management received your report anonymously. Follow it in the Reports tab.')
          : c('Bildiriminiz yönetime iletildi. Cevabı “Bildirimlerim” sayfasında görürsünüz.', 'Your report was sent. You will see the reply under “My reports”.') });
    }
    return html`<${Modal} baslik=${ramak ? c('Ramak kala / tehlikeli durum', 'Near miss / hazard') : c('Öneri / şikâyet', 'Suggestion / complaint')} kapat=${kapat} sinif=${'pn-form' + (ramak ? ' pn-ramak-form' : '')}
      alt=${html`<button class="d hayalet" onClick=${kapat}>${c('Vazgeç', 'Cancel')}</button><button class="d ana-d pn-gonder" onClick=${gonder}><${Ikon} ad="tik" />${c('Gönder', 'Send')}</button>`}>
      <div class="modal-ic pn-alanlar">
        ${ramak ? html`<p class="pn-aciklama">${c('Bir kaza az kalsın oluyorsa ya da tehlikeli bir durum görürseniz yazın. Amaç suçlu bulmak değil, kazayı olmadan önlemek.', 'If an accident almost happened or you see a hazard, report it. The aim is not to blame anyone but to prevent the accident.')}</p>`
          : html`<${Secenekler} liste=${P.BILDIRIM_TURLERI.filter((x) => x.id !== 'ramak')} deger=${f.tur} degis=${s('tur')} />`}
        <${Alan} etiket=${ramak ? c('Ne gördünüz / ne oldu?', 'What did you see / what happened?') : c('Mesajınız', 'Your message')} hata=${denendi && kisa && c('Biraz daha ayrıntı yazın', 'Please add a bit more detail')}>
          <textarea class="girdi" rows="4" value=${f.metin} onInput=${(e) => s('metin')(e.target.value)} /><//>
        ${ramak && html`<${Alan} etiket=${c('Nerede?', 'Where?')}><input class="girdi" value=${f.yer} onInput=${(e) => s('yer')(e.target.value)} placeholder=${c('Örn: Depo girişi', 'e.g. Warehouse entrance')} /><//>`}
        ${ramak && html`<${BelgeKutusu} foto baslik=${c('Fotoğraf (isteğe bağlı)', 'Photo (optional)')} ekler=${f.foto} degis=${s('foto')} />`}
        <div class=${'pn-isimsiz' + (f.isimsiz ? ' acik' : '')}><${Anahtar} deger=${f.isimsiz} degis=${s('isimsiz')}><b>${c('İsimsiz gönder', 'Send anonymously')}</b>
          <small>${c('Yönetim adınızı görmez.', 'Management will not see your name.')}</small><//></div>
      </div><//>`;
  }

  function StokBildirimi({ kapat }) {
    const [stokTur, setStokTur] = useState(P.STOK_TURLERI[0].id);
    const [aciklama, setAciklama] = useState('');
    const [bekliyor, setBekliyor] = useState(false);
    async function gonder() {
      if (!aciklama.trim() || bekliyor) return;
      setBekliyor(true);
      try {
        await talepYaz(depo(), 'numune', { stokTur, aciklama: aciklama.trim() });
        kapat();
        K.ac(Gonderildi, { baslik: c('Bildirim gönderildi', 'Report sent'), metin: c('Stok bildiriminiz yönetime iletildi.', 'Your stock report has been sent to management.') });
      } finally { setBekliyor(false); }
    }
    return html`<${Modal} dar baslik=${c('Numune stok bildirimi', 'Sample stock report')} kapat=${kapat}
      alt=${html`<button class="d ana-d" disabled=${!aciklama.trim() || bekliyor} onClick=${gonder}>${c('Bildirimi gönder', 'Send report')}</button>`}>
      <div class="modal-ic pn-alanlar">
        <${Secenekler} liste=${P.STOK_TURLERI} deger=${stokTur} degis=${setStokTur} />
        <${Alan} etiket=${c('Açıklama', 'Description')}><textarea class="girdi" rows="3" aria-label=${c('Açıklama', 'Description')} value=${aciklama} onInput=${(e) => setAciklama(e.target.value)} /><//>
      </div><//>`;
  }

  async function talepYaz(d, tur, ayrinti) {
    const [olay] = await d.numuneIslem(() => [{ c: 'talep', k: uid(), v: {
      no: K.yeniNo(d, 'talep', 'TL'), tur, sahip: b.kullanici, tarih: bugun(), durum: 'bekliyor', ...ayrinti,
    } }]);
    return olay.v.no;
  }

  /* ---------------- Talep ve bildirim ayrıntısı (iki görünümde ortak) ---------------- */
  function TalepDetay({ talep: ilk, kapat }) {
    const d = depo();
    const t = d.kayit('talep', ilk.id) || ilk;
    const tur = P.talepTuru(t.tur);
    const yonetimde = YONETIM;
    const ozet = [[c('Numara', 'No'), t.no], [c('Tarih', 'Date'), tarihYaz(t.tarih)], yonetimde && [c('Kişi', 'Person'), t.sahip]].filter(Boolean);
    const alanlar = t.tur === 'izin' ? [[c('İzin türü', 'Leave type'), adi(P.izinTuru(t.izinTur))], [c('Tarihler', 'Dates'), t.bas === t.bit ? tarihYaz(t.bas) : `${tarihYaz(t.bas)} – ${tarihYaz(t.bit)}`], [c('Gün', 'Days'), t.gun], [c('Açıklama', 'Note'), t.aciklama]]
      : t.tur === 'malzeme' ? [[c('Malzemeler', 'Items'), html`<${MalzemeKalemleri} t=${t} />`, true], [c('Neden', 'Reason'), t.neden], [c('Acil', 'Urgent'), t.acil ? c('Evet', 'Yes') : '']]
      : t.tur === 'numune' ? [[c('Stok durumu', 'Stock status'), adi(P.stokTuru(t.stokTur))], [c('Açıklama', 'Description'), t.aciklama, true]]
        : [[c('Yer', 'Location'), t.yer], [c('Açıklama', 'Description'), t.aciklama], [c('Makine durdu', 'Machine stopped'), t.durdu ? c('Evet', 'Yes') : '']];
    const izinDurum = yonetimde && t.tur === 'izin' && t.izinTur === 'yillik' ? P.izinDurumu(d, t.sahip) : null;
    return html`<${NT.ui.KayitDetay} baslik=${adi(tur)} durum=${html`<${Rozet} durum=${t.durum} />`} ozet=${ozet} kapat=${kapat}>
      <${NT.ui.DetayBolumu} baslik=${c('Ayrıntı', 'Details')} ikon=${tur.ikon} alanlar=${alanlar} belgeler=${[[c('Fotoğraf', 'Photo'), t.foto], yonetimde && [c('Rapor', 'Sick note'), t.rapor]].filter(Boolean)} />
      ${izinDurum && html`<div class="uyari-kutu bilgi"><${Ikon} ad="takvim" /><span>${cm('{0}: bu izin yılı hakkı {1} gün, kullanılan {2}, kalan {3}.', '{0}: entitlement {1} days this leave year, used {2}, left {3}.', t.sahip, izinDurum.hak, izinDurum.kullanilan, izinDurum.kalan)}</span></div>`}
      ${t.karar && html`<${NT.ui.DetayBolumu} baslik=${c('Karar', 'Decision')} ikon="daire_tik" alanlar=${[[c('Karar veren', 'Decided by'), t.karar.kim], [c('Tarih', 'Date'), tarihYaz(t.karar.tarih)], [c('Not', 'Note'), t.karar.not, true]]} />`}
      ${yonetimde && t.durum === 'bekliyor' && html`<${KararDugmeleri} talep=${t} sonra=${kapat} />`}
    <//>`;
  }

  async function karar(t, durum, not = '') {
    const d = depo();
    const olaylar = await d.numuneIslem(() => {
      if (!yonetici() || d.kayit('talep', t.id)?.durum !== 'bekliyor') return [];
      return [{ c: 'talep', k: t.id, v: { durum, karar: { kim: b.kullanici, tarih: bugun(), not } } }];
    });
    if (!olaylar.length) return;
    if (durum === 'onaylandi' && t.tur === 'izin') bildir(cm('{0} onaylandı. Canlıda Yoklama’ya “{1}” olarak kendiliğinden işlenecek.', '{0} approved. Live, it will be entered in Attendance as “{1}” automatically.', t.no, adi(P.izinTuru(t.izinTur))));
    else bildir(cm('{0}: {1}.', '{0}: {1}.', t.no, adi(P.TALEP_DURUM[durum])));
  }
  function RedFormu({ talep, kapat, sonra }) {
    const [not, setNot] = useState('');
    const gonder = async () => { if (!not.trim()) return; await karar(talep, 'reddedildi', not.trim()); kapat(); sonra && sonra(); };
    return html`<${Modal} dar baslik=${cm('{0} reddedilsin mi?', 'Decline {0}?', talep.no)} kapat=${kapat}
      alt=${html`<button class="d hayalet" onClick=${kapat}>${c('Vazgeç', 'Cancel')}</button><button class="d tehlike" disabled=${!not.trim()} onClick=${gonder}>${c('Reddet', 'Decline')}</button>`}>
      <div class="modal-ic"><${Alan} etiket=${c('Nedeni (personel görür)', 'Reason (staff will see it)')}><textarea class="girdi" rows="3" value=${not} onInput=${(e) => setNot(e.target.value)} autofocus /><//></div><//>`;
  }
  function KararDugmeleri({ talep, sonra, kompakt }) {
    if (!yonetici()) return html`<span class="soluk kucuk pn-yalniz">${c('Onayı yalnız Yönetici verir', 'Only managers approve')}</span>`;
    return html`<div class=${'pn-karar' + (kompakt ? ' kompakt' : '')}>
      <button class="d ana-d kucuk-d" onClick=${async (e) => { e.stopPropagation(); await karar(talep, talep.tur === 'ariza' ? 'tamamlandi' : 'onaylandi'); sonra && sonra(); }}><${Ikon} ad="tik" boyut=${15} />${talep.tur === 'ariza' ? c('Giderildi', 'Fixed') : c('Onayla', 'Approve')}</button>
      <button class="d kucuk-d" onClick=${(e) => { e.stopPropagation(); K.ac(RedFormu, { talep, sonra }); }}>${c('Reddet', 'Decline')}</button></div>`;
  }

  function BildirimDetay({ bildirim: ilk, kapat }) {
    const d = depo();
    const x = d.kayit('bildirim', ilk.id) || ilk;
    const [cevap, setCevap] = useState(x.cevap || '');
    const tur = P.bildirimTuru(x.tur);
    const guncelle = async (durum) => {
      await d.kaydet([{ c: 'bildirim', k: x.id, v: { durum, cevap: cevap.trim() } }]);
      bildir(cm('{0}: {1}.', '{0}: {1}.', x.no, adi(P.BILDIRIM_DURUM[durum])));
      if (durum !== 'okundu') kapat();
    };
    const ozet = [[c('Numara', 'No'), x.no], [c('Tarih', 'Date'), tarihYaz(x.tarih)], [c('Gönderen', 'From'), x.isimsiz ? html`<span class="rozet mor"><${Ikon} ad="goz" />${c('İsimsiz', 'Anonymous')}</span>` : x.sahip]];
    return html`<${NT.ui.KayitDetay} baslik=${adi(tur)} durum=${html`<${Rozet} durum=${x.durum} tablo=${P.BILDIRIM_DURUM} />`} ozet=${ozet} kapat=${kapat}>
      <${NT.ui.DetayBolumu} baslik=${c('Bildirim', 'Report')} ikon=${tur.ikon} alanlar=${[[c('Yer', 'Location'), x.yer], [c('Metin', 'Text'), x.metin, true]]} belgeler=${[[c('Fotoğraf', 'Photo'), x.foto]]} />
      ${YONETIM ? html`<section class="tz-detay-bolum"><h3><span>${c('Cevap / alınan önlem', 'Reply / action taken')}</span></h3>
          <textarea class="girdi" rows="3" value=${cevap} onInput=${(e) => setCevap(e.target.value)} placeholder=${c('Personel bu cevabı görür', 'Staff will see this reply')} />
          ${yonetici() ? html`<div class="pn-karar">${x.durum === 'yeni' && html`<button class="d kucuk-d" onClick=${() => guncelle('okundu')}><${Ikon} ad="goz" boyut=${15} />${c('Okundu', 'Mark read')}</button>`}
            <button class="d ana-d kucuk-d" disabled=${!cevap.trim()} onClick=${() => guncelle('onlem')}><${Ikon} ad="tik" boyut=${15} />${c('Önlem alındı', 'Action taken')}</button>
            <button class="d kucuk-d" onClick=${() => guncelle('kapandi')}>${c('Kapat', 'Close')}</button></div>` : html`<span class="soluk kucuk">${c('Cevabı yalnız Yönetici yazar', 'Only managers reply')}</span>`}</section>`
        : x.cevap && html`<${NT.ui.DetayBolumu} baslik=${c('Yönetimin cevabı', 'Management reply')} ikon="daire_tik" alanlar=${[[c('Cevap', 'Reply'), x.cevap, true]]} />`}
    <//>`;
  }

  /* ---------------- Personel görünümü (telefon) ---------------- */
  const KARTLAR = [
    { id: 'izin', ad: 'İzin talebi', en: 'Leave request', alt: 'Yıllık, mazeret, rapor', altEn: 'Annual, excused, sick', ikon: 'takvim', ac: () => K.ac(IzinFormu) },
    { id: 'malzeme', ad: 'Malzeme isteği', en: 'Material request', alt: 'Eldiven, KKD, sarf', altEn: 'Gloves, PPE, supplies', ikon: 'kutu', ac: () => K.ac(MalzemeFormu) },
    { id: 'ariza', ad: 'Arıza bildir', en: 'Report a fault', alt: 'Fotoğrafla, yerinden', altEn: 'With a photo, on the spot', ikon: 'ayar', ac: () => K.ac(ArizaFormu) },
    { id: 'ramak', ad: 'Ramak kala', en: 'Near miss', alt: 'İsimsiz gönderilebilir', altEn: 'Can be anonymous', ikon: 'uyari', ac: () => K.ac(BildirimFormu, { ramak: true }) },
    { id: 'oneri', ad: 'Öneri / şikâyet', en: 'Suggestion / complaint', alt: 'İsimsiz gönderilebilir', altEn: 'Can be anonymous', ikon: 'bilgi', ac: () => K.ac(BildirimFormu, {}) },
    { id: 'numune', ad: 'Numune Takip', en: 'Sample Tracking', alt: 'Stok, sayım, şişe girişi, dolum', altEn: 'Stock, stocktake, bottle intake, filling', ikon: 'dolum',
      not: ['Sayım değişiklikleri yönetim stokuna da yansır.', 'Stocktake changes also appear in management’s stock view.'],
      ac: () => { location.href = NT.c.adres('numune', { kullanici: b.kullanici }) + '&gorunum=personel'; } },
    { id: 'yemek', ad: 'Yemek menüsü', en: 'Meal menu', alt: 'Bugünün yemekleri ve aylık tablo', altEn: 'Today’s meals and monthly menu', ikon: 'yemek',
      ac: () => { location.href = NT.c.adres('yemek', { kullanici: b.kullanici }) + '&gorunum=personel'; } },
  ];

  function TalepSatiri({ t }) {
    return html`<li class="pn-satir" onClick=${() => K.ac(TalepDetay, { talep: t })}>
      <${TurSimge} tur=${t.tur} /><span class="ne"><b>${adi(P.talepTuru(t.tur), 'kisa')} · ${P.talepOzet(t)}</b><small>${t.no} · ${onceYaz(t._olusturma)}${t.karar && t.karar.not ? ' · ' + t.karar.not : ''}</small></span>
      <${Rozet} durum=${t.durum} /></li>`;
  }

  function YemekKartiNotu() {
    const [depo, setDepo] = useState(null);
    const [, yenile] = useState(0);
    useEffect(() => {
      let aktif = true;
      let kapat;
      NT.yemekDemo.depoAc(b.kullanici).then((d) => {
        if (!aktif) { d.kapat(); return; }
        const guncelle = () => yenile((n) => n + 1);
        const birak = d.abone(guncelle);
        const zaman = setInterval(guncelle, 60000);
        kapat = () => { clearInterval(zaman); birak(); d.kapat(); };
        setDepo(d);
      }).catch(console.error);
      return () => { aktif = false; kapat?.(); };
    }, []);
    const bugunTarihi = bugun();
    const yemekler = depo ? NT.yemek.yemekler(depo, bugunTarihi, 'ogle').slice(0, 3) : [];
    const resimde = depo && NT.yemek.menu(depo, bugunTarihi.slice(0, 7), 'ogle')?.ek;
    return html`<span class="pn-kart-not pn-kart-menu"><${Ikon} ad="yemek" boyut=${14} /><span>
      <strong>${c('Bugün öğle', 'Lunch today')}</strong>
      <span>${yemekler.length ? yemekler.join(' · ') : resimde ? c('Menüyü açıp görseli inceleyin.', 'Open the menu to see the image.') : c('Menü bilgisi yok', 'No menu listed')}</span>
    </span></span>`;
  }

  function PersonelSelami() {
    const ad = (b.kullanici || '').split(' ')[0];
    const simdi = new Date();
    const saat = simdi.getHours();
    return html`<div class="pn-selam">
      <h1>${saat < 11 ? c('Günaydın', 'Good morning') : saat < 18 ? c('İyi günler', 'Good afternoon') : c('İyi akşamlar', 'Good evening')}${ad ? ', ' + ad : ''}</h1>
      <p>${simdi.toLocaleDateString(NT.dil.yerel(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    </div>`;
  }

  function AnaSayfa() {
    const d = depo();
    const benim = P.benimTaleplerim(d, b.kullanici);
    const acik = benim.filter((t) => t.durum === 'bekliyor').length;
    const izin = P.izinDurumu(d, b.kullanici);
    return html`
      <header class="pn-bant tz-selam tz-selam-bant"><${NT.ui.BantSus} /><div>
        <span class="pn-logo">SKYHEM</span><${PersonelSelami} /></div></header>
      <div class="pn-serit">
        <a href="#/profil"><small>${c('Kalan yıllık izin', 'Annual leave left')}</small><b>${izin ? cm('{0} gün', '{0} days', izin.kalan) : '—'}</b></a>
        <a href="#/taleplerim"><small>${c('Açık taleplerim', 'Open requests')}</small><b>${acik}</b></a>
      </div>
      <div class="pn-ana-izgara">
      <div class="pn-kartlar">${KARTLAR.map((k) => html`<button key=${k.id} class=${'pn-kart pn-k-' + k.id + (k.not || k.id === 'yemek' ? ' pn-kart-notlu' : '')} onClick=${k.ac}>
        <span class="pn-kart-gorsel" aria-hidden="true"><${Ikon} ad=${k.ikon} boyut=${30} /></span>
        <span class="pn-kart-metin"><b>${c(k.ad, k.en)}</b><small>${c(k.alt, k.altEn)}</small>
        ${k.id === 'yemek' ? html`<${YemekKartiNotu} />` : k.not && html`<span class="pn-kart-not"><${Ikon} ad="bilgi" boyut=${14} /><span>${c(...k.not)}</span></span>`}</span></button>`)}</div>
      <section class="pn-bolum pn-ana-talepler"><div class="pn-bolum-bas"><h2>${c('Taleplerim', 'My requests')}</h2>${benim.length > 3 && html`<a href="#/taleplerim">${c('Tümü →', 'All →')}</a>`}</div>
        ${benim.length ? html`<ul class="pn-liste">${benim.slice(0, 3).map((t) => html`<${TalepSatiri} key=${t.id} t=${t} />`)}</ul>` : html`<p class="soluk">${c('Henüz talebiniz yok.', 'No requests yet.')}</p>`}</section>
      </div>`;
  }

  function Taleplerim() {
    const d = depo();
    const [suz, setSuz] = useState('hepsi');
    const benim = P.benimTaleplerim(d, b.kullanici);
    const liste = benim.filter((t) => suz === 'hepsi' || t.tur === suz);
    return html`<div class="pn-sayfa-bas"><h1>${c('Taleplerim', 'My requests')}</h1></div>
      <${K.Cipler} secenekler=${[['hepsi', c('Tümü', 'All'), benim.length], ...P.TALEP_TURLERI.map((x) => [x.id, adi(x, 'kisa'), benim.filter((t) => t.tur === x.id).length])]} deger=${suz} degis=${setSuz} />
      ${liste.length ? html`<ul class="pn-liste">${liste.map((t) => html`<${TalepSatiri} key=${t.id} t=${t} />`)}</ul>` : html`<${BosDurum} ikon="liste" baslik=${c('Talep yok', 'No requests')} />`}`;
  }

  function Bildirimlerim() {
    const d = depo();
    const [kod, setKod] = useState('');
    const kodlar = new Set(anonimKodlar());
    const benim = P.bildirimler(d).filter((x) => x.isimsiz ? kodlar.has(x.takipKodu) : x.sahip === b.kullanici);
    const temiz = kod.trim().toUpperCase().replace(/\s/g, '');
    const bulunan = temiz.length >= 6 ? P.bildirimler(d).find((x) => x.isimsiz && x.takipKodu.replace('-', '') === temiz.replace('-', '')) : null;
    return html`<div class="pn-sayfa-bas"><h1>${c('Bildirimlerim', 'My reports')}</h1></div>
      <div class="pn-bildirim-kartlar">${benim.length ? benim.map((x) => html`<button type="button" key=${x.id} class="pn-bildirim-karti" onClick=${() => K.ac(BildirimDetay, { bildirim: x })}>
        <${TurSimge} tur=${x.tur} bildirim /><span><b>${adi(P.bildirimTuru(x.tur), 'kisa')}</b><span>${x.metin}</span>
        ${x.cevap && html`<small>${x.cevap}</small>`}${x.isimsiz && html`<small>${c('İsimsiz', 'Anonymous')}</small>`}</span>
        <${Rozet} durum=${x.durum} tablo=${P.BILDIRIM_DURUM} /></button>`)
        : html`<p class="soluk">${c('Henüz bildiriminiz yok.', 'No reports yet.')}</p>`}</div>
      <section class="pn-bolum pn-kod-sor"><h2>${c('İsimsiz bildirimimi sorgula', 'Check my anonymous report')}</h2>
        <input class="girdi mono" value=${kod} onInput=${(e) => setKod(e.target.value)} placeholder="ABC-123" autocomplete="off" spellcheck="false" />
        ${temiz.length >= 6 && (bulunan ? html`<div class="pn-sonuc" onClick=${() => K.ac(BildirimDetay, { bildirim: bulunan })}><${TurSimge} tur=${bulunan.tur} bildirim /><span><b>${adi(P.bildirimTuru(bulunan.tur), 'kisa')}</b><small>${bulunan.cevap || c('Henüz cevap yok', 'No reply yet')}</small></span><${Rozet} durum=${bulunan.durum} tablo=${P.BILDIRIM_DURUM} /></div>`
          : html`<p class="soluk kucuk">${c('Bu kodla bildirim bulunamadı.', 'No report found with this code.')}</p>`)}
      </section>`;
  }

  function Profil() {
    const d = depo();
    const k = P.kisiBul(d, b.kullanici);
    const izin = P.izinDurumu(d, b.kullanici);
    return html`<div class="pn-sayfa-bas"><h1>${c('Profil', 'Profile')}</h1></div>
      <section class="pn-bolum pn-profil"><${Avatar} ad=${b.kullanici} /><div><b>${b.kullanici}</b><small>${c('Personel', 'Staff')}${k && k.iseBaslama ? ' · ' + cm('İşe başlama {0}', 'Joined {0}', tarihYaz(k.iseBaslama)) : ''}</small></div></section>
      ${izin && html`<section class="pn-bolum"><h2>${c('Yıllık izin', 'Annual leave')}</h2>
        <div class="pn-izin-tablo">
          <div><small>${c('Hak', 'Entitlement')}</small><b>${izin.hak}</b></div><div><small>${c('Kullanılan', 'Used')}</small><b>${izin.kullanilan}</b></div>
          <div><small>${c('Onay bekleyen', 'Pending')}</small><b>${izin.bekleyen}</b></div><div class="vurgu"><small>${c('Kalan', 'Left')}</small><b>${izin.kalan}</b></div></div>
        <p class="soluk kucuk">${cm('İzin yılı {0} – {1} · kıdem {2} yıl. Devreden izinler İK kaydına göre ayrıca eklenir.', 'Leave year {0} – {1} · {2} years of service. Carried-over days are added from HR records.', tarihYaz(izin.bas), tarihYaz(izin.bit), izin.kidem)}</p></section>`}
      <section class="pn-bolum"><h2>${c('Görünüm', 'Display')}</h2><div class="pn-ayar"><${NT.dil.DilSecimi} /><${K.TemaDugmesi} /></div></section>
      <section class="pn-bolum"><h2>${c('Gizlilik', 'Privacy')}</h2><p class="kucuk">${c('Sunumda kendi talepleriniz gösterilir. Gerçek kayıtlara erişim kişisel hesaplarla tanımlanacak.', 'The demo shows your own requests. Access to live records will be set up with personal accounts.')}</p></section>`;
  }

  const SEKMELER = [
    { id: 'ana', ad: 'Ana sayfa', en: 'Home', ikon: 'ev', Sayfa: AnaSayfa },
    { id: 'taleplerim', ad: 'Taleplerim', en: 'Requests', ikon: 'liste', Sayfa: Taleplerim },
    { id: 'bildirimlerim', ad: 'Bildirimler', en: 'Reports', ikon: 'uyari', Sayfa: Bildirimlerim },
    { id: 'profil', ad: 'Profil', en: 'Profile', ikon: 'kisi', Sayfa: Profil },
  ];
  const sekmeAl = () => { const s = (location.hash.match(/^#\/(\w+)/) || [])[1]; return SEKMELER.find((x) => x.id === s) || SEKMELER[0]; };

  function PersonelKabuk() {
    const [sekme, setSekme] = useState(sekmeAl());
    useEffect(() => { const f = () => { setSekme(sekmeAl()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
    useEffect(() => {
      if (location.hash === '#/stok-bildir') {
        history.replaceState(null, '', '#/ana');
        K.ac(StokBildirimi);
      }
    }, []);
    const d = depo();
    const acik = P.benimTaleplerim(d, b.kullanici).filter((t) => t.durum === 'bekliyor').length;
    return html`<div class="pn-kok tz-m-personel">
      ${b.mod === 'demo' && html`<div class="pn-sunum"><a class="pn-geri" href=${NT.c.adres('portal', { kullanici: url.get('kullanici') })}>← ${c('Paneller', 'Panels')}</a><b>${c('SUNUM', 'DEMO')}</b><span>${cm('Personel paneli · {0}', 'Staff panel · {0}', b.kullanici)}</span></div>`}
      <header class="pn-masaustu-bant">
        <div class="pn-masaustu-ic">
          <div class="pn-masaustu-ust">
            <span class="pn-marka"><span class="pn-marka-logo"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" /></span><b>SKYHEM Takip</b></span>
            <span class="pn-masaustu-kisi"><${Avatar} ad=${b.kullanici} kucuk />${b.kullanici}</span>
          </div>
          ${sekme.id === 'ana' && html`<div class="pn-masaustu-selam"><${PersonelSelami} /></div>`}
          <nav class="pn-alt" style=${{ '--pn-aktif-sekme': SEKMELER.indexOf(sekme), '--pn-sekme-sayisi': SEKMELER.length }} aria-label=${c('Sayfalar', 'Pages')}>${SEKMELER.map((s) => html`<a key=${s.id} href=${'#/' + s.id} class=${sekme.id === s.id ? 'aktif' : ''} aria-current=${sekme.id === s.id ? 'page' : undefined}>
            <span class="ik"><${Ikon} ad=${s.ikon} boyut=${22} />${s.id === 'taleplerim' && acik > 0 && html`<i>${acik}</i>`}</span>${c(s.ad, s.en)}</a>`)}</nav>
        </div>
      </header>
      <main class=${sekme.id === 'ana' ? 'pn-icerik pn-icerik-ana' : 'pn-icerik'}><${sekme.Sayfa} /></main>
    </div>`;
  }

  /* ---------------- Yönetim görünümü (kenar menülü iskelet) ---------------- */
  function Onaylar() {
    const d = depo();
    const [suz, setSuz] = useState('hepsi');
    const talepler = P.bekleyenler(d);
    const bildirimler = P.yeniBildirimler(d);
    const satirlar = [...talepler.map((t) => ({ t, tur: t.tur })), ...bildirimler.map((x) => ({ x, tur: x.tur === 'ramak' ? 'ramak' : 'oneri' }))]
      .sort((a, b2) => ((b2.t || b2.x)._olusturma - (a.t || a.x)._olusturma));
    const sayi = (id) => satirlar.filter((s) => s.tur === id).length;
    const liste = satirlar.filter((s) => suz === 'hepsi' || s.tur === suz);
    return html`<${K.Selam} bant baslik=${c('Bekleyen onaylar', 'Pending approvals')} sag=${b.mod === 'demo' && html`<a class="d" href=${NT.c.adres('personel')}><${Ikon} ad="kisi" boyut=${15} />${c('Personel panelinde gör', 'See in staff panel')}</a>`}>
        ${satirlar.length ? cm('{0} talep karar, {1} bildirim okunmayı bekliyor.', '{0} requests need a decision, {1} reports are unread.', talepler.length, bildirimler.length) : c('Bekleyen bir şey yok.', 'Nothing pending.')}
        ${!yonetici() && c(' Siz görüntüleyebilirsiniz; kararı Yönetici verir.', ' You can view; managers decide.')}<//>
      <${K.Cipler} secenekler=${[['hepsi', c('Tümü', 'All'), satirlar.length], ...P.TALEP_TURLERI.map((x) => [x.id, adi(x, 'kisa'), sayi(x.id)]), ['ramak', c('Ramak kala', 'Near miss'), sayi('ramak')], ['oneri', c('Öneri / şikâyet', 'Suggestion'), sayi('oneri')]].filter(([id, , n]) => id === 'hepsi' || n)} deger=${suz} degis=${setSuz} />
      <${K.Kart}>${liste.length ? html`<ul class="pn-onay-liste">${liste.map((s) => s.t ? html`<li key=${s.t.id} onClick=${() => K.ac(TalepDetay, { talep: s.t })}>
          <${TurSimge} tur=${s.t.tur} /><${Avatar} ad=${s.t.sahip} kucuk /><span class="ne"><b>${s.t.sahip} · ${adi(P.talepTuru(s.t.tur), 'kisa')}${s.t.acil || s.t.durdu ? html` <span class="rozet yok">${c('Acil', 'Urgent')}</span>` : ''}</b>${s.t.tur === 'malzeme' ? html`<${MalzemeKalemleri} t=${s.t} />` : html`<small>${P.talepOzet(s.t)} · ${onceYaz(s.t._olusturma)}</small>`}</span>
          <${KararDugmeleri} talep=${s.t} kompakt /></li>`
        : html`<li key=${s.x.id} class="pn-bildirim-satir" onClick=${() => K.ac(BildirimDetay, { bildirim: s.x })}>
          <${TurSimge} tur=${s.x.tur} bildirim />${s.x.isimsiz ? html`<span class="avatar kucuk-av pn-isimsiz-av" title=${c('İsimsiz', 'Anonymous')}>?</span>` : html`<${Avatar} ad=${s.x.sahip} kucuk />`}
          <span class="ne"><b>${s.x.isimsiz ? c('İsimsiz', 'Anonymous') : s.x.sahip} · ${adi(P.bildirimTuru(s.x.tur), 'kisa')}</b><small>${s.x.metin} · ${onceYaz(s.x._olusturma)}</small></span>
          <button class="d kucuk-d" onClick=${(e) => { e.stopPropagation(); K.ac(BildirimDetay, { bildirim: s.x }); }}>${c('Aç', 'Open')}</button></li>`)}</ul>`
        : html`<${BosDurum} ikon="daire_tik" baslik=${c('Hepsi tamam', 'All clear')} aciklama=${c('Yeni talep ya da bildirim gelince burada görünür.', 'New requests and reports appear here.')} />`}<//>`;
  }

  function TumTalepler() {
    const d = depo();
    const [tur, setTur] = useState('hepsi');
    const [q, setQ] = useState('');
    const tum = P.talepler(d).filter((t) => ara(`${t.no} ${t.sahip} ${P.talepOzet(t)}`, q));
    const liste = tum.filter((t) => tur === 'hepsi' || t.tur === tur);
    return html`<${K.Selam} baslik=${c('Talepler', 'Requests')}>${c('Bütün personelin talepleri; satıra tıklayınca ayrıntı ve karar.', 'All staff requests; click a row for details and decision.')}<//>
      <${K.Cipler} secenekler=${[['hepsi', c('Tümü', 'All'), tum.length], ...P.TALEP_TURLERI.map((x) => [x.id, adi(x, 'kisa'), tum.filter((t) => t.tur === x.id).length])]} deger=${tur} degis=${setTur}>
        <input class="girdi" style="max-width:240px;margin-left:8px;border-radius:99px" placeholder=${c('Kişi, no, malzeme…', 'Person, no, item…')} value=${q} onInput=${(e) => setQ(e.target.value)} /><//>
      <${K.Kart}>${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>No</th><th>${c('Kişi', 'Person')}</th><th>${c('Tür', 'Type')}</th><th>${c('Özet', 'Summary')}</th><th>${c('Tarih', 'Date')}</th><th>${c('Durum', 'Status')}</th><th>${c('Karar veren', 'Decided by')}</th></tr></thead><tbody>
        ${liste.map((t) => html`<tr class="tik" key=${t.id} onClick=${() => K.ac(TalepDetay, { talep: t })}><td><span class="etiket-kod">${t.no}</span></td><td><b>${t.sahip}</b></td><td>${adi(P.talepTuru(t.tur), 'kisa')}</td>
          <td class="kucuk">${t.tur === 'malzeme' ? html`<${MalzemeKalemleri} t=${t} />` : P.talepOzet(t)}</td><td class="kucuk">${tarihYaz(t.tarih)}</td><td><${Rozet} durum=${t.durum} /></td><td class="kucuk">${t.karar ? t.karar.kim : ''}</td></tr>`)}</tbody></table></div>`
        : html`<${BosDurum} ikon="liste" baslik=${c('Talep yok', 'No requests')} />`}<//>`;
  }

  function TumBildirimler() {
    const d = depo();
    const liste = P.bildirimler(d);
    return html`<${K.Selam} baslik=${c('Bildirimler', 'Reports')}>${c('Ramak kala, öneri ve şikâyetler. İsimsiz olanlarda gönderenin kimliği sistemde hiç tutulmaz.', 'Near misses, suggestions and complaints. For anonymous ones the sender’s identity is never stored.')}<//>
      <${K.Kart}>${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>No</th><th>${c('Tür', 'Type')}</th><th>${c('Gönderen', 'From')}</th><th>${c('Metin', 'Text')}</th><th>${c('Tarih', 'Date')}</th><th>${c('Durum', 'Status')}</th></tr></thead><tbody>
        ${liste.map((x) => html`<tr class="tik" key=${x.id} onClick=${() => K.ac(BildirimDetay, { bildirim: x })}><td><span class="etiket-kod">${x.no}</span></td><td>${adi(P.bildirimTuru(x.tur), 'kisa')}</td>
          <td>${x.isimsiz ? html`<span class="rozet mor">${c('İsimsiz', 'Anonymous')}</span>` : x.sahip}</td><td class="kucuk">${x.metin}</td><td class="kucuk">${tarihYaz(x.tarih)}</td><td><${Rozet} durum=${x.durum} tablo=${P.BILDIRIM_DURUM} /></td></tr>`)}</tbody></table></div>`
        : html`<${BosDurum} ikon="uyari" baslik=${c('Bildirim yok', 'No reports')} />`}<//>`;
  }

  function IzinDurumu() {
    const d = depo();
    const satirlar = P.kisiler(d).map((k) => ({ k, i: P.izinDurumu(d, k.ad) })).filter((x) => x.i);
    return html`<${K.Selam} baslik=${c('İzin durumu', 'Leave balances')}>${c('Bu izin yılı için yıllık izin hakkı (İş Kanunu 53. madde) ve kullanımı. Devreden izinler ve yaş kuralı henüz hesaba katılmıyor.', 'Annual leave entitlement (Labour Law art. 53) and usage for the current leave year. Carry-over and age rules are not yet included.')}<//>
      <${K.Kart}><div class="tablo-kap"><table class="tablo"><thead><tr><th>${c('Kişi', 'Person')}</th><th>${c('İşe başlama', 'Joined')}</th><th class="sag">${c('Kıdem', 'Service')}</th><th>${c('İzin yılı', 'Leave year')}</th><th class="sag">${c('Hak', 'Entitled')}</th><th class="sag">${c('Kullanılan', 'Used')}</th><th class="sag">${c('Bekleyen', 'Pending')}</th><th class="sag">${c('Kalan', 'Left')}</th></tr></thead><tbody>
        ${satirlar.map(({ k, i }) => html`<tr key=${k.id}><td><b>${k.ad}</b></td><td class="kucuk">${tarihYaz(k.iseBaslama)}</td><td class="sag sayi">${i.kidem}</td><td class="kucuk">${tarihYaz(i.bas)} – ${tarihYaz(i.bit)}</td>
          <td class="sag sayi">${i.hak}</td><td class="sag sayi">${i.kullanilan}</td><td class="sag sayi">${i.bekleyen || ''}</td><td class="sag sayi"><b>${i.kalan}</b></td></tr>`)}</tbody></table></div><//>`;
  }

  /* ---------------- Başlat ---------------- */
  function Hazirlaniyor() {
    return html`<div class="tz-kurulum"><div class="tz-kurulum-kutu"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" />
      <h1>${c('Personel paneli hazırlanıyor', 'Staff panel in preparation')}</h1>
      <p>${c('Bu bölüm şimdilik yalnız sunum modunda açılır. Kişisel hesaplar kurulunca herkes kendi kullanıcı adıyla girecek.', 'For now this section opens in demo mode only. Once personal accounts are set up, everyone signs in with their own username.')}</p>
      <a class="d ana-d tz-buyuk" href=${NT.c.adres('personel', { demo: true })}>${c('Sunumu aç', 'Open demo')}</a></div></div>`;
  }

  if (!(NT.demo && NT.demo.aktif)) {
    render(html`<${Hazirlaniyor} />`, document.getElementById('uygulama'));
    return;
  }
  if (YONETIM) {
    b.modul.ad = 'Personel talepleri'; // yönetim panelinin modülü; personel tarafı ayrı paneldir
    K.calistir({
      sekmeler: [
        { id: 'onaylar', ad: 'Bekleyen onaylar', ikon: 'saat', sayac: (d) => P.dikkatSayisi(d) },
        { id: 'talepler', ad: 'Talepler', ikon: 'liste' },
        { id: 'bildirimler', ad: 'Bildirimler', ikon: 'uyari' },
        { id: 'izin', ad: 'İzin durumu', ikon: 'takvim' },
        { id: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
      ],
      sayfalar: { onaylar: Onaylar, talepler: TumTalepler, bildirimler: TumBildirimler, izin: IzinDurumu, ayarlar: () => html`<${K.AyarlarSayfasi} />` },
    });
    return;
  }
  document.documentElement.classList.add('pn-sayfa');
  function Kok() {
    NT.dil.useDil();
    const [, y] = useState(0);
    const tik = () => y((x) => x + 1);
    // Sunum verisi ekran dinlemeye başlamadan hazır olabilir: abone olur olmaz bir kez yenile.
    useEffect(() => { const birak = b.abone(tik); tik(); return birak; }, []);
    useEffect(() => { if (!b.depo) return undefined; tik(); return b.depo.abone(tik); }, [b.depo]);
    const ic = b.durum === 'hazir' && b.depo ? html`<${PersonelKabuk} />` : html`<div style="display:grid;place-items:center;height:100vh;color:var(--soluk)">${c('Yükleniyor…', 'Loading…')}</div>`;
    return html`${ic}<${K.Katman} /><${GlobalKatman} />`;
  }
  render(html`<${Kok} />`, document.getElementById('uygulama'));
  b.baslat();
})();
