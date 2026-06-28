import { useEffect, useMemo, useState } from "react";
import {
  listRampClientsForPicker,
  loadRampClientsCatalog,
} from "../../../data/rampClients";
import { ClientThumb, TopBar } from "../components";
import { useRamp } from "../rampContext";

export default function AssignClientView() {
  const { pendingCapture, setView, addCaptureToQueue, showToast } = useRamp();
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadRampClientsCatalog().then((list) => setCatalog(Array.isArray(list) ? list : []));
  }, []);

  const rampMatches = useMemo(
    () => listRampClientsForPicker(catalog, query),
    [catalog, query],
  );
  const active = selected || (rampMatches.length === 1 && query.trim() ? rampMatches[0] : null);
  const canQueue = Boolean(pendingCapture?.file || pendingCapture?.imageUrl) && Boolean(active || query.trim());

  const handleSelect = (client) => {
    setSelected(client);
    setQuery(client.name);
  };

  const handleQueue = async () => {
    if (!pendingCapture?.file && !pendingCapture?.imageUrl) {
      showToast("Capture a photo first");
      return;
    }
    const name = active?.name || query.trim();
    if (!name) {
      showToast("Select or enter a client");
      return;
    }

    setSubmitting(true);
    try {
      await addCaptureToQueue({
        name,
        clientId: active?.id ?? null,
        sub: active?.sub || "New capture",
        emoji: active?.emoji || "🧑",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!pendingCapture?.file && !pendingCapture?.imageUrl) {
    return (
      <div className="ramp-view">
        <div className="scroll">
          <TopBar title="Set client" onBack={() => setView("capture")} />
          <p className="hint">No photo captured. Go back and take a photo first.</p>
          <button type="button" className="btn btn-primary" onClick={() => setView("capture")}>
            Take a photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ramp-view assign-view">
      <div className="scroll">
        <TopBar title="Set client" onBack={() => setView("capture")} hint="Then add to queue" />

        <div className="ramp-assign-preview">
          <img src={pendingCapture.imageUrl} alt="" className="ramp-assign-preview__img" />
          <span className="ramp-assign-preview__label">Captured photo</span>
        </div>

        <div className="field-lbl">Who is this for?</div>
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
        <p className="helptxt">Pick from client catalog or type a new name.</p>

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
                  onClick={() => handleSelect(client)}
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
              <div className="nc-d">Queue as: {query.trim()}</div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleQueue}
          disabled={!canQueue || submitting}
        >
          {submitting ? "Uploading…" : "Add to queue"}
        </button>
      </div>
    </div>
  );
}
