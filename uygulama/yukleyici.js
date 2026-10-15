/*
 * SKYHEM Takip yükleyicisi — programın kendini güncellemesi.
 *
 * Bütün sistemler tek giriş dosyasından açılır: "SKYHEM Takip.html?modul=satis" gibi.
 * Hangi sayfanın hangi dosyalarla açılacağı sürüm listesindedir (uygulama/surum.js → window.NT_SURUM).
 *
 * Güncelleme: yeni sürümler Supabase'deki uygulama_surum / uygulama_dosya tablolarındadır (erişim koduyla yalnızca okunur).
 * Program açılınca önce bu bilgisayardaki en yeni sürümle hemen açılır (klasördeki ya da daha önce indirilmiş olan);
 * ardından arka planda yeni sürüm var mı bakar, varsa indirip saklar ve "güncellendi" şeridi gösterir.
 * İnternet yoksa saklı sürümle, o da yoksa klasördeki dosyalarla açılır.
 *
 * Bu dosya, giriş dosyası ve surum.js klasörde durur; buluttan güncellenmez. Diğer bütün dosyalar güncellenebilir.
 */
(function () {
  'use strict';
  var SUNUCU = 'https://ocwfhzngqzcsxojmiaqo.supabase.co';
  var ANAHTAR = 'sb_publishable_X8DEW9HdL9RIa5zM7bxZfw_m20QlMp-'; // herkese açık anahtar; asıl koruma erişim kodudur
  var yerel = window.NT_SURUM;
  var q = new URLSearchParams(location.search);
  var modul = q.get('modul') || 'portal';

  /* --- bu bilgisayardaki saklı sürüm (IndexedDB) --- */
  function idb() {
    return new Promise(function (ok, hata) {
      var r = indexedDB.open('skyhem-uygulama', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { hata(r.error); };
    });
  }
  function sakliAl() {
    return idb().then(function (db) {
      return new Promise(function (ok) {
        var r = db.transaction('kv').objectStore('kv').get('paket');
        r.onsuccess = function () { ok(r.result || null); };
        r.onerror = function () { ok(null); };
      });
    }).catch(function () { return null; });
  }
  function sakla(paket) {
    return idb().then(function (db) {
      return new Promise(function (ok, hata) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(paket, 'paket');
        tx.oncomplete = function () { ok(); };
        tx.onerror = function () { hata(tx.error); };
      });
    });
  }

  /* --- bulut --- */
  function istek(yol, kod) {
    var iptal = new AbortController();
    var z = setTimeout(function () { iptal.abort(); }, 15000);
    return fetch(SUNUCU + '/rest/v1/' + yol, { headers: { apikey: ANAHTAR, 'x-nt-kod': kod }, cache: 'no-store', signal: iptal.signal })
      .then(function (r) { if (!r.ok) throw new Error('Sunucu ' + r.status); return r.json(); })
      .finally(function () { clearTimeout(z); });
  }
  /* Bulutta daha yeni sürüm varsa indirir ve saklar; yoksa null. Yalnızca klasör sürümünden sonra değişen dosyalar indirilir. */
  function guncelle(kod, mevcut, kotu) {
    return istek('uygulama_surum?select=surum,sayfalar,notlar&order=surum.desc&limit=1', kod).then(function (l) {
      var s = l && l[0];
      if (!s || s.surum <= mevcut.surum || s.surum === kotu) return null;
      return istek('uygulama_dosya?select=yol,surum,icerik&surum=gt.' + yerel.surum + '&surum=lte.' + s.surum + '&order=surum.asc', kod).then(function (dosyalar) {
        var d = {};
        dosyalar.forEach(function (f) { d[f.yol] = f.icerik; });
        var paket = { surum: s.surum, taban: yerel.surum, sayfalar: s.sayfalar, notlar: s.notlar || '', dosyalar: d, indirildi: Date.now() };
        return sakla(paket).then(function () { return paket; });
      });
    });
  }
  /* Kullanılacak paket: saklı sürüm klasördekinden yeniyse ve aynı klasör sürümü üzerine indirildiyse o, değilse klasördeki. */
  function sec(sakli) {
    if (sakli && sakli.surum > yerel.surum && sakli.taban === yerel.surum && sakli.sayfalar) return sakli;
    return { surum: yerel.surum, sayfalar: yerel.sayfalar, dosyalar: {}, notlar: '' };
  }

  /* --- sayfayı kur --- */
  function betik(yol, icerik) {
    return new Promise(function (ok, hata) {
      var s = document.createElement('script');
      if (icerik != null) {
        s.textContent = icerik + '\n//# sourceURL=' + yol;
        document.body.appendChild(s);
        ok();
      } else {
        s.src = yol;
        s.onload = function () { ok(); };
        s.onerror = function () { hata(new Error(yol)); };
        document.body.appendChild(s);
      }
    });
  }
  function kur(paket) {
    var sayfa = paket.sayfalar[modul] || paket.sayfalar.portal;
    document.title = sayfa.baslik;
    window.NT_MODUL = JSON.parse(JSON.stringify(sayfa.modul));
    window.NT_SURUM_AKTIF = { surum: paket.surum, notlar: paket.notlar || '' };
    sayfa.css.forEach(function (yol) {
      var e;
      if (paket.dosyalar[yol] != null) { e = document.createElement('style'); e.textContent = paket.dosyalar[yol]; }
      else { e = document.createElement('link'); e.rel = 'stylesheet'; e.href = yol; }
      document.head.appendChild(e);
    });
    return sayfa.js.reduce(function (p, yol) { return p.then(function () { return betik(yol, paket.dosyalar[yol]); }); }, Promise.resolve());
  }
  function hataGoster(mesaj) {
    var k = document.getElementById('yukleme-hatasi');
    if (!k) return;
    k.querySelector('ul').innerHTML = '<li>' + String(mesaj).replace(/</g, '&lt;') + '</li>';
    k.style.display = 'block';
  }
  function serit(paket) {
    var e = document.createElement('div');
    e.setAttribute('role', 'status');
    e.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;display:flex;gap:14px;align-items:center;padding:12px 16px 12px 18px;border-radius:14px;background:#17201b;color:#fff;font:14px/1.4 "Segoe UI",system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:calc(100% - 32px)';
    e.innerHTML = '<span><b>SKYHEM Takip güncellendi</b> (sürüm ' + paket.surum + ')' + (paket.notlar ? ' · ' + String(paket.notlar).replace(/</g, '&lt;') : '') + '</span>';
    var b = document.createElement('button');
    b.textContent = 'Şimdi yenile';
    b.style.cssText = 'border:0;border-radius:9px;padding:7px 14px;background:#98db04;color:#0d1310;font-weight:700;cursor:pointer;white-space:nowrap';
    b.onclick = function () { location.reload(); };
    var x = document.createElement('button');
    x.textContent = '×';
    x.title = 'Sonra (bir sonraki açılışta kendiliğinden geçer)';
    x.style.cssText = 'border:0;background:transparent;color:#cfd5c8;font-size:20px;cursor:pointer;padding:0 2px';
    x.onclick = function () { e.remove(); };
    e.appendChild(b); e.appendChild(x);
    document.body.appendChild(e);
  }

  window.NT_YUKLEYICI = { guncelle: guncelle, sakliAl: sakliAl, sakla: sakla, sec: sec }; // denetim ve test için

  if (!yerel || !yerel.sayfalar) { hataGoster('uygulama/surum.js'); return; }
  sakliAl().then(function (sakli) {
    var paket = sec(sakli);
    var buluttan = paket.surum > yerel.surum;
    var kotu = sakli && sakli.kotu;
    // Açılış sırasında çıkan hatalar: buluttan gelen sürüm bozuksa işaretlenir, klasördeki sürüme dönülür ve o sürüm bir daha indirilmez.
    var hatalar = [];
    var dinle = function (e) { if (!e.target || !(e.target.src || e.target.href)) hatalar.push(e.message || String(e.error)); };
    window.addEventListener('error', dinle);
    var geriDon = function (neden) {
      console.error('Sürüm ' + paket.surum + ' açılamadı, klasördeki sürüme dönülüyor:', neden);
      return sakla({ surum: 0, kotu: paket.surum }).catch(function () {}).then(function () { location.reload(); });
    };
    return kur(paket).then(function () {
      window.removeEventListener('error', dinle);
      if (buluttan && hatalar.length) return geriDon(hatalar[0]);
      var kod = null;
      try { kod = localStorage.getItem('nt.kod'); } catch (e) { /* yoksay */ }
      if (!kod) return;
      // Arka planda yeni sürüme bak (açılışı bekletmez)
      setTimeout(function () {
        guncelle(kod, paket, kotu).then(function (yeni) { if (yeni) serit(yeni); }).catch(function (e) { console.warn('Güncelleme denetlenemedi:', e.message); });
      }, 1500);
    }, function (e) {
      window.removeEventListener('error', dinle);
      if (buluttan) return geriDon(e.message);
      hataGoster(e.message);
    });
  });
})();
