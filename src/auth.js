'use strict';
const crypto = require('crypto');
const cfg = require('./config');

// Comparaison en temps constant : évite qu'une différence de timing sur la
// comparaison naive laisse deviner le jeton octet par octet.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Jeton bearer partagé (service-a-service, pas de session utilisateur ici :
// pas besoin de JWT). /health reste public (sert au test de joignabilite
// cote wamp64 qui pilote le repli SSH).
function requireToken(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token || !safeEqual(token, cfg.token)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

module.exports = { requireToken };
