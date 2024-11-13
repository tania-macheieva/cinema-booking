    require('dotenv').config();
    const express = require('express'); 
    const session = require('express-session');
    const mysql = require('mysql');
    const bodyParser = require('body-parser');
    const path = require('path');
    const bcrypt = require('bcrypt');
    const { body, validationResult } = require('express-validator');
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    const app = express();
    const PORT = 3000;

    // Налаштування для парсингу
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.use(session({
        secret: process.env.SESSION_SECRET,  
        resave: false,
        saveUninitialized: true, 
    }));

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
    app.get('/', (req, res) => {
        // Перенаправлення на сторінку реєстрації
        res.redirect('/register');
    });

    app.get('/register', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'register.html'));
    });

    // Статичні файли
    app.use(express.static(path.join(__dirname, 'public')));

    // Маршрут для отримання даних фільмів
    app.get('/api/movies', (req, res) => {
        console.log('Fetching movies...');
        const query = 'SELECT * FROM movies;';
        db.query(query, (err, results) => {
            if (err) {
                console.error('Error retrieving movies:', err);
                return res.status(500).send('Error retrieving movies: ' + err.message);
            }
            console.log('Movies retrieved:', results);
            res.json(results);
        });
    });
    

    app.get('/login', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    });

    app.get('/index.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });


    // Маршрут для сторінки бронювання
    app.get('/booking', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'booking.html'));
    });

    // Маршрут для сторінки квитка
    app.get('/ticket.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'ticket.html'));
    }); 

    app.post('/login', (req, res) => {
        const { email, password } = req.body;
        const query = 'SELECT * FROM customers WHERE email = ?';
        db.query(query, [email], (err, results) => {
            if (err) {
                return res.status(500).send('Error retrieving user: ' + err.message);
            }
            if (results.length === 0) {
                return res.status(401).send('Email not found');
            }

            bcrypt.compare(password, results[0].password, (err, match) => {
                if (err) {
                    return res.status(500).send('Error comparing password: ' + err.message);
                }
                if (match) {
                    // Зберігаємо дані користувача в сесії
                    req.session.user = { 
                        full_name: results[0].full_name, 
                        phone: results[0].phone, 
                        email: results[0].email 
                    };

                    // Відправляємо ці дані як JSON у відповідь для клієнта
                    return res.json({
                        full_name: results[0].full_name,
                        phone: results[0].phone,
                        email: results[0].email
                    });
                } else {
                    return res.status(401).send('Incorrect password');
                }
            });
        });
    });



    // Обробка реєстрації 
    app.post('/register', [
        body('full_name').notEmpty().withMessage('Full name is required'),
        body('phone')
            .isLength({ min: 10 }).withMessage('Phone number must be at least 10 characters')
            .isNumeric().withMessage('Phone number must contain only numbers'),
        body('email').isEmail().withMessage('Invalid email format'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { full_name, phone, email, password } = req.body;

        // Перевірка наявності користувача
        const checkQuery = 'SELECT * FROM customers WHERE email = ? OR phone = ?';
        db.query(checkQuery, [email, phone], (err, results) => {
            if (err) {
                return res.status(500).send('Помилка при перевірці користувача');
            }

            if (results.length > 0) {
                return res.status(400).send('Користувач з таким електронним листом або номером телефону вже існує');
            }

            // Хешування пароля
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) {
                    return res.status(500).send('Помилка хешування пароля');
                }

                // Збереження нового користувача в базі даних
                const query = 'INSERT INTO customers (full_name, phone, email, password) VALUES (?, ?, ?, ?)';
                db.query(query, [full_name, phone, email, hash], (err, result) => {
                    if (err) {
                        return res.status(500).send('Помилка при збереженні користувача');
                    }

                    // Зберігаємо інформацію про користувача в сесії
                    req.session.user = { full_name, phone, email };

                    // Успішна реєстрація
                    return res.redirect('/movies.html');
                });

            });
        });
    });

    // Додати вміст сесії
    app.get('/api/session', (req, res) => {
        res.json({ ticketSaved: req.session.ticketSaved || false });
    });

    // Маршрут для збереження статусу квитка в сесії
    app.post('/api/session/ticket-saved', (req, res) => {
        req.session.ticketSaved = true;
        res.status(200).send('Квиток збережено в сесії.');
    });


   

    app.post('/api/ticket', (req, res) => { 
        const { title, session_time, session_date, seat_number, price, qr_code } = req.body; 
        
        if (!req.session.user) {
            return res.status(401).send('Unauthorized: Please log in to book a ticket');
        }
    
        const customer_email = req.session.user.email; 
    
        // Перевірка, чи існує вже квиток з цими даними
        const checkQuery = 'SELECT * FROM tickets WHERE title = ? AND session_time = ? AND session_date = ? AND customer_email = ? AND seat_number = ?';
        db.query(checkQuery, [title, session_time, session_date, customer_email, seat_number], (err, results) => {
            if (err) {
                console.error('Помилка при перевірці квитка:', err);
                return res.status(500).json({ error: 'Не вдалося перевірити квиток' });
            }
    
            if (results.length > 0) {
                return res.status(400).json({ error: 'Цей квиток вже заброньовано' });
            }
    
            const query = 'INSERT INTO tickets (title, session_time, session_date, customer_email, seat_number, price, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?)';
            db.query(query, [title, session_time, session_date, customer_email, seat_number, price, qr_code], (err, result) => {
                if (err) {
                    console.error('Помилка при збереженні квитка в базі:', err);
 
                }
    
                // Успішно збережено
                return res.status(200).json({ message: 'Квиток успішно збережено!' });
            }); 
        });
    });
    

    // Обробка бронювання квитка
    app.post('/book', (req, res) => {
        const { title, session_date, session_time, seats } = req.body;
        
        // Переконуємося, що дані користувача в сесії доступні
        if (!req.session.user) {
            return res.status(401).send('Unauthorized: Please log in to book a ticket');
        }

        const { full_name, phone, email } = req.session.user;

        return res.redirect(`/ticket.html?title=${encodeURIComponent(title)}&session_date=${encodeURIComponent(session_date)}&session_time=${encodeURIComponent(session_time)}&seats=${encodeURIComponent(seats)}&full_name=${encodeURIComponent(full_name)}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`);
 
    });


    // Обробка створення сесії оплати
    app.post('/create-checkout-session', async (req, res) => {
        const { title, price, session_date, session_time, seats, full_name, phone, email } = req.body;

        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'uah', // Валюта
                        product_data: {
                            name: title,
                            description: `Сеанс: ${session_time}, Дата: ${session_date}, Місця: ${seats}`,
                        },
                        unit_amount: price, // Вартість у копійках
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${req.headers.origin}/ticket.html?title=${encodeURIComponent(title)}&session_date=${encodeURIComponent(session_date)}&session_time=${encodeURIComponent(session_time)}&seats=${encodeURIComponent(seats)}&full_name=${encodeURIComponent(full_name)}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`,
                cancel_url: `${req.headers.origin}/movies.html`,
            });
            
            res.json({ url: session.url });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });


    // Маршрут для отримання квитків користувача за електронною поштою
    app.get('/api/tickets', (req, res) => {
        const email = req.query.email;
    
        const query = 'SELECT * FROM tickets WHERE customer_email = ?';
        db.query(query, [email], (err, results) => {
            if (err) {
                return res.status(500).send('Error retrieving tickets: ' + err.message);
            }
            res.json(results);
        });
    });
    

    app.get('/api/occupied-seats', (req, res) => {
        const { session_time, session_date } = req.query;
    
        const sql = `SELECT seat_number FROM tickets WHERE session_time = ? AND session_date = ?`;
        
        db.query(sql, [session_time, session_date], (err, results) => {
            if (err) {
                console.error('Помилка запиту:', err);
                return res.status(500).json({ error: 'Виникла помилка при отриманні зайнятих місць' });
            }
    
            const occupiedSeats = [];
            results.forEach(row => {
                const seats = row.seat_number.split(',');
                occupiedSeats.push(...seats.map(seat => parseInt(seat.trim(), 10)));
            });
            
            res.json(occupiedSeats);
        });
    });
    
    
    // Обробка помилок
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).send('Something went wrong!');
    });

    // Запуск сервера
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
