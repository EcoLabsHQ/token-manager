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
import { Search, ExternalLink, Users, ArrowRightLeft, GitBranch } from 'lucide-react'

type SortField = 'createdAt' | 'uniqueHolders' | 'totalTransfers' | 'totalBridges'
type SortOrder = 'asc' | 'desc'

export function Tokens() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

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
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
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
          <CardTitle>
            All Tokens
            {filteredTokens && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({filteredTokens.length} tokens)
              </span>
            )}
          </CardTitle>
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
                {filteredTokens?.map((token) => (
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
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-medium">{formatNumber(token.uniqueHolders)}</span>
                        <Badge variant="secondary" className="text-xs">Mocked</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span>{formatNumber(token.totalTransfers)}</span>
                        <Badge variant="secondary" className="text-xs">Mocked</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span>{formatNumber(token.totalBridges)}</span>
                        <Badge variant="secondary" className="text-xs">Mocked</Badge>
                      </div>
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
        </CardContent>
      </Card>

      {/* Info Banner */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-gray-100 p-2">
              <Users className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">About Token Metrics</h4>
              <p className="text-sm text-gray-600 mt-1">
                The <strong>Holders</strong>, <strong>Transfers</strong>, and <strong>Bridges</strong> metrics
                are currently mocked as they are not available from the subgraph. To enable real data,
                you would need to extend the subgraph to track Transfer events and maintain holder counts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
