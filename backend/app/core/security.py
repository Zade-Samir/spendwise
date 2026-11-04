import datetime
import hashlib
import secrets
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.common_passwords import is_common_password
from app.core.config import settings

# Argon2id password hasher with specified parameters
ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def validate_password_strength(password: str) -> tuple[bool, str | None]:
    """Validates that a password satisfies length and blacklist requirements."""
    if is_common_password(password):
        return False, "Password is too common and easily guessed"
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    return True, None


def hash_password(password: str) -> str:
    """Hashes a password using Argon2id."""
    return ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verifies a plaintext password against an Argon2id hash."""
    try:
        return ph.verify(hashed, password)
    except (VerifyMismatchError, Exception):
        return False


def hash_token(token: str) -> str:
    """Computes a SHA-256 hash of a token string (refresh token or API token)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> str:
    """Generates a CSPRNG 32-byte hexadecimal refresh token."""
    return secrets.token_hex(32)


def create_access_token(user_id: str | Any) -> str:
    """Creates a signed HS256 access JWT valid for settings.ACCESS_TOKEN_MINUTES."""
    now = datetime.datetime.now(datetime.UTC)
    expire = now + datetime.timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decodes and cryptographically validates an access JWT."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None
        return payload
    except (jwt.PyJWTError, Exception):
        return None
