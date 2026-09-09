'use client';

/**
 * ResetConfirmationModal — Destructive action confirmation for resetting a topic.
 *
 * Theme: White and Gold with Teal.
 * Reused on both TopicsScreen and QuestionScreen.
 */

import React from 'react';

interface ResetConfirmationModalProps {
  topicName: string;
  pointsToDeduct?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ResetConfirmationModal({
  topicName,
  pointsToDeduct = 0,
  onConfirm,
  onCancel,
}: ResetConfirmationModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div className="bg-white w-full max-w-md p-7 rounded-2xl border border-slate-200 shadow-2xl relative">
        <div className="flex items-start gap-3.5 mb-4">
          <div className="h-11 w-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center flex-shrink-0">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <div>
            <h2
              id="reset-modal-title"
              className="text-lg font-extrabold text-slate-900"
            >
              Reset Topic?
            </h2>
            <p className="text-sm font-bold text-[#0D5C58] mt-0.5">
              &ldquo;{topicName}&rdquo;
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-6 space-y-2 text-xs text-slate-600">
          <p className="font-bold text-slate-900 text-xs mb-1">
            This action cannot be undone:
          </p>
          <p className="flex items-center gap-2">
            <span className="text-amber-600 font-bold">•</span>
            <span>
              The topic will be marked untaken and open for selection again.
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-amber-600 font-bold">•</span>
            <span>All question progress for this topic will be cleared.</span>
          </p>
          {pointsToDeduct > 0 && (
            <p className="flex items-center gap-2 text-rose-700 font-bold">
              <span className="text-rose-600 font-bold">•</span>
              <span>
                <strong>
                  {pointsToDeduct} point{pointsToDeduct !== 1 ? 's' : ''}
                </strong>{' '}
                awarded during this topic will be deducted from player scores.
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all"
            id="cancel-reset-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-md active:scale-95"
            id="confirm-reset-btn"
          >
            Confirm Reset
          </button>
        </div>
      </div>
    </div>
  );
}
