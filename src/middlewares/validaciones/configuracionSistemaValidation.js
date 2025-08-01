const { body, validationResult } = require('express-validator')

const ValidationRules = () => {
    return [
        body('precioSuscripcion').notEmpty().withMessage("El campo es obligatorio").isDecimal(),
        body('gananciasPorLike').notEmpty().withMessage("El campo es obligatorio").isDecimal(),
        body('porcentajeComisionNivel').notEmpty().withMessage("El campo es obligatorio").isDecimal(),
    ];
}

const validate = (req, res, next) => {

    const errors = validationResult(req)
    console.log('errors', errors);

    if (errors.isEmpty()) {
        return next()
    }

    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }))

    return res.status(422).json({
        message: extractedErrors,
    })
}

module.exports = { ValidationRules, validate }