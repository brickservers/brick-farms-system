FROM python:3.12-slim AS builder
WORKDIR /app

# Install build deps for any binary wheels (psycopg, geo libs if needed)
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential gcc libpq-dev \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt pyproject.toml ./
RUN python -m pip install --upgrade pip
# Build wheels to speed final image install
RUN pip wheel --wheel-dir=/wheels -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
# Create non-root user and home directory
RUN groupadd -r app \
 && useradd -r -g app -d /home/app -s /sbin/nologin -m app \
 && mkdir -p /home/app/.gunicorn \
 && chown -R app:app /home/app

# Copy pre-built wheels and install
COPY --from=builder /wheels /wheels
COPY requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
 && pip install --no-index --find-links=/wheels -r requirements.txt \
 && pip install gunicorn uvloop
# Ensure psycopg2 is available for Alembic/SQLAlchemy legacy dialect imports
RUN python -m pip install psycopg2-binary

# Copy application code
COPY . ./
RUN chown -R app:app /app
USER app

# Ensure a sensible HOME inside the container
ENV HOME=/home/app

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "--bind", "0.0.0.0:8000", "--workers", "4", "--log-level", "info"]
