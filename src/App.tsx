import { useEffect, useState, type ComponentType } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { StoreProvider, useStore } from './store';
import { APP_NAME } from './config';
import { StudyPage } from './pages/StudyPage';
import { DeckPage } from './pages/DeckPage';
import { TonesPage } from './pages/TonesPage';
import { SettingsPage } from './pages/SettingsPage';
import { Icon } from './components/Icon';
import { Bamboo } from './components/Bamboo';
import { CardsIcon, SettingsIcon, StudyIcon, TonesIcon } from './components/NavIcons';

type Tab = 'study' | 'cards' | 'tones' | 'settings';
const TABS: { id: Tab; label: string; Icon: ComponentType }[] = [
  { id: 'study', label: 'Study', Icon: StudyIcon },
  { id: 'cards', label: 'Cards', Icon: CardsIcon },
  { id: 'tones', label: 'Tones', Icon: TonesIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

const fromHash = (): Tab => {
  const h = location.hash.replace('#', '') as Tab;
  return TABS.some((t) => t.id === h) ? h : 'study';
};

function Shell() {
  const { owner, cloud, loading, loadError, reload, toasts } = useStore();
  const [tab, setTabState] = useState<Tab>(fromHash);
  const [home, setHome] = useState(0);

  useEffect(() => {
    const onHash = () => setTabState(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const setTab = (t: Tab) => {
    history.replaceState(null, '', `#${t}`);
    setTabState(t);
  };
  /** Logo / title: back to the main screen, leaving any study session in progress. */
  const goHome = () => {
    setTab('study');
    setHome((h) => h + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nav = (where: 'top' | 'bottom') => (
    <nav className={`tabs tabs-${where}`} aria-label="Sections">
      {TABS.map((t) => (
        <motion.button
          key={t.id}
          className={tab === t.id ? 'tab active' : 'tab'}
          onClick={() => setTab(t.id)}
          aria-current={tab === t.id ? 'page' : undefined}
          aria-label={t.label}
          data-tip={t.label}
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileTap="hover"
          whileFocus="hover"
        >
          {tab === t.id && (
            <motion.span layoutId={`tab-pill-${where}`} className="tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
          )}
          <span className="tab-inner">
            <t.Icon />
          </span>
        </motion.button>
      ))}
    </nav>
  );

  return (
    <div className="app">
      <Bamboo />
      <header className="topbar">
        <a className="brand" href="#study" onClick={(e) => (e.preventDefault(), goHome())} aria-label={`${APP_NAME}, home`}>
          <motion.img
            src="./onion.svg"
            alt=""
            width={40}
            height={40}
            whileHover={{ rotate: [0, -12, 12, 0] }}
            whileTap={{ scale: 0.85 }}
            transition={{ duration: 0.5 }}
          />
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
            <motion.img
              src="./onion.svg"
              alt="Loading"
              width={48}
              height={48}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
            />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab + (tab === 'study' ? home : '')}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {tab === 'study' && <StudyPage goCards={() => setTab('cards')} />}
              {tab === 'cards' && <DeckPage />}
              {tab === 'tones' && <TonesPage />}
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
