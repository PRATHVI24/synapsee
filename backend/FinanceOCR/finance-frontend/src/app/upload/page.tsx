"use client"

import { UploadForm } from '@/components/upload/upload-form'

export default function UploadPage() {
  return (
    <div className="flex flex-col space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Document</h1>
        <p className="text-muted-foreground">
          Upload an invoice, bill, or receipt (PDF, PNG, JPG).
        </p>
      </div>

      <UploadForm />
    </div>
  )
}