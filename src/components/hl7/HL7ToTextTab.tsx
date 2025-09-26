import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hl7Api, type HL7TextResult } from "@/services/hl7Api";

// Sample HL7 message matching the original
const SAMPLE_HL7_MESSAGE = `MSH|^~\\&|SENDING APP|SENDING FAC|REC APP|REC FAC|20130101101500||ADT^A01^ADT_A01|0123456789|P|2.5||||AL
EVN||20130101101500||AAA|AAA|20130101082500
PID|1||123-456-789^^^HOSPITAL^MR||SMITH^JOHN^A|||M|||1111 SOMEWHERE STREET^^SOMEWHERE^^^USA||555-555-2004|||M
PV1|1|I|PATIENT WARD|U||||^JONES^MARY^^MD|^SMITH^JACK|CAR||||2|A0|||||||||||||||||||||||||||||2013
DG1|1||I25.10^Coronary Artery Disease^^ICD10||20130101
OBX|1|NM|GLU^Glucose||120|mg/dL|70-110|H|||F|||20130101`;

export function HL7ToTextTab() {
  const [hl7Message, setHL7Message] = useState(SAMPLE_HL7_MESSAGE);
  const [result, setResult] = useState<HL7TextResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleConvert = async () => {
    if (!hl7Message.trim()) {
      toast({
        title: "Error",
        description: "Please enter an HL7 message",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await hl7Api.convertHL7ToText(hl7Message);
      setResult(response);

      toast({
        title: "Success",
        description: "Successfully converted HL7 message to natural language",
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
    setHL7Message(SAMPLE_HL7_MESSAGE);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="hl7-input" className="text-sm font-medium text-foreground">
          Paste HL7 Message:
        </label>
        <Textarea
          id="hl7-input"
          value={hl7Message}
          onChange={(e) => setHL7Message(e.target.value)}
          placeholder="MSH|^~\&|SENDING APP|SENDING FAC|REC APP|REC FAC|20130101101500||ADT^A01^ADT_A01|..."
          className="min-h-[250px] font-mono text-sm"
        />
      </div>

      <div className="flex gap-3 justify-center">
        <Button
          onClick={handleConvert}
          disabled={loading}
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
              Convert to Natural Language
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
                📝 Natural Language Summary
              </CardTitle>
              <CardDescription>
                Human-readable interpretation of the HL7 message
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                {result.summary || 'No summary available'}
              </div>
            </CardContent>
          </Card>

          <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-success">
            <strong>✅ Success:</strong> Successfully converted HL7 message to natural language!
          </div>
        </div>
      )}
    </div>
  );
}