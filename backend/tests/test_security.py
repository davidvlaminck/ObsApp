from datetime import timedelta

from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
)
from app.core.config import settings


def test_password_hash_and_verify():
    password = "test_password_123"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong_password", hashed) is False


def test_create_access_token():
    data = {"sub": "test@example.com"}
    token = create_access_token(data)
    assert isinstance(token, str)
    assert len(token) > 0

    # Decode and verify
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "test@example.com"
    assert "exp" in payload


def test_create_access_token_with_custom_expiry():
    data = {"sub": "test@example.com"}
    expires = timedelta(minutes=60)
    token = create_access_token(data, expires_delta=expires)
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "test@example.com"


def test_decode_invalid_token():
    result = decode_access_token("invalid.token.here")
    assert result is None


def test_decode_expired_token():
    # Create a token that expired 1 hour ago
    from datetime import datetime, timedelta
    from jose import jwt

    expired_data = {"sub": "test@example.com", "exp": datetime.utcnow() - timedelta(hours=1)}
    expired_token = jwt.encode(expired_data, settings.secret_key, algorithm=settings.algorithm)
    result = decode_access_token(expired_token)
    assert result is None
