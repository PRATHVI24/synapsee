import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Image, Loader2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hl7Api, type OCRProcessResponse } from "@/services/hl7Api";
import { FileUploadZone } from "./FileUploadZone";

export function OCRProcessingTab() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<OCRProcessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (file: File) => {
    // Check if it's an image or PDF
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/bmp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file (JPG, PNG, TIFF) or PDF",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select an image file first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await hl7Api.processOCR(selectedFile);
      setResult(response);

      toast({
        title: "Success",
        description: "Successfully processed image with OCR engines",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);

      toast({
        title: "Processing Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
  };

  // OCR Engine Result Component
  const OCREngineResult = ({ title, text, maxLength = 200 }: { title: string, text: string, maxLength?: number }) => {
    if (!text || text.startsWith('Error:')) {
      return null;
    }

    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-primary">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
            {text.substring(0, maxLength)}{text.length > maxLength ? '...' : ''}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Upload Document Image:
        </label>
        <FileUploadZone
          onFileSelect={handleFileSelect}
          acceptedTypes="image/*,.pdf"
          description="Supports JPG, PNG, TIFF, PDF files"
          icon={<Image className="h-8 w-8" />}
        />
      </div>

      <div className="flex gap-3 justify-center">
        <Button
          onClick={handleProcess}
          disabled={loading || !selectedFile}
          className="flex-1 max-w-[250px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Image className="mr-2 h-4 w-4" />
              Process with Multi Engine OCR
            </>
          )}
        </Button>

        <Button
          onClick={handleReset}
          variant="outline"
          className="flex-1 max-w-[200px]"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>

      {/* Loading Message */}
      {loading && (
        <div className="text-center p-6 text-primary">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Processing with multiple OCR engines... This may take a moment.</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-6">
          {/* OCR Engine Results */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OCREngineResult title="Tesseract OCR" text={result.ocr_results.tesseract} />
            <OCREngineResult title="EasyOCR" text={result.ocr_results.easyocr} />
            <OCREngineResult title="PaddleOCR" text={result.ocr_results.paddleocr} />
          </div>

          {/* Combined OCR Result */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔍 Combined OCR Result
              </CardTitle>
              <CardDescription>
                Best result combining all OCR engines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                {result.ocr_results.combined}
              </div>

              {/* Confidence Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Confidence Level</span>
                  <span>{result.ocr_results.confidence}%</span>
                </div>
                <Progress
                  value={result.ocr_results.confidence}
                  className="h-3"
                />
              </div>
            </CardContent>
          </Card>

          {/* Generated HL7 Message */}
          {result.hl7_message && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🔄 Generated HL7 Message
                </CardTitle>
                <CardDescription>
                  HL7 format generated from OCR extracted data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">
                  {result.hl7_message}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extracted Data (if available) */}
          {result.extracted_data && Object.keys(result.extracted_data).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📋 Extracted Structured Data
                </CardTitle>
                <CardDescription>
                  Structured data extracted from OCR text
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                  <pre>{JSON.stringify(result.extracted_data, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-success">
            <strong>✅ Success:</strong> Successfully processed image with OCR engines!
          </div>
        </div>
      )}
    </div>
  );
}