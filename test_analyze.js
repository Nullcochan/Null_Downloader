const http = require('http');

const data = JSON.stringify({
    url: 'https://www.youtube.com/watch?v=RJXALPS3cl0'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/analyze',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    },
    timeout: 60000
};

console.log('Sending analyze request...');
const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
            const json = JSON.parse(body);
            if (json.success) {
                console.log('SUCCESS: Title is', json.video_info.title);
                process.exit(0);
            } else {
                console.error('FAILED: success is false', json);
                process.exit(1);
            }
        } catch (e) {
            console.error('FAILED to parse JSON:', body.substring(0, 500));
            process.exit(1);
        }
    });
});

req.on('error', (e) => {
    console.error('Request error:', e.message);
    process.exit(1);
});

req.on('timeout', () => {
    console.error('Request timed out');
    req.destroy();
    process.exit(1);
});

req.write(data);
req.end();
