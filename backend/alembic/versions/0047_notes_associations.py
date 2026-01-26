"""notes associations

Revision ID: 0047_notes_associations
Revises: 0046_notes_task_links
Create Date: 2026-01-26 12:44:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0047_notes_associations'
down_revision = '0046_notes_task_links'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE notes.NoteAssociations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        NoteId INT NOT NULL,
        ModuleName NVARCHAR(100) NOT NULL,
        RecordId INT NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT FK_NoteAssociations_NoteId FOREIGN KEY (NoteId) REFERENCES notes.Notes(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_NoteAssociations UNIQUE (NoteId, ModuleName, RecordId)
    )
    """)
    
    op.execute("CREATE INDEX IX_NoteAssociations_Module_Record ON notes.NoteAssociations(ModuleName, RecordId)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS notes.NoteAssociations")
