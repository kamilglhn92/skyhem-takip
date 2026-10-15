/* Gönderi (koli) etiketi: her paket için bir etiket, gerçek Code128 barkod (gönderi no) içerir.
   Şişe etiketlerini sistem basmaz; kullanıcı kendi etiketini (Canva vb.) gönderi kaydına şişe başına yükler (01.10.2026). */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, render, useState } = window.htmPreact;
  const { Ikon, Modal, Alan, AdetGirdi } = NT.ui;
  const H = NT.hesap;
  const { tarihYaz } = NT.c;

  const VARSAYILAN_UYARI = 'Numunedir, ticari değeri yoktur. Kullanmadan önce ürünün Güvenlik Bilgi Formunu (SDS) okuyunuz.';

  function ayarlar() {
    const d = NT.baglanti.depo;
    return { firmaAdi: 'SKYHEM Kimya Sanayi ve Ticaret A.Ş.', web: 'www.skyhem.com.tr', adres: '', telefon: '', ...(d?.kayit('ayar', 'genel') || {}) };
  }
  function Barkod({ metin }) {
    return html`<div class="barkod"><div dangerouslySetInnerHTML=${{ __html: NT.barkod.svg(metin, { yukseklik: 44, modul: 1.3 }) }} /><div class="kod">${metin}</div></div>`;
  }

  function SevkEtiketi({ kayit, koli }) {
    const d = NT.baglanti.depo;
    const a = ayarlar();
    const yuvalar = H.siseSlotlari(kayit.kalemler || [], kayit.siseler || []);
    const toplam = (kayit.kalemler || []).reduce((n, k) => n + (Number(k.adet) || 0), 0);
    return html`<div class="etiket buyuk-etiket">
      <div class="e-bas"><img src="uygulama/ortak/logo.svg" alt="SKYHEM" /><div class="tur">Numune gönderisi<br/>Sample shipment${koli ? html`<br/><b class="e-koli">Koli ${koli}</b>` : ''}</div></div>
      <div class="e-alici"><span class="e-k">Alıcı</span>
        <b>${kayit.firma}</b>${kayit.yetkili && html`<div>${kayit.yetkili}</div>`}${kayit.telefon && html`<div>Tel: ${kayit.telefon}</div>`}${kayit.adres && html`<div style="white-space:pre-line">${kayit.adres}</div>`}${kayit.ulke && kayit.ulke !== 'Türkiye' && html`<div><b>${kayit.ulke.toLocaleUpperCase('tr-TR')}</b></div>`}
      </div>
      <div class="e-izgara">
        <div class="e-alan"><div class="k">Tarih</div><div class="v">${tarihYaz(kayit.tarih)}</div></div>
        <div class="e-alan"><div class="k">Gönderi</div><div class="v">${kayit.sekil}${kayit.kargoFirma ? ' · ' + kayit.kargoFirma : ''}</div></div>
        <div class="e-alan"><div class="k">İçerik</div><div class="v">${toplam} şişe</div></div>
      </div>
      <div class="e-icerik">${(kayit.kalemler || []).map((k, i) => {
        const nolar = yuvalar[i].map((x) => x.no).filter(Boolean);
        return html`<div class="e-kalem"><span><b>${k.adet} ×</b> ${k.urun}${k.parti ? html` <span class="mono">${k.parti}</span>` : ''} · ${H.ambalajAdi(d, k.ambalaj)}</span>
          ${nolar.length > 0 && html`<span class="e-nolar mono">${nolar.join(' · ')}</span>`}</div>`;
      })}</div>
      ${kayit.sebep && html`<div class="e-not"><b>Talep:</b> ${kayit.sebep}</div>`}
      <div class="e-not">${VARSAYILAN_UYARI}</div>
      <div class="e-alt"><${Barkod} metin=${kayit.no || 'GN'} /><div class="firma"><b>Gönderen:</b> ${a.firmaAdi}${a.adres && html`<br />${a.adres}`}${a.telefon && html`<br />${a.telefon}`}<br />${a.web}</div></div>
    </div>`;
  }

  function yazdir(icerik) {
    let alan = document.getElementById('yazdir-alani');
    if (!alan) { alan = document.createElement('div'); alan.id = 'yazdir-alani'; document.body.appendChild(alan); }
    render(icerik, alan);
    const temizle = () => { render(null, alan); window.removeEventListener('afterprint', temizle); };
    window.addEventListener('afterprint', temizle);
    // Logo görselinin yüklenmesi için kısa bir süre tanı.
    setTimeout(() => window.print(), 150);
  }

  function EtiketPenceresi({ kayit, kapat }) {
    const [kopya, setKopya] = useState(1);
    const koli = (i) => (kopya > 1 ? `${i + 1} / ${kopya}` : '');
    return html`<${Modal} genis baslik="Gönderi etiketi" kapat=${kapat}
      alt=${html`<div class="sol dugmeler">
          <span class="kucuk ikincil">Paket (koli) sayısı</span>
          <div style="width:140px"><${AdetGirdi} deger=${kopya} degis=${(v) => setKopya(Math.max(1, Math.min(50, Number(v) || 1)))} min=${1} /></div>
        </div>
        <button class="d hayalet" onClick=${kapat}>Kapat</button>
        <button class="d ana-d" onClick=${() => yazdir(html`${Array.from({ length: kopya }, (_, i) => html`<${SevkEtiketi} key=${i} kayit=${kayit} koli=${koli(i)} />`)}`)}><${Ikon} ad="yazici" />Yazdır</button>`}>
      <div class="modal-ic">
        <div class="etiket-onizleme"><${SevkEtiketi} kayit=${kayit} koli=${koli(0)} /></div>
        <p class="kucuk soluk" style="margin:10px 0 0">Her paket için bir etiket (150 × 100 mm); birden fazla koli varsa “Koli 1 / 2” yazılır. Barkod gönderi numarasıdır:
          el okuyucuyla okutulunca gönderi kaydı ve içindeki şişe etiketleri açılır.</p>
      </div>
    <//>`;
  }

  NT.etiket = {
    ac: ({ kayit }) => NT.form.ac(EtiketPenceresi, { kayit }),
    SevkEtiketi, VARSAYILAN_UYARI, ayarlar,
  };
})();
