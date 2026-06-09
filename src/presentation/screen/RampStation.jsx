import React, { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import {
  readPersistedScreen2Apt,
  readPersistedScreen2From,
} from "../../data/appointmentStateStore";
import { writeRampAppointmentLink } from "../../data/rampAppointmentLink";
import RampBoltOverlay from "./RampBoltOverlay.jsx";
import "../style/ramp-station.css";

const RAMP_DEMO_STYLIST_NAME = "Joe Stylzz";

export default function RampStation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { primaryHex } = useTheme();

  const rampContext = useMemo(() => {
    const state = location.state || {};
    const apt = state.apt && typeof state.apt === "object" ? state.apt : null;
    return {
      from: typeof state.from === "string" && state.from.startsWith("/") ? state.from : "/screen1",
      fromParent:
        typeof state.fromParent === "string" && state.fromParent.startsWith("/")
          ? state.fromParent
          : null,
      apt,
      clientName:
        String(state.clientName || apt?.clientName || "").trim() || "",
      clientPhone: String(state.clientPhone || "").trim(),
      products: Array.isArray(state.products) ? state.products.slice(0, 12) : [],
    };
  }, [location.state]);

  const handleClose = useCallback(() => {
    const { from, fromParent, apt } = rampContext;
    if (from === "/screen2") {
      const resolvedApt = apt || readPersistedScreen2Apt();
      if (resolvedApt) {
        const s2From = fromParent || readPersistedScreen2From() || "/screen1";
        navigate("/screen2", {
          state: { apt: resolvedApt, from: s2From },
        });
        return;
      }
    }
    navigate(from);
  }, [navigate, rampContext]);

  const handleBypass = useCallback(() => {
    const { apt, clientPhone, from } = rampContext;
    const isFromScreen2 = from === "/screen2";
    const resolvedApt = isFromScreen2 ? apt || readPersistedScreen2Apt() : null;
    const navState = {
      rampSkipped: true,
      ...(clientPhone ? { clientPhone } : {}),
    };
    if (isFromScreen2 && resolvedApt) {
      navState.apt = resolvedApt;
      navState.from = "/screen2";
    } else {
      navState.from = from.startsWith("/") ? from : "/ramp";
    }
    navigate("/climax", { state: navState });
  }, [navigate, rampContext]);

  const handleGenerationQueued = useCallback(
    (token) => {
      const { apt, clientPhone, from } = rampContext;
      const isFromScreen2 = from === "/screen2";
      const resolvedApt = isFromScreen2 ? apt || readPersistedScreen2Apt() : null;

      if (!isFromScreen2) {
        navigate("/screen1");
        return;
      }

      const navState = {
        rampSkipped: false,
        rampToken: token,
        ...(clientPhone ? { clientPhone } : {}),
      };
      if (resolvedApt) {
        // Remember the appointment → RAMP token so a later S2 Climax tap goes
        // straight to checkout with the live RAMP status.
        writeRampAppointmentLink(resolvedApt.id, token);
        navState.apt = resolvedApt;
        navState.from = "/screen2";
      } else {
        navState.from = "/screen2";
      }
      navigate("/climax", { state: navState });
    },
    [navigate, rampContext],
  );

  const isFromScreen2 = rampContext.from === "/screen2";

  return (
    <div className="ramp-station" aria-label="RAMP station">
      <RampBoltOverlay
        open
        onClose={handleClose}
        onBypass={isFromScreen2 ? handleBypass : undefined}
        onGenerationQueued={handleGenerationQueued}
        clientName={rampContext.clientName}
        clientPhone={rampContext.clientPhone}
        hideClientNameInput={isFromScreen2}
        requireClientName={!isFromScreen2}
        appointmentId={rampContext.apt?.id ?? null}
        stylistName={RAMP_DEMO_STYLIST_NAME}
        products={rampContext.products}
        accent={primaryHex}
        autoCapture
      />
    </div>
  );
}
