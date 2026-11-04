from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.user import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    UserRead,
    UserUpdateRequest,
)
from app.services.users import (
    change_user_password,
    delete_user_account,
    update_user_preferences,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/me",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile and settings",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserRead:
    """Returns the authenticated user profile and preference settings."""
    return UserRead.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    summary="Update user preferences",
)
async def patch_me(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> UserRead:
    """Updates user-level profile and preference configuration."""
    update_data = payload.model_dump(exclude_unset=True)
    updated_user = await update_user_preferences(
        session=session,
        user=current_user,
        update_data=update_data,
    )
    return UserRead.model_validate(updated_user)


@router.post(
    "/me/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change user account password",
)
async def post_change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Verifies existing password and updates to a new password, invalidating old sessions."""
    await change_user_password(
        session=session,
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user account and all associated data",
)
async def delete_me(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Verifies password and cascades hard deletion across all user data."""
    await delete_user_account(
        session=session,
        user=current_user,
        password=payload.password,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
