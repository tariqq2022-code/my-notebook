import os
import sqlite3

DATABASE_NAME = os.path.join('/tmp', 'notes.db')

def get_connection():
    conn = sqlite3.connect(DATABASE_NAME, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    # إنشاء الجدول إن لم يكن موجوداً (للبدء الجديد)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            status TEXT DEFAULT 'أفكار',
            icon TEXT,
            order_index INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()

def migrate_db():
    """إضافة الأعمدة الجديدة إذا كانت مفقودة (للترقية من إصدار سابق)"""
    conn = get_connection()
    cursor = conn.cursor()
    # قائمة الأعمدة الجديدة مع استعلام الإضافة
    new_columns = [
        ("status", "TEXT DEFAULT 'أفكار'"),
        ("icon", "TEXT"),
        ("order_index", "INTEGER DEFAULT 0")
    ]
    for col_name, col_def in new_columns:
        try:
            cursor.execute(f"ALTER TABLE notes ADD COLUMN {col_name} {col_def}")
        except sqlite3.OperationalError:
            pass  # العمود موجود مسبقاً
    conn.commit()
    conn.close()

# استدعاء التهيئة عند استيراد الملف
init_db()
migrate_db()