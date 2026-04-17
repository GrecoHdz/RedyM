const express = require("express");
const router = express.Router();
const { body, param, validationResult, query } = require("express-validator");   
const { authMiddleware } = require("../middlewares/authMiddleware");  
const { apiLimiter } = require('../middlewares/rateLimiters'); 
const { 
    getAllCreditos,
    getCreditoPorUsuario,
    getTopTecnicosConMasCredito,
    createCredito,
    resetCredito,
    deleteCredito
} = require("../controllers/CreditoController");
 
// Middleware de autenticación y Limitador
router.use(authMiddleware);
router.use(apiLimiter);

// Middleware para validar errores
const validarErrores = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errores: errors.array() });
    }
    next();
  }; 

//Obtener todas los creditos
router.get("/", getAllCreditos);

//Obtener un credito por usuario
router.get("/usuario/:id_usuario", [
    param("id_usuario").isInt().withMessage("El ID debe ser un numero entero"),
    validarErrores
], getCreditoPorUsuario);

// Obtener top 5 con más crédito
router.get("/tops", [
    query("id_rol").isInt().withMessage("El ID debe ser un numero entero"),
    validarErrores
], getTopTecnicosConMasCredito);

//Crear o Incrementar credito
router.post("/", [
    body("id_usuario").isInt().withMessage("El ID debe ser un numero entero"),
    body("monto_credito").isFloat().withMessage("El monto debe ser un número válido"),
    validarErrores
], createCredito); 
 
// Resetear crédito
router.put("/reset/:id_usuario", [
    param("id_usuario").isInt().withMessage("El ID debe ser un número entero"),
    validarErrores
], resetCredito);

//Eliminar credito
router.delete("/eliminar/:id_usuario", [
    param("id_usuario").isInt().withMessage("El ID debe ser un numero entero"),
    validarErrores
], deleteCredito); 

module.exports = router;
