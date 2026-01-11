import os
import sys
import warnings
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy.exc import SAWarning
from sqlalchemy import engine_from_config, pool

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT_DIR))

from app.db import Base, BuildAdminConnectionUrl
from app.modules.budget import models as budget_models  # noqa: F401
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.health import models as health_models  # noqa: F401
from app.modules.kids import models as kids_models  # noqa: F401
from app.modules.shopping import models as shopping_models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

warnings.filterwarnings(
    "ignore",
    message="Unrecognized server version info",
    category=SAWarning,
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = BuildAdminConnectionUrl()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        version_table_schema="ref",
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = BuildAdminConnectionUrl()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            version_table_schema="ref",
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
