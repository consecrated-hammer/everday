"""create auth users and module roles

Revision ID: 0002_auth_users_roles
Revises: 0001_budget_income_streams
Create Date: 2025-12-30 10:25:00.000000
"""

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa
from passlib.context import CryptContext

revision = "0002_auth_users_roles"
down_revision = "0001_budget_income_streams"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("Username", sa.String(length=120), nullable=False),
        sa.Column("PasswordHash", sa.String(length=255), nullable=False),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.UniqueConstraint("Username", name="ux_auth_users_username"),
        schema="auth",
    )
    op.create_index("ix_auth_users_username", "users", ["Username"], unique=True, schema="auth")

    op.create_table(
        "refresh_tokens",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("TokenHash", sa.String(length=255), nullable=False),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.Column("ExpiresAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("RevokedAt", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["UserId"], ["auth.users.Id"], name="fk_auth_refresh_tokens_user"),
        schema="auth",
    )
    op.create_index("ix_auth_refresh_tokens_user", "refresh_tokens", ["UserId"], schema="auth")

    op.create_table(
        "user_module_roles",
        sa.Column("Id", sa.Integer(), primary_key=True),
        sa.Column("UserId", sa.Integer(), nullable=False),
        sa.Column("ModuleName", sa.String(length=80), nullable=False),
        sa.Column("Role", sa.String(length=20), nullable=False),
        sa.Column(
            "CreatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.Column(
            "UpdatedAt",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("SYSUTCDATETIME()"),
        ),
        sa.ForeignKeyConstraint(["UserId"], ["auth.users.Id"], name="fk_auth_user_module_roles_user"),
        schema="auth",
    )
    op.create_index("ix_auth_user_module_roles_user", "user_module_roles", ["UserId"], schema="auth")
    op.create_index(
        "ix_auth_user_module_roles_module",
        "user_module_roles",
        ["ModuleName"],
        schema="auth",
    )

    pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
    password_hash = pwd_context.hash("ChangeMeNow1!")
    now = datetime.now(tz=timezone.utc)

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            IF NOT EXISTS (SELECT 1 FROM auth.users WHERE Username = :username)
            BEGIN
              INSERT INTO auth.users (Username, PasswordHash, CreatedAt)
              VALUES (:username, :password_hash, :created_at);
            END
            """
        ),
        {"username": "kevin", "password_hash": password_hash, "created_at": now},
    )
    connection.execute(
        sa.text(
            """
            IF NOT EXISTS (SELECT 1 FROM auth.users WHERE Username = :username)
            BEGIN
              INSERT INTO auth.users (Username, PasswordHash, CreatedAt)
              VALUES (:username, :password_hash, :created_at);
            END
            """
        ),
        {"username": "bianca", "password_hash": password_hash, "created_at": now},
    )

    for username, module_name, role in [
        ("kevin", "budget", "Admin"),
        ("kevin", "settings", "Admin"),
        ("bianca", "budget", "Edit"),
        ("bianca", "settings", "ReadOnly"),
    ]:
        connection.execute(
            sa.text(
                """
                IF NOT EXISTS (
                  SELECT 1
                  FROM auth.user_module_roles umr
                  JOIN auth.users u ON u.Id = umr.UserId
                  WHERE u.Username = :username
                    AND umr.ModuleName = :module_name
                )
                BEGIN
                  INSERT INTO auth.user_module_roles (UserId, ModuleName, Role, CreatedAt, UpdatedAt)
                  SELECT u.Id, :module_name, :role, :created_at, :updated_at
                  FROM auth.users u
                  WHERE u.Username = :username;
                END
                """
            ),
            {
                "username": username,
                "module_name": module_name,
                "role": role,
                "created_at": now,
                "updated_at": now,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_auth_user_module_roles_module", table_name="user_module_roles", schema="auth")
    op.drop_index("ix_auth_user_module_roles_user", table_name="user_module_roles", schema="auth")
    op.drop_table("user_module_roles", schema="auth")
    op.drop_index("ix_auth_refresh_tokens_user", table_name="refresh_tokens", schema="auth")
    op.drop_table("refresh_tokens", schema="auth")
    op.drop_index("ix_auth_users_username", table_name="users", schema="auth")
    op.drop_table("users", schema="auth")
