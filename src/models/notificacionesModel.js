const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Notificacion = sequelize.define("Notificacion", {
    id_notificacion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tipo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    titulo:{
        type: DataTypes.STRING,
        allowNull: false
    }, 
    creado_por:{
        type: DataTypes.STRING,
        allowNull: false
    }, 
    fecha_creacion:{
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    timestamps: false,
    tableName: "notificaciones",
});

/**
 * Inicializa las notificaciones base en la base de datos si no existen.
  * Este método automatiza la creación de plantillas de notificación.
  */
 Notificacion.inicializarNotificacionesBase = async function() {
     const notificaciones = [
         // Usuarios y Red
         { tipo: 'usuario', titulo: 'Nuevo registro en la plataforma', creado_por: 'Sistema' },
         { tipo: 'usuario', titulo: 'Nuevo referido directo en tu red', creado_por: 'Sistema' },
         { tipo: 'usuario', titulo: 'Has recibido un regalo de membresía 🎁', creado_por: 'Sistema' },
         { tipo: 'usuario', titulo: 'Solicitud de regalo de membresía enviada 🎁', creado_por: 'Sistema' },
         { tipo: 'usuario', titulo: 'Tu regalo de membresía ha sido aprobado ✅', creado_por: 'Sistema' },
         { tipo: 'usuario', titulo: 'Tu regalo de membresía ha sido rechazado ❌', creado_por: 'Sistema' },
         
         // Financieros y Comisiones
         { tipo: 'financieros', titulo: 'Comisión por referido recibida 💰', creado_por: 'Sistema' },
         { tipo: 'financieros', titulo: 'Comisión por expansión de red recibida ⚡', creado_por: 'Sistema' },
         { tipo: 'financieros', titulo: 'Comisión residual por renovación mensual 💰', creado_por: 'Sistema' },
         { tipo: 'financieros', titulo: 'Retiro de fondos aprobado ✅', creado_por: 'Sistema' },
         { tipo: 'financieros', titulo: 'Retiro de fondos rechazado ❌', creado_por: 'Sistema' },
         { tipo: 'financieros', titulo: 'Nueva petición de retiro enviada', creado_por: 'Sistema' },
         
         // Membresía
         { tipo: 'membresia', titulo: 'Pago de membresía recibido', creado_por: 'Sistema' },
         { tipo: 'membresia', titulo: 'Membresía activada exitosamente 🏆', creado_por: 'Sistema' },
         { tipo: 'membresia', titulo: 'Pago de membresía rechazado', creado_por: 'Sistema' },
         { tipo: 'membresia', titulo: 'Tu membresía ha vencido', creado_por: 'Sistema' },
         { tipo: 'membresia', titulo: 'Aviso: Tu membresía vence pronto (Periodo de gracia)', creado_por: 'Sistema' },
         
         // Publicidad (Ads)
         { tipo: 'publicidad', titulo: 'Pago de publicidad en revisión ⏳', creado_por: 'Sistema' },
         { tipo: 'publicidad', titulo: 'Publicidad aprobada y activa 🚀', creado_por: 'Sistema' },
         { tipo: 'publicidad', titulo: 'Pago de publicidad rechazado 🔴', creado_por: 'Sistema' },
         { tipo: 'publicidad', titulo: 'Tu publicidad ha finalizado', creado_por: 'Sistema' },
         
         // Misiones
         { tipo: 'misiones', titulo: 'Misión diaria completada 🎉', creado_por: 'Sistema' },
         { tipo: 'misiones', titulo: 'Misión especial enviada', creado_por: 'Sistema' },
         { tipo: 'misiones', titulo: 'Misión especial aprobada ⚡', creado_por: 'Sistema' },
         { tipo: 'misiones', titulo: 'Misión especial rechazada', creado_por: 'Sistema' },
         
         // Interacciones
         { tipo: 'interaccion', titulo: 'Alguien le dio like a tu publicación 👍', creado_por: 'Sistema' },
         { tipo: 'interaccion', titulo: 'Alguien compartió tu publicación 📲', creado_por: 'Sistema' },
         { tipo: 'interaccion', titulo: 'Alguien respondió tu encuesta 📊', creado_por: 'Sistema' },
         { tipo: 'interaccion', titulo: 'Alguien vio tu video completo 🎬', creado_por: 'Sistema' },
         { tipo: 'interaccion', titulo: 'Alguien visitó el enlace de tu publicación 🔗', creado_por: 'Sistema' },
         { tipo: 'interaccion', titulo: 'Alguien contactó por WhatsApp desde tu publicación 💬', creado_por: 'Sistema' },
         
         // Verificación
         { tipo: 'verificacion', titulo: 'Identidad verificada correctamente ✅', creado_por: 'Sistema' },
         { tipo: 'verificacion', titulo: 'Verificación de Identidad rechazada', creado_por: 'Sistema' },
         { tipo: 'verificacion', titulo: 'Solicitud de verificación recibida', creado_por: 'Sistema' },
     ];
 
     try {
         for (const notif of notificaciones) {
             await Notificacion.findOrCreate({
                 where: { titulo: notif.titulo },
                 defaults: {
                     ...notif,
                     fecha_creacion: new Date()
                 }
             });
         }
         console.log("✅ Notificaciones base inicializadas correctamente.");
     } catch (error) {
         console.error("❌ Error al inicializar notificaciones base:", error);
     }
 };
 
 module.exports = Notificacion;

