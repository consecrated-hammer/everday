import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()


def _build_connection_url(login_env: str, password_env: str, database_override: str | None = None) -> str:
    driver = os.getenv("SQLSERVER_DRIVER", "")
    host = os.getenv("SQLSERVER_HOST", "")
    port = os.getenv("SQLSERVER_PORT", "")
    database = database_override or os.getenv("SQLSERVER_DB", "")
    user = os.getenv(login_env, "")
    password = os.getenv(password_env, "")

    missing = [key for key, value in {
        "SQLSERVER_HOST": host,
        "SQLSERVER_PORT": port,
        "SQLSERVER_DB": database,
        "SQLSERVER_DRIVER": driver,
        login_env: user,
        password_env: password,
    }.items() if not value]
    if missing:
        raise RuntimeError(f"Missing database configuration: {', '.join(missing)}")

    driver_encoded = quote_plus(driver)
    password_encoded = quote_plus(password)
    return (
        f"mssql+pyodbc://{user}:{password_encoded}@{host}:{port}/{database}"
        f"?driver={driver_encoded}&Encrypt=yes&TrustServerCertificate=yes"
    )

def BuildUserConnectionUrl() -> str:
    return _build_connection_url("SQLSERVER_USER_LOGIN", "SQLSERVER_USER_PASSWORD")


def BuildAdminConnectionUrl(database_override: str | None = None) -> str:
    return _build_connection_url("SQLSERVER_ADMIN_LOGIN", "SQLSERVER_ADMIN_PASSWORD", database_override)


engine = create_engine(BuildUserConnectionUrl(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def GetDb():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
