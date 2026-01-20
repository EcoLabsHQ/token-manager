import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HighVelocityTokenDialog } from '@/components/HighVelocityTokenDialog';
import { InstitutionalTokenDialog } from '@/components/InstitutionalTokenDialog';
import { ConvertToInstitutionalDialog } from '@/components/ConvertToInstitutionalDialog';
import { Zap, Building2, ArrowUpRight } from 'lucide-react';

export const DeploymentPanel = () => {
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* High Velocity Token Card */}
        <Card className="border border-blue-700/50 shadow-xl bg-linear-to-br from-slate-900/80 to-slate-800/80 overflow-hidden backdrop-blur-sm hover:border-blue-600/70 transition-all duration-300">
          <CardHeader className="pb-4 border-b border-blue-700/30">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Zap className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-white text-lg font-bold">High Velocity Token</CardTitle>
                  <CardDescription className="text-blue-300/70 text-xs mt-1">Fast L2-only deployment</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold mt-0.5">•</span>
                <span>Deploys on Celo Sepolia L2 only</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold mt-0.5">•</span>
                <span>No bridge configuration required</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold mt-0.5">•</span>
                <span>Perfect for chains specific tokens</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold mt-0.5">•</span>
                <span>Instant availability on L2</span>
              </div>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3">
              <p className="text-xs text-slate-400 font-semibold mb-2">Deployment steps:</p>
              <ol className="text-xs text-slate-400 space-y-1">
                <li>1. Fill in token details (name, symbol, decimals, max supply)</li>
                <li>2. Switch to Celo Sepolia network (if needed)</li>
                <li>3. Confirm transaction and wait for deployment</li>
              </ol>
            </div>

            <HighVelocityTokenDialog />
          </CardContent>
        </Card>

        {/* Institutional Token Card */}
        <Card className="border border-emerald-700/50 shadow-xl bg-linear-to-br from-slate-900/80 to-slate-800/80 overflow-hidden backdrop-blur-sm hover:border-emerald-600/70 transition-all duration-300">
          <CardHeader className="pb-4 border-b border-emerald-700/30">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Building2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-white text-lg font-bold">Institutional Token</CardTitle>
                  <CardDescription className="text-emerald-300/70 text-xs mt-1">Dual-chain with bridge</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span>Deploys on both L1 (Sepolia) and L2 (Celo Sepolia)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span>Automatic bridge configuration</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span>Enable cross-chain transfers</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span>Full bridging support included</span>
              </div>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3">
              <p className="text-xs text-slate-400 font-semibold mb-2">Deployment steps:</p>
              <ol className="text-xs text-slate-400 space-y-1">
                <li>1. Fill in token details and optional bridge address</li>
                <li>2. Deploy L1 token on Sepolia (auto-switch)</li>
                <li>3. Deploy L2 SuperchainToken on Celo Sepolia</li>
                <li>4. Configure bridge connections automatically</li>
              </ol>
            </div>

            <InstitutionalTokenDialog />
          </CardContent>
        </Card>
      </div>

      {/* Comparison Box */}
      <Card className="border border-slate-700/50 shadow-xl bg-linear-to-br from-slate-900/50 to-slate-800/50 overflow-hidden backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm font-bold flex items-center gap-2">
            <span>Quick Comparison</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* High Velocity */}
            <div className="space-y-2 border-r border-slate-700/50 pr-4">
              <p className="font-semibold text-blue-400">High Velocity Token</p>
              <div className="space-y-1 text-slate-300">
                <p><span className="text-slate-500">Deployment:</span> L2 only</p>
                <p><span className="text-slate-500">Time:</span> ~2-3 minutes</p>
                <p><span className="text-slate-500">Transactions:</span> 1</p>
                <p><span className="text-slate-500">Bridge:</span> Not included</p>
              </div>
            </div>

            {/* Institutional */}
            <div className="space-y-2 border-r border-slate-700/50 pr-4">
              <p className="font-semibold text-emerald-400">Institutional Token</p>
              <div className="space-y-1 text-slate-300">
                <p><span className="text-slate-500">Deployment:</span> L1 + L2</p>
                <p><span className="text-slate-500">Time:</span> ~5-8 minutes</p>
                <p><span className="text-slate-500">Transactions:</span> 4-5</p>
                <p><span className="text-slate-500">Bridge:</span> Automatic</p>
              </div>
            </div>

            {/* Conversion */}
            <div className="space-y-2">
              <p className="font-semibold text-amber-400">Convert HV → Institutional</p>
              <div className="space-y-1 text-slate-300">
                <p><span className="text-slate-500">Requirement:</span> Existing L2 token</p>
                <p><span className="text-slate-500">Time:</span> ~3-5 minutes</p>
                <p><span className="text-slate-500">Transactions:</span> 2</p>
                <p><span className="text-slate-500">Result:</span> Adds L1 + Bridge</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Convert Token Section */}
      <Card className="border border-amber-700/50 shadow-xl bg-linear-to-br from-slate-900/80 to-slate-800/80 overflow-hidden backdrop-blur-sm hover:border-amber-600/70 transition-all duration-300">
        <CardHeader className="pb-4 border-b border-amber-700/30">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <ArrowUpRight className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-white text-lg font-bold">Convert to Institutional</CardTitle>
                <CardDescription className="text-amber-300/70 text-xs mt-1">Upgrade an existing L2 token</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold mt-0.5">•</span>
              <span>Select an existing High Velocity token (L2 only)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold mt-0.5">•</span>
              <span>Deploys corresponding L1 token on Sepolia</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold mt-0.5">•</span>
              <span>Configures bridge between L1 and L2</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold mt-0.5">•</span>
              <span>Enables full cross-chain transfers</span>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3">
            <p className="text-xs text-slate-400 font-semibold mb-2">Conversion steps:</p>
            <ol className="text-xs text-slate-400 space-y-1">
              <li>1. Select an L2 token without bridge configuration</li>
              <li>2. Deploy L1 token on Sepolia (auto-switch)</li>
              <li>3. Configure bridge on existing L2 token</li>
            </ol>
          </div>

          <Button
            onClick={() => setConvertDialogOpen(true)}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold shadow-lg"
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Convert Token
          </Button>

          <ConvertToInstitutionalDialog
            open={convertDialogOpen}
            onOpenChange={setConvertDialogOpen}
            onSuccess={(l1, l2) => {
              console.log('Token converted:', { l1, l2 });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};
