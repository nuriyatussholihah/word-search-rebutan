// Script pengujian konektivitas HTTP server
const http = require('http');

function checkUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function probe() {
  const server = require('../server');
  // Beri waktu 500ms agar server listen
  await new Promise(r => setTimeout(r, 500));

  const p1 = await checkUrl('http://localhost:3000/');
  console.log('GET / :', p1.statusCode, p1.data.includes('Word Search Rebutan') ? 'OK (HTML)' : 'FAILED');

  const p2 = await checkUrl('http://localhost:3000/host');
  console.log('GET /host :', p2.statusCode, p2.data.includes('Panel Host') ? 'OK (HTML)' : 'FAILED');

  const p3 = await checkUrl('http://localhost:3000/api/initial-data');
  const json = JSON.parse(p3.data);
  console.log('GET /api/initial-data :', p3.statusCode, 'Categories count:', json.categories.length);

  process.exit(0);
}

probe().catch(err => {
  console.error('Probe failed:', err);
  process.exit(1);
});
