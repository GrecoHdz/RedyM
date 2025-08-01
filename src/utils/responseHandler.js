class ResponseHandler {
    static success(data = null, message = '') {
        return {
            success: true,
            data,
            message,
        }
    }

    static error(message = 'Ha ocurrido un error',) {
        return {
            success: false,
            data: null,
            message,
        }
    }
}

module.exports = ResponseHandler