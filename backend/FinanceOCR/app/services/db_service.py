import logging
import json
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from decimal import Decimal

from app.db.chromadb_client import chroma_client
from app.models.schemas import (
    DocumentRecord, InvoiceRecord, DocumentMetadata, InvoiceMetadata,
    LineItem, ApproveInvoiceRequest
)

logger = logging.getLogger(__name__)


class DatabaseService:
    def __init__(self):
        self.chroma_client = chroma_client

    async def store_document(
        self,
        doc_id: str,
        metadata: Dict[str, Any]
    ) -> bool:
        """Store a processed document in the database"""
        try:
            # Store the cleaned text for vector search
            text_for_embedding = metadata.get('cleaned_text', metadata.get('raw_text', ''))

            # Store document in ChromaDB
            success = await self.chroma_client.add_document(
                doc_id=doc_id,
                text=text_for_embedding,
                metadata=metadata
            )

            if success:
                logger.info(f"Document {doc_id} stored successfully")
            else:
                logger.error(f"Failed to store document {doc_id}")

            return success

        except Exception as e:
            logger.error(f"Error storing document {doc_id}: {str(e)}")
            return False

    async def get_document(self, doc_id: str) -> Optional[DocumentRecord]:
        """Retrieve a document by ID"""
        try:
            result = await self.chroma_client.get_document(doc_id)

            if result:
                metadata = result['metadata']

                # Convert to DocumentRecord
                doc_metadata = DocumentMetadata(
                    document_type=metadata.get('document_type', 'invoice'),
                    confidence_score=metadata.get('confidence_score', 0.0),
                    file_size=metadata.get('file_size')
                )

                document = DocumentRecord(
                    id=result['id'],
                    file_name=metadata['file_name'],
                    file_type=metadata['file_type'],
                    upload_date=datetime.fromisoformat(metadata['upload_date'].replace('Z', '+00:00')),
                    raw_text=metadata['raw_text'],
                    cleaned_text=metadata['cleaned_text'],
                    metadata=doc_metadata
                )

                return document

            return None

        except Exception as e:
            logger.error(f"Error retrieving document {doc_id}: {str(e)}")
            return None

    async def store_invoice(self, invoice_data: ApproveInvoiceRequest) -> Optional[str]:
        """Store an approved invoice in the database"""
        try:
            # Generate unique invoice ID
            invoice_id = f"inv_{datetime.now().year}_{uuid.uuid4().hex[:8]}"

            # Prepare text representation for vector search
            line_items_text = "; ".join([
                f"{item.description}: {item.quantity} x {item.unit_price} = {item.total}"
                for item in invoice_data.line_items
            ])

            invoice_text = f"""
            Vendor: {invoice_data.vendor}
            Invoice Number: {invoice_data.invoice_number}
            Date: {invoice_data.date}
            Line Items: {line_items_text}
            Subtotal: {invoice_data.subtotal}
            Tax: {invoice_data.tax}
            Total: {invoice_data.total}
            """.strip()

            # Prepare metadata
            invoice_metadata = {
                "vendor": invoice_data.vendor,
                "invoice_number": invoice_data.invoice_number,
                "date": invoice_data.date,
                "line_items": [item.dict() for item in invoice_data.line_items],
                "subtotal": float(invoice_data.subtotal),
                "tax": float(invoice_data.tax),
                "total": float(invoice_data.total),
                "status": "approved",
                "source_doc_id": invoice_data.doc_id,
                "created_at": datetime.utcnow().isoformat(),
                "approved_by": invoice_data.approved_by
            }

            # Store in ChromaDB
            success = await self.chroma_client.add_invoice(
                invoice_id=invoice_id,
                text=invoice_text,
                metadata=invoice_metadata
            )

            if success:
                logger.info(f"Invoice {invoice_id} stored successfully")
                return invoice_id
            else:
                logger.error(f"Failed to store invoice {invoice_id}")
                return None

        except Exception as e:
            logger.error(f"Error storing invoice: {str(e)}")
            return None

    async def get_invoice(self, invoice_id: str) -> Optional[InvoiceRecord]:
        """Retrieve an invoice by ID"""
        try:
            result = await self.chroma_client.get_invoice(invoice_id)

            if result:
                metadata = result['metadata']

                # Convert line items
                line_items = []
                for item_data in metadata.get('line_items', []):
                    line_items.append(LineItem(**item_data))

                # Convert metadata
                invoice_metadata = InvoiceMetadata(
                    status=metadata.get('status', 'approved'),
                    source_doc_id=metadata['source_doc_id'],
                    created_at=datetime.fromisoformat(metadata['created_at'].replace('Z', '+00:00')),
                    approved_by=metadata.get('approved_by')
                )

                # Convert to InvoiceRecord
                invoice = InvoiceRecord(
                    id=result['id'],
                    vendor=metadata['vendor'],
                    invoice_number=metadata['invoice_number'],
                    date=metadata['date'],
                    line_items=line_items,
                    subtotal=Decimal(str(metadata['subtotal'])),
                    tax=Decimal(str(metadata['tax'])),
                    total=Decimal(str(metadata['total'])),
                    metadata=invoice_metadata
                )

                return invoice

            return None

        except Exception as e:
            logger.error(f"Error retrieving invoice {invoice_id}: {str(e)}")
            return None

    async def list_invoices(
        self,
        page: int = 1,
        limit: int = 10,
        where: Optional[Dict[str, Any]] = None
    ) -> tuple[List[InvoiceRecord], int]:
        """List invoices with pagination"""
        try:
            offset = (page - 1) * limit

            # Get invoices
            results = await self.chroma_client.list_invoices(
                limit=limit,
                offset=offset,
                where=where
            )

            # Get total count
            total = await self.chroma_client.count_invoices(where=where)

            # Convert to InvoiceRecord objects
            invoices = []
            for result in results:
                metadata = result['metadata']

                # Convert line items
                line_items = []
                for item_data in metadata.get('line_items', []):
                    line_items.append(LineItem(**item_data))

                # Convert metadata
                invoice_metadata = InvoiceMetadata(
                    status=metadata.get('status', 'approved'),
                    source_doc_id=metadata['source_doc_id'],
                    created_at=datetime.fromisoformat(metadata['created_at'].replace('Z', '+00:00')),
                    approved_by=metadata.get('approved_by')
                )

                # Convert to InvoiceRecord
                invoice = InvoiceRecord(
                    id=result['id'],
                    vendor=metadata['vendor'],
                    invoice_number=metadata['invoice_number'],
                    date=metadata['date'],
                    line_items=line_items,
                    subtotal=Decimal(str(metadata['subtotal'])),
                    tax=Decimal(str(metadata['tax'])),
                    total=Decimal(str(metadata['total'])),
                    metadata=invoice_metadata
                )
                invoices.append(invoice)

            return invoices, total

        except Exception as e:
            logger.error(f"Error listing invoices: {str(e)}")
            return [], 0

    async def search_documents(
        self,
        query: str,
        limit: int = 5,
        where: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Search documents using vector similarity"""
        try:
            results = await self.chroma_client.query_documents(
                query_text=query,
                n_results=limit,
                where=where
            )

            return results

        except Exception as e:
            logger.error(f"Error searching documents: {str(e)}")
            return []

    async def search_invoices(
        self,
        query: str,
        limit: int = 5,
        where: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Search invoices using vector similarity"""
        try:
            results = await self.chroma_client.query_invoices(
                query_text=query,
                n_results=limit,
                where=where
            )

            return results

        except Exception as e:
            logger.error(f"Error searching invoices: {str(e)}")
            return []

    async def search_all(
        self,
        query: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Search both documents and invoices, return combined results"""
        try:
            # Search both collections
            doc_results = await self.search_documents(query, limit=limit//2)
            invoice_results = await self.search_invoices(query, limit=limit//2)

            # Combine and sort by relevance (distance)
            all_results = []

            # Add document results
            for result in doc_results:
                result['type'] = 'document'
                all_results.append(result)

            # Add invoice results
            for result in invoice_results:
                result['type'] = 'invoice'
                all_results.append(result)

            # Sort by distance (lower is better)
            all_results.sort(key=lambda x: x.get('distance', 1.0))

            return all_results[:limit]

        except Exception as e:
            logger.error(f"Error searching all collections: {str(e)}")
            return []

    async def export_invoices_data(self) -> List[Dict[str, Any]]:
        """Export all invoice data for CSV/Excel export"""
        try:
            # Get all invoices without pagination
            results = await self.chroma_client.list_invoices()

            export_data = []
            for result in results:
                metadata = result['metadata']

                # Flatten data for export
                export_record = {
                    "invoice_id": result['id'],
                    "vendor": metadata['vendor'],
                    "invoice_number": metadata['invoice_number'],
                    "date": metadata['date'],
                    "subtotal": metadata['subtotal'],
                    "tax": metadata['tax'],
                    "total": metadata['total'],
                    "status": metadata.get('status', 'approved'),
                    "created_at": metadata['created_at'],
                    "approved_by": metadata.get('approved_by', ''),
                    "line_items_count": len(metadata.get('line_items', [])),
                    "line_items_details": "; ".join([
                        f"{item.get('description', '')}: {item.get('quantity', 0)} x {item.get('unit_price', 0)} = {item.get('total', 0)}"
                        for item in metadata.get('line_items', [])
                    ])
                }

                export_data.append(export_record)

            return export_data

        except Exception as e:
            logger.error(f"Error exporting invoice data: {str(e)}")
            return []

    async def health_check(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            is_healthy = await self.chroma_client.health_check()

            return {
                "database": "healthy" if is_healthy else "unhealthy",
                "collections": {
                    "documents": "available" if self.chroma_client.documents_collection else "unavailable",
                    "invoices": "available" if self.chroma_client.invoices_collection else "unavailable"
                }
            }

        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            return {
                "database": "unhealthy",
                "error": str(e)
            }


# Global instance
db_service = DatabaseService()