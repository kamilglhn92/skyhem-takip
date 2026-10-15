/* Gerçek, okunabilir Code 128-B barkod (SVG). El tipi barkod okuyucu ile arama kutusuna okutulabilir. */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});
  const DESENLER = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
  ];
  const BASLA_B = 104;
  const DUR = 106;

  function kodla(metin) {
    const kodlar = [BASLA_B];
    for (const ch of String(metin)) {
      const c = ch.charCodeAt(0);
      kodlar.push(c >= 32 && c <= 127 ? c - 32 : 31 /* ? */);
    }
    let toplam = kodlar[0];
    for (let i = 1; i < kodlar.length; i++) toplam += kodlar[i] * i;
    kodlar.push(toplam % 103, DUR);
    return kodlar;
  }

  /* Türkçe harfleri ASCII karşılığına çevirerek güvenli barkod metni üretir. */
  function asciiYap(s) {
    return String(s).replace(/[çğıöşüÇĞİÖŞÜ]/g, (h) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' })[h]);
  }

  function svg(metin, { yukseklik = 40, modul = 1 } = {}) {
    const kodlar = kodla(asciiYap(metin));
    let x = 10 * modul;
    const cubuklar = [];
    for (const k of kodlar) {
      const d = DESENLER[k];
      for (let i = 0; i < d.length; i++) {
        const w = +d[i] * modul;
        if (i % 2 === 0) cubuklar.push(`<rect x="${x}" y="0" width="${w}" height="${yukseklik}"/>`);
        x += w;
      }
    }
    const genislik = x + 10 * modul;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${genislik} ${yukseklik}" width="${genislik}" height="${yukseklik}" shape-rendering="crispEdges" role="img" aria-label="Barkod ${metin}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${cubuklar.join('')}</g></svg>`;
  }

  NT.barkod = { svg, kodla, asciiYap };
})(typeof window !== 'undefined' ? window : globalThis);
