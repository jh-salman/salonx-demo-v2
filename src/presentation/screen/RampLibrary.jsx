import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'phosphor-react';
import BottomToolbar from '../../component/BottomToolbar.jsx';
import { fetchRampLibrary } from '../../data/rampApi.js';
import { rampStatusLabel } from '../../data/rampQueueStore.js';
import '../style/ramp-library.css';

export default function RampLibrary() {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRampLibrary(60)
      .then((res) => {
        if (cancelled) return;
        setItems(Array.isArray(res?.items) ? res.items : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(
    () =>
      items.map((row) => {
        const token = String(row.token || '');
        return {
          key: `lib-${token}`,
          token,
          name: row.title || 'RAMP post',
          caption: typeof row.caption === 'string' ? row.caption.trim() : '',
          compositeUrl: row.compositeUrl || '',
          statusLabel: rampStatusLabel(row.status),
          initial: (row.title || 'R').trim().charAt(0).toUpperCase(),
        };
      }),
    [items],
  );

  return (
    <div className="ramp-lib">
      <header className="ramp-lib__head">
        <button
          type="button"
          className="ramp-lib__back"
          onClick={() => navigate('/screen1')}
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={20} weight="bold" aria-hidden />
        </button>
        <div className="ramp-lib__bolt" aria-hidden>⚡</div>
        <div className="ramp-lib__titleWrap">
          <span className="ramp-lib__title">RAMP</span>
          <span className="ramp-lib__sub">Library</span>
        </div>
      </header>

      <div className="ramp-lib__scroll">
        <p className="ramp-lib__hint">Every post you've built — tap to reopen, re-share or copy.</p>

        {loading ? (
          <div className="ramp-lib__empty">Loading your library…</div>
        ) : cards.length === 0 ? (
          <div className="ramp-lib__empty">
            No posts yet. Ship a RAMP post and it lands here for any device.
          </div>
        ) : (
          <div className="ramp-lib__grid">
            {cards.map((card) => (
              <button
                type="button"
                key={card.key}
                className="ramp-lib__card"
                onClick={() => navigate(`/screen5/ramp/${encodeURIComponent(card.token)}`)}
              >
                <span className="ramp-lib__thumb" aria-hidden>
                  {card.compositeUrl ? (
                    <img src={card.compositeUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="ramp-lib__thumbFallback">{card.initial}</span>
                  )}
                  <span className="ramp-lib__status">{card.statusLabel}</span>
                </span>
                <span className="ramp-lib__name">{card.name}</span>
                {card.caption ? (
                  <span className="ramp-lib__caption">{card.caption}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
      <BottomToolbar activeIndex={2} originPath={location.pathname} />
    </div>
  );
}
