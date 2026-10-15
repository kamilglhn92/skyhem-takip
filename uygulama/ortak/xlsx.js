/*
 * Küçük .xlsx üretici (kütüphane ve internet gerektirmez).
 *
 * Neden: CSV'yi Excel kendi yorumluyordu — sample no'ların baştaki sıfırlarını silmeyi öneriyor,
 * tarihleri sayıya çeviriyor, biçim kayboluyordu. Burada hücre türü (metin / sayı / tarih) ve biçim
 * dosyada açıkça yazılır.
 *
 * Kullanım:
 *   NT.xlsx({ sayfa: 'SAMPLES', sutunlar: [{ genislik: 13, gizli: false }], baslik: ['№', ...],
 *             satirlar: [{ hucreler: [{ v, tur: 'metin'|'sayi'|'tarih'|'ondalik', hiza: 'orta'|'sol' }], cizili: false }],
 *             renkli: true, dondur: true, yakinlastir: 70 }) → Blob
 * Biçim Farukcan'ın !SAMPLES.xlsx şablonundan alınmıştır: başlık açık turuncu + kalın, veri açık yeşil,
 * ince kenarlık, ortalı ve satır kaydırmalı; iptal satırları üstü çizili.
 */
(function () {
  'use strict';
  const NT = window.NT;

  const kacis = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // XML'de geçersiz denetim karakterlerini at
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const kolonAdi = (i) => { let s = ''; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

  /* Hücre stilleri (cellXfs sırası):
     0 varsayılan · 1 başlık · 2 orta · 3 sol · 4 tarih · 5 ondalık · 6 metin(@) ; 7-11: 2-6'nın üstü çizili hâli
     12-16: 2-6'nın renksiz (renkli:false) hâli */
  function stiller() {
    const hiza = (h) => `<alignment horizontal="${h}" vertical="center" wrapText="1"/>`;
    const xf = (fmt, font, fill, h) => `<xf numFmtId="${fmt}" fontId="${font}" fillId="${fill}" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${hiza(h)}</xf>`;
    const veri = (font, fill) => [xf(0, font, fill, 'center'), xf(0, font, fill, 'left'), xf(165, font, fill, 'center'), xf(164, font, fill, 'center'), xf(49, font, fill, 'center')];
    const xfler = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', xf(0, 1, 3, 'center'), ...veri(0, 2), ...veri(2, 2), ...veri(0, 0)];
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.0"/><numFmt numFmtId="165" formatCode="dd.mm.yyyy"/></numFmts>
<fonts count="3"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><strike/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFBE5D6"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfler.length}">${xfler.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }

  /* 'YYYY-MM-DD' → Excel seri günü (1900 tarih sistemi) */
  function seriGun(t) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t || '');
    return m ? Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 864e5) : null;
  }

  function sayfaXml({ sutunlar, baslik, satirlar, renkli = true, dondur = true, yakinlastir = 85, baslikYukseklik = 44 }) {
    const TUR = { orta: 0, sol: 1, tarih: 2, ondalik: 3, metin: 4 };
    const hucreXml = (h, r, c, cizili) => {
      const ref = `${kolonAdi(c)}${r}`;
      const tur = h.tur || 'metin';
      let anahtar = tur === 'tarih' ? 'tarih' : tur === 'ondalik' ? 'ondalik' : tur === 'kod' ? 'metin' : h.hiza === 'sol' ? 'sol' : 'orta';
      const s = (renkli ? (cizili ? 7 : 2) : 12) + TUR[anahtar];
      const v = h.v;
      if (v === '' || v == null) return `<c r="${ref}" s="${s}"/>`;
      if (tur === 'tarih') {
        const n = seriGun(v);
        if (n != null) return `<c r="${ref}" s="${s}"><v>${n}</v></c>`;
        return `<c r="${ref}" s="${(renkli ? (cizili ? 7 : 2) : 12)}" t="inlineStr"><is><t xml:space="preserve">${kacis(v)}</t></is></c>`;
      }
      if ((tur === 'sayi' || tur === 'ondalik') && Number.isFinite(+v)) return `<c r="${ref}" s="${s}"><v>${+v}</v></c>`;
      return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${kacis(v)}</t></is></c>`;
    };
    const cols = sutunlar.map((s, i) => `<col min="${i + 1}" max="${i + 1}" width="${s.genislik || 12}"${s.gizli ? ' hidden="1"' : ''} customWidth="1"/>`).join('');
    const bas = `<row r="1" ht="${baslikYukseklik}" customHeight="1">${baslik.map((b, c) => `<c r="${kolonAdi(c)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${kacis(b)}</t></is></c>`).join('')}</row>`;
    const govde = satirlar.map((sat, i) => `<row r="${i + 2}">${sat.hucreler.map((h, c) => hucreXml(h, i + 2, c, sat.cizili)).join('')}</row>`).join('');
    const pane = dondur ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0" zoomScale="${yakinlastir}" zoomScaleNormal="${yakinlastir}">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="14.4"/><cols>${cols}</cols><sheetData>${bas}${govde}</sheetData>
<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape"/>
</worksheet>`;
  }

  /* ---- ZIP (sıkıştırmasız) ---- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(dosyalar) {
    const enc = new TextEncoder();
    const d = new Date();
    const saat = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const gun = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const parcalar = [], merkez = [];
    let ofset = 0;
    for (const [ad, icerik] of dosyalar) {
      const adB = enc.encode(ad), veri = enc.encode(icerik), crc = crc32(veri);
      const yerel = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, saat, 2], [12, gun, 2], [14, crc, 4], [18, veri.length, 4], [22, veri.length, 4], [26, adB.length, 2], [28, 0, 2]]
        .forEach(([o, v, n]) => (n === 4 ? yerel.setUint32(o, v, true) : yerel.setUint16(o, v, true)));
      const m = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, saat, 2], [14, gun, 2], [16, crc, 4], [20, veri.length, 4], [24, veri.length, 4], [28, adB.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, ofset, 4]]
        .forEach(([o, v, n]) => (n === 4 ? m.setUint32(o, v, true) : m.setUint16(o, v, true)));
      parcalar.push(yerel, adB, veri);
      merkez.push(m, adB);
      ofset += 30 + adB.length + veri.length;
    }
    const mBoyut = merkez.reduce((t, x) => t + x.byteLength, 0);
    const son = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, dosyalar.length, 2], [10, dosyalar.length, 2], [12, mBoyut, 4], [16, ofset, 4], [20, 0, 2]]
      .forEach(([o, v, n]) => (n === 4 ? son.setUint32(o, v, true) : son.setUint16(o, v, true)));
    return new Blob([...parcalar, ...merkez, son], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function xlsx(secenek) {
    const sayfa = kacis((secenek.sayfa || 'Sayfa1').slice(0, 31));
    return zip([
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sayfa}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', stiller()],
      ['xl/worksheets/sheet1.xml', sayfaXml(secenek)],
    ]);
  }

  NT.xlsx = xlsx;
})();
