export function makeSoundConfig(provider, rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) throw new Error('Cole o link de uma música, álbum ou playlist.');

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Esse link não parece ser uma URL válida.');
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (provider === 'spotify') {
    if (!['open.spotify.com', 'spotify.com', 'play.spotify.com'].includes(host)) {
      throw new Error('Cole um link do Spotify, como open.spotify.com/track/... ou /playlist/....');
    }
    const parts = url.pathname.split('/').filter(Boolean);
    let offset = parts[0] === 'embed' ? 1 : 0;
    if (/^intl-[a-z]{2}$/i.test(parts[offset] || '')) offset += 1;
    const kind = parts[offset];
    const id = parts[offset + 1];
    if (!['track', 'album', 'playlist', 'episode', 'show'].includes(kind) || !id) {
      throw new Error('O link do Spotify precisa ser de uma música, álbum, playlist, episódio ou programa.');
    }
    return {
      provider: 'spotify',
      label: `Spotify · ${kind === 'track' ? 'Música' : kind === 'album' ? 'Álbum' : kind === 'playlist' ? 'Playlist' : 'Áudio'}`,
      sourceUrl: url.href,
      embedUrl: `https://open.spotify.com/embed/${kind}/${encodeURIComponent(id)}?utm_source=generator&theme=0`,
      kind,
    };
  }

  if (provider === 'deezer') {
    if (!['deezer.com', 'dzr.page.link', 'deezer.page.link'].includes(host)) {
      throw new Error('Cole um link do Deezer, como deezer.com/track/... ou /playlist/....');
    }
    const parts = url.pathname.split('/').filter(Boolean);
    const knownKinds = ['track', 'album', 'playlist', 'artist', 'episode', 'podcast'];
    const index = parts.findIndex(part => knownKinds.includes(part));
    const kind = index >= 0 ? parts[index] : '';
    const id = index >= 0 ? parts[index + 1] : '';
    if (!kind || !id || !/^\d+$/.test(id)) {
      throw new Error('Não consegui identificar o conteúdo. Use um link direto de música, álbum ou playlist do Deezer.');
    }
    return {
      provider: 'deezer',
      label: `Deezer · ${kind === 'track' ? 'Música' : kind === 'album' ? 'Álbum' : kind === 'playlist' ? 'Playlist' : 'Áudio'}`,
      sourceUrl: url.href,
      embedUrl: `https://widget.deezer.com/widget/dark/${kind}/${encodeURIComponent(id)}`,
      kind,
    };
  }
  throw new Error('Selecione Spotify ou Deezer.');
}
