import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Loader2,
  Check,
  FileText,
} from 'lucide-react';
import {
  useUploadImport,
  usePreviewImport,
  useCommitImport,
  useUndoImport,
  useImportBatches,
} from './useImports';
import { useCategories } from '../categories/useCategories';
import {
  ImportUploadResponse,
  ImportPreviewResponse,
  ColumnMapping,
} from '../../types/imports';
import { formatINR } from '../../lib/money';
import { useToast } from '../../components/ui/useToast';

export const ImportWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: categories = [] } = useCategories();
  const { data: recentBatches = [] } = useImportBatches();

  const uploadMutation = useUploadImport();
  const previewMutation = usePreviewImport();
  const commitMutation = useCommitImport();
  const undoMutation = useUndoImport();

  // Wizard step: 1 = Upload, 2 = Mapping, 3 = Review, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadData, setUploadData] = useState<ImportUploadResponse | null>(null);

  // Step 2 state
  const [amountMode, setAmountMode] = useState<'debit_credit' | 'single_column'>('debit_credit');
  const [mapping, setMapping] = useState<ColumnMapping>({ date: '', description: '' });
  const [dateFormat, setDateFormat] = useState<string>('DD/MM/YYYY');
  const [skipCredits, setSkipCredits] = useState<boolean>(true);

  // Step 3 state
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [rowSelections, setRowSelections] = useState<Record<number, boolean>>({});
  const [rowCategories, setRowCategories] = useState<Record<number, string>>({});
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);

  // Step 4 state
  const [committedBatchId, setCommittedBatchId] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number>(0);
  const [skippedCount, setSkippedCount] = useState<number>(0);

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      showToast('Please upload a CSV or TXT statement file.', { type: 'error' });
      return;
    }

    setSelectedFile(file);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await uploadMutation.mutateAsync(formData);
      setUploadData(res);
      setMapping(res.suggested_mapping);
      setDateFormat(res.detected.date_format || 'DD/MM/YYYY');
      if (res.suggested_mapping.amount && !res.suggested_mapping.debit) {
        setAmountMode('single_column');
      } else {
        setAmountMode('debit_credit');
      }
      setStep(2);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not parse statement file.', { type: 'error' });
    }
  };

  // Step 2: Request Preview
  const handleGeneratePreview = async () => {
    if (!uploadData) return;

    try {
      const res = await previewMutation.mutateAsync({
        batchId: uploadData.batch_id,
        request: {
          mapping,
          date_format: dateFormat,
          amount_mode: amountMode,
          skip_credits: skipCredits,
        },
      });

      setPreviewData(res);

      // Initialize selections & categories
      const initialSelections: Record<number, boolean> = {};
      const initialCats: Record<number, string> = {};

      res.rows.forEach((r) => {
        initialSelections[r.row_no] = !r.is_duplicate;
        if (r.suggested_category_id) {
          initialCats[r.row_no] = r.suggested_category_id;
        } else if (categories.length > 0) {
          initialCats[r.row_no] = categories[0]?.id ?? '';
        }
      });

      setRowSelections(initialSelections);
      setRowCategories(initialCats);
      setStep(3);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error previewing rows.', { type: 'error' });
    }
  };

  // Toggle row selection
  const toggleRow = (rowNo: number) => {
    setRowSelections((prev) => ({ ...prev, [rowNo]: !prev[rowNo] }));
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (!previewData) return;
    const allSelected = previewData.rows.every((r) => rowSelections[r.row_no]);
    const updated: Record<number, boolean> = {};
    previewData.rows.forEach((r) => {
      updated[r.row_no] = !allSelected;
    });
    setRowSelections(updated);
  };

  // Step 3: Commit
  const handleCommit = async () => {
    if (!uploadData || !previewData) return;

    const commitRows = previewData.rows.map((r) => ({
      row_no: r.row_no,
      category_id: rowCategories[r.row_no] ?? null,
      subcategory_id: null,
      include: !!rowSelections[r.row_no],
    }));

    try {
      const res = await commitMutation.mutateAsync({
        batchId: uploadData.batch_id,
        request: {
          rows: commitRows,
          skip_duplicates: skipDuplicates,
        },
      });

      setCommittedBatchId(uploadData.batch_id);
      setImportedCount(res.imported);
      setSkippedCount(res.skipped);
      setStep(4);
      showToast(`Imported ${res.imported} transactions into SpendWise.`, { type: 'success' });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error committing transactions.', { type: 'error' });
    }
  };

  // Undo batch
  const handleUndoBatch = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to rollback this import batch?')) return;

    try {
      const res = await undoMutation.mutateAsync(batchId);
      showToast(`Rolled back ${res.rolled_back} transactions from this import batch.`, { type: 'info' });
      if (step === 4) {
        setStep(1);
        setSelectedFile(null);
        setUploadData(null);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error rolling back import.', { type: 'error' });
    }
  };

  const selectedRowCount = useMemo(() => {
    return Object.values(rowSelections).filter(Boolean).length;
  }, [rowSelections]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors ios-press"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-text">Statement Import Wizard</h2>
          <p className="text-xs text-muted font-medium mt-0.5">
            Import CSV statements from HDFC, SBI, ICICI, Axis, or credit cards
          </p>
        </div>
      </div>

      {/* Wizard Step Indicator */}
      <div className="flex items-center justify-between px-2 text-xs font-bold text-muted">
        <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-primary' : ''}`}>
          <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">
            1
          </span>
          <span>Upload</span>
        </div>
        <div className="flex-1 h-0.5 mx-2 bg-surface-2" />
        <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-primary' : ''}`}>
          <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">
            2
          </span>
          <span>Mapping</span>
        </div>
        <div className="flex-1 h-0.5 mx-2 bg-surface-2" />
        <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-primary' : ''}`}>
          <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">
            3
          </span>
          <span>Review</span>
        </div>
      </div>

      {/* STEP 1: Upload CSV */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl border-2 border-dashed border-surface-2 bg-surface hover:border-primary/50 transition-colors text-center relative cursor-pointer">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              disabled={uploadMutation.isPending}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
              {uploadMutation.isPending ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : (
                <UploadCloud className="w-7 h-7" />
              )}
            </div>
            <p className="text-sm font-extrabold text-text">
              {uploadMutation.isPending ? 'Analyzing Statement...' : 'Tap or drop your bank CSV here'}
            </p>
            <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
              Supports HDFC, SBI, ICICI, Axis, Kotak, credit card CSV statements.
            </p>
          </div>

          {/* Recent Batches Section */}
          {recentBatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
                Recent Imports
              </h3>
              <div className="bg-surface rounded-2xl border border-surface-2 divide-y divide-surface-2 overflow-hidden shadow-xs">
                {recentBatches.map((batch) => (
                  <div key={batch.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-3 min-w-0">
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-text truncate">{batch.original_filename}</p>
                        <p className="text-[11px] text-muted">
                          {batch.row_count_imported} imported • {new Date(batch.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          batch.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-surface-2 text-muted'
                        }`}
                      >
                        {batch.status}
                      </span>
                      {batch.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleUndoBatch(batch.id)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 p-1 rounded-md hover:bg-rose-500/10 transition-colors"
                          title="Undo this import batch"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Undo</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Configure Mapping */}
      {step === 2 && uploadData && (
        <div className="space-y-4">
          {/* File summary banner */}
          <div className="p-3.5 rounded-2xl bg-surface border border-surface-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              <span className="font-bold text-text truncate max-w-[200px]">
                {uploadData.original_filename}
              </span>
            </div>
            <span className="text-muted font-medium">
              Delimiter: &apos;{uploadData.detected.delimiter}&apos; • {uploadData.detected.encoding}
            </span>
          </div>

          {/* Amount Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted">Amount Column Structure</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAmountMode('debit_credit')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  amountMode === 'debit_credit'
                    ? 'border-primary bg-primary/10 text-text font-bold'
                    : 'border-surface-2 bg-surface text-muted'
                }`}
              >
                <p className="text-xs">Debit & Credit Columns</p>
                <p className="text-[10px] text-muted font-normal mt-0.5">Separate columns for out & in</p>
              </button>

              <button
                type="button"
                onClick={() => setAmountMode('single_column')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  amountMode === 'single_column'
                    ? 'border-primary bg-primary/10 text-text font-bold'
                    : 'border-surface-2 bg-surface text-muted'
                }`}
              >
                <p className="text-xs">Single Amount Column</p>
                <p className="text-[10px] text-muted font-normal mt-0.5">Signed (+/-) or Dr/Cr indicators</p>
              </button>
            </div>
          </div>

          {/* Column Dropdowns */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted">Date Column *</label>
              <select
                value={mapping.date}
                onChange={(e) => setMapping((m) => ({ ...m, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-surface-2 text-xs text-text border border-surface-2 font-medium"
              >
                {uploadData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted">Description Column *</label>
              <select
                value={mapping.description}
                onChange={(e) => setMapping((m) => ({ ...m, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-surface-2 text-xs text-text border border-surface-2 font-medium"
              >
                {uploadData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {amountMode === 'debit_credit' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted">Debit Column (Expenses)</label>
                <select
                  value={mapping.debit || ''}
                  onChange={(e) => setMapping((m) => ({ ...m, debit: e.target.value || null }))}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 text-xs text-text border border-surface-2 font-medium"
                >
                  <option value="">None</option>
                  {uploadData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted">Credit Column (Deposits)</label>
                <select
                  value={mapping.credit || ''}
                  onChange={(e) => setMapping((m) => ({ ...m, credit: e.target.value || null }))}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 text-xs text-text border border-surface-2 font-medium"
                >
                  <option value="">None</option>
                  {uploadData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted">Amount Column *</label>
              <select
                value={mapping.amount || ''}
                onChange={(e) => setMapping((m) => ({ ...m, amount: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-surface-2 text-xs text-text border border-surface-2 font-medium"
              >
                <option value="">Select Column</option>
                {uploadData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Format & Credit Skipping */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted">Date Format</label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-2 text-xs text-text border border-surface-2 font-medium"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 02/11/2026)</option>
                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                <option value="DD MMM YYYY">DD MMM YYYY (e.g. 02 Nov 2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text">
                <input
                  type="checkbox"
                  checked={skipCredits}
                  onChange={(e) => setSkipCredits(e.target.checked)}
                  className="rounded border-surface-2 text-primary focus:ring-0 w-4 h-4"
                />
                <span>Skip Deposits & Credits</span>
              </label>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-bold rounded-xl text-muted hover:bg-surface-2 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleGeneratePreview}
              disabled={previewMutation.isPending}
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {previewMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Review Transactions</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review Table & Bulk Selection */}
      {step === 3 && previewData && (
        <div className="space-y-4">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-surface border border-surface-2">
              <p className="text-muted font-semibold">Total Rows</p>
              <p className="text-sm font-extrabold text-text mt-0.5">{previewData.stats.total}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface border border-surface-2">
              <p className="text-muted font-semibold">Selected</p>
              <p className="text-sm font-extrabold text-primary mt-0.5">{selectedRowCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface border border-surface-2">
              <p className="text-muted font-semibold">Duplicates</p>
              <p className="text-sm font-extrabold text-amber-500 mt-0.5">
                {previewData.stats.duplicates}
              </p>
            </div>
          </div>

          {/* Duplicate filter toggle */}
          {previewData.stats.duplicates > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>{previewData.stats.duplicates} transactions already exist in your records</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-amber-600 dark:text-amber-400">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-amber-500 text-amber-500 focus:ring-0 w-3.5 h-3.5"
                />
                <span>Skip Duplicates</span>
              </label>
            </div>
          )}

          {/* Row review list */}
          <div className="bg-surface rounded-2xl border border-surface-2 divide-y divide-surface-2 overflow-hidden shadow-xs">
            <div className="p-3 bg-surface-2/40 flex items-center justify-between text-xs font-bold text-muted">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRowCount === previewData.rows.length}
                  onChange={toggleSelectAll}
                  className="rounded border-surface-2 text-primary focus:ring-0 w-4 h-4"
                />
                <span>Select All ({previewData.rows.length})</span>
              </label>
              <span>Category Assignment</span>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-surface-2">
              {previewData.rows.map((row) => {
                const isSelected = !!rowSelections[row.row_no];
                return (
                  <div
                    key={row.row_no}
                    className={`p-3 text-xs flex items-center justify-between gap-3 transition-colors ${
                      row.is_duplicate ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(row.row_no)}
                        className="rounded border-surface-2 text-primary focus:ring-0 w-4 h-4 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-text truncate max-w-[180px]">
                            {row.description}
                          </p>
                          {row.is_duplicate && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-500">
                              Duplicate
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted">
                          {row.parsed_date || row.date_raw} •{' '}
                          <span className="font-extrabold text-text tabular-nums">
                            {formatINR(row.amount_minor)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <select
                        value={rowCategories[row.row_no] || ''}
                        onChange={(e) =>
                          setRowCategories((prev) => ({ ...prev, [row.row_no]: e.target.value }))
                        }
                        className="px-2 py-1 rounded-lg bg-surface-2 text-xs text-text border border-surface-2 font-medium max-w-[130px]"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commit Navigation */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 text-xs font-bold rounded-xl text-muted hover:bg-surface-2 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleCommit}
              disabled={commitMutation.isPending || selectedRowCount === 0}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {commitMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Import {selectedRowCount} Transactions</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Success & Undo Banner */}
      {step === 4 && (
        <div className="p-8 rounded-3xl bg-surface border border-surface-2 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-extrabold text-text">Statement Import Complete!</h3>
            <p className="text-xs text-muted mt-1">
              Successfully imported {importedCount} transactions into SpendWise
              {skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ''}.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-3">
            {committedBatchId && (
              <button
                type="button"
                onClick={() => handleUndoBatch(committedBatchId)}
                disabled={undoMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-500 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 transition-colors"
              >
                {undoMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Undo This Import</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/transactions')}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-dark transition-colors shadow-xs"
            >
              <span>View Transactions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

