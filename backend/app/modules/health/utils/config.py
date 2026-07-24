import os


def GetEnv(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        return default
    stripped = value.strip()
    return stripped if stripped else default


class HealthSettings:
    OpenAiApiKey = GetEnv("OPENAI_API_KEY")
    OpenAiModel = GetEnv("OPENAI_MODEL", "gpt-5-mini")
    OpenAiFallbackModels = GetEnv("OPENAI_FALLBACK_MODELS", "gpt-4.1,gpt-4o-mini")
    OpenAiAutosuggestModel = GetEnv("OPENAI_AUTOSUGGEST_MODEL", "gpt-5-mini")
    OpenAiBaseUrl = GetEnv("OPENAI_BASE_URL", "https://api.openai.com/v1/chat/completions")
    OpenAiDailyTipModel = GetEnv("OPENAI_DAILY_TIP_MODEL")
    OpenAiDailyTipFallbackModels = GetEnv("OPENAI_DAILY_TIP_FALLBACK_MODELS")
    OpenAiDailyTipReasoningEffort = GetEnv("OPENAI_DAILY_TIP_REASONING_EFFORT", "low")
    OpenAiDailyTipTextVerbosity = GetEnv("OPENAI_DAILY_TIP_TEXT_VERBOSITY", "low")


Settings = HealthSettings()
