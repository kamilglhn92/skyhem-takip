/*
 * Personel paneli — arayüz. İki görünüm:
 *   personel (varsayılan): telefon önce; kartlar, formlar, taleplerim, bildirimlerim, profil, alt gezinme.
 *   yonetim (&gorunum=yonetim): kenar menülü iskelet; bekleyen onaylar, talepler, bildirimler, izin durumu.
 * Şimdilik yalnız sunum modunda (?demo) açılır; gerçek hesap ve yetki altyapısı sonraki adımdır (context/personel-paneli.md).
 */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, render, useState, useEffect, useRef } = window.htmPreact;
  const { Ikon, Modal, Alan, BosDurum, BelgeKutusu, Avatar, GlobalKatman, bildir } = NT.ui;
  const K = NT.kabuk;
  const P = NT.personel;
  const { c, adi } = P;
  const { bugun, uid, tarihYaz, onceYaz, ara } = NT.c;
  const b = NT.baglanti;
  const depo = () => b.depo;
  const cm = (tr, en, ...a) => c(tr, en).replace(/\{(\d+)\}/g, (_, i) => String(a[i] ?? ''));

  const url = new URLSearchParams(location.search);
  const DEMO = url.has('demo');
  /* Görünüm: sunumda ?gorunum=yonetim (personel adları hariç). Canlıda personel rolü (mimar değil) her zaman personel görünümünü,
     yönetim kadrosu ?gorunum=personel denmedikçe yönetim görünümünü açar; Kamil (personel + mimar) ?gorunum=yonetim ile yönetimi görür. */
  const YONETIM = DEMO ? url.get('gorunum') === 'yonetim' && !NT.personelDemo.personelMi(url.get('kullanici'))
    : !NT.c.personelRolu() && (url.get('gorunum') === 'yonetim' || (url.get('gorunum') !== 'personel' && NT.c.hesap()?.rol === 'yonetici'));
  /* Onay yalnız Yönetici'de (Kamil, Farukcan). Canlıda rol tablosundan gelecek; şimdilik mevcut ad kuralı. */
  const yonetici = () => K.yetkili();
  const anonimAnahtar = () => 'nt.sunum.anonim.' + b.kullanici;
  const anonimKodlar = () => {
    try { return JSON.parse(localStorage.getItem(anonimAnahtar()) || '[]'); } catch { return []; }
  };
  function benimBildirimlerim(d) {
    const kodlar = new Set(anonimKodlar());
    return P.bildirimler(d).filter((x) => x.isimsiz ? kodlar.has(x.takipKodu) : x.sahip === b.kullanici);
  }
  /* Görüldü kaydı: dikkat alanında yalnız henüz açılmamış kararlar, cevaplar ve duyurular kalır.
     Sunumda bu tarayıcıda kişi başına tutulur; canlıda kişisel hesapla sunucuya taşınacak (context/personel-paneli.md). */
  const gorulduAnahtar = () => 'nt.sunum.goruldu.' + b.kullanici;
  const gorulduler = () => { try { return new Set(JSON.parse(localStorage.getItem(gorulduAnahtar()) || '[]')); } catch { return new Set(); } };
  function gorulduYaz(anahtar) {
    const s = gorulduler();
    s.add(anahtar);
    try { localStorage.setItem(gorulduAnahtar(), JSON.stringify([...s].slice(-300))); } catch { /* yalnız şerit tekrar gösterir */ }
    window.dispatchEvent(new Event('pn-goruldu'));
  }

  /* ---------------- Ortak parçalar ---------------- */
  const Rozet = ({ durum, tablo = P.TALEP_DURUM }) => { const x = tablo[durum] || Object.values(tablo)[0]; return html`<span class=${'rozet ' + x.rozet}><${Ikon} ad=${x.ikon} />${adi(x)}</span>`; };
  const GorulduRozeti = ({ koleksiyon, kayit }) => depo().kayit(`${koleksiyon}_goruldu`, kayit.id)
    ? html`<span class="rozet bilgi"><${Ikon} ad="goz" />${c('Görüldü', 'Seen')}</span>` : null;

  function useYonetimGoruldu(koleksiyon, { id, sahip }) {
    const d = depo();
    const gorulduKoleksiyonu = `${koleksiyon}_goruldu`;
    useEffect(() => {
      if (!YONETIM || sahip === b.kullanici || d.kayit(gorulduKoleksiyonu, id)) return;
      const islem = DEMO
        ? d.numuneIslem((guncel) => guncel.kayit(gorulduKoleksiyonu, id) ? [] : [{ c: gorulduKoleksiyonu, k: id, v: {} }])
        : b.hesap && d.rpc('personel_goruldu', { koleksiyon, anahtar: id }).then(() => d.tara());
      islem?.catch(() => bildir(c('Görüldü işareti kaydedilemedi. Kaydı yeniden açarak tekrar deneyin.', 'Could not mark as seen. Reopen the record to try again.')));
    }, [d, koleksiyon, id, sahip]);
  }
  const TurSimge = ({ tur, bildirim, buyuk }) => {
    const x = bildirim ? P.bildirimTuru(tur) : P.talepTuru(tur);
    return html`<span class=${`pn-simge pn-${tur}${buyuk ? ' buyuk' : ''}`} aria-hidden="true"><${Ikon} ad=${x.ikon} boyut=${buyuk ? 26 : 18} /></span>`;
  };
  const Secenekler = ({ liste, deger, degis, sinif = '' }) => html`<div class=${'pn-secenekler ' + sinif} role="radiogroup">${liste.map((x) => html`
    <button type="button" role="radio" aria-checked=${deger === x.id} class=${deger === x.id ? 'secili' : ''} onClick=${() => degis(x.id)}>${adi(x)}</button>`)}</div>`;
  const Anahtar = ({ deger, degis, children }) => html`<label class="pn-anahtar"><input type="checkbox" checked=${deger} onChange=${(e) => degis(e.target.checked)} /><span class="iz" aria-hidden="true" /><span>${children}</span></label>`;
  /* Yıllık izin rakamları şimdilik test gösterimidir; gerçek kalan izinler ileride ayrı bir güncelleme paketiyle gelecek (sekreter kararı, 2026-11-17). */
  const IZIN_TEST = () => c('Yıllık izin rakamları test gösterimidir; gerçek rakamlar daha sonra güncellenecek.', 'Annual leave figures are a test display; the real figures will be updated later.');
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
  function useGonderim() {
    const aktif = useRef(false);
    const [bekliyor, setBekliyor] = useState(false);
    const [hata, setHata] = useState('');
    async function calistir(yaz, tamam) {
      if (aktif.current) return;
      aktif.current = true;
      setBekliyor(true);
      setHata('');
      let sonuc;
      try {
        sonuc = await yaz();
      } catch (e) {
        setHata(e.name === 'BaglantiYok' || depo()?.cevrimici === false
          ? c('Gönderilemedi. İnternet bağlantısını kontrol edip tekrar deneyin.', 'Could not send. Check your internet connection and try again.')
          : c('Sunucu kaydı kabul etmedi. Formdaki bilgiler duruyor. Tekrar deneyin.', 'The server rejected the submission. Your entries are still in the form. Try again.'));
        return;
      } finally {
        aktif.current = false;
        setBekliyor(false);
      }
      tamam(sonuc);
    }
    return { bekliyor, hata, calistir };
  }

  function GonderimAlt({ gonderim, kapat, gonder, etiket, devreDisi, tik = true }) {
    return html`
      ${gonderim.hata && html`<div class="uyari-kutu kritik pn-gonderim-hatasi" role="alert"><${Ikon} ad="uyari" /><span>${gonderim.hata}</span></div>`}
      ${kapat && html`<button class="d hayalet" disabled=${gonderim.bekliyor} onClick=${kapat}>${c('Vazgeç', 'Cancel')}</button>`}
      <button class="d ana-d pn-gonder" disabled=${gonderim.bekliyor || devreDisi} onClick=${gonder}>
        ${tik && html`<${Ikon} ad="tik" />`}${gonderim.bekliyor ? c('Gönderiliyor…', 'Sending…') : etiket}
      </button>`;
  }

  function IzinFormu({ kapat }) {
    const d = depo();
    const [f, setF] = useState({ izinTur: 'yillik', bas: '', bit: '', aciklama: '', rapor: [] });
    const [denendi, setDenendi] = useState(false);
    const gonderim = useGonderim();
    const [fotoYukleniyor, setFotoYukleniyor] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const bit = f.bit || f.bas;
    const gun = P.gunSay(f.bas, bit, f.izinTur);
    const durum = P.izinDurumu(d, b.kullanici);
    const hata = { bas: !f.bas && c('Başlangıç tarihini seçin', 'Choose a start date'), bit: f.bit && f.bit < f.bas && c('Bitiş başlangıçtan önce olamaz', 'End cannot be before start'),
      gun: f.bas && !gun && c('Seçilen aralıkta iş günü yok', 'No working days in this range') };
    function gonder() {
      setDenendi(true);
      if (hata.bas || hata.bit || hata.gun || fotoYukleniyor) return;
      gonderim.calistir(() => talepYaz(d, 'izin', { izinTur: f.izinTur, bas: f.bas, bit, gun, aciklama: f.aciklama.trim(), rapor: f.rapor }), (no) => {
        kapat();
        K.ac(Gonderildi, { baslik: c('Talebiniz gönderildi', 'Request sent'), metin: gonderildiMetni(no,
          DEMO ? '{0} numaralı izin talebiniz yönetime iletildi.' : '{0} numaralı izin talebiniz yönetime iletildi. Onaylanınca burada ve Yoklama’da görünür.',
          DEMO ? 'Your leave request {0} has been sent.' : 'Your leave request {0} has been sent. Once approved it shows here and in Attendance.') });
      });
    }
    return html`<${Modal} baslik=${c('İzin talebi', 'Leave request')} kapat=${kapat} sinif="pn-form"
      alt=${html`<${GonderimAlt} gonderim=${gonderim} kapat=${kapat} gonder=${gonder} etiket=${c('Talebi gönder', 'Send request')} devreDisi=${fotoYukleniyor} />`}>
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
        ${f.izinTur === 'raporlu' && html`<div class="pn-gizli-ek"><${BelgeKutusu} foto kameraVeGaleri gizli talep kilitli=${gonderim.bekliyor} yuklemeDegis=${setFotoYukleniyor}
          baslik=${c('Rapor fotoğrafı', 'Sick note photo')} ekler=${f.rapor} degis=${s('rapor')} />
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
    const gonderim = useGonderim();
    const dolu = kalemler.filter((k) => k.ad.trim());
    const miktarGecerli = (k) => Number(k.adet) > 0 && Number.isFinite(Number(k.adet)) &&
      (['kg', 'm'].includes(k.birim) || Number.isSafeInteger(Number(k.adet)));
    const kalemDegis = (i, alan) => (e) => setKalemler((l) => l.map((k, j) => (j === i ? { ...k, [alan]: e.target.value } : k)));
    function gonder() {
      setDenendi(true);
      if (!dolu.length || !dolu.every(miktarGecerli)) return;
      gonderim.calistir(() => talepYaz(d, 'malzeme', { kalemler: dolu.map((k) => ({ ad: k.ad.trim(), adet: Number(k.adet), birim: k.birim, not: k.not.trim() })), acil }), (no) => {
        kapat();
        K.ac(Gonderildi, { baslik: c('İsteğiniz gönderildi', 'Request sent'), metin: gonderildiMetni(no, '{0} numaralı malzeme isteğiniz yönetime iletildi.', 'Your material request {0} has been sent.') });
      });
    }
    return html`<${Modal} baslik=${c('Malzeme isteği', 'Material request')} kapat=${kapat} sinif="pn-form"
      alt=${html`<${GonderimAlt} gonderim=${gonderim} kapat=${kapat} gonder=${gonder} etiket=${c('İsteği gönder', 'Send request')} />`}>
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
    const gonderim = useGonderim();
    const [fotoYukleniyor, setFotoYukleniyor] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const hata = { yer: !f.yer.trim() && c('Yeri seçin ya da yazın', 'Choose or type a location'), aciklama: f.aciklama.trim().length < 5 && c('Ne olduğunu kısaca yazın', 'Briefly describe the problem') };
    function gonder() {
      setDenendi(true);
      if (hata.yer || hata.aciklama || fotoYukleniyor) return;
      gonderim.calistir(() => talepYaz(d, 'ariza', { yer: f.yer.trim(), aciklama: f.aciklama.trim(), foto: f.foto, durdu: f.durdu }), (no) => {
        kapat();
        K.ac(Gonderildi, { baslik: c('Arıza bildirildi', 'Fault reported'), metin: cm('{0} numaralı bildiriminiz yönetime iletildi.', 'Your report {0} has been sent to management.', no) });
      });
    }
    return html`<${Modal} baslik=${c('Arıza bildir', 'Report a fault')} kapat=${kapat} sinif="pn-form"
      alt=${html`<${GonderimAlt} gonderim=${gonderim} kapat=${kapat} gonder=${gonder} etiket=${c('Bildir', 'Report')} devreDisi=${fotoYukleniyor} />`}>
      <div class="modal-ic pn-alanlar">
        <${BelgeKutusu} foto kameraVeGaleri talep kilitli=${gonderim.bekliyor} yuklemeDegis=${setFotoYukleniyor}
          baslik=${c('Fotoğraf', 'Photo')} ekler=${f.foto} degis=${s('foto')} />
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
    const gonderim = useGonderim();
    const [fotoYukleniyor, setFotoYukleniyor] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const kisa = f.metin.trim().length < 10;
    function gonder() {
      setDenendi(true);
      if (kisa || fotoYukleniyor) return;
      gonderim.calistir(async () => {
        const kod = P.takipKodu();
        const no = await yeniNumara(d, 'bildirim', 'BD');
        const v = { no, tur: f.tur, isimsiz: f.isimsiz, sahip: f.isimsiz ? '' : b.kullanici,
          takipKodu: kod, tarih: bugun(), metin: f.metin.trim(), yer: f.yer.trim(), foto: f.foto, durum: 'yeni' };
        // Canlıda isimsiz bildirim sunucu işleviyle yazılır: tabloda gönderenin adı ve cihazı hiç bulunmaz.
        if (f.isimsiz && !DEMO) {
          await d.rpc('isimsiz_bildirim', { olay: { id: uid(12), c: 'bildirim', k: uid(), v } });
          await isimsizleriGetir(d, [kod]);
        } else {
          await d.numuneIslem(() => [{ c: 'bildirim', k: uid(), u: f.isimsiz ? 'İsimsiz' : b.kullanici, v }]);
        }
        return kod;
      }, (kod) => {
        if (f.isimsiz) {
          try { localStorage.setItem(anonimAnahtar(), JSON.stringify([...anonimKodlar(), kod])); } catch { /* Takip kodu aşağıda gösterilir. */ }
        }
        kapat();
        K.ac(Gonderildi, { baslik: c('Teşekkürler', 'Thank you'), kod: f.isimsiz ? kod : '',
          metin: f.isimsiz ? c('Bildiriminiz yönetime isimsiz iletildi. Bildirimler sekmesinden takip edebilirsiniz.', 'Management received your report anonymously. Follow it in the Reports tab.')
            : c('Bildiriminiz yönetime iletildi. Cevabı “Bildirimlerim” sayfasında görürsünüz.', 'Your report was sent. You will see the reply under “My reports”.') });
      });
    }
    return html`<${Modal} baslik=${ramak ? c('Ramak kala / tehlikeli durum', 'Near miss / hazard') : c('Öneri / şikâyet', 'Suggestion / complaint')} kapat=${kapat} sinif=${'pn-form' + (ramak ? ' pn-ramak-form' : '')}
      alt=${html`<${GonderimAlt} gonderim=${gonderim} kapat=${kapat} gonder=${gonder} etiket=${c('Gönder', 'Send')} devreDisi=${fotoYukleniyor} />`}>
      <div class="modal-ic pn-alanlar">
        ${ramak ? html`<p class="pn-aciklama">${c('Bir kaza az kalsın oluyorsa ya da tehlikeli bir durum görürseniz yazın. Amaç suçlu bulmak değil, kazayı olmadan önlemek.', 'If an accident almost happened or you see a hazard, report it. The aim is not to blame anyone but to prevent the accident.')}</p>`
          : html`<${Secenekler} liste=${P.BILDIRIM_TURLERI.filter((x) => x.id !== 'ramak')} deger=${f.tur} degis=${s('tur')} />`}
        <${Alan} etiket=${ramak ? c('Ne gördünüz / ne oldu?', 'What did you see / what happened?') : c('Mesajınız', 'Your message')} hata=${denendi && kisa && c('Biraz daha ayrıntı yazın', 'Please add a bit more detail')}>
          <textarea class="girdi" rows="4" value=${f.metin} onInput=${(e) => s('metin')(e.target.value)} /><//>
        ${ramak && html`<${Alan} etiket=${c('Nerede?', 'Where?')}><input class="girdi" value=${f.yer} onInput=${(e) => s('yer')(e.target.value)} placeholder=${c('Örn: Depo girişi', 'e.g. Warehouse entrance')} /><//>`}
        ${ramak && html`<${BelgeKutusu} foto kameraVeGaleri kilitli=${gonderim.bekliyor} yuklemeDegis=${setFotoYukleniyor}
          baslik=${c('Fotoğraf (isteğe bağlı)', 'Photo (optional)')} ekler=${f.foto} degis=${s('foto')} />`}
        <div class=${'pn-isimsiz' + (f.isimsiz ? ' acik' : '')}><${Anahtar} deger=${f.isimsiz} degis=${s('isimsiz')}><b>${c('İsimsiz gönder', 'Send anonymously')}</b>
          <small>${c('Yönetim adınızı görmez.', 'Management will not see your name.')}</small><//></div>
      </div><//>`;
  }

  function StokBildirimi({ kapat }) {
    const [stokTur, setStokTur] = useState(P.STOK_TURLERI[0].id);
    const [aciklama, setAciklama] = useState('');
    const gonderim = useGonderim();
    function gonder() {
      if (!aciklama.trim()) return;
      gonderim.calistir(() => talepYaz(depo(), 'numune', { stokTur, aciklama: aciklama.trim() }), () => {
        kapat();
        K.ac(Gonderildi, { baslik: c('Bildirim gönderildi', 'Report sent'), metin: c('Stok bildiriminiz yönetime iletildi.', 'Your stock report has been sent to management.') });
      });
    }
    return html`<${Modal} dar sinif="pn-form" baslik=${c('Numune stok bildirimi', 'Sample stock report')} kapat=${kapat}
      alt=${html`<${GonderimAlt} gonderim=${gonderim} gonder=${gonder} etiket=${c('Bildirimi gönder', 'Send report')} devreDisi=${!aciklama.trim()} tik=${false} />`}>
      <div class="modal-ic pn-alanlar">
        <${Secenekler} liste=${P.STOK_TURLERI} deger=${stokTur} degis=${setStokTur} />
        <${Alan} etiket=${c('Açıklama', 'Description')}><textarea class="girdi" rows="3" aria-label=${c('Açıklama', 'Description')} value=${aciklama} onInput=${(e) => setAciklama(e.target.value)} /><//>
      </div><//>`;
  }

  /* Yönetim › Taleplerim (sekreter onayı, 2026-11-17): yönetim kadrosu kendi taleplerini yönetim panelinden verir, kararı onay yetkilisi
     (Farukcan Bey) verir. Onay yetkilisinin kendi talebi onaya düşmez, doğrudan kayıt olarak işlenir; kimse kendi talebine karar veremez.
     Canlıda onay yetkisi hesaptan (app_metadata.onay) gelir; sunumda ad kuralı. */
  /* Talep/bildirim numarası: canlıda sunucudan (personel yalnız kendi kayıtlarını görür, yerelde sayarsa numaralar çakışır). */
  async function yeniNumara(d, koleksiyon, onEk) {
    if (DEMO || !d.rpc) return K.yeniNo(d, koleksiyon, onEk);
    try { return (await d.rpc('personel_no', { onek: onEk })) || K.yeniNo(d, koleksiyon, onEk); } catch { return K.yeniNo(d, koleksiyon, onEk); }
  }
  /* İsimsiz bildirimler canlıda kimseye ait değildir; kişi takip koduyla sunucudan ister, gelen olaylar yerel kopyaya eklenir. */
  async function isimsizleriGetir(d, kodlar) {
    if (DEMO || !d.rpc || !kodlar.length) return;
    let yeni = false;
    for (const kod of [...new Set(kodlar)]) {
      try {
        for (const { sira, ...e } of (await d.rpc('isimsiz_sorgula', { kod })) || []) {
          void sira;
          if (e.u === null) delete e.u;
          if (e.v === null) delete e.v;
          if (d.ekle(e)) yeni = true;
        }
      } catch (err) { console.warn('isimsiz bildirim sorgusu', err); }
    }
    if (yeni) { d.yenidenHesapla(); d.bildir({}); }
  }
  const onayYetkilisi = () => (b.hesap ? !!b.hesap.onay : yonetici());
  const kendiKaydi = () => YONETIM && onayYetkilisi();
  async function talepYaz(d, tur, ayrinti) {
    const dogrudan = kendiKaydi();
    const no = await yeniNumara(d, 'talep', 'TL');
    const [olay] = await d.numuneIslem(() => [{ c: 'talep', k: uid(), v: {
      no, tur, sahip: b.kullanici, tarih: bugun(), durum: dogrudan ? 'onaylandi' : 'bekliyor', ...ayrinti,
      ...(dogrudan ? { karar: { kim: b.kullanici, tarih: bugun(), not: c('Onay yetkilisinin kendi talebi; doğrudan kayıt', 'Approver’s own request; recorded directly') } } : {}),
    } }]);
    return olay.v.no;
  }
  const gonderildiMetni = (no, tr, en) => (kendiKaydi() ? cm('{0} numaralı talebiniz doğrudan kayda işlendi.', 'Your request {0} has been recorded.', no) : cm(tr, en, no));

  function izinKayitHatasi(e) {
    const detay = e.detay || '';
    if (detay.includes('PZ001')) return c('Yoklama’da bu hesap için tek bir etkin kişi kaydı bulunamadı. Kişi kaydını kontrol edin.', 'Attendance has no unique active person matching this account. Check the person record.');
    if (detay.includes('PZ002')) return c('Talep değişti veya daha önce karara bağlandı. Listeyi yenileyip kontrol edin.', 'The request changed or was already decided. Refresh the list and check again.');
    if (detay.includes('PZ003')) return c('İzin türü veya tarihleri geçersiz.', 'The leave type or dates are invalid.');
    if (detay.includes('PZ004')) return c('Bu tarihlerde çakışan bir Yoklama kaydı var. Onaylamadan önce o kaydı kontrol edin.', 'An attendance entry overlaps these dates. Check it before approving.');
    return cm('İzin talebi kaydedilemedi. {0}', 'The leave request could not be saved. {0}', e.message);
  }

  /* ---------------- Talep ve bildirim ayrıntısı (iki görünümde ortak) ---------------- */
  function TalepDetay({ talep: ilk, kapat }) {
    const d = depo();
    const t = d.kayit('talep', ilk.id) || ilk;
    useYonetimGoruldu('talep', t);
    const tur = P.talepTuru(t.tur);
    const yonetimde = YONETIM;
    const ozet = [[c('Numara', 'No'), t.no], [c('Tarih', 'Date'), tarihYaz(t.tarih)], yonetimde && [c('Kişi', 'Person'), t.sahip]].filter(Boolean);
    const alanlar = t.tur === 'izin' ? [[c('İzin türü', 'Leave type'), adi(P.izinTuru(t.izinTur))], [c('Tarihler', 'Dates'), t.bas === t.bit ? tarihYaz(t.bas) : `${tarihYaz(t.bas)} – ${tarihYaz(t.bit)}`], [c('Gün', 'Days'), t.gun], [c('Açıklama', 'Note'), t.aciklama]]
      : t.tur === 'malzeme' ? [[c('Malzemeler', 'Items'), html`<${MalzemeKalemleri} t=${t} />`, true], [c('Neden', 'Reason'), t.neden], [c('Acil', 'Urgent'), t.acil ? c('Evet', 'Yes') : '']]
      : t.tur === 'numune' ? [[c('Stok durumu', 'Stock status'), adi(P.stokTuru(t.stokTur))], [c('Açıklama', 'Description'), t.aciklama, true]]
        : [[c('Yer', 'Location'), t.yer], [c('Açıklama', 'Description'), t.aciklama], [c('Makine durdu', 'Machine stopped'), t.durdu ? c('Evet', 'Yes') : '']];
    const izinDurum = yonetimde && t.tur === 'izin' && t.izinTur === 'yillik' ? P.izinDurumu(d, t.sahip) : null;
    return html`<${NT.ui.KayitDetay} baslik=${adi(tur)} durum=${html`<${Rozet} durum=${t.durum} /><${GorulduRozeti} koleksiyon="talep" kayit=${t} />`} ozet=${ozet} kapat=${kapat}>
      <${NT.ui.DetayBolumu} baslik=${c('Ayrıntı', 'Details')} ikon=${tur.ikon} alanlar=${alanlar} belgeler=${[[c('Fotoğraf', 'Photo'), t.foto], yonetimde && [c('Rapor', 'Sick note'), t.rapor]].filter(Boolean)} />
      ${izinDurum && html`<div class="uyari-kutu bilgi"><${Ikon} ad="takvim" /><span>${cm('{0}: bu izin yılı hakkı {1} gün, kullanılan {2}, kalan {3}.', '{0}: entitlement {1} days this leave year, used {2}, left {3}.', t.sahip, izinDurum.hak, izinDurum.kullanilan, izinDurum.kalan)}</span></div>`}
      ${t.karar && html`<${NT.ui.DetayBolumu} baslik=${c('Karar', 'Decision')} ikon="daire_tik" alanlar=${[[c('Karar veren', 'Decided by'), t.karar.kim], [c('Tarih', 'Date'), tarihYaz(t.karar.tarih)], [c('Not', 'Note'), t.karar.not, true]]} />`}
      ${yonetimde && t.durum === 'bekliyor' && html`<${KararDugmeleri} talep=${t} sonra=${kapat} />`}
    <//>`;
  }

  async function karar(t, durum, not = '') {
    const d = depo();
    let olaylar;
    try {
      olaylar = await d.numuneIslem((guncel) => {
        const kayit = guncel.kayit('talep', t.id);
        if (!onayYetkilisi() || kayit?.sahip === b.kullanici || kayit?._silindi || kayit?.durum !== 'bekliyor') return [];
        return [{ c: 'talep', k: t.id, v: { durum, karar: { kim: b.kullanici, tarih: bugun(), not } } }];
      });
    } catch (e) {
      bildir(t.tur === 'izin' ? izinKayitHatasi(e) : e.message, { tur: 'hata' });
      return false;
    }
    if (!olaylar.length) return false;
    if (durum === 'onaylandi' && t.tur === 'izin' && !DEMO) bildir(cm('{0} onaylandı ve Yoklama’ya işlendi.', '{0} was approved and recorded in Attendance.', t.no));
    else bildir(cm('{0}: {1}.', '{0}: {1}.', t.no, adi(P.TALEP_DURUM[durum])));
    return true;
  }
  function RedFormu({ talep, kapat, sonra }) {
    const [not, setNot] = useState('');
    const gonder = async () => { if (not.trim() && await karar(talep, 'reddedildi', not.trim())) { kapat(); sonra && sonra(); } };
    return html`<${Modal} dar baslik=${cm('{0} reddedilsin mi?', 'Decline {0}?', talep.no)} kapat=${kapat}
      alt=${html`<button class="d hayalet" onClick=${kapat}>${c('Vazgeç', 'Cancel')}</button><button class="d tehlike" disabled=${!not.trim()} onClick=${gonder}>${c('Reddet', 'Decline')}</button>`}>
      <div class="modal-ic"><${Alan} etiket=${c('Nedeni (personel görür)', 'Reason (staff will see it)')}><textarea class="girdi" rows="3" value=${not} onInput=${(e) => setNot(e.target.value)} autofocus /><//></div><//>`;
  }
  function KararDugmeleri({ talep, sonra, kompakt }) {
    if (!onayYetkilisi()) return html`<span class="soluk kucuk pn-yalniz">${c('Onayı yalnız Yönetici verir', 'Only managers approve')}</span>`;
    if (talep.sahip === b.kullanici) return html`<span class="soluk kucuk pn-yalniz">${c('Kendi talebinize karar veremezsiniz', 'You cannot decide on your own request')}</span>`;
    return html`<div class=${'pn-karar' + (kompakt ? ' kompakt' : '')}>
      <button class="d ana-d kucuk-d" onClick=${async (e) => { e.stopPropagation(); if (await karar(talep, talep.tur === 'ariza' ? 'tamamlandi' : 'onaylandi')) sonra?.(); }}><${Ikon} ad="tik" boyut=${15} />${talep.tur === 'ariza' ? c('Giderildi', 'Fixed') : c('Onayla', 'Approve')}</button>
      <button class="d kucuk-d" onClick=${(e) => { e.stopPropagation(); K.ac(RedFormu, { talep, sonra }); }}>${c('Reddet', 'Decline')}</button></div>`;
  }

  function BildirimDetay({ bildirim: ilk, kapat }) {
    const d = depo();
    const x = d.kayit('bildirim', ilk.id) || ilk;
    useYonetimGoruldu('bildirim', x);
    const [cevap, setCevap] = useState(x.cevap || '');
    const tur = P.bildirimTuru(x.tur);
    const guncelle = async (durum) => {
      await d.kaydet([{ c: 'bildirim', k: x.id, v: { durum, cevap: cevap.trim() } }]);
      bildir(cm('{0}: {1}.', '{0}: {1}.', x.no, adi(P.BILDIRIM_DURUM[durum])));
      if (durum !== 'okundu') kapat();
    };
    const ozet = [[c('Numara', 'No'), x.no], [c('Tarih', 'Date'), tarihYaz(x.tarih)], [c('Gönderen', 'From'), x.isimsiz ? html`<span class="rozet mor"><${Ikon} ad="goz" />${c('İsimsiz', 'Anonymous')}</span>` : x.sahip]];
    return html`<${NT.ui.KayitDetay} baslik=${adi(tur)} durum=${html`<${Rozet} durum=${x.durum} tablo=${P.BILDIRIM_DURUM} /><${GorulduRozeti} koleksiyon="bildirim" kayit=${x} />`} ozet=${ozet} kapat=${kapat}>
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
    /* Sıra: her gün kullanılanlar önde (sekreter değerlendirmesi, 2026-11-13). */
    { id: 'numune', ad: 'Numune Takip', en: 'Sample Tracking', alt: 'Stok, sayım, şişe girişi, dolum', altEn: 'Stock, stocktake, bottle intake, filling', ikon: 'dolum',
      not: ['Sayım değişiklikleri yönetim stokuna da yansır.', 'Stocktake changes also appear in management’s stock view.'],
      ac: () => { location.href = NT.c.adres('numune', { kullanici: b.kullanici }) + '&gorunum=personel'; } },
    { id: 'dolumEmirleri', ad: 'Dolum iş emirleri', en: 'Filling orders', alt: 'Açık dolum emirleri ve ambalaj dolumu', altEn: 'Open filling orders and container filling', ikon: 'dolum',
      ac: () => { location.href = NT.c.adres('uretimstok', { kullanici:b.kullanici }) + '#/emirler'; } },
    { id: 'yemek', ad: 'Yemek menüsü', en: 'Meal menu', alt: 'Menü, ek Desbaş yemeği ve kafe siparişi', altEn: 'Menu, extra Desbaş meals and café orders', ikon: 'yemek',
      ac: () => { location.href = NT.c.adres('yemek', { kullanici: b.kullanici }) + '&gorunum=personel'; } },
    /* Yönetim › Yoklama ile aynı kayıt ve kurallar; kişi yalnız kendi yoklamasını görür ve girer (sekreter kararı, 2026-11-17). */
    { id: 'yoklama', ad: 'Yoklama', en: 'Attendance', alt: 'İzin, rapor ve fazla mesai kayıtlarım', altEn: 'My leave, sick leave and overtime records', ikon: 'takvim',
      ac: () => { location.href = NT.c.adres('yoklama', { kullanici: b.kullanici }) + '&gorunum=personel'; } },
    { id: 'malzeme', ad: 'Malzeme isteği', en: 'Material request', alt: 'Eldiven, KKD, sarf', altEn: 'Gloves, PPE, supplies', ikon: 'kutu', ac: () => K.ac(MalzemeFormu) },
    { id: 'ariza', ad: 'Arıza bildir', en: 'Report a fault', alt: 'Fotoğrafla, yerinden', altEn: 'With a photo, on the spot', ikon: 'ayar', ac: () => K.ac(ArizaFormu) },
    { id: 'ramak', ad: 'Ramak kala', en: 'Near miss', alt: 'İsimsiz gönderilebilir', altEn: 'Can be anonymous', ikon: 'uyari', ac: () => K.ac(BildirimFormu, { ramak: true }) },
    { id: 'izin', ad: 'İzin talebi', en: 'Leave request', alt: 'Yıllık, mazeret, rapor', altEn: 'Annual, excused, sick', ikon: 'takvim', ac: () => K.ac(IzinFormu) },
    { id: 'oneri', ad: 'Öneri / şikâyet', en: 'Suggestion / complaint', alt: 'İsimsiz gönderilebilir', altEn: 'Can be anonymous', ikon: 'bilgi', ac: () => K.ac(BildirimFormu, {}) },
  ];

  function TalepSatiri({ t }) {
    return html`<li class="pn-satir" onClick=${() => K.ac(TalepDetay, { talep: t })}>
      <${TurSimge} tur=${t.tur} /><span class="ne"><b>${adi(P.talepTuru(t.tur), 'kisa')} · ${P.talepOzet(t)}</b><small>${t.no} · ${onceYaz(t._olusturma)}${t.karar && t.karar.not ? ' · ' + t.karar.not : ''}</small></span>
      <span class="pn-kayit-rozetleri"><${Rozet} durum=${t.durum} /><${GorulduRozeti} koleksiyon="talep" kayit=${t} /></span></li>`;
  }

  /* Başka modülün kaydı (salt okunur): sunumda bu tarayıcıdaki paylaşılan örnek depo, canlıda bulut deposu (30 sn'de bir taranır).
     Canlıda sunucu yalnız kişinin görebileceğini verir (Yemek: menü; Numune: ortak kayıt). */
  function canliDepoAc(modul) {
    return (async () => {
      const nd = b.depoOlustur(modul, b.kod, b.kullanici);
      const k = await nd.onbellek.al().catch(() => null);
      if (k && k.olaylar) { for (const e of k.olaylar) nd.ekle(e); nd.sonSira = k.sonSira || 0; nd.yenidenHesapla(); }
      nd.cevrimici = true;
      await nd.tara().catch(() => {});
      return nd;
    })();
  }
  function sunumDepoAc(modul) {
    if (modul === 'uretimstok') return NT.stokAkisi.depoAc();
    if (modul === 'yemek') return NT.yemekDemo.depoAc(b.kullanici);
    // Numune hiç açılmadıysa kayıt yoktur; örnek veri burada kurulmaz.
    return NT.idb.al('nt.sunum.v1.' + modul).then((olaylar) => { const nd = new NT.SunumDepo(modul, b.kullanici); if (olaylar) nd.uygula(olaylar); return nd; });
  }
  function useModulDeposu(modul, etkin = true) {
    const [depo, setDepo] = useState(null);
    const [, yenile] = useState(0);
    useEffect(() => {
      if (!etkin || (DEMO && (!NT.SunumDepo || !NT.idb))) return undefined;
      let aktif = true;
      let kapat;
      (DEMO ? sunumDepoAc(modul) : canliDepoAc(modul)).then((d) => {
        if (!aktif) { d.kapat?.(); return; }
        const guncelle = () => yenile((n) => n + 1);
        const birak = d.abone(guncelle);
        const zaman = setInterval(() => (DEMO ? guncelle() : d.tara().catch(() => {})), DEMO ? 60000 : 30000);
        kapat = () => { clearInterval(zaman); birak(); d.kapat?.(); };
        setDepo(d);
      }).catch(console.error);
      return () => { aktif = false; kapat?.(); };
    }, [modul, etkin]);
    return etkin ? depo : null;
  }

  const modulDurumu = (d) => !d ? c('Yükleniyor…', 'Loading…') : d.hata ? c('Güncel bilgi alınamadı', 'Could not load the latest information') : '';

  function YemekKartiNotu() {
    const depo = useModulDeposu('yemek');
    const bugunTarihi = bugun();
    const yemekler = depo ? NT.yemek.yemekler(depo, bugunTarihi, 'ogle').slice(0, 3) : [];
    const resimde = depo && NT.yemek.menu(depo, bugunTarihi.slice(0, 7), 'ogle')?.ek;
    return html`<span class="pn-kart-not pn-kart-menu"><${Ikon} ad="yemek" boyut=${14} /><span>
      <strong>${c('Bugün öğle', 'Lunch today')}</strong>
      <span>${modulDurumu(depo) || (yemekler.length ? yemekler.join(' · ') : resimde ? c('Menüyü açıp görseli inceleyin.', 'Open the menu to see the image.') : c('Menü bilgisi yok', 'No menu listed'))}</span>
    </span></span>`;
  }

  function YoklamaKartiNotu() {
    const d = useModulDeposu('yoklama');
    const durum = modulDurumu(d);
    if (durum) return durum;
    const Y = NT.yoklama;
    const benim = (k) => NT.c.kucuk(k.ad) === NT.c.kucuk(b.kullanici);
    const kisi = Y.kisiler(d, { hepsi: true }).find(benim);
    const ay = bugun().slice(0, 7);
    const ozet = Y.ayOzet(d, ay).find((x) => x.kisi.id === kisi?.id);
    if (!ozet) return c('Bu ay için yoklama kaydı yok', 'No attendance record for this month');
    const saat = (ozet.mesaiSaat + ozet.tatilSaat).toLocaleString(NT.dil.yerel(), { maximumFractionDigits: 2 });
    const sonGun = Y.ayGunleri(ay).at(-1);
    const sayi = Y.istisnalar(d).filter((x) => x.kisi === kisi.id && x.bas <= sonGun && (x.bit || x.bas) >= `${ay}-01`).length;
    return html`<span>${cm('Bu ay toplam mesai: {0} saat', 'Total overtime this month: {0} hours', saat)}</span>
      <small class="pn-kart-not">${sayi ? cm('Bu ay {0} yoklama kaydın var', '{0} attendance entries this month', sayi) : c('Bu aya ait ek kayıt yok', 'No additional entries this month')}</small>`;
  }

  /* Ortak Numune kaydındaki açık iş emirleri (salt okunur). Kayıt yoksa (Numune hiç açılmadıysa) boş döner; örnek veri burada kurulmaz. */
  function dolumEmirleri(nd) {
    if (!nd) return [];
    // 2026-11-16: bir iş emri birden çok satırdır (grup) ve hazırlama işi de içerebilir; emir sayısı grup başına sayılır.
    return [...new Set(nd.kayitlar('isemri').filter((e) => e.durum === 'bekliyor' || (e.durum === 'ustlenildi' && e.ustlenen === b.kullanici))
      .map((e) => e.grup || e.id))];
  }

  const duyuruYazi = (v) => (Array.isArray(v) ? c(...v) : v || '');
  function DuyuruListesi({ liste, kapat }) {
    return html`<${Modal} dar baslik=${c('Yeni duyurular', 'New notices')} kapat=${kapat}>
      <div class="modal-ic pn-bildirim-kartlar">${liste.map((x) => html`<button type="button" key=${x.id} class="pn-bildirim-karti" onClick=${() => { kapat(); gorulduYaz('duyuru:' + x.id); K.ac(DuyuruDetay, { duyuru: x }); }}>
        <span class="pn-simge" aria-hidden="true"><${Ikon} ad="bilgi" boyut=${18} /></span><span><b>${duyuruYazi(x.baslik)}</b><span>${duyuruYazi(x.ozet)}</span><small>${tarihYaz(x.tarih)}</small></span></button>`)}</div><//>`;
  }
  function DuyuruDetay({ duyuru: x, kapat }) {
    const [resim, setResim] = useState('');
    useEffect(() => {
      let adres = '';
      if (x.gorsel?.dosya) depo().ekOku(x.gorsel.dosya).then((f) => { if (f) { adres = URL.createObjectURL(f); setResim(adres); } }).catch(() => {});
      return () => adres && URL.revokeObjectURL(adres);
    }, []);
    const yazi = duyuruYazi;
    return html`<${Modal} baslik=${yazi(x.baslik)} kapat=${kapat} alt=${html`<button class="d ana-d" onClick=${kapat}>${c('Tamam', 'OK')}</button>`}>
      <div class="modal-ic pn-duyuru-detay"><small class="soluk">${tarihYaz(x.tarih)}</small><p>${yazi(x.metin) || yazi(x.ozet)}</p>${resim && html`<img src=${resim} alt=${x.gorsel.ad || ''} />`}</div><//>`;
  }

  /* Bantın dikkat alanı (yönetim karşılamasındaki "Dikkat bekleyen" ile aynı görünüm): personeli bekleyen işler ve yeni haberler. */
  function PersonelDikkat({ emirler }) {
    const d = depo();
    const [, yenile] = useState(0);
    useEffect(() => { const f = () => yenile((n) => n + 1); window.addEventListener('pn-goruldu', f); return () => window.removeEventListener('pn-goruldu', f); }, []);
    const g = gorulduler();
    const bg = bugun();
    const sinir = P.gunEkle(bg, -14);
    const ac = (anahtar, B, props) => () => { gorulduYaz(anahtar); K.ac(B, props); };
    const isler = [];
    if (emirler.length) isler.push({ id: 'emir', ikon: 'dolum', sinif: 'is', metin: cm('{0} iş emri seni bekliyor', '{0} work order(s) waiting for you', emirler.length),
      fn: () => { location.href = NT.c.adres('numune', { kullanici: b.kullanici }) + '&gorunum=personel#/isemirleri'; } });
    for (const t of P.benimTaleplerim(d, b.kullanici)) {
      if (t.durum === 'bekliyor' || !t.karar || (t.karar.tarih || '') < sinir) continue;
      const anahtar = `talep:${t.id}:${t.durum}`;
      if (!g.has(anahtar)) isler.push({ id: anahtar, ikon: P.TALEP_DURUM[t.durum].ikon, sinif: t.durum === 'reddedildi' ? 'red' : 'iyi',
        metin: `${adi(P.talepTuru(t.tur))} · ${adi(P.TALEP_DURUM[t.durum]).toLocaleLowerCase(NT.dil.yerel())}`, fn: ac(anahtar, TalepDetay, { talep: t }) });
    }
    for (const x of benimBildirimlerim(d)) {
      if (x.durum === 'yeni' || (!x.cevap && x.durum === 'okundu')) continue;
      const anahtar = `bildirim:${x.id}:${x.durum}`;
      if (!g.has(anahtar)) isler.push({ id: anahtar, ikon: 'bilgi', sinif: 'iyi',
        metin: cm('{0} bildirimine cevap geldi', 'Reply to your {0} report', adi(P.bildirimTuru(x.tur), 'kisa').toLocaleLowerCase(NT.dil.yerel())), fn: ac(anahtar, BildirimDetay, { bildirim: x }) });
    }
    const duyurular = [...d.kayitlar('duyuru'), ...(b.mod === 'demo' ? NT.personelDemo.ORNEK_DUYURULAR : [])]
      .filter((x) => (x.tarih || '') >= sinir && !g.has('duyuru:' + x.id)).sort((a, x) => ((x.tarih || '') > (a.tarih || '') ? 1 : -1));
    if (duyurular.length === 1) isler.push({ id: 'duyuru', ikon: 'bilgi', sinif: 'duyuru', metin: cm('Duyuru: {0}', 'Notice: {0}', duyuruYazi(duyurular[0].baslik)), fn: ac('duyuru:' + duyurular[0].id, DuyuruDetay, { duyuru: duyurular[0] }) });
    else if (duyurular.length) isler.push({ id: 'duyuru', ikon: 'bilgi', sinif: 'duyuru', metin: cm('{0} yeni duyuru', '{0} new notices', duyurular.length), fn: () => K.ac(DuyuruListesi, { liste: duyurular }) });
    const yakin = P.benimTaleplerim(d, b.kullanici).find((t) => t.tur === 'izin' && t.durum === 'onaylandi' && t.bas >= bg && t.bas <= P.gunEkle(bg, 7));
    if (yakin) isler.push({ id: 'izin', ikon: 'takvim', sinif: 'bilgi', metin: cm('{0} {1} tarihinde başlıyor', 'Your {0} starts on {1}', adi(P.izinTuru(yakin.izinTur)), tarihYaz(yakin.bas)), fn: () => K.ac(TalepDetay, { talep: yakin }) });
    return html`<div class="pn-dikkat" role="status">
      ${isler.length ? html`<span class="pn-dikkat-bas"><${Ikon} ad="uyari" boyut=${15} />${c('Seni bekleyen', 'Waiting for you')} ${isler.length}</span>
        ${isler.map((x, i) => html`<button type="button" key=${x.id} class="pn-dikkat-cip" style=${{ '--i': i }} onClick=${x.fn}>
          <span class=${'pn-dikkat-ikon ' + x.sinif}><${Ikon} ad=${x.ikon} boyut=${14} /></span>${x.metin}<${Ikon} ad="ok" boyut=${14} /></button>`)}`
      : html`<span class="pn-dikkat-bas tamam"><${Ikon} ad="tik" boyut=${15} />${c('Her şey yolunda · seni bekleyen bir iş yok', 'All good · nothing is waiting for you')}</span>`}
    </div>`;
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

  function kartKayitOzeti(d, koleksiyon, kayit, durumlar, bos) {
    if (!kayit) return bos;
    const durum = adi(durumlar[kayit.durum] || Object.values(durumlar)[0]);
    const goruldu = kayit.durum !== 'okundu' && d.kayit(`${koleksiyon}_goruldu`, kayit.id);
    return [kayit.no, durum, goruldu && c('Görüldü', 'Seen')].filter(Boolean).join(' · ');
  }

  function AnaSayfa({ numune, emirler }) {
    const d = depo();
    const benim = P.benimTaleplerim(d, b.kullanici);
    const bildirimler = benimBildirimlerim(d);
    const acik = benim.filter((t) => t.durum === 'bekliyor').length;
    const izin = P.izinDurumu(d, b.kullanici);
    const talepOzeti = (tur) => kartKayitOzeti(d, 'talep', benim.find((x) => x.tur === tur), P.TALEP_DURUM, c('Henüz talep yok', 'No requests yet'));
    const bildirimOzeti = (kayit) => kartKayitOzeti(d, 'bildirim', kayit, P.BILDIRIM_DURUM, c('Henüz bildirim yok', 'No reports yet'));
    const stokDeposu = useModulDeposu('uretimstok');
    const dolumSayisi = stokDeposu ? NT.stokAkisi.emirler(stokDeposu).length : 0;
    const kartOzetleri = {
      dolumEmirleri: modulDurumu(stokDeposu) || (dolumSayisi ? cm('{0} açık iş emri', '{0} open work order(s)', dolumSayisi) : c('Açık dolum emri yok')),
      numune: modulDurumu(numune) || (emirler.length ? cm('{0} açık iş emri', '{0} open work order(s)', emirler.length) : c('Açık iş emri yok', 'No open work orders')),
      yemek: html`<${YemekKartiNotu} />`,
      yoklama: html`<${YoklamaKartiNotu} />`,
      izin: talepOzeti('izin'),
      malzeme: talepOzeti('malzeme'),
      ariza: talepOzeti('ariza'),
      ramak: bildirimOzeti(bildirimler.find((x) => x.tur === 'ramak')),
      oneri: bildirimOzeti(bildirimler.find((x) => x.tur === 'oneri' || x.tur === 'sikayet')),
    };
    return html`
      <div class="pn-serit">
        <a href="#/profil" style=${{ '--i': 0 }}><small>${c('Kalan yıllık izin (test)', 'Annual leave left (test)')}</small><b>${izin ? cm('{0} gün', '{0} days', izin.kalan) : '—'}</b></a>
        <a href="#/taleplerim" style=${{ '--i': 1 }}><small>${c('Açık taleplerim', 'Open requests')}</small><b>${acik}</b></a>
      </div>
      <div class="pn-ana-izgara">
      <div class="pn-kartlar">${KARTLAR.map((k, i) => html`<button key=${k.id} style=${{ '--i': i + 2 }} class=${'pn-kart pn-k-' + k.id + (k.not || k.id === 'yemek' ? ' pn-kart-notlu' : '')} onClick=${k.ac}>
        <span class="pn-kart-gorsel" aria-hidden="true"><${Ikon} ad=${k.ikon} boyut=${30} /></span>
        <span class="pn-kart-metin"><b>${c(k.ad, k.en)}</b><small>${c(k.alt, k.altEn)}</small></span>
        <span class="pn-kart-alt">
          <span class="pn-kart-ozet">${kartOzetleri[k.id]}${k.not && html`<small class="pn-kart-not">${c(...k.not)}</small>`}</span>
          <span class="pn-kart-ac" aria-hidden="true">${c('Aç', 'Open')} <${Ikon} ad="ok" boyut=${16} /></span>
        </span></button>`)}</div>
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
    const benim = benimBildirimlerim(d);
    const temiz = kod.trim().toUpperCase().replace(/\s/g, '');
    useEffect(() => {
      if (DEMO || temiz.length < 6) return undefined;
      const z = setTimeout(() => isimsizleriGetir(d, [temiz]), 400);
      return () => clearTimeout(z);
    }, [temiz]);
    const bulunan = temiz.length >= 6 ? P.bildirimler(d).find((x) => x.isimsiz && x.takipKodu.replace('-', '') === temiz.replace('-', '')) : null;
    return html`<div class="pn-sayfa-bas"><h1>${c('Bildirdiklerim', 'My reports')}</h1></div>
      <div class="pn-yeni-bildirim"><button type="button" class="d ana-d" onClick=${() => K.ac(BildirimFormu, { ramak: true })}><${Ikon} ad="uyari" boyut=${16} />${c('Ramak kala bildir', 'Report a near miss')}</button>
        <button type="button" class="d" onClick=${() => K.ac(BildirimFormu, {})}><${Ikon} ad="bilgi" boyut=${16} />${c('Öneri / şikâyet yaz', 'Write a suggestion / complaint')}</button></div>
      <div class="pn-bildirim-kartlar">${benim.length ? benim.map((x) => html`<button type="button" key=${x.id} class="pn-bildirim-karti" onClick=${() => K.ac(BildirimDetay, { bildirim: x })}>
        <${TurSimge} tur=${x.tur} bildirim /><span><b>${adi(P.bildirimTuru(x.tur), 'kisa')}</b><span>${x.metin}</span>
        ${x.cevap && html`<small>${x.cevap}</small>`}${x.isimsiz && html`<small>${c('İsimsiz', 'Anonymous')}</small>`}</span>
        <span class="pn-kayit-rozetleri"><${Rozet} durum=${x.durum} tablo=${P.BILDIRIM_DURUM} /><${GorulduRozeti} koleksiyon="bildirim" kayit=${x} /></span></button>`)
        : html`<p class="soluk">${c('Henüz bir şey bildirmediniz. Yukarıdaki düğmelerle ramak kala, öneri ya da şikâyet gönderebilirsiniz.', 'You have not reported anything yet. Use the buttons above to send a near miss, suggestion or complaint.')}</p>`}</div>
      <section class="pn-bolum pn-kod-sor"><h2>${c('İsimsiz bildirimimi sorgula', 'Check my anonymous report')}</h2>
        <input class="girdi mono" value=${kod} onInput=${(e) => setKod(e.target.value)} placeholder="ABC-123" autocomplete="off" spellcheck="false" />
        ${temiz.length >= 6 && (bulunan ? html`<div class="pn-sonuc" onClick=${() => K.ac(BildirimDetay, { bildirim: bulunan })}><${TurSimge} tur=${bulunan.tur} bildirim /><span><b>${adi(P.bildirimTuru(bulunan.tur), 'kisa')}</b><small>${bulunan.cevap || c('Henüz cevap yok', 'No reply yet')}</small></span><span class="pn-kayit-rozetleri"><${Rozet} durum=${bulunan.durum} tablo=${P.BILDIRIM_DURUM} /><${GorulduRozeti} koleksiyon="bildirim" kayit=${bulunan} /></span></div>`
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
        <div class="uyari-kutu bilgi pn-izin-test"><${Ikon} ad="bilgi" /><span>${IZIN_TEST()}</span></div>
        <p class="soluk kucuk">${cm('İzin yılı {0} – {1} · kıdem {2} yıl.', 'Leave year {0} – {1} · {2} years of service.', tarihYaz(izin.bas), tarihYaz(izin.bit), izin.kidem)}</p></section>`}
      <section class="pn-bolum"><h2>${c('Görünüm', 'Display')}</h2><div class="pn-ayar"><${NT.dil.DilSecimi} /><${K.TemaDugmesi} /></div></section>
      <section class="pn-bolum"><h2>${c('Gizlilik', 'Privacy')}</h2><p class="kucuk">${c('Talep ve bildirimlerinizi yalnız siz ve yönetim görürsünüz. İsimsiz bildirimlerde adınız hiçbir yerde tutulmaz; takip kodunu saklayın. Sağlık raporu görsellerini yalnız yönetim görür.', 'Only you and management see your requests and reports. Anonymous reports never store your name; keep the tracking code. Only management sees sick-note images.')}</p></section>
      ${!DEMO && html`<section class="pn-bolum"><h2>${c('Hesap', 'Account')}</h2><button class="d" onClick=${async () => { if (await NT.ui.onayla(c('Bu cihazdaki oturum kapatılsın mı?', 'Sign out on this device?'), { evet: c('Çıkış yap', 'Sign out') })) b.ayril(); }}><${Ikon} ad="kapat" boyut=${15} />${c('Çıkış yap', 'Sign out')}</button></section>`}`;
  }

  const SEKMELER = [
    { id: 'ana', ad: 'Ana sayfa', en: 'Home', ikon: 'ev', Sayfa: AnaSayfa },
    { id: 'taleplerim', ad: 'Taleplerim', en: 'Requests', ikon: 'liste', Sayfa: Taleplerim },
    { id: 'bildirimlerim', ad: 'Bildirdiklerim', en: 'My reports', ikon: 'uyari', Sayfa: Bildirimlerim },
    { id: 'profil', ad: 'Profil', en: 'Profile', ikon: 'kisi', Sayfa: Profil },
  ];
  const sekmeAl = () => { const s = (location.hash.match(/^#\/(\w+)/) || [])[1]; return SEKMELER.find((x) => x.id === s) || SEKMELER[0]; };

  function PersonelKabuk() {
    const [sekme, setSekme] = useState(sekmeAl());
    const numune = useModulDeposu('numune', sekme.id === 'ana');
    const emirler = dolumEmirleri(numune);
    useEffect(() => { const f = () => { setSekme(sekmeAl()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
    // Canlıda kendi isimsiz bildirimlerinin durumu takip kodlarıyla sunucudan alınır (dakikada bir).
    useEffect(() => {
      if (DEMO) return undefined;
      const getir = () => isimsizleriGetir(depo(), anonimKodlar());
      getir();
      const z = setInterval(getir, 60000);
      return () => clearInterval(z);
    }, []);
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
      <header class="pn-panel-bant">
        <div class="pn-panel-ic">
          <div class="pn-panel-ust">
            <a class="pn-marka" href="#/ana" aria-label=${c('Ana sayfa', 'Home')}><span class="pn-marka-logo"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" /></span><b>${c("SKYHEM Takip", "SKYHEM Takip")}</b></a>
            <nav class="pn-menu" aria-label=${c('Sayfalar', 'Pages')}>${SEKMELER.filter((s) => s.id !== 'ana').map((s, i) => html`<a key=${s.id} style=${{ '--i': i }} href=${'#/' + s.id} class=${(sekme.id === s.id ? 'aktif ' : '') + s.id} aria-current=${sekme.id === s.id ? 'page' : undefined}>
              ${s.id === 'profil' ? html`<${Avatar} ad=${b.kullanici} kucuk />` : html`<span class="ik"><${Ikon} ad=${s.ikon} boyut=${15} /></span>`}
              <span>${s.id === 'profil' ? (b.kullanici || '').split(' ')[0] || c(s.ad, s.en) : c(s.ad, s.en)}</span>${s.id === 'taleplerim' && acik > 0 && html`<i aria-label=${cm('{0} açık', '{0} open', acik)}>${acik}</i>`}</a>`)}</nav>
          </div>
          ${sekme.id === 'ana' ? html`<div class="pn-panel-selam"><${PersonelSelami} /></div><${PersonelDikkat} emirler=${emirler} />`
            : html`<a class="pn-panel-geri" href="#/ana"><${Ikon} ad="geri" boyut=${14} />${c('Ana sayfa', 'Home')} · <b>${c(sekme.ad, sekme.en)}</b></a>`}
        </div>
      </header>
      <main key=${sekme.id} class=${sekme.id === 'ana' ? 'pn-icerik pn-icerik-ana' : 'pn-icerik'}><${sekme.Sayfa} numune=${numune} emirler=${emirler} /></main>
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
      <${K.Kart}>${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>${NT.dil.t("No")}</th><th>${c('Kişi', 'Person')}</th><th>${c('Tür', 'Type')}</th><th>${c('Özet', 'Summary')}</th><th>${c('Tarih', 'Date')}</th><th>${c('Durum', 'Status')}</th><th>${c('Karar veren', 'Decided by')}</th></tr></thead><tbody>
        ${liste.map((t) => html`<tr class="tik" key=${t.id} onClick=${() => K.ac(TalepDetay, { talep: t })}><td><span class="etiket-kod">${t.no}</span></td><td><b>${t.sahip}</b></td><td>${adi(P.talepTuru(t.tur), 'kisa')}</td>
          <td class="kucuk">${t.tur === 'malzeme' ? html`<${MalzemeKalemleri} t=${t} />` : P.talepOzet(t)}</td><td class="kucuk">${tarihYaz(t.tarih)}</td><td><${Rozet} durum=${t.durum} /></td><td class="kucuk">${t.karar ? t.karar.kim : ''}</td></tr>`)}</tbody></table></div>`
        : html`<${BosDurum} ikon="liste" baslik=${c('Talep yok', 'No requests')} />`}<//>`;
  }

  function TumBildirimler() {
    const d = depo();
    const liste = P.bildirimler(d);
    return html`<${K.Selam} bant baslik=${c('Bildirimler', 'Reports')}>${c('Ramak kala, öneri ve şikâyetler. İsimsiz olanlarda gönderenin kimliği sistemde hiç tutulmaz.', 'Near misses, suggestions and complaints. For anonymous ones the sender’s identity is never stored.')}<//>
      <${K.Kart}>${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>${NT.dil.t("No")}</th><th>${c('Tür', 'Type')}</th><th>${c('Gönderen', 'From')}</th><th>${c('Metin', 'Text')}</th><th>${c('Tarih', 'Date')}</th><th>${c('Durum', 'Status')}</th></tr></thead><tbody>
        ${liste.map((x) => html`<tr class="tik" key=${x.id} onClick=${() => K.ac(BildirimDetay, { bildirim: x })}><td><span class="etiket-kod">${x.no}</span></td><td>${adi(P.bildirimTuru(x.tur), 'kisa')}</td>
          <td>${x.isimsiz ? html`<span class="rozet mor">${c('İsimsiz', 'Anonymous')}</span>` : x.sahip}</td><td class="kucuk">${x.metin}</td><td class="kucuk">${tarihYaz(x.tarih)}</td><td><${Rozet} durum=${x.durum} tablo=${P.BILDIRIM_DURUM} /></td></tr>`)}</tbody></table></div>`
        : html`<${BosDurum} ikon="uyari" baslik=${c('Bildirim yok', 'No reports')} />`}<//>`;
  }

  function IzinDurumu() {
    const d = depo();
    const satirlar = P.kisiler(d).map((k) => ({ k, i: P.izinDurumu(d, k.ad) })).filter((x) => x.i);
    return html`<${K.Selam} baslik=${c('İzin durumu', 'Leave balances')}>${c('Bu izin yılı için yıllık izin hakkı (İş Kanunu 53. madde) ve kullanımı.', 'Annual leave entitlement (Labour Law art. 53) and usage for the current leave year.')}<//>
      <div class="uyari-kutu bilgi" style="margin-bottom:14px"><${Ikon} ad="bilgi" /><span>${IZIN_TEST()}</span></div>
      <${K.Kart}><div class="tablo-kap"><table class="tablo"><thead><tr><th>${c('Kişi', 'Person')}</th><th>${c('İşe başlama', 'Joined')}</th><th class="sag">${c('Kıdem', 'Service')}</th><th>${c('İzin yılı', 'Leave year')}</th><th class="sag">${c('Hak', 'Entitled')}</th><th class="sag">${c('Kullanılan', 'Used')}</th><th class="sag">${c('Bekleyen', 'Pending')}</th><th class="sag">${c('Kalan', 'Left')}</th></tr></thead><tbody>
        ${satirlar.map(({ k, i }) => html`<tr key=${k.id}><td><b>${k.ad}</b></td><td class="kucuk">${tarihYaz(k.iseBaslama)}</td><td class="sag sayi">${i.kidem}</td><td class="kucuk">${tarihYaz(i.bas)} – ${tarihYaz(i.bit)}</td>
          <td class="sag sayi">${i.hak}</td><td class="sag sayi">${i.kullanilan}</td><td class="sag sayi">${i.bekleyen || ''}</td><td class="sag sayi"><b>${i.kalan}</b></td></tr>`)}</tbody></table></div><//>`;
  }

  /* Yönetim › Taleplerim: yönetim kadrosunun kendi izin ve malzeme talepleri (personel paneline girmeden). */
  function YonetimTaleplerim() {
    const d = depo();
    const benim = P.benimTaleplerim(d, b.kullanici);
    return html`<${K.Selam} baslik=${c('Taleplerim', 'My requests')} sag=${html`<button class="d ana-d" onClick=${() => K.ac(IzinFormu)}><${Ikon} ad="takvim" />${c('İzin talebi', 'Leave request')}</button>
        <button class="d" onClick=${() => K.ac(MalzemeFormu)}><${Ikon} ad="kutu" />${c('Malzeme isteği', 'Material request')}</button>`}>
        ${kendiKaydi() ? c('Talepleriniz onaya düşmeden doğrudan kayda işlenir.', 'Your requests are recorded directly, without approval.')
          : c('İzin ve malzeme taleplerinizi buradan verin; kararı Farukcan Bey verir.', 'Submit your leave and material requests here; Farukcan Bey decides.')}<//>
      <${K.Kart}><div class="kart-ic">${benim.length ? html`<ul class="pn-liste">${benim.map((t) => html`<${TalepSatiri} key=${t.id} t=${t} />`)}</ul>`
        : html`<${BosDurum} ikon="liste" baslik=${c('Henüz talebiniz yok', 'No requests yet')} />`}</div><//>`;
  }

  /* ---------------- Başlat ---------------- */
  function Hazirlaniyor() {
    return html`<div class="tz-kurulum"><div class="tz-kurulum-kutu"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" />
      <h1>${c('Personel paneli hazırlanıyor', 'Staff panel in preparation')}</h1>
      <p>${c('Bu bölüm şimdilik yalnız sunum modunda açılır. Kişisel hesaplar kurulunca herkes kendi kullanıcı adıyla girecek.', 'For now this section opens in demo mode only. Once personal accounts are set up, everyone signs in with their own username.')}</p>
      <a class="d ana-d tz-buyuk" href=${NT.c.adres('personel', { demo: true })}>${c('Sunumu aç', 'Open demo')}</a></div></div>`;
  }

  void Hazirlaniyor; // canlıya geçildi (2026-11-18, 2. aşama); hesapsız açılışta giriş ekranı gelir
  if (YONETIM) {
    b.modul.ad = 'Personel talepleri'; // yönetim panelinin modülü; personel tarafı ayrı paneldir
    /* Talepler kişisel olabilir: sistem mimarı (Kamil) başkasının talebini görmez (sekreter kararı 2026-11-18; sunucu da vermez).
       Ona yalnız bildirimler (ramak kala, öneri/şikâyet) ve ayarlar kalır; kendi taleplerini personel panelinden verir. */
    const h = NT.c.hesap();
    const talepGizli = !DEMO && !!h && !h.onay && h.rol !== 'yonetici';
    K.calistir({
      sekmeler: [
        { id: 'onaylar', ad: talepGizli ? 'Yeni bildirimler' : 'Bekleyen onaylar', ikon: 'saat', sayac: (d) => P.dikkatSayisi(d) },
        { id: 'talepler', ad: 'Talepler', ikon: 'liste' },
        { id: 'bildirimler', ad: 'Bildirimler', ikon: 'uyari' },
        { id: 'izin', ad: 'İzin durumu', ikon: 'takvim' },
        { id: 'taleplerim', ad: 'Taleplerim', ikon: 'kisi', sayac: (d) => P.benimTaleplerim(d, b.kullanici).filter((t) => t.durum === 'bekliyor').length },
        { id: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
      ].filter((s) => !talepGizli || !['talepler', 'izin', 'taleplerim'].includes(s.id)),
      sayfalar: { onaylar: Onaylar, talepler: TumTalepler, bildirimler: TumBildirimler, izin: IzinDurumu, taleplerim: YonetimTaleplerim, ayarlar: () => html`<${K.AyarlarSayfasi} />` },
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
    const ic = b.durum === 'hazir' && b.depo ? html`<${PersonelKabuk} />`
      : b.durum === 'basliyor' || DEMO ? html`<div style="display:grid;place-items:center;height:100vh;color:var(--soluk)">${c('Yükleniyor…', 'Loading…')}</div>`
        : html`<${K.Kurulum} />`;
    return html`${ic}<${K.Katman} /><${GlobalKatman} />`;
  }
  render(html`<${Kok} />`, document.getElementById('uygulama'));
  b.baslat();
})();
