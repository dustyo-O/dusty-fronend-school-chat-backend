const http = require('http');
const fs = require('fs');
const path = require('path');

const { uid } = require('uid');
const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

const chat = [];
let typingCounter = 0;

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.use('/circles', express.static('circles'))

wss.on('connection', function connection(ws) {
    let isTyping = false;

    ws.on('error', console.error);

    ws.on('message', function message(buffer, isBinary) {
        if (isBinary) {
            const fileId = uid(16);

            const filename = path.join(process.cwd(), 'circles', fileId + '.webm');
            const fileUrl = '/circles/' + fileId + '.webm';

            fs.writeFile(filename, Buffer.from(buffer), () => {
                chat.push({ type: 'circle', message: fileUrl });

                for (const client of wss.clients) {
                    client.send(JSON.stringify({ type: 'circle', message: fileUrl }));
                }
            });

            return;
        }

        const json = buffer.toString();
        const data = JSON.parse(json);

        if (data.type === 'message') {
            const message = data.message;

            chat.push({ type: 'message', message });

            for (const client of wss.clients) {
                client.send(JSON.stringify({ type: 'message', message }));
            }
        }

        if (data.type === 'start-typing') {
            if (isTyping) {
                return;
            }

            isTyping = true;
            typingCounter += 1;

            for (const client of wss.clients) {
                client.send(JSON.stringify({ type: 'typing-change', count: typingCounter }));
            }
        }

        if (data.type === 'stop-typing') {
            if (!isTyping) {
                return;
            }

            isTyping = false;
            typingCounter -= 1;

            for (const client of wss.clients) {
                client.send(JSON.stringify({ type: 'typing-change', count: typingCounter }));
            }
        }
    });

    ws.on('close', () => {
        if (isTyping) {
            typingCounter -= 1;

            for (const client of wss.clients) {
                client.send(JSON.stringify({ type: 'typing-change', count: typingCounter }));
            }
        }
    });

    ws.send(JSON.stringify({
        type: 'chat',
        chat
    }));
});

server.listen(3000, () => console.log('Server started'));
