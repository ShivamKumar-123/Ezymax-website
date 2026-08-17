'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, Info, Sparkles, Wand2 } from 'lucide-react';
import RuleCard from '@/components/ai-strategies/RuleCard';
import { aiApi, EXAMPLE_DSL, type StrategyDsl } from '@/lib/ai-strategies';

const inputCls =
  'w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50';

/**
 * Builder tab — natural-language prompt → AI-generated strategy, rendered as a
 * readable rule card plus a collapsible JSON editor for manual tweaks. When the
 * AI service is unavailable (503) users can still build strategies by editing
 * the JSON, starting from a template.
 */
export default function BuilderTab({ onSaved }: { onSaved: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dsl, setDsl] = useState<StrategyDsl | null>(null);
  const [dslText, setDslText] = useState('');
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyDsl = (next: StrategyDsl) => {
    setDsl(next);
    setDslText(JSON.stringify(next, null, 2));
    setJsonError(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Describe your strategy first');
      return;
    }
    setGenerating(true);
    try {
      const res = await aiApi.generate(prompt.trim());
      setAiUnavailable(null);
      setName(res.name || '');
      setDescription(res.description || '');
      applyDsl(res.dsl || {});
      toast.success('Strategy generated — review the rules below');
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status;
      const msg = e instanceof Error ? e.message : 'Generation failed';
      if (status === 503) {
        setAiUnavailable(msg);
        if (!dsl) applyDsl(EXAMPLE_DSL);
        setJsonOpen(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const applyJson = (): StrategyDsl | null => {
    try {
      const parsed = JSON.parse(dslText) as StrategyDsl;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setJsonError('Strategy JSON must be an object');
        return null;
      }
      setDsl(parsed);
      setJsonError(null);
      return parsed;
    } catch (e: unknown) {
      setJsonError(e instanceof Error ? `Invalid JSON: ${e.message}` : 'Invalid JSON');
      return null;
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Give your strategy a name');
      return;
    }
    // If the JSON editor is open, treat its content as source of truth.
    const effectiveDsl = jsonOpen && dslText.trim() ? applyJson() : dsl;
    if (!effectiveDsl) {
      if (!jsonError) toast.error('Generate a strategy or start from the template first');
      return;
    }
    setSaving(true);
    try {
      await aiApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        prompt: prompt.trim() || undefined,
        dsl: effectiveDsl,
      });
      toast.success('Strategy saved');
      setName('');
      setDescription('');
      setPrompt('');
      setDsl(null);
      setDslText('');
      setJsonOpen(false);
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save strategy');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Prompt */}
      <div className="bg-card border border-border-primary rounded-xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] space-y-3">
        <div>
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <Sparkles size={16} className="text-[#E94E1B]" />
            Describe your strategy
          </h2>
          <p className="text-xs text-text-tertiary mt-1">
            Plain English in, trading rules out — e.g. &ldquo;Buy EURUSD on the 1h chart when the 20 EMA crosses
            above the 50 EMA and RSI is below 70. Risk 0.5% stop loss, 1% take profit.&rdquo;
          </p>
        </div>
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the entry rules, exit rules, symbol, timeframe and risk settings…"
          className={clsx(inputCls, 'resize-none')}
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wand2 size={14} />
            {generating ? 'Generating…' : 'Generate with AI'}
          </button>
          {!dsl && (
            <button
              type="button"
              onClick={() => { applyDsl(EXAMPLE_DSL); setJsonOpen(true); }}
              className="text-xs font-semibold text-[#E94E1B] hover:underline"
            >
              Or start from a template
            </button>
          )}
        </div>
      </div>

      {/* AI unavailable — manual editing still works */}
      {aiUnavailable && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[#FCE6DD] border border-[#E94E1B]/25 text-[12px] text-[#0A0A0A]">
          <Info size={15} className="text-[#E94E1B] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#E94E1B]">AI generation unavailable</p>
            <p className="mt-0.5">{aiUnavailable}</p>
            <p className="mt-0.5 text-text-secondary">
              You can still build a strategy manually — edit the JSON below (a template has been loaded for you)
              and save it.
            </p>
          </div>
        </div>
      )}

      {/* Generated / edited strategy */}
      {dsl && (
        <div className="bg-card border border-border-primary rounded-xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Strategy Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. EMA Cross Trend Rider"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short summary of what it does"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary mb-2">Strategy Rules</p>
            <RuleCard dsl={dsl} />
          </div>

          {/* Collapsible JSON editor */}
          <div className="rounded-xl border border-border-primary overflow-hidden">
            <button
              type="button"
              onClick={() => setJsonOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-text-secondary hover:bg-bg-hover transition-colors"
            >
              <span>Advanced: edit strategy JSON</span>
              {jsonOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {jsonOpen && (
              <div className="border-t border-border-primary p-3 space-y-2">
                <textarea
                  rows={14}
                  value={dslText}
                  onChange={(e) => { setDslText(e.target.value); setJsonError(null); }}
                  spellCheck={false}
                  className={clsx(inputCls, 'font-mono text-[11px] leading-relaxed resize-y')}
                />
                {jsonError && <p className="text-[11px] text-red-600">{jsonError}</p>}
                <button
                  type="button"
                  onClick={() => { if (applyJson()) toast.success('JSON applied'); }}
                  className="px-3 py-1.5 rounded-lg border border-[#E94E1B]/40 text-[#E94E1B] text-xs font-semibold hover:bg-[#E94E1B]/10 transition-colors"
                >
                  Apply JSON
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full py-3 rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Strategy'}
          </button>
        </div>
      )}
    </div>
  );
}
