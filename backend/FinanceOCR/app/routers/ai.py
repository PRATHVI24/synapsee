from fastapi import APIRouter, HTTPException
import logging

from app.models.schemas import (
    AIExtractionRequest,
    AIExtractionResponse,
    ErrorResponse
)
from app.services.ai_service import ai_service
from app.services.db_service import db_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Extraction"])


@router.post(
    "/extract",
    response_model=AIExtractionResponse,
    summary="Extract structured data from document using AI",
    description="""
    Extract structured invoice data from a previously processed document using Gemini AI.

    The system will:
    1. Retrieve the document text from ChromaDB using the provided doc_id
    2. Use RAG to find similar documents for context
    3. Apply Gemini AI to extract structured invoice data
    4. Return extracted data with confidence scores

    Required fields in response:
    - vendor: Company name issuing the invoice
    - invoice_number: Invoice ID or number
    - date: Invoice date (YYYY-MM-DD format)
    - line_items: Array of items with description, quantity, unit_price, total
    - subtotal: Subtotal amount
    - tax: Tax amount
    - total: Total amount
    """
)
async def extract_invoice_data(request: AIExtractionRequest):
    """Extract structured invoice data from document using AI"""
    try:
        logger.info(f"AI extraction requested for document: {request.doc_id}")

        # Retrieve document from database
        document = await db_service.get_document(request.doc_id)

        if not document:
            raise HTTPException(
                status_code=404,
                detail=f"Document {request.doc_id} not found"
            )

        # Get similar documents for context (RAG approach)
        similar_docs = await db_service.search_documents(
            query=document.cleaned_text[:500],  # Use first 500 chars as query
            limit=3
        )

        logger.info(f"Found {len(similar_docs)} similar documents for context")

        # Extract data using AI service
        extraction_result = await ai_service.extract_invoice_data(
            text=document.cleaned_text,
            context_documents=similar_docs
        )

        # Create response
        response = AIExtractionResponse(
            doc_id=request.doc_id,
            extracted_data=extraction_result["extracted_data"],
            overall_confidence=extraction_result["overall_confidence"]
        )

        logger.info(f"AI extraction completed for {request.doc_id} with confidence: {response.overall_confidence}")

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI extraction failed for document {request.doc_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"AI extraction failed: {str(e)}"
        )


@router.post(
    "/extract-with-context",
    response_model=AIExtractionResponse,
    summary="Extract data with custom context",
    description="""
    Extract structured invoice data with additional context provided by the user.

    This endpoint allows providing custom context or examples to improve
    extraction accuracy for specific document types or formats.
    """
)
async def extract_with_context(
    request: AIExtractionRequest,
    context_text: str = None
):
    """Extract invoice data with additional context"""
    try:
        logger.info(f"AI extraction with context requested for document: {request.doc_id}")

        # Retrieve document from database
        document = await db_service.get_document(request.doc_id)

        if not document:
            raise HTTPException(
                status_code=404,
                detail=f"Document {request.doc_id} not found"
            )

        # Get similar documents for context
        similar_docs = await db_service.search_documents(
            query=document.cleaned_text[:500],
            limit=2  # Fewer similar docs since we have custom context
        )

        # Add custom context if provided
        if context_text:
            custom_context_doc = {
                "id": "custom_context",
                "document": context_text,
                "metadata": {"type": "custom_context"},
                "distance": 0.0  # Highest relevance
            }
            similar_docs.insert(0, custom_context_doc)

        logger.info(f"Using {len(similar_docs)} context documents (including custom context)")

        # Extract data using AI service
        extraction_result = await ai_service.extract_invoice_data(
            text=document.cleaned_text,
            context_documents=similar_docs
        )

        # Create response
        response = AIExtractionResponse(
            doc_id=request.doc_id,
            extracted_data=extraction_result["extracted_data"],
            overall_confidence=extraction_result["overall_confidence"]
        )

        logger.info(f"AI extraction with context completed for {request.doc_id}")

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI extraction with context failed for document {request.doc_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"AI extraction failed: {str(e)}"
        )


@router.get(
    "/document/{doc_id}/preview",
    summary="Preview document text for AI extraction",
    description="""
    Get a preview of the document text that will be used for AI extraction.

    This is useful for debugging extraction issues or understanding
    what text the AI model will process.
    """
)
async def preview_document_text(doc_id: str):
    """Preview document text for AI extraction"""
    try:
        # Retrieve document from database
        document = await db_service.get_document(doc_id)

        if not document:
            raise HTTPException(
                status_code=404,
                detail=f"Document {doc_id} not found"
            )

        return {
            "doc_id": doc_id,
            "file_name": document.file_name,
            "file_type": document.file_type,
            "confidence_score": document.metadata.confidence_score,
            "raw_text_preview": document.raw_text[:1000] + "..." if len(document.raw_text) > 1000 else document.raw_text,
            "cleaned_text_preview": document.cleaned_text[:1000] + "..." if len(document.cleaned_text) > 1000 else document.cleaned_text,
            "text_length": {
                "raw_text": len(document.raw_text),
                "cleaned_text": len(document.cleaned_text)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document preview failed for {doc_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Document preview failed: {str(e)}"
        )


@router.post(
    "/reprocess/{doc_id}",
    response_model=AIExtractionResponse,
    summary="Reprocess document with improved AI extraction",
    description="""
    Reprocess a document using the latest AI model and techniques.

    This endpoint is useful when:
    - The initial extraction had low confidence
    - New similar documents are available for better context
    - AI model has been updated/improved
    """
)
async def reprocess_document(doc_id: str):
    """Reprocess document with improved AI extraction"""
    try:
        logger.info(f"Reprocessing document: {doc_id}")

        # Retrieve document from database
        document = await db_service.get_document(doc_id)

        if not document:
            raise HTTPException(
                status_code=404,
                detail=f"Document {doc_id} not found"
            )

        # Get more context documents for better extraction
        similar_docs = await db_service.search_documents(
            query=document.cleaned_text[:500],
            limit=5  # More context for reprocessing
        )

        logger.info(f"Reprocessing with {len(similar_docs)} similar documents for enhanced context")

        # Extract data using AI service with enhanced context
        extraction_result = await ai_service.extract_invoice_data(
            text=document.cleaned_text,
            context_documents=similar_docs
        )

        # Create response
        response = AIExtractionResponse(
            doc_id=doc_id,
            extracted_data=extraction_result["extracted_data"],
            overall_confidence=extraction_result["overall_confidence"]
        )

        logger.info(f"Document reprocessing completed for {doc_id} with confidence: {response.overall_confidence}")

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document reprocessing failed for {doc_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Document reprocessing failed: {str(e)}"
        )