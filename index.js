const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const usuarios = require('./data/usuarios');
const tareas = require('./data/tareas');

const app = express();
const PORT = 3000;
const secretKey = 'tu_super_secreto'; // ¡En un entorno real, usa una variable de entorno!

const usuariosFilePath = path.join(__dirname, 'data', 'usuarios.js');
const tareasFilePath = path.join(__dirname, 'data', 'tareas.js');

function saveUsuarios() {
    fs.writeFileSync(usuariosFilePath, `module.exports = ${JSON.stringify(usuarios, null, 2)};`, 'utf8');
}

function saveTareas() {
    fs.writeFileSync(tareasFilePath, `module.exports = ${JSON.stringify(tareas, null, 2)};`, 'utf8');
}

app.use(express.json());

// Middleware para autenticar el token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

// Endpoint para registrar un nuevo usuario
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Nombre de usuario y contraseña son requeridos' });
    }

    const userExists = usuarios.some(u => u.username === username);
    if (userExists) {
        return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }

    const newUser = { id: usuarios.length + 1, username, password };
    usuarios.push(newUser);
    saveUsuarios();
    res.status(201).json({ message: 'Usuario registrado con éxito' });
});

// Endpoint para iniciar sesión y obtener un token
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = usuarios.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const accessToken = jwt.sign({ username: user.username, id: user.id }, secretKey, { expiresIn: '1h' });
    res.json({ accessToken });
});

// Endpoint para obtener las tareas del usuario autenticado
app.get('/tareas', authenticateToken, (req, res) => {
    const userTareas = tareas.filter(t => t.userId === req.user.id);
    res.json(userTareas);
});

// Endpoint para crear una nueva tarea
app.post('/tareas', authenticateToken, (req, res) => {
    const { title, description } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'El título es requerido' });
    }

    const newTarea = {
        id: tareas.length + 1,
        title,
        description: description || '',
        completed: false,
        userId: req.user.id
    };

    tareas.push(newTarea);
    saveTareas();
    res.status(201).json(newTarea);
});

// Endpoint para eliminar una tarea
app.delete('/tareas/:id', authenticateToken, (req, res) => {
    const tareaId = parseInt(req.params.id, 10);
    const tareaIndex = tareas.findIndex(t => t.id === tareaId);

    if (tareaIndex === -1) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    if (tareas[tareaIndex].userId !== req.user.id) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar esta tarea' });
    }

    tareas.splice(tareaIndex, 1);
    saveTareas();
    res.status(200).json({ message: 'Tarea eliminada con éxito' });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app; // Export for testing 