"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileUp, Loader2 } from "lucide-react"
import { ocrApi } from "@/api/ocr"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      // Call the real OCR backend
      console.log('Calling OCR API with file:', file.name)
      const ocrResult = await ocrApi.extractText(file)
      console.log('OCR result:', ocrResult)

      // The OCR result contains raw_text, not structured extracted_data
      // For now, create a structured format from the raw text
      const structuredData = {
        doc_id: ocrResult.doc_id,
        raw_text: ocrResult.raw_text,
        cleaned_text: ocrResult.cleaned_text,
        confidence: ocrResult.confidence,
        // Since this is a lab form, not an invoice, show the raw data
        document_type: 'laboratory_order',
        extracted_fields: {
          text_content: ocrResult.cleaned_text
        }
      }

      // Pass the structured data to validation page
      const queryParams = new URLSearchParams({
        data: JSON.stringify(structuredData),
        fileName: file.name,
      })

      router.push(`/validate?${queryParams.toString()}`)

    } catch (error) {
      console.error("Extraction failed", error)
      toast({
        title: "Extraction Failed",
        description: "Could not extract data from the document. Please try again.",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="font-headline">Upload Document</CardTitle>
          <CardDescription>
            Upload an invoice, bill, or receipt (PDF, PNG, JPG).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="document" className="sr-only">
              Document
            </Label>
            <div className="flex items-center justify-center w-full">
                <label htmlFor="document" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-muted-foreground">PDF, PNG, JPG or GIF</p>
                        {file && <p className="mt-4 text-sm font-medium text-foreground">{file.name}</p>}
                    </div>
                    <Input id="document" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg,.gif" />
                </label>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            {loading ? "Processing..." : "Extract Data"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}