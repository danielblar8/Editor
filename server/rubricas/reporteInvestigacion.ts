import type { Rubrica } from './tipos.ts'

export const rubricaReporteInvestigacion: Rubrica = {
  id: 'reporte-investigacion',
  descripcion:
    'Evalúa objetivo, método, resultados y conclusiones sustentadas.',
  criterios: [
    {
      id: 'reporte.objetivo',
      descripcion: 'El objetivo o propósito de la investigación está explícito.',
      queBuscar: [
        'una pregunta o propósito reconocible',
        'que las conclusiones respondan a ese objetivo',
      ],
      tipo_problema: 'conclusion_incoherente',
    },
    {
      id: 'reporte.metodo',
      descripcion: 'El método o procedimiento se describe con claridad.',
      queBuscar: [
        'pasos o criterios sin explicar',
        'un salto entre el objetivo y los resultados',
      ],
      tipo_problema: 'hueco_argumental',
    },
    {
      id: 'reporte.resultados',
      descripcion: 'Los resultados responden al objetivo y se presentan con claridad.',
      queBuscar: [
        'aspectos del objetivo que nunca se presentan como resultados',
        'resultados enunciados sin desarrollo',
      ],
      tipo_problema: 'idea_no_retomada',
    },
    {
      id: 'reporte.conclusiones',
      descripcion: 'Las conclusiones se sustentan en los resultados y no añaden hallazgos.',
      queBuscar: [
        'hallazgos que aparecen solo en las conclusiones',
        'afirmaciones finales sin respaldo en los resultados',
      ],
      tipo_problema: 'idea_nueva_en_conclusion',
    },
    {
      id: 'reporte.proporcion',
      descripcion: 'Las secciones guardan un orden y una proporción adecuados.',
      queBuscar: [
        'una sección de resultados demasiado breve',
        'desequilibrio entre método, resultados y conclusiones',
      ],
      tipo_problema: 'desequilibrio_entre_secciones',
    },
  ],
}
