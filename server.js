const express = require("express")
const app = express()
const cors = require("cors")
const cookieParser = require('cookie-parser')

const {
    query
} = require('express-validator')
require('dotenv').config()

const PORT = process.env.PORT
const whiteList = [process.env.ORIGIN]
console.log("lista blanca:", whiteList)

app.use(
    cors({
        origin: function (origin, callback) {
            console.log("😲😲😲 =>", origin)
            if (!origin || whiteList.includes(origin)) {
                console.log("Si entro aqui")
                return callback(null, origin)
            }
            console.log("No entro ...")
            return callback(
                "Error de CORS origin: " + origin + " No autorizado!"
            )
        },
        credentials: true,
    })
)

app.use(express.json())

app.use(cookieParser())
app.use(express.urlencoded({
    extended: true
}))

const db = require("./src/models")

db.sequelize.authenticate()
    .then(() => {
        console.log('✅ Conexión a Azure MySQL exitosa');
    })
    .catch(err => {
        console.error('❌ Error conectando a Azure MySQL:', err);
    });

db.sequelize.sync()
    .then(() => {
        console.log("Synced db.")
    })
    .catch((err) => {
        console.log("Failed to sync db: " + err.message)
    })

app.get('/', (req, res) => {
    res.send("Hola")
})
const indexRouter = require('./src/routes/index')
const errorHandlerMiddleware = require('./src/middlewares/errorHandlerMiddleware')
const logErrorHandlerMiddleware = require('./src/middlewares/logErrorHandlerMiddleware')

app.use(indexRouter)
app.use(logErrorHandlerMiddleware)
app.use(errorHandlerMiddleware)

app.listen(PORT, () => console.log('Listen: http://localhost:' + PORT))