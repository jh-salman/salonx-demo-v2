import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRampPublicPost } from "../../../data/rampRuntimeApi.js";
import { RampCopyUrlRow, TopBar } from "../components";
import { rampMasterPath, rampQueuePath } from "../rampPaths";
import PosterPreview, { buildTitle } from "../PosterPreview";
import "../ramp.css";

export default function RampPublicView() {
  const navigate = useNavigate();
  const { queueId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [post, setPost] = useState(null);
  const [copyHint, setCopyHint] = useState("");

  const handleCopy = useCallback((message) => {
    setCopyHint(message || "Copied");
    window.setTimeout(() => setCopyHint(""), 2000);
  }, []);

  const handleBack = useCallback(() => {
    if (queueId) {
      navigate(rampQueuePath(queueId));
      return;
    }
    navigate(rampMasterPath());
  }, [navigate, queueId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPost(null);

    void getRampPublicPost(queueId)
      .then((row) => {
        if (cancelled) return;
        if (!row?.generatedImage) {
          setError("Generated image not found");
          return;
        }
        setPost(row);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.message || "Could not load image";
        setError(/not found/i.test(msg) ? "Image not available yet — try again shortly" : msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queueId]);

  const title = post ? buildTitle(post.clientName) : "RAMP";

  return (
    <div className="rampx ramp-public-view">
      <div className="scroll">
        <TopBar
          title={title}
          onBack={handleBack}
          hint={post?.clientSub || "Share"}
        />
        {loading ? (
          <p className="hint ramp-public-view__hint">Loading…</p>
        ) : null}
        {!loading && error ? (
          <p className="hint ramp-public-view__hint ramp-public-view__hint--error">{error}</p>
        ) : null}
        {!loading && post?.generatedImage ? (
          <>
            <PosterPreview
              imageUrl={post.generatedImage}
              fullScreen
              downloadable
              downloadFilename={`salonx-ramp-${post.id}.png`}
            />
            <RampCopyUrlRow
              url={post.generatedImage}
              external
              onCopy={handleCopy}
            />
            {copyHint ? (
              <p className="hint ramp-public-view__copy-hint">{copyHint}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
