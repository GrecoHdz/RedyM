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
        type: DataTypes.ENUM('pendiente_pago', 'verificando_pago', 'activa', 'borrada', 'reportada', 'rechazada'),
        defaultValue: 'pendiente_pago'
    },
    id_cuenta_pago: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    num_comprobante: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    comprobante_url: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    comprobante_public_id: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    whatsapp_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    whatsapp_number: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    presupuesto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    presupuesto_restante: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    fecha_finalizacion: {
        type: DataTypes.DATE,
        allowNull: true
    },
    total_interacciones: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    timestamps: false,
    tableName: 'publicacion'
});

module.exports = Publicacion;
