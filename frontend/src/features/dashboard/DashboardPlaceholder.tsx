import React, { useEffect, useState } from 'react';
import { ShieldCheck, Smartphone, Zap, Server } from 'lucide-react';
import type { HealthStatus } from '../../types';

export const DashboardPlaceholder: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
        const res = await fetch(`${apiUrl}/health`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setHealth(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Backend unreachable');
      } finally {
        setLoading(false);
      }
    };

    checkBackend();
  }, []);

  return (
    <div className="space-y-4">
      {/* Hero Welcome Card */}
      <section className="bg-surface rounded-2xl p-5 border border-surface-2 shadow-sm">
        <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-3">
          Milestone M0: Scaffolding Complete
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text">
          Spend less time recording expenses, more time understanding your money.
        </h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          SpendWise is built for high-velocity personal expense tracking (target: 5–10s entry, ≤ 3 taps) with integer-paise accuracy and offline durability.
        </p>
        <div className="flex items-center gap-2 mt-4">
          <a
            href="/add"
            className="flex-1 text-center py-2.5 px-3 rounded-xl bg-primary text-white font-bold text-xs shadow-xs hover:bg-primary-dark transition-colors"
          >
            + Quick Add Expense
          </a>
          <a
            href="/transactions"
            className="flex-1 text-center py-2.5 px-3 rounded-xl bg-surface-2 text-text font-bold text-xs hover:bg-surface-2/80 transition-colors"
          >
            View History
          </a>
        </div>
      </section>

      {/* Backend API Connectivity Card */}
      <section className="bg-surface rounded-2xl p-4 border border-surface-2 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-text">Backend API Health Status</h3>
          </div>
          {loading && (
            <span className="text-xs text-muted">Checking...</span>
          )}
          {!loading && health && (
            <span className="text-xs font-semibold text-success flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success inline-block"></span>
              Connected (v{health.version})
            </span>
          )}
          {!loading && error && (
            <span className="text-xs font-semibold text-warning flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning inline-block"></span>
              Local Only ({error})
            </span>
          )}
        </div>

        <div className="text-xs text-muted bg-surface-2/60 rounded-xl p-3 font-mono">
          <div>Target API: <span className="text-text">{import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}</span></div>
          {health && (
            <div className="mt-1">
              Status: <span className="text-success font-semibold">{health.status}</span> · DB: <span className="text-text font-semibold">{health.db}</span> · Env: <span className="text-text">{health.environment}</span>
            </div>
          )}
          {error && (
            <div className="mt-1 text-warning">
              Notice: Backend container not running yet. Run <code className="text-text font-bold">make up</code> or start backend.
            </div>
          )}
        </div>
      </section>

      {/* Core Architectural Pillars */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
          Architectural Foundation
        </h3>

        <div className="grid grid-cols-1 gap-2">
          <div className="bg-surface rounded-2xl p-3.5 border border-surface-2 flex items-start space-x-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text">Integer Paise Precision</h4>
              <p className="text-xs text-muted mt-0.5">
                Stored as 64-bit integer paise (BIGINT) with strict mathematical reconciliation. Zero floating-point rounding errors.
              </p>
            </div>
          </div>

          <div className="bg-surface rounded-2xl p-3.5 border border-surface-2 flex items-start space-x-3">
            <div className="w-8 h-8 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text">Mobile-First PWA</h4>
              <p className="text-xs text-muted mt-0.5">
                Engineered for iPhone 390×844 viewport with safe areas, standalone Home Screen support, and custom numeric keypad.
              </p>
            </div>
          </div>

          <div className="bg-surface rounded-2xl p-3.5 border border-surface-2 flex items-start space-x-3">
            <div className="w-8 h-8 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text">Offline Resilience</h4>
              <p className="text-xs text-muted mt-0.5">
                Local-first mutation queue in IndexedDB with client-generated UUIDs ensuring zero duplicate transactions on sync.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
