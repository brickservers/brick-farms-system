import json
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import tenant_scoped_user
from app.config import settings

router = APIRouter(tags=["payments"])

PLAN_PRICES = {
    "sprout": Decimal("4000.00"),
    "growth": Decimal("10000.00"),
    "enterprise": Decimal("50000.00"),
}


class CheckoutIn(BaseModel):
    plan: str


class VerifyIn(BaseModel):
    tx_ref: str | None = None
    charge_id: str | None = None


def _payment_configured() -> bool:
    return bool(settings.FLUTTERWAVE_SECRET_KEY and settings.FLUTTERWAVE_API_BASE)


def _extract_checkout_url(data: dict[str, Any]) -> str | None:
    node = data.get("data") if isinstance(data.get("data"), dict) else data
    candidates = [
        node.get("checkout_url"),
        node.get("redirect_url"),
        node.get("url"),
        (node.get("links") or {}).get("checkout_url") if isinstance(node.get("links"), dict) else None,
        (node.get("authorization") or {}).get("redirect") if isinstance(node.get("authorization"), dict) else None,
    ]
    return next((item for item in candidates if item), None)


def _extract_charge_id(data: dict[str, Any]) -> str | None:
    node = data.get("data") if isinstance(data.get("data"), dict) else data
    value = node.get("id") or node.get("charge_id") or node.get("reference")
    return str(value) if value else None


def _is_success_status(value: str | None) -> bool:
    return (value or "").lower() in {"success", "successful", "succeeded", "completed", "paid"}


@router.post("/checkout")
async def create_checkout(payload: CheckoutIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    plan = payload.plan.lower()
    if plan not in PLAN_PRICES:
        raise HTTPException(400, "Paid plan must be sprout, growth, or enterprise")
    if not _payment_configured():
        raise HTTPException(503, "Flutterwave is not configured on this server")

    user_res = await db.execute(text('SELECT email, first_name, last_name FROM "user" WHERE id = :user_id AND tenant_id = :tenant_id'), {"user_id": token.sub, "tenant_id": str(token.tenant_id)})
    user = user_res.first()
    tenant_res = await db.execute(text("SELECT name FROM tenant WHERE id = :tenant_id"), {"tenant_id": str(token.tenant_id)})
    tenant = tenant_res.first()
    tx_ref = f"bfdap-{plan}-{uuid4().hex[:18]}"
    amount = PLAN_PRICES[plan]

    await db.execute(text("""
    INSERT INTO subscription_payment (tenant_id, user_id, plan, amount, currency, tx_ref, status)
    VALUES (:tenant_id, :user_id, :plan, :amount, 'NGN', :tx_ref, 'pending')
    """), {"tenant_id": str(token.tenant_id), "user_id": token.sub, "plan": plan, "amount": amount, "tx_ref": tx_ref})
    await db.commit()

    request_body = {
        "amount": str(amount),
        "currency": "NGN",
        "reference": tx_ref,
        "tx_ref": tx_ref,
        "redirect_url": settings.FLUTTERWAVE_REDIRECT_URL,
        "customer": {
            "email": user.email if user else "",
            "name": " ".join(part for part in [getattr(user, "first_name", None), getattr(user, "last_name", None)] if part) or (user.email if user else "BrickFarms customer"),
        },
        "metadata": {"tenant_id": str(token.tenant_id), "tenant_name": tenant.name if tenant else "", "plan": plan},
    }
    headers = {"Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{settings.FLUTTERWAVE_API_BASE.rstrip('/')}/charges", json=request_body, headers=headers)
    data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"raw": response.text}
    if response.status_code >= 400:
        await db.execute(text("UPDATE subscription_payment SET status = 'failed', raw_response = CAST(:raw AS jsonb) WHERE tx_ref = :tx_ref"), {"raw": json.dumps(data), "tx_ref": tx_ref})
        await db.commit()
        raise HTTPException(502, f"Flutterwave checkout failed: {data}")

    checkout_url = _extract_checkout_url(data)
    charge_id = _extract_charge_id(data)
    await db.execute(text("""
    UPDATE subscription_payment
    SET provider_reference = :provider_reference, checkout_url = :checkout_url, raw_response = CAST(:raw AS jsonb)
    WHERE tx_ref = :tx_ref
    """), {"provider_reference": charge_id, "checkout_url": checkout_url, "raw": json.dumps(data), "tx_ref": tx_ref})
    await db.commit()
    return {"tx_ref": tx_ref, "charge_id": charge_id, "checkout_url": checkout_url, "plan": plan, "amount": float(amount), "currency": "NGN"}


@router.post("/verify")
async def verify_payment(payload: VerifyIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    if not _payment_configured():
        raise HTTPException(503, "Flutterwave is not configured on this server")
    pay_res = await db.execute(text("""
    SELECT * FROM subscription_payment
    WHERE tenant_id = :tenant_id AND (:tx_ref IS NULL OR tx_ref = :tx_ref) AND (:charge_id IS NULL OR provider_reference = :charge_id)
    ORDER BY created_at DESC
    LIMIT 1
    """), {"tenant_id": str(token.tenant_id), "tx_ref": payload.tx_ref, "charge_id": payload.charge_id})
    payment = pay_res.first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    charge_id = payload.charge_id or payment.provider_reference
    if not charge_id:
        raise HTTPException(400, "Payment has no Flutterwave charge id to verify")

    headers = {"Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}"}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"{settings.FLUTTERWAVE_API_BASE.rstrip('/')}/charges/{charge_id}", headers=headers)
    data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"raw": response.text}
    node = data.get("data") if isinstance(data.get("data"), dict) else data
    status = str(node.get("status") or data.get("status") or "pending").lower()
    verified = _is_success_status(status)
    await db.execute(text("""
    UPDATE subscription_payment
    SET status = :status, raw_response = CAST(:raw AS jsonb), verified_at = :verified_at
    WHERE id = :id
    """), {"status": "successful" if verified else status, "raw": json.dumps(data), "verified_at": datetime.utcnow() if verified else None, "id": payment.id})
    if verified:
        await db.execute(text("UPDATE tenant SET plan = :plan WHERE id = :tenant_id"), {"plan": payment.plan, "tenant_id": str(token.tenant_id)})
    await db.commit()
    return {"verified": verified, "status": "successful" if verified else status, "plan": payment.plan}
