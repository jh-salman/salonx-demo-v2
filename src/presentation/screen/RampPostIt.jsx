import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchRampPost, fetchRampStatus, trackRampCopy } from "../../data/rampApi.js";
import "../style/ramp-post-it.css";

const ACTIVE_STATUSES = new Set(["pending", "generating", "processing"]);
const POLL_MS = 3000;

export default function RampPostIt() {
  const { token: tokenParam } = useParams();
  const token = String(tokenParam || "").trim();

  const [phase, setPhase] = useState("load");
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");
  const [copyNote, setCopyNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    let pollId = null;

    const clearPoll = () => {
      if (pollId != null) {
        window.clearInterval(pollId);
        pollId = null;
      }
    };

    const showReady = (row) => {
      if (cancelled || !row?.compositeUrl) return false;
      setPost(row);
      setPhase("ready");
      setError("");
      clearPoll();
      return true;
    };

    const showFailed = (message) => {
      if (cancelled) return;
      clearPoll();
      setPhase("error");
      setError(message || "RAMP generation failed.");
    };

    const showGenerating = () => {
      if (cancelled) return;
      setPhase("generating");
      setError("");
    };

    const loadOnce = async () => {
      if (!token) {
        setPhase("error");
        setError("Invalid link");
        return;
      }

      setPhase("load");
      setError("");

      try {
        const data = await fetchRampPost(token);
        const row = data?.post;
        if (showReady(row)) return;

        const statusData = await fetchRampStatus(token);
        const status = String(statusData?.post?.status || "").trim();

        if (status === "failed") {
          showFailed("RAMP generation failed — ask your stylist to retry.");
          return;
        }

        if (ACTIVE_STATUSES.has(status) || !status) {
          showGenerating();
          pollId = window.setInterval(() => {
            void (async () => {
              try {
                const pollStatus = await fetchRampStatus(token);
                const pollState = String(pollStatus?.post?.status || "").trim();
                if (pollState === "failed") {
                  showFailed("RAMP generation failed — ask your stylist to retry.");
                  return;
                }
                if (ACTIVE_STATUSES.has(pollState)) return;

                const pollPost = await fetchRampPost(token);
                if (showReady(pollPost?.post)) return;
              } catch {
                /* keep polling */
              }
            })();
          }, POLL_MS);
          return;
        }

        setPhase("error");
        setError("This post is not ready yet.");
      } catch {
        if (cancelled) return;
        setPhase("error");
        setError("Could not load your post.");
      }
    };

    void loadOnce();

    return () => {
      cancelled = true;
      clearPoll();
    };
  }, [token]);

  const handleCopyCaption = useCallback(async () => {
    const text = String(post?.caption || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote("Caption copied");
      void trackRampCopy(token);
    } catch {
      setCopyNote("Copy blocked — select caption manually");
    }
  }, [post?.caption, token]);

  return (
    <div className="ramp-post-it">
      <div className="ramp-post-it__shell">
        {phase === "load" || phase === "generating" ? (
          <div className="ramp-post-it__panel" role="status" aria-live="polite">
            <div className="ramp-post-it__eyebrow">Salon X</div>
            <div className="ramp-post-it__title">
              {phase === "generating" ? "Creating your look…" : "Loading…"}
            </div>
            {phase === "generating" ? (
              <p className="ramp-post-it__copy">Usually ready in about 30–45 seconds.</p>
            ) : null}
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="ramp-post-it__panel">
            <div className="ramp-post-it__eyebrow">Salon X</div>
            <div className="ramp-post-it__title">POST IT unavailable</div>
            <p className="ramp-post-it__copy">{error}</p>
          </div>
        ) : null}

        {phase === "ready" ? (
          <div className="ramp-post-it__panel ramp-post-it__panel--wide">
            <div className="ramp-post-it__eyebrow">POST IT</div>
            <div className="ramp-post-it__title">Your look is live</div>
            {post?.compositeUrl ? (
              <div className="ramp-post-it__artifactWrap">
                <img className="ramp-post-it__artifact" src={post.compositeUrl} alt="Your RAMP look" />
              </div>
            ) : null}
            {post?.caption ? (
              <pre className="ramp-post-it__caption">{post.caption}</pre>
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
