import os
from app.database import SessionLocal
from app import models
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def parse_pdf_task(document_id: int):
    """
    Background task to parse a PDF and save the extracted text to the database.
    Because we are using SQLite and not Redis right now, this will run synchronously
    or using simple threading in the FastAPI endpoint for MVP testing locally.
    """
    db = SessionLocal()
    try:
        document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            logger.error(f"Document {document_id} not found.")
            return

        document.status = "processing"
        db.commit()

        file_path = document.file_path
        text = ""

        # Using pdfminer.six based on requirements
        try:
            from pdfminer.high_level import extract_text
            text = extract_text(file_path)
            logger.info(f"Successfully extracted {len(text)} characters from {file_path}")
        except Exception as e:
            logger.error(f"Failed to extract text from {file_path}: {e}")
            document.status = "failed"
            db.commit()
            return
            
        document.extracted_text = text
        document.status = "completed"
        db.commit()

    except Exception as e:
        logger.error(f"Error in task: {e}")
    finally:
        db.close()
