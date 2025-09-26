export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
}

export interface Invoice {
  id: string;
  vendor: string;
  invoice_number: string;
  date: string;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  source_doc_id?: string;
  approved_by?: string;
}

export interface OCRResult {
  doc_id: string;
  raw_text: string;
  cleaned_text: string;
  confidence: number;
}

export interface ExtractedInvoiceData {
  vendor?: string;
  invoice_number?: string;
  date?: string;
  line_items: LineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  confidence_scores: Record<string, number>;
}

export interface AIExtractionResponse {
  doc_id: string;
  extracted_data: ExtractedInvoiceData;
  overall_confidence: number;
}

export interface ApproveInvoiceRequest {
  doc_id: string;
  vendor: string;
  invoice_number: string;
  date: string;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  approved_by?: string;
}

export interface ApproveInvoiceResponse {
  success: boolean;
  invoice_id: string;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export interface RAGQueryRequest {
  query: string;
  context_type: 'invoices' | 'documents' | 'all';
  limit?: number;
}

export interface RAGReference {
  id: string;
  type: 'document' | 'invoice';
  relevance_score: number;
  snippet: string;
}

export interface RAGQueryResponse {
  answer: string;
  references: RAGReference[];
  confidence: number;
}

export interface InvoiceStats {
  total_count: number;
  total_amount: number;
  average_amount: number;
  unique_vendors: number;
  top_vendors: Array<{
    vendor: string;
    count: number;
    amount: number;
  }>;
}

export interface UploadFile {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  result?: OCRResult;
}

export interface FormErrors {
  [key: string]: string | undefined;
}