"use client"

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, MessageSquare, Lightbulb, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { queryApi } from '@/api/query'
import { ragQuery } from '@/api/invoices'
import type { RAGQueryResponse } from '@/types/invoice'

type QueryResponse = RAGQueryResponse

export default function InsightsPage() {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<QueryResponse | null>(null)

  const { data: suggestions } = useQuery({
    queryKey: ['query-suggestions'],
    queryFn: () => queryApi.getSuggestions(),
  })

  const handleSearch = async () => {
    if (!query.trim()) return

    setIsSearching(true)
    try {
      const result = await ragQuery({
        query: query.trim(),
        context_type: 'all',
        limit: 5,
      })
      setSearchResult(result)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <div className="flex flex-col space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground">
          Ask questions about your documents using AI-powered search
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Search Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Query Your Documents
            </CardTitle>
            <CardDescription>
              Ask natural language questions about your invoices and financial data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., What is the total amount spent on office supplies this year?"
                  className="pr-10"
                  disabled={isSearching}
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              <Button
                onClick={handleSearch}
                disabled={!query.trim() || isSearching}
                className="min-w-[100px]"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Searching...
                  </>
                ) : (
                  'Search'
                )}
              </Button>
            </div>

            {/* Query Suggestions */}
            {suggestions && suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Suggested queries:
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="text-xs"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search Results */}
        {searchResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                AI Response
              </CardTitle>
              <CardDescription>
                Confidence: {Math.round(searchResult.confidence * 100)}%
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Answer */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500">
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                  {searchResult.answer}
                </p>
              </div>

              {/* Sources */}
              {searchResult.references && searchResult.references.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Source Documents
                    </span>
                  </div>

                  <div className="grid gap-3">
                    {searchResult.references.map((source, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Document {source.id}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(source.relevance_score * 100)}% match
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          "{source.snippet}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Example Queries */}
        <Card>
          <CardHeader>
            <CardTitle>Example Queries</CardTitle>
            <CardDescription>
              Try these example questions to explore your data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-white">Financial Analysis</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• "What is the total spending this month?"</li>
                  <li>• "Which vendor do we pay the most?"</li>
                  <li>• "Show me all invoices over $1000"</li>
                  <li>• "What's our average invoice amount?"</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-white">Expense Tracking</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• "How much did we spend on office supplies?"</li>
                  <li>• "Find invoices from last quarter"</li>
                  <li>• "What are our recurring monthly expenses?"</li>
                  <li>• "Show me overdue payments"</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}