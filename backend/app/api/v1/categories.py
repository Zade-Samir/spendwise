import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.category import (
    CategoryChildRead,
    CategoryCreateRequest,
    CategorySuggestionResponse,
    CategoryTreeRead,
    CategoryUpdateRequest,
)
from app.services.categories import (
    create_category,
    delete_category,
    get_categories_tree,
    suggest_category,
    update_category,
)

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get(
    "",
    response_model=list[CategoryTreeRead],
    status_code=status.HTTP_200_OK,
    summary="Get 2-level category tree with 30-day transaction usage counts",
)
async def list_categories_tree(
    include_archived: bool = Query(False, description="Include archived categories"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[CategoryTreeRead]:
    return await get_categories_tree(
        session=session,
        user_id=current_user.id,
        include_archived=include_archived,
    )


@router.get(
    "/suggest",
    response_model=CategorySuggestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Suggest category from rules or transaction history",
)
async def get_category_suggestion(
    merchant: str = Query(..., min_length=1, description="Merchant name string"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CategorySuggestionResponse:
    return await suggest_category(
        session=session,
        user_id=current_user.id,
        merchant=merchant,
    )


@router.post(
    "",
    response_model=CategoryChildRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom category or subcategory",
)
async def post_create_category(
    payload: CategoryCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CategoryChildRead:
    created = await create_category(
        session=session,
        user_id=current_user.id,
        payload=payload,
    )
    return CategoryChildRead.model_validate(created)


@router.patch(
    "/{id}",
    response_model=CategoryChildRead,
    status_code=status.HTTP_200_OK,
    summary="Update category or archive status",
)
async def patch_update_category(
    id: uuid.UUID,
    payload: CategoryUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CategoryChildRead:
    updated = await update_category(
        session=session,
        user_id=current_user.id,
        category_id=id,
        payload=payload,
    )
    return CategoryChildRead.model_validate(updated)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete unused category or reassign transactions",
)
async def delete_single_category(
    id: uuid.UUID,
    reassign_to: uuid.UUID | None = Query(
        None, description="Category ID to reassign transactions to"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    await delete_category(
        session=session,
        user_id=current_user.id,
        category_id=id,
        reassign_to=reassign_to,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
