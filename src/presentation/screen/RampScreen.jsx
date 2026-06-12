import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, WarningCircle } from 'phosphor-react';
import BottomToolbar from '../../component/BottomToolbar.jsx';
import RampRecipientField from '../../component/RampRecipientField.jsx';
import RampS5LoadingPanel from '../../component/RampS5LoadingPanel.jsx';
import RampS5ReadyHero from '../../component/RampS5ReadyHero.jsx';
import RampEditLayer from '../../component/RampEditLayer.jsx';
import {
  fetchRampCandidates,
  fetchRampStatus,
  isRampApiAvailable,
  regenerateRampPost,
  sendRampSms,
  submitRampCapture,
  trackRampCopy,
  updateRampRecipient,
  uploadRampMedia,
} from '../../data/rampApi.js';
import { isRampTokenLinkedToAppointment } from '../../data/rampAppointmentLink.js';
import { upsertRampQueueItem, loadRampQueue } from '../../data/rampQueueStore.js';
import { writeRampPostMeta } from '../../data/rampPostMetaStore.js';
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

const RAMP_POST_TYPE_DIRECTIVES = {
  Professional: 'Editorial / professional tone — clean studio framing, salon-pro polish.',
  'Hype / Event': 'High-energy hype/event vibe — bold headline, vibrant accent, movement.',
  'Before / After': 'Before / after reveal layout — split or sequence showing transformation.',
};

function buildEditDraft(post) {
  const landing = String(post?.landingUrl || '').trim();
  const caption = String(post?.caption || '').trim();
  const tags = Array.isArray(post?.tags)
    ? post.tags
        .map((t) => String(t || '').trim())
        .filter(Boolean)
        .map((label) => ({ label, on: true }))
    : [];
  const links = [];
  if (landing) links.push({ url: landing, inherited: true });
  if (Array.isArray(post?.links)) {
    post.links
      .map((l) => String(l || '').trim())
      .filter((u) => u && u !== landing)
      .forEach((url) => links.push({ url, inherited: false }));
  }
  return {
    caption,
    aiCaptionDraft: caption,
    tags,
    links,
    postType: 'Curiosity',
    backgrounds: [{ label: 'Saved default', url: String(post?.backgroundPosterUrl || '').trim() }],
    backgroundIndex: 0,
    heroUrl: String(post?.careCardUrl || '').trim(),
  };
}

function composeOutboundCaption(draft) {
  if (!draft) return '';
  const parts = [String(draft.caption || '').trim()];
  const tagLine = (draft.tags || [])
    .filter((t) => t.on)
    .map((t) => t.label)
    .join(' ')
    .trim();
  if (tagLine) parts.push(tagLine);
  const linkLines = (draft.links || [])
    .map((l) => String(l.url || '').trim())
    .filter(Boolean);
  return [...parts, ...linkLines].filter(Boolean).join('\n\n');
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
  const [editLayerOpen, setEditLayerOpen] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const draftSeededTokenRef = useRef(null);
  const [regenerating, setRegenerating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [pickBusy, setPickBusy] = useState('');
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
    setEditLayerOpen(false);
    setEditDraft(null);
    draftSeededTokenRef.current = null;
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
        if (status === 'pending_pick') {
          terminal = true;
          clearRampS5GenerationSession(token);
          clearRampS5ReadyCache(token);
          setPhase('pick');
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
    if (phase !== 'ready' || !post?.compositeUrl) return;
    if (draftSeededTokenRef.current === token) return;
    draftSeededTokenRef.current = token;
    setEditDraft(buildEditDraft(post));
  }, [phase, post, token]);

  const outboundCaption = useMemo(
    () => (editDraft ? composeOutboundCaption(editDraft) : String(post?.caption || '')),
    [editDraft, post?.caption],
  );

  const previewCaption = editDraft ? String(editDraft.caption || '') : String(post?.caption || '');

  useEffect(() => {
    if (!token || !editDraft?.postType) return;
    writeRampPostMeta(token, { postType: editDraft.postType });
  }, [token, editDraft?.postType]);

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
          caption: outboundCaption,
          landingUrl,
          imageUrl: post.compositeUrl,
          imageElement: artifactPreloadRef.current || artifactImgRef.current,
          imageFile: artifactFileRef.current,
        });
        if (result.method === 'cancelled') return;
        setSendNote(result.note || 'Messages ready — tap Send manually');
      } else {
        const body = buildRampSmsTextBody({
          caption: outboundCaption,
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
    outboundCaption,
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
        caption: outboundCaption,
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
  }, [landingUrl, outboundCaption, post?.compositeUrl, ensureRecipientBeforeSend, markQueueSentLocally, sending]);

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
        caption: outboundCaption,
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
  }, [landingUrl, outboundCaption, post?.compositeUrl, token]);

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

  const enterRegeneratingPhase = useCallback(() => {
    clearRampS5ReadyCache(token);
    ensureRampS5GenerationSession(token);
    setPost((prev) => (prev ? { ...prev, status: 'generating', compositeUrl: null } : prev));
    upsertRampQueueItem({
      id: token,
      token,
      title: post?.recipientName || post?.recipientPhone || 'RAMP post',
      status: 'generating',
    });
    setPhase('generating');
    setReloadKey((k) => k + 1);
  }, [post?.recipientName, post?.recipientPhone, token]);

  useEffect(() => {
    if (phase !== 'pick' || !token) return undefined;
    let cancelled = false;
    setCandidatesLoading(true);
    fetchRampCandidates(token)
      .then((res) => {
        if (!cancelled) setCandidates(Array.isArray(res?.candidates) ? res.candidates : []);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setCandidatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [phase, token]);

  const handlePickCandidate = useCallback(
    async (mediaUrl) => {
      const url = String(mediaUrl || '').trim();
      if (!token || pickBusy || !url) return;
      setPickBusy(url);
      setError('');
      try {
        await submitRampCapture({ token, mediaUrl: url, source: 'pending_pick_hero' });
        enterRegeneratingPhase();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not pick that photo');
      } finally {
        setPickBusy('');
      }
    },
    [enterRegeneratingPhase, pickBusy, token],
  );

  const handleRegenerateFromEdit = useCallback(async () => {
    if (!token || regenerating || !editDraft) return;
    setRegenerating(true);
    setError('');
    setSendNote('');
    try {
      const mediaUrl = String(editDraft.heroUrl || post?.careCardUrl || '').trim();
      if (!mediaUrl) {
        throw new Error('No source photo saved — re-capture from RAMP first.');
      }
      const directives = [];
      const typeNote = RAMP_POST_TYPE_DIRECTIVES[editDraft.postType];
      if (typeNote) directives.push(typeNote);
      const bg = (editDraft.backgrounds || [])[editDraft.backgroundIndex ?? 0];
      if (bg?.label && bg.label !== 'Saved default') {
        directives.push(`Background reference: ${bg.label}.`);
      }
      await regenerateRampPost(token, {
        note: directives.join(' ') || undefined,
        mediaUrl,
      });
      setEditLayerOpen(false);
      enterRegeneratingPhase();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setRegenerating(false);
    }
  }, [editDraft, enterRegeneratingPhase, post?.careCardUrl, regenerating, token]);

  const handleUploadHero = useCallback(async (file) => {
    if (!token || regenerating || !file) return;
    setRegenerating(true);
    setError('');
    setSendNote('');
    try {
      const mediaUrl = await uploadRampMedia(file);
      setEditDraft((prev) => (prev ? { ...prev, heroUrl: mediaUrl } : prev));
      await submitRampCapture({ token, mediaUrl, source: 'hero-swap' });
      setEditLayerOpen(false);
      enterRegeneratingPhase();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo import failed');
    } finally {
      setRegenerating(false);
    }
  }, [enterRegeneratingPhase, regenerating, token]);

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
            {previewCaption ? (
              <pre className="ramp-post-it__caption">{previewCaption}</pre>
            ) : null}
            {editDraft && (editDraft.tags || []).some((t) => t.on) ? (
              <div className="ramp-post-it__chipRow">
                {editDraft.tags.filter((t) => t.on).map((t, i) => (
                  <span key={`${t.label}-${i}`} className="ramp-post-it__chip">{t.label}</span>
                ))}
              </div>
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
                disabled={regenerating || !editDraft}
                onClick={() => { setEditLayerOpen(true); setError(''); }}
              >
                ✎ EDIT THIS POST
              </button>
            </div>
            <button type="button" className="ramp-post-it__cta ramp-post-it__cta--ghost" onClick={handleBack}>
              Back to queue
            </button>
          </div>
        ) : null}

        {phase === 'pick' ? (
          <div className="ramp-post-it__panel ramp-post-it__panel--wide">
            <div className="ramp-post-it__eyebrow">Salon X · S5</div>
            <div className="ramp-post-it__title">Pick a photo</div>
            <p className="ramp-post-it__copy">
              You parked these at checkout. Tap the winner to build the post.
            </p>
            {error ? <p className="ramp-post-it__error">{error}</p> : null}
            {candidatesLoading ? (
              <p className="ramp-post-it__copy ramp-post-it__copy--center">Loading shots…</p>
            ) : candidates.length === 0 ? (
              <p className="ramp-post-it__copy ramp-post-it__copy--center">
                No parked shots found — recapture from RAMP.
              </p>
            ) : (
              <div className="ramp-post-it__pickGrid">
                {candidates.map((c, i) => (
                  <button
                    type="button"
                    key={`${c.mediaUrl}-${i}`}
                    className="ramp-post-it__pickCell"
                    disabled={Boolean(pickBusy)}
                    onClick={() => void handlePickCandidate(c.mediaUrl)}
                  >
                    <img src={c.mediaUrl} alt="" loading="lazy" />
                    <span className="ramp-post-it__pickLabel">
                      {pickBusy === c.mediaUrl ? 'Building…' : 'Use this'}
                    </span>
                  </button>
                ))}
              </div>
            )}
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

        {phase === 'ready' && editLayerOpen && editDraft ? (
          <RampEditLayer
            post={post}
            draft={editDraft}
            onDraftChange={setEditDraft}
            onClose={() => setEditLayerOpen(false)}
            onRegenerate={() => void handleRegenerateFromEdit()}
            onUploadHero={handleUploadHero}
            busy={regenerating}
          />
        ) : null}
      </div>
      <BottomToolbar activeIndex={2} originPath={location.pathname} />
    </div>
  );
}
