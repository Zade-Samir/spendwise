from pydantic import BaseModel, Field


class VapidPublicKeyResponse(BaseModel):
    public_key: str


class PushKeys(BaseModel):
    p256dh: str = Field(..., description="Client public key (base64url)")
    auth: str = Field(..., description="Client auth secret (base64url)")


class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(..., description="Browser push subscription endpoint URL")
    keys: PushKeys
    user_agent: str | None = Field(default=None, description="Optional client user agent")


class PushSubscriptionDelete(BaseModel):
    endpoint: str = Field(..., description="Browser push subscription endpoint URL to remove")


class PushTestResponse(BaseModel):
    sent: int = Field(..., description="Number of push notifications dispatched successfully")
    failed: int = Field(..., description="Number of push notification attempts that failed")

