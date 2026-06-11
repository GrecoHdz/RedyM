const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Config = sequelize.define("config", {
    id_config: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tipo_config: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    valor: {
        type: DataTypes.STRING(100),
        allowNull: false
    }
}, {
    timestamps: false,
    tableName: "config",
    hooks: {
        afterSync: async () => {
            try {
                const ConfigModel = sequelize.models.config;
                const count = await ConfigModel.count();
                if (count === 0) {
                    await ConfigModel.bulkCreate([
                        { tipo_config: "valor_like", valor: "0.05" },
                        { tipo_config: "valor_video", valor: "0.15" },
                        { tipo_config: "valor_encuesta", valor: "0.20" },
                        { tipo_config: "valor_compartir", valor: "0.25" },
                        { tipo_config: "valor_membresia", valor: "20" },
                        { tipo_config: "referido_predeterminado", valor: "1" },
                        { tipo_config: "dias_gracia_membresia", valor: "5" },
                        { tipo_config: "valor_visita_web", valor: "0.05" },
                        { tipo_config: "valor_visita_whatsapp", valor: "0.10" },
                        { tipo_config: "numero_empresa", valor: "94517811" },
                        { tipo_config: "retiro_minimo", valor: "50" },
                        { tipo_config: "valor_mision", valor: "0.5" }
                    ]);
                    console.log("🌱 Registros iniciales de configuración creados exitosamente.");
                }
            } catch (error) {
                console.error("❌ Error al sembrar los datos de configuración inicial:", error);
            }
        }
    }
});

module.exports = Config;