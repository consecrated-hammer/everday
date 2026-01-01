from pathlib import Path
import logging

from alembic import command
from alembic.config import Config

from app.db import BuildAdminConnectionUrl

logger = logging.getLogger("app.migrations")


def RunMigrations() -> None:
    config_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    if not config_path.exists():
        raise RuntimeError("Missing alembic.ini for migrations")

    alembic_cfg = Config(str(config_path))
    alembic_cfg.set_main_option("sqlalchemy.url", BuildAdminConnectionUrl())
    alembic_cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[2] / "alembic"))
    logger.info("running migrations")
    command.upgrade(alembic_cfg, "head")
    logger.info("migrations complete")
