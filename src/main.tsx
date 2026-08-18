import { initSentry } from '@/lib/sentry';
initSentry();

import { useEffect, lazy, Suspense, type ReactNode, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { useAuthStore } from '@/stores/authStore';
import { SUPABASE_CONFIG_ERROR } from '@/lib/supabase';
import SupabaseConfigScreen from '@/components/SupabaseConfigScreen';
import { applyAppearance, loadAppearance } from '@/lib/appearance';
import ErrorBoundary from '@/components/ErrorBoundary';
import ToastContainer from '@/components/ToastContainer';
import StartupLogo from '@/components/StartupLogo';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Layout from '@/pages/Layout';
import './App.css';
import './styles/animations.css';
import 'mapbox-gl/dist/mapbox-gl.css';

const Chat = lazy(() => import('@/pages/Chat'));
const Apps = lazy(() => import('@/pages/Apps'));
const Calls = lazy(() => import('@/pages/Calls'));
const Search = lazy(() => import('@/pages/Search'));
const AdminAccess = lazy(() => import('@/pages/AdminAccess'));
const AdminMediaCleanup = lazy(() => import('@/pages/AdminMediaCleanup'));
const AdminData = lazy(() => import('@/pages/AdminData'));
const AdminUsers = lazy(() => import('@/pages/AdminUsers'));
const AdminReports = lazy(() => import('@/pages/AdminReports'));
const AdminFeedback = lazy(() => import('@/pages/AdminFeedback'));
const StatusAdmin = lazy(() => import('@/pages/StatusAdmin'));
const CreatePost = lazy(() => import('@/pages/CreatePost'));
const UserProfile = lazy(() => import('@/pages/UserProfile'));
const Playlists = lazy(() => import('@/pages/Playlists'));
const CreatePlaylist = lazy(() => import('@/pages/CreatePlaylist'));
const PlaylistView = lazy(() => import('@/pages/PlaylistView'));
const EventsList = lazy(() => import('@/pages/EventsList'));
const CreateEvent = lazy(() => import('@/pages/CreateEvent'));
const EventView = lazy(() => import('@/pages/EventView'));
const EventExpenses = lazy(() => import('@/pages/EventExpenses'));
const EditEvent = lazy(() => import('@/pages/EditEvent'));
const PostView = lazy(() => import('@/pages/PostView'));
const StoryEditor = lazy(() => import('@/pages/StoryEditor'));
const EventRoute = lazy(() => import('@/pages/EventRoute'));
const ChessLobby = lazy(() => import('@/pages/ChessLobby'));
const CreateChessGame = lazy(() => import('@/pages/CreateChessGame'));
const ChessGame = lazy(() => import('@/pages/ChessGame'));
const AliasLocal = lazy(() => import('@/pages/AliasLocal'));
const AliasCategories = lazy(() => import('@/pages/AliasCategories'));
const AliasCategoryEditor = lazy(() => import('@/pages/AliasCategoryEditor'));
const TruthOrDare = lazy(() => import('@/pages/TruthOrDare'));
const MyQuizzes = lazy(() => import('@/pages/MyQuizzes'));
const QuizEditor = lazy(() => import('@/pages/QuizEditor'));
const QuizPlay = lazy(() => import('@/pages/QuizPlay'));
const TodCategories = lazy(() => import('@/pages/TodCategories'));
const TodCategoryEditor = lazy(() => import('@/pages/TodCategoryEditor'));
const NotesLobby = lazy(() => import('@/pages/NotesLobby'));
const EduSettings = lazy(() => import('@/pages/EduSettings'));
const NotesTrainer = lazy(() => import('@/pages/NotesTrainer'));
const Appearance = lazy(() => import('@/pages/Appearance'));
const NotificationSettings = lazy(() => import('@/pages/NotificationSettings'));
const Games = lazy(() => import('@/pages/Games'));
const ForFedya = lazy(() => import('@/pages/ForFedya'));
const LanguagesLobby = lazy(() => import('@/pages/LanguagesLobby'));
const GrammarTrainer = lazy(() => import('@/pages/GrammarTrainer'));
const LevelTest = lazy(() => import('@/pages/LevelTest'));
const WeakWords = lazy(() => import('@/pages/WeakWords'));
const LanguagesLeaderboard = lazy(() => import('@/pages/LanguagesLeaderboard'));
const LanguageCourse = lazy(() => import('@/pages/LanguageCourse'));
const LanguageAchievements = lazy(() => import('@/pages/LanguageAchievements'));
const Flashcards = lazy(() => import('@/pages/Flashcards'));
const WordList = lazy(() => import('@/pages/WordList'));
const VocabSets = lazy(() => import('@/pages/VocabSets'));
const VocabSetEditor = lazy(() => import('@/pages/VocabSetEditor'));
const VocabSetStudy = lazy(() => import('@/pages/VocabSetStudy'));
const PracticeGames = lazy(() => import('@/pages/PracticeGames'));
const LanguageTrainer = lazy(() => import('@/pages/LanguageTrainer'));
const LanguageReadings = lazy(() => import('@/pages/LanguageReadings'));
const LanguageProgress = lazy(() => import('@/pages/LanguageProgress'));
const GmatTest = lazy(() => import('@/pages/GmatTest'));
const MapPage = lazy(() => import('@/pages/MapPage'));
const PixelBoard = lazy(() => import('@/pages/PixelBoard'));
const DiagPage = lazy(() => import('@/pages/DiagPage'));
const StorageAdmin = lazy(() => import('@/pages/StorageAdmin'));
const FeedbackHub = lazy(() => import('@/pages/FeedbackHub'));

const StaticSplash = () => (
  <div
    aria-label="Загрузка Sigmas"
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FFFFFF',
      color: '#20212B',
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <StartupLogo size={154} />
      <div style={{ fontSize: 48, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.035em' }}>Sigmas</div>
    </div>
  </div>
);

const PageFallback = () => (
  <div className="page-lazy-fallback" aria-label="Загрузка страницы">
    <div className="spinner" />
  </div>
);

const mapFallback = (
  <div className="map-lazy-fallback" aria-label="Загрузка карты">
    <div className="spinner" />
  </div>
);

function page(Comp: LazyExoticComponent<ComponentType>, fallback: ReactNode = <PageFallback />) {
  return (
    <Suspense fallback={fallback}>
      <Comp />
    </Suspense>
  );
}

// BUG FIX #1: Theme init from localStorage BEFORE React renders
const saved = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', saved);

// Apply appearance settings (bubble radius, text size, colors) BEFORE render
applyAppearance(loadAppearance());

// iOS standalone иногда запускает PWA с укороченным visualViewport и
// исправляет его только после поворота. Для корневого layout используем
// стабильный размер screen, а visualViewport оставляем только как запасной.
let viewportSyncTimers: number[] = [];

function isStandalonePwa() {
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function readCssSafeBottom() {
  let measured = 0;
  try {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:0;bottom:0;width:1px;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    measured = Math.round(probe.getBoundingClientRect().height || 0);
    probe.remove();
  } catch { measured = 0; }

  const isIPhone = /iPhone/i.test(navigator.userAgent);
  const longestScreenSide = Math.max(window.screen?.width || 0, window.screen?.height || 0);
  const likelyHomeIndicator = isIPhone && longestScreenSide >= 812;

  // При первом запуске WebKit может вернуть 0 либо 80–150 px. На iPhone с
  // home indicator используем стабильные 34 px, иначе реальное значение.
  if (likelyHomeIndicator && (measured <= 0 || measured > 34)) return 34;
  return Math.max(0, Math.min(34, measured));
}

function readStableAppHeight() {
  const portrait = window.matchMedia?.('(orientation: portrait)').matches ?? (window.innerHeight >= window.innerWidth);
  const screenWidth = window.screen?.width || 0;
  const screenHeight = window.screen?.height || 0;
  const screenAxisHeight = portrait
    ? Math.max(screenWidth, screenHeight)
    : Math.min(screenWidth, screenHeight);
  const viewportHeight = Math.max(
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0,
    window.visualViewport?.height || 0,
  );

  // В standalone screen.* — стабильный CSS-размер физического экрана и не
  // страдает от стартового бага visualViewport.
  const candidate = isStandalonePwa() && screenAxisHeight > 0
    ? Math.max(viewportHeight, screenAxisHeight)
    : viewportHeight;
  return Math.max(1, Math.round(candidate));
}

function syncViewportMetrics() {
  const safeBottom = readCssSafeBottom();
  const appHeight = readStableAppHeight();
  document.documentElement.style.setProperty('--safe-bottom', `${safeBottom}px`);
  document.documentElement.style.setProperty('--app-height', `${appHeight}px`);

  // Скрытая диагностика: добавляется только при ?viewportDebug=1.
  if (new URLSearchParams(window.location.search).get('viewportDebug') === '1') {
    let debug = document.getElementById('sigmas-viewport-debug');
    if (!debug) {
      debug = document.createElement('pre');
      debug.id = 'sigmas-viewport-debug';
      debug.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:999999;margin:0;padding:7px 9px;border-radius:8px;background:rgba(0,0,0,.82);color:#7CFF9B;font:10px/1.35 ui-monospace,monospace;pointer-events:none;white-space:pre-wrap';
      document.body.appendChild(debug);
    }
    debug.textContent = [
      `app=${appHeight} safe=${safeBottom}`,
      `inner=${window.innerHeight} client=${document.documentElement.clientHeight}`,
      `visual=${Math.round(window.visualViewport?.height || 0)}`,
      `screen=${window.screen?.width || 0}x${window.screen?.height || 0}`,
      `standalone=${isStandalonePwa() ? 'yes' : 'no'}`,
    ].join('\n');
  }

  window.dispatchEvent(new CustomEvent('sigmas:viewportmetrics', {
    detail: { safeBottom, viewportHeight: appHeight },
  }));
}

function scheduleViewportSync() {
  viewportSyncTimers.forEach(window.clearTimeout);
  viewportSyncTimers = [];
  requestAnimationFrame(syncViewportMetrics);
  [40, 120, 300, 700, 1400, 2600].forEach(delay => {
    viewportSyncTimers.push(window.setTimeout(syncViewportMetrics, delay));
  });
}

scheduleViewportSync();
window.addEventListener('resize', scheduleViewportSync);
window.addEventListener('orientationchange', scheduleViewportSync);
window.addEventListener('pageshow', scheduleViewportSync);
window.visualViewport?.addEventListener('resize', scheduleViewportSync);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleViewportSync();
});

function Guard({ children }: { children: ReactNode }) {
  const { session, initialized, accessStatus } = useAuthStore();

  // 1. Ждём только пока авторизация ВООБЩЕ не инициализировалась (getSession не вернул)
  //    Обычно ~50-300 ms. Это короткое окно.
  if (!initialized) {
    return <StaticSplash />;
  }

  // 2. Нет сессии → логин
  if (!session) return <Navigate to="/login" replace />;

  if (accessStatus === 'checking') {
    return <StaticSplash />;
  }
  if (accessStatus !== 'approved') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRedirect({ children }: { children: ReactNode }) {
  const { session, initialized, accessStatus } = useAuthStore();
  if (!initialized) return <StaticSplash />;
  if (session && accessStatus === 'checking') return <StaticSplash />;
  if (session && accessStatus === 'approved') return <Navigate to="/" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: '/login', element: <AuthRedirect><Login /></AuthRedirect> },
  { path: '/register', element: <AuthRedirect><Register /></AuthRedirect> },
  { path: '/', element: <Guard><Layout /></Guard>, children: [
    { index: true, element: <Navigate to="/chats" replace /> },
    { path: 'chats', element: null },
    { path: 'chat/:id', element: page(Chat) },
    { path: 'calls', element: page(Calls) },
    { path: 'search', element: page(Search) },
    { path: 'apps', element: page(Apps) },
    { path: 'feedback', element: page(FeedbackHub) },
    { path: 'admin/access', element: page(AdminAccess) },
    { path: 'admin/media-cleanup', element: page(AdminMediaCleanup) },
    { path: 'admin/data', element: page(AdminData) },
    { path: 'admin/users', element: page(AdminUsers) },
    { path: 'admin/reports', element: page(AdminReports) },
    { path: 'admin/feedback', element: page(AdminFeedback) },
    { path: 'map', element: page(MapPage, mapFallback) },
    { path: 'music', element: page(Playlists) },
    { path: 'music/new', element: page(CreatePlaylist) },
    { path: 'music/:id', element: page(PlaylistView) },
    { path: 'pixel', element: page(PixelBoard, mapFallback) },
    { path: 'games', element: page(Games) },
    { path: 'fedya', element: page(ForFedya) },
    { path: 'quizzes', element: page(MyQuizzes) },
    { path: 'quizzes/new', element: page(QuizEditor) },
    { path: 'quizzes/:id/edit', element: page(QuizEditor) },
    { path: 'quizzes/:id', element: page(QuizPlay) },
    { path: 'languages', element: page(LanguagesLobby, null) },
    { path: 'languages/leaderboard', element: page(LanguagesLeaderboard, null) },
    { path: 'gmat', element: page(GmatTest, null) },
    { path: 'languages/:lang', element: page(LanguageCourse, null) },
    { path: 'languages/:lang/reading', element: page(LanguageReadings, null) },
    { path: 'languages/:lang/grammar', element: page(GrammarTrainer, null) },
    { path: 'languages/:lang/test/:level', element: page(LevelTest, null) },
    { path: 'languages/:lang/review', element: page(WeakWords, null) },
    { path: 'languages/:lang/achievements', element: page(LanguageAchievements, null) },
    { path: 'languages/:lang/flashcards', element: page(Flashcards, null) },
    { path: 'languages/:lang/words', element: page(WordList, null) },
    { path: 'languages/:lang/progress', element: page(LanguageProgress, null) },
    { path: 'languages/:lang/practice', element: page(PracticeGames, null) },
    { path: 'vocab', element: page(VocabSets, null) },
    { path: 'vocab/new', element: page(VocabSetEditor, null) },
    { path: 'vocab/:id/edit', element: page(VocabSetEditor, null) },
    { path: 'vocab/:id', element: page(VocabSetStudy, null) },
    { path: 'learn/settings', element: page(EduSettings) },
    { path: 'languages/:lang/learn/:courseId', element: page(LanguageTrainer, null) },
    { path: 'calendar', element: null },
    { path: 'parties', element: page(EventsList, null) },
    { path: 'trips', element: page(EventsList, null) },
    { path: 'events/new', element: page(CreateEvent) },
    { path: 'events/:id', element: page(EventView) },
    { path: 'events/:id/edit', element: page(EditEvent) },
    { path: 'events/:id/expenses', element: page(EventExpenses) },
    { path: 'events/:id/route', element: page(EventRoute, mapFallback) },
    { path: 'chess', element: page(ChessLobby) },
    { path: 'chess/create', element: page(CreateChessGame) },
    { path: 'chess/:id', element: page(ChessGame) },
    { path: 'alias', element: page(AliasLocal) },
    { path: 'alias/categories', element: page(AliasCategories) },
    { path: 'alias/category/new', element: page(AliasCategoryEditor) },
    { path: 'alias/category/:id', element: page(AliasCategoryEditor) },
    { path: 'tod', element: page(TruthOrDare) },
    { path: 'tod/categories', element: page(TodCategories) },
    { path: 'tod/category/new', element: page(TodCategoryEditor) },
    { path: 'tod/category/:id', element: page(TodCategoryEditor) },
    { path: 'notes', element: page(NotesLobby) },
    { path: 'notes/play/:level', element: page(NotesTrainer) },
    { path: 'profile', element: null },
    { path: 'profile/appearance', element: page(Appearance) },
    { path: 'profile/notifications', element: page(NotificationSettings) },
    { path: 'feed', element: null },
    { path: 'feed/new', element: page(CreatePost) },
    { path: 'p/:id', element: page(PostView) },
    { path: 'stories/new', element: page(StoryEditor) },
    { path: 'status-admin', element: page(StatusAdmin) },
    { path: 'u/:userId', element: page(UserProfile) },
    { path: 'diag', element: page(DiagPage, null) },
    { path: 'storage-admin', element: page(StorageAdmin, null) },
  ]},
  { path: '*', element: <Navigate to="/login" replace /> },
]);

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    if (!SUPABASE_CONFIG_ERROR) initialize();
  }, [initialize]);

  return (
    <ErrorBoundary name="app-root" variant="page">
      {SUPABASE_CONFIG_ERROR ? <SupabaseConfigScreen /> : <RouterProvider router={router} />}
      <ToastContainer />
    </ErrorBoundary>
  );
}

(window as any).__SIGMAS_BOOT_OK = true;

createRoot(document.getElementById('root')!).render(<App />);
