from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
import shutil
from app import models
from app.database import get_db
from app.tasks.pdf_parser import parse_pdf_task
from app.routers.auth import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = "uploaded_docs"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.post("/upload/")
async def upload_document(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    db_document = models.Document(
        filename=file.filename,
        file_path=file_path,
        status="pending",
        user_id=current_user.id
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    # Create an evidence alert for the new upload
    alert = models.Alert(
        title="New Guideline Uploaded",
        message=f'"{file.filename}" was uploaded by {current_user.full_name}.',
        document_id=db_document.id,
        user_id=current_user.id
    )
    db.add(alert)
    db.commit()

    # Trigger background task
    background_tasks.add_task(parse_pdf_task, db_document.id)
    
    return {"message": "Document uploaded successfully", "id": db_document.id, "filename": db_document.filename}

@router.get("/")
def list_documents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    documents = db.query(models.Document).offset(skip).limit(limit).all()
    return [{"id": d.id, "filename": d.filename, "status": d.status, "created_at": d.created_at, "user_id": d.user_id} for d in documents]

@router.delete("/{document_id}")
def delete_document(
    document_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if document.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only delete documents you uploaded.")
        
    if os.path.exists(document.file_path):
        os.remove(document.file_path)
        
    db.delete(document)
    db.commit()
    return {"message": "Document deleted"}

@router.get("/{document_id}/chunks")
def get_document_chunks(document_id: int, db: Session = Depends(get_db)):
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    chunks = (
        db.query(models.DocumentChunk)
        .filter(models.DocumentChunk.document_id == document_id)
        .order_by(models.DocumentChunk.chunk_index)
        .all()
    )
    return {
        "document_id": document_id,
        "filename": document.filename,
        "total_chunks": len(chunks),
        "chunks": [
            {"index": c.chunk_index, "text": c.chunk_text}
            for c in chunks
        ]
    }

