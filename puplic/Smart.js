import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDquJ7Juh5Gs6vyF20jwtnSWFdruPMxKak",
    authDomain: "smart-4108d.firebaseapp.com",
    databaseURL: "https://smart-4108d-default-rtdb.firebaseio.com",
    projectId: "smart-4108d",
    storageBucket: "smart-4108d.firebasestorage.app",
    messagingSenderId: "209084102507",
    appId: "1:209084102507:web:2e6c529a096764da99fe2e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const FULL_COLUMNS = [
    "كود المشترك", "قطاع", "فرع", "منطقة", "يومية", "مرجع", "فرعى", "وحده", "اسم المشترك",
    "الرقم القومي", "العنوان", "رقم التليفون", "نوع الرسائل", "نوع الرسائل.1",
    "كود السداد", "حالة الاشتراك", "الجهد", "القدرة", "معامل الضرب", "رقم العداد",
    "تاريخ التعاقد", "نوع التعاقد العداد", "النشاط", "وصف المكانالغرض", "Category",
    "Address (General Region)", "Phase Wire", "Meter type name", "Manufactured company name",
    "Manufactured year", "VT ratio", "Pre-payment function", "Name of connected KIOSK",
    "Code of Feeder", "Name of connected Feeder", "SIM_S_Num", "BadgeNumber", "Manufacturer",
    "Model", "TYPE", "rise_date_session", "SerialNum", "EEHCUnifiedCode", "FacilityDescription",
    "DistributionFacility", "LossesArea", "DeviceFunction", "KioskCode",
    "DivisionCode", "LatitudeY", "LongitudeX"
];

const DATE_COLUMNS = ["تاريخ التعاقد"];
const COLUMN_MAPPING = {
    "رقم العداد": ["رقم العداد", "SerialNum", "BadgeNumber", "Meter Number", "serial"],
    "قطاع": ["قطاع", "Sector", "Disco", "Address (General Region)"],
    "فرع": ["فرع", "Branch", "DiscoBranch", "Address (Region)"],
    "TYPE": ["TYPE", "Meter type name", "DeviceFunction"],
    "تاريخ التعاقد": ["تاريخ التعاقد", "Contract Date", "InstallationDate"],
    "SIM_S_Num": ["SIM_S_Num", "SIM Number"],
    "LatitudeY": ["LatitudeY", "lat", "Latitude"],
    "LongitudeX": ["LongitudeX", "lon", "Longitude"]
};

let cachedAllData = [], currentResults = [], currentPage = 1;
const ROWS_PER_PAGE = 20;

function convertToDDMMYYYY(dateValue) {
    if (!dateValue) return "";
    if (typeof dateValue === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) return dateValue;
    try {
        if (dateValue instanceof Date && !isNaN(dateValue)) {
            return `${String(dateValue.getDate()).padStart(2, '0')}/${String(dateValue.getMonth() + 1).padStart(2, '0')}/${dateValue.getFullYear()}`;
        }
        const dateStr = String(dateValue).trim();
        let match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (match) {
            let day = match[1], month = match[2], year = match[3];
            if (parseInt(month) > 12) { let temp = day; day = month; month = temp; }
            return `${String(parseInt(day)).padStart(2, '0')}/${String(parseInt(month)).padStart(2, '0')}/${year}`;
        }
        match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (match) return `${String(parseInt(match[3])).padStart(2, '0')}/${String(parseInt(match[2])).padStart(2, '0')}/${match[1]}`;
        return dateStr;
    } catch (e) { return dateValue; }
}

function processValue(value, fieldName) {
    if (!value) return "";
    return DATE_COLUMNS.includes(fieldName) ? convertToDDMMYYYY(value) : String(value).trim();
}

function sanitizeKey(key) { return String(key).trim().replace(/[\.\#\$\/\[\]]/g, '_'); }
function cleanVal(val) { return val === undefined || val === null ? "" : String(val).trim(); }
function showLoading() { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'flex'; }
function hideLoading() { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'none'; }
function showNotification(message, type = 'success') { Swal.fire({ icon: type, title: message, toast: true, position: 'top-end', timer: 2000, showConfirmButton: false }); }
function escapeHtml(text) { return String(text).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'); }

async function loadData() {
    showLoading();
    try {
        const snap = await get(ref(db, 'Smart_Qabda'));
        if (snap.exists()) {
            const dataObj = snap.val();
            cachedAllData = Object.keys(dataObj).map(key => ({ ...dataObj[key], firebase_id: key }));
            currentResults = [...cachedAllData];
        } else { cachedAllData = []; currentResults = []; }
        renderTable();
        updateStats();
    } catch (e) { Swal.fire('خطأ', 'فشل تحميل البيانات', 'error'); }
    hideLoading();
}

function updateStats() {
    const els = ['totalCount', 'totalResults', 'visibleCount'];
    els.forEach(id => { const el = document.getElementById(id); if (el) el.innerText = currentResults.length; });
    const rowLabel = document.getElementById('rowCountLabel');
    if (rowLabel) rowLabel.innerHTML = `<i class="fas fa-database"></i> إجمالي العدادات: ${currentResults.length}`;
}

function renderTable() {
    const header = document.getElementById('tableHeaderRow');
    const tbody = document.getElementById('tableBody');
    if (!header || !tbody) return;
    header.innerHTML = `<th style="position:sticky; right:0; background:#3b82f6;">الإجراءات</th>` + FULL_COLUMNS.map(c => `<th>${c}</th>`).join('');
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const pageData = currentResults.slice(start, start + ROWS_PER_PAGE);
    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" style="text-align:center; padding:50px;">لا توجد بيانات<\/td></tr>`;
    } else {
        tbody.innerHTML = pageData.map(item => {
            const fId = item.firebase_id;
            return `<tr><td style="position:sticky; right:0; background:#1e293b;"><div style="display:flex; gap:8px;"><button class="save-row-btn" onclick="window.saveRow('${fId}', this)" style="background:#10b981; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; color:white;"><i class="fas fa-save"></i></button><button class="delete-row-btn" onclick="window.deleteRow('${fId}')" style="background:#ef4444; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; color:white;"><i class="fas fa-trash"></i></button></div><\/td>${FULL_COLUMNS.map(col => `<td contenteditable="true" data-key="${col}" data-id="${fId}">${escapeHtml(String(item[col] || ''))}<\/td>`).join('')} </tr>`;
        }).join('');
    }
    const totalPages = Math.ceil(currentResults.length / ROWS_PER_PAGE);
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.innerText = `صفحة ${currentPage} من ${totalPages || 1}`;
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

window.saveRow = async (id, btn) => {
    const tr = btn.closest('tr');
    const updates = {};
    tr.querySelectorAll('td[contenteditable="true"]').forEach(td => {
        const key = td.getAttribute('data-key');
        if (key) updates[key] = td.innerText.trim();
    });
    try {
        await update(ref(db, `Smart_Qabda/${id}`), updates);
        showNotification("تم التعديل بنجاح", "success");
        await loadData();
    } catch (e) { Swal.fire('خطأ', 'فشل الحفظ', 'error'); }
};

window.deleteRow = async (id) => {
    const res = await Swal.fire({ title: 'حذف السجل؟', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'نعم' });
    if (res.isConfirmed) { await remove(ref(db, `Smart_Qabda/${id}`)); showNotification("تم الحذف", "success"); await loadData(); }
};

function extractValue(row, standardColumn) {
    const names = COLUMN_MAPPING[standardColumn] || [standardColumn];
    for (const name of names) {
        const val = row[name];
        if (val !== undefined && val !== null && val !== "") return processValue(val, standardColumn);
    }
    return "";
}

function getMeterNumber(row) {
    for (const src of COLUMN_MAPPING["رقم العداد"]) {
        const val = row[src];
        if (val && val !== "") {
            let clean = String(val).trim();
            if (clean && !clean.toLowerCase().includes("po:")) return clean;
        }
    }
    return null;
}

// Page Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.page + 'Page').classList.add('active');
    });
});

document.getElementById('viewAllBtn')?.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector('.nav-btn[data-page="search"]').classList.add('active');
    document.getElementById('searchPage').classList.add('active');
});

// Search Tab Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#searchPage .tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + 'TabContent').classList.add('active');
    });
});

// Upload Handler
const processBtn = document.getElementById('processBtn');
if (processBtn) {
    processBtn.addEventListener('click', async () => {
        const files = document.getElementById('fileInput').files;
        const sessionDate = document.getElementById('RiseDate').value;
        if (files.length === 0 || !sessionDate) return Swal.fire('تنبيه', 'يرجى اختيار ملف وتحديد التاريخ', 'warning');
        showLoading();
        try {
            const meterDataMap = new Map();
            let totalRows = 0;
            for (const file of files) {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                for (const row of json) {
                    totalRows++;
                    const meterNumber = getMeterNumber(row);
                    if (!meterNumber) continue;
                    let record = meterDataMap.get(meterNumber) || {};
                    for (const col of FULL_COLUMNS) {
                        const val = extractValue(row, col);
                        if (val && !record[col]) record[col] = val;
                    }
                    meterDataMap.set(meterNumber, record);
                }
            }
            if (meterDataMap.size === 0) { Swal.fire('تنبيه', 'لا توجد أرقام عدادات صالحة', 'warning'); hideLoading(); return; }
            const existingSnap = await get(ref(db, 'Smart_Qabda'));
            const existing = existingSnap.exists() ? existingSnap.val() : {};
            const updates = {};
            const formattedDate = sessionDate.split('-').reverse().join('/');
            for (const [meterId, newData] of meterDataMap) {
                const key = sanitizeKey(meterId);
                const merged = { ...existing[key] };
                let hasNew = false;
                for (const [k, v] of Object.entries(newData)) {
                    if (v && (!existing[key]?.[k] || existing[key][k] === "")) { merged[k] = v; hasNew = true; }
                }
                merged["رقم العداد"] = meterId;
                merged["rise_date_session"] = formattedDate;
                if (hasNew || !existing[key]) updates[`Smart_Qabda/${key}`] = merged;
            }
            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
                Swal.fire({ icon: 'success', title: 'تم الرفع بنجاح', html: `تمت معالجة ${meterDataMap.size} عداد` });
                await loadData();
            } else { Swal.fire('مكتمل', 'جميع البيانات محدثة', 'info'); }
        } catch (e) { Swal.fire('خطأ', 'فشل المعالجة', 'error'); }
        hideLoading();
    });
}

const fileInput = document.getElementById('fileInput');
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const container = document.getElementById('fileListContainer');
        const list = document.getElementById('fileList');
        if (e.target.files.length > 0) {
            if (container) container.style.display = 'block';
            if (list) list.innerHTML = Array.from(e.target.files).map(f => `<li><i class="fas fa-file-excel"></i> ${f.name}</li>`).join('');
        } else if (container) container.style.display = 'none';
    });
}

// Apply Filters
document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
    const meterVal = cleanVal(document.getElementById('searchMeter')?.value || '').toLowerCase();
    const simVal = cleanVal(document.getElementById('searchSIM')?.value || '').toLowerCase();
    const riseDate = document.getElementById('searchRiseDate')?.value || '';
    let contractDate = document.getElementById('searchContractDate')?.value || '';
    const region = cleanVal(document.getElementById('searchGenRegion')?.value || '').toLowerCase();
    const branch = cleanVal(document.getElementById('searchRegion')?.value || '').toLowerCase();
    const typeVal = cleanVal(document.getElementById('filterType')?.value || '').toUpperCase();
    if (contractDate) contractDate = contractDate.split('-').reverse().join('/');
    const formattedRise = riseDate ? riseDate.split('-').reverse().join('/') : '';
    currentResults = cachedAllData.filter(item => {
        const mNum = (item["رقم العداد"] || "").toString().toLowerCase();
        const sNum = (item["SIM_S_Num"] || "").toString().toLowerCase();
        const rDate = (item["rise_date_session"] || "").toString();
        const cDate = (item["تاريخ التعاقد"] || "").toString();
        const reg = (item["قطاع"] || "").toString().toLowerCase();
        const br = (item["فرع"] || "").toString().toLowerCase();
        const typ = (item["TYPE"] || "").toString().toUpperCase();
        return (!meterVal || mNum.includes(meterVal)) && (!simVal || sNum.includes(simVal)) && (!formattedRise || rDate === formattedRise) && (!contractDate || cDate === contractDate) && (!region || reg.includes(region)) && (!branch || br.includes(branch)) && (!typeVal || typ.includes(typeVal));
    });
    currentPage = 1;
    renderTable();
    updateStats();
});

document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
    document.querySelectorAll('#searchPage input, #searchPage select').forEach(i => i.value = "");
    currentResults = [...cachedAllData];
    currentPage = 1;
    renderTable();
    updateStats();
});

document.getElementById('nextPageBtn')?.addEventListener('click', () => { if (currentPage < Math.ceil(currentResults.length / ROWS_PER_PAGE)) { currentPage++; renderTable(); } });
document.getElementById('prevPageBtn')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
document.getElementById('refreshDataBtn')?.addEventListener('click', loadData);
document.getElementById('exportBtn')?.addEventListener('click', () => {
    if (currentResults.length === 0) return Swal.fire('تنبيه', 'لا توجد بيانات', 'warning');
    const exportData = currentResults.map(item => { const obj = {}; FULL_COLUMNS.forEach(col => obj[col] = item[col] || ""); return obj; });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Smart Meters");
    XLSX.writeFile(wb, `smart_meters_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification(`تم تصدير ${currentResults.length} سجل`, "success");
});

document.getElementById('deleteAllDataBtn')?.addEventListener('click', async () => {
    const res = await Swal.fire({ title: 'مسح شامل؟', text: "سيتم حذف كل البيانات", icon: 'error', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (res.isConfirmed) { showLoading(); await remove(ref(db, 'Smart_Qabda')); await loadData(); hideLoading(); showNotification("تم حذف جميع البيانات", "success"); }
});

// Dashboard Data
let allData = [], typeChart = null;
function formatNumber(num) { return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function parseDate(dateString) {
    if (!dateString) return null;
    try {
        if (dateString instanceof Date && !isNaN(dateString)) return dateString;
        const raw = String(dateString).trim();
        const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            const year = parseInt(match[3], 10) < 100 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10);
            return new Date(year, month, day);
        }
        return null;
    } catch (e) { return null; }
}
function getCurrentWeekRange() {
    const now = new Date();
    const egyptNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const day = egyptNow.getDay();
    const start = new Date(egyptNow);
    start.setDate(egyptNow.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}
async function loadDashboardData() {
    try {
        const snap = await get(ref(db, 'Smart_Qabda'));
        if (snap.exists()) {
            const dataObj = snap.val();
            allData = Object.keys(dataObj).map(key => ({ ...dataObj[key], firebase_id: key }));
        } else { allData = []; }
        updateDashboardStats();
        updateDashboardCharts();
        updateRecentActivity();
    } catch (error) { console.error(error); }
}
function updateDashboardStats() {
    document.getElementById('totalMeters').textContent = formatNumber(allData.length);
    const weekRange = getCurrentWeekRange();
    const weekMeters = allData.filter(item => { const d = parseDate(item["تاريخ التعاقد"] || item.installDate); return d && d >= weekRange.start && d <= weekRange.end; }).length;
    document.getElementById('weekMeters').textContent = formatNumber(weekMeters);
    const branches = new Set(allData.map(item => item.فرع || item.discoBranch).filter(Boolean));
    document.getElementById('totalBranches').textContent = formatNumber(branches.size);
    const firstDate = allData.reduce((e, i) => { const d = parseDate(i["تاريخ التعاقد"] || i.installDate); if (!d) return e; return e ? (d < e ? d : e) : d; }, null);
    let avgDaily = 0;
    if (firstDate && allData.length > 0) {
        const days = Math.ceil((new Date() - firstDate) / (1000 * 60 * 60 * 24));
        avgDaily = days > 0 ? (allData.length / days).toFixed(1) : allData.length;
    }
    document.getElementById('avgDaily').textContent = avgDaily;
}
function updateDashboardCharts() {
    const typeCounts = {};
    allData.forEach(item => { const t = item.TYPE || 'غير محدد'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
    const tCtx = document.getElementById('typeChart')?.getContext('2d');
    if (tCtx) { if (typeChart) typeChart.destroy(); typeChart = new Chart(tCtx, { type: 'doughnut', data: { labels: Object.keys(typeCounts), datasets: [{ data: Object.values(typeCounts), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'] }] }, options: { responsive: true, plugins: { legend: { position: 'left', labels: { font: { size: 11 } } } } } }); }
}
function updateRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    const recent = [...allData].filter(i => i["تاريخ التعاقد"]).sort((a, b) => { const da = parseDate(a["تاريخ التعاقد"]); const db = parseDate(b["تاريخ التعاقد"]); return db - da; }).slice(0, 10);
    if (recent.length === 0) { container.innerHTML = '<div style="text-align:center; padding:30px;">لا توجد بيانات</div>'; return; }
    container.innerHTML = recent.map(item => `<div class="activity-item"><div class="activity-icon"><i class="fas fa-microchip"></i></div><div class="activity-content"><h4>${item["رقم العداد"] || 'غير معروف'}</h4><p>${item.facDesc || 'بدون وصف'}</p><div class="activity-details"><span><i class="fas fa-building"></i> ${item.فرع || '-'}</span><span><i class="fas fa-tag"></i> ${item.TYPE || '-'}</span><span><i class="fas fa-calendar"></i> ${item["تاريخ التعاقد"] || '-'}</span></div></div></div>`).join('');
}

// Set dates
const today = new Date();
const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
document.getElementById('printDateSearch') && (document.getElementById('printDateSearch').textContent = dateStr);
document.getElementById('RiseDate') && (document.getElementById('RiseDate').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);

// Initialize
loadData();
loadDashboardData();
setInterval(() => { loadDashboardData(); loadData(); }, 300000);