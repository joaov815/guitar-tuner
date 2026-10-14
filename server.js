#!/usr/bin/env node
// Static server for the web build — serves ./dist to everyone on the local network over HTTPS
// (needed for microphone access on other devices) and, on macOS, announces it as
// tuner.local via Bonjour/mDNS. There is no backend: all tuner logic runs in the browser.
//
// On first run it creates a small local certificate authority (certs/ca.crt) and a
// server certificate signed by it. Devices can install ca.crt from /ca.crt to trust it.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const HOSTNAME = process.env.TUNER_HOST || 'tuner.local';
const HTTPS_PORTS = process.env.HTTPS_PORT ? [Number(process.env.HTTPS_PORT)] : [443, 8443];
const HTTP_PORTS = process.env.PORT ? [Number(process.env.PORT)] : [80, 8080];
const PUBLIC_DIR = path.join(__dirname, 'dist'); // created by `npm run build:web`
const CERT_DIR = path.join(__dirname, 'certs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

let httpsPort = null;
let httpPort = null;

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

function isFromThisMachine(req) {
  const addr = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  return addr === '127.0.0.1' || addr === '::1' || lanAddresses().includes(addr);
}

const portSuffix = (port, defaultPort) => (port === defaultPort ? '' : `:${port}`);
const hostOf = (req) => (req.headers.host || HOSTNAME).replace(/:\d+$/, '');
const isLocalhost = (host) => host === 'localhost' || host === '127.0.0.1';

// ---------- Certificates ----------

function openssl(args, input) {
  execFileSync('openssl', args, { cwd: CERT_DIR, input, stdio: ['pipe', 'ignore', 'pipe'] });
}

function ensureCertificates() {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  const file = (name) => path.join(CERT_DIR, name);

  if (!fs.existsSync(file('ca.crt')) || !fs.existsSync(file('ca.key'))) {
    console.log('  Creating local certificate authority (certs/ca.crt)...');
    fs.writeFileSync(file('ca.cnf'), [
      '[req]', 'distinguished_name=dn', 'x509_extensions=v3_ca', 'prompt=no',
      '[dn]', 'CN=Guitar Tuner Local CA', 'O=Guitar Tuner',
      '[v3_ca]', 'basicConstraints=critical,CA:TRUE', 'keyUsage=critical,keyCertSign,cRLSign',
      'subjectKeyIdentifier=hash',
    ].join('\n'));
    openssl(['genrsa', '-out', 'ca.key', '2048']);
    openssl(['req', '-x509', '-new', '-key', 'ca.key', '-sha256', '-days', '3650', '-config', 'ca.cnf', '-out', 'ca.crt']);
    fs.rmSync(file('server.crt'), { force: true });
  }

  // Re-issue the server certificate whenever the set of names/IPs it must cover changes.
  const names = ['localhost', HOSTNAME, '127.0.0.1', ...lanAddresses()];
  const namesFile = file('server.names.json');
  const previous = fs.existsSync(namesFile) ? fs.readFileSync(namesFile, 'utf8') : '';
  if (!fs.existsSync(file('server.crt')) || previous !== JSON.stringify(names)) {
    console.log(`  Issuing HTTPS certificate for ${names.join(', ')}...`);
    const san = names.map((n) => (/^\d+\.\d+\.\d+\.\d+$/.test(n) ? `IP:${n}` : `DNS:${n}`)).join(',');
    fs.writeFileSync(file('server.ext'), [
      'basicConstraints=CA:FALSE', 'keyUsage=critical,digitalSignature,keyEncipherment',
      'extendedKeyUsage=serverAuth', `subjectAltName=${san}`,
    ].join('\n'));
    openssl(['genrsa', '-out', 'server.key', '2048']);
    openssl(['req', '-new', '-key', 'server.key', '-subj', `/CN=${HOSTNAME}`, '-out', 'server.csr']);
    // Apple rejects server certificates valid for more than 825 days.
    openssl(['x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial',
      '-days', '825', '-sha256', '-extfile', 'server.ext', '-out', 'server.crt']);
    fs.writeFileSync(namesFile, JSON.stringify(names));
  }

  return {
    key: fs.readFileSync(file('server.key')),
    cert: fs.readFileSync(file('server.crt')),
  };
}

// ---------- Request handling ----------

function log(req, urlPath) {
  console.log(`${new Date().toLocaleTimeString()}  ${req.socket.remoteAddress}  ${req.method} ${urlPath}`);
}

function serveCaCert(req, res) {
  fs.readFile(path.join(CERT_DIR, 'ca.crt'), (err, data) => {
    if (err) return res.writeHead(404).end('Not found');
    res.writeHead(200, {
      'Content-Type': 'application/x-x509-ca-cert',
      'Content-Disposition': 'attachment; filename="guitar-tuner-ca.crt"',
    });
    res.end(data);
  });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  log(req, urlPath);
  if (urlPath === '/ca.crt') return serveCaCert(req, res);

  let file = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!file.startsWith(PUBLIC_DIR)) return res.writeHead(403).end('Forbidden');
  if (urlPath.endsWith('/')) file = path.join(file, 'index.html');

  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function redirect(res, url) {
  res.writeHead(302, { Location: url }).end();
}

// Plain HTTP: this computer uses http://localhost (already a secure context, no certificate
// warning). Everyone else is sent to HTTPS — except /ca.crt, which must be reachable before
// the certificate is trusted.
function httpHandler(req, res) {
  const host = hostOf(req);
  if (isFromThisMachine(req)) {
    if (isLocalhost(host)) return serveStatic(req, res);
    return redirect(res, `http://localhost${portSuffix(httpPort, 80)}${req.url}`);
  }
  if (req.url.startsWith('/ca.crt')) return serveStatic(req, res);
  redirect(res, `https://${host}${portSuffix(httpsPort, 443)}${req.url}`);
}

function httpsHandler(req, res) {
  if (isFromThisMachine(req) && httpPort) {
    // Avoid the certificate warning on the host itself.
    return redirect(res, `http://localhost${portSuffix(httpPort, 80)}${req.url}`);
  }
  serveStatic(req, res);
}

// ---------- Startup ----------

function listen(createServer, ports) {
  return new Promise((resolve, reject) => {
    const tryPort = ([port, ...rest]) => {
      const server = createServer();
      server.once('error', (err) => {
        if ((err.code === 'EACCES' || err.code === 'EADDRINUSE') && rest.length) {
          console.log(`  Port ${port} unavailable (${err.code}), trying ${rest[0]}...`);
          tryPort(rest);
        } else {
          reject(err);
        }
      });
      server.listen(port, '0.0.0.0', () => resolve(port));
    };
    tryPort(ports);
  });
}

// Advertise HOSTNAME -> this machine's LAN IP using macOS's built-in dns-sd.
function publishMdns(port, ip) {
  if (process.platform !== 'darwin' || !ip) return null;
  const proc = spawn('dns-sd', ['-P', 'Guitar Tuner', '_https._tcp', 'local', String(port), HOSTNAME, ip], {
    stdio: 'ignore',
  });
  proc.on('error', () => {});
  return proc;
}

async function main() {
  let tls;
  try {
    tls = ensureCertificates();
  } catch (err) {
    console.error(`Could not create certificates with openssl: ${err.stderr || err.message}`);
    process.exit(1);
  }

  try {
    httpsPort = await listen(() => https.createServer(tls, httpsHandler), HTTPS_PORTS);
    httpPort = await listen(() => http.createServer(httpHandler), HTTP_PORTS);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const ips = lanAddresses();
  const mdns = publishMdns(httpsPort, ips[0]);
  const s = portSuffix(httpsPort, 443);

  console.log('\n  🎸 Guitar tuner is running\n');
  console.log(`  This computer:  http://localhost${portSuffix(httpPort, 80)}`);
  if (mdns) console.log(`  Network name:   https://${HOSTNAME}${s}`);
  ips.forEach((ip) => console.log(`  Network IP:     https://${ip}${s}`));
  console.log('\n  First visit on each device shows a certificate warning — tap Advanced → Proceed.');
  console.log(`  iPhone/iPad: install the certificate from http://${HOSTNAME}${portSuffix(httpPort, 80)}/ca.crt`);
  console.log('\n  Press Ctrl+C to stop.\n');

  const shutdown = () => {
    if (mdns) mdns.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
