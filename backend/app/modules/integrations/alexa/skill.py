import logging
import os
import traceback
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime

from ask_sdk_core.dispatch_components import AbstractExceptionHandler, AbstractRequestHandler
from ask_sdk_core.skill_builder import SkillBuilder
from ask_sdk_core.utils import is_intent_name, is_request_type
from ask_sdk_webservice_support.webservice_handler import WebserviceSkillHandler

from app.modules.shopping.services import AddItem, ClearItems, ListItems, RemoveItemsExact

logger = logging.getLogger("integrations.alexa.skill")

_DbContext: ContextVar = ContextVar("alexa_db", default=None)
_ConfigContext: ContextVar = ContextVar("alexa_config", default=None)
_CorrelationContext: ContextVar = ContextVar("alexa_correlation_id", default=None)


@dataclass(frozen=True)
class AlexaConfig:
    Enabled: bool
    HouseholdId: int | None
    ServiceUserId: int | None
    SkillId: str | None
    VerifySignature: bool
    VerifyTimestamp: bool
    ReadLimit: int
    MaxBodyBytes: int
    RateLimitRequests: int
    RateLimitWindowSeconds: int


def _env_truthy(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    value = value.strip().lower()
    if not value:
        return default
    return value in {"1", "true", "yes", "on"}


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def _require_int(name: str) -> int:
    value = _require_env(name)
    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"Invalid integer for env var: {name}") from exc


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"Invalid integer for env var: {name}") from exc


def LoadAlexaConfig() -> AlexaConfig:
    enabled = _env_truthy("ALEXA_ENABLED", False)
    app_env = os.getenv("APP_ENV", "").strip().lower()

    verify_signature = _env_truthy("ALEXA_VERIFY_SIGNATURE", True)
    verify_timestamp = _env_truthy("ALEXA_VERIFY_TIMESTAMP", True)

    if app_env == "production":
        verify_signature = True
        verify_timestamp = True

    household_id = None
    service_user_id = None
    skill_id = None
    if enabled:
        household_id = _require_int("ALEXA_HOUSEHOLD_ID")
        service_user_id = _require_int("ALEXA_SERVICE_USER_ID")
        skill_id = _require_env("ALEXA_SKILL_ID")

    read_limit = _env_int("ALEXA_READ_LIMIT", 10)
    max_body_bytes = _env_int("ALEXA_MAX_BODY_BYTES", 262144)
    rate_limit_requests = _env_int("ALEXA_RATE_LIMIT_REQUESTS", 30)
    rate_limit_window_seconds = _env_int("ALEXA_RATE_LIMIT_WINDOW_SECONDS", 60)

    return AlexaConfig(
        Enabled=enabled,
        HouseholdId=household_id,
        ServiceUserId=service_user_id,
        SkillId=skill_id,
        VerifySignature=verify_signature,
        VerifyTimestamp=verify_timestamp,
        ReadLimit=read_limit,
        MaxBodyBytes=max_body_bytes,
        RateLimitRequests=rate_limit_requests,
        RateLimitWindowSeconds=rate_limit_window_seconds,
    )


def SetAlexaContext(db, config: AlexaConfig, correlation_id: str | None = None) -> tuple:
    db_token = _DbContext.set(db)
    config_token = _ConfigContext.set(config)
    correlation_token = _CorrelationContext.set(correlation_id)
    return db_token, config_token, correlation_token


def ResetAlexaContext(tokens: tuple) -> None:
    db_token, config_token, correlation_token = tokens
    _DbContext.reset(db_token)
    _ConfigContext.reset(config_token)
    _CorrelationContext.reset(correlation_token)


def _get_db():
    db = _DbContext.get()
    if db is None:
        raise RuntimeError("Alexa database session unavailable")
    return db


def _get_config() -> AlexaConfig:
    config = _ConfigContext.get()
    if config is None:
        raise RuntimeError("Alexa configuration unavailable")
    return config


def _get_correlation_id() -> str:
    correlation_id = _CorrelationContext.get()
    return correlation_id or "unknown"


def _require_config_ids(config: AlexaConfig) -> tuple[int, int]:
    if config.HouseholdId is None or config.ServiceUserId is None:
        raise RuntimeError("Alexa configuration incomplete")
    return config.HouseholdId, config.ServiceUserId


def _extract_slot_value(handler_input, slot_name: str) -> str:
    request = handler_input.request_envelope.request
    intent = getattr(request, "intent", None)
    if not intent or not getattr(intent, "slots", None):
        return ""
    slot = intent.slots.get(slot_name)
    if not slot:
        return ""
    return slot.value or ""


def _format_item_list(items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return f"{', '.join(items[:-1])}, and {items[-1]}"


def _append_skill_fallback_log(message: str, exception: Exception) -> None:
    log_path = os.getenv("LOG_FILE_PATH", "/app/logs/backend.log")
    log_dir = os.path.dirname(log_path)
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_path, "a", encoding="utf-8") as handle:
        handle.write(f"{timestamp} ERROR integrations.alexa.skill {message}\n")
        for line in traceback.format_exception(type(exception), exception, exception.__traceback__):
            for entry in line.rstrip().splitlines():
                handle.write(f"{entry}\n")


def _extract_request_details(handler_input) -> tuple[str, str, str]:
    envelope = handler_input.request_envelope
    request = getattr(envelope, "request", None)
    request_id = getattr(request, "request_id", None) or getattr(request, "requestId", None) or "unknown"

    intent_name = "unknown"
    intent = getattr(request, "intent", None)
    if intent and getattr(intent, "name", None):
        intent_name = intent.name
    else:
        intent_name = getattr(request, "type", None) or "unknown"

    user_id = "unknown"
    context = getattr(envelope, "context", None)
    system = getattr(context, "system", None) or getattr(context, "System", None)
    user = getattr(system, "user", None)
    user_id = getattr(user, "user_id", None) or getattr(user, "userId", None) or user_id

    if user_id == "unknown":
        session = getattr(envelope, "session", None)
        session_user = getattr(session, "user", None)
        user_id = getattr(session_user, "user_id", None) or getattr(session_user, "userId", None) or user_id

    return request_id, intent_name, user_id


class LaunchRequestHandler(AbstractRequestHandler):
    def can_handle(self, handler_input) -> bool:
        return is_request_type("LaunchRequest")(handler_input)

    def handle(self, handler_input):
        speech = "You can say, add milk, or ask what is on my list."
        return (
            handler_input.response_builder
            .speak(speech)
            .set_should_end_session(False)
            .response
        )


class AddItemIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input) -> bool:
        return is_intent_name("AddItemIntent")(handler_input)

    def handle(self, handler_input):
        config = _get_config()
        db = _get_db()
        item_value = _extract_slot_value(handler_input, "Item")
        household_id, service_user_id = _require_config_ids(config)

        try:
            record = AddItem(
                db,
                household_id=household_id,
                owner_user_id=service_user_id,
                item_label=item_value,
                added_by_type="Alexa",
            )
        except ValueError:
            speech = "I did not catch that. Try saying, add milk."
            return handler_input.response_builder.speak(speech).set_should_end_session(True).response

        speech = f"Added {record.Item}."
        return handler_input.response_builder.speak(speech).set_should_end_session(True).response


class ReadListIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input) -> bool:
        return is_intent_name("ReadListIntent")(handler_input)

    def handle(self, handler_input):
        config = _get_config()
        db = _get_db()
        household_id, _service_user_id = _require_config_ids(config)
        db.expire_all()
        entries = ListItems(
            db,
            household_id=household_id,
            include_inactive=False,
            limit=config.ReadLimit,
        )
        if not entries:
            speech = "Your Everday shopping list is empty."
            return handler_input.response_builder.speak(speech).set_should_end_session(True).response

        items = [entry.Item for entry in entries]
        list_text = _format_item_list(items)
        speech = f"On your list: {list_text}."
        return handler_input.response_builder.speak(speech).set_should_end_session(True).response


class RemoveItemIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input) -> bool:
        return is_intent_name("RemoveItemIntent")(handler_input)

    def handle(self, handler_input):
        config = _get_config()
        db = _get_db()
        item_value = _extract_slot_value(handler_input, "Item")
        household_id, _service_user_id = _require_config_ids(config)

        try:
            removed = RemoveItemsExact(
                db,
                household_id=household_id,
                item_label=item_value,
            )
        except ValueError:
            speech = "Tell me the item to remove."
            return handler_input.response_builder.speak(speech).set_should_end_session(False).response

        if removed <= 0:
            speech = f"I could not find {item_value} on your list."
        elif removed == 1:
            speech = f"Removed {item_value}."
        else:
            speech = f"Removed {removed} {item_value} items."
        return handler_input.response_builder.speak(speech).set_should_end_session(True).response


class ClearListIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input) -> bool:
        return is_intent_name("ClearListIntent")(handler_input)

    def handle(self, handler_input):
        request = handler_input.request_envelope.request
        intent = getattr(request, "intent", None)
        confirmation_status = getattr(intent, "confirmation_status", None) or getattr(
            intent, "confirmationStatus", None
        )
        status_raw = confirmation_status or "NONE"
        if hasattr(status_raw, "value"):
            status_raw = status_raw.value
        status_value = str(status_raw).upper()

        if status_value == "DENIED":
            speech = "Okay, I won't clear it."
            return handler_input.response_builder.speak(speech).set_should_end_session(True).response

        if status_value != "CONFIRMED":
            speech = "Are you sure you want to clear your list?"
            return handler_input.response_builder.speak(speech).set_should_end_session(False).response

        config = _get_config()
        db = _get_db()
        household_id, _service_user_id = _require_config_ids(config)
        cleared = ClearItems(db, household_id=household_id)
        if cleared <= 0:
            speech = "Your list is already empty."
        else:
            speech = "Cleared your list."
        return handler_input.response_builder.speak(speech).set_should_end_session(True).response


class HelpIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input) -> bool:
        return is_intent_name("AMAZON.HelpIntent")(handler_input)

    def handle(self, handler_input):
        speech = "Try saying, add milk. Or, what is on my list."
        return handler_input.response_builder.speak(speech).set_should_end_session(False).response


class CancelOrStopIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input) -> bool:
        return is_intent_name("AMAZON.CancelIntent")(handler_input) or is_intent_name("AMAZON.StopIntent")(handler_input)

    def handle(self, handler_input):
        speech = "Goodbye."
        return handler_input.response_builder.speak(speech).set_should_end_session(True).response


class FallbackIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input) -> bool:
        return is_intent_name("AMAZON.FallbackIntent")(handler_input)

    def handle(self, handler_input):
        speech = "Try saying add milk, or ask what is on my list."
        return handler_input.response_builder.speak(speech).set_should_end_session(True).response


class CatchAllExceptionHandler(AbstractExceptionHandler):
    def can_handle(self, handler_input, exception) -> bool:
        return True

    def handle(self, handler_input, exception):
        correlation_id = _get_correlation_id()
        request_id, intent_name, user_id = _extract_request_details(handler_input)
        message = (
            f"alexa skill error correlation_id={correlation_id} "
            f"request_id={request_id} intent={intent_name} user_id={user_id}"
        )
        logger.error(
            "alexa skill error correlation_id=%s request_id=%s intent=%s user_id=%s",
            correlation_id,
            request_id,
            intent_name,
            user_id,
            exc_info=(type(exception), exception, exception.__traceback__),
        )
        _append_skill_fallback_log(message, exception)
        speech = "Sorry, something went wrong."
        return handler_input.response_builder.speak(speech).set_should_end_session(True).response


def BuildSkillHandler(config: AlexaConfig) -> WebserviceSkillHandler:
    sb = SkillBuilder()
    sb.add_request_handler(LaunchRequestHandler())
    sb.add_request_handler(AddItemIntentHandler())
    sb.add_request_handler(ReadListIntentHandler())
    sb.add_request_handler(RemoveItemIntentHandler())
    sb.add_request_handler(ClearListIntentHandler())
    sb.add_request_handler(HelpIntentHandler())
    sb.add_request_handler(CancelOrStopIntentHandler())
    sb.add_request_handler(FallbackIntentHandler())
    sb.add_exception_handler(CatchAllExceptionHandler())

    return WebserviceSkillHandler(
        skill=sb.create(),
        verify_signature=config.VerifySignature,
        verify_timestamp=config.VerifyTimestamp,
    )
