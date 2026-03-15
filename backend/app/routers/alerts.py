from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/")
def list_alerts(db: Session = Depends(get_db)):
    alerts = (
        db.query(models.Alert)
        .order_by(models.Alert.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": a.id,
            "title": a.title,
            "message": a.message,
            "document_id": a.document_id,
            "user_id": a.user_id,
            "is_read": a.is_read,
            "created_at": a.created_at,
        }
        for a in alerts
    ]


@router.patch("/{alert_id}/read")
def mark_read(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"ok": True}
