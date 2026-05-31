import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, WarningCircle } from 'phosphor-react';
import BottomToolbar from '../../component/BottomToolbar.jsx';
import RampRecipientField from '../../component/RampRecipientField.jsx';
import RampS5LoadingPanel from '../../component/RampS5LoadingPanel.jsx';
import RampS5ReadyHero from '../../component/RampS5ReadyHero.jsx';
import {
  fetchRampStatus,
  isRampApiAvailable,
  regenerateRampPost,
  sendRampSms,
  trackRampCopy,
  updateRampRecipient,
} from '../../data/rampApi.js';
import { isRampTokenLinkedToAppointment } from '../../data/rampAppointmentLink.js';
import { upsertRampQueueItem, loadRampQueue } from '../../data/rampQueueStore.js';
import {
  clearRampS5GenerationSession,
  ensureRampS5GenerationSession,
  getRampS5GenerationStartedAt,
  isRampS5ActiveStatus,
  markRampS5IntroShown,
  shouldUseRampS5ResumeMode,
} from '../../data/rampS5GenerationSession.js';
import {
  clearRampS5ReadyCache,
  readRampS5ReadyCache,
  writeRampS5ReadyCache,
} from '../../data/rampS5ReadyCache.js';
import {
  buildRampSmsTextBody,
  copyRampPostToClipboard,
  downloadImageUrl,
  normalizeSmsPhone,
  openMessagesWithRampArtifact,
  openSmsComposer,
  preloadRampImageFile,
} from '../../lib/rampDemoTransport.js';
import {
  readPersistedScreen2ClientPhone,
} from '../../data/appointmentStateStore.js';
import { resolveClientCarePhone } from '../../lib/demoLoginPhone.js';
import '../style/ramp-post-it.css';

function statusHeadline(status) {
  switch (String(status || '').trim()) {
    case 'pending':
      return 'Queued for generation';
    case 'generating':
    case 'processing':
      return 'Generating your RAMP';
    case 'ready':
      return 'RAMP ready';
    case 'failed':
      return 'Generation failed';
    case 'sent':
      return 'Sent to client';
    default:
      return 'RAMP';
  }
}

function queueHintForToken(token) {
  const key = String(token || '').trim();
  if (!key) return null;
  return loadRampQueue().find((row) => row.token === key || row.id === key) || null;
}

function initialRampS5State(token) {
  const cached = token ? readRampS5ReadyCache(token) : null;
  if (cached?.compositeUrl) {
    return { post: cached, phase: 'ready' };
  }
  const hint = queueHintForToken(token);
  if (hint && isRampS5ActiveStatus(hint.status)) {
    ensureRampS5GenerationSession(token);
    return {
      post: {
        recipientName: hint.title,
        status: hint.status,
      },
      phase: 'generating',
    };
  }
  if (token && shouldUseRampS5ResumeMode(token, hint?.status || 'generating')) {
    return { post: hint ? { recipientName: hint.title, status: hint.status } : null, phase: 'generating' };
  }
  return { post: null, phase: 'load' };
}

export default function RampScreen() {
  const { token: tokenParam } = useParams();
  const token = String(tokenParam || '').trim();
  const navigate = useNavigate();
  const location = useLocation();
  const isStandaloneQueuePost = useMemo(
    () => Boolean(token) && !isRampTokenLinkedToAppointment(token),
    [token],
  );

  const rampBoot = useMemo(() => initialRampS5State(token), [token]);
  const [post, setPost] = useState(() => rampBoot.post);
  const [phase, setPhase] = useState(() => rampBoot.phase);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeSendOption, setActiveSendOption] = useState(null);
  const artifactImgRef = useRef(null);
  const artifactFileRef = useRef(null);
  const artifactPreloadRef = useRef(null);
  const [artifactFileReady, setArtifactFileReady] = useState(false);
  const recipientDraftRef = useRef({ recipientName: '', recipientPhone: '' });
  const [recipientDraftPhone, setRecipientDraftPhone] = useState('');
  const phaseRef = useRef(phase);
  const postStatusRef = useRef(post?.status);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    postStatusRef.current = post?.status;
  }, [post?.status]);

  useEffect(() => {
    return () => {
      const status = String(postStatusRef.current || '').trim();
      if (
        phaseRef.current === 'load' ||
        phaseRef.current === 'generating' ||
        isRampS5ActiveStatus(status)
      ) {
        markRampS5IntroShown(token);
      }
    };
  }, [token]);

  useEffect(() => {
    const cached = readRampS5ReadyCache(token);
    if (cached?.compositeUrl) {
      setPost(cached);
      setPhase('ready');
    } else {
      const hint = queueHintForToken(token);
      ensureRampS5GenerationSession(token);
      if (hint && isRampS5ActiveStatus(hint.status)) {
        setPost((prev) => ({
          ...(prev && typeof prev === 'object' ? prev : {}),
          recipientName: hint.title || prev?.recipientName,
          status: hint.status,
        }));
        setPhase('generating');
      } else if (shouldUseRampS5ResumeMode(token, hint?.status)) {
        setPhase('generating');
      } else {
        setPost(null);
        setPhase('load');
      }
    }
    setError('');
    setSendNote('');
    setEditOpen(false);
    setArtifactFileReady(false);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setPhase('error');
      setError('Invalid RAMP token');
      return undefined;
    }
    if (!isRampApiAvailable()) {
      setPhase('error');
      setError('RAMP API is not configured');
      return undefined;
    }

    let cancelled = false;
    let pollId = null;
    let terminal = false;
    const POLL_MS = 800;

    const load = async () => {
      if (terminal) return;
      try {
        const data = await fetchRampStatus(token);
        if (cancelled) return;
        const row = data?.post;
        if (!row) {
          terminal = true;
          setPhase('error');
          setError('RAMP post not found');
          return;
        }
        setPost(row);
        const status = String(row.status || '').trim();
        upsertRampQueueItem({
          id: token,
          token,
          title: row.recipientName || row.recipientPhone || 'RAMP post',
          status,
        });
        if (status === 'sent') {
          terminal = true;
          clearRampS5GenerationSession(token);
          setPhase('sent_manually');
          return;
        }
        if (status === 'failed') {
          terminal = true;
          clearRampS5GenerationSession(token);
          clearRampS5ReadyCache(token);
          setPhase('failed');
          return;
        }
        if (status === 'ready' && row.compositeUrl) {
          writeRampS5ReadyCache(token, row);
          clearRampS5GenerationSession(token);
          terminal = true;
          setPhase('ready');
          return;
        }
        ensureRampS5GenerationSession(token);
        clearRampS5ReadyCache(token);
        setPost(row);
        setPhase('generating');
      } catch {
        if (cancelled) return;
        terminal = true;
        setPhase('error');
        setError('Could not load RAMP status');
      }
    };

    void load();
    pollId = window.setInterval(() => {
      if (terminal) return;
      void load();
    }, POLL_MS);

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
    };
  }, [token, reloadKey]);

  useEffect(() => {
    if (phase !== 'ready' || !post?.compositeUrl) {
      artifactFileRef.current = null;
      setArtifactFileReady(false);
      return undefined;
    }
    let cancelled = false;
    setArtifactFileReady(false);
    void preloadRampImageFile(post.compositeUrl, artifactPreloadRef.current || artifactImgRef.current).then((file) => {
      if (cancelled) return;
      artifactFileRef.current = file;
      setArtifactFileReady(Boolean(file));
    });
    return () => {
      cancelled = true;
    };
  }, [phase, post?.compositeUrl]);

  const warmArtifactFile = useCallback(() => {
    if (!post?.compositeUrl) return;
    void preloadRampImageFile(post.compositeUrl, artifactPreloadRef.current || artifactImgRef.current).then((file) => {
      artifactFileRef.current = file;
      setArtifactFileReady(Boolean(file));
    });
  }, [post?.compositeUrl]);

  const landingUrl = String(post?.landingUrl || '').trim();

  useEffect(() => {
    const phone = String(post?.recipientPhone || '').trim();
    recipientDraftRef.current = {
      recipientName: String(post?.recipientName || '').trim(),
      recipientPhone: phone,
    };
    setRecipientDraftPhone(phone);
  }, [post?.recipientName, post?.recipientPhone, token]);

  const handleRecipientDraftChange = useCallback((draft) => {
    const phone = String(draft?.recipientPhone || '').trim();
    recipientDraftRef.current = {
      recipientName: String(draft?.recipientName || '').trim(),
      recipientPhone: phone,
    };
    setRecipientDraftPhone(phone);
  }, []);

  const handleRecipientUpdated = useCallback((updatedPost) => {
    setPost((prev) => (prev ? { ...prev, ...updatedPost } : updatedPost));
    if (updatedPost?.recipientName || updatedPost?.recipientPhone) {
      upsertRampQueueItem({
        id: token,
        token,
        title:
          updatedPost.recipientName ||
          updatedPost.recipientPhone ||
          post?.recipientName ||
          post?.recipientPhone ||
          'RAMP post',
        status: String(updatedPost.status || post?.status || 'ready').trim(),
      });
    }
  }, [post?.recipientName, post?.recipientPhone, post?.status, token]);

  const resolveRecipientPhone = useCallback(() => {
    const draftPhone = normalizeSmsPhone(recipientDraftRef.current.recipientPhone || '');
    if (draftPhone) return draftPhone;
    const fromPost = normalizeSmsPhone(post?.recipientPhone || '');
    if (fromPost) return fromPost;
    if (!isStandaloneQueuePost) {
      return resolveClientCarePhone(readPersistedScreen2ClientPhone());
    }
    return '';
  }, [isStandaloneQueuePost, post?.recipientPhone]);

  const ensureRecipientBeforeSend = useCallback(async () => {
    const phone = resolveRecipientPhone();
    if (!phone) {
      throw new Error(
        'Enter a phone number under Send to (override) — type any number, then tap SEND · MESSAGES.',
      );
    }
    if (!isRampApiAvailable() || !token) return phone;

    const savedPhone = normalizeSmsPhone(post?.recipientPhone || '');
    const draftName = String(recipientDraftRef.current.recipientName || '').trim();
    if (phone === savedPhone && (!draftName || draftName === String(post?.recipientName || '').trim())) {
      return phone;
    }

    try {
      const result = await updateRampRecipient(token, {
        recipientPhone: phone,
        recipientName: draftName || post?.recipientName || undefined,
      });
      if (result?.post) {
        handleRecipientUpdated(result.post);
      }
    } catch (e) {
      console.warn('[ramp:recipient]', e);
    }
    return phone;
  }, [handleRecipientUpdated, post?.recipientName, post?.recipientPhone, resolveRecipientPhone, token]);

  const markQueueSentLocally = useCallback(() => {
    upsertRampQueueItem({
      id: token,
      token,
      title: post?.recipientName || post?.recipientPhone || 'RAMP post',
      status: 'sent',
    });
  }, [post?.recipientName, post?.recipientPhone, token]);

  const handleSendSms = useCallback(async () => {
    if (!token || sending) return;
    setActiveSendOption('text');
    setSending(true);
    setSendNote('');
    setError('');
    try {
      const phone = await ensureRecipientBeforeSend();
      if (post?.compositeUrl) {
        const result = await openMessagesWithRampArtifact({
          phoneDigits10: phone,
          caption: post?.caption || '',
          landingUrl,
          imageUrl: post.compositeUrl,
          imageElement: artifactPreloadRef.current || artifactImgRef.current,
          imageFile: artifactFileRef.current,
        });
        if (result.method === 'cancelled') return;
        setSendNote(result.note || 'Messages ready — tap Send manually');
      } else {
        const body = buildRampSmsTextBody({
          caption: post?.caption || '',
          landingUrl,
        });
        openSmsComposer(phone, body);
        setSendNote('Messages opened with client number + text — tap Send manually');
      }
      markQueueSentLocally();
      setPhase('sent_manually');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open Messages');
    } finally {
      setSending(false);
    }
  }, [
    ensureRecipientBeforeSend,
    landingUrl,
    post?.caption,
    post?.compositeUrl,
    markQueueSentLocally,
    sending,
    token,
  ]);

  const handleShareManual = useCallback(async () => {
    if (!post?.compositeUrl || sending) return;
    setActiveSendOption('messages');
    setSending(true);
    setError('');
    setSendNote('');
    try {
      const phone = await ensureRecipientBeforeSend();
      const result = await openMessagesWithRampArtifact({
        phoneDigits10: phone,
        caption: post?.caption || '',
        landingUrl,
        imageUrl: post.compositeUrl,
        imageElement: artifactPreloadRef.current || artifactImgRef.current,
        imageFile: artifactFileRef.current,
      });
      if (result.method === 'cancelled') return;
      setSendNote(result.note || 'Messages ready — tap Send manually');
      markQueueSentLocally();
      setPhase('sent_manually');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Share failed');
    } finally {
      setSending(false);
    }
  }, [landingUrl, post?.caption, post?.compositeUrl, ensureRecipientBeforeSend, markQueueSentLocally, sending]);

  const handleShareSalesmsg = useCallback(async () => {
    if (!token || sending) return;
    setActiveSendOption('salesmsg');
    setSending(true);
    setSendNote('');
    setError('');
    try {
      await ensureRecipientBeforeSend();
      const result = await sendRampSms(token);
      if (result?.sms?.mock) {
        setSendNote('Salesmsg mock — set RAMP_CARRIER_SMS_ENABLED=true for live MMS');
      } else {
        setSendNote('Sent via Salesmsg — MMS with image + text');
      }
      markQueueSentLocally();
      setPhase('sent_manually');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salesmsg send failed');
    } finally {
      setSending(false);
    }
  }, [ensureRecipientBeforeSend, markQueueSentLocally, sending, token]);

  const handleCopyPost = useCallback(async () => {
    setActiveSendOption('copy');
    try {
      const result = await copyRampPostToClipboard({
        caption: post?.caption || '',
        landingUrl,
        imageUrl: post?.compositeUrl || '',
        imageElement: artifactPreloadRef.current || artifactImgRef.current,
        imageFile: artifactFileRef.current,
      });
      void trackRampCopy(token, 'post_copy');
      setSendNote(result.note || 'Post copied');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Copy failed');
    }
  }, [landingUrl, post?.caption, post?.compositeUrl, token]);

  const handleDownload = useCallback(async () => {
    if (!post?.compositeUrl) return;
    setActiveSendOption('download');
    setError('');
    try {
      await downloadImageUrl(post.compositeUrl, `salonx-ramp-${token.slice(0, 8)}.jpg`);
      setSendNote('Image downloaded — attach in Messages if needed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    }
  }, [post?.compositeUrl, token]);

  const handleRegenerate = useCallback(async () => {
    if (!token || regenerating) return;
    setRegenerating(true);
    setError('');
    setSendNote('');
    try {
      const mediaUrl = String(post?.careCardUrl || '').trim();
      if (!mediaUrl) {
        throw new Error('No source photo saved — re-capture from RAMP first.');
      }
      await regenerateRampPost(token, {
        note: editNote.trim() || undefined,
        mediaUrl,
      });
      clearRampS5ReadyCache(token);
      ensureRampS5GenerationSession(token);
      setEditOpen(false);
      setEditNote('');
      setPost((prev) => (prev ? { ...prev, status: 'generating', compositeUrl: null } : prev));
      upsertRampQueueItem({
        id: token,
        token,
        title: post?.recipientName || post?.recipientPhone || 'RAMP post',
        status: 'generating',
      });
      setPhase('generating');
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setRegenerating(false);
    }
  }, [editNote, post?.careCardUrl, regenerating, token]);

  const handleEditToggle = useCallback(() => {
    if (regenerating) return;
    setEditOpen((open) => !open);
    setError('');
  }, [regenerating]);

  const handleBack = useCallback(() => {
    navigate('/screen1');
  }, [navigate]);

  const handleDone = useCallback(() => {
    navigate('/screen1', { replace: true });
  }, [navigate]);

  const showRecipientField =
    phase === 'generating' || phase === 'ready' || phase === 'failed';

  const sendPhoneReady = useMemo(() => {
    if (normalizeSmsPhone(recipientDraftPhone)) return true;
    if (normalizeSmsPhone(post?.recipientPhone || '')) return true;
    if (!isStandaloneQueuePost) {
      return Boolean(resolveClientCarePhone(readPersistedScreen2ClientPhone()));
    }
    return false;
  }, [isStandaloneQueuePost, post?.recipientPhone, recipientDraftPhone]);

  const displayClientName = String(post?.recipientName || '').trim();

  const loadingResumeMode = useMemo(
    () => shouldUseRampS5ResumeMode(token, post?.status),
    [token, post?.status],
  );

  const showLoadingPanel = phase === 'load' || phase === 'generating';

  return (
    <div className="ramp-post-it ramp-post-it--withNav">
      <header className="ramp-post-it__header">
        <button
          type="button"
          className="ramp-post-it__backBtn"
          onClick={handleBack}
          aria-label="Back to queue"
        >
          <ArrowLeft size={22} weight="bold" aria-hidden />
        </button>
        <div className="ramp-post-it__headerMeta">
          <span className="ramp-post-it__headerEyebrow">Salon X · S5</span>
          <span className="ramp-post-it__headerTitle">
            {displayClientName || 'RAMP Post'}
          </span>
        </div>
      </header>
      <div className="ramp-post-it__shell">
        {showLoadingPanel ? (
          <RampS5LoadingPanel
            key={token}
            status={post?.status}
            headline={statusHeadline(post?.status || (phase === 'load' ? 'pending' : 'generating'))}
            clientName={displayClientName}
            isInitialLoad={phase === 'load' && !loadingResumeMode}
            resumeMode={loadingResumeMode}
            generationStartedAt={getRampS5GenerationStartedAt(token)}
          >
            {showRecipientField ? (
              <RampRecipientField
                token={token}
                recipientName={post?.recipientName}
                recipientPhone={post?.recipientPhone}
                onUpdated={handleRecipientUpdated}
                onDraftChange={handleRecipientDraftChange}
              />
            ) : null}
          </RampS5LoadingPanel>
        ) : null}

        {phase === 'error' ? (
          <div className="ramp-post-it__panel ramp-post-it__panel--state">
            <div className="ramp-post-it__stateIcon ramp-post-it__stateIcon--error" aria-hidden>
              <WarningCircle size={32} weight="fill" />
            </div>
            <div className="ramp-post-it__eyebrow">Salon X · S5</div>
            <div className="ramp-post-it__title">RAMP unavailable</div>
            <p className="ramp-post-it__error">{error}</p>
            <button type="button" className="ramp-post-it__cta ramp-post-it__cta--ghost" onClick={handleBack}>
              Back to queue
            </button>
          </div>
        ) : null}

        {phase === 'failed' ? (
          <div className="ramp-post-it__panel ramp-post-it__panel--state">
            <div className="ramp-post-it__stateIcon ramp-post-it__stateIcon--error" aria-hidden>
              <WarningCircle size={32} weight="fill" />
            </div>
            <div className="ramp-post-it__eyebrow">Salon X · S5</div>
            <div className="ramp-post-it__title">Generation failed</div>
            <p className="ramp-post-it__copy">
              OpenAI could not finish this RAMP. Try again — or capture again from RAMP.
            </p>
            {error ? <p className="ramp-post-it__error">{error}</p> : null}
            {showRecipientField ? (
              <RampRecipientField
                token={token}
                recipientName={post?.recipientName}
                recipientPhone={post?.recipientPhone}
                onUpdated={handleRecipientUpdated}
                onDraftChange={handleRecipientDraftChange}
              />
            ) : null}
            {post?.careCardUrl ? (
              <button
                type="button"
                className="ramp-post-it__cta"
                disabled={regenerating}
                onClick={() => void handleRegenerate()}
              >
                {regenerating ? 'Regenerating…' : 'TRY AGAIN'}
              </button>
            ) : null}
            <button type="button" className="ramp-post-it__cta ramp-post-it__cta--ghost" onClick={handleBack}>
              Back to queue
            </button>
          </div>
        ) : null}

        {phase === 'ready' ? (
          <div className="ramp-post-it__panel ramp-post-it__panel--wide">
            <div className="ramp-post-it__title">Your RAMP is live</div>
            {post?.compositeUrl ? (
              <RampS5ReadyHero
                clientName={displayClientName}
                preparing={!artifactFileReady}
              >
                <img
                  ref={artifactPreloadRef}
                  src={post.compositeUrl}
                  alt=""
                  aria-hidden
                  crossOrigin="anonymous"
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: 'none',
                  }}
                  onLoad={warmArtifactFile}
                />
                <div className="ramp-post-it__artifactWrap">
                  <img
                    ref={artifactImgRef}
                    className="ramp-post-it__artifact"
                    src={post.compositeUrl}
                    alt="Generated RAMP look"
                    onLoad={warmArtifactFile}
                  />
                </div>
              </RampS5ReadyHero>
            ) : null}
            {post?.caption ? (
              <pre className="ramp-post-it__caption">{post.caption}</pre>
            ) : null}
            {showRecipientField ? (
              <RampRecipientField
                token={token}
                recipientName={post?.recipientName}
                recipientPhone={post?.recipientPhone}
                onUpdated={handleRecipientUpdated}
                onDraftChange={handleRecipientDraftChange}
              />
            ) : null}
            <p className="ramp-post-it__scrollHint">Scroll for options ↓</p>
            {error ? <p className="ramp-post-it__error">{error}</p> : null}
            {sendNote ? <p className="ramp-post-it__copyNote">{sendNote}</p> : null}
            <div className="ramp-post-it__actionStack">
              <button
                type="button"
                className={`ramp-post-it__cta${activeSendOption === 'messages' ? ' ramp-post-it__cta--selected' : ''}`}
                disabled={sending || !artifactFileReady || !sendPhoneReady}
                onClick={() => void handleShareManual()}
              >
                {sending
                  ? 'Opening Messages…'
                  : !artifactFileReady
                    ? 'PREPARING IMAGE…'
                    : !sendPhoneReady
                      ? 'ADD PHONE TO SEND'
                      : 'SEND · MESSAGES'}
              </button>
              <button
                type="button"
                className={`ramp-post-it__cta ramp-post-it__cta--ghost${activeSendOption === 'salesmsg' ? ' ramp-post-it__cta--selected' : ''}`}
                disabled={sending}
                onClick={() => void handleShareSalesmsg()}
              >
                SALESMSG · BACKEND
              </button>
              <button
                type="button"
                className={`ramp-post-it__cta ramp-post-it__cta--ghost${activeSendOption === 'text' ? ' ramp-post-it__cta--selected' : ''}`}
                disabled={sending || !sendPhoneReady}
                onClick={() => void handleSendSms()}
              >
                TEXT ONLY
              </button>
              <button
                type="button"
                className={`ramp-post-it__cta ramp-post-it__cta--ghost${activeSendOption === 'copy' ? ' ramp-post-it__cta--selected' : ''}`}
                disabled={sending || !artifactFileReady}
                onClick={() => void handleCopyPost()}
              >
                COPY POST
              </button>
              <button
                type="button"
                className={`ramp-post-it__cta ramp-post-it__cta--ghost${activeSendOption === 'download' ? ' ramp-post-it__cta--selected' : ''}`}
                onClick={() => void handleDownload()}
              >
                DOWNLOAD
              </button>
              <button
                type="button"
                className="ramp-post-it__cta ramp-post-it__cta--ghost"
                disabled={regenerating}
                onClick={handleEditToggle}
                aria-expanded={editOpen}
              >
                EDIT · REGENERATE
              </button>
              {editOpen ? (
                <div className="ramp-post-it__editBlock">
                  <label className="ramp-post-it__editLabel" htmlFor="ramp-edit-note">
                    Not perfect? Tell the AI what to change (optional)
                  </label>
                  <textarea
                    id="ramp-edit-note"
                    className="ramp-post-it__editInput"
                    rows={3}
                    maxLength={400}
                    value={editNote}
                    disabled={regenerating}
                    placeholder="e.g. brighter green hair, bigger headline, darker background, keep the faces"
                    onChange={(e) => setEditNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="ramp-post-it__cta"
                    disabled={regenerating}
                    onClick={() => void handleRegenerate()}
                  >
                    {regenerating ? 'Regenerating…' : 'REGENERATE POSTER'}
                  </button>
                </div>
              ) : null}
            </div>
            <button type="button" className="ramp-post-it__cta ramp-post-it__cta--ghost" onClick={handleBack}>
              Back to queue
            </button>
          </div>
        ) : null}

        {phase === 'sent_manually' ? (
          <div className="ramp-post-it__panel ramp-post-it__panel--state">
            <div className="ramp-post-it__stateIcon ramp-post-it__stateIcon--success" aria-hidden>
              <CheckCircle size={36} weight="fill" />
            </div>
            <div className="ramp-post-it__eyebrow">Salon X · S5</div>
            <div className="ramp-post-it__title">Sent to Messages</div>
            <p className="ramp-post-it__copy ramp-post-it__copy--center">
              {sendNote || 'Finish sending from Messages — tap Send when ready.'}
            </p>
            <button type="button" className="ramp-post-it__cta" onClick={handleDone}>
              Back to queue
            </button>
          </div>
        ) : null}
      </div>
      <BottomToolbar activeIndex={2} originPath={location.pathname} />
    </div>
  );
}
