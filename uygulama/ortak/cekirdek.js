/* Çekirdek yardımcılar: kimlik, tarih, metin, CSV, indirme. Tarayıcı ve Node testlerinde ortak. */
(function (kok) {
  'use strict';
  const NT = (kok.NT = kok.NT || {});

  const ALFABE = 'abcdefghijkmnpqrstuvwxyz23456789';
  function uid(n = 10) {
    const b = new Uint8Array(n);
    (kok.crypto || require('crypto').webcrypto).getRandomValues(b);
    let s = '';
    for (const x of b) s += ALFABE[x % ALFABE.length];
    return s;
  }

  const iki = (n) => String(n).padStart(2, '0');
  function bugun(d = new Date()) {
    return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
  }
  function gunEkle(tarih, gun) {
    const d = new Date(tarih + 'T12:00:00');
    d.setDate(d.getDate() + gun);
    return bugun(d);
  }
  function gunFarki(a, b) {
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  }
  const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  function tarihYaz(t) {
    if (!t) return '—';
    const [y, m, d] = t.split('-');
    return `${+d} ${AYLAR[+m - 1]} ${y}`;
  }
  function zamanYaz(ms) {
    const d = new Date(ms);
    return `${tarihYaz(bugun(d))} ${iki(d.getHours())}:${iki(d.getMinutes())}`;
  }
  function onceYaz(ms, simdi = Date.now()) {
    const s = Math.round((simdi - ms) / 1000);
    if (s < 45) return 'az önce';
    if (s < 3600) return `${Math.round(s / 60)} dk önce`;
    if (s < 86400) return `${Math.round(s / 3600)} sa önce`;
    const g = Math.round(s / 86400);
    return g < 30 ? `${g} gün önce` : tarihYaz(bugun(new Date(ms)));
  }

  const kucuk = (s) => String(s ?? '').toLocaleLowerCase('tr-TR');
  const trSirala = (a, b) => String(a).localeCompare(String(b), 'tr', { numeric: true, sensitivity: 'base' });
  function ara(metin, sorgu) {
    const q = kucuk(sorgu).trim();
    if (!q) return true;
    const m = kucuk(metin);
    return q.split(/\s+/).every((p) => m.includes(p));
  }
  const sayi = (v) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const adetYaz = (n) => new Intl.NumberFormat('tr-TR').format(n);
  function basHarfler(ad) {
    return String(ad || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toLocaleUpperCase('tr-TR');
  }

  /* Excel (Türkçe) uyumlu CSV: ; ayraç, UTF-8 BOM */
  function csv(satirlar, kolonlar) {
    const kacis = (v) => {
      const s = v == null ? '' : String(v);
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const bas = kolonlar.map((k) => kacis(k.baslik)).join(';');
    const govde = satirlar.map((r) => kolonlar.map((k) => kacis(k.deger(r))).join(';'));
    return '﻿' + [bas, ...govde].join('\r\n');
  }

  function indir(ad, icerik, tur = 'text/plain;charset=utf-8') {
    const blob = icerik instanceof Blob ? icerik : new Blob([icerik], { type: tur });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ad;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* Sistemler arası geçiş: hepsi tek giriş dosyasından açılır (SKYHEM Takip.html?modul=satis). Sunum modu korunur. */
  function adres(modul, { demo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo') } = {}) {
    const p = [];
    if (modul && modul !== 'portal') p.push('modul=' + encodeURIComponent(modul));
    if (demo) p.push('demo');
    return 'SKYHEM Takip.html' + (p.length ? '?' + p.join('&') : '');
  }

  NT.c = { adres, uid, bugun, gunEkle, gunFarki, tarihYaz, zamanYaz, onceYaz, kucuk, trSirala, ara, sayi, adetYaz, basHarfler, csv, indir, AYLAR };
})(typeof window !== 'undefined' ? window : globalThis);
