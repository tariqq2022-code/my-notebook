from pydantic import BaseModel
from typing import Optional

class NoteCreate(BaseModel):
    title: str
    content: str
    status: Optional[str] = "أفكار"
    icon: Optional[str] = None
    order_index: Optional[int] = 0

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    icon: Optional[str] = None
    order_index: Optional[int] = None

class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    created_at: str
    updated_at: str
    status: str
    icon: Optional[str] = None
    order_index: int

    class Config:
        from_attributes = True