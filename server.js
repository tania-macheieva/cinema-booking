    require('dotenv').config();
    const express = require('express'); 
    const mysql = require('mysql');
    const bodyParser = require('body-parser');
    const path = require('path');
    const bcrypt = require('bcrypt');
    const { body, validationResult } = require('express-validator');

    const app = express();
    const PORT = 3000;

    // Налаштування для парсингу
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    // Підключення до бази даних
    const db = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    // Підключення до бази даних
    db.connect((err) => {
        if (err) {
            console.error('Database connection failed: ' + err.stack);
            return;
        }
        console.log('Connected to database.');
    });

    // Статичні файли
    app.use(express.static(path.join(__dirname, 'public')));

    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'movies.html'));
    });

    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).send('Something went wrong!');
    });


    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'booking.html'));
    });

    // Обробка додавання нового фільму
    // Маршрут для отримання даних фільмів
    app.get('/api/movies', (req, res) => {
        const query = 'SELECT * FROM movies';
        db.query(query, (err, results) => {
            if (err) {
                return res.status(500).send('Error retrieving movies: ' + err.message);
            }
            res.json(results); // Відправляємо дані фільмів у форматі JSON
        });
    });



    // Обробка реєстрації користувача
    app.post('/register', [
        body('full_name').notEmpty().withMessage('Full name is required'),
        body('phone').isLength({ min: 10 }).withMessage('Phone number must be at least 10 characters'),
        body('email').isEmail().withMessage('Invalid email format'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ], (req, res) => {
        console.log(req.body); 
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { full_name, phone, email, password } = req.body;

        // Хешування пароля
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                return res.status(500).send('Error hashing password');
            }
            
            const query = 'INSERT INTO customers (full_name, phone, email, password, registration_date) VALUES (?, ?, ?, ?, NOW())';
            db.query(query, [full_name, phone, email, hash], (err, result) => {
                if (err) {
                    return res.status(500).send('Error saving data: ' + err.message);
                } else {
                    // Перенаправлення на сторінку ticket.html з параметрами запиту
                    return res.redirect(`/ticket.html?full_name=${encodeURIComponent(full_name)}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`);
                }
            });
        });
    });


    // Обробка бронювання квитка
    app.post('/book', (req, res) => {
        const { title, date, session, seats, fullName, phone, email } = req.body;

        // Тут виконуємо логіку для бронювання квитка (збереження в БД тощо)
        
        // Перенаправлення на сторінку ticket.html з параметрами запиту
        return res.redirect(`/ticket.html?title=${encodeURIComponent(title)}&date=${encodeURIComponent(date)}&session=${encodeURIComponent(session)}&seats=${encodeURIComponent(seats)}&full_name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`);
    });


    // Запуск сервера
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });