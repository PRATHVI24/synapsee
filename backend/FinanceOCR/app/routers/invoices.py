from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import logging
import io
import csv
import pandas as pd
from typing import Optional

from app.models.schemas import (
    ApproveInvoiceRequest,
    ApproveInvoiceResponse,
    InvoiceListResponse,
    InvoiceRecord,
    ErrorResponse
)
from app.services.db_service import db_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/invoices", tags=["Invoice Management"])


@router.post(
    "/approve",
    response_model=ApproveInvoiceResponse,
    summary="Approve and store an invoice",
    description="""
    Approve an extracted invoice and store it in the database.

    This endpoint:
    1. Validates the invoice data
    2. Stores the invoice in ChromaDB with vector embeddings
    3. Links it to the source document
    4. Returns the generated invoice ID

    The invoice will be stored with "approved" status and can be
    queried later for analytics and reporting.
    """
)
async def approve_invoice(request: ApproveInvoiceRequest):
    """Approve and store an invoice"""
    try:
        logger.info(f"Approving invoice for document: {request.doc_id}")

        # Verify that the source document exists
        document = await db_service.get_document(request.doc_id)
        if not document:
            raise HTTPException(
                status_code=404,
                detail=f"Source document {request.doc_id} not found"
            )

        # Store the invoice
        invoice_id = await db_service.store_invoice(request)

        if not invoice_id:
            raise HTTPException(
                status_code=500,
                detail="Failed to store invoice in database"
            )

        logger.info(f"Invoice {invoice_id} approved and stored successfully")

        return ApproveInvoiceResponse(
            success=True,
            invoice_id=invoice_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Invoice approval failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Invoice approval failed: {str(e)}"
        )


@router.get(
    "/",
    response_model=InvoiceListResponse,
    summary="List all approved invoices",
    description="""
    Retrieve a paginated list of all approved invoices.

    Supports filtering and pagination:
    - page: Page number (starting from 1)
    - limit: Number of invoices per page (max 100)
    - vendor: Filter by vendor name (case-insensitive partial match)

    Returns invoice metadata along with line items and totals.
    """
)
async def list_invoices(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    vendor: Optional[str] = Query(None, description="Filter by vendor name")
):
    """List all approved invoices with pagination"""
    try:
        logger.info(f"Listing invoices: page={page}, limit={limit}, vendor={vendor}")

        # Prepare where clause for filtering
        where_clause = None
        if vendor:
            where_clause = {"vendor": {"$contains": vendor}}

        # Get invoices from database
        invoices, total = await db_service.list_invoices(
            page=page,
            limit=limit,
            where=where_clause
        )

        logger.info(f"Retrieved {len(invoices)} invoices out of {total} total")

        return InvoiceListResponse(
            invoices=invoices,
            total=total,
            page=page,
            limit=limit
        )

    except Exception as e:
        logger.error(f"Failed to list invoices: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list invoices: {str(e)}"
        )


@router.get(
    "/{invoice_id}",
    response_model=InvoiceRecord,
    summary="Get invoice by ID",
    description="""
    Retrieve a specific invoice by its ID.

    Returns complete invoice details including:
    - Vendor information
    - Invoice number and date
    - All line items
    - Financial totals
    - Metadata (approval info, source document)
    """
)
async def get_invoice(invoice_id: str):
    """Get specific invoice by ID"""
    try:
        logger.info(f"Retrieving invoice: {invoice_id}")

        invoice = await db_service.get_invoice(invoice_id)

        if not invoice:
            raise HTTPException(
                status_code=404,
                detail=f"Invoice {invoice_id} not found"
            )

        logger.info(f"Invoice {invoice_id} retrieved successfully")

        return invoice

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve invoice {invoice_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve invoice: {str(e)}"
        )


@router.get(
    "/export/csv",
    summary="Export invoices as CSV",
    description="""
    Export all approved invoices as a CSV file.

    The CSV includes:
    - Invoice ID, vendor, number, date
    - Financial totals (subtotal, tax, total)
    - Line items summary
    - Approval metadata

    Returns a downloadable CSV file.
    """
)
async def export_invoices_csv():
    """Export all invoices as CSV"""
    try:
        logger.info("Exporting invoices as CSV")

        # Get all invoice data
        invoice_data = await db_service.export_invoices_data()

        if not invoice_data:
            raise HTTPException(
                status_code=404,
                detail="No invoices found to export"
            )

        # Create CSV in memory
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=invoice_data[0].keys())
        writer.writeheader()
        writer.writerows(invoice_data)

        # Prepare response
        csv_content = output.getvalue()
        output.close()

        logger.info(f"Exported {len(invoice_data)} invoices as CSV")

        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(csv_content.encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=invoices_export.csv"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CSV export failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"CSV export failed: {str(e)}"
        )


@router.get(
    "/export/excel",
    summary="Export invoices as Excel",
    description="""
    Export all approved invoices as an Excel file.

    The Excel file includes:
    - Summary sheet with invoice totals
    - Detailed sheet with line items
    - Charts and formatting for better readability

    Returns a downloadable Excel file.
    """
)
async def export_invoices_excel():
    """Export all invoices as Excel"""
    try:
        logger.info("Exporting invoices as Excel")

        # Get all invoice data
        invoice_data = await db_service.export_invoices_data()

        if not invoice_data:
            raise HTTPException(
                status_code=404,
                detail="No invoices found to export"
            )

        # Create Excel file in memory
        output = io.BytesIO()

        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Create DataFrame
            df = pd.DataFrame(invoice_data)

            # Convert numeric columns
            numeric_columns = ['subtotal', 'tax', 'total']
            for col in numeric_columns:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # Convert date columns
            if 'date' in df.columns:
                df['date'] = pd.to_datetime(df['date'], errors='coerce')
            if 'created_at' in df.columns:
                df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')

            # Write main data sheet
            df.to_sheet(writer, sheet_name='Invoices', index=False)

            # Create summary sheet
            summary_data = {
                'Total Invoices': len(df),
                'Total Amount': df['total'].sum() if 'total' in df.columns else 0,
                'Average Amount': df['total'].mean() if 'total' in df.columns else 0,
                'Unique Vendors': df['vendor'].nunique() if 'vendor' in df.columns else 0
            }

            summary_df = pd.DataFrame(list(summary_data.items()), columns=['Metric', 'Value'])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Vendor summary sheet
            if 'vendor' in df.columns and 'total' in df.columns:
                vendor_summary = df.groupby('vendor').agg({
                    'total': ['sum', 'count', 'mean'],
                    'invoice_id': 'count'
                }).round(2)

                vendor_summary.columns = ['Total_Amount', 'Invoice_Count', 'Average_Amount', 'ID_Count']
                vendor_summary = vendor_summary.reset_index()
                vendor_summary.to_excel(writer, sheet_name='Vendor_Summary', index=False)

        output.seek(0)

        logger.info(f"Exported {len(invoice_data)} invoices as Excel")

        # Return as streaming response
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=invoices_export.xlsx"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Excel export failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Excel export failed: {str(e)}"
        )


@router.get(
    "/stats/summary",
    summary="Get invoice statistics summary",
    description="""
    Get summary statistics for all approved invoices.

    Returns:
    - Total count and amount
    - Average invoice value
    - Top vendors by count and amount
    - Monthly trends (if applicable)
    """
)
async def get_invoice_stats():
    """Get invoice statistics summary"""
    try:
        logger.info("Getting invoice statistics")

        # Get all invoice data
        invoice_data = await db_service.export_invoices_data()

        if not invoice_data:
            return {
                "total_count": 0,
                "total_amount": 0.0,
                "average_amount": 0.0,
                "unique_vendors": 0,
                "top_vendors": [],
                "message": "No invoices found"
            }

        # Calculate statistics
        total_count = len(invoice_data)
        total_amount = sum(float(invoice.get('total', 0)) for invoice in invoice_data)
        average_amount = total_amount / total_count if total_count > 0 else 0.0

        # Get unique vendors
        vendors = {}
        for invoice in invoice_data:
            vendor = invoice.get('vendor', 'Unknown')
            amount = float(invoice.get('total', 0))
            if vendor in vendors:
                vendors[vendor]['count'] += 1
                vendors[vendor]['amount'] += amount
            else:
                vendors[vendor] = {'count': 1, 'amount': amount}

        # Sort vendors by amount (top 10)
        top_vendors = sorted(
            [{'vendor': k, 'count': v['count'], 'amount': v['amount']} for k, v in vendors.items()],
            key=lambda x: x['amount'],
            reverse=True
        )[:10]

        stats = {
            "total_count": total_count,
            "total_amount": round(total_amount, 2),
            "average_amount": round(average_amount, 2),
            "unique_vendors": len(vendors),
            "top_vendors": top_vendors
        }

        logger.info(f"Statistics calculated for {total_count} invoices")

        return stats

    except Exception as e:
        logger.error(f"Failed to get invoice statistics: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get statistics: {str(e)}"
        )