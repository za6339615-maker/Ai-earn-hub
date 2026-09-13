# AI Earn Hub v2

A working full-stack starter with:
- Express + SQLite backend
- Secure password hashing with bcrypt
- JWT login/signup
- User profiles and protected APIs
- AI tools catalog + search
- Courses + enrollment + progress tracking
- Admin-only dashboard with user/tool/course management
- Responsive futuristic UI

## Run locally
1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run `npm install`
4. Copy `.env.example` to `.env` and change `JWT_SECRET` and admin password.
5. Run `npm start`
6. Open `http://localhost:3000`

Default development admin credentials come from `.env.example`; change them before deployment.

## Production notes
Use HTTPS, a strong random JWT secret, a managed database/backups, rate limiting, email verification/password reset, CSRF protection where applicable, secure cookie-based sessions, validation, logging, and a real domain before public launch.
