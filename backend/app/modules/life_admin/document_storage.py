"""Document storage helpers for life-admin library."""

from __future__ import annotations

import hashlib
import os
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile

DEFAULT_MAX_BYTES = 25 * 1024 * 1024


@dataclass(frozen=True)
class StoredDocument:
    StoragePath: str
    FileSizeBytes: int
    Hash: str
    ContentType: str | None
    OriginalFileName: str | None


def _GetStorageRoot() -> Path:
    root = os.getenv("DOCUMENT_STORAGE_ROOT", "").strip()
    if root:
        return Path(root)
    return Path(__file__).resolve().parents[3] / "storage" / "documents"


def _EnsureStorageRoot() -> Path:
    root = _GetStorageRoot()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _DetectExtension(content_type: str | None, filename: str | None, data: bytes) -> str:
    if content_type:
        if "pdf" in content_type:
            return "pdf"
        if "png" in content_type:
            return "png"
        if "gif" in content_type:
            return "gif"
        if "jpeg" in content_type or "jpg" in content_type:
            return "jpg"
        if "heic" in content_type:
            return "heic"
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].strip().lower()
        if ext:
            return ext
    if data.startswith(b"%PDF"):
        return "pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "gif"
    return "bin"


def _ResolveMaxBytes() -> int:
    raw = os.getenv("DOCUMENT_STORAGE_MAX_BYTES", "").strip()
    if not raw:
        return DEFAULT_MAX_BYTES
    try:
        return max(1, int(raw))
    except ValueError:
        return DEFAULT_MAX_BYTES


def SaveUploadFile(file: UploadFile, owner_user_id: int) -> StoredDocument:
    if not file:
        raise ValueError("File is required.")

    data = file.file.read()
    if data is None:
        data = b""
    max_bytes = _ResolveMaxBytes()
    if len(data) > max_bytes:
        raise ValueError(f"File exceeds {max_bytes // (1024 * 1024)} MB.")

    content_type = file.content_type
    original_name = file.filename
    ext = _DetectExtension(content_type, original_name, data)

    now = datetime.utcnow()
    filename = f"{uuid.uuid4().hex}.{ext}"
    root = _EnsureStorageRoot()
    relative_dir = Path(str(owner_user_id)) / f"{now.year:04d}" / f"{now.month:02d}"
    target_dir = root / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    target_path = target_dir / filename
    target_path.write_bytes(data)

    file_hash = hashlib.sha256(data).hexdigest()

    storage_path = (relative_dir / filename).as_posix()
    return StoredDocument(
        StoragePath=storage_path,
        FileSizeBytes=len(data),
        Hash=file_hash,
        ContentType=content_type,
        OriginalFileName=original_name,
    )


def SaveBytes(
    *, data: bytes, owner_user_id: int, filename: str | None, content_type: str | None
) -> StoredDocument:
    if data is None:
        data = b""
    max_bytes = _ResolveMaxBytes()
    if len(data) > max_bytes:
        raise ValueError(f"File exceeds {max_bytes // (1024 * 1024)} MB.")
    ext = _DetectExtension(content_type, filename, data)
    now = datetime.utcnow()
    storage_root = _EnsureStorageRoot()
    relative_dir = Path(str(owner_user_id)) / f"{now.year:04d}" / f"{now.month:02d}"
    target_dir = storage_root / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{uuid.uuid4().hex}.{ext}"
    target_path = target_dir / file_name
    target_path.write_bytes(data)
    file_hash = hashlib.sha256(data).hexdigest()
    storage_path = (relative_dir / file_name).as_posix()
    return StoredDocument(
        StoragePath=storage_path,
        FileSizeBytes=len(data),
        Hash=file_hash,
        ContentType=content_type,
        OriginalFileName=filename,
    )


def ResolveDocumentPath(storage_path: str) -> Path:
    root = _EnsureStorageRoot()
    candidate = (root / storage_path).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError as exc:
        raise ValueError("Invalid storage path.") from exc
    return candidate
