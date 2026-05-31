/** Demo transport — native SMS / share / copy; no carrier API. Default ON. */
export const RAMP_DEMO_MODE_KEY = 'salonx.rampDemoMode';

export function isRampDemoMode() {
  if (typeof localStorage === 'undefined') return true;
  try {
    const raw = localStorage.getItem(RAMP_DEMO_MODE_KEY);
    if (raw === null) return true;
    return raw === '1' || raw === 'true';
  } catch {
    return true;
  }
}

export function subscribeRampDemoMode(onStoreChange) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onStoreChange();
  window.addEventListener('storage', handler);
  window.addEventListener('salonx-ramp-demo-mode', handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('salonx-ramp-demo-mode', handler);
  };
}

export function notifyRampDemoModeChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('salonx-ramp-demo-mode'));
  }
}

export function setRampDemoMode(enabled) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(RAMP_DEMO_MODE_KEY, enabled ? '1' : '0');
    notifyRampDemoModeChange();
  } catch {
    /* quota / private mode */
  }
}

export function firstNameFrom(fullName) {
  const first = String(fullName || '')
    .trim()
    .split(/\s+/)[0];
  return first || 'there';
}

/** Loop 1 — Client Care Card SMS (boss backup plan). */
export function buildClientCareCardSmsBody({ firstName, clientCardUrl }) {
  const name = firstNameFrom(firstName);
  const url = String(clientCardUrl || '').trim();
  const lead = `Hi ${name} — here's your Salon X client care card from today:`;
  if (!url) {
    return `${lead}\n\nReply with your selfie and I'll generate your RAMP post.`;
  }
  return `${lead} ${url}\n\nReply with your selfie and I'll generate your RAMP post.`;
}

/** Loop 2 — branded RAMP post share SMS/MMS (caption + link in text body). */
export function buildRampShareSmsBody({ caption, landingUrl }) {
  const text = String(caption || '').trim();
  const url = String(landingUrl || '').trim();
  if (text && url) return `${text}\n\n${url}`;
  if (url) return url;
  return text;
}

/** SMS text only — caption + POST IT link (never raw image URLs). */
export function buildRampSmsTextBody({ caption, landingUrl }) {
  return buildRampShareSmsBody({ caption, landingUrl });
}

/** @deprecated Use buildRampSmsTextBody — manual send never puts image URLs in SMS body. */
export function buildRampMmsSmsBody({ caption, landingUrl, imageUrl }) {
  return buildRampSmsTextBody({ caption, landingUrl });
}

export function normalizeSmsPhone(digits10) {
  const d = String(digits10 || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? d : '';
}

function isIosSmsDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** True when launched from Home Screen (installed PWA / standalone). */
export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
  } catch {
    /* matchMedia unsupported */
  }
  return typeof navigator !== 'undefined' && navigator.standalone === true;
}

/** Build platform-correct sms: href (iOS uses &body=, Android uses ?body=). */
export function buildSmsComposerHref(phoneDigits10, body) {
  const digits = normalizeSmsPhone(phoneDigits10);
  if (!digits) return '';
  const text = String(body || '').trim();
  if (!text) return `sms:+1${digits}`;
  const separator = isIosSmsDevice() ? '&' : '?';
  return `sms:+1${digits}${separator}body=${encodeURIComponent(text)}`;
}

/** Opens native Messages composer (manual send) — client number + message body prefilled. */
export function openSmsComposer(phoneDigits10, body) {
  const href = buildSmsComposerHref(phoneDigits10, body);
  if (!href) throw new Error('Valid 10-digit phone required');
  if (typeof window === 'undefined') return false;

  // Standalone PWA: location.href is the only reliable way to reach the sms: scheme
  // (a hidden <a> click is often swallowed by the installed app shell on iOS).
  if (isStandalonePwa()) {
    try {
      window.location.href = href;
      return true;
    } catch {
      /* fall through to anchor */
    }
  }

  const link = document.createElement('a');
  link.href = href;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

export async function copyToClipboard(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.setAttribute('readonly', '');
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

/**
 * Copy the RAMP post — image is the post; caption + link ride as text when supported.
 * Falls back to image-only or caption-only on older browsers.
 */
export async function copyRampPostToClipboard({
  caption,
  landingUrl,
  imageUrl,
  imageElement = null,
  imageFile = null,
}) {
  const text = buildRampShareSmsBody({ caption, landingUrl });
  const file =
    imageFile || (imageUrl ? await fetchRampImageFile(imageUrl, imageElement) : null);

  if (!file && !text) {
    throw new Error('RAMP post is still loading — wait for the poster, then try again.');
  }

  if (
    file &&
    typeof navigator !== 'undefined' &&
    typeof ClipboardItem !== 'undefined' &&
    navigator.clipboard?.write
  ) {
    const mime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
    const payloads = text
      ? [
          { [mime]: file, 'text/plain': new Blob([text], { type: 'text/plain' }) },
          { [mime]: file },
        ]
      : [{ [mime]: file }];

    for (const itemData of payloads) {
      try {
        const item = new ClipboardItem(itemData);
        if (navigator.clipboard.write.length >= 1) {
          await navigator.clipboard.write([item]);
          return {
            mode: text ? 'image_and_text' : 'image',
            note: text
              ? 'Post copied — image + caption ready to paste in Messages or social'
              : 'Image copied — paste in Messages',
          };
        }
      } catch {
        /* try next payload shape */
      }
    }
  }

  if (file && typeof navigator !== 'undefined' && navigator.clipboard?.write) {
    const mime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [mime]: file }),
      ]);
      return {
        mode: 'image',
        note: text
          ? 'Image copied — paste in Messages, then paste caption from COPY POST again if needed'
          : 'Image copied',
      };
    } catch {
      /* fall through */
    }
  }

  if (text) {
    await copyToClipboard(text);
    return {
      mode: 'text',
      note: 'Caption copied — this device could not copy the image; use DOWNLOAD or SEND · MESSAGES',
    };
  }

  throw new Error('Copy failed on this device');
}

export async function downloadImageUrl(url, filename = 'salonx-ramp.jpg') {
  const src = String(url || '').trim();
  if (!src) throw new Error('Image URL required');
  const res = await fetch(src);
  if (!res.ok) throw new Error('Could not download image');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export function formatSmsPhoneDisplay(digits10) {
  const d = normalizeSmsPhone(digits10);
  if (!d) return '';
  return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

async function blobToRampFile(blob) {
  if (!blob || blob.size === 0) return null;
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  return new File([blob], 'salonx-ramp.jpg', { type });
}

async function imageElementToRampFile(img) {
  if (!img?.complete || !img.naturalWidth) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        void blobToRampFile(blob).then(resolve);
      }, 'image/jpeg', 0.92);
    });
  } catch {
    return null;
  }
}

async function loadImageFileViaCanvas(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      void imageElementToRampFile(img).then(resolve);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function normalizeRampImageFetchUrl(url) {
  const src = String(url || '').trim();
  if (!src.includes('res.cloudinary.com') || !src.includes('/upload/')) return src;
  if (/\/upload\/[^/]*f_jpg/i.test(src)) return src;
  return src.replace('/upload/', '/upload/f_jpg,q_auto/');
}

async function fetchRampImageFile(imageUrl, imageElement) {
  const src = normalizeRampImageFetchUrl(imageUrl);
  if (!src) return null;

  if (imageElement) {
    const fromDom = await imageElementToRampFile(imageElement);
    if (fromDom) return fromDom;
  }

  try {
    const res = await fetch(src, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
    if (res.ok) {
      const file = await blobToRampFile(await res.blob());
      if (file) return file;
    }
  } catch {
    /* canvas fallback below */
  }

  return loadImageFileViaCanvas(src);
}

/** Warm image file while RAMP post is on screen (keeps share inside user gesture). */
export async function preloadRampImageFile(imageUrl, imageElement = null) {
  return fetchRampImageFile(imageUrl, imageElement);
}

async function shareRampMmsComposer({ file, body }) {
  if (!file || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }

  const payloads = body
    ? [{ files: [file], text: body }, { files: [file] }]
    : [{ files: [file] }];

  for (const payload of payloads) {
    if (navigator.canShare && !navigator.canShare(payload)) continue;
    try {
      await navigator.share(payload);
      return true;
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
    }
  }

  return false;
}

/**
 * Manual MMS — image file + text in Messages composer (no image URL in body).
 * Web Share runs first (before sms:) so media actually attaches in MMS.
 * Client number copied for the To: field when Messages does not prefill it.
 */
export async function openMessagesWithRampArtifact({
  phoneDigits10,
  caption,
  landingUrl,
  imageUrl,
  imageElement = null,
  imageFile = null,
}) {
  const phone = normalizeSmsPhone(phoneDigits10);
  if (!phone) {
    throw new Error('Client phone missing on this appointment.');
  }

  const file = imageFile || (imageUrl ? await fetchRampImageFile(imageUrl, imageElement) : null);
  if (!file) {
    throw new Error('RAMP image is still loading — wait for the poster, then try again.');
  }

  const smsBody = buildRampSmsTextBody({ caption, landingUrl });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      try {
        await copyToClipboard(`+1${phone}`);
      } catch {
        /* clipboard blocked */
      }

      const shared = await shareRampMmsComposer({ file, body: smsBody });
      if (shared) {
        return {
          method: 'messages_share',
          note: `Pick Messages — image + text load in MMS. Client ${formatSmsPhoneDisplay(phone)} copied for To: field. Tap Send.`,
        };
      }
    } catch (e) {
      if (e?.name === 'AbortError') return { method: 'cancelled' };
    }
  }

  openSmsComposer(phone, smsBody);
  return {
    method: 'sms_composer',
    note: `Messages opened with ${formatSmsPhoneDisplay(phone)} and text. Image attach needs iPhone/Android — use DOWNLOAD, then attach in Messages.`,
  };
}
