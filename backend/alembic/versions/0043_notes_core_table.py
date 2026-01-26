"""notes core table

Revision ID: 0043_notes_core_table
Revises: 0042_health_ai_suggestions_storage
Create Date: 2026-01-26 12:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0043_notes_core_table'
down_revision = '0042_health_ai_suggestions_storage'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'notes')
    BEGIN
        EXEC('CREATE SCHEMA notes')
    END
    """)
    
    op.execute("""
    CREATE TABLE notes.Notes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Title NVARCHAR(500) NOT NULL,
        Content NVARCHAR(MAX),
        Labels NVARCHAR(MAX),
        IsPinned BIT DEFAULT 0,
        ArchivedAt DATETIME2,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Notes_UserId FOREIGN KEY (UserId) REFERENCES auth.Users(Id)
    )
    """)
    
    op.execute("CREATE INDEX IX_Notes_UserId ON notes.Notes(UserId)")
    op.execute("CREATE INDEX IX_Notes_ArchivedAt ON notes.Notes(ArchivedAt)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS notes.Notes")
    op.execute("""
    IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'notes')
    BEGIN
        EXEC('DROP SCHEMA notes')
    END
    """)
