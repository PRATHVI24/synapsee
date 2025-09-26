"use client"

import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ValidationForm } from '@/components/validation/validation-form'

export default function ValidatePage() {
  const searchParams = useSearchParams()
  const extractedDataParam = searchParams.get('data')
  const fileName = searchParams.get('fileName')

  let extractedData = null
  if (extractedDataParam) {
    try {
      extractedData = JSON.parse(decodeURIComponent(extractedDataParam))
    } catch (error) {
      console.error('Failed to parse extracted data:', error)
    }
  }

  return (
    <div className="flex flex-col space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Validate Document</h1>
        <p className="text-muted-foreground">
          Review and validate the extracted information from your document.
        </p>
      </div>

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify({ fileName, extractedData }, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Document Preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Preview</CardTitle>
              <CardDescription>
                {fileName ? `Original file: ${fileName}` : 'Uploaded document preview'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Image preview placeholder for: {fileName}
                </p>
                <p className="text-xs mt-2">
                  (File uploaded to backend successfully)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Extracted Text */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Extracted Text</CardTitle>
              <CardDescription>
                Raw text extracted from the document via OCR
              </CardDescription>
            </CardHeader>
            <CardContent>
              {extractedData ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">Document Type:</h3>
                    <p className="text-sm text-gray-600">{extractedData.document_type || 'Unknown'}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Confidence:</h3>
                    <p className="text-sm text-gray-600">{extractedData.confidence || 0}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Extracted Text:</h3>
                    <div className="text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {extractedData.cleaned_text || extractedData.raw_text || 'No text extracted'}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No extracted data available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}