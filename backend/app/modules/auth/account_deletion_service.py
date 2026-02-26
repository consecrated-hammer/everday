from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.modules.auth.models import PasswordResetToken, RefreshToken, User, UserModuleRole
from app.modules.budget.models import AllocationAccount, Expense, ExpenseAccount, ExpenseType, IncomeStream
from app.modules.health.models import (
    AiSuggestion,
    AiSuggestionRun,
    DailyLog,
    Food,
    HealthReminderRun,
    ImportLog,
    MealEntry,
    MealTemplate,
    MealTemplateItem,
    MetricEntry,
    PortionOption,
    RecommendationLog,
    ScheduleSlot,
    Settings,
)
from app.modules.integrations.gmail.models import GmailIntegration
from app.modules.integrations.google.models import (
    GoogleIntegration,
    GoogleTaskOverdueNotification,
    GoogleTaskShare,
)
from app.modules.kids.models import (
    Chore,
    ChoreAssignment,
    ChoreEntry,
    ChoreEntryAudit,
    KidLink,
    LedgerEntry,
    PocketMoneyRule,
    ReminderRun,
    ReminderSettings,
)
from app.modules.life_admin.models import (
    Document,
    DocumentAiSuggestion,
    DocumentAudit,
    DocumentFolder,
    DocumentLink,
    DocumentTag,
    DocumentTagLink,
    GmailIntakeRun,
    LifeCategory,
    LifePerson,
    LifeRecord,
    LifeReminder,
)
from app.modules.notes.models import Note, NoteAssociation, NoteItem, NoteTag, NoteTaskLink
from app.modules.notifications.models import Notification, NotificationDeviceRegistration
from app.modules.shopping.models import ShoppingItem
from app.modules.tasks.models import (
    Task,
    TaskAssignee,
    TaskList,
    TaskOverdueNotificationRun,
    TaskSettings,
    TaskTag,
    TaskTagLink,
)

DELETED_USER_PLACEHOLDER_ID = 0
DELETED_USER_TEXT = "Deleted user"


def _Delete(query) -> int:
    count = query.delete(synchronize_session=False)
    return count or 0


def _Update(query, values: dict) -> int:
    count = query.update(values, synchronize_session=False)
    return count or 0


def _Ids(rows) -> list[int]:
    return [row[0] for row in rows]


def _MarkDeletedPersonName(current_name: str | None) -> str:
    base = (current_name or "").strip()
    if not base:
        return DELETED_USER_TEXT
    marker = f"({DELETED_USER_TEXT})"
    if marker.lower() in base.lower():
        return base
    return f"{base} {marker}"


def DeleteAccountAndData(db: Session, *, user_id: int) -> dict[str, int]:
    if user_id <= 0:
        raise ValueError("Invalid user id")

    user = db.query(User).filter(User.Id == user_id).first()
    if not user:
        raise ValueError("User not found")

    deleted_rows = 0
    reassigned_rows = 0

    # Reassign cross-user history references that are required to stay non-null.
    reassigned_rows += _Update(
        db.query(Notification).filter(Notification.CreatedByUserId == user_id),
        {Notification.CreatedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(Task).filter(Task.CreatedByUserId == user_id),
        {Task.CreatedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(TaskAssignee).filter(TaskAssignee.AssignedByUserId == user_id),
        {TaskAssignee.AssignedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(TaskOverdueNotificationRun).filter(TaskOverdueNotificationRun.TriggeredByUserId == user_id),
        {TaskOverdueNotificationRun.TriggeredByUserId: None},
    )
    reassigned_rows += _Update(
        db.query(Task).filter(Task.CompletedByUserId == user_id),
        {Task.CompletedByUserId: None},
    )
    reassigned_rows += _Update(
        db.query(ChoreEntry).filter(ChoreEntry.CreatedByUserId == user_id),
        {ChoreEntry.CreatedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(ChoreEntry).filter(ChoreEntry.UpdatedByUserId == user_id),
        {ChoreEntry.UpdatedByUserId: None},
    )
    reassigned_rows += _Update(
        db.query(ChoreEntry).filter(ChoreEntry.ReviewedByUserId == user_id),
        {ChoreEntry.ReviewedByUserId: None},
    )
    reassigned_rows += _Update(
        db.query(ChoreEntryAudit).filter(ChoreEntryAudit.ActorUserId == user_id),
        {ChoreEntryAudit.ActorUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(LedgerEntry).filter(LedgerEntry.CreatedByUserId == user_id),
        {LedgerEntry.CreatedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(PocketMoneyRule).filter(PocketMoneyRule.CreatedByUserId == user_id),
        {PocketMoneyRule.CreatedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(LifeCategory).filter(LifeCategory.CreatedByUserId == user_id),
        {LifeCategory.CreatedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(LifeRecord).filter(LifeRecord.CreatedByUserId == user_id),
        {LifeRecord.CreatedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(LifeRecord).filter(LifeRecord.UpdatedByUserId == user_id),
        {LifeRecord.UpdatedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(Document).filter(Document.CreatedByUserId == user_id),
        {Document.CreatedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(DocumentLink).filter(DocumentLink.CreatedByUserId == user_id),
        {DocumentLink.CreatedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(DocumentAudit).filter(DocumentAudit.ActorUserId == user_id),
        {DocumentAudit.ActorUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(LifeReminder).filter(LifeReminder.CreatedByUserId == user_id),
        {LifeReminder.CreatedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(LifeReminder).filter(LifeReminder.AssigneeUserId == user_id),
        {LifeReminder.AssigneeUserId: None},
    )
    reassigned_rows += _Update(
        db.query(GmailIntakeRun).filter(GmailIntakeRun.TriggeredByUserId == user_id),
        {GmailIntakeRun.TriggeredByUserId: None},
    )
    reassigned_rows += _Update(
        db.query(GoogleTaskShare).filter(GoogleTaskShare.AssignedByUserId == user_id),
        {GoogleTaskShare.AssignedByUserId: DELETED_USER_PLACEHOLDER_ID},
    )
    reassigned_rows += _Update(
        db.query(User).filter(User.ApprovedByUserId == user_id, User.Id != user_id),
        {User.ApprovedByUserId: None},
    )

    linked_people = db.query(LifePerson).filter(LifePerson.UserId == user_id).all()
    for person in linked_people:
        person.UserId = None
        person.Name = _MarkDeletedPersonName(person.Name)
        db.add(person)
    reassigned_rows += len(linked_people)

    # Notes (has FK references to auth.users).
    note_ids = _Ids(db.query(Note.Id).filter(Note.UserId == user_id).all())
    if note_ids:
        deleted_rows += _Delete(db.query(NoteItem).filter(NoteItem.NoteId.in_(note_ids)))
        deleted_rows += _Delete(db.query(NoteTag).filter(NoteTag.NoteId.in_(note_ids)))
        deleted_rows += _Delete(db.query(NoteTaskLink).filter(NoteTaskLink.NoteId.in_(note_ids)))
        deleted_rows += _Delete(db.query(NoteAssociation).filter(NoteAssociation.NoteId.in_(note_ids)))
    deleted_rows += _Delete(db.query(NoteTag).filter(NoteTag.UserId == user_id))
    deleted_rows += _Delete(db.query(Note).filter(Note.UserId == user_id))

    # Tasks
    task_ids = _Ids(db.query(Task.Id).filter(Task.OwnerUserId == user_id).all())
    if task_ids:
        deleted_rows += _Delete(db.query(TaskAssignee).filter(TaskAssignee.TaskId.in_(task_ids)))
        deleted_rows += _Delete(db.query(TaskTagLink).filter(TaskTagLink.TaskId.in_(task_ids)))
    deleted_rows += _Delete(db.query(TaskAssignee).filter(TaskAssignee.UserId == user_id))
    deleted_rows += _Delete(db.query(Task).filter(Task.OwnerUserId == user_id))

    task_tag_ids = _Ids(db.query(TaskTag.Id).filter(TaskTag.OwnerUserId == user_id).all())
    if task_tag_ids:
        deleted_rows += _Delete(db.query(TaskTagLink).filter(TaskTagLink.TagId.in_(task_tag_ids)))
    deleted_rows += _Delete(db.query(TaskTag).filter(TaskTag.OwnerUserId == user_id))
    deleted_rows += _Delete(db.query(TaskList).filter(TaskList.OwnerUserId == user_id))
    deleted_rows += _Delete(db.query(TaskSettings).filter(TaskSettings.UserId == user_id))

    # Kids
    owned_chore_ids = _Ids(db.query(Chore.Id).filter(Chore.OwnerUserId == user_id).all())
    if owned_chore_ids:
        deleted_rows += _Delete(db.query(ChoreAssignment).filter(ChoreAssignment.ChoreId.in_(owned_chore_ids)))

    chore_entry_query = db.query(ChoreEntry.Id).filter(ChoreEntry.KidUserId == user_id)
    if owned_chore_ids:
        chore_entry_query = chore_entry_query.union(
            db.query(ChoreEntry.Id).filter(ChoreEntry.ChoreId.in_(owned_chore_ids))
        )
    chore_entry_ids = _Ids(chore_entry_query.all())
    if chore_entry_ids:
        deleted_rows += _Delete(db.query(ChoreEntryAudit).filter(ChoreEntryAudit.ChoreEntryId.in_(chore_entry_ids)))
        deleted_rows += _Delete(
            db.query(LedgerEntry).filter(
                LedgerEntry.SourceType == "ChoreEntry",
                LedgerEntry.SourceId.in_(chore_entry_ids),
            )
        )
        deleted_rows += _Delete(db.query(ChoreEntry).filter(ChoreEntry.Id.in_(chore_entry_ids)))

    deleted_rows += _Delete(db.query(LedgerEntry).filter(LedgerEntry.KidUserId == user_id))
    deleted_rows += _Delete(db.query(PocketMoneyRule).filter(PocketMoneyRule.KidUserId == user_id))
    deleted_rows += _Delete(db.query(ReminderSettings).filter(ReminderSettings.KidUserId == user_id))
    deleted_rows += _Delete(db.query(ReminderRun).filter(ReminderRun.KidUserId == user_id))
    deleted_rows += _Delete(db.query(ChoreAssignment).filter(ChoreAssignment.KidUserId == user_id))
    deleted_rows += _Delete(db.query(Chore).filter(Chore.OwnerUserId == user_id))
    deleted_rows += _Delete(db.query(KidLink).filter(or_(KidLink.ParentUserId == user_id, KidLink.KidUserId == user_id)))

    # Budget
    deleted_rows += _Delete(db.query(IncomeStream).filter(IncomeStream.OwnerUserId == user_id))
    deleted_rows += _Delete(db.query(Expense).filter(Expense.OwnerUserId == user_id))
    deleted_rows += _Delete(db.query(ExpenseAccount).filter(ExpenseAccount.OwnerUserId == user_id))
    deleted_rows += _Delete(db.query(ExpenseType).filter(ExpenseType.OwnerUserId == user_id))
    deleted_rows += _Delete(db.query(AllocationAccount).filter(AllocationAccount.OwnerUserId == user_id))

    # Shopping
    deleted_rows += _Delete(db.query(ShoppingItem).filter(ShoppingItem.OwnerUserId == user_id))

    # Health
    daily_log_ids = _Ids(db.query(DailyLog.DailyLogId).filter(DailyLog.UserId == user_id).all())
    if daily_log_ids:
        deleted_rows += _Delete(db.query(MealEntry).filter(MealEntry.DailyLogId.in_(daily_log_ids)))
    deleted_rows += _Delete(db.query(DailyLog).filter(DailyLog.UserId == user_id))

    template_ids = _Ids(db.query(MealTemplate.MealTemplateId).filter(MealTemplate.UserId == user_id).all())
    if template_ids:
        deleted_rows += _Delete(db.query(MealTemplateItem).filter(MealTemplateItem.MealTemplateId.in_(template_ids)))
    deleted_rows += _Delete(db.query(MealTemplate).filter(MealTemplate.UserId == user_id))

    deleted_rows += _Delete(db.query(PortionOption).filter(PortionOption.UserId == user_id))
    deleted_rows += _Delete(db.query(ScheduleSlot).filter(ScheduleSlot.UserId == user_id))
    deleted_rows += _Delete(db.query(Settings).filter(Settings.UserId == user_id))
    deleted_rows += _Delete(db.query(Food).filter(Food.OwnerUserId == user_id))
    deleted_rows += _Delete(db.query(RecommendationLog).filter(RecommendationLog.UserId == user_id))
    deleted_rows += _Delete(db.query(ImportLog).filter(ImportLog.UserId == user_id))
    deleted_rows += _Delete(db.query(MetricEntry).filter(MetricEntry.UserId == user_id))
    deleted_rows += _Delete(db.query(AiSuggestion).filter(AiSuggestion.UserId == user_id))
    deleted_rows += _Delete(db.query(AiSuggestionRun).filter(AiSuggestionRun.UserId == user_id))
    deleted_rows += _Delete(db.query(HealthReminderRun).filter(HealthReminderRun.UserId == user_id))

    # Life admin
    owned_document_ids = _Ids(db.query(Document.Id).filter(Document.OwnerUserId == user_id).all())
    if owned_document_ids:
        deleted_rows += _Delete(db.query(DocumentTagLink).filter(DocumentTagLink.DocumentId.in_(owned_document_ids)))
        deleted_rows += _Delete(db.query(DocumentLink).filter(DocumentLink.DocumentId.in_(owned_document_ids)))
        deleted_rows += _Delete(db.query(DocumentAudit).filter(DocumentAudit.DocumentId.in_(owned_document_ids)))
        deleted_rows += _Delete(
            db.query(DocumentAiSuggestion).filter(DocumentAiSuggestion.DocumentId.in_(owned_document_ids))
        )
        deleted_rows += _Delete(db.query(Document).filter(Document.Id.in_(owned_document_ids)))

    owned_tag_ids = _Ids(db.query(DocumentTag.Id).filter(DocumentTag.OwnerUserId == user_id).all())
    if owned_tag_ids:
        deleted_rows += _Delete(db.query(DocumentTagLink).filter(DocumentTagLink.TagId.in_(owned_tag_ids)))
    deleted_rows += _Delete(db.query(DocumentTag).filter(DocumentTag.OwnerUserId == user_id))
    deleted_rows += _Delete(db.query(DocumentFolder).filter(DocumentFolder.OwnerUserId == user_id))
    deleted_rows += _Delete(db.query(LifeReminder).filter(LifeReminder.OwnerUserId == user_id))
    deleted_rows += _Delete(db.query(GmailIntakeRun).filter(GmailIntakeRun.OwnerUserId == user_id))

    # Integrations
    deleted_rows += _Delete(db.query(GoogleTaskShare).filter(GoogleTaskShare.AssignedToUserId == user_id))
    deleted_rows += _Delete(
        db.query(GoogleTaskOverdueNotification).filter(GoogleTaskOverdueNotification.UserId == user_id)
    )
    deleted_rows += _Delete(db.query(GoogleIntegration).filter(GoogleIntegration.ConnectedByUserId == user_id))
    deleted_rows += _Delete(db.query(GmailIntegration).filter(GmailIntegration.ConnectedByUserId == user_id))

    # Notifications
    deleted_rows += _Delete(db.query(NotificationDeviceRegistration).filter(NotificationDeviceRegistration.UserId == user_id))
    deleted_rows += _Delete(db.query(Notification).filter(Notification.UserId == user_id))

    # Auth linked tables and account row.
    deleted_rows += _Delete(db.query(RefreshToken).filter(RefreshToken.UserId == user_id))
    deleted_rows += _Delete(db.query(UserModuleRole).filter(UserModuleRole.UserId == user_id))
    deleted_rows += _Delete(db.query(PasswordResetToken).filter(PasswordResetToken.UserId == user_id))
    deleted_rows += _Delete(db.query(User).filter(User.Id == user_id))

    return {"DeletedRows": deleted_rows, "ReassignedRows": reassigned_rows}
