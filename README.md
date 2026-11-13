# Haven Hotel Booking System

A full-stack hotel booking system for MAL3020. Guests can register, browse rooms, and book stays. Admins manage rooms and bookings, and see updates live over WebSockets.

**Stack:** Angular (frontend), Node.js + Express + Socket.IO (backend), MongoDB (database), Docker Compose.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- [Git](https://git-scm.com/)

Node.js 22+ is only needed if you want to run the tests or linting outside Docker.

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Hoo-Sulyn/MAL3020-Fullstack-Dev.git
   cd MAL3020-Fullstack-Dev
   ```

2. **Create the environment file.** Copy `backend/.env.example` to `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Then edit `backend/.env`:

   | Variable | Description |
   |---|---|
   | `JWT_SECRET` | Random string, at least 32 characters |
   | `ADMIN_EMAIL` | Email for the admin account |
   | `ADMIN_PASSWORD` | Admin password (8 to 72 characters) |

   The other values can stay as they are. Inside Docker, `MONGO_URI` is set automatically.

3. **Start everything**
   ```bash
   docker compose up --build
   ```
   This starts three containers: MongoDB, the backend (port 3000) and the frontend (port 4200).

4. **Create the admin account** (once, in a second terminal):
   ```bash
   docker compose exec backend npm run seed:admin
   ```

5. **Open the site** at http://localhost:4200

## Using the system

- **Admin:** log in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`. Start by creating a few rooms on the room management page, because the database starts empty.
- **Guest:** register a new account on the sign-up page, then search for rooms and book.
- Admin and guest can be logged in at the same time in different tabs. Admin pages update live when a guest books.

## Stopping and restarting

```bash
docker compose stop        # stop the containers
docker compose up -d       # start again in the background (no rebuild)
docker compose up --build  # rebuild after changing code
docker compose down -v     # stop and delete all data
```

Data is stored in a Docker volume and survives restarts, unless you use `-v`.

## Running the tests

The backend integration tests need MongoDB running on localhost:

```bash
docker compose up -d mongo
cd backend
npm ci
npm test
```

Frontend tests:

```bash
cd frontend
npm ci
npm test -- --no-watch
```

## Static analysis

```bash
cd backend && npm run lint
cd frontend && npm run lint
```

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) runs on every push: lint, tests, build, then Docker image builds.

## Project structure

```
backend/     Express API, Socket.IO server, Mongoose models, tests
frontend/    Angular application, tests
docker-compose.yml
.github/workflows/ci.yml
```