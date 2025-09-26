import { useState, useEffect } from "react";
import { Activity, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { hl7Api } from "@/services/hl7Api";

// Import tab components
import { HL7ToTextTab } from "@/components/hl7/HL7ToTextTab";
import { PDFToHL7Tab } from "@/components/hl7/PDFToHL7Tab";
import { OCRProcessingTab } from "@/components/hl7/OCRProcessingTab";

const HL7Page = () => {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const { toast } = useToast();

  // Test backend connectivity on component mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        const isConnected = await hl7Api.testConnection();
        setConnectionStatus(isConnected ? 'connected' : 'disconnected');

        if (!isConnected) {
          toast({
            title: "Backend Connection Issue",
            description: "Unable to connect to HL7 processing backend. Some features may not work.",
            variant: "destructive",
          });
        }
      } catch (error) {
        setConnectionStatus('disconnected');
        toast({
          title: "Backend Connection Error",
          description: "Failed to test backend connection. Please check if the backend is running.",
          variant: "destructive",
        });
      }
    };

    testConnection();
  }, [toast]);

  const ConnectionStatusBadge = () => {
    if (connectionStatus === 'checking') {
      return <Badge variant="outline">Checking...</Badge>;
    }

    if (connectionStatus === 'connected') {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Backend Connected
        </Badge>
      );
    }

    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        Backend Disconnected
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-medical flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            HL7 Document Processor
          </h1>
          <p className="text-muted-foreground mt-2">
            Convert HL7 messages, PDF lab orders, and process documents with multi-engine OCR
          </p>
        </div>

        <ConnectionStatusBadge />
      </div>

      {/* Backend Connection Warning */}
      {connectionStatus === 'disconnected' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Backend is not available. Please ensure the HL7 processing server is running on the configured URL.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Card className="dashboard-card project-medical">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🏥 HL7 Processing Tools
          </CardTitle>
          <CardDescription>
            Choose from HL7 message parsing, PDF conversion, or OCR processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="hl7" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="hl7" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                HL7 to Text
              </TabsTrigger>
              <TabsTrigger value="pdf" className="flex items-center gap-2">
                📄 PDF to HL7
              </TabsTrigger>
              <TabsTrigger value="ocr" className="flex items-center gap-2">
                🖼️ OCR Processing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hl7" className="space-y-4">
              <HL7ToTextTab />
            </TabsContent>

            <TabsContent value="pdf" className="space-y-4">
              <PDFToHL7Tab />
            </TabsContent>

            <TabsContent value="ocr" className="space-y-4">
              <OCRProcessingTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default HL7Page;