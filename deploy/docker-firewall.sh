#!/bin/sh
# Keep Docker's published ports off the public interface. Installed to
# /usr/local/sbin/ezymex-docker-firewall by deploy/install.sh and run at boot by
# ezymex-docker-firewall.service.
#
# Docker writes its own iptables rules ahead of UFW, so a container published as
# "8000:8000" binds 0.0.0.0 and answers the public internet even though UFW's default is
# deny and only Cloudflare is allowed to 80/443. Someone who learns the origin IP then
# reaches the app directly over plain HTTP, skipping the WAF, the rate limiting and the
# bot rules. This was not theoretical: on this host a test container published on 9999
# answered HTTP 200 from outside with no UFW rule permitting it.
#
# Docker leaves the DOCKER-USER chain alone for exactly this purpose, so an own chain
# hooked there covers every container, present and future - a compose file binding to
# 127.0.0.1 is the first line of defence, this is the one that cannot be forgotten.
# Host-to-container traffic is routed locally and never reaches FORWARD, so nginx on the
# box is unaffected, and a container's own outbound connections come back as ESTABLISHED
# and are let through.
#
# IPv6 is covered too. It is not reachable on this host today - UFW denies inbound v6,
# since its allow rules name Cloudflare's v4 ranges - and with Docker's own IPv6 disabled
# a published port is served by the userland proxy, which does pass through UFW. Enabling
# Docker IPv6 later would switch that to DNAT + FORWARD and reopen the bypass on v6
# exactly as on v4, so the rule goes in now rather than after the next audit.
set -e
IFACE="${IFACE:-eth0}"

for ipt in iptables ip6tables; do
  # the DOCKER-USER chain is created by dockerd; without it there is nothing to hook into
  "$ipt" -S DOCKER-USER >/dev/null 2>&1 || continue

  "$ipt" -N EZYMEX-DOCKER 2>/dev/null || "$ipt" -F EZYMEX-DOCKER
  "$ipt" -A EZYMEX-DOCKER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
  "$ipt" -A EZYMEX-DOCKER -j DROP

  # idempotent: only hook it in if it is not hooked in already
  "$ipt" -C DOCKER-USER -i "$IFACE" -j EZYMEX-DOCKER 2>/dev/null \
    || "$ipt" -I DOCKER-USER 1 -i "$IFACE" -j EZYMEX-DOCKER
done
