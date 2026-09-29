'use strict';
const express = require('express');
const cfg = require('./config');
const { requireToken } = require('./auth');
const { HttpError } = require('./util');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

// Non authentifie : sert de test de joignabilite cote wamp64 (pilote le repli SSH).
app.get('/health', (req, res) => res.json({ ok: true, version: require('../package.json').version }));

app.use(requireToken);
app.use('/wg', require('./routes/wireguard'));
app.use('/ovpn', require('./routes/openvpn'));
app.use('/redirections', require('./routes/redirections'));
app.use('/system', require('./routes/system'));

app.use((req, res) => res.status(404).json({ error: 'not_found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error('jpcloud-vpsd:', err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(cfg.port, '127.0.0.1', () => {
  console.log(`jpcloud-vpsd en ecoute sur 127.0.0.1:${cfg.port}`);
});
