# Finance Document Extractor - Frontend

A modern React frontend built with Vite for the AI-powered finance document processing system.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd finance-frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Access Application
- Frontend: **http://localhost:5173**
- Make sure Backend is running on: **http://localhost:8000**

## 🛠️ Tech Stack

- **React 18** + **TypeScript** + **Vite**
- **TailwindCSS** + **shadcn/ui** components
- **React Router** for navigation
- **TanStack Query** for state management
- **Axios** for API calls
- **React Dropzone** for file uploads

## 📱 Features

### ✅ Implemented
- **File Upload**: Drag & drop interface with progress tracking
- **Layout**: Responsive header, sidebar, and main content
- **Routing**: Navigation between Upload, Dashboard, Validation, Insights
- **Theme**: Dark/light mode toggle with persistence
- **API Integration**: Axios setup with error handling
- **TypeScript**: Full type safety for all components

### 🚧 Ready for Extension
- **Upload Page**: Complete OCR → AI extraction flow
- **Dashboard**: Invoice listing and statistics (placeholder)
- **Validation**: Invoice editing form (placeholder)
- **Insights**: RAG query interface (placeholder)

## 🔌 API Integration

The frontend is configured to work with your FastAPI backend:

```typescript
// Automatic workflow:
1. Upload file → POST /ocr/extract
2. Extract data → POST /ai/extract
3. Review data → /validate/:docId page
4. Approve → POST /invoices/approve
5. View all → GET /invoices/
```

## 📂 Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── layout/          # Header, Sidebar, Layout
│   └── FileUpload.tsx   # Drag & drop component
├── pages/               # Route components
├── api/                 # Backend integration
├── hooks/               # Custom React hooks
├── types/               # TypeScript definitions
└── lib/                 # Utilities
```

## 🚀 Next Steps

The foundation is complete! To extend the application:

1. **Complete Validation Page**: Add invoice editing form
2. **Build Dashboard**: Add invoice table and stats
3. **Implement Insights**: Add RAG query interface
4. **Add More UI Components**: Tables, forms, charts
5. **Testing**: Add unit and integration tests

## 🔧 Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

**Status**: ✅ **Foundation Complete & Running**
**Next**: Extend with remaining features as needed