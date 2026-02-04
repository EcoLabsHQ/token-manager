import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  fetchPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  fetchCreationFee,
  type CreatePromoCodeData,
  type PromoCode,
} from '@/lib/api'
import { formatDateTime, isExpired, formatNumber } from '@/lib/utils'
import { Plus, Trash2, Power, PowerOff } from 'lucide-react'

export function PromoCodes() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newCode, setNewCode] = useState({
    code: '',
    discountType: 'free' as 'free' | 'percentage',
    discountValue: 50,
    expiresInDays: 30,
    maxUses: 100,
  })

  const { data: promoCodes, isLoading } = useQuery({
    queryKey: ['promoCodes'],
    queryFn: fetchPromoCodes,
  })

  // Fetch the actual creation fee from the contract
  const { data: creationFeeWei } = useQuery({
    queryKey: ['creationFee'],
    queryFn: () => fetchCreationFee('ethereum'),
    staleTime: 60 * 1000, // Cache for 1 minute
  })

  const createMutation = useMutation({
    mutationFn: createPromoCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promoCodes'] })
      queryClient.invalidateQueries({ queryKey: ['adminStats'] })
      setIsCreateOpen(false)
      setNewCode({
        code: '',
        discountType: 'free',
        discountValue: 50,
        expiresInDays: 30,
        maxUses: 100,
      })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updatePromoCode(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promoCodes'] })
      queryClient.invalidateQueries({ queryKey: ['adminStats'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePromoCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promoCodes'] })
      queryClient.invalidateQueries({ queryKey: ['adminStats'] })
    },
  })

  const handleCreate = () => {
    const expiresAt = Math.floor(Date.now() / 1000) + newCode.expiresInDays * 24 * 60 * 60
    const data: CreatePromoCodeData = {
      code: newCode.code,
      discountType: newCode.discountType,
      discountValue: newCode.discountType === 'percentage' ? newCode.discountValue : undefined,
      expiresAt,
      maxUses: newCode.maxUses,
    }
    createMutation.mutate(data)
  }

  const getDiscountDisplay = (code: PromoCode) => {
    // If discount_fee is 0, it's a free promo
    if (code.discount_fee === '0') {
      return <Badge variant="success">FREE</Badge>
    }
    
    // Use the actual creation fee from the contract, fallback to default
    const baseFeeWei = BigInt(creationFeeWei || '10000000000000000') // Default 0.01 ETH
    const discountFeeWei = BigInt(code.discount_fee)
    
    // If the promo fee is less than the base fee, calculate discount percentage
    if (discountFeeWei < baseFeeWei) {
      const discountAmount = baseFeeWei - discountFeeWei
      const percentOff = Number((discountAmount * BigInt(100)) / baseFeeWei)
      return <Badge variant="default">{percentOff}% OFF</Badge>
    }
    
    // If no discount or promo fee equals base fee
    const ethValue = Number(discountFeeWei) / 1e18
    return <Badge variant="secondary">{ethValue.toFixed(4)} ETH</Badge>
  }

  const getStatusBadge = (code: PromoCode) => {
    if (!code.is_active) {
      return <Badge variant="secondary">Disabled</Badge>
    }
    if (isExpired(code.expires_at)) {
      return <Badge variant="destructive">Expired</Badge>
    }
    if (code.current_uses >= code.max_uses) {
      return <Badge variant="warning">Limit Reached</Badge>
    }
    return <Badge variant="success">Active</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Promo Codes</h2>
          <p className="text-gray-500 mt-1">Manage discount codes for token minting</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Promo Code</DialogTitle>
              <DialogDescription>
                Create a new discount code for token minting
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  placeholder="e.g., FREEMINT2026"
                  value={newCode.code}
                  onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="discountType">Discount Type</Label>
                <Select
                  value={newCode.discountType}
                  onValueChange={(value: 'free' | 'percentage') =>
                    setNewCode({ ...newCode, discountType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">100% Free (No fee)</SelectItem>
                    <SelectItem value="percentage">Percentage Discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newCode.discountType === 'percentage' && (
                <div className="grid gap-2">
                  <Label htmlFor="discountValue">Discount Percentage</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="discountValue"
                      type="number"
                      min="1"
                      max="99"
                      value={newCode.discountValue}
                      onChange={(e) =>
                        setNewCode({ ...newCode, discountValue: parseInt(e.target.value) || 0 })
                      }
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="expires">Expires In (days)</Label>
                <Input
                  id="expires"
                  type="number"
                  min="1"
                  value={newCode.expiresInDays}
                  onChange={(e) =>
                    setNewCode({ ...newCode, expiresInDays: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxUses">Maximum Uses</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="1"
                  value={newCode.maxUses}
                  onChange={(e) =>
                    setNewCode({ ...newCode, maxUses: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newCode.code || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Code'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Promo Codes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : promoCodes?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No promo codes yet. Create your first one!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes?.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-medium">{code.code}</TableCell>
                    <TableCell>{getDiscountDisplay(code)}</TableCell>
                    <TableCell>{getStatusBadge(code)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{formatNumber(code.current_uses)}</span>
                      <span className="text-gray-500"> / {formatNumber(code.max_uses)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {code.created_at ? new Date(code.created_at).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className={isExpired(code.expires_at) ? 'text-destructive' : ''}>
                        {formatDateTime(code.expires_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            toggleMutation.mutate({ id: code.id, is_active: !code.is_active })
                          }
                          title={code.is_active ? 'Disable' : 'Enable'}
                        >
                          {code.is_active ? (
                            <PowerOff className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Power className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this code?')) {
                              deleteMutation.mutate(code.id)
                            }
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
