"""notes task links

Revision ID: 0046_notes_task_links
Revises: 0045_notes_tags
Create Date: 2026-01-26 12:43:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0046_notes_task_links'
down_revision = '0045_notes_tags'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE notes.NoteTaskLinks (
        NoteId INT NOT NULL,
        TaskId INT NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT PK_NoteTaskLinks PRIMARY KEY (NoteId, TaskId),
        CONSTRAINT FK_NoteTaskLinks_NoteId FOREIGN KEY (NoteId) REFERENCES notes.Notes(Id) ON DELETE CASCADE,
        CONSTRAINT FK_NoteTaskLinks_TaskId FOREIGN KEY (TaskId) REFERENCES tasks.Tasks(Id) ON DELETE CASCADE
    )
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS notes.NoteTaskLinks")
