// ============================================================
//  GOOGLE APPS SCRIPT — Backend Undangan Digital
//  Versi lengkap: Tamu, Pengaturan, RSVP, Ucapan
// ============================================================

const SHEET_TAMU     = "Tamu";
const SHEET_SETTINGS = "Pengaturan";
const SHEET_RSVP     = "RSVP";
const SHEET_UCAPAN   = "Ucapan";

const HEADERS_TAMU   = ["ID", "Nama", "No WA", "Status Kirim", "Waktu Tambah"];
const HEADERS_RSVP   = ["ID Tamu", "Nama", "Status", "Jumlah Hadir", "Catatan", "Waktu"];
const HEADERS_UCAPAN = ["ID", "Nama Pengirim", "Ucapan", "Waktu"];

// ============================================================
//  🔐 SECRET KEY — GANTI DENGAN KATA SANDI BUATANMU SENDIRI
//  Contoh: "UndanganBudi2026!" atau "N1k4h@nKita#Maret"
//  JANGAN gunakan contoh di atas!
// ============================================================
const SECRET_KEY = "Test@123";

// ─── ENTRY POINT ─────────────────────────────────────────────
function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    const body   = e.postData ? JSON.parse(e.postData.contents) : e.parameter;
    const action = body.action || e.parameter.action;

    // Aksi publik — tidak butuh secret key
    const PUBLIC_ACTIONS = ["getGuestByToken","submitRsvp","submitUcapan","getUcapan","getRsvpStats","getRsvpAll"];

    if (!PUBLIC_ACTIONS.includes(action)) {
      if (!body.secretKey || body.secretKey !== SECRET_KEY) {
        output.setContent(JSON.stringify({ ok: false, msg: "Akses ditolak." }));
        return output;
      }
    }

    let result;
    switch (action) {
      case "getGuests":       result = getGuests();            break;
      case "addGuest":        result = addGuest(body);         break;
      case "updateStatus":    result = updateStatus(body);     break;
      case "deleteGuest":     result = deleteGuest(body);      break;
      case "getSettings":     result = getSettingsData();      break;
      case "saveSettings":    result = saveSettingsData(body); break;
      case "getRsvpAll":      result = getRsvpAll();           break;
      case "getUcapanAll":    result = getUcapanAll();         break;
      case "getGuestByToken": result = getGuestByToken(body);  break;
      case "submitRsvp":      result = submitRsvp(body);       break;
      case "submitUcapan":    result = submitUcapan(body);     break;
      case "getUcapan":       result = getUcapanPublic();      break;
      case "getRsvpStats":    result = getRsvpStats();         break;
      default: result = { ok: false, msg: "Action tidak dikenal: " + action };
    }
    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ ok: false, msg: err.toString() }));
  }
  return output;
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s    = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); if (headers) s.appendRow(headers); }
  return s;
}

// ── TAMU ────────────────────────────────────────────────────
function getGuests() {
  const s = getOrCreateSheet(SHEET_TAMU, HEADERS_TAMU);
  const d = s.getDataRange().getValues();
  if (d.length <= 1) return { ok: true, guests: [] };
  return { ok: true, guests: d.slice(1).map(r => ({ id:r[0],nama:r[1],no:r[2],sent:r[3]===true||r[3]==="TRUE",addedAt:r[4] })) };
}
function addGuest(b) {
  const s  = getOrCreateSheet(SHEET_TAMU, HEADERS_TAMU);
  const id = b.id || Utilities.getUuid();
  const d  = s.getDataRange().getValues();
  for (let i=1;i<d.length;i++) if(d[i][0]===id) return {ok:false,msg:"ID sudah ada"};
  s.appendRow([id, b.nama||"", b.no||"", false, new Date().toISOString()]);
  return { ok: true, guest: { id, nama:b.nama, no:b.no, sent:false } };
}
function updateStatus(b) {
  const s = getOrCreateSheet(SHEET_TAMU, HEADERS_TAMU);
  const d = s.getDataRange().getValues();
  for (let i=1;i<d.length;i++) if(d[i][0]===b.id){ s.getRange(i+1,4).setValue(b.sent); return {ok:true}; }
  return {ok:false,msg:"Tidak ditemukan"};
}
function deleteGuest(b) {
  const s = getOrCreateSheet(SHEET_TAMU, HEADERS_TAMU);
  const d = s.getDataRange().getValues();
  for (let i=1;i<d.length;i++) if(d[i][0]===b.id){ s.deleteRow(i+1); return {ok:true}; }
  return {ok:false,msg:"Tidak ditemukan"};
}
function getGuestByToken(b) {
  if (!b.token) return {ok:false,msg:"Token kosong"};
  const s = getOrCreateSheet(SHEET_TAMU, HEADERS_TAMU);
  const d = s.getDataRange().getValues();
  for (let i=1;i<d.length;i++) if(d[i][0]===b.token) return {ok:true,nama:d[i][1]};
  return {ok:false,msg:"Tamu tidak ditemukan"};
}

// ── PENGATURAN ──────────────────────────────────────────────
function getSettingsData() {
  const s = getOrCreateSheet(SHEET_SETTINGS, ["Key","Value"]);
  const d = s.getDataRange().getValues();
  const r = {};
  d.slice(1).forEach(row => { r[row[0]] = row[1]; });
  return { ok:true, settings:r };
}
function saveSettingsData(b) {
  const s    = getOrCreateSheet(SHEET_SETTINGS, ["Key","Value"]);
  const keys = ["couple","date","time","place","baseUrl","template",
                 "mapsUrl","rek1Bank","rek1No","rek1Nama","rek2Bank","rek2No","rek2Nama"];
  keys.forEach(key => {
    if (b[key]===undefined) return;
    const d = s.getDataRange().getValues();
    let found = false;
    for (let i=1;i<d.length;i++) if(d[i][0]===key){ s.getRange(i+1,2).setValue(b[key]); found=true; break; }
    if (!found) s.appendRow([key, b[key]]);
  });
  return { ok:true };
}

// ── RSVP ───────────────────────────────────────────────────
function submitRsvp(b) {
  const s = getOrCreateSheet(SHEET_RSVP, HEADERS_RSVP);
  const d = s.getDataRange().getValues();
  for (let i=1;i<d.length;i++) {
    if (d[i][0]===b.idTamu) {
      s.getRange(i+1,3).setValue(b.status);
      s.getRange(i+1,4).setValue(b.jumlah||1);
      s.getRange(i+1,5).setValue(b.catatan||"");
      s.getRange(i+1,6).setValue(new Date().toISOString());
      return {ok:true,updated:true};
    }
  }
  s.appendRow([b.idTamu||"", b.nama||"", b.status||"hadir", b.jumlah||1, b.catatan||"", new Date().toISOString()]);
  return {ok:true,updated:false};
}
function getRsvpAll() {
  const s = getOrCreateSheet(SHEET_RSVP, HEADERS_RSVP);
  const d = s.getDataRange().getValues();
  if (d.length<=1) return {ok:true,rsvp:[]};
  return {ok:true, rsvp: d.slice(1).map(r=>({idTamu:r[0],nama:r[1],status:r[2],jumlah:r[3],catatan:r[4],waktu:r[5]}))};
}
function getRsvpStats() {
  const s = getOrCreateSheet(SHEET_RSVP, HEADERS_RSVP);
  const d = s.getDataRange().getValues();
  let hadir=0,tidak=0,ragu=0;
  d.slice(1).forEach(r => {
    const st = (r[2]||"").toLowerCase();
    if(st==="hadir") hadir+=parseInt(r[3])||1;
    else if(st==="tidak") tidak++;
    else if(st==="ragu") ragu++;
  });
  return {ok:true, hadir, tidak, ragu, total:d.length-1};
}

// ── UCAPAN ─────────────────────────────────────────────────
function submitUcapan(b) {
  const s = getOrCreateSheet(SHEET_UCAPAN, HEADERS_UCAPAN);
  s.appendRow([Utilities.getUuid(), b.nama||"Anonim", b.ucapan||"", new Date().toISOString()]);
  return {ok:true};
}
function getUcapanPublic() {
  const s = getOrCreateSheet(SHEET_UCAPAN, HEADERS_UCAPAN);
  const d = s.getDataRange().getValues();
  if (d.length<=1) return {ok:true,ucapan:[]};
  return {ok:true, ucapan: d.slice(1).reverse().slice(0,50).map(r=>({id:r[0],nama:r[1],ucapan:r[2],waktu:r[3]}))};
}
function getUcapanAll() {
  const s = getOrCreateSheet(SHEET_UCAPAN, HEADERS_UCAPAN);
  const d = s.getDataRange().getValues();
  if (d.length<=1) return {ok:true,ucapan:[]};
  return {ok:true, ucapan: d.slice(1).reverse().map(r=>({id:r[0],nama:r[1],ucapan:r[2],waktu:r[3]}))};
}
