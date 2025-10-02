// ===============================
// Konfigurasi i-Armada LPG 3KG
// ===============================


const API_URL = 'https://script.google.com/macros/s/AKfycbxdBg3XRoXt0IAW2-8WGfwaQFqZZf7kwnO_EWP9oxkYNwZjyzs2Cy5BP_Y7zZDFp0RXXQ/exec';


function checkLogin() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
}

// Logout function
function logout() {
  if (confirm('Yakin ingin logout?')) {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  }
}

// Format tanggal ke format lokal
function formatTanggal(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Format nama PT (jika multi akun)
function getPT() {
  const user = JSON.parse(localStorage.getItem('user'));
  return user ? user.pt : '-';
}

// Ambil spreadsheet ID per PT (jika backend pakai sistem multi-PT)
async function getSpreadsheetId(pt) {
  const res = await fetch(`${API_URL}?action=getSpreadsheetId&pt=${encodeURIComponent(pt)}`);
  const data = await res.json();
  return data.id;
}
