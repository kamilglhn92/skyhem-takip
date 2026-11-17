/* Numune modül tanımı: sunucu boşsa varsayılan ürün/ambalaj tanımlarını bir kez yazar (eskiden numune.html'deydi). */
window.NT_MODUL = Object.assign(window.NT_MODUL || {}, {
  id: 'numune',
  ilkKurulum: (d) => (d.kayitlar('urun').length ? null : window.NT.hesap.varsayilanlariYaz(d)),
});
window.NT = window.NT || {};
/* Personel görünümü: sunumda ?gorunum=personel ya da personel adı; canlıda personel rolü (mimar değil) ya da ?gorunum=personel.
   Bu dosya ortak/cekirdek.js'ten önce yüklendiği için değer ilk okunduğunda hesaplanır. */
(function () {
  let deger;
  Object.defineProperty(window.NT, 'numunePersonel', {
    configurable: true,
    get() {
      if (deger === undefined) {
        const NT = window.NT;
        const q = new URLSearchParams(location.search);
        deger = NT.c && NT.c.personelGorunumu ? NT.c.personelGorunumu()
          : q.has('demo') && (q.get('gorunum') === 'personel' || /^(ahmet|ali|hasan|mehmet)(\s|$)/i.test((q.get('kullanici') || '').trim()));
      }
      return deger;
    },
  });
})();
