import React, { useEffect } from 'react';
import { KIND_NAME, RESOURCE_NAME, fmtRange, stepKind } from './labels.js';

/** Small card opened by clicking any block on the Plan: what it is, when, and a big Done button. */
export default function StepPopover({ step, dish, color, canEdit, onToggleDone, onOpenDish, onClose }) {
  useEffect(() => {
    const esc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const kind = stepKind(step);
  return (
    <div className="pop-back no-print" onClick={onClose}>
      <div
        className="pop"
        role="dialog"
        aria-label={step.text}
        style={{ borderTopColor: color.bg }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pop-head">
          <strong>
            {step.done ? '✓ ' : ''}
            {dish && dish.emoji ? `${dish.emoji} ` : ''}
            {step.text}
          </strong>
          <button className="secondary" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted">
          {dish ? `${dish.title} · ` : ''}
          {KIND_NAME[kind]}
          {step.resource && step.resource !== 'none' ? ` · ${RESOURCE_NAME[step.resource] || step.resource}` : ''}
        </p>
        <p>{fmtRange(step.startAt, step.durationMin)}</p>
        {dish && dish.cookName && <p className="muted">Cook: {dish.cookName}</p>}
        <div className="pop-actions">
          {canEdit ? (
            <button className={`pop-done${step.done ? ' undo' : ''}`} onClick={() => onToggleDone(step)}>
              {step.done ? '↩ Mark not done' : '✓ Mark done'}
            </button>
          ) : (
            <span className="muted">Only cooks and the owner can mark blocks done.</span>
          )}
          {dish && (
            <button className="secondary" onClick={() => onOpenDish(dish.id)}>
              Open recipe
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
