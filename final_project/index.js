const express = require('express');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const app = express();
app.set('json spaces', 2);
app.locals.jwtSecret = process.env.JWT_SECRET || randomBytes(32).toString('hex');
app.use(express.json());
app.use('/customer', session({ secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'), resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', maxAge: 3600000 } }));
app.use('/customer/auth', (req, res, next) => {
  try {
    req.username = jwt.verify(req.session.authorization, app.locals.jwtSecret).username;
    next();
  } catch { res.status(401).json({ message: 'Please log in before managing reviews.' }); }
});
app.use('/customer', require('./router/auth_users').authenticated);
app.use('/', require('./router/general').general);
app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((err, req, res, next) => res.status(err.status || 500).json({ message: err.status === 400 ? 'Invalid JSON request.' : 'Internal server error.' }));
if (require.main === module) {
  const port = Number(process.env.PORT || 5000);
  app.listen(port, '127.0.0.1', () => console.log('Book review API: http://127.0.0.1:' + port));
}
module.exports = app;
