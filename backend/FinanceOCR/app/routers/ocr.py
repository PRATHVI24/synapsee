from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
import logging
import os
from typing import List

from app.models.schemas import OCRResponse, ErrorResponse
from app.services.ocr_service import ocr_service
from app.services.db_service import db_service
from app.config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR"])


async def validate_file(file: UploadFile = File(...)) -> UploadFile:
    """Validate uploaded file"""
    # Check file size
    if file.size and file.size > settings.max_file_size:
        raise HTTPException(
            status_code=413,
            detail=f"File size ({file.size} bytes) exceeds maximum allowed size ({settings.max_file_size} bytes)"
        )

    # Check file extension
    if file.filename:
        file_ext = file.filename.split('.')[-1].lower()
        if file_ext not in settings.allowed_extensions:
            raise HTTPException(
                status_code=415,
                detail=f"File type '{file_ext}' not supported. Allowed types: {', '.join(settings.allowed_extensions)}"
            )

    # Check content type
    if file.content_type:
        allowed_content_types = [
            "image/png", "image/jpeg", "image/jpg", "application/pdf"
        ]
        if file.content_type not in allowed_content_types:
            raise HTTPException(
                status_code=415,
                detail=f"Content type '{file.content_type}' not supported"
            )

    return file


@router.post(
    "/extract",
    response_model=OCRResponse,
    summary="Extract text from document using OCR",
    description="""
    Upload an image or PDF file to extract text using OCR with preprocessing.

    The system will:
    1. Apply image preprocessing (grayscale, denoise, deskew, contrast enhancement)
    2. Extract text using Tesseract OCR
    3. Generate embeddings and store in ChromaDB
    4. Return extracted text with confidence scores

    Supported formats: PNG, JPG, JPEG, PDF
    Maximum file size: 10MB
    """
)
async def extract_text(
    file: UploadFile = Depends(validate_file)
):
    """Extract text from uploaded document using OCR"""
    try:
        logger.info(f"Processing file: {file.filename} ({file.content_type})")

        # Read file content
        file_content = await file.read()

        if not file_content:
            raise HTTPException(
                status_code=400,
                detail="Empty file uploaded"
            )

        # Process document with OCR
        result = await ocr_service.process_document(
            file_bytes=file_content,
            filename=file.filename or "unknown",
            content_type=file.content_type or "application/octet-stream"
        )

        # Store document in database
        stored = await db_service.store_document(
            doc_id=result["doc_id"],
            metadata=result["metadata"]
        )

        if not stored:
            logger.warning(f"Failed to store document {result['doc_id']} in database")

        # Save file to uploads directory for reference
        try:
            os.makedirs(settings.upload_dir, exist_ok=True)
            file_path = os.path.join(settings.upload_dir, f"{result['doc_id']}_{file.filename}")
            with open(file_path, "wb") as f:
                f.write(file_content)
            logger.info(f"File saved to {file_path}")
        except Exception as e:
            logger.warning(f"Failed to save file to disk: {str(e)}")

        # Return OCR results
        return OCRResponse(
            doc_id=result["doc_id"],
            raw_text=result["raw_text"],
            cleaned_text=result["cleaned_text"],
            confidence=result["confidence"]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR extraction failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}"
        )


@router.post(
    "/batch-extract",
    response_model=List[OCRResponse],
    summary="Extract text from multiple documents",
    description="""
    Upload multiple files for batch OCR processing.

    Each file will be processed independently and stored in the database.
    Returns a list of OCR results for each file.

    Maximum 10 files per request.
    """
)
async def batch_extract_text(
    files: List[UploadFile] = File(...)
):
    """Extract text from multiple uploaded documents"""
    try:
        if len(files) > 10:
            raise HTTPException(
                status_code=400,
                detail="Maximum 10 files allowed per batch request"
            )

        results = []
        failed_files = []

        for file in files:
            try:
                # Validate each file
                await validate_file(file)

                # Read file content
                file_content = await file.read()

                if not file_content:
                    failed_files.append({
                        "filename": file.filename,
                        "error": "Empty file"
                    })
                    continue

                # Process document with OCR
                result = await ocr_service.process_document(
                    file_bytes=file_content,
                    filename=file.filename or "unknown",
                    content_type=file.content_type or "application/octet-stream"
                )

                # Store document in database
                stored = await db_service.store_document(
                    doc_id=result["doc_id"],
                    metadata=result["metadata"]
                )

                if not stored:
                    logger.warning(f"Failed to store document {result['doc_id']} in database")

                # Add to results
                results.append(OCRResponse(
                    doc_id=result["doc_id"],
                    raw_text=result["raw_text"],
                    cleaned_text=result["cleaned_text"],
                    confidence=result["confidence"]
                ))

                logger.info(f"Successfully processed {file.filename}")

            except Exception as e:
                logger.error(f"Failed to process {file.filename}: {str(e)}")
                failed_files.append({
                    "filename": file.filename,
                    "error": str(e)
                })

        # Log batch processing results
        logger.info(f"Batch processing completed: {len(results)} successful, {len(failed_files)} failed")

        if failed_files:
            logger.warning(f"Failed files: {failed_files}")

        if not results and failed_files:
            raise HTTPException(
                status_code=500,
                detail=f"All files failed to process: {failed_files}"
            )

        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch OCR processing failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Batch processing failed: {str(e)}"
        )