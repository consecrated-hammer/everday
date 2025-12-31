import logging
import os

from sqlalchemy import create_engine, text

from app.db import BuildAdminConnectionUrl

logger = logging.getLogger("app.bootstrap")


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def _env_truthy(name: str) -> bool:
    value = os.getenv(name, "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def EnsureDatabaseSetup() -> None:
    if _env_truthy("SQLSERVER_SKIP_BOOTSTRAP"):
        logger.info("skipping database bootstrap (managed externally)")
        return

    database = _require_env("SQLSERVER_DB")
    user_login = _require_env("SQLSERVER_USER_LOGIN")
    user_password = _require_env("SQLSERVER_USER_PASSWORD")
    role_name = "EverdayCrud"

    admin_master_url = BuildAdminConnectionUrl(database_override="master")
    master_engine = create_engine(admin_master_url, pool_pre_ping=True, isolation_level="AUTOCOMMIT")

    logger.info("ensuring database and login")
    with master_engine.connect() as connection:
        connection.execute(
            text(
                """
                DECLARE @DatabaseName sysname = :db;
                DECLARE @LoginName sysname = :login;
                DECLARE @LoginPassword nvarchar(256) = :password;
                DECLARE @SafeDb sysname = REPLACE(@DatabaseName, ']', ']]');
                DECLARE @SafeLogin sysname = REPLACE(@LoginName, ']', ']]');
                DECLARE @SafePassword nvarchar(512) = REPLACE(@LoginPassword, '''', '''''');

                BEGIN TRY
                  IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = @DatabaseName)
                  BEGIN
                    EXEC('CREATE DATABASE [' + @SafeDb + ']');
                  END;
                END TRY
                BEGIN CATCH
                  IF ERROR_NUMBER() <> 1801
                  BEGIN
                    THROW;
                  END;
                END CATCH;

                DECLARE @EngineEdition int = CAST(SERVERPROPERTY('EngineEdition') AS int);
                DECLARE @SupportsCheckPolicy bit = CASE WHEN @EngineEdition = 5 THEN 0 ELSE 1 END;

                IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = @LoginName)
                BEGIN
                  IF @SupportsCheckPolicy = 1
                  BEGIN
                    EXEC('ALTER LOGIN [' + @SafeLogin + '] WITH PASSWORD = '''
                      + @SafePassword + ''', CHECK_POLICY = OFF, DEFAULT_DATABASE = [' + @SafeDb + ']');
                  END
                  ELSE
                  BEGIN
                    EXEC('ALTER LOGIN [' + @SafeLogin + '] WITH PASSWORD = '''
                      + @SafePassword + ''', DEFAULT_DATABASE = [' + @SafeDb + ']');
                  END
                END
                ELSE
                BEGIN
                  IF @SupportsCheckPolicy = 1
                  BEGIN
                    EXEC('CREATE LOGIN [' + @SafeLogin + '] WITH PASSWORD = '''
                      + @SafePassword + ''', CHECK_POLICY = OFF, DEFAULT_DATABASE = [' + @SafeDb + ']');
                  END
                  ELSE
                  BEGIN
                    EXEC('CREATE LOGIN [' + @SafeLogin + '] WITH PASSWORD = '''
                      + @SafePassword + ''', DEFAULT_DATABASE = [' + @SafeDb + ']');
                  END
                END;
                """
            ),
            {"db": database, "login": user_login, "password": user_password},
        )

    admin_db_url = BuildAdminConnectionUrl(database_override=database)
    db_engine = create_engine(admin_db_url, pool_pre_ping=True)

    logger.info("ensuring schemas, role, and grants")
    schemas = ["auth", "budget", "health", "agenda", "files", "ai", "ref"]

    with db_engine.begin() as connection:
        for schema in schemas:
            connection.execute(
                text(
                    """
                    DECLARE @SchemaName sysname = :schema;
                    DECLARE @SafeSchema sysname = REPLACE(@SchemaName, ']', ']]');
                    IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = @SchemaName)
                    BEGIN
                      EXEC('CREATE SCHEMA [' + @SafeSchema + ']');
                    END;
                    """
                ),
                {"schema": schema},
            )

        connection.execute(
            text(
                """
                DECLARE @LoginName sysname = :login;
                DECLARE @RoleName sysname = :role;
                DECLARE @SafeLogin sysname = REPLACE(@LoginName, ']', ']]');
                DECLARE @SafeRole sysname = REPLACE(@RoleName, ']', ']]');

                IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = @LoginName)
                BEGIN
                  EXEC('ALTER USER [' + @SafeLogin + '] WITH LOGIN = [' + @SafeLogin + '], DEFAULT_SCHEMA = [auth]');
                END
                ELSE
                BEGIN
                  EXEC('CREATE USER [' + @SafeLogin + '] FOR LOGIN [' + @SafeLogin + '] WITH DEFAULT_SCHEMA = [auth]');
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE type = 'R' AND name = @RoleName)
                BEGIN
                  EXEC('CREATE ROLE [' + @SafeRole + ']');
                END;

                IF IS_ROLEMEMBER(@RoleName, @LoginName) <> 1
                BEGIN
                  EXEC('ALTER ROLE [' + @SafeRole + '] ADD MEMBER [' + @SafeLogin + ']');
                END;
                """
            ),
            {"login": user_login, "role": role_name},
        )

        for schema in schemas:
            if schema == "ref":
                connection.execute(
                    text(
                        "GRANT SELECT ON SCHEMA::[ref] TO [EverdayCrud];"
                    )
                )
            else:
                connection.execute(
                    text(
                        f"GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[{schema}] TO [EverdayCrud];"
                    )
                )

        connection.execute(
            text("DENY ALTER, CONTROL, TAKE OWNERSHIP ON SCHEMA::[dbo] TO [EverdayCrud];")
        )

    logger.info("bootstrap complete")
