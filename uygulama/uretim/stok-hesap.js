/* Üretim stoku. Kaynaklar ve numaralı IBC'ler ortak hareket defterinden hesaplanır. */
(function (root) {
  'use strict';
  const NT = (root.NT = root.NT || {});
  const konumlar = ['Üretim sahası', 'Depo-1', 'Depo-2'];
  const limit = 8000000;
  const cinsler = { cto: 'CTO', gliserin: 'Gliserin', urun: 'Son ürün' };
  const urunler = ['Ecosky 3103', 'Ecosky 2108', 'Ecophalt', 'Ecotall'];
  const kod = (v) => String(v ?? '').trim().toUpperCase().replace(/İ/g, 'I');
  const tankId = (v) => 'ISO:' + kod(v).replace(/\s+/g, '');
  const uretimId = (urun, parti) => 'URETIM:' + kod(urun) + '|' + kod(parti);
  const toplam = (liste) => liste.reduce((t, x) => t + x.gram, 0);
  const pozitif = (v) => Number.isSafeInteger(v) && v > 0 && v <= 1000000000;
  function gram(v) {
    const s = String(v ?? '').trim().replace(',', '.');
    return /^\d+(?:\.\d{1,3})?$/.test(s) ? Math.round(Number(s) * 1000) : 0;
  }
  function seri(ilkNo, adet, ortakGram) {
    const m = /^(.*?)(\d+)$/.exec(kod(ilkNo));
    if (!m || !Number.isSafeInteger(adet) || adet < 1 || adet > 100) return [];
    const [, onek, rakam] = m;
    const bas = BigInt(rakam);
    return Array.from({ length: adet }, (_, i) => ({
      no: onek + String(bas + BigInt(i)).padStart(rakam.length, '0'), kg: pozitif(ortakGram) ? String(ortakGram / 1000) : '',
    }));
  }

  const bosId = (tur, no) => tur === 'İsotank' ? tankId(no) : tur + ':' + kod(no);

  function hesapla(depo) {
    const kaynaklar = new Map();
    const ibcler = new Map();
    const bos = new Map();
    const eskiNumaralar = new Map();
    function bosAdetEkle(ambalaj, konum, fark) {
      const id = ambalaj + ":" + konum;
      const adet = (bos.get(id)?.adet || 0) + fark;
      if (adet === 0) bos.delete(id);
      else bos.set(id, {ambalaj, konum, adet});
    }
    const hareketler = [...depo.kayitlar('stok'), ...depo.kayitlar('bosAmbalaj')].sort((a, b) => a._olusturma - b._olusturma);
    function giris(h, id, yer, tur) {
      let k = kaynaklar.get(id);
      if (!k?.gram) {
        k = { id, yer, tur, cins: h.cins, urun: h.urun, gram: 0, partiler: new Map() };
        kaynaklar.set(id, k);
      }
      k.konum = h.konum || k.konum || '';
      k.gram += h.gram;
      const partiler = h.partiler?.length ? h.partiler : [h.parti];
      for (const parti of partiler) {
        const onceki = k.partiler.get(parti);
        k.partiler.set(parti, onceki === null || partiler.length > 1 ? null : (onceki || 0) + h.gram);
      }
    }
    for (const h of hareketler) {
      if (h.tip === 'bos_giris') {
        if (h.ambalaj === 'İsotank') {
          for (const no of h.numaralar) bos.set(tankId(no), { no, ambalaj: h.ambalaj, konum: h.konum || '', adet: 1 });
        } else if (h.adet != null) bosAdetEkle(h.ambalaj, h.konum, h.adet);
        else for (const no of h.numaralar) eskiNumaralar.set(bosId(h.ambalaj,no), {ambalaj:h.ambalaj, konum:h.konum || ''});
        continue;
      }
      if ((h.tip === 'giris' && h.tur === 'isotank') || h.tip === 'aktar') bos.delete(bosId('İsotank', h.yer));
      if (h.tip === 'giris') { giris(h, h.kaynak, h.yer, h.tur); continue; }
      const k = kaynaklar.get(h.kaynak);
      if (h.tip === 'aktar') {
        k.gram -= h.gram;
        giris({ ...h, cins: k.cins, urun: k.urun, parti: k.partiler.keys().next().value }, h.hedef, h.yer, 'isotank');
      } else if (h.tip === 'tuketim' || h.tip === 'dolum' || h.tip === 'acilis_ibc') {
        if (k) k.gram -= h.gram;
        if (h.tip === 'dolum' && h.bosKonum != null) bosAdetEkle(h.ambalaj || 'IBC', h.bosKonum, -h.ibcler.length);
        if (h.tip !== 'tuketim') for (const i of h.ibcler) {
          const eskiId = bosId(h.ambalaj || 'IBC', i.no);
          const oncekiKonum = eskiNumaralar.get(eskiId)?.konum;
          if (h.bosKonum == null && h.bosStoktanDus !== false) eskiNumaralar.delete(eskiId);
          ibcler.set(i.no, { ...i, konum: h.konum || oncekiKonum || '', ambalaj: h.ambalaj || 'IBC', urun: k?.urun || h.urun, kaynak: k?.yer || '', kaynakTur: k?.tur || 'acilis',
            partiler: k ? [...k.partiler.keys()] : h.partiler,
            tarih: h.tarih, durum: h.siparis ? 'ayrildi' : 'serbest', siparis: h.siparis || '' });
        }
      } else for (const no of h.numaralar) {
        const i = ibcler.get(no);
        i.durum = h.tip === 'sevk' ? 'sevk' : h.tip === 'ayir' ? 'ayrildi' : 'serbest';
        if (h.tip === 'ayir') i.siparis = h.siparis;
        if (h.tip === 'birak') i.siparis = '';
        if (h.tip === 'sevk') i.sevk = h.siparis;
      }
    }
    for (const x of eskiNumaralar.values()) bosAdetEkle(x.ambalaj, x.konum, 1);
    for (const k of kaynaklar.values()) {
      if (k.tur === 'isotank' && k.gram === 0) bos.set(bosId('İsotank', k.yer), { no: k.yer, ambalaj: 'İsotank', adet: 1, konum: k.konum });
    }
    return { kaynaklar, ibcler, hareketler, bos };
  }

  function dogrula(s, h) {
    const k = s.kaynaklar.get(h.kaynak);
    if (!/^\d{4}-\d\d-\d\d$/.test(h.tarih)) return 'Fiili tarihi girin.';
    if (h.tip === 'bos_giris') {
      if (['Varil', 'IBC'].includes(h.ambalaj)) {
        return konumlar.includes(h.konum) && Number.isSafeInteger(h.adet) && h.adet > 0 && h.adet <= 2147483647 && !h.numaralar
          ? '' : 'Boş ambalaj adedini ve konumunu kontrol edin.';
      }
      if (h.ambalaj !== 'İsotank' || !h.numaralar?.length || h.numaralar.length > 100 ||
        h.numaralar.some((no) => !no || no.length > 40)) return 'Ambalaj numaralarını kontrol edin.';
      const kimlikler = h.numaralar.map(tankId);
      if (new Set(kimlikler).size !== kimlikler.length || kimlikler.some((id) => s.bos.has(id))) return 'Bu ambalaj zaten boş stokta.';
      if (kimlikler.some((id) => s.kaynaklar.get(id)?.gram > 0)) return 'Bu numara dolu stokta.';
    }
    if (h.tip === 'giris') {
      if (!h.yer || !h.parti || !h.urun || !pozitif(h.gram)) return 'Kaynağı, partiyi ve net kg değerini girin.';
      if (h.partiler?.length > 1 && (!h.acilis || h.tur !== 'isotank' || h.cins !== 'urun')) return 'Birden fazla batch yalnız son ürün isotankı açılışında girilebilir.';
      if (k?.gram && (k.cins !== h.cins || kod(k.urun) !== kod(h.urun))) return 'Bu isotankta başka bir malzeme veya ürünün bakiyesi var.';
      if (h.cins === 'urun') {
        const onceki = s.hareketler.filter((x) => x.tip === 'giris' && x.cins === 'urun' && !x.acilis && kod(x.urun) === kod(h.urun) && kod(x.parti) === kod(h.parti));
        if (!h.acilis && toplam(onceki) + h.gram > limit) return 'Bir üretim batch’i için toplam giriş 8.000 kg’ı aşamaz.';
      }
    }
    if (['aktar', 'tuketim', 'dolum'].includes(h.tip)) {
      if (!k || !pozitif(h.gram) || h.gram > k.gram) return 'Net kg değerini ve kaynak bakiyesini kontrol edin.';
      if (h.tip === 'tuketim' && (k.cins === 'urun' || !h.parti)) return 'Tüketim için hammadde ve üretim batch’i seçin.';
      if (h.tip === 'aktar') {
        const hedef = s.kaynaklar.get(h.hedef);
        if (k.tur !== 'uretim' || !h.yer || h.kaynak === h.hedef) return 'Üretim batch’ini ve hedef isotank numarasını girin.';
        if (hedef?.gram && (hedef.cins !== k.cins || kod(hedef.urun) !== kod(k.urun))) return 'Bu isotankta başka bir malzeme veya ürünün bakiyesi var.';
      }
    }
    if (h.tip === 'dolum' && (s.bos.get((h.ambalaj || 'IBC') + ':' + h.bosKonum)?.adet || 0) < h.ibcler.length) {
      return 'Seçilen konumda yeterli boş ambalaj yok.';
    }
    if (h.tip === 'acilis_ibc' && (!h.urun || !h.partiler.length || h.partiler.length > 25)) return 'Ürün ve batch listesini girin.';
    if (h.tip === 'dolum' || h.tip === 'acilis_ibc') {
      if (h.ambalaj && !['IBC', 'Varil'].includes(h.ambalaj)) return 'Ambalaj türünü seçin.';
      if ((h.tip === 'dolum' && k.cins !== 'urun') || !pozitif(h.gram) || toplam(h.ibcler) !== h.gram
        || !h.ibcler.length || h.ibcler.length > 100 || h.ibcler.some((i) => !i.no || i.no.length > 40 || !pozitif(i.gram))) {
        return 'Her ambalaj için numara ve sıfırdan büyük net kg girin.';
      }
      if (new Set(h.ibcler.map((i) => i.no)).size !== h.ibcler.length || h.ibcler.some((i) => {
        const onceki = s.ibcler.get(i.no);
        return onceki && onceki.durum !== 'sevk';
      })) return 'Bir ambalaj numarası tekrarlanıyor veya dolu stokta zaten var.';
    }
    if (['ayir', 'birak', 'sevk'].includes(h.tip)) {
      const beklenen = h.tip === 'ayir' ? 'serbest' : 'ayrildi';
      if (!h.numaralar.length || h.numaralar.some((no) => s.ibcler.get(no)?.durum !== beklenen)) return 'Ambalaj seçimini güncel stoktan kontrol edin.';
      if (h.tip !== 'birak' && !h.siparis) return 'Sipariş veya sevkiyat numarasını girin.';
      if (h.tip === 'sevk' && new Set(h.numaralar.map((no) => s.ibcler.get(no).siparis)).size > 1) {
        return 'Sevkiyat için aynı siparişe ayrılan ambalajları seçin.';
      }
    }
    return '';
  }
  NT.uretimStoku = { konumlar, cinsler, urunler, kod, tankId, uretimId, gram, seri, toplam, hesapla, dogrula };
})(typeof window !== 'undefined' ? window : globalThis);
