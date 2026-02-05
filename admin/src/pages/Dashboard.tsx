import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchAdminStats, fetchTokenStats, fetchTokensFromSubgraph } from '@/lib/api'
import { formatNumber, truncateAddress } from '@/lib/utils'
import { Tag, Coins, Users, ArrowRightLeft, GitBranch, TrendingUp } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export function Dashboard() {
  const { data: adminStats, isLoading: loadingAdminStats } = useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats,
  })

  const { data: tokenStats, isLoading: loadingTokenStats } = useQuery({
    queryKey: ['tokenStats'],
    queryFn: fetchTokenStats,
  })

  const { data: tokens, isLoading: loadingTokens } = useQuery({
    queryKey: ['tokens'],
    queryFn: fetchTokensFromSubgraph,
  })

  // Get top 5 tokens by holders
  const topTokens = tokens
    ?.sort((a, b) => b.uniqueHolders - a.uniqueHolders)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard Overview</h2>
        <p className="text-gray-500 mt-1">Monitor your platform's key metrics</p>
      </div>

      {/* Promo Code Stats */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Promo Codes</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Codes</CardTitle>
              <Tag className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              {loadingAdminStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{adminStats?.promoCodes.total || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Codes</CardTitle>
              <Tag className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {loadingAdminStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  {adminStats?.promoCodes.active || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Uses</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              {loadingAdminStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatNumber(adminStats?.promoCodes.totalUses || 0)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Token Stats */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Token Analytics</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <Coins className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              {loadingTokenStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{tokenStats?.totalTokens || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Combined Holders</CardTitle>
              <Users className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              {loadingTokenStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatNumber(tokenStats?.combinedHolders || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Combined Transfers</CardTitle>
              <ArrowRightLeft className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              {loadingTokenStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatNumber(tokenStats?.combinedTransfers || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Combined Bridges</CardTitle>
              <GitBranch className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              {loadingTokenStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatNumber(tokenStats?.combinedBridges || 0)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Tokens Table */}
      <Card>
        <CardHeader>
          <CardTitle>Most Successful Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTokens ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead className="text-right">Holders</TableHead>
                  <TableHead className="text-right">Transfers</TableHead>
                  <TableHead className="text-right">Bridges</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topTokens?.map((token, index) => (
                  <TableRow key={token.id}>
                    <TableCell>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-900 text-sm font-medium">
                        {index + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{token.name}</p>
                        <p className="text-sm text-gray-500">{token.symbol}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={token.type === 'ethereum-enabled' ? 'default' : 'secondary'}>
                        {token.type === 'ethereum-enabled' ? 'ETH Enabled' : 'Celo Native'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {truncateAddress(token.owner)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(token.uniqueHolders)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(token.totalTransfers)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(token.totalBridges)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
