require('dotenv').config();
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET, PORT = 3000 } = process.env;
if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.error('Falta GITHUB_CLIENT_ID o GITHUB_CLIENT_SECRET en el archivo .env');
  process.exit(1);
}

const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const app = express();

app.use(session({
  secret: SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));

// ---------- Utilidades de vista ----------
const esc = (s = '') => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const page = (title, body) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f4f5f7;display:grid;place-items:center;min-height:100vh;margin:0}
  .card{background:#fff;padding:2rem 2.5rem;border-radius:12px;box-shadow:0 4px 16px #0002;text-align:center;max-width:380px}
  .btn{display:inline-block;background:#24292f;color:#fff;padding:.7rem 1.4rem;border-radius:8px;text-decoration:none;margin-top:1rem}
  .btn.sec{background:#d1242f}
  img{width:96px;height:96px;border-radius:50%}
</style></head><body><div class="card">${body}</div></body></html>`;

// Middleware que protege rutas: solo pasa si hay sesión
const requireAuth = (req, res, next) =>
  req.session.user ? next() : res.redirect('/');


app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/perfil');
  res.send(page('Inicio', `
    <h1>Demo OAuth 2.0</h1>
    <p>Inicia sesión sin crear contraseña nueva.</p>
    <a class="btn" href="/login">Iniciar sesión con GitHub</a>`));
});


app.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex'); // protege contra CSRF
  req.session.oauthState = state;
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'read:user',
    state
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});


app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(page('Error', `<p>Acceso denegado: ${esc(error)}</p><a class="btn" href="/">Volver</a>`));

  // Validar state
  if (!state || state !== req.session.oauthState) {
    return res.status(403).send(page('Error', '<p>Parámetro state inválido.</p>'));
  }
  delete req.session.oauthState;

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI
      })
    });
    const { access_token } = await tokenRes.json();
    if (!access_token) throw new Error('No se obtuvo access_token');

    // PASO 4: usar el token para pedir datos a la API del proveedor
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'oauth-demo' }
    });
    const u = await userRes.json();

    // Guardaa solo lo necesario en sesión (el token no se envía al navegador)
    req.session.user = { login: u.login, name: u.name, avatar: u.avatar_url, url: u.html_url };
    res.redirect('/perfil');
  } catch (e) {
    console.error(e);
    res.status(500).send(page('Error', '<p>Falló la autenticación.</p><a class="btn" href="/">Volver</a>'));
  }
});

// Ruta protegida
app.get('/perfil', requireAuth, (req, res) => {
  const u = req.session.user;
  res.send(page('Perfil', `
    <img src="${esc(u.avatar)}" alt="avatar">
    <h2>${esc(u.name || u.login)}</h2>
    <p>@${esc(u.login)}</p>
    <a href="${esc(u.url)}" target="_blank" rel="noopener">Ver perfil en GitHub</a><br>
    <a class="btn sec" href="/logout">Cerrar sesión</a>`));
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

app.listen(PORT, () => console.log(`Servidor listo en http://localhost:${PORT}`));
