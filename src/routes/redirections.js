'use strict';
const express = require('express');
const netctl = require('../netctl');
const { HttpError, ah } = require('../util');

const router = express.Router();

const RE_TUNNEL_IP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const RE_ROUTER_ID = /^[1-9][0-9]{0,9}$/;

function validatePorts(ports, label) {
  if (!Array.isArray(ports) || ports.length > 128) throw new HttpError(400, `${label} invalide`);
  for (const p of ports) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1 || n > 65535) throw new HttpError(400, `${label} invalide`);
  }
}

// Revalidation stricte ICI (avant l'appel root), EN PLUS de la revalidation
// faite par jpcloud-netctl lui-meme apres decodage du base64 — double barriere
// pour le seul endpoint qui fait transiter un payload structure jusqu'a la
// frontiere root (voir jpcloud-netctl redir-set).
function validateRules(rules) {
  if (!Array.isArray(rules) || rules.length > 64) throw new HttpError(400, 'Liste de regles invalide');
  for (const r of rules) {
    if (!r || (r.proto !== 'tcp' && r.proto !== 'udp')) throw new HttpError(400, 'Protocole invalide (tcp/udp)');
    const pub = Number(r.publicPort);
    const int = Number(r.internalPort);
    if (!Number.isInteger(pub) || pub < 1 || pub > 65535) throw new HttpError(400, 'Port public invalide');
    if (!Number.isInteger(int) || int < 1 || int > 65535) throw new HttpError(400, 'Port interne invalide');
  }
}

/**
 * Contrat volontairement auto-suffisant (pas de diff cote daemon) :
 * - `allPorts` = TOUS les ports publics deja alloues a ce routeur un jour
 *   (actifs ou desactives depuis) — le daemon purge d'abord exactement ces
 *   ports du map nftables, puis reinstalle uniquement `rules`. Convergence
 *   garantie quel que soit l'historique, sans etat cote VPS.
 * - `rules` = le sous-ensemble actuellement actif (service + equipements).
 */
router.put('/:routerId', ah(async (req, res) => {
  const routerId = req.params.routerId;
  const tunnelIp = (req.body && req.body.tunnelIp) || '';
  const rules = (req.body && req.body.rules) || [];
  const allPorts = (req.body && req.body.allPorts) || rules.map((r) => r.publicPort);
  if (!RE_ROUTER_ID.test(routerId)) throw new HttpError(400, 'Identifiant routeur invalide');
  if (!RE_TUNNEL_IP.test(tunnelIp)) throw new HttpError(400, 'IP de tunnel invalide');
  validateRules(rules);
  validatePorts(allPorts, 'Liste de ports a purger');

  const compact = {
    allPorts: allPorts.map(Number),
    rules: rules.map((r) => ({ proto: r.proto, pub: Number(r.publicPort), int: Number(r.internalPort) })),
  };
  const payload = Buffer.from(JSON.stringify(compact), 'utf8').toString('base64');
  await netctl.run(['redir-set', routerId, tunnelIp, payload]);
  res.json({ ok: true, applied: rules.length });
}));

router.delete('/:routerId', ah(async (req, res) => {
  const routerId = req.params.routerId;
  const allPorts = (req.body && req.body.allPorts) || [];
  if (!RE_ROUTER_ID.test(routerId)) throw new HttpError(400, 'Identifiant routeur invalide');
  validatePorts(allPorts, 'Liste de ports a purger');
  const payload = Buffer.from(JSON.stringify({ allPorts: allPorts.map(Number) }), 'utf8').toString('base64');
  await netctl.run(['redir-clear', routerId, payload]);
  res.json({ ok: true });
}));

module.exports = router;
