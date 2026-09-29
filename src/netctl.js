'use strict';
const { execFile } = require('child_process');

const NETCTL = '/usr/local/sbin/jpcloud-netctl';

// Appelle jpcloud-netctl via sudo, SANS shell : execFile ne passe jamais par
// /bin/sh, donc aucune valeur d'argument (meme malformee) ne peut injecter de
// commande. La validation stricte par regex vit dans le script root lui-meme
// (defense en profondeur : le daemon tourne en utilisateur non privilegie,
// jpcloud-netctl est le SEUL programme qu'il peut executer en root, via une
// entree sudoers NOPASSWD etroite).
function run(args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    execFile('sudo', ['-n', NETCTL, ...args], { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || '').trim() || err.message));
        resolve(stdout);
      });
  });
}

module.exports = { run };
