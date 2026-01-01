"""add default sequences for id columns

Revision ID: 0008_fix_identity_defaults
Revises: 0007_budget_allocation_accounts
Create Date: 2025-12-31 16:25:00.000000
"""

from alembic import op

revision = "0008_fix_identity_defaults"
down_revision = "0007_budget_allocation_accounts"
branch_labels = None
depends_on = None

TABLES = (
    ("auth", "users"),
    ("auth", "refresh_tokens"),
    ("auth", "user_module_roles"),
    ("auth", "password_reset_tokens"),
    ("budget", "income_streams"),
    ("budget", "expenses"),
    ("budget", "expense_accounts"),
    ("budget", "expense_types"),
    ("budget", "allocation_accounts"),
)


def _ensure_defaults(schema: str, table: str) -> None:
    sequence_name = f"seq_{schema}_{table}_id"
    constraint_name = f"DF_{schema}_{table}_Id"
    op.execute(
        f"""
        IF OBJECT_ID('[{schema}].[{table}]', 'U') IS NOT NULL
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM sys.columns c
            JOIN sys.tables t ON t.object_id = c.object_id
            JOIN sys.schemas s ON s.schema_id = t.schema_id
            WHERE s.name = '{schema}' AND t.name = '{table}' AND c.name = 'Id' AND c.is_identity = 1
          )
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM sys.sequences seq
              JOIN sys.schemas s ON s.schema_id = seq.schema_id
              WHERE s.name = '{schema}' AND seq.name = '{sequence_name}'
            )
            BEGIN
              DECLARE @start_value bigint;
              DECLARE @sql nvarchar(max);
              SELECT @start_value = ISNULL(MAX([Id]), 0) + 1 FROM [{schema}].[{table}];
              SET @sql = CONCAT(
                'CREATE SEQUENCE [{schema}].[{sequence_name}] AS INT START WITH ',
                @start_value,
                ' INCREMENT BY 1'
              );
              EXEC(@sql);
            END;

            IF NOT EXISTS (
              SELECT 1
              FROM sys.default_constraints dc
              JOIN sys.columns c ON c.default_object_id = dc.object_id
              JOIN sys.tables t ON t.object_id = c.object_id
              JOIN sys.schemas s ON s.schema_id = t.schema_id
              WHERE s.name = '{schema}' AND t.name = '{table}' AND c.name = 'Id'
            )
            BEGIN
              EXEC('ALTER TABLE [{schema}].[{table}] ADD CONSTRAINT [{constraint_name}] '
                + 'DEFAULT (NEXT VALUE FOR [{schema}].[{sequence_name}]) FOR [Id]');
            END;
          END;
        END;
        """
    )


def upgrade() -> None:
    for schema, table in TABLES:
        _ensure_defaults(schema, table)


def downgrade() -> None:
    for schema, table in TABLES:
        sequence_name = f"seq_{schema}_{table}_id"
        constraint_name = f"DF_{schema}_{table}_Id"
        op.execute(
            f"""
            IF OBJECT_ID('[{schema}].[{table}]', 'U') IS NOT NULL
            BEGIN
              IF EXISTS (
                SELECT 1
                FROM sys.default_constraints dc
                JOIN sys.columns c ON c.default_object_id = dc.object_id
                JOIN sys.tables t ON t.object_id = c.object_id
                JOIN sys.schemas s ON s.schema_id = t.schema_id
                WHERE s.name = '{schema}' AND t.name = '{table}' AND c.name = 'Id'
                  AND dc.name = '{constraint_name}'
              )
              BEGIN
                EXEC('ALTER TABLE [{schema}].[{table}] DROP CONSTRAINT [{constraint_name}]');
              END;

              IF EXISTS (
                SELECT 1
                FROM sys.sequences seq
                JOIN sys.schemas s ON s.schema_id = seq.schema_id
                WHERE s.name = '{schema}' AND seq.name = '{sequence_name}'
              )
              BEGIN
                EXEC('DROP SEQUENCE [{schema}].[{sequence_name}]');
              END;
            END;
            """
        )
