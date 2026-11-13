/* Numune modül tanımı: sunucu boşsa varsayılan ürün/ambalaj tanımlarını bir kez yazar (eskiden numune.html'deydi). */
window.NT_MODUL = Object.assign(window.NT_MODUL || {}, {
  id: 'numune',
  ilkKurulum: (d) => (d.kayitlar('urun').length ? null : window.NT.hesap.varsayilanlariYaz(d)),
});
window.NT = window.NT || {};
window.NT.numunePersonel = (() => {
  const q = new URLSearchParams(location.search);
  return q.has('demo') && (q.get('gorunum') === 'personel' ||
    /^(ahmet|ali|hasan|mehmet)(\s|$)/i.test((q.get('kullanici') || '').trim()));
})();
