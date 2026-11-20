import type { Explanation, VisualisationSpec } from './schema.ts';

export const WHY_MOON_PHASES_EXPLANATION: Explanation = {
  question: 'Why does the Moon have phases?',
  title: 'Why the Moon changes shape across the month',
  shortAnswer:
    'The Sun always lights up half of the Moon, just like it lights up half of the Earth. As the Moon orbits us every 29.5 days, we see different fractions of that sunlit side from our vantage point on Earth.',
  sections: [
    {
      heading: 'A common misconception',
      content:
        'Moon phases are not caused by the Earth casting a shadow onto the Moon. That only happens rarely, during a lunar eclipse. Every night of a normal month, half of the Moon is brightly lit by the Sun, even during a thin crescent or a New Moon.',
    },
    {
      heading: 'What actually changes is our viewing angle',
      content:
        'When the Moon sits between the Earth and the Sun, its sunlit side faces away from us, so we see a dark New Moon. Two weeks later, when the Moon is on the opposite side of Earth from the Sun, we look straight at its fully illuminated face, a Full Moon. Everywhere in between, we see a crescent, quarter, or gibbous sliver.',
    },
    {
      heading: 'Waxing vs. waning',
      content:
        'As the lit fraction grows from New Moon toward Full Moon, the Moon is waxing. Once it passes Full Moon and the lit fraction shrinks back toward New Moon, it is waning.',
    },
  ],
  keyTakeaway:
    'Half of the Moon is always illuminated by the Sun. A phase is simply how much of that lit half is turned toward Earth at a given point in its orbit.',
  keyTakeaways: [
    'The Sun illuminates 50% of the Moon at all times, regardless of the phase we see.',
    'Phases are governed by the Sun-Earth-Moon viewing angle over the 29.5-day synodic cycle.',
    'Earth’s shadow is not involved in normal phases, it only causes rare lunar eclipses.',
  ],
  glossary: [
    {
      term: 'Synodic month',
      definition: 'The 29.5-day cycle it takes for the Moon to return to the same phase as seen from Earth.',
    },
    {
      term: 'Waxing',
      definition: 'The half of the lunar cycle when the visible sunlit portion grows from New Moon toward Full Moon.',
    },
    {
      term: 'Gibbous',
      definition: 'A phase in which more than half, but less than all, of the Moon’s Earth-facing disc is lit.',
    },
    {
      term: 'Terminator',
      definition: 'The sharp dividing line between the sunlit day side and the dark night side of the Moon.',
    },
  ],
  understandingChecks: [
    {
      question: 'During a New Moon, how much of the entire Moon is actually being lit by the Sun?',
      options: [
        'None of it, Earth blocks all sunlight.',
        'Half of it, its far side faces the Sun.',
        'Only a thin edge around the rim.',
      ],
      correctIndex: 1,
      explanation:
        'Half of the Moon is always illuminated by sunlight. At New Moon, that lit hemisphere faces away from Earth.',
    },
    {
      question: 'Why does a lunar eclipse not happen during every Full Moon?',
      options: [
        'The Moon orbits Earth on a plane tilted by about 5 degrees.',
        'The Sun moves behind the Moon faster than Earth rotates.',
        'Earth has no shadow at night.',
      ],
      correctIndex: 0,
      explanation:
        'Because the Moon’s orbit is tilted ~5° relative to Earth’s orbit around the Sun, the Moon usually passes slightly above or below Earth’s shadow.',
    },
  ],
  depth: 'standard',
  visualisation: {
    type: 'concept_simulation',
    mode: 'moon_phases',
    title: 'Orbital Moon phase explorer',
    description:
      'Drag the Moon around Earth or move the orbital angle slider to compare the top-down sunlight geometry with the phase visible from Earth.',
    defaultAngle: 135,
  },
  suggestedFollowUps: [
    'Why do we always see the same side of the Moon?',
    'What is the difference between a Moon phase and a lunar eclipse?',
    'Why is a half-lit Moon called a Quarter Moon?',
  ],
};

export const ENGINE_SHOWCASE_DEMOS: {
  id: string;
  label: string;
  question: string;
  caption: string;
  spec: VisualisationSpec;
}[] = [
  {
    id: 'moon',
    label: 'Concept simulation',
    question: 'Why does the Moon have phases?',
    caption: 'Drag the Moon along its orbit to inspect how sunlight angle creates each lunar phase.',
    spec: WHY_MOON_PHASES_EXPLANATION.visualisation!,
  },
  {
    id: 'derivative',
    label: 'Interactive graph',
    question: 'What is a derivative?',
    caption: 'Slide the tangent point along a curve to see how instantaneous slope changes at every x.',
    spec: {
      type: 'interactive_graph',
      title: 'Curve and instantaneous tangent slope',
      description: 'Adjust the quadratic steepness (a) and scrub x to observe the derivative dy/dx.',
      xLabel: 'x',
      yLabel: 'f(x)',
      xMin: -4,
      xMax: 4,
      yMin: -2,
      yMax: 10,
      series: [
        {
          id: 'fx',
          label: 'f(x) = a·x² + b',
          expression: 'a * x^2 + b',
          colorRole: 'accent',
        },
      ],
      parameters: [
        {
          id: 'a',
          label: 'Curvature (a)',
          min: 0.25,
          max: 2,
          step: 0.25,
          defaultValue: 0.75,
          unit: '',
        },
        {
          id: 'b',
          label: 'Vertical shift (b)',
          min: -1,
          max: 3,
          step: 0.5,
          defaultValue: 0.5,
          unit: '',
        },
      ],
      showTangentAtX: true,
      defaultTangentX: 1.5,
    },
  },
  {
    id: 'binary-search',
    label: 'Step explorer',
    question: 'How does binary search work?',
    caption: 'Step through how halving the search space finds target 23 in three comparisons.',
    spec: {
      type: 'step_explorer',
      title: 'Binary search for target 23',
      description: 'Sorted array: [4, 8, 15, 16, 23, 42, 55, 68]. Watch the search bounds narrow by half.',
      steps: [
        {
          title: 'Initial range',
          operation: 'Check midpoint index 3 -> value 16',
          explanation:
            'Start with the full array (indices 0 to 7). The middle element is 16, which is smaller than 23.',
          state: [
            { label: 'Low index', value: '0 (4)' },
            { label: 'Mid index', value: '3 (16)', highlight: true },
            { label: 'High index', value: '7 (68)' },
            { label: 'Decision', value: '23 > 16 -> discard left half' },
          ],
        },
        {
          title: 'Second comparison',
          operation: 'Check midpoint index 5 -> value 42',
          explanation:
            'Now search only indices 4 to 7. The new midpoint is 42, which is larger than 23.',
          state: [
            { label: 'Low index', value: '4 (23)' },
            { label: 'Mid index', value: '5 (42)', highlight: true },
            { label: 'High index', value: '7 (68)' },
            { label: 'Decision', value: '23 < 42 -> discard right half' },
          ],
        },
        {
          title: 'Target found',
          operation: 'Check midpoint index 4 -> value 23',
          explanation:
            'Only index 4 remains. The midpoint equals our target 23, finishing in 3 steps instead of 5.',
          state: [
            { label: 'Low index', value: '4 (23)' },
            { label: 'Mid index', value: '4 (23)', highlight: true },
            { label: 'High index', value: '4 (23)' },
            { label: 'Result', value: 'Found at index 4' },
          ],
        },
      ],
    },
  },
  {
    id: 'gravity',
    label: 'Experiment slider',
    question: 'How does gravity change with distance?',
    caption: 'Test Newton’s inverse-square law by varying orbital altitude and planet mass.',
    spec: {
      type: 'experiment_slider',
      title: 'Surface gravity & inverse-square dropoff',
      description: 'Compare gravitational acceleration relative to Earth surface gravity (1.0 g).',
      parameters: [
        {
          id: 'mass',
          label: 'Planet mass (Earth = 1)',
          min: 0.2,
          max: 5,
          step: 0.1,
          defaultValue: 1,
          unit: 'M⊕',
        },
        {
          id: 'dist',
          label: 'Distance from center (Earth radius = 1)',
          min: 1,
          max: 6,
          step: 0.2,
          defaultValue: 1,
          unit: 'R⊕',
        },
      ],
      outputs: [
        {
          id: 'g_rel',
          label: 'Relative gravity',
          expression: 'mass / (dist ^ 2)',
          unit: 'g',
          precision: 3,
        },
        {
          id: 'accel',
          label: 'Acceleration',
          expression: '9.81 * mass / (dist ^ 2)',
          unit: 'm/s²',
          precision: 2,
        },
      ],
      insightRules: [
        {
          outputId: 'g_rel',
          below: 0.26,
          message: 'Doubling your distance from the center drops gravity to a quarter of its surface strength.',
        },
        {
          outputId: 'g_rel',
          above: 2.0,
          message: 'Above 2 g, a 70 kg person experiences over 140 kg-force of apparent weight.',
        },
      ],
    },
  },
];

export const EXAMPLE_QUESTIONS: {
  question: string;
  topic: string;
  modelHint: string;
}[] = [
  {
    question: 'Why does the Moon have phases?',
    topic: 'Astronomy',
    modelHint: 'Orbital simulation',
  },
  {
    question: 'How does gravity work?',
    topic: 'Physics',
    modelHint: 'Orbital experiment',
  },
  {
    question: 'What is a derivative?',
    topic: 'Calculus',
    modelHint: 'Tangent graph',
  },
  {
    question: 'How does binary search work?',
    topic: 'Algorithms',
    modelHint: 'Step trace',
  },
  {
    question: 'How do sound waves work?',
    topic: 'Acoustics',
    modelHint: 'Wave explorer',
  },
  {
    question: 'Why do we see rainbows?',
    topic: 'Optics',
    modelHint: 'Refraction diagram',
  },
];
