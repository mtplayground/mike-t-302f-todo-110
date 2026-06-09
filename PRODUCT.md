# todomvc-030

## Snapshot

todomvc-030 is a full-stack task management app built as a TypeScript monorepo. It provides a React single-page task workspace backed by an Express API and PostgreSQL persistence through Prisma.

## What It Does

- Create, list, edit, complete, and delete tasks.
- Track task title, optional description, optional due date, priority, completion state, and timestamps.
- Attach an optional image to a task, preview it in the form, show thumbnails in the list, replace it, or remove it.
- Filter tasks by All, Active, and Completed.
- Show task metadata in the UI, including due date, priority, status, and image preview.
- Provide optimistic UI updates for complete toggles and deletes.

## Architecture

- Root workspace manages `client` and `server` npm workspaces.
- `client` is a Vite React app using Tailwind CSS and TanStack React Query.
- `server` is an Express API using centralized error handling and Zod request validation.
- PostgreSQL is the only persistent store. Prisma owns database access and migrations.
- Task image binaries are stored in S3-compatible object storage; PostgreSQL stores image metadata and object keys.
- The storage layer validates allowed image types (`png`, `jpeg`, `webp`, `gif`) and maximum file size before upload.
- The Express server serves API routes and, after `npm run build`, serves the built React app from `client/dist`.

## API Surface

- `GET /health` returns API health.
- `GET /tasks?status=all|active|completed` lists tasks.
- `POST /tasks` creates a task using JSON or `multipart/form-data` with an optional `image` file.
- `PATCH /tasks/:id` updates task fields, completion state, image replacement, or image removal.
- `DELETE /tasks/:id` deletes a task and cleans up its image object when present.

## Conventions

- Runtime configuration comes from environment variables; `DATABASE_URL` must be PostgreSQL.
- `.env.example` documents required database and S3-compatible object storage variables.
- Server listens on `0.0.0.0:8080` by default.
- Root scripts are the primary entry points:
  - `npm run build`
  - `npm test`
  - `npm run test:e2e`
  - `npm start`
- `npm start` runs Prisma migrations before starting the built server.

## Test Coverage

- Backend service and route tests cover CRUD, filtering, and validation errors.
- Backend service and route tests cover CRUD, filtering, validation errors, image upload metadata, and image cleanup paths.
- Frontend component tests cover list rendering, filters, forms, image preview/removal, toggles, and deletes.
- Playwright E2E covers the core task flow plus image upload validation, upload, thumbnail rendering, replacement, removal, and delete flow.
