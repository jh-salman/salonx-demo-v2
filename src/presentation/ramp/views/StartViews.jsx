import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientThumb, TopBar } from "../components";
import { IMPORT_ATTRIBUTION, S5_STEPS } from "../rampData";
import { useRamp } from "../rampContext";
import { revokeRampObjectUrl } from "../../../data/rampGenerate";
import {
  listRampClientsForPicker,
  loadRampClientsCatalog,
} from "../../../data/rampClients";

export function CaptureView() {
  const { captureWho, handleCaptureBack, afterCapture, stationClient } = useRamp();
  const uploadRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const previewFileRef = useRef(null);
  const previewUrlRef = useRef(null);

  const [mode, setMode] = useState("live");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not available on this device — use Upload.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCameraReady(true);
    } catch {
      setCameraError("Camera access denied — use Upload.");
    }
  }, [facingMode, stopCamera]);

  const revokePreview = useCallback(() => {
    revokeRampObjectUrl(previewUrlRef.current);
    previewUrlRef.current = null;
    previewFileRef.current = null;
    setPreviewUrl(null);
  }, []);

  useEffect(() => {
    if (mode !== "live") return undefined;
    void startCamera();
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  useEffect(() => () => revokePreview(), [revokePreview]);

  const enterPreview = useCallback(
    (file) => {
      if (!file?.type?.startsWith("image/")) return;
      stopCamera();
      revokePreview();
      const url = URL.createObjectURL(file);
      previewFileRef.current = file;
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setMode("preview");
    },
    [revokePreview, stopCamera],
  );

  const handleUploadPick = () => uploadRef.current?.click();

  const handleUploadChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) enterPreview(file);
  };

  const handleSnap = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || busy) return;

    setBusy(true);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 140);

    try {
      const w = video.videoWidth || 720;
      const h = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture frame");
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Capture failed"))),
          "image/jpeg",
          0.92,
        );
      });
      const file = new File([blob], `capture-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      enterPreview(file);
    } catch {
      setCameraError("Capture failed — try Upload.");
    } finally {
      setBusy(false);
    }
  };

  const handleRetake = () => {
    revokePreview();
    setMode("live");
  };

  const handleUsePhoto = () => {
    const file = previewFileRef.current;
    if (!file) return;
    afterCapture(file);
  };

  const handleFlip = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const isPreview = mode === "preview" && Boolean(previewUrl);

  return (
    <div className="ramp-view capture-view">
      <TopBar title="Capture" onBack={handleCaptureBack} hint={captureWho} />
      <div className="camera">
        <div className={`capture-flash${flash ? " is-active" : ""}`} aria-hidden />
        <div className="frameguide">
          {isPreview ? (
            <img src={previewUrl} alt="Captured preview" className="imgprev__photo" />
          ) : (
            <>
              <video
                ref={videoRef}
                className="capture-video"
                playsInline
                muted
                autoPlay
                aria-label="Camera preview"
              />
              {!cameraReady ? (
                <div className="capture-placeholder capture-placeholder--overlay" aria-hidden>
                  📸
                </div>
              ) : null}
            </>
          )}
        </div>
        {cameraError && !isPreview ? (
          <p className="helptxt capture-view__hint">{cameraError}</p>
        ) : null}
      </div>

      <div className="capture-controls">
        {isPreview ? (
          <>
            <button type="button" className="capture-controls__side" onClick={handleRetake}>
              Retake
            </button>
            <div className="capture-controls__next">
              <button
                type="button"
                className="capture-controls__snap"
                onClick={handleUsePhoto}
                aria-label="Next — select client"
              />
              <span className="capture-controls__next-label">
                {stationClient ? "Build" : "Next"}
              </span>
            </div>
            <button type="button" className="capture-controls__side" onClick={handleUploadPick}>
              Upload
            </button>
          </>
        ) : (
          <>
            <button type="button" className="capture-controls__side" onClick={handleUploadPick}>
              Upload
            </button>
            <button
              type="button"
              className={`capture-controls__snap${busy ? " is-busy" : ""}`}
              onClick={handleSnap}
              disabled={!cameraReady || busy}
              aria-label="Capture"
            />
            <button
              type="button"
              className="capture-controls__side"
              onClick={handleFlip}
              disabled={!cameraReady || busy}
            >
              Flip
            </button>
          </>
        )}
      </div>

      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleUploadChange}
      />
    </div>
  );
}

export function StationView() {
  const { setView, startStationCapture, showToast } = useRamp();
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    void loadRampClientsCatalog().then((list) => setCatalog(Array.isArray(list) ? list : []));
  }, []);

  const rampMatches = useMemo(
    () => listRampClientsForPicker(catalog, query),
    [catalog, query],
  );
  const active = selected || (rampMatches.length === 1 && query.trim() ? rampMatches[0] : null);

  const buildFromStation = () => {
    if (active) {
      startStationCapture({
        name: active.name,
        clientId: active.id,
        sub: active.sub,
        emoji: active.emoji || "🧑",
        thumb: "t1",
      });
      return;
    }
    if (query.trim()) {
      startStationCapture({ name: query.trim(), sub: "New client", emoji: "🧑", thumb: "t1" });
      return;
    }
    showToast("Select or enter a client");
  };

  return (
    <div className="ramp-view station-view">
      <div className="scroll">
        <TopBar title="Client select" onBack={() => setView("master")} hint="Then capture photo" />
        <div className="field-lbl">Who&apos;s this post for?</div>
        <div className="smartfield">
          <span className="mag">🔍</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Phone or name…"
            autoComplete="off"
          />
        </div>
        <p className="helptxt">Search from client catalog or type a new name.</p>

        {active ? (
          <div className="lookup">
            <div className="found">
              <ClientThumb name={active.name} avatar={active.avatar} thumb="t1" className="av" />
              <div>
                <div className="nm">{active.name}</div>
                <div className="tag">✓ {active.id ? "Client catalog" : "New client"}</div>
              </div>
            </div>
          </div>
        ) : null}

        {!active && rampMatches.length > 0 ? (
          <>
            <div className="grp-h">{query.trim() ? "Matches" : "Clients"}</div>
            <div className="ramp-client-picks">
              {rampMatches.map((client) => (
              <button
                key={client.id || client.name}
                type="button"
                className="ramp-client-pick"
                onClick={() => {
                  setSelected(client);
                  setQuery(client.name);
                }}
              >
                <ClientThumb name={client.name} avatar={client.avatar} thumb="t1" />
                <span>
                  <span className="ramp-client-pick__name">{client.name}</span>
                  <span className="ramp-client-pick__sub">{client.sub}</span>
                </span>
              </button>
              ))}
            </div>
          </>
        ) : null}

        {query.trim() && !active ? (
          <div className="newclient">
            <span className="av2">＋</span>
            <div>
              <div className="nc-t">New client</div>
              <div className="nc-d">Will create: {query.trim()}</div>
            </div>
          </div>
        ) : null}

        <button type="button" className="btn btn-primary" onClick={buildFromStation}>
          Build the post →
        </button>
      </div>
    </div>
  );
}

export function SelfieView() {
  const { setView, openBuild } = useRamp();

  return (
    <div className="ramp-view s5-view">
      <div className="scroll">
        <TopBar title="S5 · Client Selfie" onBack={() => setView("master")} />
        <p className="hint">
          The Magic Selfie Loop — the client captures remotely; it returns pre-attributed.
        </p>
        <div className="mms">
          <div className="bar">
            <span>Care Card · MMS</span>
            <span>to client</span>
          </div>
          <div className="body">
            <div className="bubble">
              Thanks for coming in! ✨ Tap to finish the magic — send us your selfie →
            </div>
          </div>
        </div>
        <div className="mms">
          <div className="bar">
            <span>Client reply · MMS</span>
            <span>from client</span>
          </div>
          <div className="body">
            <div className="bubble them">Here you go! 😄</div>
            <div className="selfiebox">🤳</div>
          </div>
        </div>
        <div className="grp-h">What happens automatically</div>
        <div className="stepflow">
          {S5_STEPS.map((step, index) => (
            <div key={step.title} className="step">
              <span className={`n${step.done ? " done" : ""}`}>{step.done ? "✓" : index + 1}</span>
              <div>
                <div className="st">{step.title}</div>
                <div className="sd">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            openBuild({
              name: "Joe Stylzzz",
              sub: "S5 selfie · Curiosity",
              emoji: "🤳",
              thumb: "t2",
            })
          }
        >
          Open in Build Station →
        </button>
      </div>
    </div>
  );
}

export function ImportSheet() {
  const { importOpen, closeImportSheet, confirmImport, importEmoji } = useRamp();
  if (!importOpen) return null;

  return (
    <div
      className="dim show"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeImportSheet();
      }}
    >
      <div className="sheet">
        <div className="grab" onClick={closeImportSheet} />
        <div className="imgprev">{importEmoji || "🖼️"}</div>
        <h4>Attribute this photo?</h4>
        <div className="warn-line">⚠ Imported photos have no RAMP lineage yet</div>
        <div className="attr">
          {IMPORT_ATTRIBUTION.map((row) => (
            <div key={row.k} className="row">
              <span className="k">{row.k}</span>
              <span className="v">{row.v}</span>
            </div>
          ))}
        </div>
        <p className="helptxt" style={{ textAlign: "center" }}>
          Writes a permanent attribution record. Only confirm if the photo belongs to this client
          &amp; service.
        </p>
        <button type="button" className="btn btn-primary" onClick={confirmImport}>
          Attribute &amp; use
        </button>
        <button type="button" className="btn btn-ghost" onClick={closeImportSheet}>
          Cancel
        </button>
      </div>
    </div>
  );
}
