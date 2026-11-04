import contextvars
import logging
import re
import sys
from typing import Any

# Context variable to hold request correlation ID
request_id_ctx_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")

SENSITIVE_PATTERNS = [
    (
        re.compile(
            r'(?i)(password|passwd|secret|access_token|refresh_token|authorization)\s*[:=]\s*["\']?([^"\'\s&,]+)'
        ),
        r"\1=[REDACTED]",
    ),
    (re.compile(r"(?i)(bearer\s+)([a-zA-Z0-9_\-\.]{10,})"), r"\1[REDACTED]"),
    (re.compile(r"sw_[a-zA-Z0-9]{32}"), "sw_[REDACTED]"),
]


class CorrelationIdFilter(logging.Filter):
    """Injects the current request correlation ID into log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx_var.get()
        return True


class SensitiveDataFilter(logging.Filter):
    """Sanitizes sensitive credentials, JWT tokens, and passwords from log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            for pattern, repl in SENSITIVE_PATTERNS:
                record.msg = pattern.sub(repl, record.msg)
        if record.args:
            if isinstance(record.args, tuple):
                sanitized_args: list[Any] = []
                for arg in record.args:
                    if isinstance(arg, str):
                        s = arg
                        for pattern, repl in SENSITIVE_PATTERNS:
                            s = pattern.sub(repl, s)
                        sanitized_args.append(s)
                    else:
                        sanitized_args.append(arg)
                record.args = tuple(sanitized_args)
            elif isinstance(record.args, dict):
                sanitized_dict: dict[str, Any] = {}
                for k, v in record.args.items():
                    if isinstance(v, str):
                        s = v
                        for pattern, repl in SENSITIVE_PATTERNS:
                            s = pattern.sub(repl, s)
                        sanitized_dict[k] = s
                    else:
                        sanitized_dict[k] = v
                record.args = sanitized_dict
        return True


def setup_logging(log_level: str = "INFO") -> None:
    """Configures application-wide structured logging."""
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    log_format = "%(asctime)s [%(levelname)s] [%(name)s] [%(request_id)s] %(message)s"

    formatter = logging.Formatter(fmt=log_format, datefmt="%Y-%m-%d %H:%M:%S")

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.addFilter(CorrelationIdFilter())
    handler.addFilter(SensitiveDataFilter())

    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Remove existing handlers to avoid duplicate log entries
    for existing_handler in root_logger.handlers[:]:
        root_logger.removeHandler(existing_handler)

    root_logger.addHandler(handler)

    # Quiet overly chatty third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
