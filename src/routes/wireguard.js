'use strict';
const express = require('express');
const netctl = require('../netctl');
const { HttpError, ah } = require('../util');

const router = express.Router();

// Memes formats que ceux deja produits par vpn.php cote wamp64 (register_wg_key).
const RE_WG_KEY = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$/;
const RE_TUNNEL_IP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function parseWgStatus(raw) {
  // jpcloud-netctl wg-status emet, apres l'en-tete "#PEERS" :
  //   pubkey<TAB>endpoint<TAB>allowed_ips<TAB>handshake_epoch<TAB>rx<TAB>tx
  // et avant, l'en-tete "#IFACE" avec : pubkey<TAB>port
  const peers = [];
  let iface = { publicKey: '', port: 0 };
  let section = '';
  for (const raw0 of raw.split('\n')) {
    const line = raw0.trim();
    if (!line) continue;
    if (line.startsWith('#')) { section = line; continue; }
    const cols = line.split('\t');
    if (section === '#IFACE') {
      iface = { publicKey: cols[0] || '', port: Number(cols[1] || 0) };
    } else if (section === '#PEERS') {
      peers.push({
        pubkey: cols[0] || '',
        endpoint: cols[1] || '',
        allowedIps: cols[2] || '',
        lastHandshakeEpoch: Number(cols[3] || 0),
        rxBytes: Number(cols[4] || 0),
        txBytes: Number(cols[5] || 0),
      });
    }
  }
  return { interface: iface, peers };
}

router.put('/peers/:pubkey', ah(async (req, res) => {
  const pubkey = req.params.pubkey;
  const tunnelIp = (req.body && req.body.tunnelIp) || '';
  if (!RE_WG_KEY.test(pubkey)) throw new HttpError(400, 'Cle publique WireGuard invalide');
  if (!RE_TUNNEL_IP.test(tunnelIp)) throw new HttpError(400, 'IP de tunnel invalide');
  await netctl.run(['wg-add', pubkey, tunnelIp]);
  res.json({ ok: true });
}));

router.delete('/peers/:pubkey', ah(async (req, res) => {
  const pubkey = req.params.pubkey;
  if (!RE_WG_KEY.test(pubkey)) throw new HttpError(400, 'Cle publique WireGuard invalide');
  await netctl.run(['wg-del', pubkey]);
  res.json({ ok: true });
}));

router.get('/status', ah(async (req, res) => {
  const out = await netctl.run(['wg-status']);
  res.json({ ok: true, ...parseWgStatus(out) });
}));

router.post('/bootstrap', ah(async (req, res) => {
  const rotate = req.body && req.body.rotateServerKeys ? 'rotate' : 'norotate';
  const out = await netctl.run(['wg-bootstrap', rotate], 90000);
  // jpcloud-netctl wg-bootstrap emet une derniere ligne JSON avec le resultat structure.
  const lastLine = out.trim().split('\n').pop() || '{}';
  let parsed;
  try { parsed = JSON.parse(lastLine); } catch { parsed = { ok: false, error: 'Reponse non structuree', raw: out }; }
  res.json(parsed);
}));

module.exports = router;
