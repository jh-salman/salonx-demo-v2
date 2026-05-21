import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  fetchRampPost,
  storeSharedSelfie,
  trackRampCopy,
  uploadRampMedia,
} from "../../data/rampApi.js";
import "../style/ramp-post-it.css";

function firstName(full) {
  const raw = String(full || "").trim();
  if (!raw) return "";
  return raw.split(/\s+/)[0] || raw;
}

export default function RampPostIt() {
  const { token: tokenParam } = useParams();
  const token = String(tokenParam || "").trim();
  const fileRef = useRef(null);

  const [phase, setPhase] = useState("load");
  const [post, setPost] = useState(null);
  const [artifactUrl, setArtifactUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [copyNote, setCopyNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setPhase("error");
      setError("Invalid link");
      return undefined;
    }
    setPhase("load");
    setError("");
    void fetchRampPost(token).then((data) => {
      if (cancelled) return;
      const row = data?.post;
      if (!row) {
        setPhase("error");
        setError("This link is no longer available.");
        return;
      }
      setPost(row);
      if (row.compositeUrl && row.status === "ready") {
        setArtifactUrl(row.compositeUrl);
        setCaption(row.caption || "");
        setPhase("ready");
        return;
      }
      setPhase("landing");
    }).catch(() => {
      if (cancelled) return;
      setPhase("error");
      setError("Could not load your experience.");
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handlePickSelfie = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleSelfieFile = useCallback(async (e) => {
    const file = e.target?.files?.[0];
    e.target.value = "";
    if (!file || !token) return;
    setPhase("processing");
    setError("");
    try {
      const mediaUrl = await uploadRampMedia(file);
      const result = await storeSharedSelfie({
        token,
        mediaUrl,
        source: "web_upload",
      });
      await new Promise((r) => setTimeout(r, 1200));
      setArtifactUrl(result?.compositeUrl || mediaUrl);
      setCaption(result?.caption || post?.caption || "");
      setPhase("ready");
    } catch (err) {
      setPhase("selfie");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }, [post?.caption, token]);

  const handleCopyCaption = useCallback(async () => {
    const text = caption.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote("Caption copied");
      void trackRampCopy(token);
    } catch {
      setCopyNote("Copy blocked — select caption manually");
    }
  }, [caption, token]);

  const greeting = firstName(post?.recipientName);
  const stylist = post?.stylistName || "your stylist";

  return (
    <div className="ramp-post-it">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="ramp-post-it__fileInput"
        onChange={handleSelfieFile}
        aria-hidden
        tabIndex={-1}
      />

      <div className="ramp-post-it__shell">
        {phase === "load" ? (
          <div className="ramp-post-it__panel" role="status" aria-live="polite">
            <div className="ramp-post-it__eyebrow">Salon X</div>
            <div className="ramp-post-it__title">Loading…</div>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="ramp-post-it__panel">
            <div className="ramp-post-it__eyebrow">Salon X</div>
            <div className="ramp-post-it__title">Link unavailable</div>
            <p className="ramp-post-it__copy">{error}</p>
          </div>
        ) : null}

        {phase === "landing" ? (
          <div className="ramp-post-it__panel">
            <div className="ramp-post-it__eyebrow">Client care</div>
            <div className="ramp-post-it__title">
              {greeting ? `${greeting}, ready to see your look come alive?` : "Ready to see your look come alive?"}
            </div>
            <p className="ramp-post-it__copy">
              We created something special for you with {stylist}.
            </p>
            <button type="button" className="ramp-post-it__cta" onClick={() => setPhase("selfie")}>
              Continue
            </button>
          </div>
        ) : null}

        {phase === "selfie" ? (
          <div className="ramp-post-it__panel">
            <div className="ramp-post-it__eyebrow">Your look</div>
            <div className="ramp-post-it__title">Add your look</div>
            <p className="ramp-post-it__copy">
              Take a quick selfie in good lighting and let the magic happen.
            </p>
            {error ? <p className="ramp-post-it__error">{error}</p> : null}
            <button type="button" className="ramp-post-it__cta" onClick={handlePickSelfie}>
              Take photo
            </button>
            <button type="button" className="ramp-post-it__cta ramp-post-it__cta--ghost" onClick={handlePickSelfie}>
              Use camera roll
            </button>
          </div>
        ) : null}

        {phase === "processing" ? (
          <div className="ramp-post-it__panel" role="status" aria-live="polite">
            <div className="ramp-post-it__eyebrow">Magic</div>
            <div className="ramp-post-it__title">Building your reveal…</div>
            <p className="ramp-post-it__copy">Adding a little more magic.</p>
            <div className="ramp-post-it__spinner" aria-hidden />
          </div>
        ) : null}

        {phase === "ready" ? (
          <div className="ramp-post-it__panel ramp-post-it__panel--wide">
            <div className="ramp-post-it__eyebrow">POST IT</div>
            <div className="ramp-post-it__title">Your look is live</div>
            {artifactUrl ? (
              <div className="ramp-post-it__artifactWrap">
                <img className="ramp-post-it__artifact" src={artifactUrl} alt="Your RAMP look" />
              </div>
            ) : null}
            {caption ? (
              <pre className="ramp-post-it__caption">{caption}</pre>
            ) : null}
            <button type="button" className="ramp-post-it__cta" onClick={handleCopyCaption}>
              Copy caption
            </button>
            {copyNote ? <p className="ramp-post-it__copyNote">{copyNote}</p> : null}
            <p className="ramp-post-it__hint">Share to your story or feed — tag your stylist.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
