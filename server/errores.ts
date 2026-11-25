/**
 * Error con un código estable y un estado HTTP.
 *
 * Las rutas y el middleware lanzan este error; `app.onError` lo convierte en
 * `{ ok: false, codigo, mensaje }`. El mensaje siempre está en español y nunca
 * incluye contraseñas, tokens ni detalles internos de PostgreSQL.
 */
export class ErrorApi extends Error {
  readonly codigo: string
  readonly estado: number

  constructor(codigo: string, estado: number, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.codigo = codigo
    this.estado = estado
  }
}

/**
 * La base de datos no está disponible o no tiene el esquema aplicado.
 * Se traduce a 503 para que el cliente muestre una pista útil.
 */
export class ErrorBaseDatos extends ErrorApi {
  constructor(mensaje: string) {
    super('base_datos_no_disponible', 503, mensaje)
    this.name = 'ErrorBaseDatos'
  }
}

/**
 * Falta una variable de entorno obligatoria o su valor no es válido.
 */
export class ErrorConfiguracion extends ErrorApi {
  constructor(mensaje: string) {
    super('configuracion', 500, mensaje)
    this.name = 'ErrorConfiguracion'
  }
}
