import logging
import os

import httpx


logger = logging.getLogger("app.auth.email")


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def SendPasswordResetEmail(to_email: str, reset_link: str) -> None:
    api_key = _require_env("SMTP2GO_API_KEY")
    base_url = _require_env("SMTP2GO_BASE_URL").rstrip("/")
    sender = _require_env("SMTP2GO_SENDER")

    subject = "Reset your Everday password"
    text = (
        "We received a request to reset your Everday password.\n\n"
        f"Reset link: {reset_link}\n\n"
        "If you did not request this, you can ignore this email."
    )

    url = f"{base_url}/email/send"
    payload = {
        "api_key": api_key,
        "sender": sender,
        "to": [to_email],
        "subject": subject,
        "text_body": text,
    }

    with httpx.Client(timeout=10) as client:
        try:
            response = client.post(url, json=payload)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "smtp2go send failed",
                extra={"status": exc.response.status_code, "response": exc.response.text},
            )
            raise
        except httpx.RequestError:
            logger.exception("smtp2go request failed")
            raise
