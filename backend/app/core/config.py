import urllib.parse
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # General Project Info
    PROJECT_NAME: str = "SpendWise API"
    API_V1_PREFIX: str = "/api/v1"
    ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://spendwise:spendwise@localhost:5432/spendwise"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: str) -> str:
        """Ensure DATABASE_URL always uses asyncpg driver and asyncpg-compatible SSL parameters."""
        if isinstance(v, str):
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)

            # asyncpg accepts 'ssl', NOT 'sslmode'
            parsed = urllib.parse.urlsplit(v)
            qs = urllib.parse.parse_qs(parsed.query)
            if "sslmode" in qs:
                mode = qs.pop("sslmode")[0]
                if mode in ("require", "prefer", "allow", "verify-ca", "verify-full"):
                    qs["ssl"] = ["require"]
                elif mode == "disable":
                    qs["ssl"] = ["disable"]
                new_query = urllib.parse.urlencode(qs, doseq=True)
                v = urllib.parse.urlunsplit(parsed._replace(query=new_query))
        return v

    # Security & Tokens
    JWT_SECRET: str = "change-me-to-a-long-random-high-entropy-string-at-least-32-chars"
    ACCESS_TOKEN_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 30

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # Rate Limiting
    RATE_LIMITING_ENABLED: bool = True
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10
    GENERAL_RATE_LIMIT_PER_MINUTE: int = 120

    # Web Push (VAPID)
    VAPID_PUBLIC_KEY: str = (
        "BK45MpBSHay0gfMKM4OX05JbXkOP8cKJ_0vxd_9hnHB_XgqUJzRVmJ2cTUKmwFIZa3dUJf3lMmiZe4dv8199ohI"
    )
    VAPID_PRIVATE_KEY: str = "JmskcU96rRsp9qk6BuVUzNuCiKyOSYyrpYnBE8egUQ0"
    VAPID_SUBJECT: str = "mailto:admin@spendwise.in"


settings = Settings()
