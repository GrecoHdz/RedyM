const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Ciudad = sequelize.define("Ciudad", {
    id_ciudad: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre_ciudad: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: false,
    tableName: "ciudad",
    hooks: {
        afterSync: async () => {
            try {
                const CiudadModel = sequelize.models.Ciudad;
                const count = await CiudadModel.count();
                if (count === 0) {
                    await CiudadModel.bulkCreate([
                        { id_ciudad: 1, nombre_ciudad: "Atlántida" },
                        { id_ciudad: 2, nombre_ciudad: "Choluteca" },
                        { id_ciudad: 3, nombre_ciudad: "Colón" },
                        { id_ciudad: 4, nombre_ciudad: "Comayagua" },
                        { id_ciudad: 5, nombre_ciudad: "Copán" },
                        { id_ciudad: 6, nombre_ciudad: "Cortés" },
                        { id_ciudad: 7, nombre_ciudad: "El Paraíso" },
                        { id_ciudad: 8, nombre_ciudad: "Francisco Morazán" },
                        { id_ciudad: 9, nombre_ciudad: "Gracias a Dios" },
                        { id_ciudad: 10, nombre_ciudad: "Intibucá" },
                        { id_ciudad: 11, nombre_ciudad: "Islas de la Bahía" },
                        { id_ciudad: 12, nombre_ciudad: "La Paz" },
                        { id_ciudad: 13, nombre_ciudad: "Lempira" },
                        { id_ciudad: 14, nombre_ciudad: "Ocotepeque" },
                        { id_ciudad: 15, nombre_ciudad: "Olancho" },
                        { id_ciudad: 16, nombre_ciudad: "Santa Bárbara" },
                        { id_ciudad: 17, nombre_ciudad: "Valle" },
                        { id_ciudad: 18, nombre_ciudad: "Yoro" }
                    ]);
                    console.log("🌱 Departamentos de Honduras creados exitosamente.");
                }
            } catch (error) {
                console.error("❌ Error al sembrar departamentos de Honduras:", error);
            }
        }
    }
});

module.exports = Ciudad;

