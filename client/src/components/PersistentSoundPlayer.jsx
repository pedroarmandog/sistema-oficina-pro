import { useEffect, useState } from 'react';
import { AudioLines, ExternalLink, Minus, Music2, X } from 'lucide-react';

const STORAGE_KEY = 'oficinapro_sound_player';

export default function PersistentSoundPlayer() {
  const [config, setConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  });
  const [minimized, setMinimized] = useState(() => localStorage.getItem('oficinapro_sound_minimized') === '1');

  useEffect(() => {
    const sync = () => {
      try { setConfig(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
      catch { setConfig(null); }
    };
    window.addEventListener('oficinapro:sound-player', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('oficinapro:sound-player', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!config?.embedUrl) return null;
  const stop = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('oficinapro:sound-player'));
  };
  const toggleMinimized = () => setMinimized(value => {
    localStorage.setItem('oficinapro_sound_minimized', value ? '0' : '1');
    return !value;
  });

  return <aside className={`sound-dock ${minimized ? 'minimized' : ''}`} aria-label="Player de música persistente">
    <div className="sound-dock-head">
      <div className={`sound-dock-icon ${config.provider}`}><Music2 size={16}/></div>
      <div className="sound-dock-title"><b>{config.provider === 'spotify' ? 'Spotify' : 'Deezer'}</b><small>{config.label || 'Player de música'}</small></div>
      <a href={config.sourceUrl} target="_blank" rel="noreferrer" title="Abrir na plataforma"><ExternalLink size={14}/></a>
      <button type="button" onClick={toggleMinimized} title={minimized ? 'Expandir player' : 'Minimizar player'}><Minus size={15}/></button>
      <button type="button" onClick={stop} title="Fechar player e parar reprodução"><X size={16}/></button>
    </div>
    {!minimized && <div className="sound-dock-frame" style={{ height: config.kind === 'track' || config.kind === 'episode' ? 152 : (config.provider === 'spotify' ? 352 : 250) }}><iframe key={config.embedUrl} src={config.embedUrl} title={`Player ${config.provider}`} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager" referrerPolicy="strict-origin-when-cross-origin" /></div>}
    {minimized && <button className="sound-dock-expand" type="button" onClick={toggleMinimized}><AudioLines size={15}/> Player ativo · clique para expandir</button>}
  </aside>;
}
