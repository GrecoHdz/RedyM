// Importa todos los modelos existentes
const Usuario = require('./usuariosModel');
const Rol = require('./rolesModel');
const Ciudad = require('./ciudadesModel');
const RefreshToken = require('./refreshtokenModel');
const Cuenta = require('./cuentasModel');
const Notificacion = require('./notificacionesModel');
const NotificacionDestinatario = require('./notificacionesDestinatariosModel');
const Config = require('./configModel');
const SuscripcionNotificacion = require('./suscripcionesNotificacionesModel');

const Publicacion = require('./publicacionesModel');

// Función para configurar las asociaciones
const setupAssociations = () => {
  // Relación Usuario - Publicación
  Usuario.hasMany(Publicacion, {
    foreignKey: 'id_usuario',
    as: 'publicaciones',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });
  Publicacion.belongsTo(Usuario, {
    foreignKey: 'id_usuario',
    as: 'usuario',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  // Relación Usuario - Rol
  Usuario.belongsTo(Rol, {
    foreignKey: 'id_rol',
    as: 'rol'
  });
  Rol.hasMany(Usuario, {
    foreignKey: 'id_rol',
    as: 'usuarios'
  });

  // Relación Usuario - Ciudad
  Usuario.belongsTo(Ciudad, {
    foreignKey: 'id_ciudad',
    as: 'ciudad'
  });
  Ciudad.hasMany(Usuario, {
    foreignKey: 'id_ciudad',
    as: 'usuarios'
  });

  // Relación Usuario - RefreshToken
  Usuario.hasMany(RefreshToken, {
    foreignKey: 'usuario_id',
    as: 'refreshTokens',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  RefreshToken.belongsTo(Usuario, {
    foreignKey: 'usuario_id',
    as: 'usuario',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  // Relación Notificación - NotificaciónDestinatario
  Notificacion.hasMany(NotificacionDestinatario, {
    foreignKey: "id_notificacion",
    as: "destinatarios",
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });
  NotificacionDestinatario.belongsTo(Notificacion, {
    foreignKey: "id_notificacion",
    as: "notificacion",
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  // Relación Usuario - NotificaciónDestinatario
  Usuario.hasMany(NotificacionDestinatario, {
    foreignKey: "id_usuario",
    as: "notificacionesRecibidas",
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  NotificacionDestinatario.belongsTo(Usuario, {
    foreignKey: "id_usuario",
    as: "usuario",
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  // Relación Config - Usuario (para referidor predeterminado)
  Config.belongsTo(Usuario, {
    foreignKey: 'valor',
    as: 'referidorPredeterminado',
    constraints: false
  });

  // Relación SuscripcionNotificacion - Usuario
  SuscripcionNotificacion.belongsTo(Usuario, {
    foreignKey: 'id_usuario',
    as: 'usuario',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });
  Usuario.hasMany(SuscripcionNotificacion, {
    foreignKey: 'id_usuario',
    as: 'suscripciones',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  console.log('Asociaciones de RedYMercadeo configuradas correctamente');
};

// Exporta la función de configuración
module.exports = setupAssociations;