import { z } from 'zod'
import {
  ESTADO_ERROR_GRAMATICA,
  MAX_CARACTERES_POR_PARRAFO,
  MAX_CARACTERES_POR_PETICION,
  MAX_LONGITUD_CLAVE,
  MAX_PARRAFOS_POR_PETICION,
  MENSAJES_ERROR_GRAMATICA,
} from '../src/lib/gramaticaTipos.ts'
import type {
  CodigoErrorGramatica,
  EstadoErrorGramatica,
  PeticionGramatica,
} from '../src/lib/gramaticaTipos.ts'

const esquemaParrafoCrudo = z.object({
  clave: z.string(),
  texto: z.string(),
})

const esquemaCuerpoCrudo = z.object({
  parrafos: z.array(esquemaParrafoCrudo),
})

export type ResultadoValidacionPeticionGramatica =
  | { ok: true; datos: PeticionGramatica }
  | {
      ok: false
      codigo: CodigoErrorGramatica
      estado: EstadoErrorGramatica
      mensaje: string
    }

function fallo(
  codigo: CodigoErrorGramatica,
): ResultadoValidacionPeticionGramatica {
  return {
    ok: false,
    codigo,
    estado: ESTADO_ERROR_GRAMATICA[codigo],
    mensaje: MENSAJES_ERROR_GRAMATICA[codigo],
  }
}

/**
 * Valida la petición sin recortar los textos.
 *
 * La forma se valida con Zod; los límites se comprueban por separado para
 * devolver el código específico (413) que corresponde a cada caso.
 */
export function validarPeticionGramatica(
  cuerpo: unknown,
): ResultadoValidacionPeticionGramatica {
  const base = esquemaCuerpoCrudo.safeParse(cuerpo)
  if (!base.success) return fallo('peticion_invalida')

  const { parrafos } = base.data

  if (parrafos.length === 0) return fallo('texto_vacio')
  if (parrafos.length > MAX_PARRAFOS_POR_PETICION) {
    return fallo('demasiados_parrafos')
  }
  if (parrafos.some((p) => p.texto.length > MAX_CARACTERES_POR_PARRAFO)) {
    return fallo('parrafo_demasiado_largo')
  }

  const total = parrafos.reduce((suma, p) => suma + p.texto.length, 0)
  if (total > MAX_CARACTERES_POR_PETICION) {
    return fallo('texto_demasiado_largo')
  }

  const claves = new Set<string>()
  for (const parrafo of parrafos) {
    if (
      parrafo.clave.length < 1 ||
      parrafo.clave.length > MAX_LONGITUD_CLAVE ||
      claves.has(parrafo.clave)
    ) {
      return fallo('peticion_invalida')
    }
    claves.add(parrafo.clave)
  }

  if (parrafos.every((p) => p.texto.trim().length === 0)) {
    return fallo('texto_vacio')
  }
  if (parrafos.some((p) => p.texto.length === 0)) {
    return fallo('peticion_invalida')
  }

  return { ok: true, datos: { parrafos } }
}

export const esquemaRespuestaLanguageTool = z.object({
  matches: z.array(
    z.object({
      message: z.string(),
      offset: z.number().int().nonnegative(),
      length: z.number().int().nonnegative(),
      rule: z
        .object({
          id: z.string(),
          issueType: z.string().optional(),
        })
        .optional(),
    }),
  ),
})

export type RespuestaLanguageTool = z.infer<
  typeof esquemaRespuestaLanguageTool
>
