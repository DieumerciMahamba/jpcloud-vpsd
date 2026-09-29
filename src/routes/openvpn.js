'use strict';
const express = require('express');
const netctl = require('../netctl');
const { HttpError, ah } = require('../util');

const router = express.Router();

// Identifiant derive cote wamp64 par vpn_identity() : "jpc-u<user_id>r<router_id>"
// (voir provision_ovpn_peer dans vpn.php) — jamais saisi par un utilisateur final,
// meme convention que le nom d'utilisateur SSTP deja en production.
const RE_OVPN_USER = /^jpc-u[0-9]{1,10}r[0-9]{1,10}$/;
const RE_TUNNEL_IP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const RE_SHA256 = /^[a-f0-9]{64}$/;

function parseOvpnStatus(raw) {
  // jpcloud-netctl ovpn-status emet une ligne CLIENT_LIST par pair connecte :
  //   user<TAB>real_address<TAB>tunnel_ip<TAB>connected_since_epoch
  const peers = [];
  for (const raw0 of raw.split('\n')) {
    const line = raw0.trim();
    if (!line) continue;
    const cols = line.split('\t');
    peers.push({
      user: cols[0] || '',
      realAddress: cols[1] || '',
      tunnelIp: cols[2] || '',
      connectedSinceEpoch: Number(cols[3] || 0),
    });
  }
  return { peers };
}

router.put('/peers/:user', ah(async (req, res) => {
  const user = req.params.user;
  const tunnelIp = (req.body && req.body.tunnelIp) || '';
  const passwordSha256 = (req.body && req.body.passwordSha256) || '';
  if (!RE_OVPN_USER.test(user)) throw new HttpError(400, 'Identifiant OpenVPN invalide');
  if (!RE_TUNNEL_IP.test(tunnelIp)) throw new HttpError(400, 'IP de tunnel invalide');
  if (!RE_SHA256.test(passwordSha256)) throw new HttpError(400, 'Empreinte de mot de passe invalide (sha256 attendu)');
  await netctl.run(['ovpn-add', user, tunnelIp, passwordSha256]);
  res.json({ ok: true });
}));

router.delete('/peers/:user', ah(async (req, res) => {
  const user = req.params.user;
  if (!RE_OVPN_USER.test(user)) throw new HttpError(400, 'Identifiant OpenVPN invalide');
  await netctl.run(['ovpn-del', user]);
  res.json({ ok: true });
}));

router.get('/status', ah(async (req, res) => {
  const out = await netctl.run(['ovpn-status']);
  res.json({ ok: true, ...parseOvpnStatus(out) });
}));

router.post('/bootstrap', ah(async (req, res) => {
  const out = await netctl.run(['ovpn-bootstrap'], 120000);
  const lastLine = out.trim().split('\n').pop() || '{}';
  let parsed;
  try { parsed = JSON.parse(lastLine); } catch { parsed = { ok: false, error: 'Reponse non structuree', raw: out }; }
  res.json(parsed);
}));

// Certificat CA (PEM) a distribuer aux routeurs v6 pour valider le serveur
// OpenVPN — pas un secret (une CA ne permet que de VERIFIER une identite,
// jamais de s'authentifier), donc pas besoin d'un traitement particulier ici ;
// wamp64 le met en cache (settings) apres bootstrap pour ne plus rappeler
// cet endpoint a chaque generation de script routeur.
router.get('/ca', ah(async (req, res) => {
  const out = await netctl.run(['ovpn-ca']);
  res.json({ ok: true, pem: out });
}));

module.exports = router;
