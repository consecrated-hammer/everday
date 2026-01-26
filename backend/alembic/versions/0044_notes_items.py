"""notes items

Revision ID: 0044_notes_items
Revises: 0043_notes_core_table
Create Date: 2026-01-26 12:41:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0044_notes_items'
down_revision = '0043_notes_core_table'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE notes.NoteItems (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        NoteId INT NOT NULL,
        Text NVARCHAR(1000) NOT NULL,
        Checked BIT DEFAULT 0,
        OrderIndex INT NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT FK_NoteItems_NoteId FOREIGN KEY (NoteId) REFERENCES notes.Notes(Id) ON DELETE CASCADE
    )
    """)
    
    op.execute("CREATE INDEX IX_NoteItems_NoteId_OrderIndex ON notes.NoteItems(NoteId, OrderIndex)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS notes.NoteItems")
