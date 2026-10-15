/* Yoklama — arayüz: bugün, aylık çizelge (İK karşılaştırması), kayıtlar, personel, ayarlar. Ücret hesabı yoktur. */
(function () {
  'use strict';
  const NT = window.NT;
  const { html, useState } = window.htmPreact;
  const { Ikon, Modal, Alan, Avatar, BosDurum, Ekler, GecmisBolumu, bildir, onayla } = NT.ui;
  const K = NT.kabuk;
  const Y = NT.yoklama;
  const T = NT.tatil;
  const { bugun, uid, sayi, tarihYaz, gunEkle, ara, AYLAR, onceYaz } = NT.c;
  const b = NT.baglanti;
  const depo = () => b.depo;
  const kisaTarih = (t) => `${+t.slice(8, 10)} ${AYLAR[+t.slice(5, 7) - 1]}`;
  const aralik = (i) => (!i.bit || i.bit === i.bas ? tarihYaz(i.bas) : `${kisaTarih(i.bas)} – ${tarihYaz(i.bit)}`);
  const kisiAdi = (id) => depo()?.kayit('kisi', id)?.ad || '?';
  const saatSayi = (v) => sayi(String(v).replace(',', '.'));

  Object.assign(NT.ui.ALAN_ADLARI, { kisi: 'Kişi', tur: 'Tür', bas: 'Başlangıç', bit: 'Bitiş', saat: 'Saat', baslangic: 'Takip başlangıcı', ay: 'Dönem', sira: 'Sıra' });
  NT.ui.DEGER_YAZ.kisi = (v) => kisiAdi(v);
  NT.ui.DEGER_YAZ.tur = (v) => Y.tur(v).ad;
  NT.ui.DEGER_YAZ.ay = (v) => Y.ayAdi(v);

  function TurRozeti({ id, saat }) {
    const t = Y.tur(id);
    return html`<span class=${'rozet ' + t.renk}>${t.ad}${saat ? ` · ${Y.saatYaz(sayi(saat))} sa` : ''}</span>`;
  }
  /* Bir günün durum yazısı */
  function durumYazi(g, t) {
    if (g.disarda) return 'Takip dışı';
    if (g.yok) return Y.tur(g.tur).ad;
    if (g.tatil) return `Çalıştı (${T.tatil(t) ? 'resmî tatil' : 'hafta sonu'})${g.saat ? ` · ${Y.saatYaz(g.saat)} sa` : ''}`;
    if (g.kapali) return T.tatil(t) || 'Hafta sonu';
    return g.saat ? `İşte · +${Y.saatYaz(g.saat)} sa mesai` : 'İşte';
  }

  /* ---------------- Kayıt penceresi (istisna) ---------------- */
  function IstisnaPenceresi({ kayit, on = {}, kapat }) {
    const d = depo();
    const kisiler = Y.kisiler(d);
    const [f, setF] = useState(() => (kayit ? { kisiler: [kayit.kisi], tur: kayit.tur, bas: kayit.bas, bit: kayit.bit || kayit.bas, saat: kayit.saat ? Y.saatYaz(sayi(kayit.saat)) : '', notlar: kayit.notlar || '', ekler: kayit.ekler || [] }
      : { kisiler: on.kisi ? [on.kisi] : [], tur: on.tur || '', bas: on.bas || bugun(), bit: on.bas || bugun(), saat: '', notlar: '', ekler: [] }));
    const [denendi, setDenendi] = useState(false);
    const s = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
    const t = f.tur ? Y.tur(f.tur) : null;
    const gun = f.bas && f.bit >= f.bas ? Y.kayitGunleri({ bas: f.bas, bit: f.bit }) : { is: 0, takvim: 0 };
    const cakisan = f.tur ? f.kisiler.flatMap((k) => Y.cakisanlar(d, { id: kayit?.id, kisi: k, tur: f.tur, bas: f.bas, bit: f.bit })) : [];
    const hata = !f.kisiler.length ? 'Kişi seçin' : !f.tur ? 'Ne olduğunu seçin' : !f.bas ? 'Tarih seçin' : f.bit < f.bas ? 'Bitiş, başlangıçtan önce olamaz'
      : t.saat && f.tur === 'mesai' && !(saatSayi(f.saat) > 0) ? 'Fazla mesai saatini yazın' : '';
    const uyari = f.tur === 'mesai' && gun.is === 0 && f.bas ? 'Seçilen günler iş günü değil; hafta sonu/tatil için “Hafta sonu / tatil çalıştı”yı seçin.'
      : f.tur === 'tatil' && gun.takvim - gun.is === 0 && f.bas ? 'Seçilen gün iş günü; iş günündeki ek çalışma için “Fazla mesai”yi seçin.' : '';
    async function kaydet() {
      setDenendi(true);
      if (hata) return;
      const v = { tur: f.tur, bas: f.bas, bit: f.bit || f.bas, saat: t.saat && String(f.saat).trim() !== '' ? saatSayi(f.saat) : '', notlar: f.notlar.trim(), ekler: f.ekler };
      if (kayit) await d.kaydet([{ c: 'istisna', k: kayit.id, v: { kisi: f.kisiler[0], ...v } }]);
      else await d.kaydet(f.kisiler.map((k) => ({ c: 'istisna', k: uid(), v: { kisi: k, ...v } })));
      bildir(`${f.kisiler.map(kisiAdi).join(', ')} · ${t.ad}${v.saat ? ` ${Y.saatYaz(v.saat)} sa` : ''} · ${aralik(v)}`);
      kapat();
    }
    const silFn = async () => (await K.sil('istisna', kayit, `${kisiAdi(kayit.kisi)} · ${Y.tur(kayit.tur).ad} (${aralik(kayit)})`)) && kapat();
    return html`<${Modal} baslik=${kayit ? `${kisiAdi(kayit.kisi)} · ${Y.tur(kayit.tur).ad}` : 'Yoklama kaydı'} kapat=${kapat}
      alt=${html`<${K.FormAlt} kayit=${kayit} sil=${silFn} kapat=${kapat} kaydet=${kaydet} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket=${kayit ? 'Kişi' : 'Kişi (birden fazla seçilebilir)'} hata=${denendi && !f.kisiler.length ? 'Kişi seçin' : ''}>
          <div class="secenekler">${kisiler.map((k) => html`<button type="button" class=${'secenek' + (f.kisiler.includes(k.id) ? ' secili' : '')}
            onClick=${() => s('kisiler')(kayit ? [k.id] : f.kisiler.includes(k.id) ? f.kisiler.filter((x) => x !== k.id) : [...f.kisiler, k.id])}>${k.ad}</button>`)}
            ${!kayit && kisiler.length > 1 && html`<button type="button" class="secenek" onClick=${() => s('kisiler')(f.kisiler.length === kisiler.length ? [] : kisiler.map((k) => k.id))}>${f.kisiler.length === kisiler.length ? 'Hiçbiri' : 'Hepsi'}</button>`}</div><//>
        <${Alan} etiket="Ne oldu" hata=${denendi && !f.tur ? 'Ne olduğunu seçin' : ''} ipucu=${t?.ipucu}>
          <div class="secenekler">${Y.TURLER.map((x) => html`<button type="button" class=${'secenek yk-tur ' + x.renk + (f.tur === x.id ? ' secili' : '')} onClick=${() => s('tur')(x.id)}>${x.ad}</button>`)}</div><//>
        <${Alan} etiket="Başlangıç" sinif="s4"><input class="girdi" type="date" value=${f.bas} onInput=${(e) => setF((p) => ({ ...p, bas: e.target.value, bit: p.bit < e.target.value || p.bit === p.bas ? e.target.value : p.bit }))} /><//>
        <${Alan} etiket="Bitiş" sinif="s4" hata=${denendi && f.bit < f.bas ? 'Başlangıçtan önce olamaz' : ''} ipucu=${gun.takvim ? `${gun.takvim} gün · ${gun.is} iş günü` : ''}><input class="girdi" type="date" value=${f.bit} min=${f.bas} onInput=${(e) => s('bit')(e.target.value)} /><//>
        ${t && t.saat ? html`<${Alan} etiket=${f.tur === 'mesai' ? 'Fazla mesai (saat, günlük)' : 'Çalışılan saat (isteğe bağlı)'} sinif="s4" hata=${denendi && f.tur === 'mesai' && !(saatSayi(f.saat) > 0) ? 'Saati yazın' : ''}>
            <input class="girdi sayi" inputmode="decimal" value=${f.saat} onInput=${(e) => s('saat')(e.target.value)} placeholder="Örn: 2,5" /><//>` : html`<div class="s4" />`}
        ${uyari && html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>${uyari}</span></div>`}
        ${cakisan.length > 0 && html`<div class="s12 uyari-kutu kritik"><${Ikon} ad="uyari" /><span>Bu tarihlerde zaten kayıt var: ${cakisan.map((c) => `${kisiAdi(c.kisi)} · ${Y.tur(c.tur).ad} (${aralik(c)})`).join('; ')}</span></div>`}
        <${Alan} etiket="Açıklama"><input class="girdi" value=${f.notlar} onInput=${(e) => s('notlar')(e.target.value)} placeholder=${f.tur === 'yillik' ? 'Örn: Yıllık izin, 3 gün' : f.tur === 'izin' ? 'Örn: Mahkemesi var' : f.tur === 'rapor' ? 'Örn: 2 günlük rapor' : ''} /><//>
        <${Alan} etiket="Ekler" ipucu=${f.tur === 'rapor' ? 'Rapor görseli / fotoğrafı' : 'İsteğe bağlı'}><${Ekler} ekler=${f.ekler} degis=${s('ekler')} /><//>
        ${kayit && html`<${GecmisBolumu} kayit=${kayit} />`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  const kayitAc = (kayit) => K.ac(IstisnaPenceresi, { kayit });
  const yeniKayit = (on) => K.ac(IstisnaPenceresi, { on });
  /* Çizelgede bir hücre: o günü kapsayan kayıt varsa onu, yoksa yeni kayıt açar. */
  function hucreAc(k, t, g) {
    if (g.kayit) return kayitAc(g.kayit);
    yeniKayit({ kisi: k.id, bas: t, tur: T.isGunu(t) ? '' : 'tatil' });
  }

  /* ---------------- Bugün ---------------- */
  function GenelBakis() {
    const d = depo();
    const bg = bugun();
    const l = Y.bugunListe(d);
    const takipte = l.filter((x) => !x.g.disarda);
    const yok = takipte.filter((x) => x.g.yok);
    const ay = Y.ayOzet(d, bg.slice(0, 7));
    const devam = Y.istisnalar(d).filter((i) => (i.bit || i.bas) >= bg && Y.tur(i.tur).yok).sort((a, x) => (a.bas < x.bas ? -1 : 1));
    const sonMesai = Y.istisnalar(d).filter((i) => !Y.tur(i.tur).yok).sort((a, x) => (a.bas < x.bas ? 1 : -1)).slice(0, 6);
    const saat = new Date().getHours();
    const adK = (b.kullanici || '').split(' ')[0];
    const a = Y.ayar(d);
    if (!Y.kisiler(d).length) return html`<${K.Selam} baslik="Yoklama">Henüz personel yok.<//><${BosDurum} ikon="kisi" baslik="Personel ekleyin" aciklama="Önce Personel sayfasından çalışanları ekleyin."><a class="d ana-d" href="#/personel">Personel ekle</a><//>`;
    return html`
      <${K.Selam} bant baslik=${`${saat < 11 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar'}${adK ? ', ' + adK : ''}.`}
        sag=${html`<button class="d ana-d tz-buyuk" onClick=${() => yeniKayit({})}><${Ikon} ad="arti" />Kayıt gir</button>`}>
        ${T.isGunu(bg) ? html`Bugün <b class="v">${takipte.length - yok.length} / ${takipte.length}</b> kişi işte.${yok.length ? html` ${yok.map((x) => `${x.k.ad} (${Y.tur(x.g.tur).ad.toLocaleLowerCase('tr')})`).join(', ')}.` : ''}` : html`Bugün ${T.tatil(bg) || 'hafta sonu'}.`}
        ${' '}Herkes işte sayılır; yalnızca izin, rapor, gelmeme ve fazla mesai girilir.
      <//>
      ${a.baslangic && bg < Y.ayKaydir(a.baslangic.slice(0, 7), 1) + '-01' && html`<div class="uyari-kutu bilgi" style="margin-bottom:16px"><${Ikon} ad="bilgi" /><span>Yoklama ${tarihYaz(a.baslangic)} tarihinden itibaren tutuluyor; önceki günler sayılmaz.</span></div>`}
      <div class="yk-bugun">${l.map(({ k, g }) => html`<div class=${'yk-kisi' + (g.yok ? ' yok' : '')}>
        <${Avatar} ad=${k.ad} />
        <div class="ad"><b>${k.ad}</b><span>${g.disarda ? 'Takip dışı' : durumYazi(g, bg)}${g.kayit && g.kayit.notlar ? ` · ${g.kayit.notlar}` : ''}</span></div>
        ${g.yok ? html`<button class="d kucuk-d" onClick=${() => kayitAc(g.kayit)}>Aç</button>`
          : !g.disarda && html`<button class="d kucuk-d" onClick=${() => yeniKayit({ kisi: k.id, bas: bg, tur: T.isGunu(bg) ? '' : 'tatil' })}><${Ikon} ad="arti" boyut=${14} />Kayıt</button>`}
      </div>`)}</div>
      <div class="kpi-sira">
        <${K.Kpi} vurgu ikon="saat" ad="Bu ay fazla mesai" deger=${Y.saatYaz(ay.reduce((s, x) => s + x.mesaiSaat, 0))} birim="saat" alt=${`${ay.reduce((s, x) => s + x.tatilGun, 0)} gün hafta sonu/tatil çalışması`} />
        <${K.Kpi} ikon="uyari" ad="Raporlu" deger=${ay.reduce((s, x) => s + x.rapor, 0)} birim="iş günü" alt=${Y.ayAdi(bg.slice(0, 7))} />
        <${K.Kpi} ikon="takvim" ad="İzin" deger=${ay.reduce((s, x) => s + x.yillik + x.izin, 0)} birim="iş günü" alt=${`yıllık ${ay.reduce((s, x) => s + x.yillik, 0)} · mazeret ${ay.reduce((s, x) => s + x.izin, 0)}`} />
        <${K.Kpi} ikon="kapat" ad="Gelmedi" deger=${ay.reduce((s, x) => s + x.gelmedi, 0)} birim="gün" alt=${Y.ayAdi(bg.slice(0, 7))} />
      </div>
      <div class="tz-izgara">
        <${K.Kart} baslik=${`${Y.ayAdi(bg.slice(0, 7))} · kişi başı`} sag=${html`<a href="#/cizelge" style="color:var(--ana)">Çizelge →</a>`}>
          <${OzetTablo} ozet=${ay} />
        <//>
        <div class="tz-sutun">
          <${K.Kart} baslik="Devam eden ve yaklaşan izinler">
            ${devam.length ? html`<ul class="tz-akis">${devam.map((i) => html`<li onClick=${() => kayitAc(i)}><span class="ik"><${Ikon} ad="takvim" /></span>
              <span class="ne"><b>${kisiAdi(i.kisi)}</b> · ${Y.tur(i.tur).ad}<small>${aralik(i)}${i.notlar ? ' · ' + i.notlar : ''}</small></span></li>`)}</ul>` : html`<p class="soluk" style="margin:0">Devam eden izin veya rapor yok.</p>`}
          <//>
          <${K.Kart} baslik="Son fazla mesailer">
            ${sonMesai.length ? html`<ul class="tz-akis">${sonMesai.map((i) => html`<li onClick=${() => kayitAc(i)}><span class="ik"><${Ikon} ad="saat" /></span>
              <span class="ne"><b>${kisiAdi(i.kisi)}</b> · ${Y.tur(i.tur).ad}<small>${aralik(i)}</small></span><span class="miktar">${i.saat ? Y.saatYaz(sayi(i.saat)) + ' sa' : ''}</span></li>`)}</ul>` : html`<p class="soluk" style="margin:0">Henüz fazla mesai girilmedi.</p>`}
          <//>
        </div>
      </div>`;
  }

  /* Kişi başı özet tablosu (İK karşılaştırması) */
  function OzetTablo({ ozet, tam }) {
    if (!ozet.length) return html`<p class="soluk" style="margin:0">Bu ay takipte kimse yok.</p>`;
    const top = (k) => ozet.reduce((s, x) => s + x[k], 0);
    return html`<div class="tablo-kap"><table class="tablo yk-ozet"><thead><tr><th>Personel</th><th class="sag" title="Takvimdeki iş günü (hafta içi, tatil hariç)">İş günü</th><th class="sag">Çalıştı</th>
      <th class="sag">Rapor</th><th class="sag">Yıllık izin</th><th class="sag">Mazeret</th><th class="sag">Gelmedi</th><th class="sag">Fazla mesai</th><th class="sag" title="Hafta sonu / resmî tatil çalışması">HS/RT çalışma</th></tr></thead><tbody>
      ${ozet.map((x) => html`<tr><td><b>${x.kisi.ad}</b></td><td class="sag sayi">${x.isGunu}</td><td class="sag sayi">${x.calisti}</td>
        <td class="sag sayi">${x.rapor || ''}${x.raporTakvim > x.rapor ? html`<div class="kucuk soluk">${x.raporTakvim} takvim g.</div>` : ''}</td><td class="sag sayi">${x.yillik || ''}</td><td class="sag sayi">${x.izin || ''}</td><td class="sag sayi">${x.gelmedi || ''}</td>
        <td class="sag sayi">${x.mesaiSaat ? `${Y.saatYaz(x.mesaiSaat)} sa` : ''}${tam && x.mesaiGun ? html`<div class="kucuk soluk">${x.mesaiGun} günde</div>` : ''}</td>
        <td class="sag sayi">${x.tatilGun ? `${x.tatilGun} g${x.tatilSaat ? ` · ${Y.saatYaz(x.tatilSaat)} sa` : ''}` : ''}${tam && x.tatilGun ? html`<div class="kucuk soluk">${[x.cumartesi && `Cmt ${x.cumartesi}`, x.pazar && `Paz ${x.pazar}`, x.resmi && `RT ${x.resmi}`].filter(Boolean).join(' · ')}</div>` : ''}</td></tr>`)}
      ${ozet.length > 1 && html`<tr><td><b>Toplam</b></td><td></td><td class="sag sayi">${top('calisti')}</td><td class="sag sayi">${top('rapor') || ''}</td><td class="sag sayi">${top('yillik') || ''}</td><td class="sag sayi">${top('izin') || ''}</td><td class="sag sayi">${top('gelmedi') || ''}</td>
        <td class="sag sayi"><b>${top('mesaiSaat') ? Y.saatYaz(top('mesaiSaat')) + ' sa' : ''}</b></td><td class="sag sayi">${top('tatilGun') ? top('tatilGun') + ' g' : ''}</td></tr>`}
    </tbody></table></div>`;
  }

  /* ---------------- Aylık çizelge ---------------- */
  function AySecici({ ay, setAy }) {
    return html`<div class="yk-ay-sec"><button class="d hayalet ikon-d" onClick=${() => setAy(Y.ayKaydir(ay, -1))} aria-label="Önceki ay"><${Ikon} ad="geri" /></button>
      <b>${Y.ayAdi(ay)}</b><button class="d hayalet ikon-d" onClick=${() => setAy(Y.ayKaydir(ay, 1))} aria-label="Sonraki ay"><${Ikon} ad="ok" /></button>
      ${ay !== bugun().slice(0, 7) && html`<button class="d kucuk-d" onClick=${() => setAy(bugun().slice(0, 7))}>Bu ay</button>`}</div>`;
  }
  function Cizelge() {
    const d = depo();
    const [ay, setAy] = useState(bugun().slice(0, 7));
    const gunler = Y.ayGunleri(ay);
    const ozet = Y.ayOzet(d, ay);
    const bg = bugun();
    const o = Y.onay(d, ay);
    const degisen = Y.onaydanSonraDegisen(d, ay);
    const ayBitti = ay < bg.slice(0, 7);
    return html`<${K.Selam} baslik="Aylık çizelge" sag=${html`<button class="d" onClick=${() => excelAy(d, ay)}><${Ikon} ad="indir" boyut=${15} />Excel (İK için)</button>
        <button class=${'d ' + (o && !degisen.length ? '' : 'ana-d')} onClick=${() => K.ac(OnayPenceresi, { ay })}><${Ikon} ad="daire_tik" boyut=${15} />${o ? (degisen.length ? 'Yeniden onayla' : 'Onaylı') : 'Ayı onayla'}</button>`}>
        Hücreye tıklayıp o günün kaydını girin veya açın. + işte, sayı fazla mesai saati, HT hafta tatili, RT resmî tatil.<//>
      <${AySecici} ay=${ay} setAy=${setAy} />
      ${o && html`<div class=${'uyari-kutu ' + (degisen.length ? 'kritik' : 'iyi')} style="margin-bottom:14px"><${Ikon} ad=${degisen.length ? 'uyari' : 'daire_tik'} /><span>
        ${Y.ayAdi(ay)} <b>${o._degistiren}</b> tarafından onaylandı (${NT.c.zamanYaz(o._degisim)}).${degisen.length ? ` Onaydan sonra ${degisen.length} kayıt değişti; kontrol edip yeniden onaylayın.` : ''}${o.notlar ? ` Not: ${o.notlar}` : ''}</span></div>`}
      ${!o && ayBitti && ozet.length > 0 && html`<div class="uyari-kutu kritik" style="margin-bottom:14px"><${Ikon} ad="uyari" /><span>${Y.ayAdi(ay)} bitti ama onaylanmadı. Kontrol edip “Ayı onayla” deyin; sonra Excel’i İK’ya verin.</span></div>`}
      ${ozet.length ? html`<div class="yk-cizelge-kap"><table class="yk-cizelge">
        <thead><tr><th class="ad">Personel</th>${gunler.map((t) => html`<th class=${(T.isGunu(t) ? '' : 'kapali') + (t === bg ? ' bugun' : '')} title=${T.tatil(t) || T.yarimGun(t) || ''}><span>${+t.slice(8)}</span><small>${Y.gunKisa(t)}</small></th>`)}</tr></thead>
        <tbody>${ozet.map((x) => html`<tr><th class="ad">${x.kisi.ad}</th>${gunler.map((t) => {
          const g = x.gunler[t];
          const sinif = g.disarda ? 'disarda' : g.yok ? 'yok ' + Y.tur(g.tur).renk : g.tatil ? 'tatil-calisma' : g.kapali ? 'kapali' : g.saat ? 'mesai' : g.gelecek ? 'gelecek' : 'isde';
          return html`<td class=${sinif + (t === bg ? ' bugun' : '')} title=${`${x.kisi.ad} · ${tarihYaz(t)} · ${durumYazi(g, t)}${g.kayit && g.kayit.notlar ? ' · ' + g.kayit.notlar : ''}`}
            onClick=${() => !g.disarda && hucreAc(x.kisi, t, g)}>${g.kod}</td>`;
        })}</tr>`)}</tbody></table></div>
        <div class="yk-lejant">${[['isde', '+', 'İşte'], ['mesai', '2', 'Fazla mesai (saat)'], ...Y.TURLER.filter((t) => t.yok).map((t) => ['yok ' + t.renk, t.kod, t.ad]), ['tatil-calisma', 'Ç', 'Hafta sonu / tatil çalıştı'], ['kapali', 'HT', 'Hafta tatili'], ['kapali', 'RT', 'Resmî tatil']]
          .map(([s, k, a]) => html`<span><i class=${s}>${k}</i>${a}</span>`)}</div>
        <${K.Kart} baslik="Özet (İK karşılaştırması)" stil="margin-top:18px"><${OzetTablo} ozet=${ozet} tam /><//>`
      : html`<${BosDurum} ikon="takvim" baslik="Bu ay takipte kimse yok" aciklama=${Y.ayar(d).baslangic ? `Yoklama ${tarihYaz(Y.ayar(d).baslangic)} tarihinden itibaren tutuluyor.` : ''} />`}`;
  }

  function OnayPenceresi({ ay, kapat }) {
    const d = depo();
    const o = Y.onay(d, ay);
    const [not, setNot] = useState(o?.notlar || '');
    const ozet = Y.ayOzet(d, ay);
    const devam = ay >= bugun().slice(0, 7);
    return html`<${Modal} genis baslik=${`${Y.ayAdi(ay)} · ayı onayla`} kapat=${kapat} alt=${html`<button class="d hayalet" onClick=${kapat}>Vazgeç</button>
      <button class="d ana-d" onClick=${async () => { await d.kaydet([{ c: 'onay', k: Y.onayAnahtari(ay), v: { ay, notlar: not.trim() } }]); bildir(`${Y.ayAdi(ay)} onaylandı.`); kapat(); }}><${Ikon} ad="daire_tik" />Onaylıyorum</button>`}>
      <div class="modal-ic">
        <p style="margin:0 0 12px">Aşağıdaki dökümün doğru olduğunu onaylayın. Onaydan sonra bir kayıt değişirse çizelgede uyarı çıkar.</p>
        ${devam && html`<div class="uyari-kutu kritik" style="margin-bottom:12px"><${Ikon} ad="uyari" /><span>Ay henüz bitmedi; kalan günler “çalıştı”ya sayılmadı.</span></div>`}
        <${OzetTablo} ozet=${ozet} tam />
        <${Alan} etiket="Not (isteğe bağlı)"><input class="girdi" value=${not} onInput=${(e) => setNot(e.target.value)} placeholder="Örn: İK ile karşılaştırıldı, fark yok" /><//>
      </div>
    <//>`;
  }

  /* ---------------- Kayıtlar ---------------- */
  function Kayitlar() {
    const d = depo();
    const [kisi, setKisi] = useState('');
    const [tr, setTr] = useState('');
    const [q, setQ] = useState('');
    const liste = Y.istisnalar(d).filter((i) => (!kisi || i.kisi === kisi) && (!tr || i.tur === tr) && ara(`${kisiAdi(i.kisi)} ${Y.tur(i.tur).ad} ${i.notlar || ''}`, q))
      .sort((a, x) => (a.bas < x.bas ? 1 : a.bas > x.bas ? -1 : x._olusturma - a._olusturma));
    return html`<${K.Selam} baslik="Kayıtlar" sag=${html`<button class="d ana-d tz-buyuk" onClick=${() => yeniKayit({ kisi })}><${Ikon} ad="arti" />Kayıt gir</button>`}>
        Girilen bütün izin, rapor, gelmeme ve fazla mesai kayıtları.<//>
      <div class="tz-cipler">
        <select class="girdi kisa" value=${kisi} onChange=${(e) => setKisi(e.target.value)}><option value="">Herkes</option>${Y.kisiler(d, { hepsi: true }).map((k) => html`<option value=${k.id}>${k.ad}</option>`)}</select>
        <select class="girdi kisa" value=${tr} onChange=${(e) => setTr(e.target.value)}><option value="">Bütün türler</option>${Y.TURLER.map((t) => html`<option value=${t.id}>${t.ad}</option>`)}</select>
        <input class="girdi" style="max-width:260px;border-radius:99px" placeholder="Açıklamada ara…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      </div>
      <${K.Kart}>${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>Tarih</th><th>Kişi</th><th>Tür</th><th class="sag">Gün</th><th>Açıklama</th><th>Giren</th></tr></thead><tbody>
        ${liste.map((i) => { const g = Y.kayitGunleri(i); return html`<tr class="tik" onClick=${() => kayitAc(i)}><td>${aralik(i)}</td><td><b>${kisiAdi(i.kisi)}</b></td><td><${TurRozeti} id=${i.tur} saat=${i.saat} /></td>
          <td class="sag sayi">${Y.tur(i.tur).yok ? `${g.is} iş g.` : g.takvim}</td><td class="kucuk">${i.notlar || ''}${(i.ekler || []).length ? html` <${Ikon} ad="etiket" boyut=${13} />` : ''}</td>
          <td class="kucuk soluk">${i._olusturan} · ${onceYaz(i._olusturma)}</td></tr>`; })}
      </tbody></table></div>` : html`<p class="soluk" style="margin:0">Kayıt yok. Herkes işte sayılıyor.</p>`}<//>`;
  }

  /* ---------------- Personel ---------------- */
  function KisiPenceresi({ kayit, kapat }) {
    const d = depo();
    const [f, setF] = useState(() => ({ ad: '', aktif: true, bas: '', bit: '', notlar: '', ...(kayit || {}) }));
    const [denendi, setDenendi] = useState(false);
    const s = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
    const ayni = f.ad.trim() && Y.kisiler(d, { hepsi: true }).find((k) => k.id !== kayit?.id && k.ad.toLocaleLowerCase('tr') === f.ad.trim().toLocaleLowerCase('tr'));
    async function kaydet() {
      setDenendi(true);
      if (!f.ad.trim() || ayni) return;
      const sira = kayit ? kayit.sira : Y.kisiler(d, { hepsi: true }).reduce((m, k) => Math.max(m, sayi(k.sira)), 0) + 1;
      await d.kaydet([{ c: 'kisi', k: kayit ? kayit.id : uid(), v: { ad: f.ad.trim(), aktif: !f.bit || f.bit >= bugun() ? f.aktif !== false : false, bas: f.bas, bit: f.bit, sira, notlar: f.notlar.trim() } }]);
      bildir(kayit ? `${f.ad.trim()} güncellendi.` : `${f.ad.trim()} eklendi.`);
      kapat();
    }
    return html`<${Modal} baslik=${kayit ? kayit.ad : 'Yeni personel'} kapat=${kapat}
      alt=${html`<${K.FormAlt} kayit=${kayit} sil=${async () => { if (Y.istisnalar(d).some((i) => i.kisi === kayit.id) && !(await onayla(`${kayit.ad} için yoklama kayıtları var. Silmek yerine “Ayrılış tarihi” girmeniz önerilir; kayıtlar korunur.`, { baslik: 'Yine de silinsin mi?', evet: 'Devam', tehlike: true }))) return; if (await K.sil('kisi', kayit, kayit.ad)) kapat(); }} kapat=${kapat} kaydet=${kaydet} />`}>
      <form class="modal-ic form-izgara" onSubmit=${(e) => { e.preventDefault(); kaydet(); }}>
        <${Alan} etiket="Ad Soyad" hata=${denendi && (!f.ad.trim() ? 'Adı yazın' : ayni && 'Bu adla biri zaten var')}><input class="girdi" value=${f.ad} onInput=${s('ad')} autofocus /><//>
        <${Alan} etiket="İşe başlama" sinif="s6" ipucu="Boşsa takip başlangıcından itibaren sayılır"><input class="girdi" type="date" value=${f.bas} onInput=${s('bas')} /><//>
        <${Alan} etiket="Ayrılış" sinif="s6" ipucu="Ayrılan kişi silinmez; bu tarihten sonra sayılmaz"><input class="girdi" type="date" value=${f.bit} onInput=${s('bit')} /><//>
        <${Alan} etiket="Not"><input class="girdi" value=${f.notlar} onInput=${s('notlar')} /><//>
        ${kayit && html`<${GecmisBolumu} kayit=${kayit} />`}
        <button type="submit" class="gizli" />
      </form>
    <//>`;
  }
  function Personel() {
    const d = depo();
    const liste = Y.kisiler(d, { hepsi: true });
    const tasi = async (k, yon) => {
      const i = liste.indexOf(k), j = i + yon;
      if (j < 0 || j >= liste.length) return;
      await d.kaydet(liste.map((x, n) => ({ c: 'kisi', k: x.id, v: { sira: n === i ? j + 1 : n === j ? i + 1 : n + 1 } })).filter((o, n) => sayi(liste[n].sira) !== o.v.sira));
    };
    return html`<${K.Selam} baslik="Personel" sag=${html`<button class="d ana-d tz-buyuk" onClick=${() => K.ac(KisiPenceresi, {})}><${Ikon} ad="arti" />Personel ekle</button>`}>
        Yoklaması tutulan kişiler. Ayrılan kişiyi silmeyin; ayrılış tarihini girin, eski ayların dökümü bozulmaz.<//>
      <${K.Kart}>${liste.length ? html`<div class="tablo-kap"><table class="tablo"><thead><tr><th>Sıra</th><th>Ad Soyad</th><th>İşe başlama</th><th>Ayrılış</th><th>Durum</th><th></th></tr></thead><tbody>
        ${liste.map((k, i) => html`<tr class="tik" onClick=${() => K.ac(KisiPenceresi, { kayit: k })}><td class="sayi">${i + 1}</td><td><b>${k.ad}</b>${k.notlar ? html`<div class="soluk kucuk">${k.notlar}</div>` : ''}</td>
          <td>${k.bas ? tarihYaz(k.bas) : html`<span class="soluk">—</span>`}</td><td>${k.bit ? tarihYaz(k.bit) : html`<span class="soluk">—</span>`}</td>
          <td>${k.aktif !== false ? html`<span class="rozet iyi">Aktif</span>` : html`<span class="rozet">Ayrıldı</span>`}</td>
          <td class="sag" onClick=${(e) => e.stopPropagation()}><button class="d hayalet ikon-d" title="Yukarı" disabled=${i === 0} onClick=${() => tasi(k, -1)}>↑</button><button class="d hayalet ikon-d" title="Aşağı" disabled=${i === liste.length - 1} onClick=${() => tasi(k, 1)}>↓</button></td></tr>`)}
      </tbody></table></div>` : html`<${BosDurum} ikon="kisi" baslik="Personel yok" aciklama="“Personel ekle” ile çalışanları ekleyin." />`}<//>`;
  }

  /* ---------------- Ayarlar ---------------- */
  function YoklamaAyarlari() {
    const d = depo();
    const a = Y.ayar(d);
    const [bas, setBas] = useState(a.baslangic || '');
    const [yil, setYil] = useState(+bugun().slice(0, 4));
    return html`<${K.AyarKarti} baslik="Takip başlangıcı" aciklama="Yoklama bu tarihten itibaren tutulur; önceki günler hiçbir hesaba girmez.">
        <div class="form-izgara"><${Alan} etiket="Başlangıç" sinif="s6"><div style="display:flex;gap:8px"><input class="girdi" type="date" value=${bas} onInput=${(e) => setBas(e.target.value)} />
          <button class="d" disabled=${bas === (a.baslangic || '')} onClick=${async () => { await d.kaydet([{ c: 'ayar', k: 'genel', v: { baslangic: bas } }]); bildir('Kaydedildi.'); }}>Kaydet</button></div><//></div>
      <//>
      <${K.AyarKarti} ic=${false} baslik="Resmî tatiller" aciklama="Hafta sonu ve bu günler iş günü sayılmaz (RT). Arife günleri yarım gündür, iş günü sayılır." sag=${html`<select class="girdi kisa" value=${yil} onChange=${(e) => setYil(+e.target.value)}>${[-1, 0, 1].map((i) => html`<option value=${+bugun().slice(0, 4) + i}>${+bugun().slice(0, 4) + i}</option>`)}</select>`}>
        ${!T.bilinenYil(yil) && html`<div class="uyari-kutu kritik" style="margin:0 16px 12px"><${Ikon} ad="uyari" /><span>${yil} dinî bayram tarihleri programa henüz eklenmedi; yalnızca sabit tatiller görünüyor.</span></div>`}
        <div class="tablo-kap" style="max-height:320px"><table class="tablo"><tbody>${T.liste(yil).map((x) => html`<tr><td>${tarihYaz(x.tarih)}</td><td>${x.ad}${x.yarim ? html` <span class="soluk kucuk">(yarım gün)</span>` : ''}</td></tr>`)}</tbody></table></div>
      <//>`;
  }
  function Ayarlar() {
    return html`<${K.AyarlarSayfasi} cop=${{
      istisna: { ad: 'Yoklama kaydı', ozet: (r) => `${kisiAdi(r.kisi)} · ${Y.tur(r.tur).ad} · ${aralik(r)}` },
      kisi: { ad: 'Personel', ozet: (r) => r.ad },
      onay: { ad: 'Ay onayı', ozet: (r) => Y.ayAdi(r.ay) },
    }}><${YoklamaAyarlari} /><//>`;
  }

  /* ---------------- Excel (İK için): kişi × gün kodları + özet ---------------- */
  const metin = (v, hiza) => ({ v: v ?? '', tur: 'metin', hiza });
  const sayiH = (v) => ({ v: Number(v) || 0, tur: 'sayi' });
  function excelAy(d, ay) {
    const gunler = Y.ayGunleri(ay);
    const ozet = Y.ayOzet(d, ay);
    if (!ozet.length) return bildir('Bu ay takipte kimse yok.');
    const o = Y.onay(d, ay);
    const satirlar = ozet.map((x) => ({ hucreler: [metin(x.kisi.ad, 'sol'), ...gunler.map((t) => metin(x.gunler[t].kod)), sayiH(x.isGunu), sayiH(x.calisti), sayiH(x.rapor), sayiH(x.yillik), sayiH(x.izin), sayiH(x.gelmedi),
      sayiH(x.mesaiSaat), sayiH(x.tatilGun), sayiH(x.tatilSaat), sayiH(x.pazar)] }));
    satirlar.push({ hucreler: [metin(''), ...gunler.map(() => metin('')), ...Array(10).fill(metin(''))] });
    satirlar.push({ hucreler: [metin('Açıklama', 'sol'), metin('+ işte · sayı: fazla mesai saati · S rapor · Yİ yıllık izin · İ izinli/mazeret · G gelmedi · Ç hafta sonu/tatil çalıştı (saat) · HT hafta tatili · RT resmî tatil', 'sol')] });
    satirlar.push({ hucreler: [metin('Onay', 'sol'), metin(o ? `${o._degistiren} · ${NT.c.zamanYaz(o._degisim)}${o.notlar ? ' · ' + o.notlar : ''}` : 'Onaylanmadı', 'sol')] });
    for (const i of Y.istisnalar(d).filter((i) => i.notlar && i.bas <= gunler[gunler.length - 1] && (i.bit || i.bas) >= gunler[0]).sort((a, x) => (a.bas < x.bas ? -1 : 1))) {
      satirlar.push({ hucreler: [metin(kisiAdi(i.kisi), 'sol'), metin(`${aralik(i)} · ${Y.tur(i.tur).ad}: ${i.notlar}`, 'sol')] });
    }
    K.excel(`yoklama-${ay}.xlsx`, {
      sayfa: Y.ayAdi(ay),
      sutunlar: [{ genislik: 20 }, ...gunler.map(() => ({ genislik: 4.6 })), ...[8, 8, 7, 8, 8, 8, 10, 9, 9, 9].map((genislik) => ({ genislik }))],
      baslik: ['Personel', ...gunler.map((t) => `${+t.slice(8)} ${Y.gunKisa(t)}`), 'İş günü', 'Çalıştı', 'Rapor', 'Yıllık izin', 'Mazeret', 'Gelmedi', 'F. mesai (sa)', 'HS/RT gün', 'HS/RT saat', 'Pazar'],
      satirlar,
    });
  }

  /* ---------------- Arama ---------------- */
  function arama(d, q) {
    const l = [];
    for (const k of Y.kisiler(d, { hepsi: true })) if (ara(k.ad, q)) l.push({ tur: 'Personel', ad: k.ad, ek: '', fn: () => K.ac(KisiPenceresi, { kayit: k }) });
    for (const i of Y.istisnalar(d)) if (ara(`${kisiAdi(i.kisi)} ${Y.tur(i.tur).ad} ${i.notlar || ''}`, q)) l.push({ tur: Y.tur(i.tur).ad, ad: kisiAdi(i.kisi), ek: aralik(i), fn: () => kayitAc(i) });
    return l;
  }

  NT.yoklamaUI = { IstisnaPenceresi, KisiPenceresi, OnayPenceresi };
  K.calistir({
    sekmeler: [
      { id: 'genel', ad: 'Bugün', ikon: 'ozet' },
      { id: 'cizelge', ad: 'Aylık çizelge', ikon: 'takvim', sayac: (d) => { const g = Y.ayKaydir(bugun().slice(0, 7), -1); return Y.ayOzet(d, g).length && (!Y.onay(d, g) || Y.onaydanSonraDegisen(d, g).length) ? 1 : 0; } },
      { id: 'kayitlar', ad: 'Kayıtlar', ikon: 'liste' },
      { id: 'personel', ad: 'Personel', ikon: 'kisi' },
      { id: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
    ],
    sayfalar: { genel: GenelBakis, cizelge: Cizelge, kayitlar: Kayitlar, personel: Personel, ayarlar: Ayarlar },
    eylemler: [
      { ad: 'Kayıt gir', alt: 'İzin, rapor, gelmedi, fazla mesai', ikon: 'arti', tus: 'K', fn: () => yeniKayit({}) },
      { ad: 'Fazla mesai', alt: 'Bugün için fazla mesai saati', ikon: 'saat', tus: 'M', fn: () => yeniKayit({ tur: T.isGunu(bugun()) ? 'mesai' : 'tatil' }) },
    ],
    arama,
    uzakKoleksiyonlar: ['istisna', 'kisi', 'onay'],
  });
})();
