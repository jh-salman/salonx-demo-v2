import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'phosphor-react';
import BottomToolbar from '../../component/BottomToolbar.jsx';
import { useRampQueue, rampStatusLabel } from '../../data/rampQueueStore.js';
import {
  useRampPostMetaMap,
  rampPostTypePillLabel,
} from '../../data/rampPostMetaStore.js';
import '../style/ramp-master-queue.css';

function stateGlyph(status) {
  switch (String(status || '').trim()) {
    case 'ready':
      return '⚡';
    case 'pending_pick':
      return '📸';
    default:
      return '';
  }
}

export default function RampMasterQueue() {
  const navigate = useNavigate();
  const location = useLocation();
  const items = useRampQueue();
  const metaMap = useRampPostMetaMap();

  const rows = useMemo(
    () =>
      items.map((row) => {
        const token = String(row.token || row.id || '');
        const meta = metaMap[token] || null;
        return {
          key: `mq-${token}`,
          token,
          name: row.title || 'Client',
          status: row.status,
          statusLabel: rampStatusLabel(row.status),
          glyph: stateGlyph(row.status),
          postTypeLabel: rampPostTypePillLabel(meta?.postType),
          armed: Boolean(meta?.armed),
          initial: (row.title || 'C').trim().charAt(0).toUpperCase(),
        };
      }),
    [items, metaMap],
  );

  return (
    <div className="ramp-mq">
      <header className="ramp-mq__head">
        <button
          type="button"
          className="ramp-mq__back"
          onClick={() => navigate('/screen1')}
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={20} weight="bold" aria-hidden />
        </button>
        <div className="ramp-mq__bolt" aria-hidden>⚡</div>
        <div className="ramp-mq__titleWrap">
          <span className="ramp-mq__title">RAMP</span>
          <span className="ramp-mq__sub">Master Queue</span>
        </div>
        <button
          type="button"
          className="ramp-mq__lib"
          onClick={() => navigate('/ramp/library')}
        >
          Library
        </button>
      </header>

      <div className="ramp-mq__scroll">
        <div className="ramp-mq__banner">
          <span aria-hidden>🔄</span>
          <span>
            <b>Same queue as your dashboard.</b> Act here, the dashboard updates.
          </span>
        </div>

        <div className="ramp-mq__sec">
          Waiting <span className="ramp-mq__count">{rows.length}</span>
        </div>
        <p className="ramp-mq__hint">Tap to build · one more tap to ship</p>

        {rows.length === 0 ? (
          <div className="ramp-mq__empty">
            No RAMP posts waiting. Tap the bolt to capture a moment.
          </div>
        ) : (
          rows.map((row) => (
            <button
              type="button"
              key={row.key}
              className="ramp-mq__card"
              onClick={() => navigate(`/screen5/ramp/${encodeURIComponent(row.token)}`)}
            >
              {row.armed ? (
                <span className="ramp-mq__armed">
                  ⚡ {row.postTypeLabel ? `${row.postTypeLabel} armed` : 'Armed'}
                </span>
              ) : null}
              <span className="ramp-mq__thumb" aria-hidden>{row.initial}</span>
              <span className="ramp-mq__body">
                <span className="ramp-mq__name">{row.name}</span>
                <span className="ramp-mq__pills">
                  {row.postTypeLabel ? (
                    <span className="ramp-mq__pill ramp-mq__pill--dot">{row.postTypeLabel}</span>
                  ) : null}
                  <span className="ramp-mq__pill">
                    {row.glyph ? `${row.glyph} ` : ''}{row.statusLabel}
                  </span>
                </span>
              </span>
              <span className="ramp-mq__arrow" aria-hidden>›</span>
            </button>
          ))
        )}
      </div>
      <BottomToolbar activeIndex={2} originPath={location.pathname} />
    </div>
  );
}
