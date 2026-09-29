'use strict';
require('dotenv').config();

function need(key) {
  const v = process.env[key];
  if (!v || v === 'CHANGER') throw new Error(`Variable d'environnement manquante : ${key}`);
  return v;
}

module.exports = {
  port: Number(process.env.PORT || 8899),
  token: need('VPSD_TOKEN'),
  wgInterface: process.env.WG_INTERFACE || 'wg0',
  wgService: process.env.WG_SERVICE || 'wg-quick@wg0',
  ovpnDir: process.env.OVPN_DIR || '/etc/openvpn/server',
  ovpnService: process.env.OVPN_SERVICE || 'openvpn-server@jpcloud',
  ovpnStatusLog: process.env.OVPN_STATUS_LOG || '/var/log/openvpn/status-jpcloud.log',
  ovpnPort: Number(process.env.OVPN_PORT || 1194),
};
