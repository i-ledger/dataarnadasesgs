// Code.gs - i-Armada
const SPREADSHEET_ID = 'PASTE_SPREADSHEET_ID_HERE';
const SS = SpreadsheetApp.openById(SPREADSHEET_ID);
const META_SHEET = 'Meta';

function getMeta(k){
  const s = SS.getSheetByName(META_SHEET);
  if(!s) return null;
  const vals = s.getDataRange().getValues();
  for(let i=0;i<vals.length;i++) if(vals[i][0]==k) return vals[i][1];
  return null;
}
function setMeta(k,v){
  const s = SS.getSheetByName(META_SHEET);
  const vals = s.getDataRange().getValues();
  for(let i=0;i<vals.length;i++){
    if(vals[i][0]==k){ s.getRange(i+1,2).setValue(v); return; }
  }
  s.appendRow([k,v]);
}

// Simple JSON responder
function _json(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

// Router for both GET (read) and POST (write)
function doGet(e){
  const action = e.parameter.action || '';
  try{
    switch(action){
      case 'getArmada': return _json(getArmada(e.parameter.id_pt));
      case 'getDrivers': return _json(getDrivers(e.parameter.id_pt));
      case 'getMaintenance': return _json(getMaintenance(e.parameter.id_pt, e.parameter.from, e.parameter.to));
      case 'getDiagram': return _json(getDiagram(e.parameter.id_pt, e.parameter.jenis, e.parameter.from, e.parameter.to));
      case 'getUser': return _json(getUser(e.parameter.email, e.parameter.password, e.parameter.id_pt));
      default: return _json({status:'ok',message:'i-Armada API'});
    }
  } catch(err){ return _json({status:'error',message:err.message}); }
}

function doPost(e){
  const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  const action = body.action;
  try{
    switch(action){
      case 'addArmada': return _json(addArmada(body));
      case 'editArmada': return _json(editArmada(body));
      case 'deleteArmada': return _json(deleteArmada(body.id_armada));
      case 'addDriver': return _json(addDriver(body));
      case 'addMaintenance': return _json(addMaintenance(body));
      case 'editMaintenance': return _json(editMaintenance(body));
      case 'deleteMaintenance': return _json(deleteMaintenance(body.id_report));
      case 'registerUser': return _json(registerUser(body));
      case 'uploadPhoto': return _json(uploadPhoto(body));
      default: return _json({status:'error',message:'unknown action'});
    }
  } catch(err){ return _json({status:'error',message:err.message}); }
}

// ---------- Utility helpers ----------
function getSheet(name){ return SS.getSheetByName(name); }
function sheetToObjects(sheet){
  const values = sheet.getDataRange().getValues();
  if(values.length<=1) return [];
  const keys = values[0];
  const rows = [];
  for(let i=1;i<values.length;i++){
    const r = {};
    for(let j=0;j<keys.length;j++) r[keys[j]] = values[i][j];
    rows.push(r);
  }
  return rows;
}

// ---------- Auth (very simple) ----------
function getUser(email, password, id_pt){
  const users = sheetToObjects(getSheet('Users'));
  const u = users.find(x=>String(x.email)==String(email) && String(x.password_hash)==String(password) && String(x.id_pt)==String(id_pt));
  if(u) return {status:'ok', user:u};
  return {status:'error', message:'invalid credentials'};
}

function registerUser(body){
  const s = getSheet('Users');
  const id = 'USR-'+Date.now();
  s.appendRow([id, body.email, body.password, body.nama||'', body.role||'operator', body.id_pt||'', new Date().toISOString()]);
  return {status:'ok', user_id:id};
}

// ---------- Armada CRUD ----------
function getArmada(id_pt){
  const rows = sheetToObjects(getSheet('Armada'));
  return id_pt ? rows.filter(r=>String(r.id_pt)===String(id_pt)) : rows;
}
function addArmada(p){
  const s = getSheet('Armada');
  const id = 'ARM-'+Date.now();
  s.appendRow([id, p.nopol||'', p.tipe||'', p.tahun||'', p.nama_pt||'', p.id_pt||'', p.driver_id||'', new Date().toISOString(), p.notes||'']);
  return {status:'ok', id_armada:id};
}
function editArmada(p){
  const s = getSheet('Armada');
  const vals = s.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]==p.id_armada){
      const r = i+1;
      const mapping = {nopol:2,tipe:3,tahun:4,nama_pt:5,id_pt:6,driver_id:7,notes:9};
      Object.keys(mapping).forEach(k=>{ if(p[k] !== undefined) s.getRange(r,mapping[k]).setValue(p[k]); });
      return {status:'ok'};
    }
  }
  return {status:'error', message:'not found'};
}
function deleteArmada(id_armada){
  const s = getSheet('Armada');
  const vals = s.getDataRange().getValues();
  for(let i=1;i<vals.length;i++) if(vals[i][0]==id_armada){ s.deleteRow(i+1); return {status:'ok'}; }
  return {status:'error', message:'not found'};
}

// ---------- Drivers ----------
function getDrivers(id_pt){
  const rows = sheetToObjects(getSheet('Drivers'));
  return id_pt ? rows.filter(r=>String(r.id_pt)===String(id_pt)) : rows;
}
function addDriver(p){
  const s = getSheet('Drivers');
  const id = 'DR-'+Date.now();
  s.appendRow([id, p.nama_driver||'', p.no_hp||'', p.id_pt||'', new Date().toISOString()]);
  return {status:'ok', driver_id:id};
}

// ---------- Maintenance CRUD ----------
function getMaintenance(id_pt, from, to){
  const rows = sheetToObjects(getSheet('Maintenance'));
  // If id_pt provided, filter by armada belonging to id_pt
  let armIds = null;
  if(id_pt){ const arms = getArmada(id_pt); armIds = arms.map(a=>a.id_armada); }
  const fT = from ? new Date(from) : null;
  const tT = to ? new Date(to) : null;
  return rows.filter(r=>{
    if(id_pt && armIds && armIds.indexOf(r.id_armada)==-1) return false;
    if(r.tanggal){ const d=new Date(r.tanggal); if(fT && d < fT) return false; if(tT && d > tT) return false; }
    return true;
  });
}

function addMaintenance(p){
  const s = getSheet('Maintenance');
  const id = 'REP-'+Date.now();
  const foto_file_id = p.foto_file_id || '';
  const foto_url = foto_file_id ? `https://drive.google.com/uc?export=view&id=${foto_file_id}` : '';
  s.appendRow([id, p.id_armada||'', p.nopol||'', p.jenis||'', p.keterangan||'', p.tanggal||'', p.biaya||'', foto_file_id, foto_url, p.reported_by||'', new Date().toISOString(), '']);
  return {status:'ok', id_report:id};
}

function editMaintenance(p){
  const s = getSheet('Maintenance');
  const vals = s.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]==p.id_report){
      const r=i+1;
      const mapping = {id_armada:2,nopol:3,jenis:4,keterangan:5,tanggal:6,biaya:7,foto_file_id:8,reported_by:10};
      Object.keys(mapping).forEach(k=>{ if(p[k] !== undefined) s.getRange(r,mapping[k]).setValue(p[k]); });
      // update foto_url if foto_file_id provided
      if(p.foto_file_id) s.getRange(r,9).setValue(`https://drive.google.com/uc?export=view&id=${p.foto_file_id}`);
      s.getRange(r,12).setValue(new Date().toISOString());
      return {status:'ok'};
    }
  }
  return {status:'error', message:'not found'};
}

function deleteMaintenance(id_report){
  const s = getSheet('Maintenance');
  const vals = s.getDataRange().getValues();
  for(let i=1;i<vals.length;i++) if(vals[i][0]==id_report){ s.deleteRow(i+1); return {status:'ok'}; }
  return {status:'error', message:'not found'};
}

// ---------- Diagram ----------
function getDiagram(id_pt, jenis, from, to){
  const data = getMaintenance(id_pt, from, to);
  const filtered = jenis ? data.filter(r=>String(r.jenis)===String(jenis)) : data;
  const counts = {};
  filtered.forEach(r=>{
    const d = r.tanggal ? (new Date(r.tanggal)).toISOString().slice(0,10) : (new Date(r.created_at)).toISOString().slice(0,10);
    counts[d] = (counts[d]||0) + 1;
  });
  return Object.keys(counts).sort().map(k=>({tanggal:k,count:counts[k]}));
}

// ---------- Upload photo to Drive (B) ----------
function uploadPhoto(body){
  // body must include: filename, contentBase64, id_pt
  const folderId = getMeta('drive_folder_photos');
  if(!folderId) return {status:'error', message:'drive folder not configured. Set Meta[drive_folder_photos] to target folder id.'};
  const folder = DriveApp.getFolderById(folderId);
  const content = Utilities.base64Decode(body.contentBase64.replace(/^data:.*;base64,/,''));
  const blob = Utilities.newBlob(content, body.mimeType || 'image/jpeg', body.filename || ('photo-'+Date.now()+'.jpg'));
  const file = folder.createFile(blob);
  // make file readable (optional) — if you want public access comment the next line
  // file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {status:'ok', fileId:file.getId(), url:`https://drive.google.com/uc?export=view&id=${file.getId()}`};
}

// ---------- Scheduled reminder for STNK/Pajak/KIR (C) ----------
function checkDueReminders(){
  // This function can be triggered Time-driven daily.
  // It checks Maintenance rows with jenis in ['STNK','Pajak','KIR'] and tanggal within next 30 days and sends email to admin(s).
  const upcomingDays = 30;
  const sheet = getSheet('Maintenance');
  const rows = sheetToObjects(sheet);
  const today = new Date();
  const receivers = getAdminsEmails();
  const toNotify = [];
  rows.forEach(r=>{
    if(!r.jenis) return;
    const j = String(r.jenis).toLowerCase();
    if(['stnk','pajak','kir'].indexOf(j)===-1) return;
    if(!r.tanggal) return;
    const d = new Date(r.tanggal);
    const diffDays = Math.ceil((d - today)/(1000*60*60*24));
    if(diffDays >=0 && diffDays <= upcomingDays) toNotify.push({row:r, daysLeft:diffDays});
  });
  if(toNotify.length && receivers.length){
    const subject = `Reminder: ${toNotify.length} dokumen kendaraan mendekati jatuh tempo`;
    let body = 'Daftar item yang mendekati jatuh tempo:

';
    toNotify.forEach(t=>{ body += `${t.row.nopol} — ${t.row.jenis} — tgl: ${t.row.tanggal} — sisa hari: ${t.daysLeft}
`; });
    MailApp.sendEmail({to:receivers.join(','), subject:subject, body:body});
  }
  return {status:'ok', count:toNotify.length};
}

function getAdminsEmails(){
  const users = sheetToObjects(getSheet('Users'));
  return users.filter(u=>String(u.role).toLowerCase()==='admin').map(x=>x.email).filter(Boolean);
}

// END of Code.gs
