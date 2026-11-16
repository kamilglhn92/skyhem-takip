/* Üretim — sunum modu (?demo). Değerler ve kişi adları UYDURMADIR (bu dosya herkese açık depoda yayınlanır);
   gerçek parti kayıtları canlı tabloya taranarak girilir. Örnek kayıtlar aynı tarayıcıdaki görünümlerde paylaşılır. */
(function () {
  'use strict';
  const NT = window.NT;
  const { bugun, gunEkle } = NT.c;
  const K = NT.kabuk;
  const U = NT.uretim;

  /* Tekrarlanabilir küçük oynamalar (her açılışta aynı eğri). */
  let tohum = 7;
  const rnd = () => { tohum = (tohum * 16807) % 2147483647; return (tohum - 1) / 2147483646; };
  const oyna = (n, a) => Math.round((n + (rnd() - 0.5) * 2 * a) * 10) / 10;
  const EKIP = ['Ahmet Kaya', 'Mehmet Demir', 'Hasan Çelik', 'Ali Şahin'];

  /* FR-011 1/2: yükleme 19:40, sonra saatlik ölçümler; reaktör ısınır, ağırlık su çıktıkça azalır. */
  function reaksiyon(baslangicKg, sapma = 0) {
    const l = [{ saat: '19:40', reaktorT: 18, yagT: 190, agirlik: 38, aciklama: 'Reaktör yükleme işlemi başladı.' },
      { saat: '21:25', reaktorT: 104, yagT: 135, agirlik: baslangicKg, aciklama: 'Reaktör yükleme işlemi bitti.' }];
    const saatler = U.saatler('22:30', '16:30', 60);
    let t = 104, w = baslangicKg;
    saatler.forEach((saat, i) => {
      t = Math.min(232 + sapma, t + (i < 6 ? 22 : i < 9 ? 6 : 0.4));
      w = Math.round(w - (i < 4 ? 8 : i < 12 ? 32 : 12) - rnd() * 6);
      l.push({ saat, reaktorT: Math.round(oyna(t, i < 6 ? 6 : 1.5)), yagT: Math.round(oyna(t - 10 + (i < 6 ? -40 : 0), 4)), agirlik: w,
        aciklama: i === 0 ? 'Reaktör sıcaklığı ve rutin kontroller.' : i === 3 ? 'Köpürme azaldı, karıştırıcı normal.' : '' });
    });
    l[l.length - 2].aciklama = '155 °C’de vakum açıldı.';
    l[l.length - 1].aciklama = 'Sirkülasyon pompası çalışıyor.';
    return l;
  }
  function sogutma() {
    let t = 186;
    return U.saatler('16:50', '11:50', 120).map((saat, i) => {
      t = Math.max(88, t - (i < 4 ? 16 : 9));
      return { saat, e2T: Math.round(oyna(t, 3)), suT: Math.round(oyna(i < 4 ? 11 : 20, 1)), h4: oyna(i < 3 ? 0.5 : 0.3, 0.05), aciklama: i === 0 ? 'Soğutma işlemi başladı.' : '' };
    });
  }
  function proses(gece) {
    const saatler = gece ? U.saatler('20:30', '08:00', 30) : U.saatler('08:30', '20:00', 30);
    return saatler.map((saat, i) => {
      if (!gece && (i < 1 || i > 16)) return { saat };
      const giris = Math.round(oyna(233, 3));
      return { saat, kazanT: Math.round(oyna(72, 3)), kazanP: oyna(1.6, 0.2), yagPGiris: 3, yagPCikis: 3, yagTGiris: giris, yagTCikis: giris + Math.round(oyna(3, 2)),
        genlesme: Math.round(oyna(75, 3)), baca: Math.round(oyna(232, 25)), icIso: '', disIso: '', aciklama: '' };
    });
  }

  const depoAc = K.demoTanimla(async (d, { kim, kaydet }) => {
    const bg = bugun();
    const g = (n) => gunEkle(bg, n);
    let sira = 0;
    const no = (t) => `UR-${t.slice(0, 4)}-${String(++sira).padStart(4, '0')}`;
    const kayit = async (tarih, v, durum = 'kontrol', kimIsledi = EKIP[sira % 4]) => {
      kim(kimIsledi);
      const id = NT.c.uid();
      await kaydet([{ c: 'kayit', k: id, v: { no: no(tarih), tarih, tarama: [], durum: durum === 'taslak' ? 'taslak' : 'islendi', isleyen: durum === 'taslak' ? '' : kimIsledi, ...v } }], tarih);
      if (durum === 'kontrol') { kim('Kamil Gülhan'); await kaydet([{ c: 'kayit', k: id, v: { durum: 'kontrol', kontrol: { kim: 'Kamil Gülhan', tarih: gunEkle(tarih, 1) } } }], gunEkle(tarih, 1)); }
      return id;
    };

    const partiler = [['Batch #20', -21, 4320, 0, 'kontrol'], ['Batch #21', -12, 4265, 1, 'kontrol'], ['Batch #22', -4, 4410, 12, 'islendi']];
    for (const [parti, gun, kg, sapma, durum] of partiler) {
      const t = g(gun);
      const yarin = gunEkle(t, 1);
      const ozet = reaksiyon(kg, sapma);
      const son = ozet[ozet.length - 1];
      await kayit(t, { form: 'FR-011-1', parti, alanlar: { parti, urun: 'Ecosky 3103', recete: String(20 + U.partiNo(parti) - 18), tarih: t, miktar: kg - 2 * U.partiNo(parti), reaktor: 'P1', calismaT: 245, aktarmaT: 205, isotankT: 80,
        asit: oyna(6.4, 0.6), viskozite: Math.round(oyna(310, 20)), scada: durum === 'kontrol' ? 'Evet' : 'Hayır' },
        tablolar: { olcum: ozet, son: [{ asit: oyna(6.1, 0.5), viskozite: Math.round(oyna(305, 15)), sonuc: 'Uygun' }] }, ornekTarama: true }, durum);
      await kayit(yarin, { form: 'FR-011-2', parti, alanlar: { parti, sevkIsotank: `TSKU ${2041000 + U.partiNo(parti) * 37}`, notGunduz: '', notGece: 'İç isotanktaki CTO bitti.' },
        tablolar: { sogutma: sogutma(), hammadde: [{ miktar: Math.round(kg * 0.91), isotank: `TSKU ${2040000 + U.partiNo(parti) * 11}` }, { miktar: Math.round(kg * 0.093), isotank: '' }],
          aktarma: [{ bas: '19:40', bit: '20:40', aciklama: 'İsotank bitirildi.' }, { bas: '20:50', bit: '21:20' }, { bas: '11:40', bit: '13:30' }, { bas: '14:20', bit: '16:00' }],
          ekip: [{ ad: EKIP[0], gorev: 'Operatör', vardiya: 'Gece' }, { ad: EKIP[1], gorev: 'Operatör', vardiya: 'Gündüz' }, { ad: EKIP[2], gorev: 'Teknik bakım', vardiya: 'Gündüz' }] }, ornekTarama: true }, durum);
      await kayit(t, { form: 'FR-035-N', parti, alanlar: { parti, tarih: t, urun: 'Ecosky 3103' }, tablolar: { olcum: proses(true) }, ornekTarama: true }, durum);
      if (durum !== 'islendi') await kayit(yarin, { form: 'FR-035-G', parti, alanlar: { parti, tarih: yarin, urun: 'Ecosky 3103' }, tablolar: { olcum: proses(false) }, ornekTarama: true }, durum);
      void son;
    }
    // Batch #22'de bir değer sınır dışı (kontrolde yakalansın diye): reaktör 266 °C.
    const b22 = d.kayitlar('kayit').find((k) => k.parti === 'Batch #22' && k.form === 'FR-011-1');
    kim('Mehmet Demir');
    await kaydet([{ c: 'kayit', k: b22.id, v: { tablolar: { ...b22.tablolar, olcum: b22.tablolar.olcum.map((s, i) => (i === 9 ? { ...s, reaktorT: 266, aciklama: 'Kısa süreli yükselme, yağ vanası kısıldı.' } : s)) } } }], g(-3)); // ertesi gün: kayıttan sonra sıralansın

    // Batch #23: dün başladı; FR-011 1/2 tarandı, henüz işlenmedi (işleme ekranını göstermek için).
    const b23 = reaksiyon(4380, 2);
    await kayit(g(-1), { form: 'FR-011-1', parti: 'Batch #23', alanlar: {}, tablolar: {}, ornekTarama: true,
      ornekDegerler: { alanlar: { parti: 'Batch #23', urun: 'Ecosky 3103', recete: '25', tarih: g(-1), miktar: 4361, reaktor: 'P1', calismaT: 245, aktarmaT: 205, isotankT: 80 }, tablolar: { olcum: b23.slice(0, 14) } } }, 'taslak', 'Ahmet Kaya');

    // FR-005: üç isotank kabulü; birinde su içeriği sınır dışı.
    const hammadde = [[-24, 'TSKU 2041120', 102.8, 1.1, 'Kabul', 'Kontrol uygun.'], [-15, 'TSKU 2041177', 99.3, 0.8, 'Kabul', ''], [-6, 'TSKU 2041203', 96.1, 2.4, 'Şartlı kabul', 'Su içeriği COA’da 2,4; laboratuvara numune verildi.']];
    for (const [gun, isotank, asit, su, karar, not] of hammadde) {
      await kayit(g(gun), { form: 'FR-005', parti: '', alanlar: { tarih: g(gun), tedarikci: 'Örnek Tedarik A.Ş.', coa: `CERT-${String(100 - gun).padStart(3, '0')}`, isotank, muhur: `M-${4400 - gun}`, lot: `L${2600 - gun}`, plaka: '34 ABC 123', vardiya: 'Gündüz', karar, not },
        tablolar: { gorsel: [{ sonuc: '✓' }, { sonuc: '✓' }, { sonuc: su > 2 ? '✗' : '✓', aciklama: su > 2 ? 'Yüzeyde ince su tabakası' : '' }, { sonuc: '✓' }, { sonuc: '✓' }],
          coa: [{ deger: 968 }, { deger: asit }, { deger: su }, { deger: 104 }, { deger: 24.6 }, { deger: 0.12 }, {}, {}] } }, gun < -10 ? 'kontrol' : 'islendi');
    }

    // FR-032: vardiya devirleri; son devirde chiller anormal.
    for (const [gun, vardiya, chiller] of [[-3, 'Gündüz → Gece', 'N'], [-2, 'Gece → Gündüz', 'N'], [-1, 'Gündüz → Gece', 'A']]) {
      const ekipman = U.FORMLAR['FR-032'].tablolar[1].satirlar.map((s) => ({ durum: s.ekipman === 'Chiller' ? chiller : s.ekipman === 'H5 pompa' ? 'K' : 'N', aciklama: s.ekipman === 'Chiller' && chiller === 'A' ? 'Basma tarafında titreşim' : s.ekipman === 'H5 pompa' ? 'Yedekte' : '' }));
      await kayit(g(gun), { form: 'FR-032', parti: '', alanlar: { tarih: g(gun), vardiya, devreden: EKIP[(gun + 4) % 4], devralan: EKIP[(gun + 5) % 4], notGunduz: '', notGece: gun === -1 ? 'Chiller titreşimi teknik bakıma bildirildi.' : '' },
        tablolar: { reaktor: [{ parti: 'Batch #23', asama: gun === -1 ? 'Isıtma' : 'Hazırlık', sicaklik: gun === -1 ? 180 : '' }, { parti: '', asama: 'Boş' }, { parti: '', asama: 'Boş' }], ekipman,
          ariza: chiller === 'A' ? [{ tanim: 'Chiller titreşim', ekipman: 'Chiller', baslangic: g(gun), durum: 'Teknik bakım inceliyor' }] : [] } }, gun < -2 ? 'kontrol' : 'islendi');
    }
  }, { paylas: true });

  NT.uretimDemo = { depoAc: (kullanici) => depoAc('uretim', kullanici) };
})();
