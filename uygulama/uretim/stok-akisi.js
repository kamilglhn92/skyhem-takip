/* Satış kaydı, hazırlama emri ve fiziksel ambalajlar aynı sipariş anahtarıyla izlenir. */
(function () {
  'use strict';
  const NT = window.NT, S = NT.uretimStoku;
  const kod = S.kod;
  const bag = (id) => 'EMIR/' + id;
  const gruplar = (k) => (k.karisim?.length ? k.karisim.map((p) => p.parti) : k.parti ? [k.parti] : []).map(kod).sort();
  const eslesir = (k, urun, partiler) => kod(k.urun) === kod(urun) && (!gruplar(k).length ||
    JSON.stringify(gruplar(k)) === JSON.stringify([...partiler].map(kod).sort()));
  const destekler = (s) => s.kalemler?.length === 1 && ['IBC','Varil'].includes(s.kalemler[0].ambalaj) &&
    Number.isInteger(+s.kalemler[0].adet) && +s.kalemler[0].adet >= 1 && +s.kalemler[0].adet <= 100;
  const emirler = (d) => d.kayitlar('dolumEmri').filter((e) => e.tip === 'plan' &&
    !d.kayitlar('dolumEmri').some((x) => x.tip === 'iptal' && x.satis === e.satis) &&
    !d.kayitlar('stok').some((x) => x.emir === e.satis && x.tip === 'dolum') && e.eksik > 0);
  function planla(d,s,p) {
    if (!destekler(s) || s.iptal || !['Sipariş','Hazırlanıyor'].includes(s.durum)) throw Error('Sipariş hazırlamaya uygun değil.');
    const k = s.kalemler[0], stok = S.hesapla(d);
    const eksik = +k.adet - p.hazir.length, tank = stok.kaynaklar.get(p.kaynak);
    if (eksik < 0 || new Set(p.hazir).size !== p.hazir.length || p.hazir.some((no) => {
      const i = stok.ibcler.get(no);
      return !i || i.durum !== 'serbest' || i.ambalaj !== k.ambalaj || !eslesir(k,i.urun,i.partiler);
    })) throw Error('Seçilen ambalajlar siparişle uyuşmuyor.');
    if (eksik && (!tank?.gram || tank.tur !== 'isotank' || !eslesir(k,tank.urun,tank.partiler.keys()))) throw Error('Siparişe uygun dolu isotank seçin.');
    return {tip:'plan', satis:s.id, no:s.no, kaynak:p.kaynak, urun:k.urun, ambalaj:k.ambalaj, adet:+k.adet, eksik, hazir:p.hazir, partiler:gruplar(k)};
  }
  function dolumKontrol(d,h) {
    const e = emirler(d).find((x) => x.satis === h.emir);
    const tank = S.hesapla(d).kaynaklar.get(h.kaynak);
    if (!e || e.kaynak !== h.kaynak || h.ambalaj !== e.ambalaj || h.ibcler.length !== e.eksik || h.siparis !== bag(e.satis) ||
      !tank || !eslesir({urun:e.urun,karisim:e.partiler.map((parti) => ({parti}))},tank.urun,tank.partiler.keys())) throw Error('Dolum emrindeki kaynak, ürün ve ambalaj adedini kontrol edin.');
  }
  async function depoAc() {
    const b = NT.baglanti;
    if (b.mod !== 'demo') {
      const d = b.depoOlustur('uretimstok',b.kod,b.kullanici);
      await d.tara();
      if (!d.cevrimici) throw Error('İşlem için sunucu bağlantısı gerekir.');
      return d;
    }
    const isim = new URLSearchParams(location.search).get('ornek') === 'yogun' ? 'uretimstok-yogun' : 'uretimstok';
    const d = new NT.SunumDepo(isim,b.kullanici);
    await d.tara();
    return d;
  }
  function sunumHareketleri(d,s,v) {
    const h = (tip,alanlar,c='stok') => ({c,k:NT.c.uid(16),v:{tip,tarih:NT.c.bugun(),...alanlar}});
    if (v.stokPlan && !s.stokPlan) {
      const e = planla(d,s,v.stokPlan);
      return [h('plan',e,'dolumEmri'), ...(e.hazir.length ? [h('ayir',{siparis:bag(s.id),numaralar:e.hazir})] : [])];
    }
    if (!s.stokPlan) return [];
    const sonraki = {...s,...v}, k = s.kalemler[0], yeni = sonraki.kalemler[0];
    if (!destekler(sonraki) || kod(yeni.urun)!==kod(k.urun) || yeni.ambalaj!==k.ambalaj || yeni.adet!==k.adet || JSON.stringify(gruplar(yeni))!==JSON.stringify(gruplar(k))) throw Error('Bağlı siparişin ürün ve ambalaj bilgileri değiştirilemez.');
    const gitti = ['Yolda','Teslim edildi'].includes(s.durum), cikis = ['Yolda','Teslim edildi'].includes(sonraki.durum);
    if (gitti && NT.satis.kalemNet(k)!==NT.satis.kalemNet(yeni)) throw Error('Sevk net kg ile seçilen ambalajların toplamı uyuşmuyor.');
    if ((gitti && (!cikis || sonraki.iptal)) || (s.iptal && !sonraki.iptal)) throw Error('Bu stok işlemi geri alınamaz.');
    const stok = S.hesapla(d);
    const secim = [...stok.ibcler.values()].filter((i) => i.durum === 'ayrildi' && i.siparis === bag(s.id));
    const numaralar = secim.map((i) => i.no);
    if (sonraki.iptal && !s.iptal) return [h('iptal',{satis:s.id},'dolumEmri'), ...(numaralar.length ? [h('birak',{numaralar})] : [])];
    if (cikis && !gitti) {
      if (sonraki.iptal || numaralar.length !== +k.adet) throw Error('Dolum emri henüz tamamlanmadı.');
      if (S.toplam(secim) !== Math.round(NT.satis.kalemNet(yeni)*1000)) throw Error('Sevk net kg ile seçilen ambalajların toplamı uyuşmuyor.');
      return [h('sevk',{siparis:s.no,numaralar,gram:S.toplam(secim),tarih:sonraki.sevkTarihi || NT.c.bugun()})];
    }
    return [];
  }
  async function satisYaz(d,ops) {
    const op = ops.find((o) => o.c === 'sevk');
    if (!op) return d.kaydet(ops);
    const onceki = d.kayit('sevk',op.k);
    if (onceki?.stokTakip && !onceki.stokPlan && !op.v.stokPlan && ['Yolda','Teslim edildi'].includes(op.v.durum)) throw Error("Stok çıkışı için siparişi kaydedip Stoktan hazırla adımını tamamlayın.");
    if (!op.v.stokPlan && !onceki?.stokPlan) return d.kaydet(ops);
    if (NT.baglanti.mod !== 'demo') {
      await d.tara();
      if (!d.cevrimici || d.bekleyen.length) throw Error('İşlem için sunucu bağlantısı gerekir.');
      await d.rpc('satis_stok_kaydet',{hareketler:d.olayOlustur(ops)});
      await d.tara();
      return;
    }
    const stok = await depoAc();
    try {
      await navigator.locks.request(d.anahtar, () => navigator.locks.request(stok.anahtar, async () => {
        await Promise.all([d.tara(),stok.tara()]);
        const s = d.kayit('sevk',op.k);
        if (!s || (op.v.stokPlan && s.stokPlan)) throw Error('Sipariş zaten bağlı veya bulunamadı.');
        const se = d.olayOlustur(ops), he = stok.olayOlustur(sunumHareketleri(stok,s,op.v));
        await NT.idb.birlikteYaz([[d.anahtar,[...d.olaylar.values(),...se]],[stok.anahtar,[...stok.olaylar.values(),...he]]]);
        d.uygula(se); stok.uygula(he);
        d.kanal.postMessage('guncellendi'); stok.kanal.postMessage('guncellendi');
      }));
    } finally { stok.kapat(); }
  }
  NT.stokAkisi = { bag, destekler, eslesir, emirler, planla, dolumKontrol, depoAc, satisYaz };
})();