import { Shield } from 'lucide-react';

export default function InternalPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-8 w-8 text-green-500" />
        <h1 className="text-3xl font-bold">Internal Tools</h1>
      </div>

      <p className="text-muted-foreground mb-8">
        This page is protected by Vercel Password Protection. Only authorized users can access it.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Platform Stats</h2>
          <p className="text-sm text-muted-foreground">
            View platform-level statistics and metrics.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Promo Codes</h2>
          <p className="text-sm text-muted-foreground">
            Manage promotional codes for token creation discounts.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Deployments</h2>
          <p className="text-sm text-muted-foreground">
            Monitor contract deployments and factory status.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Configuration</h2>
          <p className="text-sm text-muted-foreground">
            View current chain and contract configuration.
          </p>
        </div>
      </div>
    </div>
  );
}
