import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowUp,
  Camera,
  Lightning,
  MagnifyingGlass,
  Plus,
} from "phosphor-react";
import { upsertRampQueueItem, syncRampQueueFromApi } from "../../data/rampQueueStore.js";
import {
  isRampApiAvailable,
  startRampPost,
  submitRampCapture,
  uploadRampMedia,
} from "../../data/rampApi.js";
import { MOCK_CLIENTS } from "../../data/mockClients";
import {
  CLIENTS_CATALOG_UPDATED,
  getCachedClientsCatalog,
  refreshClientsCatalogCache,
} from "../../data/clientProfileAvatar";
import { syncSalonxShellHeight } from "../../layout/viewportShellSync.js";
import "../style/ramp-bolt.css";

const CLIENTS_EXTRA_KEY = "@salonx/clientsExtra/v1";
const RAMP_CACHED_ASSETS_KEY = "@salonx/ramp/cached-assets/v1";
const LEGACY_RAMP_REFERENCE_KEY = "@salonx/ramp/reference-poster/v1";

const EMPTY_CACHED_ASSETS = {
  backgroundPosterUrl: "",
  stylistStyleReferenceUrl: "",
  clientStyleReferenceUrl: "",
};

function loadPersistedCachedAssets() {
  if (typeof window === "undefined") return { ...EMPTY_CACHED_ASSETS };
  try {
    const raw = window.localStorage.getItem(RAMP_CACHED_ASSETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        backgroundPosterUrl: String(parsed?.backgroundPosterUrl || "").trim(),
        stylistStyleReferenceUrl: String(parsed?.stylistStyleReferenceUrl || "").trim(),
        clientStyleReferenceUrl: String(parsed?.clientStyleReferenceUrl || "").trim(),
      };
    }
    const legacy = String(window.localStorage.getItem(LEGACY_RAMP_REFERENCE_KEY) || "").trim();
    if (legacy) {
      const migrated = { ...EMPTY_CACHED_ASSETS, stylistStyleReferenceUrl: legacy };
      window.localStorage.setItem(RAMP_CACHED_ASSETS_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    /* private mode */
  }
  return { ...EMPTY_CACHED_ASSETS };
}

function persistCachedAssets(assets) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RAMP_CACHED_ASSETS_KEY, JSON.stringify(assets));
  } catch {
    /* private mode */
  }
}

const CACHED_ASSET_SLOTS = [
  {
    id: "background",
    field: "backgroundPosterUrl",
    label: "Background",
    hint: "Scene + text, no people — save once",
  },
  {
    id: "stylist",
    field: "stylistStyleReferenceUrl",
    label: "Stylist Style Ref",
    hint: "2-person example — finish guide only",
  },
  {
    id: "client",
    field: "clientStyleReferenceUrl",
    label: "Client Style Ref",
    hint: "1-person example — finish guide only",
  },
];

function loadExtraClients() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLIENTS_EXTRA_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Real client directory: `/api/clients` catalog + locally-added clients; MOCK only as a last resort. */
function mergeClientDirectory(catalog, extra) {
  const map = new Map();
  const base = Array.isArray(catalog) && catalog.length ? catalog : MOCK_CLIENTS;
  base.forEach((c) => {
    if (c?.name) map.set(String(c.name).trim().toLowerCase(), c);
  });
  extra.forEach((c) => {
    if (c?.name) map.set(String(c.name).trim().toLowerCase(), c);
  });
  return Array.from(map.values());
}

const CAPTURE_TYPES = [
  { id: "photo", label: "PHOTO" },
  { id: "upload", label: "UPLOAD" },
  { id: "selfie", label: "CLIENT SELFIE" },
  { id: "reel", label: "REEL", note: true },
];

const DEFAULT_TAGS = ["#DangerJones", "#PremiereOrlando", "#PremierHairShow"];
const DEFAULT_LINK = "https://dangerjonescreative.com/";

function formatRampError(err, fallback = "Something went wrong. Try again.") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  const name = String(err?.name || "");
  const msg = String(err?.message || "").trim();

  if (name === "NotAllowedError" || /permission denied/i.test(msg)) {
    return "Camera permission denied. Allow camera in Settings, or tap Upload (↑).";
  }
  if (name === "NotFoundError" || /requested device not found/i.test(msg)) {
    return "No camera found. Tap Upload (↑) to choose a photo.";
  }
  if (name === "NotReadableError" || /could not start video source/i.test(msg)) {
    return "Camera is busy. Close other apps using the camera, then retry.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Network error. Check connection and try again.";
  }
  if (/upload failed|cloudinary|missing url/i.test(msg)) {
    return "Photo upload failed. Try again or pick a smaller image.";
  }
  if (/start-post|store-shared-selfie|ramp server/i.test(msg)) {
    return "RAMP server unavailable. You can still queue locally.";
  }
  if (msg) return msg.length > 140 ? `${msg.slice(0, 140)}…` : msg;
  return fallback;
}

function mintRampToken() {
  return `ramp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * RAMP bolt-tap overlay — ENTRY → CAPTURE → PREVIEW (NUCLEAR 7 stylist path).
 */
function RampBoltOverlayView({
  open,
  onClose,
  onBypass,
  onGenerationQueued,
  clientName = "",
  clientPhone = "",
  hideClientNameInput = false,
  requireClientName = false,
  appointmentId = null,
  stylistName = "",
  products = [],
  accent,
}) {
  const [phase, setPhase] = useState("entry");
  const [cachedAssets, setCachedAssets] = useState(() => loadPersistedCachedAssets());
  const [uploadingSlot, setUploadingSlot] = useState("");
  const [captureType, setCaptureType] = useState("photo");
  const [clientQuery, setClientQuery] = useState(() => String(clientName || "").trim());
  const [extraNote, setExtraNote] = useState("");
  const [clientPhoneLocal, setClientPhoneLocal] = useState(() => String(clientPhone || "").trim());
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientDirectory, setClientDirectory] = useState(() =>
    mergeClientDirectory(getCachedClientsCatalog(), loadExtraClients()),
  );
  const [previewUrl, setPreviewUrl] = useState("");
  const [rampToken, setRampToken] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const uploadInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const stylistRefInputRef = useRef(null);
  const clientRefInputRef = useRef(null);
  const cachedInputRefs = {
    background: backgroundInputRef,
    stylist: stylistRefInputRef,
    client: clientRefInputRef,
  };
  const captureFileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rampRootRef = useRef(null);
  const entryScrollRef = useRef(null);
  const clientNameFieldRef = useRef(null);
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [cameraLive, setCameraLive] = useState(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPhase("entry");
    setCachedAssets(loadPersistedCachedAssets());
    setUploadingSlot("");
    setCaptureType("photo");
    setClientQuery(String(clientName || "").trim());
    setExtraNote("");
    setClientPhoneLocal(String(clientPhone || "").trim());
    setClientPickerOpen(false);
    setRampToken("");
    setStarting(false);
    setSubmitting(false);
    setSubmitError("");
    setCaptureError("");
    captureFileRef.current = null;
    setCameraFacing("environment");
    setCameraLive(false);
    setCameraError("");
    setCapturing(false);
    setPreviewUrl((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return "";
    });
  }, [open, clientName, clientPhone]);

  const resolvedClientPhone = String(clientPhoneLocal || clientPhone || "").trim();
  const resolvedRecipientName = hideClientNameInput
    ? String(clientName || "").trim()
    : String(clientQuery || "").trim();

  const ensureClientNameReady = useCallback(() => {
    if (!requireClientName) return true;
    if (resolvedRecipientName) return true;
    setSubmitError("Client name is required.");
    return false;
  }, [requireClientName, resolvedRecipientName]);

  // Keep the picker stocked with real client data (catalog + locally added).
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const sync = () => {
      if (!cancelled) {
        setClientDirectory(
          mergeClientDirectory(getCachedClientsCatalog(), loadExtraClients()),
        );
      }
    };
    sync();
    void refreshClientsCatalogCache()
      .then(() => sync())
      .catch(() => {});
    window.addEventListener(CLIENTS_CATALOG_UPDATED, sync);
    return () => {
      cancelled = true;
      window.removeEventListener(CLIENTS_CATALOG_UPDATED, sync);
    };
  }, [open]);

  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    if (!q) return clientDirectory;
    return clientDirectory.filter(
      (c) =>
        String(c.name || "").toLowerCase().includes(q) ||
        (digits && String(c.phone || "").replace(/\D/g, "").includes(digits)),
    );
  }, [clientQuery, clientDirectory]);

  const handleSelectClient = useCallback((client) => {
    setClientQuery(String(client?.name || "").trim());
    setClientPhoneLocal(String(client?.phone || "").trim());
    setClientPickerOpen(false);
  }, []);

  const scrollEntryFieldIntoView = useCallback((fieldEl) => {
    const scroller = entryScrollRef.current;
    if (!scroller || !fieldEl) return;
    const run = () => {
      const scRect = scroller.getBoundingClientRect();
      const fRect = fieldEl.getBoundingClientRect();
      const padding = 16;
      const overTop = fRect.top - scRect.top - padding;
      const overBottom = fRect.bottom - scRect.bottom + padding;
      if (overTop < 0) {
        scroller.scrollTop += overTop;
      } else if (overBottom > 0) {
        scroller.scrollTop += overBottom;
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
  }, []);

  const focusEntryField = useCallback(
    (fieldEl) => {
      syncSalonxShellHeight();
      scrollEntryFieldIntoView(fieldEl);
      window.setTimeout(() => {
        syncSalonxShellHeight();
        scrollEntryFieldIntoView(fieldEl);
      }, 280);
    },
    [scrollEntryFieldIntoView],
  );

  useEffect(() => {
    if (!open) return undefined;
    const root = rampRootRef.current;
    const vv = window.visualViewport;
    if (!root || !vv) return undefined;

    const syncOverlayViewport = () => {
      const insetBottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const keyboardOpen = insetBottom > 80;
      root.classList.toggle("is-keyboard-open", keyboardOpen);
      root.style.setProperty("--ramp-keyboard-inset", `${insetBottom}px`);
      root.style.top = `${vv.offsetTop}px`;
      root.style.height = `${vv.height}px`;
      root.style.bottom = "auto";
    };

    syncOverlayViewport();
    vv.addEventListener("resize", syncOverlayViewport);
    vv.addEventListener("scroll", syncOverlayViewport);
    return () => {
      vv.removeEventListener("resize", syncOverlayViewport);
      vv.removeEventListener("scroll", syncOverlayViewport);
      root.classList.remove("is-keyboard-open");
      root.style.removeProperty("--ramp-keyboard-inset");
      root.style.removeProperty("top");
      root.style.removeProperty("height");
      root.style.removeProperty("bottom");
    };
  }, [open, phase]);

  const resetPreview = useCallback(() => {
    if (previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl("");
    captureFileRef.current = null;
  }, [previewUrl]);

  const captureAssetsReady = useMemo(() => {
    if (!String(cachedAssets.backgroundPosterUrl || "").trim()) return false;
    if (captureType === "selfie") {
      return Boolean(String(cachedAssets.clientStyleReferenceUrl || "").trim());
    }
    if (captureType === "reel") return false;
    return Boolean(String(cachedAssets.stylistStyleReferenceUrl || "").trim());
  }, [cachedAssets, captureType]);

  const buildStartPayload = useCallback(
    () => ({
      backgroundPosterUrl: String(cachedAssets.backgroundPosterUrl || "").trim(),
      stylistStyleReferenceUrl: String(cachedAssets.stylistStyleReferenceUrl || "").trim(),
      clientStyleReferenceUrl: String(cachedAssets.clientStyleReferenceUrl || "").trim(),
      capturePath: captureType === "selfie" ? "client_path" : "stylist_path",
      recipientName: resolvedRecipientName || String(clientName || "").trim(),
      recipientPhone: resolvedClientPhone,
      appointmentId: appointmentId ?? null,
      stylistName: String(stylistName || "").trim() || "Joe Stylzz",
      products: Array.isArray(products) ? products.slice(0, 12) : [],
      tags: DEFAULT_TAGS,
      links: [DEFAULT_LINK],
      captureType,
    }),
    [
      appointmentId,
      captureType,
      cachedAssets,
      clientName,
      resolvedClientPhone,
      hideClientNameInput,
      resolvedRecipientName,
      products,
      stylistName,
    ],
  );

  const handleCachedAssetFile = useCallback(async (slotId, field, file) => {
    if (!file) return;
    setUploadingSlot(slotId);
    setSubmitError("");
    try {
      const url = await uploadRampMedia(file);
      setCachedAssets((prev) => {
        const next = { ...prev, [field]: url };
        persistCachedAssets(next);
        return next;
      });
    } catch (e) {
      setSubmitError(formatRampError(e, "Poster upload failed"));
    } finally {
      setUploadingSlot("");
    }
  }, []);

  const ensureRampSession = useCallback(async () => {
    if (rampToken) return rampToken;
    if (!isRampApiAvailable()) {
      const localToken = mintRampToken();
      setRampToken(localToken);
      return localToken;
    }
    setStarting(true);
    setSubmitError("");
    try {
      const data = await startRampPost(buildStartPayload());
      const token = String(data?.token || "").trim();
      if (!token) throw new Error("start-post missing token");
      setRampToken(token);
      return token;
    } catch (e) {
      throw new Error(formatRampError(e, "Could not start RAMP post"));
    } finally {
      setStarting(false);
    }
  }, [buildStartPayload, rampToken]);

  const openCapture = useCallback(async () => {
    if (captureType === "reel") {
      setSubmitError("Reel capture is not available yet.");
      return;
    }
    if (!ensureClientNameReady()) return;
    if (!captureAssetsReady) {
      setSubmitError(
        captureType === "selfie"
          ? "Upload background + client style ref before capture."
          : "Upload background + stylist style ref before capture.",
      );
      return;
    }
    setSubmitError("");
    setCaptureError("");
    try {
      await ensureRampSession();
    } catch (e) {
      setSubmitError(formatRampError(e, "Could not start RAMP post"));
      return;
    }
    if (captureType === "upload" || captureType === "selfie") {
      try {
        uploadInputRef.current?.click();
      } catch (e) {
        setSubmitError(formatRampError(e, "Could not open photo picker"));
      }
      return;
    }
    setPhase("capture");
  }, [captureAssetsReady, captureType, ensureClientNameReady, ensureRampSession]);

  const applyCaptureFile = useCallback((file) => {
    if (!file) return;
    if (!ensureClientNameReady()) return;
    try {
      resetPreview();
      captureFileRef.current = file;
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setCaptureError("");
      setPhase("preview");
      void ensureRampSession().catch((e) => {
        setSubmitError(formatRampError(e, "Could not start RAMP post"));
      });
    } catch (e) {
      setSubmitError(formatRampError(e, "Could not load photo"));
    }
  }, [ensureClientNameReady, ensureRampSession, resetPreview]);

  const stopCamera = useCallback(() => {
    try {
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            /* ignore track stop errors */
          }
        });
        streamRef.current = null;
      }
      const video = videoRef.current;
      if (video) video.srcObject = null;
    } catch {
      /* ignore cleanup errors */
    } finally {
      setCameraLive(false);
    }
  }, []);

  const startCamera = useCallback(async (facing) => {
    stopCamera();
    setCameraError("");
    setCaptureError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not supported in this browser. Use Upload (↑).");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        setCameraError("Camera preview unavailable. Use Upload (↑).");
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch (playErr) {
        stopCamera();
        setCameraError(formatRampError(playErr, "Could not start camera preview"));
        return;
      }
      setCameraLive(true);
    } catch (e) {
      stopCamera();
      setCameraError(formatRampError(e, "Camera access denied"));
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!open || phase !== "capture") {
      stopCamera();
      return undefined;
    }
    void startCamera(cameraFacing).catch((e) => {
      setCameraError(formatRampError(e, "Camera failed to start"));
    });
    return () => {
      stopCamera();
    };
  }, [cameraFacing, open, phase, startCamera, stopCamera]);

  const handleShutter = useCallback(async () => {
    if (capturing || !cameraLive) return;
    setCapturing(true);
    setCaptureError("");
    try {
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview unavailable");

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        throw new Error("Camera is still loading. Wait a moment and try again.");
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture photo");

      if (cameraFacing === "user") {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);

      const blob = await new Promise((resolve) => {
        try {
          canvas.toBlob(resolve, "image/jpeg", 0.92);
        } catch {
          resolve(null);
        }
      });
      if (!blob) throw new Error("Could not save photo. Try again.");

      const file = new File([blob], `ramp-${Date.now()}.jpg`, { type: "image/jpeg" });
      stopCamera();
      applyCaptureFile(file);
    } catch (e) {
      setCaptureError(formatRampError(e, "Capture failed"));
    } finally {
      setCapturing(false);
    }
  }, [applyCaptureFile, cameraFacing, cameraLive, capturing, stopCamera]);

  const handleFlipCamera = useCallback(() => {
    try {
      setCameraFacing((prev) => (prev === "environment" ? "user" : "environment"));
    } catch (e) {
      setCaptureError(formatRampError(e, "Could not switch camera"));
    }
  }, []);

  const handleRetake = useCallback(() => {
    setCaptureError("");
    setSubmitError("");
    resetPreview();
    setPhase("capture");
  }, [resetPreview]);

  const queueLocally = useCallback(
    (token, title, status = "pending") => {
      upsertRampQueueItem({
        id: token,
        token,
        title,
        status,
      });
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    if (!ensureClientNameReady()) return;
    const file = captureFileRef.current;
    const title = resolvedRecipientName || String(clientName || "RAMP post").trim() || "RAMP post";
    setSubmitting(true);
    setSubmitError("");
    try {
      let token = rampToken;
      if (!token) token = await ensureRampSession();

      if (isRampApiAvailable() && !file) {
        throw new Error("Capture a photo first");
      }

      queueLocally(token, title, "pending");
      const uploadFile = file;
      resetPreview();
      setRampToken("");
      setPhase("entry");

      if (onGenerationQueued) {
        onGenerationQueued(token);
      } else {
        onClose?.();
      }

      if (isRampApiAvailable() && uploadFile) {
        void (async () => {
          try {
            const mediaUrl = await uploadRampMedia(uploadFile);
            const trimmedNote = String(extraNote || "").trim();
            const result = await submitRampCapture({
              token,
              mediaUrl,
              phone: resolvedClientPhone || undefined,
              source: `ramp_${captureType}`,
              ...(trimmedNote ? { note: trimmedNote } : {}),
            });
            upsertRampQueueItem({
              id: token,
              token,
              title,
              status: result?.status || "generating",
            });
            try {
              await syncRampQueueFromApi();
            } catch {
              /* non-fatal — local queue already updated */
            }
          } catch (e) {
            upsertRampQueueItem({
              id: token,
              token,
              title,
              status: "failed",
            });
            console.warn("[ramp:generation]", formatRampError(e, "Background generation failed"));
          }
        })();
      }
    } catch (e) {
      const message = formatRampError(e, "Could not queue RAMP post");
      let token = rampToken;
      try {
        if (!token) token = await ensureRampSession();
        if (token) queueLocally(token, title, "pending");
        setSubmitError(`${message} Saved to on-device queue only.`);
      } catch {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    captureType,
    clientName,
    ensureClientNameReady,
    resolvedClientPhone,
    extraNote,
    onClose,
    onGenerationQueued,
    queueLocally,
    rampToken,
    resetPreview,
    resolvedRecipientName,
    ensureRampSession,
  ]);

  const handleUploadPick = useCallback(() => {
    setCaptureError("");
    try {
      uploadInputRef.current?.click();
    } catch (e) {
      setCaptureError(formatRampError(e, "Could not open photo picker"));
    }
  }, []);

  const handleFileInputChange = useCallback(
    (e) => {
      try {
        applyCaptureFile(e.target.files?.[0]);
      } catch (err) {
        setSubmitError(formatRampError(err, "Could not load photo"));
      } finally {
        e.target.value = "";
      }
    },
    [applyCaptureFile],
  );

  const activeAlert = phase === "preview" ? submitError : phase === "capture" ? captureError : "";

  if (!open) return null;

  return (
    <div
      ref={rampRootRef}
      className="ramp-bolt"
      role="dialog"
      aria-modal="true"
      aria-label="RAMP post builder"
      data-salonx-keyboard-lock=""
      style={{ ["--ramp-bolt-accent"]: accent }}
    >
      <button
        type="button"
        className="ramp-bolt__backBtn"
        onClick={() => onClose?.()}
        aria-label="Go back"
      >
        <ArrowLeft size={22} weight="bold" aria-hidden />
      </button>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="ramp-bolt__fileInput"
        onChange={handleFileInputChange}
      />

      {activeAlert && phase !== "entry" ? (
        <div className="ramp-bolt__alert" role="alert" aria-live="polite">
          <p className="ramp-bolt__alertText">{activeAlert}</p>
          <button
            type="button"
            className="ramp-bolt__alertDismiss"
            onClick={() => {
              setCaptureError("");
              setCameraError("");
              setSubmitError("");
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {phase === "entry" ? (
        <div className="ramp-bolt__screen ramp-bolt__screen--entry">
          <header className="ramp-bolt__clientBar">
            <div className="ramp-bolt__clientName">
              {String(
                hideClientNameInput
                  ? clientName || "CLIENT NAME"
                  : resolvedRecipientName || "CLIENT NAME",
              ).toUpperCase()}
            </div>
            <div className="ramp-bolt__clientMeta">SERVICE • FINISH • CARE</div>
          </header>

          <div ref={entryScrollRef} className="ramp-bolt__scroll">
            <div className="ramp-bolt__hero">
              <Lightning size={28} weight="fill" aria-hidden className="ramp-bolt__bolt" />
              <div className="ramp-bolt__brand">RAMP</div>
              <div className="ramp-bolt__kicker">START A POST</div>
            </div>

            {!hideClientNameInput ? (
              <section className="ramp-bolt__block" aria-label="Client name">
                <div className="ramp-bolt__blockTitle">
                  Client name <span className="ramp-bolt__req">(required)</span>
                </div>
                <div ref={clientNameFieldRef} className="ramp-bolt__clientField">
                  <label className="ramp-bolt__search">
                    <MagnifyingGlass size={16} weight="bold" aria-hidden />
                    <input
                      type="text"
                      inputMode="search"
                      enterKeyHint="done"
                      value={clientQuery}
                      onChange={(e) => {
                        setClientQuery(e.target.value);
                        setClientPhoneLocal("");
                        setClientPickerOpen(true);
                        setSubmitError("");
                      }}
                      onFocus={(e) => {
                        setClientPickerOpen(true);
                        focusEntryField(clientNameFieldRef.current || e.currentTarget);
                      }}
                      onBlur={() => syncSalonxShellHeight()}
                      placeholder="Enter or select client name"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      required={requireClientName}
                    />
                    <button
                      type="button"
                      className="ramp-bolt__searchAdd"
                      aria-label="Browse clients"
                      onClick={() => setClientPickerOpen((v) => !v)}
                    >
                      <Plus size={16} weight="bold" aria-hidden />
                    </button>
                  </label>

                  {clientPickerOpen && clientMatches.length ? (
                    <ul className="ramp-bolt__clientPicker" role="listbox">
                      {clientMatches.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="ramp-bolt__clientOption"
                            onClick={() => handleSelectClient(c)}
                          >
                            <span className="ramp-bolt__clientOptName">{c.name}</span>
                            <span className="ramp-bolt__clientOptPhone">{c.phone}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {!resolvedRecipientName ? (
                    <p className="ramp-bolt__clientPhone ramp-bolt__clientPhone--warn">
                      Name required before capture
                    </p>
                  ) : null}
                  <label className="ramp-bolt__clientPhoneField" htmlFor="ramp-client-phone">
                    <span className="ramp-bolt__clientPhoneFieldLabel">
                      Phone <span className="ramp-bolt__opt">(optional — MMS override)</span>
                    </span>
                    <input
                      id="ramp-client-phone"
                      type="tel"
                      inputMode="tel"
                      enterKeyHint="done"
                      className="ramp-bolt__clientPhoneInput"
                      value={clientPhoneLocal}
                      onChange={(e) => {
                        setClientPhoneLocal(e.target.value);
                        setSubmitError('');
                      }}
                      onFocus={(e) => focusEntryField(e.currentTarget)}
                      onBlur={() => syncSalonxShellHeight()}
                      placeholder="(555) 555-5555"
                      autoComplete="tel"
                    />
                  </label>
                </div>
              </section>
            ) : null}

            <section className="ramp-bolt__block" aria-label="Poster cache">
              <div className="ramp-bolt__blockTitle">
                Poster Cache <span className="ramp-bolt__req">(save once)</span>
              </div>
              <p className="ramp-bolt__refHint">
                Upload once on this device — reuse every visit. Only the live selfie changes per capture.
              </p>
              <div className="ramp-bolt__refGrid">
                {CACHED_ASSET_SLOTS.map((slot) => {
                  const url = String(cachedAssets[slot.field] || "").trim();
                  const slotUploading = uploadingSlot === slot.id;
                  const isRequired =
                    slot.id === "background" ||
                    (slot.id === "stylist" && captureType !== "selfie" && captureType !== "reel") ||
                    (slot.id === "client" && captureType === "selfie");
                  return (
                    <div key={slot.id} className="ramp-bolt__refSlot">
                      <div className="ramp-bolt__refSlotTitle">
                        {slot.label}
                        {isRequired ? (
                          <span className="ramp-bolt__req"> (required)</span>
                        ) : (
                          <span className="ramp-bolt__opt"> (optional)</span>
                        )}
                      </div>
                      <p className="ramp-bolt__refSlotHint">{slot.hint}</p>
                      <input
                        ref={cachedInputRefs[slot.id]}
                        type="file"
                        accept="image/*"
                        className="ramp-bolt__fileInput"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void handleCachedAssetFile(slot.id, slot.field, file);
                        }}
                      />
                      {url ? (
                        <div className="ramp-bolt__refPreviewWrap">
                          <div className="ramp-bolt__refPreview ramp-bolt__refPreview--slot">
                            <img src={url} alt={`${slot.label} preview`} />
                          </div>
                          <div className="ramp-bolt__refActions">
                            <button
                              type="button"
                              className="ramp-bolt__refBtn"
                              disabled={Boolean(uploadingSlot)}
                              onClick={() => cachedInputRefs[slot.id]?.current?.click()}
                            >
                              {slotUploading ? "UPLOADING…" : "REPLACE"}
                            </button>
                            <button
                              type="button"
                              className="ramp-bolt__refBtn ramp-bolt__refBtn--ghost"
                              disabled={Boolean(uploadingSlot)}
                              onClick={() => {
                                setCachedAssets((prev) => {
                                  const next = { ...prev, [slot.field]: "" };
                                  persistCachedAssets(next);
                                  return next;
                                });
                              }}
                            >
                              REMOVE
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="ramp-bolt__refUpload ramp-bolt__refUpload--slot"
                          disabled={Boolean(uploadingSlot)}
                          onClick={() => cachedInputRefs[slot.id]?.current?.click()}
                        >
                          {slotUploading ? "UPLOADING…" : `UPLOAD ${slot.label.toUpperCase()}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {!captureAssetsReady ? (
                <p className="ramp-bolt__clientPhone ramp-bolt__clientPhone--warn">
                  {captureType === "selfie"
                    ? "Background + client style ref required before capture"
                    : "Background + stylist style ref required before capture"}
                </p>
              ) : null}
            </section>

            <section className="ramp-bolt__block" aria-label="Direction">
              <div className="ramp-bolt__blockTitle">
                Direction <span className="ramp-bolt__opt">(optional)</span>
              </div>
              <label className="ramp-bolt__noteField" htmlFor="ramp-extra-note">
                <textarea
                  id="ramp-extra-note"
                  className="ramp-bolt__noteInput"
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  onFocus={(e) => focusEntryField(e.currentTarget)}
                  onBlur={() => syncSalonxShellHeight()}
                  placeholder="Add a note for caption or visual direction…"
                  rows={3}
                  maxLength={280}
                />
              </label>
            </section>

            <section className="ramp-bolt__block" aria-label="Capture">
              <div className="ramp-bolt__blockTitle">Capture</div>
              <div className="ramp-bolt__captureRow">
                {CAPTURE_TYPES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`ramp-bolt__captureTile${captureType === c.id ? " is-on" : ""}`}
                    onClick={() => setCaptureType(c.id)}
                  >
                    <span className="ramp-bolt__captureIcon" aria-hidden>
                      {c.id === "photo" ? (
                        <Camera size={20} weight="bold" />
                      ) : c.id === "upload" ? (
                        <ArrowUp size={20} weight="bold" />
                      ) : (
                        <span className="ramp-bolt__reelMark">▶</span>
                      )}
                    </span>
                    <span className="ramp-bolt__captureLabel">
                      {c.label}
                      {c.note ? <span className="ramp-bolt__captureNote">*</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="ramp-bolt__block" aria-label="Tags">
              <div className="ramp-bolt__blockTitle">Tags</div>
              <div className="ramp-bolt__tagRow">
                {DEFAULT_TAGS.map((tag) => (
                  <span key={tag} className="ramp-bolt__tag">
                    <span className="ramp-bolt__tagDot" aria-hidden />
                    {tag}
                  </span>
                ))}
                <button type="button" className="ramp-bolt__tagAdd" hidden aria-hidden>
                  + add tag
                </button>
              </div>
            </section>

            <section className="ramp-bolt__block" aria-label="Links">
              <div className="ramp-bolt__blockTitle">Links</div>
              <div className="ramp-bolt__linkRow">
                <span className="ramp-bolt__linkChip">
                  {DEFAULT_LINK}
                  <span className="ramp-bolt__linkMeta">INHERITED</span>
                </span>
                <button type="button" className="ramp-bolt__linkAdd" hidden aria-hidden>
                  + add link
                </button>
              </div>
            </section>
          </div>

          <div className="ramp-bolt__dock">
            {submitError ? <p className="ramp-bolt__error">{submitError}</p> : null}
            <div className={`ramp-bolt__dockRow${onBypass ? " has-bypass" : ""}`}>
              {onBypass ? (
                <button
                  type="button"
                  className="ramp-bolt__bypassBtn"
                  onClick={onBypass}
                  aria-label="Bypass RAMP and go to checkout"
                >
                  BYPASS
                </button>
              ) : null}
              <button
                type="button"
                className="ramp-bolt__cta"
                onClick={() => void openCapture()}
                disabled={
                  starting ||
                  Boolean(uploadingSlot) ||
                  captureType === "reel" ||
                  !captureAssetsReady ||
                  (requireClientName && !resolvedRecipientName)
                }
              >
                {starting
                  ? "STARTING…"
                  : captureType === "upload"
                    ? "CHOOSE PHOTO →"
                    : captureType === "selfie"
                      ? "ADD CLIENT SELFIE →"
                      : "OPEN CAMERA →"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "capture" ? (
        <div className="ramp-bolt__screen ramp-bolt__screen--capture">
          <header className="ramp-bolt__captureHead">
            <Lightning size={22} weight="fill" aria-hidden className="ramp-bolt__bolt" />
            <span className="ramp-bolt__captureTitle">CAPTURE</span>
            <span className="ramp-bolt__styleBadge">POSTER</span>
          </header>

          <div
            className="ramp-bolt__viewfinder"
            aria-label="Camera viewfinder"
            style={{
              ["--ramp-camera-mirror"]: cameraFacing === "user" ? "-1" : "1",
            }}
          >
            <video
              ref={videoRef}
              className="ramp-bolt__viewfinderVideo"
              playsInline
              muted
              autoPlay
              aria-hidden={!cameraLive}
            />
            <span className="ramp-bolt__vfCorner ramp-bolt__vfCorner--tl" aria-hidden />
            <span className="ramp-bolt__vfCorner ramp-bolt__vfCorner--tr" aria-hidden />
            <span className="ramp-bolt__vfCorner ramp-bolt__vfCorner--bl" aria-hidden />
            <span className="ramp-bolt__vfCorner ramp-bolt__vfCorner--br" aria-hidden />
            {!cameraLive ? (
              <div className="ramp-bolt__live">
                <Lightning size={36} weight="fill" aria-hidden />
                <span>{cameraError ? "CAMERA UNAVAILABLE" : "LIVE"}</span>
                {cameraError ? (
                  <span className="ramp-bolt__liveError">{cameraError}</span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="ramp-bolt__captureControls">
            <button
              type="button"
              className="ramp-bolt__sideBtn"
              aria-label="Flip camera"
              onClick={handleFlipCamera}
              disabled={!cameraLive}
            >
              <ArrowCounterClockwise size={24} weight="bold" aria-hidden />
            </button>
            <div className="ramp-bolt__shutterWrap">
              <button
                type="button"
                className="ramp-bolt__shutter"
                onClick={() => void handleShutter()}
                aria-label="Capture photo"
                disabled={!cameraLive || capturing}
              />
              <span className="ramp-bolt__shutterHint">
                {capturing ? "CAPTURING…" : "TAP TO CAPTURE"}
              </span>
            </div>
            <button
              type="button"
              className="ramp-bolt__sideBtn"
              aria-label="Upload photo"
              onClick={handleUploadPick}
            >
              <ArrowUp size={24} weight="bold" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {phase === "preview" ? (
        <div className="ramp-bolt__screen ramp-bolt__screen--preview">
          <header className="ramp-bolt__captureHead">
            <Lightning size={22} weight="fill" aria-hidden className="ramp-bolt__bolt" />
            <span className="ramp-bolt__captureTitle">PREVIEW</span>
          </header>

          <div className="ramp-bolt__previewFrame">
            {previewUrl ? (
              <img className="ramp-bolt__previewImg" src={previewUrl} alt="Captured look" />
            ) : (
              <div className="ramp-bolt__previewPlaceholder" aria-hidden />
            )}
            <span className="ramp-bolt__previewBadge">
              <span className="ramp-bolt__tagDot" aria-hidden />
              RAMP • POSTER
            </span>
          </div>

          <div className="ramp-bolt__previewActions">
            <button
              type="button"
              className="ramp-bolt__ghostBtn"
              onClick={handleRetake}
              disabled={submitting}
            >
              RETAKE
            </button>
            <button
              type="button"
              className="ramp-bolt__cta ramp-bolt__cta--inline"
              onClick={() => void handleConfirm()}
              disabled={submitting || !previewUrl}
            >
              {submitting ? "QUEUING…" : "RAMP GENERATION"}
            </button>
          </div>

          {submitError ? <p className="ramp-bolt__error ramp-bolt__error--preview">{submitError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

class RampBoltErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: formatRampError(error, "RAMP ran into a problem."),
    };
  }

  componentDidCatch(error) {
    console.error("[ramp-bolt]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ramp-bolt ramp-bolt--fault" role="alert">
          <div className="ramp-bolt__faultPanel">
            <div className="ramp-bolt__faultTitle">RAMP paused</div>
            <p className="ramp-bolt__faultCopy">{this.state.message}</p>
            <button
              type="button"
              className="ramp-bolt__cta"
              onClick={() => this.props.onClose?.()}
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RampBoltOverlay(props) {
  return (
    <RampBoltErrorBoundary onClose={props.onClose}>
      <RampBoltOverlayView {...props} />
    </RampBoltErrorBoundary>
  );
}
