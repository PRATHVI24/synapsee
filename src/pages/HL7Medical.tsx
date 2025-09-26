import { useState, useEffect } from "react";
import { Upload, FileText, Activity, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { hl7Api } from "@/services/api";
import { HL7Document, ProcessingStatus } from "@/types";

const HL7Medical = () => {
  const [documents, setDocuments] = useState<HL7Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await hl7Api.getDocuments();
      if (response.success) {
        setDocuments(response.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
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
        const response = await hl7Api.uploadDocument(file);
        
        if (response.success) {
          setDocuments(prev => [response.data, ...prev]);
          setUploadProgress(((i + 1) / files.length) * 100);
        }
      }
      
      toast({
        title: "Upload Successful",
        description: `${files.length} file(s) uploaded successfully`,
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const getStatusIcon = (status: ProcessingStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-warning animate-spin" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: ProcessingStatus) => {
    const variants = {
      completed: "default",
      processing: "secondary", 
      pending: "outline",
      error: "destructive"
    } as const;

    return (
      <Badge variant={variants[status]} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
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
            HL7 Medical Document Processor
          </h1>
          <p className="text-muted-foreground mt-2">
            Process HL7 messages and medical documents with multi-engine OCR analysis
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <Card className="dashboard-card project-medical">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </CardTitle>
          <CardDescription>
            Upload HL7 files, medical images, or documents for processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input
                type="file"
                multiple
                accept=".hl7,.jpg,.jpeg,.png,.pdf,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={loading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-medical-light flex items-center justify-center">
                  <Upload className="h-8 w-8 text-medical" />
                </div>
                <div>
                  <p className="text-lg font-medium">
                    {loading ? "Uploading..." : "Drop files here or click to upload"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports HL7, JPG, PNG, PDF, TXT files
                  </p>
                </div>
              </label>
            </div>

            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Upload Progress</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Processing Dashboard
          </CardTitle>
          <CardDescription>
            Monitor document processing status and view results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All Documents</TabsTrigger>
              <TabsTrigger value="hl7">HL7 Files</TabsTrigger>
              <TabsTrigger value="medical_image">Medical Images</TabsTrigger>
              <TabsTrigger value="document">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No documents uploaded yet</p>
                  <p className="text-sm text-muted-foreground">Upload your first HL7 or medical document to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-medical-light flex items-center justify-center">
                          <FileText className="h-5 w-5 text-medical" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.filename}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.type.replace('_', ' ')} • {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getStatusBadge(doc.status)}
                        
                        {doc.status === 'completed' && (
                          <Button variant="outline" size="sm">
                            View Results
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Other tab contents would be filtered versions of the same list */}
            <TabsContent value="hl7">
              <div className="space-y-3">
                {documents.filter(doc => doc.type === 'hl7').map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-medical-light flex items-center justify-center">
                        <Activity className="h-5 w-5 text-medical" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.filename}</p>
                        <p className="text-sm text-muted-foreground">
                          HL7 Message • {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                        {doc.hl7Data && (
                          <p className="text-xs text-medical">
                            {doc.hl7Data.messageType} • Patient: {doc.hl7Data.patientInfo.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(doc.status)}
                      {doc.status === 'completed' && (
                        <Button variant="outline" size="sm">
                          View HL7 Data
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="medical_image">
              <div className="space-y-3">
                {documents.filter(doc => doc.type === 'medical_image').map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-medical-light flex items-center justify-center">
                        <FileText className="h-5 w-5 text-medical" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.filename}</p>
                        <p className="text-sm text-muted-foreground">
                          Medical Image • {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                        {doc.ocrResults && doc.ocrResults.length > 0 && (
                          <p className="text-xs text-medical">
                            OCR: {doc.ocrResults[0].confidence * 100}% confidence
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(doc.status)}
                      {doc.status === 'completed' && (
                        <Button variant="outline" size="sm">
                          View OCR Results
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="document">
              <div className="space-y-3">
                {documents.filter(doc => doc.type === 'document').map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-medical-light flex items-center justify-center">
                        <FileText className="h-5 w-5 text-medical" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.filename}</p>
                        <p className="text-sm text-muted-foreground">
                          Document • {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(doc.status)}
                      {doc.status === 'completed' && (
                        <Button variant="outline" size="sm">
                          View Results
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default HL7Medical;
