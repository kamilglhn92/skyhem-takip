/* Numune modül tanımı: sunucu boşsa varsayılan ürün/ambalaj tanımlarını bir kez yazar (eskiden numune.html'deydi). */
window.NT_MODUL = Object.assign(window.NT_MODUL || {}, {
  id: 'numune',
  ilkKurulum: (d) => (d.kayitlar('urun').length ? null : window.NT.hesap.varsayilanlariYaz(d)),
});
