import { useEffect, useState } from 'react';

import { api } from '../lib/api';
import { haptic, notify } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';

interface ConfirmDeleteGoalModalProps {
  lang: Lang;
  goalId: string;
  goalTitle: string;
  onClose: () => void;
  onDeleted: (xpLost: number, goalTitle: string) => Promise<void> | void;
}

interface Preview {
  completedTasks: number;
  pendingTasks: number;
  xpToLose: number;
}

export function ConfirmDeleteGoalModal({
  lang,
  goalId,
  goalTitle,
  onClose,
  onDeleted,
}: ConfirmDeleteGoalModalProps): JSX.Element {
  const i = t(lang);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.previewDeleteGoal(goalId);
        if (!cancelled) {
          setPreview({
            completedTasks: data.completedTasks,
            pendingTasks: data.pendingTasks,
            xpToLose: data.xpToLose,
          });
        }
      } catch (err) {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : i.errors.generic);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goalId, i.errors.generic]);

  async function confirm(): Promise<void> {
    setSubmitting(true);
    setError(null);
    haptic('medium');
    try {
      const result = await api.deleteGoal(goalId);
      notify('success');
      await onDeleted(result.xpLost, result.goalTitle);
    } catch (err) {
      notify('error');
      setError(err instanceof Error ? err.message : i.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  const body = renderBody(i, preview);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-card p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>🗑️</span>
            <span>{i.deleteGoal.title}</span>
          </h2>
        </div>

        <div className="surface bg-black/20 rounded-card p-3 space-y-1">
          <div className="text-xs text-muted uppercase tracking-wider">{i.today.title}</div>
          <div className="font-semibold truncate">{goalTitle}</div>
        </div>

        <div className="text-sm text-text/90 leading-relaxed">{body}</div>

        {previewError && (
          <div className="text-xs text-danger break-words">{previewError}</div>
        )}
        {error && <div className="text-xs text-danger break-words">{error}</div>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-card py-3 px-4 bg-transparent border border-white/10 text-text/80 font-medium transition active:opacity-80 disabled:opacity-50"
          >
            {i.deleteGoal.cancel}
          </button>
          <button
            onClick={confirm}
            disabled={submitting || preview === null}
            className="flex-1 rounded-card py-3 px-4 bg-danger/90 hover:bg-danger text-white font-semibold transition active:opacity-80 disabled:opacity-50"
          >
            {submitting ? '...' : i.deleteGoal.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function renderBody(
  i: ReturnType<typeof t>,
  preview: Preview | null,
): string {
  if (!preview) return '…';
  if (preview.xpToLose === 0) return i.deleteGoal.bodyNoProgress;
  return i.deleteGoal.bodyHasProgress
    .replace('{xp}', String(preview.xpToLose))
    .replace('{completed}', String(preview.completedTasks));
}
