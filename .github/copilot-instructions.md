# AI Coding Guidelines for Toolsapp

## Project Architecture

**Toolsapp** is a PHP-based portal for hosting and serving isolated web tools with role-based access control. It acts as a secure proxy between authenticated users and static web applications (HTML/CSS/JS bundles) stored in `/app/tools/`.

### Core Data Flow
1. User logs in via [login.php](../login.php) → credentials verified against SQLite
2. Session stores: `uid`, `username`, `is_admin`, `tools[]` (whitelist of assigned tool names)
3. Dashboard ([index.php](../index.php)) displays user's assigned tools
4. User clicks tool → routed through [tool.php](../tool.php) (entry point) → [toolserve.php](../toolserve.php) (file server)
5. [toolserve.php](../toolserve.php) validates tool access, prevents path traversal, serves files with correct Content-Type

### Directory Structure
- **Root:** Entry points & auth flows (login.php, index.php, admin_*.php)
- **app/config.php:** Single config file with `site_name`, `session_name`, `tools_dir`, `db_path`
- **app/tools/{tool-name}/index.html:** Each tool is a directory with entry HTML (e.g., `/app/tools/patchmatrix/index.html`)
- **assets/app.css:** Shared frontend styles (dark modern design system with CSS variables)

## Authentication & Authorization Pattern

**Session-Based Roles:**
- **Authenticated User:** `$_SESSION['uid']` set → can view assigned tools
- **Admin User:** `$_SESSION['is_admin']` = 1 → can manage users & tool assignments in [admin_users.php](../admin_users.php) and [admin_edit.php](../admin_edit.php)

**Key Functions** (in [_bootstrap.php](../_bootstrap.php)):
- `require_login()` — Redirects to login if `$_SESSION['uid']` empty
- `require_admin()` — Calls `require_login()` then checks admin flag, returns 403 if not admin
- `h($s)` — HTML escape with `htmlspecialchars()` (UTF-8, ENT_QUOTES) — **ALWAYS use when echoing user data**

**Session Security** ([_bootstrap.php](../_bootstrap.php) lines 6-12):
- HTTPOnly, SameSite=Lax, Secure flag (if HTTPS), Custom session name
- Session regenerated on login (`session_regenerate_id(true)`)

## Tool Serving & Security

**Request Flow:**
- Route: `/t/{tool-name}/` → [tool.php](../tool.php) includes tool's `index.html` with CSP headers
- Route: `/toolserve.php?name={tool-name}&file={file-path}` → serves files with validation

**Security Mechanisms** ([toolserve.php](../toolserve.php)):
1. **Tool Whitelist:** Check `$_GET['name']` against `$_SESSION['tools']` (server-side validation)
2. **Path Traversal Prevention:**
   - Tool name: `preg_replace('/[^a-zA-Z0-9_-]/', '')` (alphanumeric, dash, underscore only)
   - File path: remove null bytes, strip leading `/`, reject `..`, use `realpath()` + boundary checks
   - Pattern: `if (strpos($target, $toolBase . DIRECTORY_SEPARATOR) !== 0)` ensures file is within tool directory
3. **Content-Type Validation:** Map extensions (html, css, js, json, svg, png, jpg, woff2, ttf) to correct MIME types
4. **CSP Header:** `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self';`

**Adding New Tools:**
- Create directory: `/app/tools/{toolname}/` with `index.html`
- Run `php admin_users.php` to assign tool to user
- System auto-discovers tools via `glob($basepath . '/*', GLOB_ONLYDIR)` in [admin_edit.php](../admin_edit.php)

## Database Schema

SQLite (`app/users.sqlite`):
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  passhash TEXT NOT NULL,
  tools TEXT NOT NULL,       -- JSON array of tool names ["patchmatrix", "nti_tool"]
  is_admin INTEGER DEFAULT 0 -- 0 = standard user, 1 = admin
);
```

**Note:** Tools stored as JSON string (planned future replacement with proper roles/permissions system, see [admin_users.php](../admin_users.php) comment).

## Code Patterns & Conventions

**Style:**
- `declare(strict_types=1);` at top of every file
- Functions, no classes (procedural)
- PDO for database (exception mode: `PDO::ERRMODE_EXCEPTION`)
- German UI/comments (cultural context for this regional tool platform)

**Error Handling:**
- Invalid input → HTTP status code (403 Forbidden, 404 Not Found, 400 Bad Request)
- Echo status code then `exit;`
- Validation order: login check → permission check → input sanitization → file validation

**Form Handling:**
- POST for mutations (create user, assign tools, change password)
- Simple redirect after success or display `$msg` in flash card
- No CSRF tokens (consider adding if scale increases)

**Frontend Structure:**
- `page_start($title, $show_nav)` opens HTML frame with header/nav
- `page_end()` closes HTML
- Grid layout: `.grid`, `.col-4`, `.col-8`, `.col-12` (12-column system)
- Components: `.card`, `.btn`, `.btn-primary`, `.input`, `.field`, `.label`, `.flash` (ok/warn/bad)
- CSS variables for theming: `--bg`, `--text`, `--accent`, `--ok`, `--warn`, `--bad` (dark mode default, light mode media query)

## Developer Workflows

**Creating a New User:**
1. Navigate to `/admin_users.php` (requires admin login)
2. Fill username, password, check "Admin" if needed
3. Submit → inserts record with hashed password & empty tools array

**Assigning Tools to User:**
1. Go to `/admin_users.php` → locate user → click "Bearbeiten" (Edit)
2. Routes to `/admin_edit.php?id={userid}`
3. Check tool checkboxes → Submit
4. Updates user's `tools` JSON column; validates against discovered tool directories

**Login Flow (Testing):**
- POST to `/login.php` with username + password
- Server: hashes password, compares with `passhash`, sets session on match
- Client: redirected to `/index.php` dashboard
- Logout: `/logout.php` calls `session_destroy()`, redirects to `/login.php`

**Adding Features:**
- Before adding to base pages, confirm user has capability (is authenticated, admin status, tool assignment)
- Always validate file paths with `realpath()` + boundary check before `readfile()`
- HTML escape all user-controlled output with `h()`
- Store tool data as JSON → consider migration path if more complex

## Important Limitations & Future Work

- **No CSRF protection:** Stateless forms (fine for small internal tool; add tokenization for multi-tenant)
- **Tool assignment via JSON:** Roadmap includes role-based permission layer (see comments in [admin_users.php](../admin_users.php))
- **No audit logging:** Admin actions not tracked
- **Single tenant:** Current design for single organization; private/business separation mentioned as future scenario
