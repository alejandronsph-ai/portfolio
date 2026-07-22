/* Certificate actions: build a one-page PDF (only the chosen certificate)
   and either download it (Guardar) or open it ready to print (Imprimir).
   No external libraries: the certificate image is rasterized to JPEG via
   canvas and embedded in a hand-assembled PDF. */
(function () {
  function certFilename(title) {
    return 'Alejandro-Nieves-Santana-' + (title || 'Certificado')
      .replace(/[·\/]+/g, ' ').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9\-]/g, '');
  }

  function dataUrlToBytes(url) {
    var bin = atob(url.split(',')[1]);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = reject;
      im.src = src;
      if (im.complete && im.naturalWidth) resolve(im);
    });
  }

  function certToPdfBlob(imgEl) {
    var src = imgEl.currentSrc || imgEl.src;
    return loadImage(src).then(function (im) {
      var iw = im.naturalWidth, ih = im.naturalHeight;
      var canvas = document.createElement('canvas');
      canvas.width = iw; canvas.height = ih;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, iw, ih);
      ctx.drawImage(im, 0, 0, iw, ih);
      var jpeg = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.95));

      // page size in points: longest side = A4 long edge, keep aspect
      var maxPt = 842, pw, ph;
      if (iw >= ih) { pw = maxPt; ph = maxPt * ih / iw; }
      else { ph = maxPt; pw = maxPt * iw / ih; }
      pw = Math.round(pw); ph = Math.round(ph);

      var chunks = [], len = 0, off = [];
      var te = new TextEncoder();
      function A(s) { var b = te.encode(s); chunks.push(b); len += b.length; }
      function Bn(b) { chunks.push(b); len += b.length; }
      function obj(n, body) { off[n] = len; A(n + ' 0 obj\n' + body + '\nendobj\n'); }

      A('%PDF-1.4\n');
      Bn(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));

      obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
      obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
      obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph +
             '] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
      var content = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
      obj(4, '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');

      off[5] = len;
      A('5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + iw + ' /Height ' + ih +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
        jpeg.length + ' >>\nstream\n');
      Bn(jpeg);
      A('\nendstream\nendobj\n');

      var xrefOff = len;
      var xref = 'xref\n0 6\n0000000000 65535 f \n';
      for (var i = 1; i <= 5; i++) {
        xref += ('0000000000' + off[i]).slice(-10) + ' 00000 n \n';
      }
      A(xref);
      A('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefOff + '\n%%EOF');

      return new Blob(chunks, { type: 'application/pdf' });
    });
  }

  function saveCert(imgEl, title) {
    certToPdfBlob(imgEl).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = certFilename(title) + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
    });
  }

  function printCert(imgEl, title) {
    certToPdfBlob(imgEl).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var w = window.open(url, '_blank');
      if (!w) { // popup blocked: fall back to a download
        saveCert(imgEl, title);
        return;
      }
      var tried = false;
      var go = function () { if (tried) return; tried = true; try { w.focus(); w.print(); } catch (e) {} };
      try { w.addEventListener('load', go); } catch (e) {}
      setTimeout(go, 1200);
    });
  }

  function wire() {
    document.querySelectorAll('.cert-overlay').forEach(function (el) {
      var img = el.querySelector('img');
      var title = el.dataset.title || 'Certificado';
      var s = el.querySelector('[data-save]');
      var p = el.querySelector('[data-print]');
      if (s && !s._cw) { s._cw = 1; s.addEventListener('click', function () { saveCert(img, title); }); }
      if (p && !p._cw) { p._cw = 1; p.addEventListener('click', function () { printCert(img, title); }); }
    });
  }

  window.certActions = { saveCert: saveCert, printCert: printCert, wire: wire, toPdfBlob: certToPdfBlob };
  if (document.readyState !== 'loading') wire();
  else document.addEventListener('DOMContentLoaded', wire);
})();
