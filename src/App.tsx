import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { StoreProvider, useStore } from './store';
import { APP_NAME } from './config';
import { StudyPage } from './pages/StudyPage';
import { DeckPage } from './pages/DeckPage';
import { SettingsPage } from './pages/SettingsPage';
import { Icon } from './components/Icon';

type Tab = 'study' | 'cards' | 'settings';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'study', label: 'Study', icon: 'study' },
  { id: 'cards', label: 'Cards', icon: 'cards' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const fromHash = (): Tab => {
  const h = location.hash.replace('#', '') as Tab;
  return TABS.some((t) => t.id === h) ? h : 'study';
};

function Shell() {
  const { owner, cloud, loading, loadError, reload, toasts } = useStore();
  const [tab, setTabState] = useState<Tab>(fromHash);

  useEffect(() => {
    const onHash = () => setTabState(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const setTab = (t: Tab) => {
    history.replaceState(null, '', `#${t}`);
    setTabState(t);
  };

  const nav = (where: 'top' | 'bottom') => (
    <nav className={`tabs tabs-${where}`} aria-label="Sections">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
          {tab === t.id && <motion.span layoutId={`tab-pill-${where}`} className="tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          <span className="tab-inner">
            <Icon name={t.icon} size={where === 'bottom' ? 22 : 18} />
            <span>{t.label}</span>
          </span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#study" onClick={(e) => (e.preventDefault(), setTab('study'))}>
          <motion.img src="./onion.svg" alt="" width={40} height={40} whileHover={{ rotate: [0, -12, 12, 0] }} transition={{ duration: 0.5 }} />
          <span>{APP_NAME}</span>
        </a>
        {nav('top')}
        {cloud && (
          <button className={owner ? 'lock-pill on' : 'lock-pill'} onClick={() => setTab('settings')} title={owner ? 'Editing unlocked' : 'View only'}>
            <Icon name={owner ? 'unlock' : 'lock'} size={14} />
            <span>{owner ? 'Editing' : 'View only'}</span>
          </button>
        )}
      </header>

      <main>
        {loadError ? (
          <div className="empty">
            <h2>Couldn't load cards</h2>
            <p className="muted">{loadError}</p>
            <button className="btn primary" onClick={reload}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="loader">
            <motion.img src="./onion.svg" alt="Loading" width={48} height={48} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }} />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {tab === 'study' && <StudyPage goCards={() => setTab('cards')} />}
              {tab === 'cards' && <DeckPage />}
              {tab === 'settings' && <SettingsPage />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {nav('bottom')}

      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              className={`toast ${t.tone}`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </MotionConfig>
  );
}
