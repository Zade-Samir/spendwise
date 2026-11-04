from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    validate_password_strength,
    verify_password,
)


def test_password_strength_validation() -> None:
    # Too short (<8)
    valid, msg = validate_password_strength("short")
    assert not valid
    assert msg is not None and "8 characters" in msg

    # Common passwords
    for common_pw in ["password", "12345678", "qwerty", "welcome123"]:
        valid, msg = validate_password_strength(common_pw)
        assert not valid
        assert msg is not None and "common" in msg.lower()

    # Strong password
    valid, msg = validate_password_strength("MyStrongP@ssw0rd2026!")
    assert valid
    assert msg is None


def test_argon2id_hashing_and_verification() -> None:
    raw_password = "SecurePassword123!"
    hashed = hash_password(raw_password)

    # Argon2id produces hash starting with $argon2id$
    assert hashed.startswith("$argon2id$")
    assert verify_password(raw_password, hashed)
    assert not verify_password("WrongPassword123!", hashed)


def test_refresh_token_generation_and_hashing() -> None:
    token1 = generate_refresh_token()
    token2 = generate_refresh_token()

    assert len(token1) == 64  # 32 bytes hex = 64 characters
    assert token1 != token2

    hash1 = hash_token(token1)
    hash2 = hash_token(token1)
    assert hash1 == hash2
    assert len(hash1) == 64  # SHA-256 = 64 hex characters


def test_jwt_access_token_lifecycle() -> None:
    import uuid

    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == str(user_id)
    assert payload["type"] == "access"
    assert "exp" in payload
    assert "iat" in payload

    # Invalid token decoding
    assert decode_access_token("invalid.token.here") is None
