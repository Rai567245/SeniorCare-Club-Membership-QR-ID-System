/* ============================================================
   SeniorCare — Club Membership QR ID System  |  script.js
   ============================================================ */

/* ── Global state ─────────────────────────────────────────── */
var memberData = {
  memberName: '', seniorCareId: '',
  clubMembership: '', membershipDate: '', expiryDate: ''
};
var html5QrcodeScanner = null;
var scanComplete = false;

/* ── On page load ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {

  // Wire up Enter key on all inputs
  var ids = ['memberName','seniorCareId','clubMembership','membershipDate','expiryDate'];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') handleFormSubmit();
    });
    el.addEventListener('input', function() {
      el.classList.remove('invalid');
    });
  });

  // Attach event listeners to buttons
  document.getElementById('generateBtn').addEventListener('click', handleFormSubmit);
  document.getElementById('downloadQRBtn').addEventListener('click', downloadQR);
  document.getElementById('goToScannerBtn').addEventListener('click', goToScanner);
  document.getElementById('startScanBtn').addEventListener('click', startScanner);
  document.getElementById('stopScanBtn').addEventListener('click', function() { stopScanner(true); });
  document.getElementById('backToQRBtn').addEventListener('click', goBackToQR);
  document.getElementById('scanAgainBtn').addEventListener('click', scanAgain);
  document.getElementById('viewQRBtn').addEventListener('click', goBackToQR);
  document.getElementById('resetAllBtn').addEventListener('click', resetAll);

  showSection('formSection');
  setStep(1);
});

/* ══════════════════════════════════════════════════════════
   STEP 1 — Form validation
══════════════════════════════════════════════════════════ */
function handleFormSubmit() {
  clearErrors();

  var memberName     = document.getElementById('memberName').value.trim();
  var seniorCareId   = document.getElementById('seniorCareId').value.trim();
  var clubMembership = document.getElementById('clubMembership').value.trim();
  var membershipDate = document.getElementById('membershipDate').value;
  var expiryDate     = document.getElementById('expiryDate').value;

  var ok = true;
  if (!memberName)     { showErr('errMemberName',     'memberName',     'Member name is required.');     ok = false; }
  if (!seniorCareId)   { showErr('errSeniorCareId',   'seniorCareId',   'Senior Care ID is required.');  ok = false; }
  if (!clubMembership) { showErr('errClubMembership', 'clubMembership', 'Club membership is required.'); ok = false; }
  if (!membershipDate) { showErr('errMembershipDate', 'membershipDate', 'Membership date is required.'); ok = false; }
  if (!expiryDate)     { showErr('errExpiryDate',     'expiryDate',     'Expiry date is required.');     ok = false; }
  if (membershipDate && expiryDate && expiryDate < membershipDate) {
    showErr('errExpiryDate', 'expiryDate', 'Expiry date must be after membership date.');
    ok = false;
  }
  if (!ok) return;

  memberData = { memberName: memberName, seniorCareId: seniorCareId,
                 clubMembership: clubMembership, membershipDate: membershipDate,
                 expiryDate: expiryDate };
  generateQRCode();
}

function showErr(errId, inputId, msg) {
  document.getElementById(errId).textContent = msg;
  document.getElementById(inputId).classList.add('invalid');
}

function clearErrors() {
  ['errMemberName','errSeniorCareId','errClubMembership','errMembershipDate','errExpiryDate']
    .forEach(function(id) { document.getElementById(id).textContent = ''; });
  ['memberName','seniorCareId','clubMembership','membershipDate','expiryDate']
    .forEach(function(id) { document.getElementById(id).classList.remove('invalid'); });
}

/* ══════════════════════════════════════════════════════════
   STEP 2 — Generate QR Code
══════════════════════════════════════════════════════════ */
function fmtDate(dateStr) {
  if (!dateStr) return 'N/A';
  var parts = dateStr.split('-');
  var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function generateQRCode() {
  var container = document.getElementById('qrCodeCanvas');
  container.innerHTML = '';   // clear any old QR

  // ── Build structured JSON payload ──
  var memberJson = JSON.stringify({
    name:           memberData.memberName,
    id:             memberData.seniorCareId,
    club:           memberData.clubMembership,
    membershipDate: memberData.membershipDate,
    expiryDate:     memberData.expiryDate
  });

  // ── Base64url-encode the JSON (URL-safe, no padding issues) ──
  var b64 = btoa(unescape(encodeURIComponent(memberJson)))
              .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // ── Build the result page URL (same folder as index.html) ──
  // Works locally: file:///path/to/result.html?data=...
  // Works hosted: https://yourdomain.com/result.html?data=...
  var baseUrl = window.location.href.replace(/\/[^\/]*$/, '') + '/result.html';
  var payload = baseUrl + '?data=' + b64;

  // ── Store the payload globally for the in-app scanner ──
  window.generatedQRData = payload;
  // Also store the structured data for in-app result display
  window.generatedMemberJson = memberJson;

  // Build QR using QRCode.js (from CDN)
  try {
    new QRCode(container, {
      text:         payload,
      width:        220,
      height:       220,
      colorDark:    '#000000',
      colorLight:   '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });

    // ── FIX: Ensure white background for scannable QR ──
    // QRCode.js draws onto a canvas with transparent pixels.
    // Dark theme makes transparent areas look black, breaking scanners.
    // We wait for QRCode.js to finish, then paint white background.
    setTimeout(function() {
      var canvas = container.querySelector('canvas');
      if (canvas) {
        var ctx = canvas.getContext('2d');
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
      }
    }, 0);
  } catch (e) {
    console.error('QR Generation Error:', e);
    container.innerHTML = '<p style="color: var(--red); padding: 20px; text-align: center;">Failed to generate QR code. Please try again.</p>';
  }

  buildCardPreview();
  showSection('generateSection');
  setStep(2);
}

function buildCardPreview() {
  var card = document.getElementById('membershipCardPreview');

  var today    = new Date(); today.setHours(0,0,0,0);
  var parts    = memberData.expiryDate.split('-');
  var expiry   = new Date(+parts[0], +parts[1]-1, +parts[2]);
  var daysLeft = Math.ceil((expiry - today) / 86400000);

  var badgeClass, badgeText;
  if (daysLeft < 0) {
    badgeClass = 'expired';
    badgeText  = 'Expired ' + Math.abs(daysLeft) + ' day' + (Math.abs(daysLeft) !== 1 ? 's' : '') + ' ago';
  } else if (daysLeft <= 30) {
    badgeClass = 'soon';
    badgeText  = 'Expiring soon \u00b7 ' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' left';
  } else {
    badgeClass = 'valid';
    badgeText  = 'Valid \u00b7 ' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' left';
  }

  card.innerHTML =
    '<div class="mc-header">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>' +
      ' Senior Care Club Membership Card' +
    '</div>' +
    '<div class="mc-body">' +
      '<div class="mc-cell full"><span class="mc-label">Name of Member</span><span class="mc-value highlight">' + esc(memberData.memberName) + '</span></div>' +
      '<div class="mc-cell"><span class="mc-label">Senior Care I.D. No.</span><span class="mc-value">' + esc(memberData.seniorCareId) + '</span></div>' +
      '<div class="mc-cell"><span class="mc-label">Club Membership</span><span class="mc-value">' + esc(memberData.clubMembership) + '</span></div>' +
      '<div class="mc-cell"><span class="mc-label">Membership Date</span><span class="mc-value">' + esc(fmtDate(memberData.membershipDate)) + '</span></div>' +
      '<div class="mc-cell"><span class="mc-label">Expiry Date</span><span class="mc-value">' + esc(fmtDate(memberData.expiryDate)) + '</span>' +
        '<span class="expiry-badge ' + badgeClass + '">\u25cf ' + badgeText + '</span></div>' +
    '</div>';
}

function downloadQR() {
  var canvas = document.querySelector('#qrCodeCanvas canvas');
  var img    = document.querySelector('#qrCodeCanvas img');
  var src    = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
  if (!src) { alert('QR not found — please regenerate.'); return; }
  var a = document.createElement('a');
  a.href = src;
  a.download = 'QR_' + memberData.memberName.replace(/\s+/g, '_') + '.png';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function goToScanner() {
  scanComplete = false;
  document.getElementById('startScanBtn').classList.remove('hidden');
  document.getElementById('stopScanBtn').classList.add('hidden');
  document.getElementById('cameraError').classList.add('hidden');
  document.getElementById('qr-reader').innerHTML = '';
  document.getElementById('qr-reader').classList.remove('active-scan');
  setScanStatus('Click \u201cStart Camera\u201d to begin scanning.');
  showSection('scannerSection');
  setStep(3);
}

function goBackToQR() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().catch(function(){}).finally(function() {
      html5QrcodeScanner = null;
      showSection('generateSection'); setStep(2);
    });
  } else {
    showSection('generateSection'); setStep(2);
  }
}

/* ══════════════════════════════════════════════════════════
   STEP 3 — Camera Scanner
══════════════════════════════════════════════════════════ */
function startScanner() {
  scanComplete = false;
  document.getElementById('cameraError').classList.add('hidden');
  setScanStatus('Searching for QR code\u2026', 'searching');
  document.getElementById('startScanBtn').classList.add('hidden');
  document.getElementById('stopScanBtn').classList.remove('hidden');
  document.getElementById('qr-reader').classList.add('active-scan');

  html5QrcodeScanner = new Html5Qrcode('qr-reader');
  
  html5QrcodeScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
    function(decoded) { onScanSuccess(decoded); },
    function() {}    // per-frame failure — intentionally silent
  ).catch(function(err) { handleCameraError(err); });
}

function onScanSuccess(decoded) {
  if (scanComplete) return;
  scanComplete = true;
  setScanStatus('QR Code found!', 'found');
  setTimeout(function() { stopScanner(false); showResult(decoded); }, 600);
}

function stopScanner(showStart) {
  if (showStart === undefined) showStart = true;
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(function() {
      html5QrcodeScanner = null;
      document.getElementById('qr-reader').classList.remove('active-scan');
      if (showStart) {
        document.getElementById('startScanBtn').classList.remove('hidden');
        document.getElementById('stopScanBtn').classList.add('hidden');
        setScanStatus('Camera stopped.');
      }
    }).catch(function(e) { console.warn(e); html5QrcodeScanner = null; });
  }
}

function handleCameraError(err) {
  var msg = 'Could not access camera. ';
  if (err.name === 'NotAllowedError') msg += 'Permission denied — allow camera in browser settings.';
  else if (err.name === 'NotFoundError') msg += 'No camera found on this device.';
  else if (err.name === 'NotReadableError') msg += 'Camera is in use by another app.';
  else msg += (err.message || 'Unknown error.');
  document.getElementById('cameraErrorMsg').textContent = msg;
  document.getElementById('cameraError').classList.remove('hidden');
  document.getElementById('startScanBtn').classList.remove('hidden');
  document.getElementById('stopScanBtn').classList.add('hidden');
  document.getElementById('qr-reader').classList.remove('active-scan');
  setScanStatus('');
}

function setScanStatus(text, cls) {
  var el = document.getElementById('scanStatus');
  el.textContent = text;
  el.className = 'scan-status' + (cls ? ' ' + cls : '');
}

/* ══════════════════════════════════════════════════════════
   STEP 4 — Result display
══════════════════════════════════════════════════════════ */
function showResult(qrData) {
  var parsed = null;
  var isMemberQR = false;

  // ── Try parsing as URL with ?data= param (new format) ──
  var urlMatch = qrData.match(/[?&]data=([^&\s]*)/);
  if (urlMatch) {
    try {
      var b64 = urlMatch[1].replace(/-/g, '+').replace(/_/g, '/');
      var jsonStr = decodeURIComponent(escape(atob(b64)));
      var obj = JSON.parse(jsonStr);
      if (obj && obj.name) {
        parsed = {
          memberName:     obj.name     || '',
          seniorCareId:   obj.id       || '',
          clubMembership: obj.club     || '',
          membershipDate: obj.membershipDate || '',
          expiryDate:     obj.expiryDate     || ''
        };
        isMemberQR = true;
      }
    } catch(e) { /* fall through */ }
  }

  // ── Legacy fallback: plain text "MEMBER CARD" format ──
  if (!isMemberQR && qrData.trim().indexOf('MEMBER CARD') === 0) {
    var lines = qrData.split('\n');
    function extract(prefix) {
      var line = '';
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().indexOf(prefix.toLowerCase()) !== -1) {
          line = lines[i]; break;
        }
      }
      return line ? line.split(':').slice(1).join(':').trim() : '';
    }
    parsed = {
      memberName:     extract('name'),
      seniorCareId:   extract('id'),
      clubMembership: extract('club'),
      membershipDate: extract('from'),
      expiryDate:     extract('to')
    };
    if (parsed.memberName) isMemberQR = true;
  }

  var banner = document.getElementById('resultBanner');
  if (isMemberQR) {
    var match = parsed.memberName.toLowerCase() === memberData.memberName.toLowerCase() &&
                parsed.seniorCareId === memberData.seniorCareId;
    if (match) {
      banner.className = 'success-banner match';
      banner.innerHTML = '<div class="success-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><div><h2 class="card-title" style="margin:0 0 4px">Membership Verified!</h2><p class="card-sub" style="margin:0">Member QR successfully scanned and matched.</p></div>';
    } else {
      banner.className = 'success-banner nomatch';
      banner.innerHTML = '<div class="success-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div><h2 class="card-title" style="margin:0 0 4px">QR Scanned</h2><p class="card-sub" style="margin:0">This QR belongs to a different member.</p></div>';
    }
  } else {
    banner.className = 'success-banner nomatch';
    banner.innerHTML = '<div class="success-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div><div><h2 class="card-title" style="margin:0 0 4px">QR Scanned</h2><p class="card-sub" style="margin:0">Not a SeniorCare membership QR.</p></div>';
  }

  var list = document.getElementById('resultMemberInfo');
  list.innerHTML = '';
  if (isMemberQR) {
    var fields = [
      { label: 'Name of Member',   key: 'memberName'     },
      { label: 'Senior Care I.D.', key: 'seniorCareId'   },
      { label: 'Club Membership',  key: 'clubMembership' },
      { label: 'Membership Date',  key: 'membershipDate' },
      { label: 'Expiry Date',      key: 'expiryDate'     }
    ];
    fields.forEach(function(f) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="info-label">' + f.label + '</span><span class="info-value">' + esc(parsed[f.key]) + '</span>';
      list.appendChild(li);
    });
  } else {
    var li = document.createElement('li');
    li.innerHTML = '<span class="info-value" style="color:var(--text-muted);font-style:italic;">No membership data found.</span>';
    list.appendChild(li);
  }

  document.getElementById('resultQrData').textContent = qrData;
  showSection('resultSection');
  setStep(4);
}

/* ══════════════════════════════════════════════════════════
   Navigation helpers
══════════════════════════════════════════════════════════ */
function showSection(id) {
  ['formSection','generateSection','scannerSection','resultSection'].forEach(function(s) {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setStep(n) {
  for (var i = 1; i <= 4; i++) {
    var el = document.getElementById('step' + i);
    el.classList.remove('active','done');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('active');
  }
}

function scanAgain() {
  scanComplete = false;
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().catch(function(){}).finally(function() {
      html5QrcodeScanner = null; goToScanner();
    });
  } else { goToScanner(); }
}

function resetAll() {
  if (html5QrcodeScanner) { html5QrcodeScanner.stop().catch(function(){}); html5QrcodeScanner = null; }
  memberData = { memberName:'', seniorCareId:'', clubMembership:'', membershipDate:'', expiryDate:'' };
  scanComplete = false;
  ['memberName','seniorCareId','clubMembership','membershipDate','expiryDate'].forEach(function(id) {
    document.getElementById(id).value = '';
  });
  clearErrors();
  document.getElementById('qrCodeCanvas').innerHTML = '';
  document.getElementById('startScanBtn').classList.remove('hidden');
  document.getElementById('stopScanBtn').classList.add('hidden');
  document.getElementById('cameraError').classList.add('hidden');
  document.getElementById('qr-reader').classList.remove('active-scan');
  document.getElementById('qr-reader').innerHTML = '';
  setScanStatus('');
  showSection('formSection');
  setStep(1);
}

/* ── Utility ─────────────────────────────────────────────── */
function esc(text) {
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(String(text || '')));
  return d.innerHTML;
}
