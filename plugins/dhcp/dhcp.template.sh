#!/bin/bash
source %FIREROUTER_HOME%/platform/platform.sh
DNSMASQ_BINARY=$(get_dnsmasq_path)
redis-cli HINCRBY "stats:systemd:restart" firerouter_dhcp 1
$DNSMASQ_BINARY -k --clear-on-reload -u pi -C %FIREROUTER_HOME%/etc/dnsmasq.dhcp.default.conf &
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT
for job in `jobs -p`; do wait $job; echo "$job exited"; done