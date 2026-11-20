import { defineCatalog } from 'generative-frame/spec';

export const ponderCatalog = defineCatalog({
  components: {
    Card: {
      description: 'A titled panel for grouping related content.',
      props: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          subtitle: { type: 'string' },
        },
        required: ['title'],
      },
      slots: ['default'],
    },
    Button: {
      description: 'An interactive button that emits a press event.',
      props: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          variant: { type: 'string', enum: ['primary', 'secondary'] },
        },
        required: ['label'],
      },
      events: ['press'],
    },
    Text: {
      description: 'A paragraph of text. Supports inline LaTeX via $...$.',
      props: {
        type: 'object',
        properties: { content: { type: 'string' } },
        required: ['content'],
      },
    },
    Quiz: {
      description: 'A multiple-choice question with answer checking.',
      props: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctIndex: { type: 'number' },
          explanation: { type: 'string' },
        },
        required: ['question', 'options', 'correctIndex'],
      },
      events: ['submit'],
    },
    Slider: {
      description: 'A numeric slider bound to a state path.',
      props: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          min: { type: 'number' },
          max: { type: 'number' },
          step: { type: 'number' },
          statePath: { type: 'string' },
        },
        required: ['label', 'min', 'max', 'statePath'],
      },
    },
  Flashcard: {
    description: 'A flip card with question and answer sides.',
    props: {
      type: 'object',
      properties: { front: { type: 'string' }, back: { type: 'string' } },
      required: ['front', 'back'],
    },
  },
  Progress: {
    description: 'A progress bar showing completion percentage.',
    props: {
      type: 'object',
      properties: { value: { type: 'number' }, label: { type: 'string' } },
      required: ['value'],
    },
  },
  CodeBlock: {
    description: 'Syntax-highlighted code display.',
    props: {
      type: 'object',
      properties: { code: { type: 'string' }, language: { type: 'string' } },
      required: ['code'],
    },
  },
  },
  actions: {
    submit_answer: {
      description: 'Records a quiz answer.',
      params: {
        type: 'object',
        properties: { index: { type: 'number' } },
        required: ['index'],
      },
    },
  },
});
