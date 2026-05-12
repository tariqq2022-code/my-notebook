import os
import psycopg2
from psycopg2.extras import RealDictCursor

# سنقرأ عنوان الاتصال من متغير البيئة DATABASE_URL
# Render يضعه تلقائياً عندما نربط الخدمتين
DATABASE_URL = os.getenv("DATABASE_URL")

def get_connection():
    """إنشاء اتصال بقاعدة PostgreSQL وإعادته"""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn

def init_db():
    """تهيئة جدول الملاحظات إذا لم يكن موجوداً"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id SERIAL PRIMARY KEY,
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
    """لا حاجة للترحيل التدريجي مع PostgreSQL لأننا بدأنا من الصفر،
    لكن نترك الدالة فارغة لتوافق الاستدعاءات القديمة"""
    pass