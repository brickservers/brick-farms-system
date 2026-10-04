from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from urllib.parse import quote_plus
import os, sys

# Add app path
sys.path.append(os.path.join(os.path.dirname(__file__), "../../.."))

from app.db.base import Base
# import all models package so Alembic can detect metadata (app/models/__init__.py exposes them)
import app.models

config = context.config
target_metadata = Base.metadata
# Allow DATABASE_URL env var to override alembic.ini sqlalchemy.url
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    config.set_main_option("sqlalchemy.url", DATABASE_URL)
elif all(os.getenv(name) for name in ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASS")):
    db_user = quote_plus(os.environ["DB_USER"])
    db_pass = quote_plus(os.environ["DB_PASS"])
    db_host = os.environ["DB_HOST"]
    db_port = os.environ["DB_PORT"]
    db_name = os.environ["DB_NAME"]
    database_url = f"postgresql+psycopg://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section),
                                     prefix='sqlalchemy.',
                                     poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
