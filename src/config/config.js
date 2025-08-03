const fs = require('fs');
const path = require('path');

// lee el certificado SSL
const sslCert = fs.readFileSync(path.join(__dirname, 'ssl-cert.pem'), 'utf8');

module.exports = {
  "development": {
    "username": process.env.DB_USER,
    "password": process.env.DB_PASSWORD,
    "database": process.env.DATABASE,
    "host": process.env.DB_HOST,
    "dialect": "mysql",
    "port": process.env.DB_PORT,
    "timezone": '-06:00',
    "dialectOptions": {
      "ssl": {
        "require": true,
        "rejectUnauthorized": false,
        "ca": sslCert
      }
    },
    "define": {
      "freezeTableName": true,
      "charset": "utf8",
      "dialectOptions": {
        "collate": "utf8_general_ci"
      },
      "timestamps": true
    }
  },
  "production": {
    "username": process.env.PROD_DB_USER,
    "password": process.env.PROD_DB_PASSWORD,
    "database": process.env.PROD_PROD_DATABASE,
    "host": process.env.PROD_DB_HOST,
    "dialect": "mysql",
    "timezone": '-06:00',
    "dialectOptions": {
      "ssl": {
        "require": true,
        "rejectUnauthorized": false,
        "ca": sslCert
      }
    },
    "define": {
      "freezeTableName": true,
      "charset": "utf8",
      "dialectOptions": {
        "collate": "utf8_general_ci"
      },
      "timestamps": true
    }
  }
}