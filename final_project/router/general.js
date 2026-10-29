const express = require('express');
const axios = require('axios');
const books = require('./booksdb');
const { isValid, addUser } = require('./auth_users');
const public_users = express.Router();
public_users.post('/register', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password.trim()) return res.status(400).json({ message: 'Username and password are required.' });
  if (isValid(username)) return res.status(409).json({ message: 'Username already exists.' });
  addUser(username, password);
  res.status(201).json({ message: 'User successfully registered. You can now log in.', username });
});
public_users.get('/', (req, res) => res.json(books));
public_users.get('/isbn/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  res.json(books[req.params.isbn]);
});
function matchingBooks(field, value) {
  return Object.fromEntries(Object.entries(books).filter(([, book]) => book[field].toLowerCase() === value.toLowerCase()));
}
for (const field of ['author', 'title']) {
  public_users.get('/' + field + '/:' + field, (req, res) => {
    const matches = matchingBooks(field, req.params[field]);
    if (!Object.keys(matches).length) return res.status(404).json({ message: 'No matching books found.' });
    res.json(matches);
  });
}
public_users.get('/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  res.json(books[req.params.isbn].reviews);
});
// Assessment Q11: Axios client functions are separate from server handlers.
// This avoids a handler making a request back to itself recursively.
function createBookClient(baseURL = process.env.BOOK_API_URL || 'http://127.0.0.1:5000') {
  return axios.create({ baseURL, timeout: 5000, proxy: false });
}
// Task 10: async/await, with optional Node-style callback.
async function getAllBooks(callback, client = createBookClient()) {
  try {
    const { data } = await client.get('/');
    if (callback) callback(null, data);
    return data;
  } catch (error) {
    if (callback) { callback(error); return; }
    throw error;
  }
}
// Task 11: promise callback. Axios errors propagate to the caller.
function getBooksByISBN(isbn, client = createBookClient()) {
  return client.get('/isbn/' + encodeURIComponent(isbn)).then(response => response.data);
}
// Tasks 12 and 13: async/await with Axios.
async function getBooksByAuthor(author, client = createBookClient()) {
  const { data } = await client.get('/author/' + encodeURIComponent(author));
  return data;
}
async function getBooksByTitle(title, client = createBookClient()) {
  const { data } = await client.get('/title/' + encodeURIComponent(title));
  return data;
}
module.exports = { general: public_users, createBookClient, getAllBooks, getBooksByISBN, getBooksByAuthor, getBooksByTitle };
