from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.middleware import RejectNulBytesMiddleware
from app.database import get_db
from app.routers import (
    admins,
    appointments,
    auth,
    exercises_library,
    me,
    patients,
    routines,
    sessions,
    specialists,
    surveys,
    users,
)

app = FastAPI(title="ActivaMente API", version="1.1.0")

# Bytes NUL en path/query/body → 422 antes de llegar a Postgres (si no, 500).
app.add_middleware(RejectNulBytesMiddleware)

# allow_origins=["*"] con allow_credentials=True es una combinación inválida para
# navegadores (HC-14). La app móvil no usa cookies, así que credentials=False.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth.router,
    me.router,
    users.router,
    patients.router,
    specialists.router,
    admins.router,
    exercises_library.router,
    routines.router,
    sessions.router,
    surveys.router,
    appointments.router,
):
    app.include_router(router)


@app.get("/", tags=["health"])
def root():
    return {"name": "ActivaMente API", "docs": "/docs", "health": "/health"}


@app.get("/health", tags=["health"])
def health(db: Session = Depends(get_db)):
    """Comprueba la conexión a la base (SELECT 1)."""
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
