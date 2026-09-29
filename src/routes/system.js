'use strict';
const express = require('express');
const netctl = require('../netctl');
const { HttpError, ah } = require('../util');

const router = express.Router();

// Liste fermee : evite qu'un nom d'unite arbitraire atteigne journalctl,
// meme si jpcloud-netctl le revalide deja de son cote.
const ALLOWED_UNITS = new Set(['wg-quick@wg0', 'openvpn-server@jpcloud', 'jpcloud-vpsd']);
const RE_IP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function parseKeyVal(raw) {
  const out = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    out[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return out;
}

router.get('/info', ah(async (req, res) => {
  const out = await netctl.run(['sys-info']);
  const kv = parseKeyVal(out);
  res.json({
    ok: true,
    uptime: kv.uptime || '',
    mem: kv.mem || '',
    disk: kv.disk || '',
    wgStatus: kv.wg_status || '',
    ovpnStatus: kv.ovpn_status || '',
    os: kv.os || '',
  });
}));

router.get('/logs', ah(async (req, res) => {
  const unit = String(req.query.unit || '');
  const lines = Math.min(Math.max(Number(req.query.lines) || 50, 10), 200);
  if (!ALLOWED_UNITS.has(unit)) throw new HttpError(400, 'Unite non autorisee');
  const out = await netctl.run(['sys-logs', unit, String(lines)]);
  res.json({ ok: true, unit, lines: out.split('\n') });
}));

router.post('/ping', ah(async (req, res) => {
  const ip = (req.body && req.body.ip) || '';
  if (!RE_IP.test(ip)) throw new HttpError(400, 'Adresse IPv4 requise');
  const out = await netctl.run(['sys-ping', ip]);
  const kv = parseKeyVal(out);
  res.json({
    ok: true,
    lossPercent: kv.loss ? Number(kv.loss.replace('%', '')) : null,
    rttMs: kv.rtt ? Number(kv.rtt.replace('ms', '')) : null,
  });
}));

module.exports = router;
