import asyncio
import json
import logging
import smtplib
from email.message import EmailMessage
from typing import Iterable
from urllib import request

from app.config import settings

logger = logging.getLogger(__name__)


def _send_email_sync(to_email: str, subject: str, body: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        if settings.SMTP_USER and settings.SMTP_PASS:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASS)
        smtp.send_message(message)


async def send_email(to_email: str | None, subject: str, body: str) -> None:
    if not to_email:
        return
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        logger.info("Email skipped because SMTP credentials are not configured: %s", subject)
        return
    try:
        await asyncio.to_thread(_send_email_sync, to_email, subject, body)
    except Exception:
        logger.exception("Email delivery failed: %s", subject)


async def send_bulk_email(to_emails: Iterable[str], subject: str, body: str) -> None:
    await asyncio.gather(*(send_email(email, subject, body) for email in set(to_emails) if email))


def _send_sms_sync(to_phone: str, message: str) -> None:
    payload = json.dumps({
        "from": settings.SMS_FROM,
        "to": to_phone,
        "message": message,
    }).encode("utf-8")
    req = request.Request(
        settings.SMS_PROVIDER_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {settings.SMS_PROVIDER_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=15) as response:
        response.read()


async def send_sms(to_phone: str | None, message: str) -> None:
    if not to_phone:
        return
    if not settings.SMS_PROVIDER_URL or not settings.SMS_PROVIDER_TOKEN:
        logger.info("SMS skipped because provider settings are not configured")
        return
    try:
        await asyncio.to_thread(_send_sms_sync, to_phone, message)
    except Exception:
        logger.exception("SMS delivery failed")
