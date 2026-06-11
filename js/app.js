/* ============================================
   Krypton Vault 鈥?瀵嗙爜绠＄悊鍣?
   Core Application Logic
   ============================================ */

// ============ 甯搁噺涓庣姸鎬?============
const STORAGE_KEY = 'kv_encrypted_vault';
const SETTINGS_KEY = 'kv_settings';
const SALT_KEY = 'kv_salt';
const VAULT_VERSION = 1;

const CATEGORY_ICONS = {
    social: '馃挰',
    email: '馃摟',
    finance: '馃挵',
    work: '馃捈',
    other: '馃搶'
};

const CATEGORY_COLORS = {
    social: '#60a5fa',
    email: '#f472b6',
    finance: '#4ade80',
    work: '#fbbf24',
    other: '#a78bfa'
};

let appState = {
    masterKey: null,
    masterPassword: null,
    entries: [],
    settings: {
        vaultName: 'Krypton Vault',
        autoLockMinutes: 5,
    },
    selectedEntryId: null,
    currentCategory: 'all',
    autoLockTimer: null,
    generatedPassword: '',
};

// ============ DOM 鍏冪礌缂撳瓨 ============
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

const dom = {
    lockScreen: $('#lockScreen'),
    mainScreen: $('#mainScreen'),
    appTitle: $('#appTitle'),
    setupSection: $('#setupSection'),
    unlockSection: $('#unlockSection'),
    masterSetup: $('#masterSetup'),
    masterSetupConfirm: $('#masterSetupConfirm'),
    masterUnlock: $('#masterUnlock'),
    btnSetup: $('#btnSetup'),
    btnUnlock: $('#btnUnlock'),
    btnReset: $('#btnReset'),
    unlockError: $('#unlockError'),
    strengthBar: $('#strengthBar'),
    headerTitle: $('#headerTitle'),
    searchInput: $('#searchInput'),
    btnAdd: $('#btnAdd'),
    btnGenerator: $('#btnGenerator'),
    btnSettings: $('#btnSettings'),
    btnLock: $('#btnLock'),
    entryList: $('#entryList'),
    emptyState: $('#emptyState'),
    catChips: $$('.cat-chip'),
    entryModal: $('#entryModal'),
    modalTitle: $('#modalTitle'),
    entryName: $('#entryName'),
    entryUrl: $('#entryUrl'),
    entryUsername: $('#entryUsername'),
    entryPassword: $('#entryPassword'),
    entryCategory: $('#entryCategory'),
    entryNotes: $('#entryNotes'),
    entryId: $('#entryId'),
    btnTogglePw: $('#btnTogglePw'),
    btnGenPw: $('#btnGenPw'),
    btnModalSave: $('#btnModalSave'),
    btnModalCancel: $('#btnModalCancel'),
    btnModalClose: $('#btnModalClose'),
    generatorModal: $('#generatorModal'),
    generatedPassword: $('#generatedPassword'),
    pwLength: $('#pwLength'),
    lenValue: $('#lenValue'),
    genUpper: $('#genUpper'),
    genLower: $('#genLower'),
    genNumber: $('#genNumber'),
    genSymbol: $('#genSymbol'),
    btnGenerate: $('#btnGenerate'),
    btnCopyGen: $('#btnCopyGen'),
    btnUseGen: $('#btnUseGen'),
    btnGenClose: $('#btnGenClose'),
    settingsModal: $('#settingsModal'),
    settingsVaultName: $('#settingsVaultName'),
    settingsAutoLock: $('#settingsAutoLock'),
    settingsOldMaster: $('#settingsOldMaster'),
    settingsNewMaster: $('#settingsNewMaster'),
    btnExport: $('#btnExport'),
    btnImport: $('#btnImport'),
    importFile: $('#importFile'),
    btnResetAll: $('#btnResetAll'),
    btnSettingsSave: $('#btnSettingsSave'),
    btnSettingsClose: $('#btnSettingsClose'),
    toast: $('#toast'),
};

// ============ 宸ュ叿鍑芥暟 ============
function showToast(msg, type = '') {
    const toast = dom.toast;
    toast.textContent = msg;
    toast.className = 'toast ' + type + ' show';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 2200);
}

function switchScreen(show) {
    dom.lockScreen.classList.toggle('active', show === 'lock');
    dom.mainScreen.classList.toggle('active', show === 'main');
}

function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function closeAllModals() {
    [dom.entryModal, dom.generatorModal, dom.settingsModal].forEach(closeModal);
}

// ============ 瀵嗙爜寮哄害 ============
function evaluateStrength(password) {
    if (!password) return '';
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (password.length >= 16) score++;
    if (score <= 2) return 'weak';
    if (score <= 4) return 'fair';
    if (score <= 6) return 'good';
    return 'strong';
}

function updateStrengthBar(password) {
    const bar = dom.strengthBar;
    const level = evaluateStrength(password);
    bar.className = 'password-strength ' + level;
}

// ============ 鍔犲瘑 / 瑙ｅ瘑 ============
function arrayBufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
}

async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptData(key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(JSON.stringify(data))
    );
    return {
        iv: arrayBufferToBase64(iv),
        data: arrayBufferToBase64(encrypted),
        version: VAULT_VERSION,
    };
}

async function decryptData(key, encryptedObj) {
    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: base64ToArrayBuffer(encryptedObj.iv) },
            key,
            base64ToArrayBuffer(encryptedObj.data)
        );
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch {
        return null;
    }
}

// ============ 鎸佷箙鍖?============
function saveEncryptedVault(encryptedData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(encryptedData));
}

function getEncryptedVault() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
}

function getSalt() {
    let saltB64 = localStorage.getItem(SALT_KEY);
    if (!saltB64) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        saltB64 = arrayBufferToBase64(salt);
        localStorage.setItem(SALT_KEY, saltB64);
    }
    return base64ToArrayBuffer(saltB64);
}

function loadSettings() {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
        try { Object.assign(appState.settings, JSON.parse(raw)); } catch {}
    }
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(appState.settings));
    dom.headerTitle.textContent = appState.settings.vaultName;
    dom.appTitle.textContent = appState.settings.vaultName;
    document.title = appState.settings.vaultName + ' 鈥?瀵嗙爜绠＄悊鍣?;
}

// ============ 搴旂敤鍒濆鍖?============
async function init() {
    loadSettings();
    dom.headerTitle.textContent = appState.settings.vaultName;
    dom.appTitle.textContent = appState.settings.vaultName;
    document.title = appState.settings.vaultName + ' 鈥?瀵嗙爜绠＄悊鍣?;
    dom.settingsVaultName.value = appState.settings.vaultName;
    dom.settingsAutoLock.value = appState.settings.autoLockMinutes;

    const vault = getEncryptedVault();
    if (vault) {
        dom.setupSection.classList.add('hidden');
        dom.unlockSection.classList.remove('hidden');
    } else {
        dom.setupSection.classList.remove('hidden');
        dom.unlockSection.classList.add('hidden');
    }

    switchScreen('lock');
    bindEvents();
}

// ============ 鍒涘缓淇濋櫓搴?============
async function createVault() {
    const password = dom.masterSetup.value;
    const confirm = dom.masterSetupConfirm.value;
    if (!password || password.length < 4) { showToast('瀵嗙爜闀垮害鑷冲皯4浣?, 'error'); return; }
    if (password !== confirm) { showToast('涓ゆ瀵嗙爜涓嶄竴鑷?, 'error'); return; }
    const salt = getSalt();
    const key = await deriveKey(password, salt);
    const entries = [];
    const encrypted = await encryptData(key, { entries, version: VAULT_VERSION });
    saveEncryptedVault(encrypted);
    appState.masterKey = key;
    appState.masterPassword = password;
    appState.entries = entries;
    switchScreen('main');
    renderEntries();
    startAutoLockTimer();
    showToast('淇濋櫓搴撳垱寤烘垚鍔燂紒', 'success');
    dom.masterSetup.value = '';
    dom.masterSetupConfirm.value = '';
}

// ============ 瑙ｉ攣 ============
async function unlockVault() {
    const password = dom.masterUnlock.value;
    if (!password) { showToast('璇疯緭鍏ヤ富瀵嗙爜', 'error'); return; }
    const salt = getSalt();
    const key = await deriveKey(password, salt);
    const vault = getEncryptedVault();
    if (!vault) { dom.unlockError.textContent = '鏈壘鍒颁繚闄╁簱鏁版嵁'; return; }
    const data = await decryptData(key, vault);
    if (data === null) { dom.unlockError.textContent = '涓诲瘑鐮侀敊璇紝璇烽噸璇?; dom.masterUnlock.value = ''; return; }
    appState.masterKey = key;
    appState.masterPassword = password;
    appState.entries = data.entries || [];
    dom.unlockError.textContent = '';
    dom.masterUnlock.value = '';
    switchScreen('main');
    renderEntries();
    startAutoLockTimer();
    showToast(`娆㈣繋鍥炴潵锛屽叡 ${appState.entries.length} 鏉¤褰昤, 'success');
}

// ============ 閿佸畾 ============
function lockVault() {
    clearTimeout(appState.autoLockTimer);
    appState.masterKey = null;
    appState.masterPassword = null;
    appState.entries = [];
    appState.currentCategory = 'all';
    appState.selectedEntryId = null;
    dom.searchInput.value = '';
    dom.entryList.innerHTML = '';
    dom.emptyState.classList.add('hidden');
    const vault = getEncryptedVault();
    dom.setupSection.classList.toggle('hidden', !!vault);
    dom.unlockSection.classList.toggle('hidden', !vault);
    closeAllModals();
    switchScreen('lock');
}

function startAutoLockTimer() {
    clearTimeout(appState.autoLockTimer);
    const mins = appState.settings.autoLockMinutes;
    if (mins > 0) {
        appState.autoLockTimer = setTimeout(() => { lockVault(); showToast('宸茶嚜鍔ㄩ攣瀹?); }, mins * 60 * 1000);
    }
}

function resetAutoLockTimer() {
    if (appState.masterKey) startAutoLockTimer();
}

async function persistVault() {
    if (!appState.masterKey) return;
    const encrypted = await encryptData(appState.masterKey, { entries: appState.entries, version: VAULT_VERSION });
    saveEncryptedVault(encrypted);
}

// ============ 瀵嗙爜鏉＄洰鎿嶄綔 ============
function generateId() {
    return 'e_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

function openAddModal() {
    dom.modalTitle.textContent = '鏂板瀵嗙爜';
    dom.entryName.value = '';
    dom.entryUrl.value = '';
    dom.entryUsername.value = '';
    dom.entryPassword.value = '';
    dom.entryCategory.value = 'social';
    dom.entryNotes.value = '';
    dom.entryId.value = '';
    dom.entryPassword.type = 'password';
    dom.btnTogglePw.textContent = '馃憗锔?;
    openModal(dom.entryModal);
    dom.entryName.focus();
}

function openEditModal(entry) {
    dom.modalTitle.textContent = '缂栬緫瀵嗙爜';
    dom.entryName.value = entry.name;
    dom.entryUrl.value = entry.url || '';
    dom.entryUsername.value = entry.username;
    dom.entryPassword.value = entry.password;
    dom.entryCategory.value = entry.category;
    dom.entryNotes.value = entry.notes || '';
    dom.entryId.value = entry.id;
    dom.entryPassword.type = 'password';
    dom.btnTogglePw.textContent = '馃憗锔?;
    openModal(dom.entryModal);
    dom.entryName.focus();
}

async function saveEntry() {
    const name = dom.entryName.value.trim();
    const username = dom.entryUsername.value.trim();
    const password = dom.entryPassword.value;
    if (!name || !username || !password) { showToast('璇峰～鍐欏悕绉般€佺敤鎴峰悕鍜屽瘑鐮?, 'error'); return; }
    const entry = {
        id: dom.entryId.value || generateId(),
        name, url: dom.entryUrl.value.trim(), username, password,
        category: dom.entryCategory.value, notes: dom.entryNotes.value.trim(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const existingIdx = appState.entries.findIndex(e => e.id === entry.id);
    if (existingIdx >= 0) { entry.createdAt = appState.entries[existingIdx].createdAt; appState.entries[existingIdx] = entry; }
    else { appState.entries.unshift(entry); }
    await persistVault();
    renderEntries();
    closeModal(dom.entryModal);
    showToast(existingIdx >= 0 ? '瀵嗙爜宸叉洿鏂? : '瀵嗙爜宸蹭繚瀛?, 'success');
}

async function deleteEntry(id) {
    if (!confirm('纭畾瑕佸垹闄よ繖鏉″瘑鐮佸悧锛熸鎿嶄綔涓嶅彲鎭㈠銆?)) return;
    appState.entries = appState.entries.filter(e => e.id !== id);
    await persistVault();
    renderEntries();
    showToast('宸插垹闄?, 'success');
}

async function copyToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(`${label || '宸?}澶嶅埗鍒板壀璐存澘`, 'success');
    } catch {
        const ta = document.createElement('textarea'); ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        showToast(`${label || '宸?}澶嶅埗鍒板壀璐存澘`, 'success');
    }
}

function renderEntries() {
    let entries = [...appState.entries];
    if (appState.currentCategory !== 'all') entries = entries.filter(e => e.category === appState.currentCategory);
    const query = dom.searchInput.value.trim().toLowerCase();
    if (query) {
        entries = entries.filter(e => e.name.toLowerCase().includes(query) || e.username.toLowerCase().includes(query) || (e.url && e.url.toLowerCase().includes(query)) || (e.notes && e.notes.toLowerCase().includes(query)));
    }
    if (entries.length === 0) {
        dom.entryList.innerHTML = '';
        dom.emptyState.classList.remove('hidden');
        dom.emptyState.querySelector('p').textContent = (query || appState.currentCategory !== 'all') ? '娌℃湁鍖归厤鐨勮褰? : '杩樻病鏈変繚瀛樹换浣曞瘑鐮?;
        return;
    }
    dom.emptyState.classList.add('hidden');
    dom.entryList.innerHTML = entries.map(entry => {
        const initial = entry.name.charAt(0).toUpperCase();
        const catColor = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.other;
        return `<div class="entry-card" data-id="${entry.id}" data-category="${entry.category}"><div class="entry-avatar" style="background:${catColor}22;color:${catColor}">${initial}</div><div class="entry-info"><div class="entry-name">${escapeHtml(entry.name)}</div><div class="entry-username">${escapeHtml(entry.username)}</div></div><div class="entry-actions"><button class="entry-action-btn copy-user" data-id="${entry.id}" title="澶嶅埗鐢ㄦ埛鍚?>馃搵</button><button class="entry-action-btn copy-pass" data-id="${entry.id}" title="澶嶅埗瀵嗙爜">馃攽</button><button class="entry-action-btn delete" data-id="${entry.id}" title="鍒犻櫎">馃棏锔?/button></div></div>`;
    }).join('');
    dom.entryList.querySelectorAll('.entry-card').forEach(card => {
        card.addEventListener('click', (e) => { if (e.target.closest('.entry-action-btn')) return; const entry = appState.entries.find(e => e.id === card.dataset.id); if (entry) openEditModal(entry); });
    });
    dom.entryList.querySelectorAll('.copy-user').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); const entry = appState.entries.find(e => e.id === btn.dataset.id); if (entry) copyToClipboard(entry.username, '鐢ㄦ埛鍚?); }); });
    dom.entryList.querySelectorAll('.copy-pass').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); const entry = appState.entries.find(e => e.id === btn.dataset.id); if (entry) copyToClipboard(entry.password, '瀵嗙爜'); }); });
    dom.entryList.querySelectorAll('.delete').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); deleteEntry(btn.dataset.id); }); });
}

function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

function generatePassword() {
    const length = parseInt(dom.pwLength.value);
    const useUpper = dom.genUpper.checked, useLower = dom.genLower.checked, useNumber = dom.genNumber.checked, useSymbol = dom.genSymbol.checked;
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower = 'abcdefghijklmnopqrstuvwxyz', numbers = '0123456789', symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    let chars = '';
    if (useUpper) chars += upper; if (useLower) chars += lower; if (useNumber) chars += numbers; if (useSymbol) chars += symbols;
    if (!chars) { showToast('璇疯嚦灏戦€夋嫨涓€绉嶅瓧绗︾被鍨?, 'error'); return ''; }
    let password = '';
    if (useUpper) password += upper[Math.floor(Math.random() * upper.length)];
    if (useLower) password += lower[Math.floor(Math.random() * lower.length)];
    if (useNumber) password += numbers[Math.floor(Math.random() * numbers.length)];
    if (useSymbol) password += symbols[Math.floor(Math.random() * symbols.length)];
    const array = new Uint32Array(length - password.length);
    crypto.getRandomValues(array);
    for (let i = 0; i < array.length; i++) password += chars[array[i] % chars.length];
    password = password.split('').sort(() => { const arr = new Uint32Array(1); crypto.getRandomValues(arr); return (arr[0] % 2) ? 1 : -1; }).join('');
    return password;
}

async function exportData() {
    const password = prompt('璇疯緭鍏ヤ富瀵嗙爜浠ョ‘璁ゅ鍑猴細'); if (!password) return;
    const salt = getSalt(); const key = await deriveKey(password, salt);
    const vault = getEncryptedVault(); const data = await decryptData(key, vault);
    if (data === null) { showToast('瀵嗙爜閿欒', 'error'); return; }
    const exportObj = { appName: appState.settings.vaultName, exportedAt: new Date().toISOString(), version: VAULT_VERSION, entries: data.entries };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `krypton-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url); showToast('瀵煎嚭鎴愬姛锛岃濡ュ杽淇濈澶囦唤鏂囦欢', 'success');
}

async function importData() {
    const file = dom.importFile.files[0]; if (!file) return;
    if (!confirm('瀵煎叆灏嗘浛鎹㈠綋鍓嶆墍鏈夋暟鎹紝纭畾缁х画鍚楋紵')) { dom.importFile.value = ''; return; }
    try {
        const text = await file.text(); const importObj = JSON.parse(text);
        if (!importObj.entries || !Array.isArray(importObj.entries)) throw new Error('鏃犳晥鐨勫浠芥枃浠舵牸寮?);
        appState.entries = importObj.entries.map(e => ({ id: e.id || generateId(), name: e.name || 'Unknown', url: e.url || '', username: e.username || '', password: e.password || '', category: e.category || 'other', notes: e.notes || '', createdAt: e.createdAt || new Date().toISOString(), updatedAt: e.updatedAt || new Date().toISOString() }));
        await persistVault(); renderEntries(); showToast(`鎴愬姛瀵煎叆 ${appState.entries.length} 鏉¤褰昤, 'success');
    } catch { showToast('瀵煎叆澶辫触锛氭棤鏁堢殑鏂囦欢鏍煎紡', 'error'); }
    dom.importFile.value = '';
}

async function changeMasterPassword() {
    const oldPw = dom.settingsOldMaster.value, newPw = dom.settingsNewMaster.value;
    if (!oldPw && !newPw) return;
    if (!oldPw) { showToast('璇疯緭鍏ュ綋鍓嶄富瀵嗙爜', 'error'); return; }
    if (!newPw || newPw.length < 4) { showToast('鏂板瘑鐮佽嚦灏?浣?, 'error'); return; }
    if (oldPw !== appState.masterPassword) { showToast('褰撳墠涓诲瘑鐮侀敊璇?, 'error'); return; }
    const salt = getSalt(); const newKey = await deriveKey(newPw, salt);
    appState.masterKey = newKey; appState.masterPassword = newPw;
    await persistVault(); showToast('涓诲瘑鐮佸凡鏇存柊', 'success');
    dom.settingsOldMaster.value = ''; dom.settingsNewMaster.value = '';
}

async function resetAll() {
    if (!confirm('鈿狅笍 纭畾瑕佸垹闄ゆ墍鏈夋暟鎹悧锛熸鎿嶄綔涓嶅彲鎭㈠锛乗n\n璇风‘淇濆凡瀵煎嚭澶囦唤銆?)) return;
    if (!confirm('鍐嶆纭锛氬垹闄ゆ墍鏈夊瘑鐮佹暟鎹紵')) return;
    localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(SALT_KEY); localStorage.removeItem(SETTINGS_KEY);
    appState.entries = []; appState.masterKey = null; appState.masterPassword = null;
    appState.settings = { vaultName: 'Krypton Vault', autoLockMinutes: 5 };
    closeAllModals(); showToast('鎵€鏈夋暟鎹凡娓呴櫎', 'success');
    setTimeout(() => location.reload(), 500);
}

function bindEvents() {
    dom.btnSetup.addEventListener('click', createVault);
    dom.masterSetupConfirm.addEventListener('keydown', (e) => { if (e.key === 'Enter') createVault(); });
    dom.btnUnlock.addEventListener('click', unlockVault);
    dom.masterUnlock.addEventListener('keydown', (e) => { if (e.key === 'Enter') unlockVault(); });
    dom.masterSetup.addEventListener('input', () => updateStrengthBar(dom.masterSetup.value));
    dom.btnLock.addEventListener('click', lockVault);
    dom.btnReset.addEventListener('click', () => { if (confirm('纭畾瑕侀噸缃繚闄╁簱鍚楋紵鎵€鏈夋暟鎹皢琚竻闄ゃ€?)) resetAll(); });
    dom.btnAdd.addEventListener('click', openAddModal);
    dom.searchInput.addEventListener('input', renderEntries);
    dom.catChips.forEach(chip => { chip.addEventListener('click', () => { dom.catChips.forEach(c => c.classList.remove('active')); chip.classList.add('active'); appState.currentCategory = chip.dataset.cat; renderEntries(); }); });
    dom.btnModalSave.addEventListener('click', saveEntry);
    dom.btnModalCancel.addEventListener('click', () => closeModal(dom.entryModal));
    dom.btnModalClose.addEventListener('click', () => closeModal(dom.entryModal));
    dom.entryModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(dom.entryModal));
    dom.btnTogglePw.addEventListener('click', () => { const isPw = dom.entryPassword.type === 'password'; dom.entryPassword.type = isPw ? 'text' : 'password'; dom.btnTogglePw.textContent = isPw ? '馃檲' : '馃憗锔?; });
    dom.btnGenPw.addEventListener('click', () => { const pw = generatePassword(); if (pw) { dom.entryPassword.value = pw; dom.entryPassword.type = 'text'; dom.btnTogglePw.textContent = '馃檲'; showToast('闅忔満瀵嗙爜宸茬敓鎴?, 'success'); } });
    dom.btnGenerator.addEventListener('click', () => { appState.generatedPassword = ''; dom.generatedPassword.textContent = '鐐瑰嚮鐢熸垚'; openModal(dom.generatorModal); });
    dom.btnGenClose.addEventListener('click', () => closeModal(dom.generatorModal));
    dom.generatorModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(dom.generatorModal));
    dom.pwLength.addEventListener('input', () => { dom.lenValue.textContent = dom.pwLength.value; appState.generatedPassword = ''; dom.generatedPassword.textContent = '鐐瑰嚮鐢熸垚'; });
    dom.btnGenerate.addEventListener('click', () => { const pw = generatePassword(); if (pw) { appState.generatedPassword = pw; dom.generatedPassword.textContent = pw; } });
    dom.btnCopyGen.addEventListener('click', () => { if (appState.generatedPassword) copyToClipboard(appState.generatedPassword, '瀵嗙爜'); else showToast('璇峰厛鐢熸垚瀵嗙爜', 'error'); });
    dom.btnUseGen.addEventListener('click', () => { if (appState.generatedPassword) { dom.entryPassword.value = appState.generatedPassword; dom.entryPassword.type = 'text'; dom.btnTogglePw.textContent = '馃檲'; closeModal(dom.generatorModal); if (!dom.entryModal.classList.contains('active')) { openAddModal(); dom.entryPassword.value = appState.generatedPassword; dom.entryPassword.type = 'text'; dom.btnTogglePw.textContent = '馃檲'; } } else showToast('璇峰厛鐢熸垚瀵嗙爜', 'error'); });
    dom.btnSettings.addEventListener('click', () => { dom.settingsVaultName.value = appState.settings.vaultName; dom.settingsAutoLock.value = appState.settings.autoLockMinutes; dom.settingsOldMaster.value = ''; dom.settingsNewMaster.value = ''; openModal(dom.settingsModal); });
    dom.btnSettingsClose.addEventListener('click', () => closeModal(dom.settingsModal));
    dom.settingsModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(dom.settingsModal));
    dom.btnSettingsSave.addEventListener('click', async () => { appState.settings.vaultName = dom.settingsVaultName.value.trim() || 'Krypton Vault'; appState.settings.autoLockMinutes = Math.max(0, Math.min(60, parseInt(dom.settingsAutoLock.value) || 0)); saveSettings(); await changeMasterPassword(); closeModal(dom.settingsModal); startAutoLockTimer(); showToast('璁剧疆宸蹭繚瀛?, 'success'); });
    dom.btnExport.addEventListener('click', exportData);
    dom.btnImport.addEventListener('click', () => dom.importFile.click());
    dom.importFile.addEventListener('change', importData);
    dom.btnResetAll.addEventListener('click', resetAll);
    dom.appTitle.addEventListener('blur', () => { appState.settings.vaultName = dom.appTitle.textContent.trim() || 'Krypton Vault'; saveSettings(); });
    dom.appTitle.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dom.appTitle.blur(); } });
    document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'l') { if (appState.masterKey) { e.preventDefault(); lockVault(); } } if ((e.ctrlKey || e.metaKey) && e.key === 'n') { if (appState.masterKey) { e.preventDefault(); openAddModal(); } } if (e.key === 'Escape') closeAllModals(); });
    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(evt => { document.addEventListener(evt, () => { if (appState.masterKey) resetAutoLockTimer(); }, { passive: true }); });
}

init();
console.log('%c馃攼 Krypton Vault %c宸插氨缁?, 'font-size:1.2em;font-weight:bold;color:#7c5cfc;', 'color:#aaa;');
console.log('%c鎵€鏈夋暟鎹粎瀛樺偍鍦ㄦ偍鐨勬祻瑙堝櫒鏈湴锛岄€氳繃 AES-256-GCM 鍔犲瘑淇濇姢銆?, 'color:#888;font-style:italic;');