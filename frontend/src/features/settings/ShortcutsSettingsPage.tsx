import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Smartphone,
  ExternalLink,
  Code,
  ShieldAlert,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from './useApiTokens';
import { ApiToken, ApiTokenCreatedResponse } from '../../types/apiTokens';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/useToast';

export const ShortcutsSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: tokens = [], isLoading } = useApiTokens();
  const createMutation = useCreateApiToken();
  const revokeMutation = useRevokeApiToken();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [createdTokenResult, setCreatedTokenResult] = useState<ApiTokenCreatedResponse | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Mode B URL builder states
  const [builderAmount, setBuilderAmount] = useState('250');
  const [builderMerchant, setBuilderMerchant] = useState('Swiggy');
  const [builderCategory, setBuilderCategory] = useState('Food & Dining');

  const generatedDeepLink = `${window.location.origin}/add?amount=${encodeURIComponent(
    builderAmount
  )}&merchant=${encodeURIComponent(builderMerchant)}&category=${encodeURIComponent(builderCategory)}`;

  const handleOpenCreate = () => {
    setTokenName('');
    setCreatedTokenResult(null);
    setCopiedToken(false);
    setIsModalOpen(true);
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenName.trim()) return;

    try {
      const res = await createMutation.mutateAsync({ name: tokenName.trim() });
      setCreatedTokenResult(res);
      showToast('API token generated successfully!', { type: 'success' });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create API token', {
        type: 'error',
      });
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    showToast('Copied to clipboard!', { type: 'success' });
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleRevoke = async (token: ApiToken) => {
    if (!window.confirm(`Revoke API token "${token.name}"? Shortcuts using it will stop working.`)) {
      return;
    }
    try {
      await revokeMutation.mutateAsync(token.id);
      showToast(`Revoked "${token.name}"`, { type: 'info' });
    } catch {
      showToast('Failed to revoke API token', { type: 'error' });
    }
  };

  const curlExample = `curl -X POST "${window.location.origin}/api/v1/shortcuts/transactions" \\
  -H "Authorization: Bearer ${createdTokenResult ? createdTokenResult.token : 'sw_YOUR_API_TOKEN'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "150",
    "category": "Food & Dining",
    "merchant": "Saravana Bhavan",
    "payment_method": "upi",
    "note": "Breakfast"
  }'`;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Back button & Header */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="p-2 rounded-xl bg-surface border border-surface-2 hover:bg-surface-2 transition-colors text-muted hover:text-text"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-text">iOS Shortcuts & Automation</h2>
          <p className="text-xs text-muted font-medium mt-0.5">
            Voice logging, personal API tokens, and deep links
          </p>
        </div>
      </div>

      {/* API Tokens Manager */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
            Personal API Tokens
          </h3>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-dark transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate Token</span>
          </button>
        </div>

        <div className="bg-surface rounded-2xl border border-surface-2 divide-y divide-surface-2 overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-muted">Loading tokens...</div>
          ) : tokens.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted space-y-1">
              <Key className="w-6 h-6 mx-auto text-muted/60 mb-2" />
              <p className="font-bold text-text">No active API tokens</p>
              <p>Create a token to connect headless iOS Shortcuts or Siri automations.</p>
            </div>
          ) : (
            tokens.map((tok) => (
              <div key={tok.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-text truncate">{tok.name}</p>
                    <p className="text-[11px] text-muted font-mono">
                      sw_••••••••{tok.last4} • Created {new Date(tok.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRevoke(tok)}
                  className="p-1.5 text-muted hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                  title="Revoke Token"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mode A: Headless iOS Shortcut Guide */}
      <div className="p-5 rounded-2xl bg-surface border border-surface-2 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Smartphone className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-extrabold text-text">Mode A: Headless Siri Shortcut</h4>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Log expenses by voice with Siri without opening the browser. Use the iOS Shortcuts app &quot;Get Contents of URL&quot; action:
        </p>

        <div className="relative rounded-xl bg-surface-2 p-3 font-mono text-[11px] text-text/90 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleCopy(curlExample)}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-surface hover:bg-surface-2 text-muted hover:text-text transition-colors shadow-xs"
            title="Copy Request"
          >
            {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <pre>{curlExample}</pre>
        </div>
      </div>

      {/* Mode B: URL Scheme / Deep Link Builder */}
      <div className="p-5 rounded-2xl bg-surface border border-surface-2 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-text">Mode B: Deep Link Prefill (Zero Setup)</h4>
            <p className="text-[11px] text-muted">
              Pre-fill `/add` fields directly via URL parameters with 1-tap confirmation.
            </p>
          </div>
        </div>

        {/* Builder Inputs */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <label className="text-[10px] font-bold text-muted block mb-1">Amount (₹)</label>
            <input
              type="text"
              value={builderAmount}
              onChange={(e) => setBuilderAmount(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-surface-2 text-xs font-bold text-text border border-surface-2"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted block mb-1">Merchant</label>
            <input
              type="text"
              value={builderMerchant}
              onChange={(e) => setBuilderMerchant(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-surface-2 text-xs font-medium text-text border border-surface-2"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted block mb-1">Category</label>
            <input
              type="text"
              value={builderCategory}
              onChange={(e) => setBuilderCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-surface-2 text-xs font-medium text-text border border-surface-2"
            />
          </div>
        </div>

        {/* Output Link */}
        <div className="p-3 rounded-xl bg-surface-2 text-[11px] font-mono text-text break-all flex items-center justify-between gap-2">
          <span>{generatedDeepLink}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleCopy(generatedDeepLink)}
              className="p-1.5 rounded-lg bg-surface hover:bg-surface-2 text-muted hover:text-text transition-colors shadow-xs"
              title="Copy Deep Link"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a
              href={generatedDeepLink}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-surface hover:bg-surface-2 text-muted hover:text-primary transition-colors shadow-xs"
              title="Test Deep Link"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Create Token Modal */}
      <Sheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Generate Personal API Token"
        description="For iOS Shortcuts and Siri voice logging"
      >
        <div className="p-5 space-y-4">
          {!createdTokenResult ? (
            <form onSubmit={handleCreateToken} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted">Device / Shortcut Name *</label>
                <input
                  type="text"
                  required
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g. iPhone 17 Shortcut, Siri Quick Add"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 text-sm text-text border border-surface-2 focus:outline-none focus:border-primary font-medium"
                />
              </div>

              <div className="p-3 rounded-xl bg-surface-2 text-xs text-muted flex items-start gap-2">
                <Code className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  This token will be restricted strictly to <span className="font-bold text-text">transactions:create</span>.
                </span>
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full py-3 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary-dark transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Generate Token</span>
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Copy Your Secret Token Now</span>
                </div>
                <p className="text-muted leading-relaxed">
                  SpendWise stores tokens as SHA-256 hashes. For your security, this plaintext token will <span className="font-bold text-text">never be shown again</span>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 font-mono text-xs text-text break-all border border-surface-2 flex items-center justify-between gap-2">
                <span>{createdTokenResult.token}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(createdTokenResult.token)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white font-bold text-xs flex items-center gap-1 flex-shrink-0 shadow-xs"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-surface-2 text-text hover:bg-surface-2/80 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
};

