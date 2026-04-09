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
    "رقم العداد": ["رقم العداد", "رقم العداد ", "SerialNum", "BadgeNumber", "رقم_العداد", "Meter Number", "Meter No", "No", "serial", "meter_number"],
    "كود المشترك": ["كود المشترك", "كود المشترك ", "كود_المشترك", "كودالمشترك", "Code", "كود"],
    "قطاع": ["قطاع", "قطاع ", "Sector", "Disco"],
    "فرع": ["Address (Region)", "فرع", "فرع ", "Branch", "DiscoBranch", "هندسة", "هندسة قري"],
    "منطقة": ["منطقة", "منطقة ", "Area"],
    "SIM_S_Num": ["SIM_S_Num", "SIM_S_Num ", "SIM", "SIM Number"],
    "BadgeNumber": ["BadgeNumber", "BadgeNumber ", "Badge", "PO"],
    "TYPE": ["TYPE", "TYPE ", "Meter type name", "Meter Type", "DeviceFunction"],
    "LatitudeY": ["LatitudeY", "Y", "Latitude"],
    "LongitudeX": ["LongitudeX", "X", "Longitude"],
    "rise_date_session": ["rise_date_session", "Date", "Session Date"],
    "InstallationDate": ["InstallationDate", "تاريخ التركيب"],
    "تاريخ التعاقد": ["تاريخ التعاقد", "تاريخ التعاقد ", "Contract Date", "تاريخ العقد", "التعاقد", "InstallationDate", "تاريخ التركيب"]
};

let cachedAllData = [];
let currentResults = [];
let currentPage = 1;
const ROWS_PER_PAGE = 20;

function convertToDDMMYYYY(dateValue) {
    if (!dateValue) return "";
    if (typeof dateValue === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) return dateValue;

    try {
        if (typeof dateValue === 'number' && dateValue > 30000 && dateValue < 50000) {
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (dateValue - 2) * 86400000);
            return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        }

        if (dateValue instanceof Date && !isNaN(dateValue)) {
            return `${String(dateValue.getDate()).padStart(2, '0')}/${String(dateValue.getMonth() + 1).padStart(2, '0')}/${dateValue.getFullYear()}`;
        }

        const dateStr = String(dateValue).trim();
        let isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (isoMatch) {
            return `${String(parseInt(isoMatch[3])).padStart(2, '0')}/${String(parseInt(isoMatch[2])).padStart(2, '0')}/${isoMatch[1]}`;
        }

        let match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (match) {
            let day = match[1], month = match[2], year = match[3];
            if (parseInt(month) > 12) { let temp = day; day = month; month = temp; }
            return `${String(parseInt(day)).padStart(2, '0')}/${String(parseInt(month)).padStart(2, '0')}/${year}`;
        }

        const parsed = new Date(dateStr);
        if (!isNaN(parsed) && parsed.getFullYear() > 1900) {
            return `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`;
        }

        return dateStr;
    } catch (e) {
        return dateValue;
    }
}

function processValue(value, fieldName) {
    if (!value || value === "") return "";
    const isDateField = DATE_COLUMNS.some(dateField => fieldName === dateField || fieldName.includes(dateField));
    if (isDateField || value instanceof Date) return convertToDDMMYYYY(value);
    return String(value).trim();
}

function sanitizeKey(key) {
    if (!key) return "";
    return String(key).trim().replace(/[\.\#\$\/\[\]]/g, '_');
}

function cleanVal(val) {
    if (val === undefined || val === null) return "";
    return String(val).trim();
}

function showLoading() { 
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';
}
function hideLoading() { 
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

function showNotification(message, type = 'success') {
    Swal.fire({ icon: type, title: message, toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

async function loadData() {
    showLoading();
    try {
        const snap = await get(ref(db, 'Smart_Qabda'));
        if (snap.exists()) {
            const dataObj = snap.val();
            cachedAllData = Object.keys(dataObj).map(key => ({ ...dataObj[key], firebase_id: key }));
            currentResults = [...cachedAllData];
            console.log(`✅ Loaded ${cachedAllData.length} records`);
        } else {
            cachedAllData = [];
            currentResults = [];
        }
        renderTable();
        updateStats();
    } catch (e) {
        console.error("Error loading data:", e);
        Swal.fire('خطأ', 'فشل تحميل البيانات: ' + e.message, 'error');
    }
    hideLoading();
}

function updateStats() {
    const totalCountEl = document.getElementById('totalCount');
    const totalResultsEl = document.getElementById('totalResults');
    const visibleCountEl = document.getElementById('visibleCount');
    const rowCountLabelEl = document.getElementById('rowCountLabel');
    
    if (totalCountEl) totalCountEl.innerText = currentResults.length;
    if (totalResultsEl) totalResultsEl.innerText = currentResults.length;
    if (visibleCountEl) visibleCountEl.innerText = currentResults.length;
    if (rowCountLabelEl) rowCountLabelEl.innerHTML = `<i class="fas fa-database"></i> إجمالي العدادات: ${currentResults.length}`;
}

function renderTable() {
    const header = document.getElementById('tableHeaderRow');
    const tbody = document.getElementById('tableBody');
    if (!header || !tbody) return;

    header.innerHTML = `<th style="position:sticky; right:0; z-index:11; background:#3b82f6; min-width:100px;">الإجراءات</th>` +
        FULL_COLUMNS.map(c => `<th style="white-space:nowrap;">${c}</th>`).join('');

    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const pageData = currentResults.slice(start, start + ROWS_PER_PAGE);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" style="text-align:center; padding:50px;"><i class="fas fa-inbox"></i> لا توجد بيانات مطابقة للفلاتر</td></tr>`;
    } else {
        tbody.innerHTML = pageData.map(item => {
            const fId = item.firebase_id;
            return `<tr>
                <td style="position:sticky; right:0; z-index:5; background: #1e293b; border-left: 2px solid #334155;">
                    <div style="display:flex; gap:8px;">
                        <button class="save-row-btn" onclick="window.saveRow('${fId}', this)" style="background:#10b981; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; color:white;"><i class="fas fa-save"></i></button>
                        <button class="delete-row-btn" onclick="window.deleteRow('${fId}')" style="background:#ef4444; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; color:white;"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
                ${FULL_COLUMNS.map(col => {
                let val = item[col];
                if (val === undefined || val === null) val = "";
                const isDateColumn = col === "تاريخ التعاقد";
                return `<td contenteditable="true" data-key="${col}" data-id="${fId}" style="cursor:pointer; background:rgba(16,185,129,0.05); ${isDateColumn ? 'color:#f59e0b; font-weight:500;' : ''}">${escapeHtml(String(val))}</td>`;
            }).join('')}
            </tr>`;
        }).join('');
    }
    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(currentResults.length / ROWS_PER_PAGE);
    const pageInfoEl = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (pageInfoEl) pageInfoEl.innerText = `صفحة ${currentPage} من ${totalPages || 1}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

window.saveRow = async (id, btn) => {
    const tr = btn.closest('tr');
    const updates = {};
    tr.querySelectorAll('td[contenteditable="true"]').forEach(td => {
        const key = td.getAttribute('data-key');
        if (key) {
            let value = td.innerText.trim();
            if (key === "تاريخ التعاقد") value = convertToDDMMYYYY(value);
            updates[key] = value;
        }
    });
    if (Object.keys(updates).length === 0) return showNotification("لا توجد تغييرات للحفظ", "warning");
    try {
        await update(ref(db, `Smart_Qabda/${id}`), updates);
        showNotification("تم التعديل بنجاح", "success");
        await loadData();
    } catch (e) { Swal.fire('خطأ', 'فشل الحفظ: ' + e.message, 'error'); }
};

window.deleteRow = async (id) => {
    const res = await Swal.fire({ title: 'حذف السجل؟', text: "هل أنت متأكد؟", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء' });
    if (res.isConfirmed) {
        try {
            await remove(ref(db, `Smart_Qabda/${id}`));
            showNotification("تم الحذف بنجاح", "success");
            await loadData();
        } catch (e) { Swal.fire('خطأ', 'فشل الحذف: ' + e.message, 'error'); }
    }
};

function extractValue(row, standardColumn) {
    const possibleNames = COLUMN_MAPPING[standardColumn] || [standardColumn];
    for (const name of possibleNames) {
        const value = row[name];
        if (value !== undefined && value !== null && value !== "") return processValue(value, standardColumn);
    }
    return "";
}

function getMeterNumber(row) {
    const meterSources = COLUMN_MAPPING["رقم العداد"];
    for (const source of meterSources) {
        const value = row[source];
        if (value && value !== "") {
            let val = value;
            if (val instanceof Date) val = val.toLocaleDateString('en-GB');
            const cleanId = cleanVal(val);
            if (cleanId && !cleanId.toLowerCase().includes("po:")) return cleanId;
        }
    }
    return null;
}

// Process Upload Button
const processBtn = document.getElementById('processBtn');
if (processBtn) {
    processBtn.addEventListener('click', async () => {
        const files = document.getElementById('fileInput').files;
        const sessionDate = document.getElementById('RiseDate').value;
        if (files.length === 0 || !sessionDate) return Swal.fire('تنبيه', 'يرجى اختيار ملف وتحديد التاريخ', 'warning');
        showLoading();
        try {
            const meterDataMap = new Map();
            let totalRowsProcessed = 0, dateConversionsCount = 0;

            for (const file of files) {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                for (const row of json) {
                    totalRowsProcessed++;
                    const meterNumber = getMeterNumber(row);
                    if (!meterNumber) continue;
                    const cleanMeterId = String(meterNumber).replace(/\s+/g, '').trim();
                    let meterRecord = meterDataMap.get(cleanMeterId) || {};
                    
                    // First, extract all standard columns
                    for (const standardColumn of FULL_COLUMNS) {
                        let value = extractValue(row, standardColumn);
                        if (value && value !== "" && (!meterRecord[standardColumn] || meterRecord[standardColumn] === "")) {
                            meterRecord[standardColumn] = value;
                            if (standardColumn === "تاريخ التعاقد") dateConversionsCount++;
                        }
                    }
                    
                    // Handle InstallationDate and تاريخ التعاقد logic
                    let contractDate = meterRecord["تاريخ التعاقد"] || "";
                    let installDate = "";
                    
                    // Try to get InstallationDate from the row directly
                    const installDateRaw = extractValue(row, "InstallationDate");
                    if (installDateRaw) {
                        installDate = convertToDDMMYYYY(installDateRaw);
                    }
                    
                    // Also check for other possible date columns
                    if (!installDate) {
                        const possibleInstallDates = ["InstallationDate", "تاريخ التركيب", "Installation Date", "تركيب"];
                        for (const name of possibleInstallDates) {
                            const val = row[name];
                            if (val && val !== "") {
                                installDate = convertToDDMMYYYY(val);
                                break;
                            }
                        }
                    }
                    
                    // Apply the date logic
                    if (installDate && installDate !== "") {
                        if (contractDate && contractDate !== "") {
                            if (contractDate !== installDate) {
                                // Different dates - use InstallationDate
                                meterRecord["تاريخ التعاقد"] = installDate;
                                dateConversionsCount++;
                            }
                        } else {
                            // Only InstallationDate exists
                            meterRecord["تاريخ التعاقد"] = installDate;
                            dateConversionsCount++;
                        }
                    }
                    
                    // Remove InstallationDate from the record
                    delete meterRecord["InstallationDate"];
                    delete meterRecord["تاريخ التركيب"];
                    
                    // Handle Address Region to فرع
                    const addressRegion = extractValue(row, "Address (Region)");
                    const branchField = meterRecord["فرع"] || "";
                    if (addressRegion && (!branchField || branchField === "")) {
                        meterRecord["فرع"] = addressRegion;
                    }
                    
                    // Handle General Region to قطاع
                    const generalRegion = extractValue(row, "Address (General Region)");
                    const sectorField = meterRecord["قطاع"] || "";
                    if (generalRegion && (!sectorField || sectorField === "")) {
                        meterRecord["قطاع"] = generalRegion;
                    }
                    
                    meterDataMap.set(cleanMeterId, meterRecord);
                }
            }

            if (meterDataMap.size === 0) {
                Swal.fire('تنبيه', 'لم يتم العثور على أي أرقام عدادات صالحة', 'warning');
                hideLoading();
                return;
            }

            const existingSnap = await get(ref(db, 'Smart_Qabda'));
            const existingDataMap = existingSnap.exists() ? existingSnap.val() : {};
            const updatesMap = {};
            let added = 0, updated = 0;

            // Convert session date from YYYY-MM-DD to DD/MM/YYYY
            const formattedSessionDate = sessionDate.split('-').reverse().join('/');

            for (const [meterId, newData] of meterDataMap.entries()) {
                const firebaseKey = sanitizeKey(meterId);
                const existingData = existingDataMap[firebaseKey] || {};
                const mergedRow = { ...existingData };
                let hasNewData = false;
                
                for (const [key, value] of Object.entries(newData)) {
                    if (value && value !== "" && (!existingData[key] || existingData[key] === "")) {
                        mergedRow[key] = value;
                        hasNewData = true;
                    }
                }
                
                mergedRow["رقم العداد"] = meterId;
                mergedRow["rise_date_session"] = formattedSessionDate;
                
                // Ensure InstallationDate is not saved
                delete mergedRow["InstallationDate"];
                delete mergedRow["تاريخ التركيب"];
                
                if (hasNewData || !existingDataMap[firebaseKey]) {
                    updatesMap[`Smart_Qabda/${firebaseKey}`] = mergedRow;
                    if (existingDataMap[firebaseKey]) updated++;
                    else added++;
                }
            }

            if (Object.keys(updatesMap).length > 0) {
                await update(ref(db), updatesMap);
                Swal.fire({ 
                    icon: 'success', 
                    title: '✅ تم الرفع والربط بنجاح', 
                    html: `<div style="text-align:right;">
                        <p>🆕 تمت إضافة: <strong>${added}</strong> عداد جديد</p>
                        <p>🔄 تم تحديث: <strong>${updated}</strong> عداد</p>
                        <p>📊 إجمالي: <strong>${meterDataMap.size}</strong> عداد</p>
                        <p>📅 تم تحويل <strong>${dateConversionsCount}</strong> تاريخ تعاقد</p>
                        <p>📁 تمت معالجة: ${files.length} ملف</p>
                        <p>🔢 إجمالي الصفوف: ${totalRowsProcessed}</p>
                    </div>`, 
                    confirmButtonText: 'حسناً' 
                }).then(() => loadData());
            } else {
                Swal.fire('مكتمل', 'جميع البيانات محدثة بالفعل', 'info');
            }
        } catch (e) { 
            console.error("Upload error:", e);
            Swal.fire('خطأ', 'فشل في معالجة الملفات: ' + e.message, 'error'); 
        }
        hideLoading();
    });
}

// Apply Filter Button
const applyFilterBtn = document.getElementById('applyFilterBtn');
if (applyFilterBtn) {
    applyFilterBtn.addEventListener('click', () => {
        const meterVal = cleanVal(document.getElementById('searchMeter')?.value || '').toLowerCase();
        const simVal = cleanVal(document.getElementById('searchSIM')?.value || '').toLowerCase();
        
        // Handle rise date search
        const riseDateVal = document.getElementById('searchRiseDate')?.value || '';
        let formattedRiseDateVal = '';
        if (riseDateVal) {
            formattedRiseDateVal = riseDateVal.split('-').reverse().join('/');
        }
        
        // Handle contract date search
        let contractDateVal = document.getElementById('searchContractDate')?.value || '';
        if (contractDateVal) {
            const parts = contractDateVal.split('-');
            if (parts.length === 3) {
                contractDateVal = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }
        
        const regionVal = cleanVal(document.getElementById('searchGenRegion')?.value || '').toLowerCase();
        const branchVal = cleanVal(document.getElementById('searchRegion')?.value || '').toLowerCase();
        const typeVal = cleanVal(document.getElementById('filterType')?.value || '').toUpperCase();

        currentResults = cachedAllData.filter(item => {
            const mNum = (item["رقم العداد"] || "").toString().toLowerCase();
            const sNum = (item["SIM_S_Num"] || "").toString().toLowerCase();
            const rDate = (item["rise_date_session"] || "").toString();
            const contractDate = (item["تاريخ التعاقد"] || "").toString();
            const region = (item["قطاع"] || item["Address (General Region)"] || "").toString().toLowerCase();
            const branch = (item["فرع"] || item["DiscoBranch"] || "").toString().toLowerCase();
            const mType = (item["TYPE"] || item["Meter type name"] || "").toString().toUpperCase();

            const mMatch = meterVal ? mNum.includes(meterVal) : true;
            const sMatch = simVal ? sNum.includes(simVal) : true;
            const rMatch = formattedRiseDateVal ? rDate === formattedRiseDateVal : true;
            const cMatch = contractDateVal ? contractDate === contractDateVal : true;
            const regionMatch = regionVal ? region.includes(regionVal) : true;
            const branchMatch = branchVal ? branch.includes(branchVal) : true;
            const typeMatch = typeVal ? mType.includes(typeVal) : true;

            return mMatch && sMatch && rMatch && cMatch && regionMatch && branchMatch && typeMatch;
        });

        currentPage = 1;
        renderTable();
        updateStats();
    });
}

// Pagination Buttons
const nextBtn = document.getElementById('nextPageBtn');
const prevBtn = document.getElementById('prevPageBtn');

if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(currentResults.length / ROWS_PER_PAGE);
        if (currentPage < totalPages) { currentPage++; renderTable(); }
    });
}

if (prevBtn) {
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTable(); }
    });
}

// Clear Filters Button
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
        const inputs = document.querySelectorAll('#searchTab input, #searchTab select');
        inputs.forEach(i => i.value = "");
        currentResults = [...cachedAllData];
        currentPage = 1;
        renderTable();
        updateStats();
    });
}

// Refresh Button
const refreshBtn = document.getElementById('refreshDataBtn');
if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadData());
}

// Export Button
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        if (currentResults.length === 0) return Swal.fire('تنبيه', 'لا توجد بيانات للتصدير', 'warning');
        const exportData = currentResults.map(item => { const obj = {}; FULL_COLUMNS.forEach(col => obj[col] = item[col] || ""); return obj; });
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Smart Meters");
        XLSX.writeFile(wb, `smart_meters_${new Date().toISOString().split('T')[0]}.xlsx`);
        showNotification(`تم تصدير ${currentResults.length} سجل`, "success");
    });
}

// Delete All Button
const deleteAllBtn = document.getElementById('deleteAllDataBtn');
if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', async () => {
        const res = await Swal.fire({ title: 'مسح شامل؟', text: "سيتم حذف كل البيانات نهائياً", icon: 'error', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'نعم، احذف الكل', cancelButtonText: 'إلغاء' });
        if (res.isConfirmed) {
            showLoading();
            await remove(ref(db, 'Smart_Qabda'));
            await loadData();
            hideLoading();
            showNotification("تم حذف جميع البيانات", "success");
        }
    });
}

// File Input Handler
const fileInput = document.getElementById('fileInput');
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const container = document.getElementById('fileListContainer');
        const list = document.getElementById('fileList');
        if (e.target.files.length > 0) {
            if (container) container.style.display = 'block';
            if (list) {
                list.innerHTML = Array.from(e.target.files).map(f => `<li><i class="fas fa-file-excel"></i> ${f.name}</li>`).join('');
            }
        } else {
            if (container) container.style.display = 'none';
        }
    });
}

// Initialize
loadData();