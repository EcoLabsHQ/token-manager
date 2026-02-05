import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchTokensFromSubgraph } from '@/lib/api'
import { formatNumber, formatDate, truncateAddress } from '@/lib/utils'
import { Search, ExternalLink, Users, ArrowRightLeft, GitBranch, ChevronLeft, ChevronRight } from 'lucide-react'

type SortField = 'createdAt' | 'uniqueHolders' | 'totalTransfers' | 'totalBridges'
type SortOrder = 'asc' | 'desc'
type PageSize = 10 | 25

export function Tokens() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(10)

  const { data: tokens, isLoading } = useQuery({
    queryKey: ['tokens'],
    queryFn: fetchTokensFromSubgraph,
  })

  // Filter and sort tokens
  const filteredTokens = tokens
    ?.filter((token) => {
      const matchesSearch =
        token.name.toLowerCase().includes(search.toLowerCase()) ||
        token.symbol.toLowerCase().includes(search.toLowerCase()) ||
        token.tokenAddress.toLowerCase().includes(search.toLowerCase())
      const matchesType = typeFilter === 'all' || token.type === typeFilter
      return matchesSearch && matchesType
    })
    .sort((a, b) => {
      let aVal: number, bVal: number
      switch (sortField) {
        case 'createdAt':
          aVal = parseInt(a.createdAt)
          bVal = parseInt(b.createdAt)
          break
        case 'uniqueHolders':
          aVal = a.uniqueHolders
          bVal = b.uniqueHolders
          break
        case 'totalTransfers':
          aVal = a.totalTransfers
          bVal = b.totalTransfers
          break
        case 'totalBridges':
          aVal = a.totalBridges
          bVal = b.totalBridges
          break
        default:
          return 0
      }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
    })

  // Pagination
  const totalItems = filteredTokens?.length ?? 0
  const totalPages = Math.ceil(totalItems / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTokens = filteredTokens?.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  const handleFilterChange = (newFilter: string) => {
    setTypeFilter(newFilter)
    setCurrentPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (size: string) => {
    setPageSize(Number(size) as PageSize)
    setCurrentPage(1)
  }

  const formatSupply = (supply: string) => {
    const num = BigInt(supply) / BigInt(10 ** 18)
    return formatNumber(Number(num))
  }

  const getExplorerUrl = (token: { type: string; addressL1?: string; addressL2?: string }) => {
    if (token.type === 'ethereum-enabled' && token.addressL1) {
      return `https://sepolia.etherscan.io/token/${token.addressL1}`
    }
    if (token.addressL2) {
      return `https://alfajores.celoscan.io/token/${token.addressL2}`
    }
    return '#'
  }

  const getTokenTypeLabel = (type: string) => {
    return type === 'ethereum-enabled' ? 'ETH Enabled' : 'Celo Native'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tokens</h2>
        <p className="text-gray-500 mt-1">View all tokens created on the platform</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search by name, symbol, or address..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ethereum-enabled">ETH Enabled</SelectItem>
                <SelectItem value="celo-native">Celo Native</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortField}
              onValueChange={(value) => setSortField(value as SortField)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Date Created</SelectItem>
                <SelectItem value="uniqueHolders">Holders</SelectItem>
                <SelectItem value="totalTransfers">Transfers</SelectItem>
                <SelectItem value="totalBridges">Bridges</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            >
              {sortOrder === 'desc' ? '↓ Desc' : '↑ Asc'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tokens Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              All Tokens
              {filteredTokens && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({filteredTokens.length} tokens)
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Show:</span>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredTokens?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No tokens found matching your criteria
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Supply</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Users className="h-4 w-4" />
                      Holders
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ArrowRightLeft className="h-4 w-4" />
                      Transfers
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <GitBranch className="h-4 w-4" />
                      Bridges
                    </div>
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTokens?.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{token.name}</p>
                        <p className="text-sm text-gray-500">{token.symbol}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={token.type === 'ethereum-enabled' ? 'default' : 'secondary'}>
                        {getTokenTypeLabel(token.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {truncateAddress(token.owner)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>Initial: {formatSupply(token.initialSupply)}</p>
                        <p className="text-gray-500">Max: {formatSupply(token.maxSupply)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(parseInt(token.createdAt))}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{formatNumber(token.uniqueHolders)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span>{formatNumber(token.totalTransfers)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span>{formatNumber(token.totalBridges)}</span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <a
                          href={getExplorerUrl(token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View on explorer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} tokens
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      // Show first, last, current, and neighbors
                      return (
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1
                      )
                    })
                    .map((page, idx, arr) => (
                      <span key={page} className="flex items-center">
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span className="px-1 text-gray-400">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      </span>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
