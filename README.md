# jpcloud-vpsd

Daemon résident du VPS qui remplace le pilotage SSH/bash-base64 depuis
`C:\wamp64\www\jpcloud\app\vps_ssh.php` par une API HTTP locale propre,
et ajoute OpenVPN comme transport de premier ordre auto-provisionné pour
les routeurs RouterOS v6.

Voir le plan complet : `../GUIDE.md` reste la référence pour l'installation
générale d'un VPS neuf (WireGuard, Nginx, MySQL...) — **ce dossier ne la
duplique pas** et suppose un VPS **déjà en production** avec WireGuard et
SSTP déjà fonctionnels. SSTP n'est pas touché ici, il continue d'être géré
comme aujourd'hui.

## Installation (sur le VPS existant, à côté de l'existant — rien n'est coupé)

```bash
# 1. Utilisateur système dédié (aucun privilège, seul sudo -n vers
#    jpcloud-netctl lui est accordé)
sudo useradd -r -m -d /opt/jpcloud-vpsd -s /usr/sbin/nologin jpcloud

# 2. Script root + sudoers
sudo install -m 750 -o root -g root deploy/jpcloud-netctl /usr/local/sbin/jpcloud-netctl
sudo install -m 440 deploy/sudoers-jpcloud /etc/sudoers.d/jpcloud
sudo visudo -c   # doit afficher « parsed OK »

# 3. Config réseau — VÉRIFIER les valeurs contre l'installation WireGuard
#    EXISTANTE avant de copier (cat /etc/wireguard/wg0.conf) :
sudo install -m 644 deploy/jpcloud-netctl.conf.example /etc/jpcloud-netctl.conf
sudo nano /etc/jpcloud-netctl.conf

# 4. Daemon Node
sudo mkdir -p /opt/jpcloud-vpsd
sudo cp -r src package.json /opt/jpcloud-vpsd/
sudo cp .env.example /opt/jpcloud-vpsd/.env
sudo nano /opt/jpcloud-vpsd/.env    # VPSD_TOKEN = openssl rand -hex 32 (a copier aussi dans wamp64)
sudo chown -R jpcloud:jpcloud /opt/jpcloud-vpsd
sudo chmod 600 /opt/jpcloud-vpsd/.env
cd /opt/jpcloud-vpsd && sudo -u jpcloud npm install --omit=dev

# 5. Service systemd
sudo install -m 644 deploy/jpcloud-vpsd.service /etc/systemd/system/jpcloud-vpsd.service
sudo systemctl daemon-reload
sudo systemctl enable --now jpcloud-vpsd
sudo journalctl -u jpcloud-vpsd -n 20 --no-pager

# 6. Nginx — ajouter le bloc `location /_vpsd/` (voir deploy/nginx-vpsd.conf)
#    au bloc HTTPS EXISTANT (ne pas créer de nouveau sous-domaine/certificat).
sudo nginx -t && sudo systemctl reload nginx

# 7. Vérification à froid — AUCUNE mutation n'a encore eu lieu.
curl -s https://<vps-host>/_vpsd/health
curl -s -H "Authorization: Bearer <VPSD_TOKEN>" https://<vps-host>/_vpsd/wg/status
# Comparer avec `sudo wg show wg0` en direct sur le VPS — doit correspondre.
```

À cette étape, le daemon tourne, répond, mais **rien côté wamp64 ne l'appelle
encore** (`vpsd_api_enabled=0` par défaut) — voir le plan pour la suite
(activation progressive, OpenVPN, retrait du SSH).

## Ne PAS faire au premier déploiement

- Ne pas appeler `POST /wg/bootstrap` tant que `WG_ADDR`/`WG_NET` dans
  `/etc/jpcloud-netctl.conf` n'ont pas été vérifiés contre la configuration
  WireGuard réellement en place — cette opération réécrit `wg0.conf`.
- Ne pas activer `vpsd_api_enabled` pour les opérations de mutation avant
  d'avoir validé les opérations en lecture seule (`/wg/status`,
  `/system/info`) en production pendant quelques jours.
