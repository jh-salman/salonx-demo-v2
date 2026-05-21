import { useEffect, useState } from "react";
import { createBrowserRouter, Outlet, useLocation } from "react-router-dom";
import Home from "../presentation/screen/Home";
import Screen2 from "../presentation/screen/Screen2";
import Screen3 from "../presentation/screen/Screen3";
import Climax from "../presentation/screen/Climax";
import Calendar from "../presentation/screen/Calendar";
import CheckOut from "../presentation/screen/CheckOut";
import Clients from "../presentation/screen/Clients";
import SettingsScreen from "../presentation/screen/SettingsScreen";
import Screen1DemoImage from "../presentation/screen/Screen1DemoImage";
import RampPostIt from "../presentation/screen/RampPostIt";
import BottomToolbar from "../component/BottomToolbar";

function isScreen1Path(pathname) {
  return (
    pathname.startsWith("/screen1") || pathname.startsWith("/s1-demo-image")
  );
}

/** Route slot only — Screen1 stays mounted in AppLayout keep-alive shell. */
function Screen1RouteSlot() {
  return null;
}

/** Routes without global bottom toolbar (welcome + public RAMP). */
const HIDE_TOOLBAR_PATHS = new Set(["/"]);

function hideToolbarForPath(pathname) {
  return HIDE_TOOLBAR_PATHS.has(pathname) || pathname.startsWith("/p/");
}

function activeIndexForPath(pathname) {
  if (pathname.startsWith("/screen1") || pathname.startsWith("/s1-demo-image"))
    return 0;
  if (pathname.startsWith("/clients") || pathname.startsWith("/screen2")) return 1;
  if (pathname.startsWith("/climax") || pathname.startsWith("/checkout")) return 2;
  if (pathname.startsWith("/calendar") || pathname.startsWith("/screen3")) return 3;
  if (pathname.startsWith("/settings")) return 4;
  return -1;
}

/** Layout route: renders the current screen + persistent bottom toolbar.
 *
 * NOTE: We MUST wrap children in a real DOM element (not a Fragment) so that
 * the global `#root > *` rule in `src/index.css` (which sets
 * `display:flex; flex-direction:column; min-height: shell-height`) targets
 * this single wrapper rather than both the Outlet root AND the toolbar — the
 * latter would otherwise stretch full-viewport and stack icons vertically. */
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
      { path: "/calendar", element: <Calendar /> },
      { path: "/checkout", element: <CheckOut /> },
      { path: "/clients", element: <Clients /> },
      { path: "/settings", element: <SettingsScreen /> },
      { path: "/p/:token", element: <RampPostIt /> },
    ],
  },
]);