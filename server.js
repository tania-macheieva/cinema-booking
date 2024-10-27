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
    secret: process.env.SESSION_SECRET, // Використовуємо секрет з .env
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
    const query = 'SELECT * FROM movies';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).send('Error retrieving movies: ' + err.message);
        }
        res.json(results); // Відправляємо дані фільмів у форматі JSON
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

    // Отримання всіх необхідних даних з бази для вказаного email
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




  

// Обробка реєстрації користувача
// app.post('/register', [
//     body('full_name').notEmpty().withMessage('Full name is required'),
//     body('phone').isLength({ min: 10 }).withMessage('Phone number must be at least 10 characters'),
//     body('email').isEmail().withMessage('Invalid email format'),
//     body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
// ], (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({ errors: errors.array() });
//     }

//     const { full_name, phone, email, password } = req.body;

//     // Хешування пароля
//     bcrypt.hash(password, 10, (err, hash) => {
//         if (err) {
//             return res.status(500).send('Error hashing password');
//         }
        
//         const query = 'INSERT INTO customers (full_name, phone, email, password, registration_date) VALUES (?, ?, ?, ?, NOW())';
//         db.query(query, [full_name, phone, email, hash], (err, result) => {
//             if (err) {
//                 return res.status(500).send('Error saving data: ' + err.message);
//             } else {
//                 // Перенаправлення на сторінку ticket.html з параметрами запиту
//                 return res.redirect(`/ticket.html?full_name=${encodeURIComponent(full_name)}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`);
//             }
//         });
//     });
// });

// Обробка бронювання квитка
app.post('/book', (req, res) => {
    const { title, date, session, seats, fullName, phone, email } = req.body;

    // Тут виконуємо логіку для бронювання квитка (збереження в БД тощо)
    
    // Перенаправлення на сторінку ticket.html з параметрами запиту
    return res.redirect(`/ticket.html?title=${encodeURIComponent(title)}&date=${encodeURIComponent(date)}&session=${encodeURIComponent(session)}&seats=${encodeURIComponent(seats)}&full_name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`);
});

// Обробка створення сесії оплати
app.post('/create-checkout-session', async (req, res) => {
    const { title, price, date, session, seats, full_name, phone, email } = req.body;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: title,
                        description: `Сеанс: ${session}, Дата: ${date}, Місця: ${seats}`
                    },
                    unit_amount: price * 100
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}/ticket.html?title=${encodeURIComponent(title)}&date=${encodeURIComponent(date)}&session=${encodeURIComponent(session)}&seats=${encodeURIComponent(seats)}&full_name=${encodeURIComponent(full_name)}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`,
            cancel_url: `${req.headers.origin}/movies.html`
        });
        res.json({ id: session.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
