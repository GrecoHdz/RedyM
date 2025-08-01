import CryptoJS from 'crypto-js'

const SECRET_KEY = process.env.JWT_SECRET

function encrypt(text) {
    return CryptoJS.AES.encrypt(text, SECRET_KEY).toString()
}

function decrypt(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
}

module.exports = { encrypt, decrypt }