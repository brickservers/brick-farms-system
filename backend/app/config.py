# backend/app/config.py
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from typing import List
import os

class Settings(BaseSettings):
    ENV: str = "dev"
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 5432
    DB_NAME: str = "brickfarm"
    DB_USER: str = "brickfarm"
    DB_PASS: str = "brickfarm_pass"

    JWT_SECRET: str = os.getenv("JWT_SECRET", "change_this")
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30

    S3_ENDPOINT: str = os.getenv("S3_ENDPOINT", "http://127.0.0.1:9000")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "minioadmin")
    S3_BUCKET: str = os.getenv("S3_BUCKET", "brickfarm")
    S3_REGION: str = os.getenv("S3_REGION", "us-east-1")
    S3_SECURE: bool = False if os.getenv("S3_SECURE","false").lower()!="true" else True

    REDIS_URL: str = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

    CELERY_BROKER: str = os.getenv("CELERY_BROKER", REDIS_URL)
    CELERY_BACKEND: str = os.getenv("CELERY_BACKEND", REDIS_URL)

    DEFAULT_PLAN: str = "enterprise"

    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.zoho.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "sprout@brickfarms.ng")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "BrickFarms DAP")
    SMTP_USE_TLS: bool = False if os.getenv("SMTP_USE_TLS", "true").lower() != "true" else True

    SMS_PROVIDER_URL: str = os.getenv("SMS_PROVIDER_URL", "")
    SMS_PROVIDER_TOKEN: str = os.getenv("SMS_PROVIDER_TOKEN", "")
    SMS_FROM: str = os.getenv("SMS_FROM", "BrickFarms")

    FLUTTERWAVE_API_BASE: str = os.getenv("FLUTTERWAVE_API_BASE", "https://api.flutterwave.com")
    FLUTTERWAVE_PUBLIC_KEY: str = os.getenv("FLUTTERWAVE_PUBLIC_KEY", "")
    FLUTTERWAVE_SECRET_KEY: str = os.getenv("FLUTTERWAVE_SECRET_KEY", "")
    FLUTTERWAVE_WEBHOOK_SECRET: str = os.getenv("FLUTTERWAVE_WEBHOOK_SECRET", "")
    FLUTTERWAVE_REDIRECT_URL: str = os.getenv("FLUTTERWAVE_REDIRECT_URL", "https://app.brickfarms.ng/settings")

    # Allow local frontend dev server by default for developer workflows
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
