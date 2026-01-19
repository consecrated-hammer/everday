"""Local image storage helpers for food photos."""

import base64
import binascii
import uuid
from pathlib import Path


MAX_IMAGE_BYTES = 10 * 1024 * 1024
UPLOAD_SUBDIR = Path("uploads") / "health" / "foods"
DEFAULT_BUCKET = "shared"


def _GetStaticRoot() -> Path:
    return Path(__file__).resolve().parents[3] / "static"


def _DetectExtension(ImageBytes: bytes) -> str:
    if ImageBytes.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if ImageBytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if ImageBytes.startswith(b"GIF87a") or ImageBytes.startswith(b"GIF89a"):
        return "gif"
    return "jpg"


def _NormalizeBase64(ImageBase64: str) -> str:
    if "base64," in ImageBase64:
        return ImageBase64.split("base64,", 1)[-1]
    return ImageBase64


def SaveFoodImage(ImageBase64: str) -> str:
    if not ImageBase64:
        raise ValueError("Image data is required.")
    Cleaned = _NormalizeBase64(ImageBase64)
    try:
        ImageBytes = base64.b64decode(Cleaned, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid image data.") from exc

    if len(ImageBytes) > MAX_IMAGE_BYTES:
        raise ValueError("Image exceeds 10 MB.")

    extension = _DetectExtension(ImageBytes)
    file_name = f"{uuid.uuid4().hex}.{extension}"

    static_root = _GetStaticRoot()
    upload_dir = static_root / UPLOAD_SUBDIR / DEFAULT_BUCKET
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / file_name
    file_path.write_bytes(ImageBytes)

    return f"/{UPLOAD_SUBDIR.as_posix()}/{DEFAULT_BUCKET}/{file_name}"


def TryRemoveFoodImage(ImageUrl: str | None) -> None:
    if not ImageUrl:
        return
    if not ImageUrl.startswith(f"/{UPLOAD_SUBDIR.as_posix()}/"):
        return
    static_root = _GetStaticRoot()
    target = static_root / ImageUrl.lstrip("/")
    try:
        target.relative_to(static_root)
    except ValueError:
        return
    if target.exists() and target.is_file():
        target.unlink()
