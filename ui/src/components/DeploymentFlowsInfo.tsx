import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, Zap, Building2, CheckCircle2 } from 'lucide-react';
import { InstitutionalTokenDialog } from '@/components/InstitutionalTokenDialog';
import { HighVelocityTokenDialog } from '@/components/HighVelocityTokenDialog';

interface FlowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  details: string[];
}

const DEPLOYMENT_FLOWS: Record<string, FlowStep[]> = {
  highVelocity: [
    {
      id: 'prepare',
      title: 'Prepare Token Details',
      description: 'Fill in your token information',
      icon: <Zap className="h-5 w-5" />,
      details: ['Token name', 'Symbol', 'Decimals', 'Max supply'],
    },
    {
      id: 'deploy',
      title: 'Deploy on Celo Sepolia',
      description: 'Deploy SuperchainToken on L2',
      icon: <Building2 className="h-5 w-5" />,
      details: ['Switch to Celo Sepolia', 'Confirm transaction', 'Wait for confirmation'],
    },
    {
      id: 'complete',
      title: 'Ready to Use',
      description: 'Token is deployed and available',
      icon: <CheckCircle2 className="h-5 w-5" />,
      details: ['L2 token deployed', 'Ready for transfers', 'No bridge needed'],
    },
  ],
  institutional: [
    {
      id: 'prepare',
      title: 'Prepare Token Details',
      description: 'Fill in comprehensive token information',
      icon: <Zap className="h-5 w-5" />,
      details: [
        'Token name',
        'Symbol',
        'Decimals',
        'Initial supply (L1)',
        'Max supply',
        'Optional bridge address',
      ],
    },
    {
      id: 'deployL1',
      title: 'Deploy L1 Token',
      description: 'Create token on Sepolia',
      icon: <Building2 className="h-5 w-5" />,
      details: [
        'Switch to Sepolia network',
        'Deploy L1Token contract',
        'Wait for confirmation',
      ],
    },
    {
      id: 'deployL2',
      title: 'Deploy L2 Token',
      description: 'Create SuperchainToken on Celo Sepolia',
      icon: <Building2 className="h-5 w-5" />,
      details: [
        'Switch to Celo Sepolia',
        'Deploy L2SuperchainToken contract',
        'Wait for confirmation',
      ],
    },
    {
      id: 'configure',
      title: 'Configure Bridge',
      description: 'Set up cross-chain connections',
      icon: <ArrowRight className="h-5 w-5" />,
      details: [
        'Set L2 remote token to L1 address',
        'Set L1 remote token to L2 address',
        'Optional: Configure bridge addresses',
      ],
    },
    {
      id: 'complete',
      title: 'Ready for Bridging',
      description: 'Full cross-chain support enabled',
      icon: <CheckCircle2 className="h-5 w-5" />,
      details: [
        'Both tokens deployed',
        'Bridge configured',
        'Ready for cross-chain transfers',
      ],
    },
  ],
};

interface DeploymentFlowProps {
  type: 'highVelocity' | 'institutional';
}

export const DeploymentFlow = ({ type }: DeploymentFlowProps) => {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const steps = DEPLOYMENT_FLOWS[type];

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <Card
          key={step.id}
          className="border border-slate-700/50 shadow-md bg-slate-800/30 overflow-hidden hover:border-slate-600/50 transition-all cursor-pointer"
          onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-700/50 border border-slate-600/50">
                  <span className="text-xs font-bold text-slate-300">{index + 1}</span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{step.description}</p>
                  </div>
                  <div className="flex-shrink-0 text-slate-400">
                    {step.icon}
                  </div>
                </div>

                {expandedStep === step.id && (
                  <div className="mt-4 pt-4 border-t border-slate-700/30">
                    <ul className="space-y-2">
                      {step.details.map((detail, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                          <span className="text-emerald-400 font-bold mt-0.5">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Información general de los flujos
export const DeploymentFlowsInfo = () => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-bold text-white">Understanding Token Deployment Flows</h3>

        <div className="space-y-6">
          {/* High Velocity */}
          <div className="border-l-4 border-blue-500 pl-4">
            <div className="flex items-start gap-2 mb-2">
              <Zap className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-white">High Velocity Token</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Fast, single-chain deployment on Celo Sepolia L2. Perfect for tokens that don't require L1 presence.
                </p>
              </div>
            </div>
            <div className="ml-7 flex gap-2">
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">Fast</span>
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">L2-Only</span>
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">Simple</span>
            </div>
          </div>

          {/* Institutional */}
          <div className="border-l-4 border-emerald-500 pl-4">
            <div className="flex items-start gap-2 mb-2">
              <Building2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-white">Institutional Token</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Comprehensive dual-chain deployment with automatic bridge configuration. Full cross-chain capabilities.
                </p>
              </div>
            </div>
            <div className="ml-7 flex gap-2 flex-wrap">
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">Dual-Chain</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">Bridge-Ready</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">Professional</span>
            </div>
          </div>
        </div>
      </div>

      {/* Choose Your Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* High Velocity Card */}
        <Card className="border border-blue-700/50 bg-slate-800/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-400" />
              Quick Start
            </CardTitle>
            <CardDescription className="text-xs text-blue-300/70">High Velocity Token</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-slate-300 space-y-2">
              <p>✓ Deploy in ~2-3 minutes</p>
              <p>✓ Single transaction</p>
              <p>✓ L2 only (no L1 dependency)</p>
              <p>✓ No bridge setup needed</p>
            </div>
            <HighVelocityTokenDialog />
          </CardContent>
        </Card>

        {/* Institutional Card */}
        <Card className="border border-emerald-700/50 bg-slate-800/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-400" />
              Professional
            </CardTitle>
            <CardDescription className="text-xs text-emerald-300/70">Institutional Token</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-slate-300 space-y-2">
              <p>✓ Deploy in ~5-8 minutes</p>
              <p>✓ Multiple transactions</p>
              <p>✓ L1 + L2 deployment</p>
              <p>✓ Bridge auto-configured</p>
            </div>
            <InstitutionalTokenDialog />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
