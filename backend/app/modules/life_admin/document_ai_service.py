"""AI-assisted OCR and triage suggestions for life-admin documents."""

from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from typing import Any

import httpx

from app.modules.life_admin.document_storage import ResolveDocumentPath


@dataclass(frozen=True)
class DocumentAiResult:
    OcrText: str
    Suggestions: dict[str, Any]
    Confidence: str | None
    RawJson: str | None


def _GetEnv(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        return default
    stripped = value.strip()
    return stripped if stripped else default


def _parse_int(value: str | None, fallback: int) -> int:
    if not value:
        return fallback
    try:
        return int(value)
    except ValueError:
        return fallback


class DocumentAiSettings:
    OpenAiApiKey = _GetEnv("OPENAI_API_KEY")
    OpenAiBaseUrl = _GetEnv("OPENAI_BASE_URL", "https://api.openai.com/v1/chat/completions")
    OpenAiModel = _GetEnv("DOCUMENT_AI_MODEL") or _GetEnv("OPENAI_AUTOSUGGEST_MODEL") or _GetEnv("OPENAI_MODEL")
    OpenAiVisionModel = _GetEnv("DOCUMENT_AI_VISION_MODEL") or _GetEnv("OPENAI_MODEL") or "gpt-4o"
    MaxBytes = _parse_int(_GetEnv("DOCUMENT_AI_MAX_BYTES"), 4194304)
    MaxTextChars = _parse_int(_GetEnv("DOCUMENT_AI_MAX_TEXT_CHARS"), 12000)
    MaxTokens = _parse_int(_GetEnv("DOCUMENT_AI_MAX_TOKENS"), 900)


Settings = DocumentAiSettings()


def _NormalizeConfidence(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().title()
    if normalized in ("High", "Medium", "Low"):
        return normalized
    return None


def _BuildVisionPrompt(filename: str | None) -> str:
    return (
        "You are an assistant that extracts text and triage hints from documents."
        " Return ONLY JSON with:\n"
        "{\n"
        '  "OcrText": "full text if readable",\n'
        '  "SuggestedFolder": "short folder name or empty",\n'
        '  "SuggestedTags": ["tag"],\n'
        '  "SuggestedLinks": [{"EntityType": "life_admin_record", "Hint": "record title"}],\n'
        '  "SuggestedReminder": {"Title": "reminder title", "DueDate": "YYYY-MM-DD"} or null,\n'
        '  "ExtractedDates": ["YYYY-MM-DD"],\n'
        '  "ExtractedAmounts": ["100.00"],\n'
        '  "Confidence": "High"|"Medium"|"Low"\n'
        "}\n\n"
        "Rules:\n"
        "- Provide OCR text if the image is readable.\n"
        "- Suggested links are only hints, never IDs.\n"
        "- If no reminder, set SuggestedReminder to null.\n"
        "- No extra text or markdown.\n"
        f"- Filename: {filename or 'unknown'}"
    )


def _BuildTextPrompt(filename: str | None, text: str) -> str:
    trimmed = text[: Settings.MaxTextChars]
    return (
        "You are an assistant that classifies documents and extracts dates/amounts."
        " Return ONLY JSON with:\n"
        "{\n"
        '  "SuggestedFolder": "short folder name or empty",\n'
        '  "SuggestedTags": ["tag"],\n'
        '  "SuggestedLinks": [{"EntityType": "life_admin_record", "Hint": "record title"}],\n'
        '  "SuggestedReminder": {"Title": "reminder title", "DueDate": "YYYY-MM-DD"} or null,\n'
        '  "ExtractedDates": ["YYYY-MM-DD"],\n'
        '  "ExtractedAmounts": ["100.00"],\n'
        '  "Confidence": "High"|"Medium"|"Low"\n'
        "}\n\n"
        "Rules:\n"
        "- Suggested links are only hints, never IDs.\n"
        "- If no reminder, set SuggestedReminder to null.\n"
        "- No extra text or markdown.\n"
        f"- Filename: {filename or 'unknown'}\n\n"
        f"Document text:\n{trimmed}"
    )


def _RequestOpenAi(payload: dict) -> dict:
    if not Settings.OpenAiApiKey:
        raise ValueError("OpenAI API key not configured.")
    response = httpx.post(
        Settings.OpenAiBaseUrl,
        headers={"Authorization": f"Bearer {Settings.OpenAiApiKey}", "Content-Type": "application/json"},
        json=payload,
        timeout=60.0,
    )
    response.raise_for_status()
    return response.json()


def _ExtractPdfText(path: str) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise ValueError("PDF text extraction requires pypdf.") from exc

    target = ResolveDocumentPath(path)
    reader = PdfReader(str(target))
    parts: list[str] = []
    for page in reader.pages[:10]:
        text = page.extract_text() or ""
        if text:
            parts.append(text)
        if sum(len(part) for part in parts) > Settings.MaxTextChars:
            break
    return "\n".join(parts).strip()


def AnalyzeDocument(*, storage_path: str, content_type: str | None, filename: str | None) -> DocumentAiResult:
    if not Settings.OpenAiApiKey:
        return DocumentAiResult(OcrText="", Suggestions={}, Confidence=None, RawJson=None)

    if content_type and content_type.startswith("image/"):
        if not Settings.OpenAiVisionModel:
            return DocumentAiResult(OcrText="", Suggestions={}, Confidence=None, RawJson=None)
        target = ResolveDocumentPath(storage_path)
        data = target.read_bytes()
        if len(data) > Settings.MaxBytes:
            raise ValueError("Image is too large for AI analysis.")
        encoded = base64.b64encode(data).decode("utf-8")
        prompt = _BuildVisionPrompt(filename)
        payload = {
            "model": Settings.OpenAiVisionModel,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded}"}},
                    ],
                }
            ],
            "temperature": 0.2,
            "max_tokens": Settings.MaxTokens,
        }
        data = _RequestOpenAi(payload)
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        try:
            parsed = json.loads(content or "{}")
        except json.JSONDecodeError:
            parsed = {}
        ocr_text = str(parsed.get("OcrText", "") or "").strip()
        confidence = _NormalizeConfidence(parsed.get("Confidence"))
        return DocumentAiResult(OcrText=ocr_text, Suggestions=parsed, Confidence=confidence, RawJson=content)

    if content_type and "pdf" in content_type:
        if not Settings.OpenAiModel:
            return DocumentAiResult(OcrText="", Suggestions={}, Confidence=None, RawJson=None)
        text = _ExtractPdfText(storage_path)
        prompt = _BuildTextPrompt(filename, text)
        payload = {
            "model": Settings.OpenAiModel,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": Settings.MaxTokens,
        }
        data = _RequestOpenAi(payload)
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        try:
            parsed = json.loads(content or "{}")
        except json.JSONDecodeError:
            parsed = {}
        confidence = _NormalizeConfidence(parsed.get("Confidence"))
        return DocumentAiResult(OcrText=text, Suggestions=parsed, Confidence=confidence, RawJson=content)

    return DocumentAiResult(OcrText="", Suggestions={}, Confidence=None, RawJson=None)
