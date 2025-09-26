import type { Metadata } from "next"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { QueryProvider } from "@/components/providers/query-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "DocuSage",
  description: "AI-Driven Smart Finance Document Extractor",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <QueryProvider>
          <SidebarProvider>
            <div className="flex min-h-screen">
              <AppSidebar />
              <SidebarInset className="flex-1">
                {children}
              </SidebarInset>
            </div>
          </SidebarProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}