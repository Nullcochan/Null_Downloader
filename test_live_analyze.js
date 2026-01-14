const https = require('https');

const data = JSON.stringify({
    url: 'https://www.youtube.com/watch?v=RJXALPS3cl0'
});

const options = {
    hostname: 'null-downloader.onrender.com',
    port: 443,
    path: '/analyze',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    },
    timeout: 120000 // Render free tier wake-up time
};

console.log('Sending logic probe to LIVE server (null-downloader.onrender.com)...');
console.log('Targeting Video: RJXALPS3cl0 (G4L)');

const req = https.request(options, (res) => {
    let body = '';
    console.log(`Response Status: ${res.statusCode}`);

    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        try {
            if (res.statusCode !== 200) {
                console.error('LIVE VERIFICATION FAILED. Status:', res.statusCode);
                console.error('Body:', body);
                process.exit(1);
            }

            const json = JSON.parse(body);
            if (json.success) {
                console.log('LIVE VERIFICATION SUCCESS!');
                console.log('Title:', json.video_info.title);
                console.log('Formats:', json.video_info.formats.length + ' options found');
                process.exit(0);
            } else {
                console.error('LIVE VERIFICATION FAILED: Logic error', json);
                process.exit(1);
            }
        } catch (e) {
            console.error('LIVE VERIFICATION FAILED: Invalid JSON', body.substring(0, 200));
            process.exit(1);
        }
    });
});

req.on('error', (e) => {
    console.error('Connection Error:', e.message);
    process.exit(1);
});

req.write(data);
req.end();
