require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
// album photos live OUTSIDE the public /uploads folder, so friends-only photos can't be opened by guessing a URL
const PRIVATE_DIR = path.join(__dirname, 'private_uploads');
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

function makeUpload(dir, maxFiles) {
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: maxFiles },
    fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
  });
}
const avatarUpload = makeUpload(UPLOAD_DIR, 1);
const photoUpload = makeUpload(PRIVATE_DIR, 10);
const unlink = (dir, name) => { if (name) fs.unlink(path.join(dir, name), () => {}); };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const signToken = (u) => jwt.sign({ id: u.id, username: u.username }, SECRET, { expiresIn: '7d' });

function readUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), SECRET); } catch { return null; }
}
const optionalAuth = (req, res, next) => { req.user = readUser(req); next(); };
const requireAuth = (req, res, next) => {
  req.user = readUser(req);
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  next();
};

const EVENT_SELECT = `
  SELECT e.id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.seats, e.user_id,
         CASE WHEN now() >= e.ends_at THEN 'closed' WHEN now() >= e.starts_at THEN 'live' ELSE 'upcoming' END AS status,
         u.username AS host,
         (SELECT COUNT(*)::int FROM event_attendees a WHERE a.event_id = e.id) AS taken,
         EXISTS (SELECT 1 FROM event_attendees a WHERE a.event_id = e.id AND a.user_id = $1) AS joined,
         COALESCE((SELECT json_agg(i.path ORDER BY i.id) FROM event_images i WHERE i.event_id = e.id), '[]'::json) AS images
  FROM events e JOIN users u ON u.id = e.user_id`;

// open events first (soonest first), finished events pushed to the end (most recently finished first)
const OPEN_FIRST = `ORDER BY (now() >= e.ends_at),
  CASE WHEN now() >= e.ends_at THEN -EXTRACT(EPOCH FROM e.ends_at) ELSE EXTRACT(EPOCH FROM e.starts_at) END`;

// ---------- auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!/^[A-Za-z0-9_]{3,30}$/.test(username))
    throw new HttpError(400, 'Username must be 3–30 letters, numbers or underscores.');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username', [username, hash]);
    res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'That username is taken.');
    throw e;
  }
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [String(req.body.username || '').trim()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.password_hash)))
    throw new HttpError(401, 'Wrong username or password.');
  res.json({ token: signToken(u), user: { id: u.id, username: u.username } });
}));

// ---------- events ----------
app.get('/api/events', optionalAuth, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const onlyFollowing = req.query.following === '1' && !!req.user;
  const { rows } = await pool.query(
    `${EVENT_SELECT}
     WHERE e.ends_at > now() - interval '7 days'
       AND ($2::text IS NULL OR e.title ILIKE $2::text OR e.location ILIKE $2::text)
       AND (NOT $3::boolean OR e.user_id IN (SELECT followee_id FROM follows WHERE follower_id = $1))
     ${OPEN_FIRST}`,
    [req.user ? req.user.id : null, q ? `%${q}%` : null, onlyFollowing]);
  res.json(rows);
}));

app.get('/api/events/:id', optionalAuth, wrap(async (req, res) => {
  const { rows } = await pool.query(`${EVENT_SELECT} WHERE e.id = $2`, [req.user ? req.user.id : null, req.params.id]);
  if (!rows[0]) throw new HttpError(404, 'Event not found.');
  res.json(rows[0]);
}));

app.post('/api/events', requireAuth, upload.array('images', 5), wrap(async (req, res) => {
  const { title, description = '', location, starts_at, ends_at } = req.body;
  const seats = parseInt(req.body.seats, 10);
  if (!title || !location || !starts_at || !ends_at || !(seats > 0))
    throw new HttpError(400, 'Title, location, start, finish and a seat count above 0 are required.');
  if (isNaN(new Date(starts_at)) || isNaN(new Date(ends_at))) throw new HttpError(400, 'That date and time is not valid.');
  if (new Date(ends_at) <= new Date(starts_at)) throw new HttpError(400, 'The finish time must be after the start time.');
  if (new Date(starts_at) <= new Date()) throw new HttpError(400, 'The start time must be in the future.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO events (user_id, title, description, location, starts_at, ends_at, seats)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.user.id, title.trim(), description.trim(), location.trim(), starts_at, ends_at, seats]);
    for (const f of req.files || [])
      await client.query('INSERT INTO event_images (event_id, path) VALUES ($1,$2)', [rows[0].id, f.filename]);
    await client.query(
      `INSERT INTO notifications (user_id, type, actor_id, event_id, message)
       SELECT follower_id, 'new_event', $1, $2, $3 FROM follows WHERE followee_id = $1`,
      [req.user.id, rows[0].id, `${req.user.username} published a new event: ${title.trim()}`]);
    await client.query('COMMIT');
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

app.put('/api/events/:id', requireAuth, upload.array('images', 5), wrap(async (req, res) => {
  const files = req.files || [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ev = (await client.query('SELECT id, user_id, now() >= ends_at AS ended FROM events WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!ev) throw new HttpError(404, 'Event not found.');
    if (ev.user_id !== req.user.id) throw new HttpError(403, 'Only the host can edit this event.');
    if (ev.ended) throw new HttpError(409, 'This event has finished and can no longer be edited.');

    const { title, description = '', location, starts_at, ends_at } = req.body;
    const seats = parseInt(req.body.seats, 10);
    if (!title || !location || !starts_at || !ends_at || !(seats > 0))
      throw new HttpError(400, 'Title, location, start, finish and a seat count above 0 are required.');
    if (isNaN(new Date(starts_at)) || isNaN(new Date(ends_at))) throw new HttpError(400, 'That date and time is not valid.');
    if (new Date(ends_at) <= new Date(starts_at)) throw new HttpError(400, 'The finish time must be after the start time.');

    const taken = (await client.query('SELECT COUNT(*)::int AS n FROM event_attendees WHERE event_id = $1', [ev.id])).rows[0].n;
    if (seats < taken)
      throw new HttpError(409, `${taken} ${taken === 1 ? 'person has' : 'people have'} already joined, so seats can't go below ${taken}.`);

    let remove = [];
    try { remove = JSON.parse(req.body.remove_images || '[]'); } catch { remove = []; }
    const existing = (await client.query('SELECT id, path FROM event_images WHERE event_id = $1', [ev.id])).rows;
    const toRemove = existing.filter((i) => remove.includes(i.path));
    if (existing.length - toRemove.length + files.length > 5)
      throw new HttpError(400, 'An event can have at most 5 photos.');

    await client.query(
      `UPDATE events SET title=$1, description=$2, location=$3, starts_at=$4, ends_at=$5, seats=$6 WHERE id=$7`,
      [title.trim(), description.trim(), location.trim(), starts_at, ends_at, seats, ev.id]);
    for (const i of toRemove) await client.query('DELETE FROM event_images WHERE id = $1', [i.id]);
    for (const f of files) await client.query('INSERT INTO event_images (event_id, path) VALUES ($1,$2)', [ev.id, f.filename]);
    await client.query('COMMIT');

    toRemove.forEach((i) => fs.unlink(path.join(UPLOAD_DIR, i.path), () => {}));
    res.json({ id: ev.id });
  } catch (e) {
    await client.query('ROLLBACK');
    files.forEach((f) => fs.unlink(f.path, () => {}));   // don't keep uploads from a failed edit
    throw e;
  } finally {
    client.release();
  }
}));

app.post('/api/events/:id/join', requireAuth, wrap(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // lock the event row so two people can't take the last seat at the same time
    const ev = (await client.query('SELECT id, user_id, seats, title, now() >= starts_at AS started, now() >= ends_at AS ended FROM events WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!ev) throw new HttpError(404, 'Event not found.');
    if (ev.user_id === req.user.id) throw new HttpError(400, 'You are the host of this event.');
    if (ev.ended) throw new HttpError(409, 'This event is closed.');
    if (ev.started) throw new HttpError(409, 'This event has already started, so joining is closed.');
    const taken = (await client.query('SELECT COUNT(*)::int AS n FROM event_attendees WHERE event_id = $1', [ev.id])).rows[0].n;
    const already = (await client.query('SELECT 1 FROM event_attendees WHERE event_id=$1 AND user_id=$2', [ev.id, req.user.id])).rowCount;
    if (!already && taken >= ev.seats) throw new HttpError(409, 'This event is full.');
    const ins = await client.query('INSERT INTO event_attendees (event_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [ev.id, req.user.id]);
    if (ins.rowCount)
      await client.query(
        `INSERT INTO notifications (user_id, type, actor_id, event_id, message) VALUES ($1,'joined',$2,$3,$4)`,
        [ev.user_id, req.user.id, ev.id, `${req.user.username} joined ${ev.title}`]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

app.delete('/api/events/:id/join', requireAuth, wrap(async (req, res) => {
  await pool.query('DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// only the host can see who joined
app.get('/api/events/:id/attendees', requireAuth, wrap(async (req, res) => {
  const ev = (await pool.query('SELECT user_id FROM events WHERE id = $1', [req.params.id])).rows[0];
  if (!ev) throw new HttpError(404, 'Event not found.');
  if (ev.user_id !== req.user.id) throw new HttpError(403, 'Only the host can see the guest list.');
  const { rows } = await pool.query(
    `SELECT u.username, a.joined_at FROM event_attendees a JOIN users u ON u.id = a.user_id
     WHERE a.event_id = $1 ORDER BY a.joined_at`, [req.params.id]);
  res.json(rows);
}));

app.delete('/api/events/:id', requireAuth, wrap(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM events WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rowCount) throw new HttpError(404, 'Event not found or not yours.');
  res.json({ ok: true });
}));

// ---------- people, follows, friends ----------
const userByName = async (name) =>
  (await pool.query('SELECT id, username FROM users WHERE lower(username) = lower($1)', [name])).rows[0];

app.get('/api/users', optionalAuth, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const { rows } = await pool.query(
    `SELECT u.username, u.avatar,
            EXISTS (SELECT 1 FROM follows WHERE follower_id = $1::int AND followee_id = u.id) AS is_following
     FROM users u
     WHERE u.username ILIKE $2 AND ($1::int IS NULL OR u.id <> $1::int)
     ORDER BY u.username LIMIT 30`,
    [req.user ? req.user.id : null, `%${q}%`]);
  res.json(rows);
}));

app.get('/api/users/:username', optionalAuth, wrap(async (req, res) => {
  const me = req.user ? req.user.id : null;
  const u = (await pool.query(
    `SELECT u.id, u.username, u.created_at, u.bio, u.avatar, u.age, u.gender,
            (SELECT COUNT(*)::int FROM follows WHERE followee_id = u.id) AS followers,
            (SELECT COUNT(*)::int FROM follows WHERE follower_id = u.id) AS following,
            EXISTS (SELECT 1 FROM follows WHERE follower_id = $2::int AND followee_id = u.id) AS is_following,
            (EXISTS (SELECT 1 FROM follows WHERE follower_id = $2::int AND followee_id = u.id)
             AND EXISTS (SELECT 1 FROM follows WHERE follower_id = u.id AND followee_id = $2::int)) AS is_friend
     FROM users u WHERE lower(u.username) = lower($1)`, [req.params.username, me])).rows[0];
  if (!u) throw new HttpError(404, 'We could not find that user.');
  const events = (await pool.query(`${EVENT_SELECT} WHERE e.user_id = $2 ${OPEN_FIRST}`, [me, u.id])).rows;
  // friends-only photos are listed only for the owner and for mutual followers
  const canSeeFriends = me === u.id || u.is_friend;
  const photos = (await pool.query(
    `SELECT id, caption, visibility, created_at FROM photos
     WHERE user_id = $1 AND (visibility = 'public' OR $2::boolean) ORDER BY created_at DESC`,
    [u.id, canSeeFriends])).rows;
  const hidden = canSeeFriends ? 0 : (await pool.query(
    `SELECT COUNT(*)::int AS n FROM photos WHERE user_id = $1 AND visibility = 'friends'`, [u.id])).rows[0].n;
  res.json({ ...u, events, photos, hidden_photos: hidden });
}));

app.post('/api/users/:username/follow', requireAuth, wrap(async (req, res) => {
  const target = await userByName(req.params.username);
  if (!target) throw new HttpError(404, 'We could not find that user.');
  if (target.id === req.user.id) throw new HttpError(400, "You can't follow yourself.");
  const r = await pool.query(
    'INSERT INTO follows (follower_id, followee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, target.id]);
  if (r.rowCount) {
    try {   // a notification problem must never stop the follow itself
      await pool.query(
        `INSERT INTO notifications (user_id, type, actor_id, message) VALUES ($1,'new_follower',$2,$3)`,
        [target.id, req.user.id, `${req.user.username} started following you`]);
    } catch (e) { console.error('follow notification failed:', e.message); }
  }
  res.json({ ok: true });
}));

app.delete('/api/users/:username/follow', requireAuth, wrap(async (req, res) => {
  const target = await userByName(req.params.username);
  if (!target) throw new HttpError(404, 'We could not find that user.');
  await pool.query('DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2', [req.user.id, target.id]);
  res.json({ ok: true });
}));

app.get('/api/friends', requireAuth, wrap(async (req, res) => {
  const following = (await pool.query(
    `SELECT u.username, u.avatar, true AS is_following FROM follows f JOIN users u ON u.id = f.followee_id
     WHERE f.follower_id = $1 ORDER BY u.username`, [req.user.id])).rows;
  const followers = (await pool.query(
    `SELECT u.username, u.avatar,
            EXISTS (SELECT 1 FROM follows x WHERE x.follower_id = $1 AND x.followee_id = u.id) AS is_following
     FROM follows f JOIN users u ON u.id = f.follower_id
     WHERE f.followee_id = $1 ORDER BY u.username`, [req.user.id])).rows;
  res.json({ following, followers });
}));

// ---------- my profile & album ----------
app.put('/api/me/profile', requireAuth, avatarUpload.single('avatar'), wrap(async (req, res) => {
  const file = req.file;
  try {
    const bio = String(req.body.bio || '').trim();
    if (bio.length > 500) throw new HttpError(400, 'Your description can be at most 500 characters.');
    let age = null;
    if (String(req.body.age ?? '').trim() !== '') {
      age = Number(req.body.age);
      if (!Number.isInteger(age) || age < 13 || age > 120) throw new HttpError(400, 'Age must be a whole number from 13 to 120.');
    }
    const gender = String(req.body.gender || '');
    if (gender && !['male', 'female'].includes(gender)) throw new HttpError(400, 'Gender must be male or female.');

    const old = (await pool.query('SELECT avatar FROM users WHERE id = $1', [req.user.id])).rows[0];
    let avatar = old.avatar;
    if (file) avatar = file.filename;
    else if (req.body.remove_avatar === '1') avatar = null;

    await pool.query('UPDATE users SET bio = $1, age = $2, gender = $3, avatar = $4 WHERE id = $5',
      [bio, age, gender || null, avatar, req.user.id]);
    if (old.avatar && old.avatar !== avatar) unlink(UPLOAD_DIR, old.avatar);
    res.json({ ok: true });
  } catch (e) {
    if (file) unlink(UPLOAD_DIR, file.filename);
    throw e;
  }
}));

const MAX_PHOTOS = 60;

app.post('/api/me/photos', requireAuth, photoUpload.array('photos', 10), wrap(async (req, res) => {
  const files = req.files || [];
  try {
    if (!files.length) throw new HttpError(400, 'Choose at least one image (JPG, PNG, WEBP or GIF, up to 5 MB each).');
    const visibility = req.body.visibility === 'public' ? 'public' : 'friends';   // anything unclear defaults to the private option
    const count = (await pool.query('SELECT COUNT(*)::int AS n FROM photos WHERE user_id = $1', [req.user.id])).rows[0].n;
    if (count + files.length > MAX_PHOTOS) throw new HttpError(400, `An album can hold up to ${MAX_PHOTOS} photos.`);
    for (const f of files)
      await pool.query('INSERT INTO photos (user_id, path, visibility) VALUES ($1,$2,$3)', [req.user.id, f.filename, visibility]);
    res.status(201).json({ added: files.length });
  } catch (e) {
    files.forEach((f) => unlink(PRIVATE_DIR, f.filename));
    throw e;
  }
}));

app.patch('/api/photos/:id', requireAuth, wrap(async (req, res) => {
  const ph = (await pool.query('SELECT * FROM photos WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])).rows[0];
  if (!ph) throw new HttpError(404, 'Photo not found.');
  const visibility = ['public', 'friends'].includes(req.body.visibility) ? req.body.visibility : ph.visibility;
  const caption = typeof req.body.caption === 'string' ? req.body.caption.trim().slice(0, 200) : ph.caption;
  await pool.query('UPDATE photos SET visibility = $1, caption = $2 WHERE id = $3', [visibility, caption, ph.id]);
  res.json({ ok: true });
}));

app.delete('/api/photos/:id', requireAuth, wrap(async (req, res) => {
  const r = await pool.query('DELETE FROM photos WHERE id = $1 AND user_id = $2 RETURNING path', [req.params.id, req.user.id]);
  if (!r.rowCount) throw new HttpError(404, 'Photo not found.');
  unlink(PRIVATE_DIR, r.rows[0].path);
  res.json({ ok: true });
}));

// the only way to get at an album image: checks who is asking
app.get('/api/photos/:id/file', optionalAuth, wrap(async (req, res) => {
  const ph = (await pool.query('SELECT user_id, path, visibility FROM photos WHERE id = $1', [req.params.id])).rows[0];
  if (!ph) throw new HttpError(404, 'Photo not found.');
  if (ph.visibility !== 'public') {
    const viewer = req.user ? req.user.id : null;
    let allowed = viewer === ph.user_id;
    if (!allowed && viewer) {
      allowed = (await pool.query(
        `SELECT (EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2)
             AND EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND followee_id = $1)) AS ok`,
        [viewer, ph.user_id])).rows[0].ok;
    }
    if (!allowed) throw new HttpError(404, 'Photo not found.');   // 404, so the photo's existence isn't revealed
  }
  res.set('Cache-Control', 'private, no-cache');
  res.sendFile(path.join(PRIVATE_DIR, ph.path));
}));

// ---------- notifications ----------
app.get('/api/notifications', requireAuth, wrap(async (req, res) => {
  const items = (await pool.query(
    `SELECT n.id, n.type, n.message, n.event_id, n.read, n.created_at, u.username AS actor
     FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 50`, [req.user.id])).rows;
  const unread = (await pool.query(
    'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT read', [req.user.id])).rows[0].n;
  res.json({ unread, items });
}));

app.post('/api/notifications/read', requireAuth, wrap(async (req, res) => {
  await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND NOT read', [req.user.id]);
  res.json({ ok: true });
}));

// ---------- contact ----------
app.post('/api/contact', optionalAuth, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const message = String(req.body.message || '').trim();
  if (!name || name.length > 80) throw new HttpError(400, 'Please enter your name (80 characters max).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new HttpError(400, 'Please enter a valid email address.');
  if (message.length < 10 || message.length > 2000) throw new HttpError(400, 'Your message needs to be 10–2000 characters.');
  await pool.query('INSERT INTO contact_messages (user_id, name, email, message) VALUES ($1,$2,$3,$4)',
    [req.user ? req.user.id : null, name, email, message]);
  res.status(201).json({ ok: true });
}));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: `Upload problem: ${err.message}` });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(process.env.PORT || 3000, () => console.log('API on http://localhost:' + (process.env.PORT || 3000)));
