// ---------- حالات التطبيق ----------
let currentView = 'list'; // list or kanban
let allNotes = [];
let editingId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadDarkMode();
    setupTabs();
    setupForm();
    setupSearch();
    setupExport();
    fetchNotes();
});

// ---------- الوضع الداكن ----------
function loadDarkMode() {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') document.body.classList.add('dark');
    document.getElementById('dark-mode-toggle').addEventListener('click', () => {
        document.body.classList.toggle('dark');
        localStorage.setItem('darkMode', document.body.classList.contains('dark'));
    });
}

// ---------- التبويبات ----------
function setupTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            document.getElementById('list-view').style.display = currentView === 'list' ? 'block' : 'none';
            document.getElementById('kanban-view').style.display = currentView === 'kanban' ? 'block' : 'none';
            renderNotes();
        });
    });
}

// ---------- البحث المباشر ----------
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', debounce(() => {
        fetchNotes(searchInput.value);
    }, 300));
}

function debounce(func, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

// ---------- جلب الملاحظات (مع فلتر البحث) ----------
async function fetchNotes(searchTerm = '') {
    try {
        let url = '/notes';
        const params = new URLSearchParams();
        if (searchTerm) params.set('search', searchTerm);
        if (params.toString()) url += '?' + params.toString();

        const res = await fetch(url);
        if (!res.ok) throw new Error('فشل الجلب');
        allNotes = await res.json();
        renderNotes();
    } catch (err) {
        console.error(err);
        showToast('خطأ في تحميل الملاحظات', 'error');
    }
}

// ---------- عرض الملاحظات حسب العرض الحالي ----------
function renderNotes() {
    if (currentView === 'list') renderListView();
    else renderKanbanView();
}

function renderListView() {
    const container = document.getElementById('notes-list');
    if (allNotes.length === 0) {
        container.innerHTML = '<div class="empty-message">لا توجد ملاحظات</div>';
        return;
    }
    container.innerHTML = allNotes.map(note => `
        <div class="note-card" data-id="${note.id}">
            <div class="note-icon">${note.icon || '📄'}</div>
            <div class="note-main">
                <h2>${escapeHtml(note.title)}</h2>
                <p>${escapeHtml(note.content)}</p>
                <div class="meta">
                    ${formatDate(note.created_at)} | ${note.status}
                </div>
                <div class="actions">
                    <button class="edit-btn" onclick="startEdit(${note.id})">✏️ تعديل</button>
                    <button class="delete-btn" onclick="deleteNote(${note.id})">🗑️ حذف</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderKanbanView() {
    const statuses = ['أفكار', 'قيد التنفيذ', 'مكتملة'];
    statuses.forEach(status => {
        const col = document.getElementById(`kanban-${status}`);
        if (!col) return;
        const notesInStatus = allNotes
            .filter(n => n.status === status)
            .sort((a,b) => a.order_index - b.order_index);
        col.innerHTML = notesInStatus.map(note => `
            <div class="note-card-kanban" draggable="true" data-id="${note.id}">
                <div class="note-icon">${note.icon || '📄'}</div>
                <div><strong>${escapeHtml(note.title)}</strong></div>
                <div class="kanban-actions">
                    <button onclick="startEdit(${note.id})" style="font-size:12px;">✏️</button>
                    <button onclick="deleteNote(${note.id})" style="font-size:12px; background:var(--danger)">🗑️</button>
                </div>
            </div>
        `).join('');
        // إضافة مستمعات السحب
        enableDrag(col);
    });
}

// ---------- سحب وإفلات كانبان ----------
let draggedItem = null;

function enableDrag(columnElement) {
    const items = columnElement.querySelectorAll('.note-card-kanban');
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });

    columnElement.addEventListener('dragover', handleDragOver);
    columnElement.addEventListener('drop', handleDrop);
}

function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.setData('text/plain', this.dataset.id);
    setTimeout(() => this.style.opacity = '0.4', 0);
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    draggedItem = null;
    // إعادة تعيين مؤشرات الأعمدة
    document.querySelectorAll('.kanban-items').forEach(col => col.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault();
    this.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    const id = parseInt(e.dataTransfer.getData('text/plain'));
    const targetColumn = this;
    // تحديد status الجديد من ID العمود (kanban-أفكار مثلاً)
    const newStatus = targetColumn.id.replace('kanban-', '');
    // تحديث الملاحظة
    updateNoteStatus(id, newStatus, targetColumn);
}

async function updateNoteStatus(id, newStatus, targetColumn) {
    try {
        // حساب order_index الجديد بناءً على موضع الإفلات
        const existingCards = Array.from(targetColumn.querySelectorAll('.note-card-kanban'));
        let orderIndex = existingCards.length; // إذا أضيف للنهاية
        // يمكن حساب index بناءً على مكان الإفلات الفعلي، لكن للسهولة نضعه في النهاية ونعيد الترتيب.
        // سنقوم بتحديث الملاحظة أولاً ثم نعيد جلب الجميع.
        await fetch(`/notes/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: newStatus, order_index: orderIndex })
        });
        // بعد التحديث، نعيد ترتيب باقي البطاقات في العمود الجديد
        await reorderColumn(newStatus);
        await fetchNotes();
        showToast('تم نقل الملاحظة', 'success');
    } catch (err) {
        console.error(err);
        showToast('فشل النقل', 'error');
        fetchNotes();
    }
}

async function reorderColumn(status) {
    const col = document.getElementById(`kanban-${status}`);
    if (!col) return;
    const cards = Array.from(col.querySelectorAll('.note-card-kanban'));
    const updates = cards.map((card, index) => ({
        id: parseInt(card.dataset.id),
        order_index: index
    }));
    if (updates.length === 0) return;
    await fetch('/notes/reorder', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ items: updates })
    });
}

// ---------- نموذج الإضافة والتعديل ----------
function setupForm() {
    document.getElementById('note-form').addEventListener('submit', handleSubmit);
    document.getElementById('cancel-btn').addEventListener('click', resetForm);
    // إظهار النموذج دائمًا
    document.getElementById('note-form').style.display = 'flex';
}

async function handleSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const content = document.getElementById('content').value.trim();
    const status = document.getElementById('status-select').value;
    const icon = document.getElementById('emoji-input').value.trim() || null;
    const id = document.getElementById('note-id').value;

    if (!title || !content) return showToast('العنوان والمحتوى مطلوبان', 'error');

    const payload = { title, content, status, icon };
    try {
        if (id) {
            await fetch(`/notes/${id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            showToast('تم التحديث', 'success');
        } else {
            await fetch('/notes', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            showToast('تمت الإضافة', 'success');
        }
        resetForm();
        fetchNotes();
    } catch (err) {
        console.error(err);
        showToast('خطأ في العملية', 'error');
    }
}

window.startEdit = async function(id) {
    const note = allNotes.find(n => n.id === id);
    if (!note) {
        // نجلبها من الخادم إذا لم تكن في القائمة الحالية
        const res = await fetch(`/notes/${id}`);
        const data = await res.json();
        fillForm(data);
    } else {
        fillForm(note);
    }
    editingId = id;
    document.getElementById('cancel-btn').style.display = 'inline-block';
    document.getElementById('save-btn').textContent = 'تحديث';
};

function fillForm(note) {
    document.getElementById('note-id').value = note.id;
    document.getElementById('title').value = note.title;
    document.getElementById('content').value = note.content;
    document.getElementById('status-select').value = note.status;
    document.getElementById('emoji-input').value = note.icon || '';
}

function resetForm() {
    document.getElementById('note-form').reset();
    document.getElementById('note-id').value = '';
    document.getElementById('save-btn').textContent = 'حفظ';
    document.getElementById('cancel-btn').style.display = 'none';
    editingId = null;
}

// ---------- حذف ملاحظة ----------
window.deleteNote = async function(id) {
    if (!confirm('هل تريد حذف هذه الملاحظة؟')) return;
    try {
        await fetch(`/notes/${id}`, { method: 'DELETE' });
        showToast('تم الحذف', 'success');
        fetchNotes();
    } catch (err) {
        console.error(err);
        showToast('فشل الحذف', 'error');
    }
};

// ---------- تصدير ----------
function setupExport() {
    document.getElementById('export-btn').addEventListener('click', () => {
        const dataStr = JSON.stringify(allNotes, null, 2);
        const blob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-notes.json';
        a.click();
        showToast('تم التصدير', 'success');
    });
}

// ---------- إشعارات ----------
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ---------- دوال مساعدة ----------
function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(iso) {
    return new Date(iso).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' });
}