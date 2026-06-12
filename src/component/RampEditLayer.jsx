import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'phosphor-react';
import '../presentation/style/ramp-edit-layer.css';

/**
 * RAMP V3 Edit Layer — a priority-ordered menu of drill-in panels.
 * Never a live editor: each button opens one panel, the back arrow returns.
 * An unopened button guarantees that aspect is unchanged; touched buttons
 * flip to a "Changed" chip.
 *
 * Panels (locked order): Caption · Hero photo · Post type · Background ·
 * Tags & attribution · Referral & links.
 */

export const RAMP_POST_TYPES = [
  'Curiosity',
  'Professional',
  'Hype / Event',
  'Before / After',
];

const CAPTION_MAX = 2200;

function isValidUrl(value) {
  return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(String(value || '').trim());
}

function normalizeTag(raw) {
  let v = String(raw || '').trim();
  if (!v) return '';
  if (!/^[#@]/.test(v)) v = `#${v.replace(/\s+/g, '')}`;
  return v;
}

export default function RampEditLayer({
  post,
  draft,
  onDraftChange,
  onClose,
  onRegenerate,
  onUploadHero,
  busy = false,
}) {
  const [panel, setPanel] = useState('menu');
  const [changed, setChanged] = useState({});
  const [newTag, setNewTag] = useState('');
  const fileInputRef = useRef(null);
  const [heroTab, setHeroTab] = useState('ramp');
  const [pendingImport, setPendingImport] = useState(null);

  const aiCaptionDraft = useMemo(
    () => String(post?.aiCaptionDraft ?? post?.caption ?? '').trim(),
    [post?.aiCaptionDraft, post?.caption],
  );

  const markChanged = useCallback((key) => {
    setChanged((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const patch = useCallback(
    (next, key) => {
      if (key) markChanged(key);
      onDraftChange({ ...draft, ...next });
    },
    [draft, markChanged, onDraftChange],
  );

  const rampPhotos = useMemo(() => {
    const list = [];
    if (post?.careCardUrl) list.push({ url: post.careCardUrl, badge: 'This session' });
    if (post?.compositeUrl && post.compositeUrl !== post.careCardUrl) {
      list.push({ url: post.compositeUrl, badge: 'Generated' });
    }
    return list;
  }, [post?.careCardUrl, post?.compositeUrl]);

  const stateChip = (key) => (
    <span className={`rel__state ${changed[key] ? 'is-changed' : 'is-untouched'}`}>
      {changed[key] ? 'Changed' : 'Untouched'}
    </span>
  );

  const back = useCallback(() => setPanel('menu'), []);

  // ---- Caption ----
  const captionLen = String(draft.caption || '').length;

  // ---- Tags ----
  const addTag = useCallback(() => {
    const v = normalizeTag(newTag);
    if (!v) return;
    const tags = Array.isArray(draft.tags) ? draft.tags : [];
    if (tags.some((t) => t.label.toLowerCase() === v.toLowerCase())) {
      setNewTag('');
      return;
    }
    patch({ tags: [...tags, { label: v, on: true }] }, 'tags');
    setNewTag('');
  }, [draft.tags, newTag, patch]);

  const toggleTag = useCallback(
    (idx) => {
      const tags = (draft.tags || []).map((t, i) => (i === idx ? { ...t, on: !t.on } : t));
      patch({ tags }, 'tags');
    },
    [draft.tags, patch],
  );

  const delTag = useCallback(
    (idx) => {
      const tags = (draft.tags || []).filter((_, i) => i !== idx);
      patch({ tags }, 'tags');
    },
    [draft.tags, patch],
  );

  // ---- Links ----
  const setLink = useCallback(
    (idx, value) => {
      const links = (draft.links || []).map((l, i) => (i === idx ? { ...l, url: value } : l));
      patch({ links }, 'link');
    },
    [draft.links, patch],
  );

  const addLink = useCallback(() => {
    const links = Array.isArray(draft.links) ? draft.links : [];
    patch({ links: [...links, { url: '', inherited: false }] }, 'link');
  }, [draft.links, patch]);

  const delLink = useCallback(
    (idx) => {
      const links = (draft.links || []).filter((_, i) => i !== idx);
      patch({ links }, 'link');
    },
    [draft.links, patch],
  );

  // ---- Background ----
  const selectBg = useCallback(
    (idx) => patch({ backgroundIndex: idx }, 'bg'),
    [patch],
  );

  const delBg = useCallback(
    (idx) => {
      const backgrounds = (draft.backgrounds || []).filter((_, i) => i !== idx);
      let backgroundIndex = draft.backgroundIndex ?? 0;
      if (backgroundIndex >= backgrounds.length) backgroundIndex = 0;
      patch({ backgrounds, backgroundIndex }, 'bg');
    },
    [draft.backgrounds, draft.backgroundIndex, patch],
  );

  const addBg = useCallback(() => {
    const backgrounds = Array.isArray(draft.backgrounds) ? draft.backgrounds : [];
    patch(
      {
        backgrounds: [...backgrounds, { label: `Scene ${backgrounds.length + 1}` }],
        backgroundIndex: backgrounds.length,
      },
      'bg',
    );
  }, [draft.backgrounds, patch]);

  // ---- Hero ----
  const pickRampPhoto = useCallback(
    (url) => patch({ heroUrl: url }, 'hero'),
    [patch],
  );

  const onFileChosen = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setPendingImport(file);
  }, []);

  const confirmImport = useCallback(async () => {
    if (!pendingImport || !onUploadHero) return;
    const file = pendingImport;
    setPendingImport(null);
    markChanged('hero');
    await onUploadHero(file);
  }, [markChanged, onUploadHero, pendingImport]);

  const panelHead = (title) => (
    <div className="rel__panelHead">
      <button type="button" className="rel__back" onClick={back} aria-label="Back to edit menu">
        <ArrowLeft size={20} weight="bold" aria-hidden />
      </button>
      <h3 className="rel__panelTitle">{title}</h3>
    </div>
  );

  return (
    <div className="rel" role="dialog" aria-modal="true" aria-label="Edit post">
      {panel === 'menu' ? (
        <div className="rel__scroll">
          <div className="rel__panelHead">
            <button type="button" className="rel__back" onClick={onClose} aria-label="Close editor">
              <ArrowLeft size={20} weight="bold" aria-hidden />
            </button>
            <h3 className="rel__panelTitle">Edit Post</h3>
            <span className="rel__hint">Untouched = unchanged</span>
          </div>

          <button type="button" className="rel__btn" onClick={() => setPanel('caption')}>
            <span className="rel__rank">1</span><span className="rel__eic">✍️</span>
            <span className="rel__lab"><span className="rel__t">Caption</span><span className="rel__d">The hook. Edited most.</span></span>
            {stateChip('caption')}<span className="rel__car">›</span>
          </button>
          <button type="button" className="rel__btn" onClick={() => setPanel('hero')}>
            <span className="rel__rank">2</span><span className="rel__eic">🖼️</span>
            <span className="rel__lab"><span className="rel__t">Hero photo</span><span className="rel__d">RAMP photos + camera roll</span></span>
            {stateChip('hero')}<span className="rel__car">›</span>
          </button>
          <button type="button" className="rel__btn" onClick={() => setPanel('type')}>
            <span className="rel__rank">3</span><span className="rel__eic">🎭</span>
            <span className="rel__lab"><span className="rel__t">Post type</span><span className="rel__d">Curiosity · Pro · Hype · B/A</span></span>
            {stateChip('type')}<span className="rel__car">›</span>
          </button>
          <button type="button" className="rel__btn" onClick={() => setPanel('bg')}>
            <span className="rel__rank">4</span><span className="rel__eic">🌄</span>
            <span className="rel__lab"><span className="rel__t">Background / reference</span><span className="rel__d">Saved default + swap</span></span>
            {stateChip('bg')}<span className="rel__car">›</span>
          </button>
          <button type="button" className="rel__btn" onClick={() => setPanel('tags')}>
            <span className="rel__rank">5</span><span className="rel__eic">#️⃣</span>
            <span className="rel__lab"><span className="rel__t">Tags & attribution</span><span className="rel__d">Usually right from presets</span></span>
            {stateChip('tags')}<span className="rel__car">›</span>
          </button>
          <button type="button" className="rel__btn" onClick={() => setPanel('link')}>
            <span className="rel__rank">6</span><span className="rel__eic">🔗</span>
            <span className="rel__lab"><span className="rel__t">Referral link</span><span className="rel__d">Inherited — rarely changed</span></span>
            {stateChip('link')}<span className="rel__car">›</span>
          </button>

          {Object.keys(changed).length > 0 && (changed.type || changed.bg || changed.hero) ? (
            <button
              type="button"
              className="rel__cta"
              disabled={busy}
              onClick={() => onRegenerate?.({ source: 'edit' })}
            >
              {busy ? 'Regenerating…' : 'Regenerate poster'}
            </button>
          ) : null}
          <button type="button" className="rel__cta rel__cta--solid" onClick={onClose}>
            Done editing
          </button>
        </div>
      ) : null}

      {panel === 'caption' ? (
        <div className="rel__scroll">
          {panelHead('Caption')}
          <textarea
            className="rel__caption"
            maxLength={CAPTION_MAX}
            value={draft.caption || ''}
            onChange={(e) => patch({ caption: e.target.value }, 'caption')}
          />
          <div className="rel__caprow">
            <span className={`rel__capcount${captionLen > 2000 ? ' is-warn' : ''}`}>
              {captionLen} / {CAPTION_MAX}
            </span>
            <button
              type="button"
              className="rel__reset"
              onClick={() => {
                onDraftChange({ ...draft, caption: aiCaptionDraft });
                setChanged((p) => {
                  const n = { ...p };
                  delete n.caption;
                  return n;
                });
              }}
            >
              ↺ Reset to AI draft
            </button>
          </div>
          <p className="rel__help">Curiosity voice locked as default. Links &amp; hashtags stay attached.</p>
          <button type="button" className="rel__cta rel__cta--solid" onClick={back}>Apply</button>
        </div>
      ) : null}

      {panel === 'hero' ? (
        <div className="rel__scroll">
          {panelHead('Hero photo')}
          <div className="rel__tabs">
            <button type="button" className={heroTab === 'ramp' ? 'is-on' : ''} onClick={() => setHeroTab('ramp')}>⚡ RAMP photos</button>
            <button type="button" className={heroTab === 'roll' ? 'is-on' : ''} onClick={() => setHeroTab('roll')}>📱 Camera roll</button>
          </div>
          {heroTab === 'ramp' ? (
            <>
              <p className="rel__help">Captured through RAMP — attribution attached.</p>
              <div className="rel__grid">
                {rampPhotos.length === 0 ? (
                  <p className="rel__help">No RAMP photos on this post yet.</p>
                ) : (
                  rampPhotos.map((p) => (
                    <button
                      type="button"
                      key={p.url}
                      className={`rel__pic${draft.heroUrl === p.url ? ' is-sel' : ''}`}
                      style={{ backgroundImage: `url(${p.url})` }}
                      onClick={() => pickRampPhoto(p.url)}
                    >
                      <span className="rel__bdg">{p.badge}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <p className="rel__help">Your phone's photos — no RAMP attribution yet.</p>
              <button type="button" className="rel__cta" onClick={() => fileInputRef.current?.click()}>
                Choose from camera roll
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onFileChosen}
              />
            </>
          )}
          <button type="button" className="rel__cta rel__cta--solid" onClick={back}>Apply</button>
        </div>
      ) : null}

      {panel === 'type' ? (
        <div className="rel__scroll">
          {panelHead('Post type')}
          <div className="rel__seg">
            {RAMP_POST_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                className={draft.postType === t ? 'is-on' : ''}
                onClick={() => patch({ postType: t }, 'type')}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="rel__help">Curiosity is the locked default. Switching changes the caption template + layout.</p>
          <button type="button" className="rel__cta rel__cta--solid" onClick={back}>Apply</button>
        </div>
      ) : null}

      {panel === 'bg' ? (
        <div className="rel__scroll">
          {panelHead('Background')}
          <p className="rel__help">Saved default pre-selected. Subject is composited on top, undistorted.</p>
          <div className="rel__grid">
            {(draft.backgrounds || []).map((bg, idx) => (
              <button
                type="button"
                key={`${bg.label}-${idx}`}
                className={`rel__pic rel__pic--bg${draft.backgroundIndex === idx ? ' is-sel' : ''}`}
                style={bg.url ? { backgroundImage: `url(${bg.url})` } : undefined}
                onClick={() => selectBg(idx)}
              >
                <span className="rel__bdg">{bg.label}</span>
                <i
                  className="rel__pic-x"
                  onClick={(e) => { e.stopPropagation(); delBg(idx); }}
                  aria-hidden
                >×</i>
              </button>
            ))}
            <button type="button" className="rel__pic rel__pic--add" onClick={addBg}>+</button>
          </div>
          <button type="button" className="rel__cta rel__cta--solid" onClick={back}>Apply</button>
        </div>
      ) : null}

      {panel === 'tags' ? (
        <div className="rel__scroll">
          {panelHead('Tags & attribution')}
          <p className="rel__help">Tap a tag to toggle. × removes it. Add your own below.</p>
          <div className="rel__tagwrap">
            {(draft.tags || []).map((t, idx) => (
              <span
                key={`${t.label}-${idx}`}
                className={`rel__te${t.on ? ' is-on' : ''}`}
                onClick={() => toggleTag(idx)}
              >
                {t.label}
                <i className="rel__tag-x" onClick={(e) => { e.stopPropagation(); delTag(idx); }} aria-hidden>×</i>
              </span>
            ))}
          </div>
          <div className="rel__addrow">
            <input
              value={newTag}
              placeholder="#hashtag or @handle"
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTag(); }}
            />
            <button type="button" className="rel__add" onClick={addTag}>Add</button>
          </div>
          <button type="button" className="rel__cta rel__cta--solid" onClick={back}>Apply</button>
        </div>
      ) : null}

      {panel === 'link' ? (
        <div className="rel__scroll">
          {panelHead('Referral & links')}
          <p className="rel__help">Inherited from your profile. Edit, add product links, or remove.</p>
          {(draft.links || []).map((l, idx) => {
            const showBad = l.url.trim() !== '' && !isValidUrl(l.url);
            return (
              <div className="rel__linkitem" key={idx}>
                <input
                  className={`rel__linkinput${showBad ? ' is-bad' : ''}`}
                  value={l.url}
                  placeholder="https://product-link.com"
                  onChange={(e) => setLink(idx, e.target.value)}
                />
                {l.inherited ? <span className="rel__linktag">INHERITED</span> : (
                  <i className="rel__link-x" onClick={() => delLink(idx)} aria-hidden>×</i>
                )}
              </div>
            );
          })}
          <button type="button" className="rel__add rel__add--wide" onClick={addLink}>+ Add product link</button>
          <button type="button" className="rel__cta rel__cta--solid" onClick={back}>Apply</button>
        </div>
      ) : null}

      {pendingImport ? (
        <div className="rel__sheetDim" onClick={(e) => { if (e.target === e.currentTarget) setPendingImport(null); }}>
          <div className="rel__sheet">
            <div className="rel__sheetGrab" />
            <div className="rel__sheetIcon">🖼️</div>
            <h4 className="rel__sheetTitle">Attribute this photo?</h4>
            <p className="rel__warnLine">⚠ Imported photos have no RAMP lineage yet</p>
            <div className="rel__attr">
              <div className="rel__attrRow"><span>Client</span><span>{post?.recipientName || '—'}</span></div>
              <div className="rel__attrRow"><span>Stylist</span><span>{post?.stylistName || 'You'}</span></div>
              <div className="rel__attrRow"><span>Date</span><span>Today</span></div>
            </div>
            <p className="rel__help" style={{ textAlign: 'center' }}>
              Writes a permanent attribution record. Confirm only if it belongs to this client.
            </p>
            <button type="button" className="rel__cta rel__cta--solid" disabled={busy} onClick={() => void confirmImport()}>
              {busy ? 'Attributing…' : 'Attribute & use'}
            </button>
            <button type="button" className="rel__cta" onClick={() => setPendingImport(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
