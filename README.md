# Demo OAuth 2.0 (Authorization Code) con GitHub

## Requisitos
- Node.js 18 o superior
- Una cuenta de GitHub

## Pasos
1. **Registrar la app en GitHub**: Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/callback`
2. Copia el **Client ID** y genera un **Client Secret**.

3. `npm install`
4. `npm start`
5. Abre `http://localhost:3000` y pulsa "Iniciar sesión con GitHub".

## Flujo
Usuario → /login → GitHub (autoriza) → /callback?code → servidor cambia code por token → API de GitHub → sesión → /perfil
