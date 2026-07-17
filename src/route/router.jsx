import { useEffect, useState } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";
import Home from "../presentation/screen/Home";
import Screen2 from "../presentation/screen/Screen2";
import Screen3 from "../presentation/screen/Screen3";
import Climax from "../presentation/screen/Climax";
import Calendar from "../presentation/screen/Calendar";
import CheckOut from "../presentation/screen/CheckOut";
import Clients from "../presentation/screen/Clients";
import SettingsScreen from "../presentation/screen/SettingsScreen";
import Screen1DemoImage from "../presentation/screen/Screen1DemoImage";
import Screen5 from "../presentation/screen/Screen5";
import RampApp from "../presentation/ramp/RampApp";
import RampPublicView from "../presentation/ramp/views/RampPublicView";
import BottomToolbar from "../component/BottomToolbar";
import MicrositeHome from "../presentation/microsite/pages/MicrositeHome";
import MicrositeBook from "../presentation/microsite/pages/MicrositeBook";
import MicrositeSuccess from "../presentation/microsite/pages/MicrositeSuccess";
import MicrositeAdminScreen from "../presentation/microsite/MicrositeAdminScreen";
import { resolveMicrositeSlugFromLocation, micrositePublicPath } from "../presentation/microsite/micrositeApi";

function isScreen1Path(pathname) {
  return (
    pathname.startsWith("/screen1") || pathname.startsWith("/s1-demo-image")
  );
}

/** Route slot only — Screen1 stays mounted in AppLayout keep-alive shell. */
function Screen1RouteSlot() {
  return null;
}

/** Routes without global bottom toolbar (welcome). */
const HIDE_TOOLBAR_PATHS = new Set(["/"]);

function hideToolbarForPath(pathname) {
  if (HIDE_TOOLBAR_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/screen5")) return true;
  if (pathname.startsWith("/ramp/public")) return true;
  if (pathname.startsWith("/m/")) return true;
  return false;
}

function activeIndexForPath(pathname) {
  if (pathname.startsWith("/screen1") || pathname.startsWith("/s1-demo-image"))
    return 0;
  if (pathname.startsWith("/clients") || pathname.startsWith("/screen2")) return 1;
  if (pathname.startsWith("/ramp")) return 2;
  if (pathname.startsWith("/calendar") || pathname.startsWith("/screen3")) return 3;
  if (pathname.startsWith("/settings") || pathname.startsWith("/microsite")) return 4;
  return -1;
}

/** Subdomain → /m/:slug (e.g. tast.salonx.com). Skips reserved hosts like demo.salonx.com. */
function MicrositeHostGate({ children }) {
  const location = useLocation();
  const hostSlug = resolveMicrositeSlugFromLocation(window.location);
  if (hostSlug && !location.pathname.startsWith("/m/")) {
    return <Navigate to={micrositePublicPath(hostSlug)} replace />;
  }
  return children;
}

/** Layout route: renders the current screen + persistent bottom toolbar. */
function AppLayout() {
  const location = useLocation();
  const hideToolbar = hideToolbarForPath(location.pathname);
  const screen1Active = isScreen1Path(location.pathname);
  const [screen1KeepAlive, setScreen1KeepAlive] = useState(() =>
    isScreen1Path(location.pathname),
  );

  useEffect(() => {
    if (screen1Active) setScreen1KeepAlive(true);
  }, [screen1Active]);

  return (
    <MicrositeHostGate>
      <div className="app-layout">
        {screen1KeepAlive ? (
          <div
            className={`app-keepalive-screen1${screen1Active ? " is-active" : ""}`}
            aria-hidden={!screen1Active}
          >
            <Screen1DemoImage />
          </div>
        ) : null}
        <div
          className={`app-layout__outlet${screen1Active ? "" : " is-active"}`}
        >
          <Outlet />
        </div>
        {!hideToolbar ? (
          <BottomToolbar
            activeIndex={activeIndexForPath(location.pathname)}
            originPath={location.pathname}
          />
        ) : null}
      </div>
    </MicrositeHostGate>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/screen1", element: <Screen1RouteSlot /> },
      { path: "/s1-demo-image", element: <Screen1RouteSlot /> },
      { path: "/screen2", element: <Screen2 /> },
      { path: "/screen3", element: <Calendar /> },
      { path: "/climax", element: <Climax /> },
      { path: "/screen5", element: <Screen5 /> },
      { path: "/ramp/public/:queueId", element: <RampPublicView /> },
      { path: "/ramp", element: <RampApp /> },
      { path: "/ramp/:queueId", element: <RampApp /> },
      { path: "/calendar", element: <Calendar /> },
      { path: "/checkout", element: <CheckOut /> },
      { path: "/clients", element: <Clients /> },
      { path: "/settings", element: <SettingsScreen /> },
      { path: "/microsite", element: <MicrositeAdminScreen /> },
      { path: "/m/:slug", element: <MicrositeHome /> },
      { path: "/m/:slug/book", element: <MicrositeBook /> },
      { path: "/m/:slug/success", element: <MicrositeSuccess /> },
    ],
  },
]);
