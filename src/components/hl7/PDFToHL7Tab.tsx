import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hl7Api, type PDFToHL7Response } from "@/services/hl7Api";
import { FileUploadZone } from "./FileUploadZone";

export function PDFToHL7Tab() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<PDFToHL7Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid File Type",
        description: "Please select a PDF file",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleConvert = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a PDF file first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await hl7Api.convertPDFToHL7(selectedFile);
      setResult(response);

      toast({
        title: "Success",
        description: "Successfully converted PDF to HL7 format",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);

      toast({
        title: "Conversion Failed",
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Upload PDF Lab Order:
        </label>
        <FileUploadZone
          onFileSelect={handleFileSelect}
          acceptedTypes=".pdf"
          description="Supports PDF files"
          icon={<FileText className="h-8 w-8" />}
        />
      </div>

      <div className="flex gap-3 justify-center">
        <Button
          onClick={handleConvert}
          disabled={loading || !selectedFile}
          className="flex-1 max-w-[200px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Convert PDF to HL7
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

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📋 Extracted Data
              </CardTitle>
              <CardDescription>
                Data extracted from the PDF document
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm max-h-80 overflow-y-auto">
                <pre>{JSON.stringify(result.extracted_data, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔄 Generated HL7 Message
              </CardTitle>
              <CardDescription>
                HL7 format generated from extracted data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">
                {result.hl7_message}
              </div>
            </CardContent>
          </Card>

          <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-success">
            <strong>✅ Success:</strong> Successfully converted PDF to HL7 format!
          </div>
        </div>
      )}
    </div>
  );
}