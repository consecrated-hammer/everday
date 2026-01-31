"""life admin documents library

Revision ID: 0052_life_admin_documents
Revises: 0051_health_food_reminder_slots
Create Date: 2026-01-30
"""

from alembic import op
import sqlalchemy as sa

revision = "0052_life_admin_documents"
down_revision = "0051_health_food_reminder_slots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'life_admin')
        BEGIN
            EXEC('CREATE SCHEMA life_admin')
        END
        """
    )

    op.create_table(
        "document_folders",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("Name", sa.String(length=120), nullable=False),
        sa.Column("SortOrder", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("OwnerUserId", "Name", name="uq_life_admin_document_folder_owner_name"),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_document_folders_owner", "document_folders", ["OwnerUserId"], schema="life_admin"
    )

    op.create_table(
        "document_tags",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("Name", sa.String(length=80), nullable=False),
        sa.Column("Slug", sa.String(length=120), nullable=False),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("OwnerUserId", "Slug", name="uq_life_admin_document_tag_owner_slug"),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_document_tags_owner", "document_tags", ["OwnerUserId"], schema="life_admin"
    )

    op.create_table(
        "documents",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("CreatedByUserId", sa.Integer(), nullable=False),
        sa.Column("Title", sa.String(length=200)),
        sa.Column("OriginalFileName", sa.String(length=260)),
        sa.Column("ContentType", sa.String(length=120)),
        sa.Column("FileSizeBytes", sa.Integer()),
        sa.Column("StoragePath", sa.String(length=500), nullable=False),
        sa.Column("Hash", sa.String(length=64)),
        sa.Column("FolderId", sa.Integer()),
        sa.Column("OcrText", sa.Text()),
        sa.Column("OcrStatus", sa.String(length=20), nullable=False, server_default=sa.text("'Pending'")),
        sa.Column("OcrUpdatedAt", sa.DateTime(timezone=True)),
        sa.Column("SourceType", sa.String(length=40)),
        sa.Column("SourceDetail", sa.String(length=200)),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_documents_owner", "documents", ["OwnerUserId"], schema="life_admin"
    )
    op.create_index(
        "ix_life_admin_documents_owner_folder", "documents", ["OwnerUserId", "FolderId"], schema="life_admin"
    )
    op.create_index(
        "ix_life_admin_documents_owner_created", "documents", ["OwnerUserId", "CreatedAt"], schema="life_admin"
    )

    op.create_table(
        "document_tag_links",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("DocumentId", sa.Integer(), nullable=False),
        sa.Column("TagId", sa.Integer(), nullable=False),
        sa.UniqueConstraint("DocumentId", "TagId", name="uq_life_admin_document_tag_link"),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_document_tag_links_document",
        "document_tag_links",
        ["DocumentId"],
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_document_tag_links_tag",
        "document_tag_links",
        ["TagId"],
        schema="life_admin",
    )

    op.create_table(
        "document_links",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("DocumentId", sa.Integer(), nullable=False),
        sa.Column("LinkedEntityType", sa.String(length=40), nullable=False),
        sa.Column("LinkedEntityId", sa.Integer(), nullable=False),
        sa.Column("CreatedByUserId", sa.Integer(), nullable=False),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "DocumentId",
            "LinkedEntityType",
            "LinkedEntityId",
            name="uq_life_admin_document_link",
        ),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_document_links_document",
        "document_links",
        ["DocumentId"],
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_document_links_entity",
        "document_links",
        ["LinkedEntityType", "LinkedEntityId"],
        schema="life_admin",
    )

    op.create_table(
        "reminders",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("OwnerUserId", sa.Integer(), nullable=False),
        sa.Column("CreatedByUserId", sa.Integer(), nullable=False),
        sa.Column("SourceType", sa.String(length=40), nullable=False),
        sa.Column("SourceId", sa.Integer(), nullable=False),
        sa.Column("Title", sa.String(length=200), nullable=False),
        sa.Column("DueAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("RepeatRule", sa.String(length=120)),
        sa.Column("Status", sa.String(length=20), nullable=False, server_default=sa.text("'Open'")),
        sa.Column("AssigneeUserId", sa.Integer()),
        sa.Column("CompletedAt", sa.DateTime(timezone=True)),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_reminders_owner", "reminders", ["OwnerUserId"], schema="life_admin"
    )
    op.create_index(
        "ix_life_admin_reminders_owner_source",
        "reminders",
        ["OwnerUserId", "SourceType", "SourceId"],
        schema="life_admin",
    )

    op.create_table(
        "document_audits",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("DocumentId", sa.Integer(), nullable=False),
        sa.Column("Action", sa.String(length=40), nullable=False),
        sa.Column("ActorUserId", sa.Integer(), nullable=False),
        sa.Column("Summary", sa.String(length=400)),
        sa.Column("BeforeJson", sa.Text()),
        sa.Column("AfterJson", sa.Text()),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_document_audits_document",
        "document_audits",
        ["DocumentId"],
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_document_audits_actor",
        "document_audits",
        ["ActorUserId"],
        schema="life_admin",
    )

    op.create_table(
        "document_ai_suggestions",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("DocumentId", sa.Integer(), nullable=False),
        sa.Column("Status", sa.String(length=20), nullable=False, server_default=sa.text("'Pending'")),
        sa.Column("SuggestedFolderName", sa.String(length=120)),
        sa.Column("SuggestedTagsJson", sa.Text()),
        sa.Column("SuggestedLinksJson", sa.Text()),
        sa.Column("SuggestedReminderJson", sa.Text()),
        sa.Column("Confidence", sa.String(length=20)),
        sa.Column("RawJson", sa.Text()),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("UpdatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("DocumentId", name="uq_life_admin_document_ai_suggestion"),
        schema="life_admin",
    )
    op.create_index(
        "ix_life_admin_document_ai_suggestions_document",
        "document_ai_suggestions",
        ["DocumentId"],
        schema="life_admin",
    )


def downgrade() -> None:
    op.drop_index("ix_life_admin_document_ai_suggestions_document", table_name="document_ai_suggestions", schema="life_admin")
    op.drop_table("document_ai_suggestions", schema="life_admin")
    op.drop_index("ix_life_admin_document_audits_actor", table_name="document_audits", schema="life_admin")
    op.drop_index("ix_life_admin_document_audits_document", table_name="document_audits", schema="life_admin")
    op.drop_table("document_audits", schema="life_admin")
    op.drop_index("ix_life_admin_reminders_owner_source", table_name="reminders", schema="life_admin")
    op.drop_index("ix_life_admin_reminders_owner", table_name="reminders", schema="life_admin")
    op.drop_table("reminders", schema="life_admin")
    op.drop_index("ix_life_admin_document_links_entity", table_name="document_links", schema="life_admin")
    op.drop_index("ix_life_admin_document_links_document", table_name="document_links", schema="life_admin")
    op.drop_table("document_links", schema="life_admin")
    op.drop_index("ix_life_admin_document_tag_links_tag", table_name="document_tag_links", schema="life_admin")
    op.drop_index("ix_life_admin_document_tag_links_document", table_name="document_tag_links", schema="life_admin")
    op.drop_table("document_tag_links", schema="life_admin")
    op.drop_index("ix_life_admin_documents_owner_created", table_name="documents", schema="life_admin")
    op.drop_index("ix_life_admin_documents_owner_folder", table_name="documents", schema="life_admin")
    op.drop_index("ix_life_admin_documents_owner", table_name="documents", schema="life_admin")
    op.drop_table("documents", schema="life_admin")
    op.drop_index("ix_life_admin_document_tags_owner", table_name="document_tags", schema="life_admin")
    op.drop_table("document_tags", schema="life_admin")
    op.drop_index("ix_life_admin_document_folders_owner", table_name="document_folders", schema="life_admin")
    op.drop_table("document_folders", schema="life_admin")
