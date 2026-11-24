import type { Rubrica } from './tipos.ts'

export const rubricaEnsayoArgumentativo: Rubrica = {
  id: 'ensayo-argumentativo',
  descripcion: 'Evalúa tesis, argumentos, desarrollo de lo anunciado y cierre.',
  criterios: [
    {
      id: 'ensayo.tesis',
      descripcion: 'La tesis es identificable y se mantiene a lo largo del texto.',
      queBuscar: [
        'una afirmación central reconocible',
        'que el cierre retome esa misma afirmación',
      ],
      tipo_problema: 'conclusion_incoherente',
    },
    {
      id: 'ensayo.argumentos',
      descripcion: 'Los argumentos están justificados con razones o evidencia.',
      queBuscar: [
        'afirmaciones sin razón que las sostenga',
        'saltos entre una afirmación y la siguiente',
      ],
      tipo_problema: 'hueco_argumental',
    },
    {
      id: 'ensayo.ideas-retomadas',
      descripcion: 'Las ideas anunciadas encuentran desarrollo.',
      queBuscar: [
        'promesas de la introducción sin desarrollo posterior',
        'temas anunciados que desaparecen del resto del texto',
      ],
      tipo_problema: 'idea_no_retomada',
    },
    {
      id: 'ensayo.conclusion',
      descripcion: 'La conclusión cierra la argumentación sin introducir temas nuevos.',
      queBuscar: [
        'temas que aparecen por primera vez al final',
        'un cierre que no responde a la tesis',
      ],
      tipo_problema: 'idea_nueva_en_conclusion',
    },
    {
      id: 'ensayo.equilibrio',
      descripcion: 'Las secciones están equilibradas y la progresión es comprensible.',
      queBuscar: [
        'un desarrollo mucho más corto que la introducción',
        'secciones con proporciones muy desiguales',
      ],
      tipo_problema: 'desequilibrio_entre_secciones',
    },
  ],
}
