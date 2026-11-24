import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { app } from '../server/app.ts'
import { LIMITE_CARACTERES_TEXTO } from '../src/lib/revisionTipos.ts'

test('el servidor rechaza con 413 un texto duplicado que supera el límite', async () => {
  const ruta = new URL(
    './fixtures/documento-muy-largo.txt',
    import.meta.url,
  )
  const original = await readFile(ruta, 'utf8')
  const texto = `${original}\n\n${original}`

  assert.equal(original.length > 12_000, true)
  assert.equal(texto.length > LIMITE_CARACTERES_TEXTO, true)

  const respuesta = await app.request('/api/revisar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      texto,
      tipoDocumento: 'ensayo-argumentativo',
      seccion: 'documento',
    }),
  })
  const datos = (await respuesta.json()) as { codigo?: string }

  assert.equal(respuesta.status, 413)
  assert.equal(datos.codigo, 'texto_demasiado_largo')
})
