/*    Copyright 2019 Firewalla Inc
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

const Promise = require('bluebird');
const { exec } = require('child-process-promise');
const PlatformLoader = require('../platform/PlatformLoader.js');
const platform = PlatformLoader.getPlatform();

function extend(target) {
  var sources = [].slice.call(arguments, 1);
  sources.forEach(function (source) {
    for (var prop in source) {
      target[prop] = source[prop];
    }
  });
  return target;
}

function getPreferredName(hostObject) {
  if (hostObject == null) {
    return null
  }

  if (hostObject.name) {
    return hostObject.name // always use user customized name first
  }

  return getPreferredBName(hostObject);
}


function getPreferredBName(hostObject) {

  if (hostObject == null) {
    return null;
  }

  if (hostObject.cloudName) {
    return hostObject.cloudName
  }

  if (hostObject.spoofMeName) {
    return hostObject.spoofMeName
  }

  if (hostObject.dhcpName) {
    return hostObject.dhcpName
  }

  if (hostObject.bonjourName) {
    return hostObject.bonjourName
  }

  if (hostObject.bname) {
    return hostObject.bname
  }

  if (hostObject.pname) {
    return hostObject.pname
  }
  if (hostObject.hostname) {
    return hostObject.hostname
  }
  if (hostObject.macVendor != null) {
    let name = hostObject.macVendor
    return name
  }
  return hostObject.ipv4Addr
}

function delay(t) {
  return new Promise(function (resolve) {
    setTimeout(resolve, t);
  });
}

// pass in function arguments object and returns string with whitespaces
function argumentsToString(v) {
  // convert arguments object to real array
  var args = Array.prototype.slice.call(v);
  for (var k in args) {
    if (typeof args[k] === "object") {
      // args[k] = JSON.stringify(args[k]);
      args[k] = require('util').inspect(args[k], false, null, true);
    }
  }
  var str = args.join(" ");
  return str;
}

function wrapIptables(rule) {
  const res = rule.match(/ -[AID] /);

  if (!res) return rule;

  const command = res[0];
  const checkRule = rule.replace(command, " -C ");

  switch (command) {
    case " -I ":
    case " -A ":
      return `bash -c '${checkRule} &>/dev/null || ${rule}'`;

    case " -D ":
      return `bash -c '${checkRule} &>/dev/null && ${rule}; true'`;
  }
}

async function generatePSK(ssid, passphrase) {
  const ssidHex = _getCLangHexString(ssid);
  const passphraseHex = _getCLangHexString(passphrase);
  const lines = await exec(`bash -c "${platform.getWpaPassphraseBinPath()} ${ssidHex} ${passphraseHex}"`).then((result) => result.stdout.trim().split('\n').map(line => line.trim())).catch(err => []);
  for (const line of lines) {
    if (line.startsWith("psk="))
      return line.substring(4);
  }
  return null;
}

function _getCLangHexString(str) {
  const hexArray = getHexStrArray(str);
  return `$'${hexArray.map(hex => `\\x${hex}`).join("")}'`;
}

function getHexStrArray(str) {
  const result = [];
  const buf = Buffer.from(str, 'utf8');
  for (let i = 0; i < buf.length; i++) {
    result.push(Number(buf[i]).toString(16));
  }
  return result;
}

async function generateWpaSupplicantConfig(key, values) {
  const storage = require('./storage.js');
  let value = values[key];
  switch (key) {
    case "ssid":
    case "password":
    case "wep_key0":
    case "wep_key1":
    case "wep_key2":
    case "wep_key3":
      // use hex string for ssid/eap password in case of special characters
      value = getHexStrArray(value).join("");
      break;
    case "psk":
      value = await generatePSK(values["ssid"], value);
      break;
    case "ca_cert":
    case "ca_cert2":
    case "client_cert":
    case "client_cert2":
    case "private_key":
    case "private_key2":
      value = `"${storage.getSavedFilePath(value)}"`;
      break;
    case "identity":
    case "anonymous_identity":
    case "phase1":
    case "phase2":
    case "sae_password":
    case "private_key_passwd":
    case "private_key2_passwd":
      value = `"${value}"`;
    default:
  }
  return value;
}

module.exports = {
  extend: extend,
  getPreferredBName: getPreferredBName,
  getPreferredName: getPreferredName,
  delay: delay,
  argumentsToString: argumentsToString,
  wrapIptables: wrapIptables,
  getHexStrArray: getHexStrArray,
  generatePSK: generatePSK,
  generateWpaSupplicantConfig: generateWpaSupplicantConfig
};
