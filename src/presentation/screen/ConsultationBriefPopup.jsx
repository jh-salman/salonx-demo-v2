import React from 'react';
import {
  ArrowLeft,
  Camera,
  CaretRight,
  ChatCircle,
  Clock,
  Microphone,
  NotePencil,
  WaveTriangle,
} from 'phosphor-react';
import './consultationBrief.css';

const POPUP_SECTIONS = [
  { key: 'CHAIR', label: 'CHAIR', tone: 'chair' },
  { key: 'PATH', label: 'FORMULAS', tone: 'path' },
  { key: 'LIFE', label: 'LIFE', tone: 'life' },
];

function formatLiveTimerMMSS(state) {
  if (!state || state.kind !== 'stopwatchRunning' || !state.startedAt) return '0:00';
  const sec = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}

function todayStamp() {
  const d = new Date();
  return {
    dow: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    day: d.getDate(),
    mo: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export default function ConsultationBriefPopup({
  clientName,
  clientPhotoUrl,
  visitLabel,
  msgCount,
  consultRecord,
  liveTimer,
  prePillKind,
  preSummary,
  returningSuffix,
  photosChron,
  formatNoteDateShort,
  onClose,
  onOpenNewNote,
  onOpenNewNoteWithVoice,
  onOpenPhotoPicker,
  onEditPaneEntry,
  onEditPhotoEntry,
  onSetTimerModalOpen,
}) {
  const stamp = todayStamp();
  const photos = photosChron || [];

  const alertTag =
    prePillKind === 'alert'
      ? 'ALERT'
      : prePillKind === 'new'
        ? 'NEW'
        : `RETURNING${returningSuffix || ''}`;
  const alertSub = prePillKind === 'alert' ? 'REVIEW' : prePillKind === 'new' ? 'INTAKE' : '';

  return (
    <div className="nc-popup nc-popup--s2 ncv2" role="dialog" aria-modal="true" aria-label="Consultation">
      <header className="ncv2-header">
        <button type="button" className="ncv2-back" onClick={onClose} aria-label="Back">
          <ArrowLeft size={22} weight="bold" aria-hidden />
        </button>

        <div className="ncv2-photo" aria-hidden>
          {clientPhotoUrl ? (
            <img src={clientPhotoUrl} alt="" draggable={false} />
          ) : (
            <Camera size={20} weight="regular" />
          )}
        </div>

        <div className="ncv2-identity">
          <div className="ncv2-name" title={clientName}>{clientName || 'Client'}</div>
          <div className="ncv2-visit">{visitLabel || ''}</div>
        </div>

        <button
          type="button"
          className="ncv2-timerPill"
          onClick={() => onSetTimerModalOpen?.(true)}
          aria-label="Open timer"
        >
          <div className="ncv2-timerPill__row">
            <Clock size={14} weight="bold" aria-hidden />
            <span className="ncv2-timerPill__value">{formatLiveTimerMMSS(liveTimer)}</span>
          </div>
          <span className="ncv2-timerPill__label">TIMER</span>
        </button>

        <div className="ncv2-headerCurve" aria-hidden>
          <svg
            width="99"
            height="216"
            viewBox="0 0 99 216"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <path
              d="M25.2381 94.5C-5.77198 68 1.82035 1 1.82035 1H47.3204H97.8204V235.5L90.8169 190C80.6496 135 56.2482 121 25.2381 94.5Z"
              fill="#1F1C1C"
              stroke="var(--salonx-primary)"
              strokeWidth="2"
              vectorEffect="nonScalingStroke"
            />
          </svg>
        </div>

        <div className="ncv2-dateStamp" aria-hidden>
          <div className="ncv2-dateStamp__dow">{stamp.dow}</div>
          <div className="ncv2-dateStamp__day">{stamp.day}</div>
        </div>
      </header>

      <button
        type="button"
        className={`ncv2-alert is-${prePillKind || 'returning'}`}
        onClick={() => onOpenNewNote('LIFE')}
        aria-label="Pre-consult"
      >
        <span className="ncv2-alert__dot" aria-hidden />
        <span className="ncv2-alert__tag">{alertTag}</span>
        {alertSub ? (
          <>
            <span className="ncv2-alert__sep" aria-hidden>·</span>
            <span className="ncv2-alert__sub">{alertSub}</span>
          </>
        ) : null}
        <span className="ncv2-alert__text">{preSummary}</span>
        {msgCount ? (
          <span className="ncv2-alert__chat" aria-label={`${msgCount} messages`}>
            <ChatCircle size={14} weight="regular" aria-hidden />
            <span>{msgCount}</span>
          </span>
        ) : null}
        <CaretRight size={14} weight="bold" className="ncv2-alert__chev" aria-hidden />
      </button>

      <div className="ncv2-scroll">
        {POPUP_SECTIONS.map((sec) => {
          const entries = consultRecord?.[`${sec.key}_entries`] || [];
          const fallback = (consultRecord?.[sec.key] || '').trim();
          const rows = entries.length > 0
            ? entries
            : fallback
              ? [{ ts: null, text: fallback, _synthetic: true }]
              : [];

          return (
            <section key={sec.key} className={`ncv2-section is-${sec.tone}`}>
              <div className="ncv2-section__head">
                <span className="ncv2-section__dot" aria-hidden />
                <span className="ncv2-section__label">{sec.label}</span>
              </div>

              <div className="ncv2-section__rows">
                {rows.length === 0 ? (
                  <button
                    type="button"
                    className="ncv2-row ncv2-row--empty"
                    onClick={() => onOpenNewNote(sec.key)}
                  >
                    <span className="ncv2-row__date">—</span>
                    <span className="ncv2-row__body">Tap to add</span>
                    <span
                      className="ncv2-row__mic"
                      role="img"
                      aria-hidden
                    >
                      <Microphone size={14} weight="fill" />
                    </span>
                  </button>
                ) : (
                  rows.map((entry, idx) => (
                    <button
                      key={`${sec.key}-${entry.ts ?? idx}-${idx}`}
                      type="button"
                      className="ncv2-row"
                      onClick={() => onEditPaneEntry(sec.key, entry, idx, entries.length)}
                    >
                      <span className="ncv2-row__date">
                        {entry.ts ? formatNoteDateShort(entry.ts) : '—'}
                      </span>
                      <span className="ncv2-row__body">{entry.text}</span>
                      <span
                        className="ncv2-row__mic"
                        role="button"
                        tabIndex={-1}
                        aria-label={`Voice ${sec.key} note`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenNewNoteWithVoice(sec.key);
                        }}
                      >
                        <Microphone size={14} weight="fill" />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          );
        })}

        <section className="ncv2-section is-look">
          <div className="ncv2-section__head">
            <span className="ncv2-section__dot" aria-hidden />
            <span className="ncv2-section__label">LOOK</span>
            <button
              type="button"
              className="ncv2-look__cam"
              onClick={() => onOpenPhotoPicker(null)}
              aria-label="Add LOOK photo"
            >
              <Camera size={16} weight="fill" aria-hidden />
            </button>
          </div>

          <div className="ncv2-look__meta">
            <span className="ncv2-look__count">{photos.length} PHOTOS</span>
            <span className="ncv2-look__sep" aria-hidden>••</span>
            <span className="ncv2-look__hint">SCROLL</span>
          </div>

          {photos.length === 0 ? (
            <button
              type="button"
              className="ncv2-look__empty"
              onClick={() => onOpenPhotoPicker(null)}
            >
              + Add photo
            </button>
          ) : (
            <div className="ncv2-look__gallery">
              {photos.map((ph, idx) => (
                <button
                  key={`${ph.ts ?? idx}-${idx}`}
                  type="button"
                  className="ncv2-look__card"
                  onClick={() => onEditPhotoEntry(ph)}
                  aria-label={`LOOK photo ${idx + 1}`}
                >
                  <div
                    className="ncv2-look__img"
                    style={{ backgroundImage: ph.url ? `url(${ph.url})` : undefined }}
                  />
                  <div className="ncv2-look__date">
                    {ph.ts ? formatNoteDateShort(ph.ts) : '—'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="ncv2-actions">
        <button
          type="button"
          className="ncv2-action ncv2-action--voice"
          onClick={() => onOpenNewNoteWithVoice('LIFE')}
        >
          <WaveTriangle size={18} weight="bold" aria-hidden />
          <span>VOICE NOTE</span>
        </button>
        <button
          type="button"
          className="ncv2-action ncv2-action--add"
          onClick={() => onOpenNewNote('LIFE')}
        >
          <NotePencil size={16} weight="regular" aria-hidden />
          <span>ADD NOTE</span>
        </button>
      </div>
    </div>
  );
}
