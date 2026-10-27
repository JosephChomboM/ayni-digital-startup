from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.cors import configure_cors
from app.core.db import get_db
from app.core.error_handlers import register_error_handlers
from app.core.security_settings import lifespan
from app.modules.families.router import router as families_router

app = FastAPI(title="Ayni Digital API", lifespan=lifespan)
register_error_handlers(app)
app.include_router(families_router)
configure_cors(app)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": get_settings().environment}


@app.get("/health/db")
def health_db(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc
    return {"status": "ok"}
