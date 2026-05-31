import React, { useCallback, useMemo } from "react";
import { ArrowLeft } from "phosphor-react";
import { useLocation, useNavigate } from "react-router-dom";
import "../style/screen5.css";

/** Canonical Client Care Card preview — static asset, not live ticket data. */
const S5_CARE_CARD_SRC = "/screen5-care-card.png";

export default function Screen5() {
  const location = useLocation();
  const navigate = useNavigate();

  const payload = useMemo(() => {
    const state =
      location?.state && typeof location.state === "object" ? location.state : {};
    return {
      from:
        typeof state.from === "string" && state.from.startsWith("/")
          ? state.from
          : "/climax",
      climaxReturnState:
        state.climaxReturnState && typeof state.climaxReturnState === "object"
          ? state.climaxReturnState
          : null,
    };
  }, [location.state]);

  const handleBack = useCallback(() => {
    if (payload.climaxReturnState) {
      navigate(payload.from, { state: payload.climaxReturnState });
      return;
    }
    navigate(payload.from);
  }, [navigate, payload.climaxReturnState, payload.from]);

  return (
    <div className="s5-root">
      <button
        type="button"
        className="s5-backBtn"
        onClick={handleBack}
        aria-label="Back to checkout"
      >
        <ArrowLeft size={20} weight="bold" aria-hidden />
      </button>

      <img
        className="s5-careCard"
        src={S5_CARE_CARD_SRC}
        alt="Client Care Card preview"
        decoding="async"
      />
    </div>
  );
}
