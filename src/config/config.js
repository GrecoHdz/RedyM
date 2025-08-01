module.exports = {
  "development": {
    "username": process.env.DB_USER,
    "password": process.env.DB_PASSWORD,
    "database": process.env.DATABASE,
    "host": process.env.DB_HOST,
    "dialect": "mysql",
    "port": process.env.DB_PORT,
    "timezone": '-06:00',
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