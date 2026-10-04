from pydantic import BaseModel
from datetime import datetime
from typing import Any, Dict


class PreferenceIn(BaseModel):
    key: str
    value: Dict[str, Any]


class PreferenceOut(BaseModel):
    id: int | None = None
    key: str
    value: Dict[str, Any]
    created_at: datetime | None = None
    updated_at: datetime | None = None
