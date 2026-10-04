from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import text
from app.api.deps import tenant_scoped_user
from app.schemas.finance import TransactionIn, TransactionOut, InvestmentIn, InvestmentOut, PayoutIn, PayoutOut
import json

router = APIRouter(tags=["finance"]) 


def _row_to_dict(row):
    data = dict(row._mapping)
    for key, value in list(data.items()):
        if hasattr(value, "isoformat"):
            data[key] = value.isoformat()
        elif value is not None and value.__class__.__name__ == "Decimal":
            data[key] = float(value)
        else:
            data[key] = str(value) if key.endswith("_id") or key == "id" else value
    return data


@router.get('/transactions')
async def list_transactions(ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    res = await db.execute(text("""
    SELECT id, account_id, amount, currency, ts, description, meta
    FROM finance_transactions
    WHERE tenant_id = :tenant_id
    ORDER BY ts DESC
    LIMIT 200
    """), {"tenant_id": token.tenant_id})
    return [_row_to_dict(row) for row in res.fetchall()]


@router.post('/transactions', response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def create_transaction(payload: TransactionIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    sql = text("""
    INSERT INTO finance_transactions (tenant_id, account_id, amount, currency, ts, description, meta)
    VALUES (:tenant_id, :account_id, :amount, :currency, COALESCE(:ts, now()), :description, CAST(:meta AS jsonb))
    RETURNING id, account_id, amount, currency, ts, description, meta
    """)
    params = {"tenant_id": token.tenant_id, "account_id": str(payload.account_id), "amount": payload.amount, "currency": payload.currency, "ts": payload.ts, "description": payload.description, "meta": json.dumps(payload.meta or {})}
    res = await db.execute(sql, params)
    row = res.fetchone()
    await db.commit()
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create transaction")
    return TransactionOut(id=row.id, account_id=row.account_id, amount=row.amount, currency=row.currency, ts=row.ts, description=row.description, meta=row.meta)


@router.get('/investments')
async def list_investments(ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    res = await db.execute(text("""
    SELECT id, name, amount, currency, ts, meta
    FROM investments
    WHERE tenant_id = :tenant_id
    ORDER BY ts DESC
    LIMIT 200
    """), {"tenant_id": token.tenant_id})
    return [_row_to_dict(row) for row in res.fetchall()]


@router.post('/investments', response_model=InvestmentOut, status_code=status.HTTP_201_CREATED)
async def create_investment(payload: InvestmentIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    sql = text("""
    INSERT INTO investments (tenant_id, name, amount, currency, ts, meta)
    VALUES (:tenant_id, :name, :amount, :currency, COALESCE(:ts, now()), CAST(:meta AS jsonb))
    RETURNING id, name, amount, currency, ts, meta
    """)
    params = {"tenant_id": token.tenant_id, "name": payload.name, "amount": payload.amount, "currency": payload.currency, "ts": payload.ts, "meta": json.dumps(payload.meta or {})}
    res = await db.execute(sql, params)
    row = res.fetchone()
    await db.commit()
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create investment")
    return InvestmentOut(id=row.id, name=row.name, amount=row.amount, currency=row.currency, ts=row.ts, meta=row.meta)


@router.post('/investments/{investment_id}/receipts', status_code=status.HTTP_201_CREATED)
async def attach_receipt(investment_id: str, file: UploadFile = File(...), ctx=Depends(tenant_scoped_user)):
    """Accept a multipart file upload (UploadFile). In production, prefer streaming to S3.
    """
    token, db = ctx
    content = await file.read()
    sql = text("""
    INSERT INTO receipts (tenant_id, investment_id, filename, content)
    VALUES (:tenant_id, :investment_id, :filename, :content)
    RETURNING id
    """)
    res = await db.execute(sql, {"tenant_id": token.tenant_id, "investment_id": investment_id, "filename": file.filename, "content": content})
    row = res.fetchone()
    await db.commit()
    return {"id": getattr(row, 'id', None)}


@router.get('/payouts')
async def list_payouts(ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    res = await db.execute(text("""
    SELECT id, investment_id, amount, currency, ts, note
    FROM payouts
    WHERE tenant_id = :tenant_id
    ORDER BY ts DESC
    LIMIT 200
    """), {"tenant_id": token.tenant_id})
    return [_row_to_dict(row) for row in res.fetchall()]


@router.post('/payouts', response_model=PayoutOut, status_code=status.HTTP_201_CREATED)
async def create_payout(payload: PayoutIn, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    sql = text("""
    INSERT INTO payouts (tenant_id, investment_id, amount, currency, ts, note)
    VALUES (:tenant_id, :investment_id, :amount, :currency, COALESCE(:ts, now()), :note)
    RETURNING id, investment_id, amount, currency, ts, note
    """)
    params = {"tenant_id": token.tenant_id, "investment_id": str(payload.investment_id), "amount": payload.amount, "currency": payload.currency, "ts": payload.ts, "note": payload.note}
    res = await db.execute(sql, params)
    row = res.fetchone()
    await db.commit()
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create payout")
    return PayoutOut(id=row.id, investment_id=row.investment_id, amount=row.amount, currency=row.currency, ts=row.ts, note=row.note)


@router.get('/investments/{investment_id}/roi')
async def investment_roi(investment_id: str, ctx=Depends(tenant_scoped_user)):
    token, db = ctx
    # simple ROI: sum payouts / investment.amount
    inv_sql = text("SELECT id, amount FROM investments WHERE id = :id AND tenant_id = :tid")
    r = await db.execute(inv_sql, {"id": investment_id, "tid": token.tenant_id})
    inv = r.fetchone()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    pay_sql = text("SELECT COALESCE(SUM(amount),0) AS total FROM payouts WHERE investment_id = :id AND tenant_id = :tid")
    pr = await db.execute(pay_sql, {"id": investment_id, "tid": token.tenant_id})
    tot = pr.fetchone()
    total_payout = getattr(tot, 'total', 0) or 0
    roi = None
    try:
        roi = float(total_payout) / float(inv.amount) if inv.amount and inv.amount != 0 else None
    except Exception:
        roi = None
    return {"investment_id": investment_id, "amount": inv.amount, "total_payout": total_payout, "roi": roi}
