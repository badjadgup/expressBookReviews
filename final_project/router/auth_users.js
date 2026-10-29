const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const books = require('./booksdb');
const regd_users = express.Router();
const users = [];
const isValid = username => users.some(user => user.username === username);
function addUser(username, password) {
  const salt = randomBytes(16).toString('hex');
  users.push({ username, salt, hash: scryptSync(password, salt, 64) });
}
function authenticatedUser(username, password) {
  const user = users.find(item => item.username === username);
  return !!user && timingSafeEqual(user.hash, scryptSync(password, user.salt, 64));
}
regd_users.post('/login', (req, res, next) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !authenticatedUser(username, password)) return res.status(401).json({ message: 'Invalid username or password.' });
  req.session.regenerate(err => {
    if (err) return next(err);
    req.session.authorization = jwt.sign({ username }, req.app.locals.jwtSecret, { expiresIn: '1h' });
    req.session.save(err => {
      if (err) return next(err);
      res.json({ message: 'Successfully logged in.', username });
    });
  });
});
regd_users.put('/auth/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  const book = books[req.params.isbn];
  const review = req.body?.review ?? req.query.review;
  if (typeof review !== 'string' || !review.trim()) return res.status(400).json({ message: 'A non-empty review is required.' });
  const modified = Object.hasOwn(book.reviews, req.username);
  Object.defineProperty(book.reviews, req.username, { value: review.trim(), enumerable: true, configurable: true, writable: true });
  res.json({ message: modified ? 'Review successfully modified.' : 'Review successfully added.', reviews: book.reviews });
});
regd_users.delete('/auth/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  const book = books[req.params.isbn];
  if (!Object.hasOwn(book.reviews, req.username)) return res.status(404).json({ message: 'No review by this user for this book.' });
  delete book.reviews[req.username];
  res.json({ message: 'Review successfully deleted.', reviews: book.reviews });
});
module.exports = { authenticated: regd_users, users, isValid, addUser, authenticatedUser };
