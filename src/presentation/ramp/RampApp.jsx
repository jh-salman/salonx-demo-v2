import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import BottomToolbar from "../../component/BottomToolbar";
import { uploadRampCapture } from "../../data/rampAssetUpload.js";
import { isRampApiAvailable } from "../../data/rampApi";
import { getRampBrandPresets } from "../../data/rampBrandPresets.js";
import { loadRampClientsCatalog } from "../../data/rampClients.js";
import { revokeRampObjectUrl } from "../../data/rampGenerate";
import { addRampQueueItem, findRampQueueItem, refreshRampQueue } from "../../data/rampLocalQueueStore";
import {
  getRampGenState,
  resumeRampGenerationWatch,
  subscribeRampGenGlobal,
} from "../../data/rampGenerationStore.js";
import {
  createRampPost as createRampPostApi,
  getRampPost,
  isRampRuntimeApiAvailable,
  patchRampPost,
} from "../../data/rampRuntimeApi.js";
import { Choice, Sheet, Toast } from "./components";
import { RampContext } from "./rampContext";
import { createRampPost, postFromApi, postFromQueueCard, postToApiPatch } from "./rampPostModel";
import QueueView from "./views/QueueView";
import BuildView from "./views/BuildView";
import {
  BackgroundView,
  CaptionView,
  EditView,
  HeroView,
  LinksView,
  TagsView,
  TypeView,
} from "./views/EditViews";
import { CaptureView, ImportSheet, SelfieView, StationView } from "./views/StartViews";
import AssignClientView from "./views/AssignClientView";
import { rampMasterPath, rampQueuePath } from "./rampPaths";
import "./ramp.css";

const VIEWS = {
  master: QueueView,
  build: BuildView,
  edit: EditView,
  caption: CaptionView,
  hero: HeroView,
  type: TypeView,
  bg: BackgroundView,
  tags: TagsView,
  link: LinksView,
  capture: CaptureView,
  assign: AssignClientView,
  station: StationView,
  s5: SelfieView,
};

const SAVE_DEBOUNCE_MS = 600;

export default function RampApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { queueId } = useParams();
  const saveTimerRef = useRef(null);
  const postRef = useRef(null);
  const loadedQueueIdRef = useRef(null);

  const [view, setView] = useState("master");
  const [viewBack, setViewBack] = useState("master");
  const [post, setPost] = useState(null);
  const [pendingCapture, setPendingCapture] = useState(null);
  const [toast, setToast] = useState("");
  const [boltOpen, setBoltOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importEmoji, setImportEmoji] = useState("🖼️");
  const [captureWho, setCaptureWho] = useState("New client");
  const [captureReturn, setCaptureReturn] = useState("master");
  const [stationClient, setStationClient] = useState(null);

  postRef.current = post;

  useEffect(() => {
    void loadRampClientsCatalog();
  }, []);

  useEffect(() => {
    if (location.state?.openBolt) setBoltOpen(true);
  }, [location.state?.openBolt]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message) => {
    setToast(message);
  }, []);

  const schedulePostSave = useCallback((nextPost) => {
    if (!isRampRuntimeApiAvailable()) return;
    const id = nextPost?.id;
    if (!id || String(id).startsWith("ramp-post-")) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void patchRampPost(id, postToApiPatch(nextPost)).catch(() => {
        showToast("Could not save post");
      });
    }, SAVE_DEBOUNCE_MS);
  }, [showToast]);

  const updatePost = useCallback(
    (next) => {
      setPost((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (resolved?.id && !String(resolved.id).startsWith("ramp-post-")) {
          schedulePostSave(resolved);
        }
        return resolved;
      });
    },
    [schedulePostSave],
  );

  const setPostImmediate = useCallback((next) => {
    setPost((prev) => {
      if (prev?.heroImage && prev.heroImage !== next?.heroImage) {
        revokeRampObjectUrl(prev.heroImage);
      }
      if (prev?.generatedImage && prev.generatedImage !== next?.generatedImage) {
        revokeRampObjectUrl(prev.generatedImage);
      }
      return next;
    });
  }, []);

  const openBuild = useCallback(
    async (card, { syncUrl = true } = {}) => {
      const postId = card?.postId || card?.id;
      if (postId && isRampRuntimeApiAvailable() && !String(postId).startsWith("ramp-")) {
        try {
          const dto = await getRampPost(postId);
          if (dto) {
            const mapped = postFromApi(dto);
            setPostImmediate(mapped);
            resumeRampGenerationWatch(mapped.id, mapped.genState);
            setViewBack("master");
            setView("build");
            if (syncUrl && postId) {
              const path = rampQueuePath(postId);
              if (location.pathname !== path) navigate(path);
            }
            if (card?.armed) showToast("⚡ Before/After is armed");
            return;
          }
        } catch {
          showToast("Could not load post");
          return;
        }
      }

      setPostImmediate(postFromQueueCard(card));
      setViewBack("master");
      setView("build");
      if (syncUrl && postId) {
        const path = rampQueuePath(postId);
        if (location.pathname !== path) navigate(path);
      }
      if (card?.armed) showToast("⚡ Before/After is armed");
    },
    [location.pathname, navigate, setPostImmediate, showToast],
  );

  const exitBuild = useCallback(() => {
    const back = viewBack || "master";
    if (back === "master") {
      setView("master");
      loadedQueueIdRef.current = null;
      if (location.pathname !== rampMasterPath()) {
        navigate(rampMasterPath());
      }
      return;
    }
    setView(back);
  }, [location.pathname, navigate, viewBack]);

  useEffect(() => {
    const stateId = location.state?.rampQueueId || location.state?.rampVisitId;
    if (!stateId) return;
    navigate(rampQueuePath(stateId), { replace: true, state: null });
  }, [location.state?.rampQueueId, location.state?.rampVisitId, navigate]);

  useEffect(() => {
    if (!queueId) {
      loadedQueueIdRef.current = null;
      if (view === "build" && viewBack === "master") {
        setView("master");
      }
      return;
    }

    if (loadedQueueIdRef.current === queueId) return;
    loadedQueueIdRef.current = queueId;

    const item = findRampQueueItem(queueId);
    void openBuild(item || { id: queueId, postId: queueId }, { syncUrl: false });
  }, [openBuild, queueId, view, viewBack]);

  const startCapture = useCallback((who = "New client", ret = "master") => {
    setCaptureWho(who);
    setCaptureReturn(ret);
    setBoltOpen(false);
    setView("capture");
  }, []);

  useEffect(() => {
    return subscribeRampGenGlobal((event) => {
      if (event.status !== "done" || !event.result) return;
      const current = postRef.current;
      if (!current || String(current.id) !== String(event.postId)) return;
      setPost((prev) => {
        if (!prev || String(prev.id) !== String(event.postId)) return prev;
        return {
          ...prev,
          generatedImages: event.result.generatedImages ?? prev.generatedImages,
          generatedImage: event.result.generatedImage,
          buildPhase: event.result.buildPhase ?? "ship",
          genState: "done",
          status: event.result.status ?? "generated",
        };
      });
      showToast("Image generated");
      void refreshRampQueue();
    });
  }, [showToast]);

  useEffect(() => {
    const postId = post?.id;
    if (!postId || view !== "build") return;
    const gen = getRampGenState(postId);
    if (gen.status === "generating" || post.genState === "generating") {
      resumeRampGenerationWatch(postId, post.genState);
    }
  }, [post?.id, post?.genState, view]);

  useEffect(() => {
    const onBolt = () => setBoltOpen(true);
    window.addEventListener("salonx:ramp-open-bolt", onBolt);
    return () => window.removeEventListener("salonx:ramp-open-bolt", onBolt);
  }, []);

  const handleCaptureBack = useCallback(() => {
    if (pendingCapture?.imageUrl) {
      revokeRampObjectUrl(pendingCapture.imageUrl);
      setPendingCapture(null);
    }
    setView(captureReturn || "master");
  }, [captureReturn, pendingCapture]);

  const addCaptureToQueue = useCallback(
    async ({ name, clientId, sub, emoji = "🧑" }) => {
      if (!pendingCapture?.file && !pendingCapture?.imageUrl) {
        showToast("Capture a photo first");
        return;
      }
      try {
        let capturedUrl = pendingCapture.imageUrl;
        if (pendingCapture.file && isRampApiAvailable()) {
          capturedUrl = await uploadRampCapture(pendingCapture.file);
        }
        await addRampQueueItem({ name, clientId, sub, capturedUrl, emoji });
        revokeRampObjectUrl(pendingCapture.imageUrl);
        setPendingCapture(null);
        showToast("Added to queue ⚡");
        navigate("/screen1");
      } catch (err) {
        showToast(err?.message || "Could not add to queue");
      }
    },
    [navigate, pendingCapture, showToast],
  );

  const openStationBuild = useCallback(
    async (card, { capturedUrl, file } = {}) => {
      let heroImage = null;
      let capturedImages = [];

      if (file && isRampApiAvailable()) {
        heroImage = await uploadRampCapture(file);
        capturedImages = [heroImage];
      } else if (capturedUrl) {
        heroImage = capturedUrl;
        capturedImages = [capturedUrl];
      }

      if (isRampRuntimeApiAvailable()) {
        try {
          const presets = getRampBrandPresets();
          const dto = await createRampPostApi({
            clientName: card.name,
            clientId: card.clientId ?? null,
            clientSub: card.sub || card.meta,
            clientEmoji: card.emoji,
            source: "station",
            status: "building",
            caption: presets.caption,
            tags: presets.tags,
            links: presets.links,
            backgroundId: presets.backgrounds?.[0]?.id || "bg1",
            heroImage,
            capturedImages,
          });
          if (dto) {
            setPostImmediate(postFromApi(dto));
            setViewBack("station");
            setView("build");
            navigate(rampQueuePath(dto.id));
            return;
          }
        } catch {
          showToast("Could not create post");
          throw new Error("Could not create post");
        }
        showToast("Could not create post");
        throw new Error("Could not create post");
      }
      setPostImmediate(
        createRampPost({
          target: { name: card.name, sub: card.sub || card.meta || "Station build" },
          clientId: card.clientId ?? null,
          heroEmoji: card.emoji || "🧑",
          thumbClass: card.thumb || "t1",
          source: "station",
          status: "building",
          heroImage,
          capturedImages,
        }),
      );
      setViewBack("station");
      setView("build");
    },
    [navigate, setPostImmediate, showToast],
  );

  const startStationCapture = useCallback((card) => {
    setStationClient(card);
    setCaptureWho(card.name);
    setCaptureReturn("station");
    setView("capture");
  }, []);

  const finishStationBuild = useCallback(
    async ({ file, imageUrl }) => {
      const card = stationClient;
      if (!card) return;

      try {
        showToast("Uploading…");
        await openStationBuild(card, { capturedUrl: imageUrl, file });
        revokeRampObjectUrl(imageUrl);
        setPendingCapture(null);
        setStationClient(null);
      } catch (err) {
        showToast(err?.message || "Could not create post");
      }
    },
    [stationClient, openStationBuild, showToast],
  );

  const afterCapture = useCallback(
    (file) => {
      if (!file) return;
      const url = URL.createObjectURL(file);
      setPendingCapture({ file, imageUrl: url });

      if (stationClient) {
        void finishStationBuild({ file, imageUrl: url });
        return;
      }

      setView("assign");
      showToast("Select client");
    },
    [finishStationBuild, showToast, stationClient],
  );

  const reloadPost = useCallback(async (postId) => {
    if (!postId || !isRampRuntimeApiAvailable()) return;
    const dto = await getRampPost(postId);
    if (dto) setPostImmediate(postFromApi(dto));
  }, [setPostImmediate]);

  const openImportSheet = useCallback((emoji) => {
    setImportEmoji(emoji || "🖼️");
    setImportOpen(true);
  }, []);

  const closeImportSheet = useCallback(() => setImportOpen(false), []);

  const confirmImport = useCallback(() => {
    if (post) {
      updatePost({
        ...post,
        heroEmoji: importEmoji,
        heroImage: null,
        editSteps: { ...post.editSteps, hero: true },
      });
    }
    closeImportSheet();
    showToast("Imported & attributed ⚡");
    setView("edit");
  }, [closeImportSheet, importEmoji, post, showToast, updatePost]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const ctx = useMemo(
    () => ({
      view,
      setView,
      viewBack,
      setViewBack,
      post,
      updatePost,
      openBuild,
      exitBuild,
      openStationBuild,
      startStationCapture,
      reloadPost,
      showToast,
      startCapture,
      afterCapture,
      handleCaptureBack,
      captureWho,
      captureReturn,
      stationClient,
      pendingCapture,
      addCaptureToQueue,
      openImportSheet,
      closeImportSheet,
      confirmImport,
      importOpen,
      importEmoji,
    }),
    [
      view,
      viewBack,
      post,
      updatePost,
      openBuild,
      exitBuild,
      openStationBuild,
      startStationCapture,
      reloadPost,
      showToast,
      startCapture,
      afterCapture,
      handleCaptureBack,
      captureWho,
      captureReturn,
      stationClient,
      pendingCapture,
      addCaptureToQueue,
      openImportSheet,
      closeImportSheet,
      confirmImport,
      importOpen,
      importEmoji,
    ],
  );

  const ActiveView = VIEWS[view] || QueueView;

  return (
    <RampContext value={ctx}>
      <div className="rampx">
        <ActiveView />

        <Sheet open={boltOpen} onClose={() => setBoltOpen(false)}>
          <div className="bolt-ic">⚡</div>
          <div className="ttl">RAMP</div>
          <Choice
            primary
            icon="📸"
            title="Take a photo"
            desc="Capture now → set the client → queue"
            onClick={() => startCapture("New client", "master")}
          />
          <Choice
            icon="🛠️"
            title="Open RAMP Station"
            desc="Free-build a post — no appointment needed"
            onClick={() => {
              setBoltOpen(false);
              setView("station");
            }}
          />
        </Sheet>

        <ImportSheet />

        <BottomToolbar activeIndex={2} originPath={location.pathname} />
        <Toast message={toast} />
      </div>
    </RampContext>
  );
}
