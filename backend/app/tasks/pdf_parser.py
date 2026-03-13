import os
from app.database import SessionLocal
from app import models
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def parse_pdf_task(document_id: int):
    """
    Background task to parse a PDF, extract text, then trigger chunking & embedding.
    """
    db = SessionLocal()
    try:
        document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            logger.error(f"Document {document_id} not found.")
            return

        document.status = "processing"
        db.commit()

        # --- Text extraction ---
        text = ""
        try:
            from pdfminer.high_level import extract_text
            text = extract_text(document.file_path)
            logger.info(f"Extracted {len(text)} chars from {document.file_path}")
        except Exception as e:
            logger.error(f"Failed to extract text: {e}")
            document.status = "failed"
            db.commit()
            return

        document.extracted_text = text
        db.commit()

    except Exception as e:
        logger.error(f"Error in parse_pdf_task: {e}")
        return
    finally:
        db.close()

    # --- Chunking & embedding (runs after DB session is closed to avoid lock issues) ---
    try:
        from app.tasks.chunker import chunk_and_embed_document
        chunk_and_embed_document(document_id)
    except Exception as e:
        logger.error(f"Error in chunk_and_embed_document: {e}")
        return

    # --- Mark completed ---
    db2 = SessionLocal()
    try:
        document = db2.query(models.Document).filter(models.Document.id == document_id).first()
        if document:
            document.status = "completed"
            db2.commit()
    finally:
        db2.close()
