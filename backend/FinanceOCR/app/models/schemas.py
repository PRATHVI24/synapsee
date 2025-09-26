from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from decimal import Decimal


class LineItem(BaseModel):
    description: str = Field(..., description="Description of the item")
    quantity: Optional[float] = Field(None, description="Quantity of the item")
    unit_price: Optional[Decimal] = Field(None, description="Unit price of the item")
    total: Optional[Decimal] = Field(None, description="Total price for this line item")


class DocumentMetadata(BaseModel):
    document_type: str = Field(default="invoice", description="Type of document")
    confidence_score: float = Field(ge=0.0, le=1.0, description="OCR confidence score")
    file_size: Optional[int] = Field(None, description="File size in bytes")


class InvoiceMetadata(BaseModel):
    status: str = Field(default="approved", description="Invoice status")
    source_doc_id: str = Field(..., description="ID of the source document")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved_by: Optional[str] = Field(None, description="User who approved the invoice")


class OCRResponse(BaseModel):
    doc_id: str = Field(..., description="Generated document ID")
    raw_text: str = Field(..., description="Raw OCR extracted text")
    cleaned_text: str = Field(..., description="Cleaned and preprocessed text")
    confidence: float = Field(ge=0.0, le=1.0, description="Overall OCR confidence")


class AIExtractionRequest(BaseModel):
    doc_id: str = Field(..., description="Document ID to extract data from")


class ExtractedInvoiceData(BaseModel):
    vendor: Optional[str] = Field(None, description="Vendor name")
    invoice_number: Optional[str] = Field(None, description="Invoice number")
    date: Optional[str] = Field(None, description="Invoice date (YYYY-MM-DD format)")
    line_items: List[LineItem] = Field(default=[], description="List of line items")
    subtotal: Optional[Decimal] = Field(None, description="Subtotal amount")
    tax: Optional[Decimal] = Field(None, description="Tax amount")
    total: Optional[Decimal] = Field(None, description="Total amount")
    confidence_scores: Dict[str, float] = Field(default={}, description="Confidence scores for each field")

    @validator('date')
    def validate_date_format(cls, v):
        if v is not None:
            try:
                datetime.strptime(v, '%Y-%m-%d')
            except ValueError:
                raise ValueError('Date must be in YYYY-MM-DD format')
        return v


class AIExtractionResponse(BaseModel):
    doc_id: str = Field(..., description="Document ID")
    extracted_data: ExtractedInvoiceData = Field(..., description="Extracted invoice data")
    overall_confidence: float = Field(ge=0.0, le=1.0, description="Overall extraction confidence")


class ApproveInvoiceRequest(BaseModel):
    doc_id: str = Field(..., description="Source document ID")
    vendor: str = Field(..., description="Vendor name")
    invoice_number: str = Field(..., description="Invoice number")
    date: str = Field(..., description="Invoice date (YYYY-MM-DD format)")
    line_items: List[LineItem] = Field(..., description="List of line items")
    subtotal: Decimal = Field(..., description="Subtotal amount")
    tax: Decimal = Field(..., description="Tax amount")
    total: Decimal = Field(..., description="Total amount")
    approved_by: Optional[str] = Field(None, description="User who approved the invoice")

    @validator('date')
    def validate_date_format(cls, v):
        try:
            datetime.strptime(v, '%Y-%m-%d')
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')
        return v


class ApproveInvoiceResponse(BaseModel):
    success: bool = Field(..., description="Whether the invoice was successfully approved")
    invoice_id: str = Field(..., description="Generated invoice ID")


class RAGQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Query text")
    context_type: Literal["invoices", "documents", "all"] = Field(
        default="all",
        description="Type of context to search in"
    )
    limit: Optional[int] = Field(default=5, ge=1, le=20, description="Maximum number of results")


class RAGReference(BaseModel):
    id: str = Field(..., description="Document or invoice ID")
    type: Literal["document", "invoice"] = Field(..., description="Type of reference")
    relevance_score: float = Field(ge=0.0, le=1.0, description="Relevance score")
    snippet: str = Field(..., description="Relevant text snippet")


class RAGQueryResponse(BaseModel):
    answer: str = Field(..., description="AI-generated answer")
    references: List[RAGReference] = Field(default=[], description="Supporting references")
    confidence: float = Field(ge=0.0, le=1.0, description="Answer confidence score")


class DocumentRecord(BaseModel):
    id: str = Field(..., description="Document ID")
    file_name: str = Field(..., description="Original file name")
    file_type: str = Field(..., description="MIME type of the file")
    upload_date: datetime = Field(..., description="Upload timestamp")
    raw_text: str = Field(..., description="Raw OCR text")
    cleaned_text: str = Field(..., description="Cleaned text")
    metadata: DocumentMetadata = Field(..., description="Document metadata")


class InvoiceRecord(BaseModel):
    id: str = Field(..., description="Invoice ID")
    vendor: str = Field(..., description="Vendor name")
    invoice_number: str = Field(..., description="Invoice number")
    date: str = Field(..., description="Invoice date")
    line_items: List[LineItem] = Field(..., description="Line items")
    subtotal: Decimal = Field(..., description="Subtotal amount")
    tax: Decimal = Field(..., description="Tax amount")
    total: Decimal = Field(..., description="Total amount")
    metadata: InvoiceMetadata = Field(..., description="Invoice metadata")


class InvoiceListResponse(BaseModel):
    invoices: List[InvoiceRecord] = Field(..., description="List of invoices")
    total: int = Field(..., description="Total number of invoices")
    page: int = Field(..., description="Current page")
    limit: int = Field(..., description="Items per page")


class HealthCheckResponse(BaseModel):
    status: str = Field(..., description="API status")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = Field(..., description="API version")


class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow)