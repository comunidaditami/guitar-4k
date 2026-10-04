const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const execFileP = promisify(execFile);
const app = express();
app.use(cors());

const CACHE = path.join(__dirname, 'cache');
fs.mkdirSync(CACHE, { recursive: true });

app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Falta q' });
  try {
    const { stdout } = await execFileP('yt-dlp', [
      `ytsearch10:${q}`,
      '--dump-json',
      '--flat-playlist',
      '--no-warnings'
    ], { maxBuffer: 30 * 1024 * 1024 });

    const results = stdout.trim().split('\n').filter(Boolean).map(l => {
      const j = JSON.parse(l);
      return {
        id: j.id,
        title: j.title,
        duration: j.duration,
        thumbnail: j.thumbnail || (j.thumbnails && j.thumbnails[0] && j.thumbnails[0].url),
        uploader: j.uploader || j.channel
      };
    });
    res.json({ results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/audio', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Falta id' });

  const hash = crypto.createHash('md5').update(id).digest('hex');
  const cached = path.join(CACHE, `${hash}.mp3`);

  try {
    if (!fs.existsSync(cached)) {
await execFileP('yt-dlp', [
  `https://www.youtube.com/watch?v=${id}`,
  '-f', 'bestaudio',
  '-x',
  '--audio-format', 'mp3',
  '--audio-quality', '5',
  '-o', cached,
  '--no-warnings',
  '--js-runtimes', 'deno',
  '--extractor-args', 'youtube:player_client=default,-web_safari'
], { maxBuffer: 30 * 1024 * 1024 });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    fs.createReadStream(cached).pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log('Servidor en http://localhost:3000'));