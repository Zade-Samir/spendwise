from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.schemas.user import (
    LogoutRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    TokenResponse,
    UserLoginRequest,
    UserRead,
    UserRegisterRequest,
)
from app.services.auth import (
    authenticate_user,
    register_user,
    revoke_refresh_token,
    rotate_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    payload: UserRegisterRequest,
    user_agent: str | None = Header(None, alias="User-Agent"),
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Creates a user account, seeds initial categories and rules, and returns tokens."""
    user, access_token, refresh_token = await register_user(
        session=session,
        email=payload.email,
        password=payload.password,
        name=payload.name,
        user_agent=user_agent,
    )
    return TokenResponse(
        user=UserRead.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user credentials",
)
async def login(
    payload: UserLoginRequest,
    user_agent: str | None = Header(None, alias="User-Agent"),
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Validates user credentials and issues a fresh token pair."""
    user, access_token, refresh_token = await authenticate_user(
        session=session,
        email=payload.email,
        password=payload.password,
        user_agent=user_agent,
    )
    return TokenResponse(
        user=UserRead.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post(
    "/refresh",
    response_model=RefreshTokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token and get a new access token",
)
async def refresh(
    payload: RefreshTokenRequest,
    user_agent: str | None = Header(None, alias="User-Agent"),
    session: AsyncSession = Depends(get_db),
) -> RefreshTokenResponse:
    """Rotates refresh token and issues a fresh 15-minute access JWT."""
    access_token, new_refresh_token = await rotate_refresh_token(
        session=session,
        raw_refresh_token=payload.refresh_token,
        user_agent=user_agent,
    )
    return RefreshTokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke refresh token and log out",
)
async def logout(
    payload: LogoutRequest,
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Revokes the submitted refresh token."""
    await revoke_refresh_token(
        session=session,
        raw_refresh_token=payload.refresh_token,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
