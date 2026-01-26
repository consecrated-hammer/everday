"""notes tags

Revision ID: 0045_notes_tags
Revises: 0044_notes_items
Create Date: 2026-01-26 12:42:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0045_notes_tags'
down_revision = '0044_notes_items'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE notes.NoteTags (
        NoteId INT NOT NULL,
        UserId INT NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT PK_NoteTags PRIMARY KEY (NoteId, UserId),
        CONSTRAINT FK_NoteTags_NoteId FOREIGN KEY (NoteId) REFERENCES notes.Notes(Id) ON DELETE CASCADE,
        CONSTRAINT FK_NoteTags_UserId FOREIGN KEY (UserId) REFERENCES auth.Users(Id)
    )
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS notes.NoteTags")
