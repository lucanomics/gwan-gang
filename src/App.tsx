import { Suspense, lazy, useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BarChart3, BookOpen, FileText, Home as HomeIcon, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from './lib/store';
import HomePage from './routes/HomePage';
import SessionPage from './routes/SessionPage';

// Secondary screens are split out so the home -> Quick 10 path stays instant.
const StudyPage = lazy(() => import('./routes/StudyPage'));
const WrongPage = lazy(() => import('./routes/WrongPage'));
const MockPage = lazy(() => import('./routes/MockPage'));
const MockRunPage = lazy(() => import('./routes/MockRunPage'));
const MockResultPage = lazy(() => import('./routes/MockResultPage'));
const StatsPage = lazy(() => import('./routes/StatsPage'));
const DataPage = lazy(() => import('./routes/DataPage'));
const StudyPackPage = lazy(() => import('./routes/StudyPackPage'));
const FinalReviewPage = lazy(() => import('./routes/FinalReviewPage'));

const TABS = [
  { to: '/', label: '홈', icon: HomeIcon },
  { to: '/study', label: '학습', icon: BookOpen },
  { to: '/wrong', label: '오답', icon: RotateCcw },
  { to: '/mock', label: '모의고사', icon: FileText },
  { to: '/stats', label: '통계', icon: BarChart3 },
] as const;

/** The runner screens hide the tab bar so nothing competes with the question. */
const IMMERSIVE = ['/session', '/mock/run'];

function Fallback() {
  return (
    <div className="p-6 text-center text-sm text-ink-500" role="status">
      불러오는 중…
    </div>
  );
}

export default function App() {
  const boot = useStore((s) => s.boot);
  const ready = useStore((s) => s.ready);
  const bootError = useStore((s) => s.bootError);
  const persistError = useStore((s) => s.persistError);
  const location = useLocation();

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const immersive = IMMERSIVE.some((path) => location.pathname.startsWith(path));

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-ink-500" role="status">
        GWAN-GANG 준비 중…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col">
      {bootError ? (
        <p role="alert" className="bg-rose-600 px-4 py-2 text-center text-xs font-semibold text-white">
          {bootError}
        </p>
      ) : null}
      {persistError ? (
        <p role="alert" className="bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-ink-900">
          저장 오류: {persistError}
        </p>
      ) : null}

      <main
        className={clsx('flex-1 px-4 pt-4', immersive ? 'pb-6' : 'pb-24')}
        style={{ paddingBottom: immersive ? undefined : 'calc(6rem + env(safe-area-inset-bottom))' }}
      >
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/session" element={<SessionPage />} />
            <Route path="/study" element={<StudyPage />} />
            <Route path="/wrong" element={<WrongPage />} />
            <Route path="/final" element={<FinalReviewPage />} />
            <Route path="/mock" element={<MockPage />} />
            <Route path="/mock/run" element={<MockRunPage />} />
            <Route path="/mock/result/:id" element={<MockResultPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="/ai" element={<StudyPackPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {immersive ? null : <TabBar />}
    </div>
  );
}

function TabBar() {
  return (
    <nav
      aria-label="주요 화면"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-screen-sm border-t border-ink-200 bg-white/95 backdrop-blur dark:border-ink-800 dark:bg-ink-950/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors',
                  isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.8} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
