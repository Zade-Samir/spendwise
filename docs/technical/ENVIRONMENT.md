# SpendWise — Environment Configuration Specification

This document provides a comprehensive reference for all environment variables used by SpendWise across the backend, frontend, and Docker orchestration layers. 

> [!CAUTION]
> **Security Rule:** Never commit real secrets or production `.env` files to source control. Use `.env.example` as the single authoritative template.

---

## 1. Backend Environment Variables (`backend/.env`)

These variables are consumed by Python's `pydantic-settings` core in `backend/app/core/config.py`.

| Variable Name | Required? | Default Value | Example Placeholder | Security Considerations |
|---|---|---|---|---|
| `DATABASE_URL` | **Required** | `None` | `postgresql+asyncpg://spendwise:spendwise@db:5432/spendwise` | Contains database credentials. Must use the `postgresql+asyncpg://` protocol prefix for async execution. Never log this string. |
| `JWT_SECRET` | **Required** | `None` | `change-me-to-a-long-random-high-entropy-string-at-least-32-chars` | Master cryptographic key for signing HS256 access tokens. Must be high-entropy and rotated if compromised. |
| `ACCESS_TOKEN_MINUTES` | Optional | `15` | `15` | Integer. Controls the validity duration of short-lived access JWTs. |
| `REFRESH_TOKEN_DAYS` | Optional | `30` | `30` | Integer. Controls the expiration window of rotating refresh tokens stored in PostgreSQL. |
| `FRONTEND_ORIGIN` | **Required** | `http://localhost:5173` | `https://app.spendwise.in` | Locked CORS origin header. In production, must be the exact HTTPS domain of the web client. |
| `VAPID_PUBLIC_KEY` | **Required** for Push | `None` | `BEl62iUYgUivxIkv-5n7W6...` | URL-safe Base64 public key for Web Push (VAPID). Shared with the frontend client. |
| `VAPID_PRIVATE_KEY` | **Required** for Push | `None` | `A1b2C3d4E5f6G7...` | Private ECDSA key used by `pywebpush` to sign push messages. Critical secret; never share. |
| `VAPID_SUBJECT` | **Required** for Push | `mailto:admin@spendwise.in`| `mailto:support@spendwise.in` | RFC 8292 contact URI (must be a `mailto:` address or HTTPS URL). Required by push servers. |
| `ENV` | Optional | `development` | `production` | Valid values: `development`, `test`, `production`. When `production`, swagger docs can be restricted. |
| `LOG_LEVEL` | Optional | `INFO` | `DEBUG` | Standard Python logging levels: `DEBUG`, `INFO`, `WARNING`, `ERROR`. |
| `PORT` | Optional | `8000` | `8000` | Port on which the Uvicorn ASGI server binds. |

---

## 2. Frontend Environment Variables (`frontend/.env`)

Frontend variables are injected during the Vite build process. By Vite convention, all client-exposed variables **must** begin with the `VITE_` prefix.

| Variable Name | Required? | Default Value | Example Placeholder | Notes |
|---|---|---|---|---|
| `VITE_API_URL` | **Required** | `http://localhost:8000/api/v1` | `https://api.spendwise.in/api/v1` | Base REST API endpoint URL without trailing slash. |
| `VITE_VAPID_PUBLIC_KEY` | Optional | `""` | `BEl62iUYgUivxIkv-5n7W6...` | Matches the backend `VAPID_PUBLIC_KEY`. Used by `pushManager.subscribe()`. |

---

## 3. Docker Compose Configuration Variables

Used when launching the local multi-container stack via `docker-compose.yml`:

| Variable Name | Purpose | Example Value |
|---|---|---|
| `POSTGRES_USER` | PostgreSQL superuser username | `spendwise` |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password | `spendwise` |
| `POSTGRES_DB` | Initial database name | `spendwise` |
| `POSTGRES_PORT` | Host forwarded port for PostgreSQL | `5432` |

---

## 4. Key Generation & Tooling

To generate fresh, cryptographically secure keys for `.env`:

### 4.1 Generating `JWT_SECRET`
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 4.2 Generating VAPID Keypair (Web Push)
Using the repository Makefile command:
```bash
make vapid
```
Or directly via Python:
```bash
python3 -c "from pywebpush import Vapid; v = Vapid(); v.generate_keys(); print('PUBLIC:', v.public_key.decode()); print('PRIVATE:', v.private_key.decode())"
```

---

## 5. Verification Checklist

Before starting any SpendWise service in production or staging, verify that:
1. `JWT_SECRET` is at least 32 characters long and not using the default placeholder.
2. `FRONTEND_ORIGIN` matches the exact client URL (including protocol and port if applicable) with no trailing slash.
3. `DATABASE_URL` utilizes the `postgresql+asyncpg://` protocol.
4. `ENV` is set to `production`.
5. `VITE_API_URL` is accessible from the user's mobile browser over HTTPS.
