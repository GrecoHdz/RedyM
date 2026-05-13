const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { apiLimiter } = require('../middlewares/rateLimiters');
const {
  obtenerMembresias,
  obtenerMembresiaPorId,
  obtenerHistorialMembresias,
  obtenerMembresiaActual,
  crearMembresia,
  actualizarMembresia,
  eliminarMembresia,
  obtenerProgresoMembresia,
  aprobarMembresia,
  regalarMembresia,
  rechazarMembresia
} = require("../controllers/MembresiaController");

// Middleware de autenticación
router.use(authMiddleware);

// Middleware de Limitador
router.use(apiLimiter);

// Middleware para validar errores
const validarErrores = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errores: errors.array() });
  }
  next();
};


// Obtener progreso de la membresía actual del usuario
router.get('/progreso/:id_usuario', obtenerProgresoMembresia);

// Obtener todas las membresias (solo para administradores)
router.get("/", obtenerMembresias);

// Obtener membresia actual de un usuario
router.get("/:id",
  [
    param("id").isInt().withMessage("El ID debe ser un número entero")
  ],
  validarErrores,
  obtenerMembresiaActual
);

router.get('/buscar/:id', validarErrores, obtenerMembresiaPorId);

// Obtener historial de membresias de un usuario
router.get("/historial/:id",
  [
    param("id").isInt().withMessage("El ID debe ser un número entero")
  ],
  validarErrores,
  obtenerHistorialMembresias
);

// Crear membresia
router.post("/",
  [
    body("id_usuario").isInt().withMessage("El id_usuario debe ser un número entero"),
    body("id_cuenta").optional().isInt().withMessage("El id_cuenta debe ser un número entero"),
    body("num_comprobante").optional().isString().withMessage("El num_comprobante debe ser una cadena de caracteres"),
    body("monto").isInt().withMessage("El monto debe ser un número entero"),
  ],
  validarErrores,
  crearMembresia
);

// Aprobar membrecía (solo administradores)
router.post("/aprobar/:id",
  [
    param("id").isInt().withMessage("El ID debe ser un número entero")
  ],
  validarErrores,
  aprobarMembresia
);

// Regalar membresía
router.post("/regalar", 
  [
    body("id_usuario_destino").isInt(),
    body("id_usuario_pagador").isInt(),
    body("monto").isNumeric()
  ],
  validarErrores,
  regalarMembresia
);

// Rechazar membresía
router.post("/rechazar/:id",
  [
    param("id").isInt()
  ],
  validarErrores,
  rechazarMembresia
);

// Actualizar membresia (solo administradores)
router.put("/:id",
  [
    param("id").isInt().withMessage("El ID debe ser un número entero"),
    body("estado").optional().isString().withMessage("El estado debe ser una cadena de caracteres")
  ],
  validarErrores,
  actualizarMembresia
);

// Eliminar membresia (solo administradores)
router.delete("/:id",
  [
    param("id").isInt().withMessage("El ID debe ser un número entero")
  ],
  validarErrores,
  eliminarMembresia
);

module.exports = router;

