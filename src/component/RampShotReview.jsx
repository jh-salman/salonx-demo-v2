import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Lightning, X } from 'phosphor-react';
import {
  isRampApiAvailable,
  parkRampPick,
  startRampPost,
  submitRampCapture,
  uploadRampMedia,
} from '../data/rampApi.js';
import { upsertRampQueueItem, syncRampQueueFromApi } from '../data/rampQueueStore.js';
import '../presentation/style/ramp-shot-review.css';

/**
 * S4 multi-shot review — snap/add a few quick shots at checkout, then either
 * pick a hero (→ generating) or save them all for later (→ pending_pick, a
 * "Pick a photo" card in the queue). Closing without acting parks nothing.
 */
export default function RampShotReview({
  open,
  accent,
  clientName = '',
  clientPhone = '',
  appointmentId = null,
  stylistName = '',
  onPicked,
  onParked,
  onClose,
}) {
  const [shots, setShots] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const tokenRef = useRef('');

  useEffect(() => {
    if (open) return undefined;
    return () => {
      shots.forEach((s) => {
        if (s.url.startsWith('blob:')) URL.revokeObjectURL(s.url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) {
      setShots([]);
      setBusy('');
      setError('');
      tokenRef.current = '';
    }
  }, [open]);

  const title = String(clientName || 'RAMP post').trim() || 'RAMP post';

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []).filter((f) => f && f.type.startsWith('image/'));
    if (!files.length) return;
    setError('');
    setShots((prev) =>
      [
        ...prev,
        ...files.map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          url: URL.createObjectURL(file),
        })),
      ].slice(0, 8),
    );
  }, []);

  const removeShot = useCallback((id) => {
    setShots((prev) => {
      const hit = prev.find((s) => s.id === id);
      if (hit?.url.startsWith('blob:')) URL.revokeObjectURL(hit.url);
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const ensureToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current;
    if (!isRampApiAvailable()) throw new Error('RAMP API is not configured');
    const data = await startRampPost({
      recipientName: title,
      recipientPhone: String(clientPhone || '').trim(),
      appointmentId: appointmentId ?? null,
      stylistName: String(stylistName || '').trim(),
      captureType: 'photo',
    });
    const token = String(data?.token || '').trim();
    if (!token) throw new Error('Could not start RAMP post');
    tokenRef.current = token;
    return token;
  }, [appointmentId, clientPhone, stylistName, title]);

  const pickHero = useCallback(
    async (shot) => {
      if (busy) return;
      setBusy(shot.id);
      setError('');
      try {
        const token = await ensureToken();
        const mediaUrl = await uploadRampMedia(shot.file);
        const result = await submitRampCapture({
          token,
          mediaUrl,
          phone: String(clientPhone || '').trim() || undefined,
          source: 'ramp_photo',
        });
        upsertRampQueueItem({
          id: token,
          token,
          title,
          status: result?.status || 'generating',
        });
        try {
          await syncRampQueueFromApi();
        } catch {
          /* local queue already updated */
        }
        onPicked?.(token);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not queue that shot.');
      } finally {
        setBusy('');
      }
    },
    [busy, clientPhone, ensureToken, onPicked, title],
  );

  const saveForLater = useCallback(async () => {
    if (busy || !shots.length) return;
    setBusy('park');
    setError('');
    try {
      const token = await ensureToken();
      const urls = [];
      for (const shot of shots) {
        // Sequential upload keeps memory low on phones with many shots.
        // eslint-disable-next-line no-await-in-loop
        urls.push(await uploadRampMedia(shot.file));
      }
      await parkRampPick(token, urls, String(clientPhone || '').trim() || undefined);
      upsertRampQueueItem({ id: token, token, title, status: 'pending_pick' });
      try {
        await syncRampQueueFromApi();
      } catch {
        /* local queue already updated */
      }
      onParked?.(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save these shots.');
    } finally {
      setBusy('');
    }
  }, [busy, clientPhone, ensureToken, onParked, shots, title]);

  if (!open) return null;

  return (
    <div
      className="ramp-shots"
      style={{ ['--ramp-shots-accent']: accent }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div className="ramp-shots__sheet" role="dialog" aria-modal="true" aria-label="Review shots">
        <button
          type="button"
          className="ramp-shots__grab"
          onClick={() => !busy && onClose?.()}
          aria-label="Close"
        />
        <div className="ramp-shots__bolt" aria-hidden>
          <Lightning size={24} weight="fill" />
        </div>
        <div className="ramp-shots__title">Review the moment</div>
        <p className="ramp-shots__sub">
          Snap a few, then tap a winner — or save them all and pick later.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="ramp-shots__fileInput"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div className="ramp-shots__grid">
          {shots.map((shot) => (
            <div className="ramp-shots__cell" key={shot.id}>
              <img src={shot.url} alt="" />
              <button
                type="button"
                className="ramp-shots__remove"
                aria-label="Remove shot"
                disabled={Boolean(busy)}
                onClick={() => removeShot(shot.id)}
              >
                <X size={13} weight="bold" aria-hidden />
              </button>
              <button
                type="button"
                className="ramp-shots__use"
                disabled={Boolean(busy)}
                onClick={() => void pickHero(shot)}
              >
                {busy === shot.id ? 'Queuing…' : 'Use this'}
              </button>
            </div>
          ))}
          {shots.length < 8 ? (
            <button
              type="button"
              className="ramp-shots__add"
              disabled={Boolean(busy)}
              onClick={() => fileRef.current?.click()}
            >
              <Plus size={22} weight="bold" aria-hidden />
              <span>{shots.length ? 'Add' : 'Add shots'}</span>
            </button>
          ) : null}
        </div>

        {error ? <p className="ramp-shots__error">{error}</p> : null}

        <div className="ramp-shots__dock">
          <button
            type="button"
            className="ramp-shots__later"
            disabled={Boolean(busy) || !shots.length}
            onClick={() => void saveForLater()}
          >
            {busy === 'park' ? 'Saving…' : 'Save for later — pick a photo in the queue'}
          </button>
          <button
            type="button"
            className="ramp-shots__skip"
            disabled={Boolean(busy)}
            onClick={() => onClose?.()}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
