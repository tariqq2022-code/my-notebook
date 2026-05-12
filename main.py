from fastapi import FastAPI, HTTPException, status, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from datetime import datetime, timezone
from typing import List, Optional
import database as db
from models import NoteCreate, NoteUpdate, NoteResponse

app = FastAPI()

db.init_db()

@app.on_event("startup")
def on_startup():
    db.init_db()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")

@app.get("/notes", response_model=List[NoteResponse])
def get_notes(search: Optional[str] = Query(None), status: Optional[str] = Query(None)):
    conn = db.get_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM notes WHERE 1=1"
    params = []
    if search:
        query += " AND (title LIKE %s OR content LIKE %s)"
        like = f"%{search}%"
        params.extend([like, like])
    if status:
        query += " AND status = %s"
        params.append(status)

    query += " ORDER BY status, order_index, updated_at DESC"
    cursor.execute(query, params)
    notes = cursor.fetchall()
    conn.close()
    return [NoteResponse(**note) for note in notes]

@app.post("/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(note: NoteCreate):
    now = datetime.now(timezone.utc).isoformat()
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO notes (title, content, created_at, updated_at, status, icon, order_index)
           VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
        (note.title, note.content, now, now, note.status, note.icon, note.order_index)
    )
    new_id = cursor.fetchone()["id"]
    conn.commit()
    cursor.execute("SELECT * FROM notes WHERE id = %s", (new_id,))
    new_note = cursor.fetchone()
    conn.close()
    if new_note is None:
        raise HTTPException(status_code=500, detail="فشل إنشاء الملاحظة")
    return NoteResponse(**new_note)

@app.get("/notes/{note_id}", response_model=NoteResponse)
def get_note(note_id: int):
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notes WHERE id = %s", (note_id,))
    note = cursor.fetchone()
    conn.close()
    if note is None:
        raise HTTPException(status_code=404, detail="الملاحظة غير موجودة")
    return NoteResponse(**note)

@app.put("/notes/{note_id}", response_model=NoteResponse)
def update_note(note_id: int, note_data: NoteUpdate):
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notes WHERE id = %s", (note_id,))
    note = cursor.fetchone()
    if note is None:
        conn.close()
        raise HTTPException(status_code=404, detail="الملاحظة غير موجودة")

    updated_title = note_data.title if note_data.title is not None else note["title"]
    updated_content = note_data.content if note_data.content is not None else note["content"]
    updated_status = note_data.status if note_data.status is not None else note["status"]
    updated_icon = note_data.icon if note_data.icon is not None else note["icon"]
    updated_order = note_data.order_index if note_data.order_index is not None else note["order_index"]
    now = datetime.now(timezone.utc).isoformat()

    cursor.execute(
        """UPDATE notes SET title=%s, content=%s, updated_at=%s, status=%s, icon=%s, order_index=%s
           WHERE id=%s""",
        (updated_title, updated_content, now, updated_status, updated_icon, updated_order, note_id)
    )
    conn.commit()
    cursor.execute("SELECT * FROM notes WHERE id = %s", (note_id,))
    updated_note = cursor.fetchone()
    conn.close()
    return NoteResponse(**updated_note)

@app.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int):
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM notes WHERE id = %s", (note_id,))
    if cursor.fetchone() is None:
        conn.close()
        raise HTTPException(status_code=404, detail="الملاحظة غير موجودة")
    cursor.execute("DELETE FROM notes WHERE id = %s", (note_id,))
    conn.commit()
    conn.close()
    return None

from pydantic import BaseModel
class ReorderItem(BaseModel):
    id: int
    order_index: int
class ReorderPayload(BaseModel):
    items: List[ReorderItem]

@app.patch("/notes/reorder")
def reorder_notes(payload: ReorderPayload):
    conn = db.get_connection()
    cursor = conn.cursor()
    for item in payload.items:
        cursor.execute("UPDATE notes SET order_index = %s WHERE id = %s",
                       (item.order_index, item.id))
    conn.commit()
    conn.close()
    return {"message": "تم إعادة الترتيب"}