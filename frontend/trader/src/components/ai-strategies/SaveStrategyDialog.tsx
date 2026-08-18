'use client';

/**
 * "Save strategy" dialog for the Strategy Maker — name + optional description,
 * saved as a draft via the page's existing save flow (aiApi.create →
 * router.push). Presentational only; all state lives in the page.
 */

import { clsx } from 'clsx';
import Modal from '@/components/ui/Modal';
import { inputCls } from '@/components/ai-strategies/shared';

interface SaveStrategyDialogProps {
  open: boolean;
  saving: boolean;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function SaveStrategyDialog({
  open,
  saving,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onClose,
  onSave,
}: SaveStrategyDialogProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Save strategy"
      width="md"
    >
      <div className="space-y-4">
        <p className="text-xs text-text-secondary">
          It will be saved as a draft. Nothing trades until you deploy it to an account.
        </p>
        <div>
          <label htmlFor="strategy-name" className="mb-1.5 block text-xs text-text-secondary">
            Name
          </label>
          <input
            id="strategy-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. EURUSD Trend 1h"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="strategy-desc" className="mb-1.5 block text-xs text-text-secondary">
            Description (optional)
          </label>
          <textarea
            id="strategy-desc"
            rows={3}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="A one-line summary you will recognise in a list of twenty."
            className={clsx(inputCls, 'resize-none')}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-border-primary py-2.5 text-xs text-text-secondary transition-colors hover:border-border-secondary hover:text-text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !name.trim()}
            className="flex-1 rounded-lg bg-[#E94E1B] py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#C73E11] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
