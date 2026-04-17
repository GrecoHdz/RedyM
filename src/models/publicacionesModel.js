const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Publicacion = sequelize.define("Publicacion", {
    id_publicacion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuario',
            key: 'id_usuario'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    external_url: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    // Formato Poll: { question: '...', options: ['...', '...', '...'], correct_index: 0 }
    poll_data: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('poll_data');
            try {
                return rawValue ? JSON.parse(rawValue) : null;
            } catch (e) {
                return null;
            }
        },
        set(value) {
            this.setDataValue('poll_data', value ? JSON.stringify(value) : null);
        }
    },
    // Almacenamos los archivos como un array JSON en formato string para máxima compatibilidad
    // Formato: [{ url: '...', type: 'image/video', public_id: '...' }]
    media: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: '[]',
        get() {
            const rawValue = this.getDataValue('media');
            try {
                return rawValue ? JSON.parse(rawValue) : [];
            } catch (e) {
                return [];
            }
        },
        set(value) {
            this.setDataValue('media', JSON.stringify(value));
        }
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    likes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    vistas: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    estado: {
        type: DataTypes.ENUM('activa', 'borrada', 'reportada'),
        defaultValue: 'activa'
    },
    whatsapp_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: false,
    tableName: 'publicacion'
});

module.exports = Publicacion;
