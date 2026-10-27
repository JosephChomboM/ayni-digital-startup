from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import ApplicationError
from app.core.security import decode_access_token
from app.modules.families.schemas import (
    AuthenticationResponse,
    ConsentTextResponse,
    CurrentUserResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
)
from app.modules.families.service import FamiliesService

router = APIRouter(tags=["families"])
bearer = HTTPBearer(auto_error=False, bearerFormat="JWT")


def get_families_service(db: Annotated[Session, Depends(get_db)]) -> FamiliesService:
    return FamiliesService(db)


def get_authenticated_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> UUID:
    if credentials is None:
        raise ApplicationError(
            code="unauthorized", message="Vuelve a iniciar sesión para continuar.", status_code=401
        )
    return decode_access_token(credentials.credentials)


FamiliesServiceDep = Annotated[FamiliesService, Depends(get_families_service)]
AuthenticatedUserId = Annotated[UUID, Depends(get_authenticated_user_id)]


@router.get("/auth/consent", response_model=ConsentTextResponse)
def get_consent() -> ConsentTextResponse:
    return FamiliesService.get_consent_text()


@router.post("/auth/register", response_model=RegisterResponse, status_code=201)
def register(data: RegisterRequest, service: FamiliesServiceDep) -> RegisterResponse:
    fields = {
        "email": data.email,
        "name": data.name,
        "password": data.password,
        "accepted": data.consent.accepted,
        "text_version": data.consent.text_version,
    }
    if data.invitation_token is not None:
        return service.register_invited(**fields, invitation_token=data.invitation_token)
    return service.register_caregiver(**fields, family_name=cast(str, data.family_name))


@router.post("/auth/login", response_model=AuthenticationResponse)
def login(data: LoginRequest, service: FamiliesServiceDep) -> AuthenticationResponse:
    return service.login(email=data.email, password=data.password)


@router.get("/users/me", response_model=CurrentUserResponse)
def get_current_user(
    user_id: AuthenticatedUserId, service: FamiliesServiceDep
) -> CurrentUserResponse:
    return service.get_current_user(user_id)
