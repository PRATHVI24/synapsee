import { useState, useEffect } from "react";
import { Upload, DollarSign, FileText, History, Edit3, CheckCircle, AlertCircle, Loader2, Download, BarChart3, Eye, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { financeApi } from "@/services/financeApi";
import type {
  OCRResult,
  AIExtractionResponse,
  InvoiceRecord,
  InvoiceListResponse,
  InvoiceStats,
  ApproveInvoiceRequest,
} from "@/services/financeApi";

interface ProcessingDocument {
  id: string;
  filename: string;
  uploadedAt: Date;
  ocrResult?: OCRResult;
  aiResult?: AIExtractionResponse;
  status: 'uploading' | 'ocr_processing' | 'ai_processing' | 'ready_for_approval' | 'approved' | 'error';
  error?: string;
}

const FinanceOCR = () => {
  const [processingDocs, setProcessingDocs] = useState<ProcessingDocument[]>([]);
  const [approvedInvoices, setApprovedInvoices] = useState<InvoiceRecord[]>([]);
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    testBackendConnection();
    loadApprovedInvoices();
    loadInvoiceStats();
  }, []);

  const testBackendConnection = async () => {
    try {
      const connected = await financeApi.testConnection();
      setBackendConnected(connected);

      if (!connected) {
        toast({
          title: "Backend Connection Issue",
          description: "Unable to connect to Finance OCR backend. Some features may not work.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setBackendConnected(false);
    }
  };

  const loadApprovedInvoices = async () => {
    try {
      const response = await financeApi.getInvoices(1, 50);
      setApprovedInvoices(response.invoices);
    } catch (error) {
      console.error("Failed to load invoices:", error);
    }
  };

  const loadInvoiceStats = async () => {
    try {
      const stats = await financeApi.getInvoiceStats();
      setInvoiceStats(stats);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const docId = Date.now().toString() + '_' + i;

        // Add document to processing list
        const newDoc: ProcessingDocument = {
          id: docId,
          filename: file.name,
          uploadedAt: new Date(),
          status: 'uploading'
        };

        setProcessingDocs(prev => [newDoc, ...prev]);

        try {
          // Step 1: OCR Processing
          setProcessingDocs(prev =>
            prev.map(doc => doc.id === docId ? { ...doc, status: 'ocr_processing' } : doc)
          );

          const ocrResult = await financeApi.extractText(file);

          setProcessingDocs(prev =>
            prev.map(doc => doc.id === docId ? { ...doc, ocrResult, status: 'ai_processing' } : doc)
          );

          // Step 2: AI Data Extraction
          const aiResult = await financeApi.extractInvoiceData(ocrResult.doc_id);

          setProcessingDocs(prev =>
            prev.map(doc => doc.id === docId ? {
              ...doc,
              aiResult,
              status: 'ready_for_approval'
            } : doc)
          );

          setUploadProgress(((i + 1) / files.length) * 100);

        } catch (error) {
          setProcessingDocs(prev =>
            prev.map(doc => doc.id === docId ? {
              ...doc,
              status: 'error',
              error: error instanceof Error ? error.message : 'Processing failed'
            } : doc)
          );
        }
      }

      toast({
        title: "Processing Complete",
        description: `${files.length} document(s) processed and ready for review`,
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to process documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleApproveInvoice = async (doc: ProcessingDocument) => {
    if (!doc.aiResult?.extracted_data) return;

    try {
      const approveData: ApproveInvoiceRequest = {
        doc_id: doc.ocrResult!.doc_id,
        vendor: doc.aiResult.extracted_data.vendor || 'Unknown Vendor',
        invoice_number: doc.aiResult.extracted_data.invoice_number || 'N/A',
        date: doc.aiResult.extracted_data.date || new Date().toISOString().split('T')[0],
        line_items: doc.aiResult.extracted_data.line_items || [],
        subtotal: doc.aiResult.extracted_data.subtotal || 0,
        tax: doc.aiResult.extracted_data.tax || 0,
        total: doc.aiResult.extracted_data.total || 0,
      };

      const response = await financeApi.approveInvoice(approveData);

      if (response.success) {
        setProcessingDocs(prev =>
          prev.map(d => d.id === doc.id ? { ...d, status: 'approved' } : d)
        );

        // Reload approved invoices and stats
        await loadApprovedInvoices();
        await loadInvoiceStats();

        toast({
          title: "Invoice Approved",
          description: `Invoice ${response.invoice_id} has been approved and stored`,
        });
      }
    } catch (error) {
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve invoice",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await financeApi.exportInvoicesCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoices_export.csv';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Invoices exported as CSV file",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export invoices",
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await financeApi.exportInvoicesExcel();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoices_export.xlsx';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Invoices exported as Excel file",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export invoices",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: ProcessingDocument['status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'ready_for_approval':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'uploading':
      case 'ocr_processing':
      case 'ai_processing':
        return <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: ProcessingDocument['status']) => {
    switch (status) {
      case 'uploading': return 'Uploading...';
      case 'ocr_processing': return 'Extracting Text...';
      case 'ai_processing': return 'AI Processing...';
      case 'ready_for_approval': return 'Ready for Approval';
      case 'approved': return 'Approved';
      case 'error': return 'Error';
      default: return status;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-finance flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            Finance OCR
          </h1>
          <p className="text-muted-foreground mt-2">
            Extract financial data from invoices, receipts, and statements with AI-powered accuracy
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={backendConnected ? "default" : "destructive"}>
            {backendConnected === null ? "Checking..." :
             backendConnected ? "Backend Connected" : "Backend Disconnected"}
          </Badge>
        </div>
      </div>

      {/* Backend Connection Warning */}
      {backendConnected === false && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Backend is not available. Please ensure the Finance OCR server is running on port 8001.
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Section */}
      <Card className="dashboard-card project-finance">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Financial Documents
          </CardTitle>
          <CardDescription>
            Upload invoices, receipts, bank statements, or tax documents for AI-powered data extraction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                className="hidden"
                id="finance-upload"
                disabled={loading || !backendConnected}
              />
              <label
                htmlFor="finance-upload"
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-finance-light flex items-center justify-center">
                  <Upload className="h-8 w-8 text-finance" />
                </div>
                <div>
                  <p className="text-lg font-medium">
                    {loading ? "Processing..." : "Drop financial documents here or click to upload"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports PDF, JPG, PNG files (max 10MB each)
                  </p>
                </div>
              </label>
            </div>

            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing Progress</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="processing" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="processing">Processing Queue</TabsTrigger>
          <TabsTrigger value="invoices">Approved Invoices</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="exports">Export & Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="processing" className="space-y-4">
          {processingDocs.length === 0 ? (
            <Card className="dashboard-card">
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No documents in queue</p>
                <p className="text-sm text-muted-foreground">Upload your first financial document to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {processingDocs.map((doc) => (
                <Card key={doc.id} className="dashboard-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-finance-light flex items-center justify-center">
                          <FileText className="h-5 w-5 text-finance" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{doc.filename}</CardTitle>
                          <CardDescription>
                            Uploaded {doc.uploadedAt.toLocaleDateString()}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={doc.status === 'approved' ? 'default' : doc.status === 'error' ? 'destructive' : 'secondary'}
                               className="flex items-center gap-1">
                          {getStatusIcon(doc.status)}
                          {getStatusText(doc.status)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  {doc.ocrResult && (
                    <CardContent className="space-y-4">
                      <div className="p-3 bg-background border border-border rounded-lg">
                        <h4 className="font-medium mb-2">OCR Results</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Confidence: {Math.round(doc.ocrResult.confidence * 100)}%
                        </p>
                        <div className="max-h-32 overflow-y-auto text-sm bg-muted p-2 rounded">
                          {doc.ocrResult.cleaned_text.substring(0, 500)}
                          {doc.ocrResult.cleaned_text.length > 500 && '...'}
                        </div>
                      </div>

                      {doc.aiResult && (
                        <div className="space-y-4">
                          <div className="p-3 bg-background border border-border rounded-lg">
                            <h4 className="font-medium mb-3">AI Extracted Data</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Vendor</p>
                                <p className="font-medium">{doc.aiResult.extracted_data.vendor || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Invoice #</p>
                                <p className="font-medium">{doc.aiResult.extracted_data.invoice_number || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Date</p>
                                <p className="font-medium">{doc.aiResult.extracted_data.date || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Total</p>
                                <p className="font-medium text-lg">
                                  {doc.aiResult.extracted_data.total ? formatCurrency(doc.aiResult.extracted_data.total) : 'N/A'}
                                </p>
                              </div>
                            </div>

                            {doc.aiResult.extracted_data.line_items.length > 0 && (
                              <div>
                                <h5 className="font-medium mb-2">Line Items</h5>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                  {doc.aiResult.extracted_data.line_items.map((item, index) => (
                                    <div key={index} className="flex justify-between p-2 bg-muted rounded text-sm">
                                      <span>{item.description}</span>
                                      <span>{item.total ? formatCurrency(item.total) : 'N/A'}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <p className="text-sm text-muted-foreground mt-2">
                              AI Confidence: {Math.round(doc.aiResult.overall_confidence * 100)}%
                            </p>
                          </div>

                          <div className="flex gap-2">
                            {doc.status === 'ready_for_approval' && (
                              <Button onClick={() => handleApproveInvoice(doc)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve Invoice
                              </Button>
                            )}
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              Preview Document
                            </Button>
                            {doc.ocrResult && (
                              <Button variant="outline" size="sm"
                                      onClick={() => financeApi.reprocessDocument(doc.ocrResult!.doc_id)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Reprocess
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {doc.error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                          <p className="text-sm text-destructive font-medium">Error: {doc.error}</p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Approved Invoices
                  </CardTitle>
                  <CardDescription>
                    View and manage all approved and stored invoices
                  </CardDescription>
                </div>
                <Button onClick={loadApprovedInvoices} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {approvedInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No approved invoices yet</p>
                  <p className="text-sm text-muted-foreground">Process and approve some documents to see them here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {approvedInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-finance-light flex items-center justify-center">
                          <FileText className="h-5 w-5 text-finance" />
                        </div>
                        <div>
                          <p className="font-medium">{invoice.vendor}</p>
                          <p className="text-sm text-muted-foreground">
                            {invoice.invoice_number} • {invoice.date} • {formatCurrency(invoice.total)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="default">Approved</Badge>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="text-lg">Total Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-finance">{invoiceStats?.total_count || 0}</p>
                <p className="text-sm text-muted-foreground">Invoices approved</p>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="text-lg">Total Value</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-finance">
                  {formatCurrency(invoiceStats?.total_amount || 0)}
                </p>
                <p className="text-sm text-muted-foreground">Across all invoices</p>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="text-lg">Average Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-finance">
                  {formatCurrency(invoiceStats?.average_amount || 0)}
                </p>
                <p className="text-sm text-muted-foreground">Per invoice</p>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="text-lg">Unique Vendors</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-finance">{invoiceStats?.unique_vendors || 0}</p>
                <p className="text-sm text-muted-foreground">Different suppliers</p>
              </CardContent>
            </Card>
          </div>

          {invoiceStats?.top_vendors && invoiceStats.top_vendors.length > 0 && (
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Top Vendors by Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invoiceStats.top_vendors.slice(0, 5).map((vendor, index) => (
                    <div key={vendor.vendor} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-finance-light flex items-center justify-center text-sm font-medium text-finance">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{vendor.vendor}</p>
                          <p className="text-sm text-muted-foreground">{vendor.count} invoices</p>
                        </div>
                      </div>
                      <p className="font-medium">{formatCurrency(vendor.amount)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="exports" className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export & Reports
              </CardTitle>
              <CardDescription>
                Download your invoice data in various formats
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={handleExportCSV} className="h-16 flex-col gap-2">
                  <Download className="h-5 w-5" />
                  Export as CSV
                  <span className="text-xs opacity-75">Comma-separated values</span>
                </Button>
                <Button onClick={handleExportExcel} className="h-16 flex-col gap-2">
                  <Download className="h-5 w-5" />
                  Export as Excel
                  <span className="text-xs opacity-75">With charts and summaries</span>
                </Button>
              </div>

              <div className="text-sm text-muted-foreground mt-4">
                <p>• CSV exports include all invoice data in spreadsheet format</p>
                <p>• Excel exports include summary sheets, vendor analysis, and charts</p>
                <p>• All exports contain approved invoices only</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceOCR;