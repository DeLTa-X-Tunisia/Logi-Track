/**
 * Script de génération de certificats SSL auto-signés pour Logi-Track
 * Permet le mode PWA sur Android (HTTPS requis par Chrome)
 * 
 * Usage: node src/generate-ssl.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SSL_DIR = path.join(__dirname, '..', 'ssl');

function generateSSL() {
  // Créer le dossier ssl
  if (!fs.existsSync(SSL_DIR)) {
    fs.mkdirSync(SSL_DIR, { recursive: true });
  }

  const keyPath = path.join(SSL_DIR, 'server.key');
  const certPath = path.join(SSL_DIR, 'server.crt');

  // Vérifier si les certificats existent déjà
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('✅ Certificats SSL déjà présents dans /ssl/');
    console.log(`   🔑 Clé:   ${keyPath}`);
    console.log(`   📜 Cert:  ${certPath}`);
    return;
  }

  // Obtenir les IPs locales pour les inclure dans le certificat
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const ips = ['127.0.0.1'];
  const dnsNames = ['localhost'];

  Object.values(interfaces).forEach(iface => {
    iface.forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    });
  });

  console.log('🔒 Génération des certificats SSL auto-signés...');
  console.log(`   IPs incluses: ${ips.join(', ')}`);

  // Construire le SAN (Subject Alternative Names)
  const sanEntries = [
    ...dnsNames.map((d, i) => `DNS.${i + 1} = ${d}`),
    ...ips.map((ip, i) => `IP.${i + 1} = ${ip}`)
  ].join('\n');

  // Créer un fichier de config OpenSSL temporaire
  const opensslConf = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = TN
ST = Tunis
L = Tunis
O = LogiTrack
OU = Production
CN = LogiTrack Local Server

[v3_req]
basicConstraints = CA:TRUE
keyUsage = digitalSignature, keyEncipherment, keyCertSign
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
${sanEntries}
`;

  const confPath = path.join(SSL_DIR, 'openssl.cnf');
  fs.writeFileSync(confPath, opensslConf);

  try {
    // Essayer avec OpenSSL
    execSync(
      `openssl req -x509 -nodes -days 3650 -newkey rsa:2048 ` +
      `-keyout "${keyPath}" -out "${certPath}" ` +
      `-config "${confPath}"`,
      { stdio: 'pipe' }
    );

    // Supprimer le fichier de config temporaire
    fs.unlinkSync(confPath);

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ Certificats SSL générés avec succès !                    ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  🔑 Clé privée:  ssl/server.key                             ║`);
    console.log(`║  📜 Certificat:  ssl/server.crt                             ║`);
    console.log('║                                                               ║');
    console.log('║  📱 Pour Android:                                            ║');
    console.log('║  1. Ouvrir https://<IP>:3002 dans Chrome                     ║');
    console.log('║  2. Accepter l\'avertissement de sécurité                     ║');
    console.log('║  3. Aller dans Chrome > ⋮ > Installer l\'application          ║');
    console.log('║                                                               ║');
    console.log('║  🔧 Pour supprimer l\'avertissement:                          ║');
    console.log('║  - Copier ssl/server.crt sur le téléphone                    ║');
    console.log('║  - Paramètres > Sécurité > Installer certificat              ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

  } catch (err) {
    // OpenSSL non disponible, utiliser Node.js crypto comme fallback
    console.log('⚠️  OpenSSL non trouvé, génération via Node.js crypto...');
    generateWithNodeCrypto(keyPath, certPath, ips, dnsNames);
    // Supprimer le fichier de config
    if (fs.existsSync(confPath)) fs.unlinkSync(confPath);
  }
}

function generateWithNodeCrypto(keyPath, certPath, ips, dnsNames) {
  const crypto = require('crypto');
  
  // Générer une paire de clés RSA
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Construire les Subject Alt Names
  const altNames = [
    ...dnsNames.map(d => ({ type: 2, value: d })),    // DNS
    ...ips.map(ip => ({ type: 7, ip: ip }))             // IP
  ];

  // Créer un certificat x509 auto-signé
  const cert = new crypto.X509Certificate(
    crypto.createSign('SHA256')
  );

  // Node.js natif ne supporte pas facilement la création de certs x509
  // On va utiliser une approche simplifiée avec forge-like
  // Fallback: générer un cert basique

  // Écrire la clé privée
  fs.writeFileSync(keyPath, privateKey);

  // Pour le certificat, on a besoin d'une lib additionnelle
  // Créer un script de fallback PowerShell
  const ps1 = `
$cert = New-SelfSignedCertificate \`
  -Subject "CN=LogiTrack Local Server" \`
  -DnsName "localhost",${dnsNames.map(d => `"${d}"`).join(',')} \`
  -CertStoreLocation "Cert:\\CurrentUser\\My" \`
  -NotAfter (Get-Date).AddYears(10) \`
  -KeyAlgorithm RSA \`
  -KeyLength 2048 \`
  -TextExtension @("2.5.29.17={text}${ips.map(ip => `IPAddress=${ip}`).join('&')}") \`
  -FriendlyName "LogiTrack SSL"

$pwd = ConvertTo-SecureString -String "logitrack" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "${path.join(SSL_DIR, 'server.pfx').replace(/\\/g, '\\\\')}" -Password $pwd
Export-Certificate -Cert $cert -FilePath "${certPath.replace(/\\/g, '\\\\')}" -Type CERT
`;

  try {
    const { execSync } = require('child_process');
    const ps1Path = path.join(SSL_DIR, 'gen.ps1');
    fs.writeFileSync(ps1Path, ps1);
    execSync(`powershell -ExecutionPolicy Bypass -File "${ps1Path}"`, { stdio: 'pipe' });
    fs.unlinkSync(ps1Path);
    fs.writeFileSync(keyPath, privateKey);
    console.log('✅ Certificats générés via PowerShell');
  } catch (e) {
    console.error('❌ Impossible de générer les certificats.');
    console.error('   Installez OpenSSL ou utilisez: choco install openssl');
    process.exit(1);
  }
}

generateSSL();
