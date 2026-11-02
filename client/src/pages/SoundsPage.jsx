import { useEffect, useState } from 'react';
import { AudioLines, CheckCircle2, ExternalLink, Music2, Play, Radio, Sparkles, Trash2 } from 'lucide-react';
import { makeSoundConfig } from '../services/soundUtils';

const STORAGE_KEY = 'oficinapro_sound_player';

export default function SoundsPage() {
  const [provider, setProvider] = useState('spotify');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  });

  useEffect(() => {
    const sync = () => {
      try { setCurrent(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
      catch { setCurrent(null); }
    };
    window.addEventListener('oficinapro:sound-player', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('oficinapro:sound-player', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const start = (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const config = makeSoundConfig(provider, url);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      window.dispatchEvent(new Event('oficinapro:sound-player'));
      setCurrent(config);
      setMessage('Player ativado. Ele continuará aberto enquanto você navega pelo OficinaPro. Pressione Play no player para iniciar o áudio.');
    } catch (e) {
      setError(e.message || 'Não foi possível abrir esse conteúdo.');
    }
  };

  const stop = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('oficinapro:sound-player'));
    setCurrent(null);
    setMessage('Player removido.');
  };

  return <div className="sounds-page">
    <div className="page-heading">
      <div><span className="eyebrow">AMBIENTE DE TRABALHO</span><h1>Sounds</h1><p>Escolha uma música ou playlist para tocar enquanto usa o OficinaPro.</p></div>
      <div className="sounds-heading-icon"><AudioLines size={24}/></div>
    </div>

    <section className="sounds-hero">
      <div className="sounds-hero-icon"><Music2 size={28}/></div>
      <div><span className="sounds-kicker">OFICINAPRO SOUNDS</span><h2>Sua trilha sonora, sem sair do sistema.</h2><p>Configure uma música, álbum ou playlist. O player fica disponível mesmo quando você troca de aba.</p></div>
      <Radio className="sounds-hero-decoration" size={74}/>
    </section>

    {error && <div className="error" role="alert">{error}</div>}
    {message && <div className="notice sounds-notice"><CheckCircle2 size={17}/>{message}</div>}

    <div className="sounds-grid">
      <section className="panel sounds-config-panel">
        <div className="panel-head"><div><h2><Play size={18}/> Conectar um player</h2><p>Escolha uma plataforma e cole o link do conteúdo.</p></div></div>
        <div className="provider-cards">
          <button type="button" className={`provider-card spotify ${provider === 'spotify' ? 'selected' : ''}`} onClick={() => { setProvider('spotify'); setError(''); }}>
            <span className="provider-logo spotify-logo">●</span><span><b>Spotify</b><small>Músicas, álbuns e playlists</small></span><span className="provider-check">{provider === 'spotify' ? <CheckCircle2 size={18}/> : null}</span>
          </button>
          <button type="button" className={`provider-card deezer ${provider === 'deezer' ? 'selected' : ''}`} onClick={() => { setProvider('deezer'); setError(''); }}>
            <span className="provider-logo deezer-logo"><i/><i/><i/><i/><i/><i/></span><span><b>Deezer</b><small>Músicas, álbuns e playlists</small></span><span className="provider-check">{provider === 'deezer' ? <CheckCircle2 size={18}/> : null}</span>
          </button>
        </div>
        <form className="form sounds-form" onSubmit={start}>
          <label>Link do {provider === 'spotify' ? 'Spotify' : 'Deezer'}
            <input type="url" required value={url} onChange={e => setUrl(e.target.value)} placeholder={provider === 'spotify' ? 'https://open.spotify.com/playlist/...' : 'https://www.deezer.com/playlist/...'} />
          </label>
          <p className="field-help">Abra a música ou playlist na plataforma, use <b>Compartilhar → Copiar link</b> e cole aqui.</p>
          <button className="btn full" type="submit"><Play size={16}/> Ativar player</button>
        </form>
        <div className="sounds-external-links">
          <a href="https://open.spotify.com/" target="_blank" rel="noreferrer">Abrir Spotify <ExternalLink size={13}/></a>
          <a href="https://www.deezer.com/" target="_blank" rel="noreferrer">Abrir Deezer <ExternalLink size={13}/></a>
        </div>
      </section>

      <section className="panel sounds-current-panel">
        <div className="panel-head"><div><h2><AudioLines size={18}/> Player atual</h2><p>Este player permanece montado durante a navegação.</p></div></div>
        {current ? <div className="current-sound-card">
          <div className={`current-provider-icon ${current.provider}`}><Music2 size={23}/></div>
          <div className="current-sound-meta"><b>{current.label || 'Conteúdo de áudio'}</b><small>{current.provider === 'spotify' ? 'Spotify' : 'Deezer'}</small><a href={current.sourceUrl} target="_blank" rel="noreferrer">Abrir conteúdo original <ExternalLink size={12}/></a></div>
          <button className="icon-button sounds-remove" title="Parar e remover player" onClick={stop}><Trash2 size={16}/></button>
          <div className="current-sound-status"><span className="sound-status-dot"/> Configurado · disponível em todas as abas</div>
        </div> : <div className="sounds-empty"><div><Music2 size={28}/></div><b>Nenhuma música selecionada</b><p>Escolha Spotify ou Deezer e cole o link de uma música ou playlist para começar.</p></div>}
        <div className="sounds-info"><Sparkles size={17}/><p><b>Dica:</b> playlists são práticas para deixar uma seleção tocando durante o expediente. A reprodução é controlada pelo player oficial da plataforma.</p></div>
      </section>
    </div>

    <section className="sounds-disclaimer"><b>Sobre login e reprodução</b><p>O OficinaPro usa os players incorporados oficiais. Se a plataforma solicitar login, faça-o no próprio player ou abra o serviço em uma nova aba. A disponibilidade de faixas completas, anúncios e controles depende da conta e das regras de cada serviço. Este recurso não armazena sua senha de Spotify ou Deezer.</p></section>
  </div>;
}
