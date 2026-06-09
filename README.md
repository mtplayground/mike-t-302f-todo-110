# mike-t-302f-todomvc-030

todomvc-030

## Self-Hosting

Set the environment variables from `.env.example`, then build and start the app:

```bash
npm ci
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
export HOST="0.0.0.0"
export PORT="8080"
npm run build
npm start
```

`npm start` applies pending Prisma migrations and starts the Express server on `HOST:PORT`.
The server serves the built React app from `client/dist` by default. Set `CLIENT_DIST_PATH`
when the built frontend is stored somewhere else.

## End-to-End Test

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
npm run test:e2e
```
