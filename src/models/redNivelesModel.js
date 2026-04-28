const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const RedNiveles = sequelize.define("RedNiveles", {
    id_red: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
            model: 'usuario',
            key: 'id_usuario'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    id_padre: {
        type: DataTypes.INTEGER,
        allowNull: true, // Nulo para la empresa (root)
        references: {
            model: 'usuario',
            key: 'id_usuario'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    id_patrocinador: {
        type: DataTypes.INTEGER,
        allowNull: false, // Quién lo invitó realmente (100% comisión directa)
        references: {
            model: 'usuario',
            key: 'id_usuario'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    nivel_actual: {
        type: DataTypes.INTEGER,
        defaultValue: 0, // 0 = no ha pagado entrada, 1 = nivel 1 desbloqueado, etc.
        allowNull: false
    },
    posicion: {
        type: DataTypes.INTEGER, // 1, 2 o 3 (hijos de un padre)
        allowNull: true
    }
}, {
    timestamps: true,
    tableName: "red_niveles",
});

module.exports = RedNiveles;
