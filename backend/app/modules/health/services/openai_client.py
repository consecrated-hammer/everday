from typing import Any

import httpx

from app.modules.health.utils.config import Settings


def _ShouldUseResponsesEndpoint(Model: str) -> bool:
    if Settings.OpenAiBaseUrl.rstrip("/").endswith("/responses"):
        return True
    return Model.startswith("gpt-5")


def _SupportsTemperature(UseResponses: bool, Model: str) -> bool:
    if UseResponses and Model.startswith("gpt-5"):
        return False
    return True


def _ResolveOpenAiUrl(UseResponses: bool) -> str:
    BaseUrl = (Settings.OpenAiBaseUrl or "").rstrip("/")
    if not UseResponses:
        return BaseUrl

    if BaseUrl.endswith("/chat/completions"):
        return BaseUrl.replace("/chat/completions", "/responses")
    if BaseUrl.endswith("/v1"):
        return f"{BaseUrl}/responses"
    if BaseUrl.endswith("/responses"):
        return BaseUrl
    return "https://api.openai.com/v1/responses"


def _NormalizeResponsesContentItem(Item: dict[str, Any]) -> dict[str, Any]:
    ItemType = Item.get("type")
    if ItemType == "text":
        return {"type": "input_text", "text": Item.get("text", "")}
    return Item


def _BuildResponsesInput(Messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    Normalized: list[dict[str, Any]] = []
    for Message in Messages:
        Role = Message.get("role", "user")
        Content = Message.get("content", "")
        if isinstance(Content, list):
            ContentItems = []
            for Item in Content:
                if isinstance(Item, dict):
                    ContentItems.append(_NormalizeResponsesContentItem(Item))
            if not ContentItems:
                ContentItems = [{"type": "input_text", "text": str(Content)}]
        else:
            ContentItems = [{"type": "input_text", "text": str(Content)}]
        Normalized.append({"role": Role, "content": ContentItems})
    return Normalized


def _ExtractOpenAiContent(Data: dict[str, Any]) -> str:
    OutputText = Data.get("output_text")
    if isinstance(OutputText, str) and OutputText.strip():
        return OutputText

    OutputItems = Data.get("output")
    if isinstance(OutputItems, list):
        TextParts: list[str] = []
        for Item in OutputItems:
            if not isinstance(Item, dict):
                continue
            ContentItems = Item.get("content", [])
            if not isinstance(ContentItems, list):
                continue
            for Content in ContentItems:
                if not isinstance(Content, dict):
                    continue
                TextValue = Content.get("text") or Content.get("output_text")
                if isinstance(TextValue, str) and TextValue:
                    TextParts.append(TextValue)
        Joined = "\n".join(TextParts).strip()
        if Joined:
            return Joined

    Choices = Data.get("choices", [])
    if isinstance(Choices, list) and Choices:
        ContentValue = Choices[0].get("message", {}).get("content", "")
        if isinstance(ContentValue, str):
            return ContentValue

    return ""


def _IsModelError(ResponseData: dict[str, Any] | None, StatusCode: int) -> bool:
    if StatusCode not in (400, 404):
        return False
    if not isinstance(ResponseData, dict):
        return False
    ErrorData = ResponseData.get("error", {})
    if not isinstance(ErrorData, dict):
        return False
    Code = str(ErrorData.get("code", "")).lower()
    Param = str(ErrorData.get("param", "")).lower()
    Message = str(ErrorData.get("message", "")).lower()
    if Code in {"unsupported_value", "model_not_found"}:
        return True
    if Param == "model":
        return True
    return "model" in Message


def _ParseFallbackModels() -> list[str]:
    Raw = Settings.OpenAiFallbackModels or ""
    Models = [Item.strip() for Item in Raw.split(",") if Item.strip()]
    return Models


def _RequestOpenAiContent(
    Model: str,
    Messages: list[dict[str, Any]],
    Temperature: float,
    MaxTokens: int | None,
    ReasoningEffort: str | None,
    TextVerbosity: str | None,
) -> tuple[str, str]:
    if not Settings.OpenAiApiKey:
        raise ValueError("OpenAI API key not configured.")

    UseResponses = _ShouldUseResponsesEndpoint(Model)
    Url = _ResolveOpenAiUrl(UseResponses)

    SupportsTemperature = _SupportsTemperature(UseResponses, Model)

    if UseResponses:
        Payload: dict[str, Any] = {
            "model": Model,
            "input": _BuildResponsesInput(Messages),
            "reasoning": {"effort": ReasoningEffort or "low"},
            "text": {"format": {"type": "text"}, "verbosity": TextVerbosity or "low"},
        }
        if SupportsTemperature:
            Payload["temperature"] = Temperature
        if MaxTokens is not None:
            Payload["max_output_tokens"] = MaxTokens
        else:
            Payload["max_output_tokens"] = 400
    else:
        Payload = {
            "model": Model,
            "messages": Messages,
        }
        if SupportsTemperature:
            Payload["temperature"] = Temperature
        if MaxTokens is not None:
            Payload["max_tokens"] = MaxTokens

    Headers = {
        "Authorization": f"Bearer {Settings.OpenAiApiKey}",
        "Content-Type": "application/json",
    }

    Response = httpx.post(
        Url,
        headers=Headers,
        json=Payload,
        timeout=30.0,
    )
    try:
        Response.raise_for_status()
    except httpx.HTTPStatusError as ErrorValue:
        Detail = Response.text.strip()
        try:
            ResponseData = Response.json()
        except ValueError:
            ResponseData = None
        if _IsModelError(ResponseData, Response.status_code):
            raise ValueError("OpenAI model unavailable.") from ErrorValue
        raise ValueError(
            f"OpenAI request failed ({Response.status_code}) at {Url}: {Detail}"
        ) from ErrorValue
    Data = Response.json()
    Content = _ExtractOpenAiContent(Data)
    ModelUsed = Data.get("model", Model)
    return Content, str(ModelUsed)


def GetOpenAiContentWithModel(
    Messages: list[dict[str, Any]],
    Temperature: float,
    MaxTokens: int | None = None,
    ReasoningEffort: str | None = None,
    TextVerbosity: str | None = None,
) -> tuple[str, str]:
    ModelsToTry = [Settings.OpenAiModel or "gpt-5-mini"]
    for Model in _ParseFallbackModels():
        if Model not in ModelsToTry:
            ModelsToTry.append(Model)

    LastError: Exception | None = None
    for Model in ModelsToTry:
        try:
            return _RequestOpenAiContent(
                Model,
                Messages,
                Temperature,
                MaxTokens,
                ReasoningEffort,
                TextVerbosity,
            )
        except ValueError as ErrorValue:
            LastError = ErrorValue
            if str(ErrorValue) != "OpenAI model unavailable.":
                break

    if LastError is not None:
        raise LastError
    raise ValueError("OpenAI request failed.")


def GetOpenAiContentForModel(
    Model: str,
    Messages: list[dict[str, Any]],
    Temperature: float,
    MaxTokens: int | None = None,
    ReasoningEffort: str | None = None,
    TextVerbosity: str | None = None,
) -> tuple[str, str]:
    return _RequestOpenAiContent(
        Model,
        Messages,
        Temperature,
        MaxTokens,
        ReasoningEffort,
        TextVerbosity,
    )


def GetOpenAiContent(Messages: list[dict[str, Any]], Temperature: float, MaxTokens: int | None = None) -> str:
    Content, _ModelUsed = GetOpenAiContentWithModel(Messages, Temperature, MaxTokens)
    return Content
