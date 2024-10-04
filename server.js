const http = require('http');
const fs = require('fs');
const path = require('path');

// Створюємо сервер
const server = http.createServer((req, res) => {
    // Читаємо сторінку index.html
    if (req.url === '/index.html') {
        const contents = fs.readFileSync(__dirname + "/public/index.html");
        res.setHeader("Content-Type", "text/html");
        res.writeHead(200);
        res.end(contents);
    } 
    // Читаємо сторінку booking.html
    else if (req.url === '/booking.html') {
        const contents = fs.readFileSync(__dirname + "/public/booking.html");
        res.setHeader("Content-Type", "text/html");
        res.writeHead(200);
        res.end(contents);
    } 
    // Читаємо статичні ресурси (наприклад, стилі чи скрипти)
    else if (req.url.endsWith('.css') || req.url.endsWith('.js')) {
        const filePath = path.join(__dirname, req.url);
        const fileContents = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        let contentType = 'text/plain';

        // Визначаємо тип контенту для файлів
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.js') contentType = 'application/javascript';

        res.setHeader("Content-Type", contentType);
        res.writeHead(200);
        res.end(fileContents);
    }
    // Відповідь 404, якщо файл не знайдено
    else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('404: Page not found');
    }
});

// Запускаємо сервер на порту 3000
server.listen(3000, () => {
    console.log('Server is listening on http://localhost:3000');
});
