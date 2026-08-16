import type { Background } from '@/types'

export const PRESET_GRADIENTS: { name: string; background: Background }[] = [
  {
    name: 'Sunset',
    background: {
      type: 'linear-gradient',
      angle: 135,
      stops: [
        { offset: 0, color: '#ff7c29' },
        { offset: 0.5, color: '#ff3c8e' },
        { offset: 1, color: '#9b1dff' },
      ],
    },
  },
  {
    name: 'Ocean',
    background: {
      type: 'linear-gradient',
      angle: 180,
      stops: [
        { offset: 0, color: '#0a2463' },
        { offset: 1, color: '#3e8989' },
      ],
    },
  },
  {
    name: 'Aurora',
    background: {
      type: 'linear-gradient',
      angle: 135,
      stops: [
        { offset: 0, color: '#00d2a0' },
        { offset: 0.5, color: '#0077ff' },
        { offset: 1, color: '#7c00e3' },
      ],
    },
  },
  {
    name: 'Midnight',
    background: {
      type: 'linear-gradient',
      angle: 180,
      stops: [
        { offset: 0, color: '#0d1b4b' },
        { offset: 1, color: '#050510' },
      ],
    },
  },
  {
    name: 'Coral',
    background: {
      type: 'linear-gradient',
      angle: 90,
      stops: [
        { offset: 0, color: '#ff7b6b' },
        { offset: 1, color: '#e91e8c' },
      ],
    },
  },
  {
    name: 'Emerald',
    background: {
      type: 'linear-gradient',
      angle: 180,
      stops: [
        { offset: 0, color: '#50c878' },
        { offset: 1, color: '#1a5c35' },
      ],
    },
  },
  {
    name: 'Lavender',
    background: {
      type: 'linear-gradient',
      angle: 135,
      stops: [
        { offset: 0, color: '#c9b8f5' },
        { offset: 1, color: '#5b8dee' },
      ],
    },
  },
  {
    name: 'Fire',
    background: {
      type: 'linear-gradient',
      angle: 0,
      stops: [
        { offset: 0, color: '#cc0000' },
        { offset: 0.5, color: '#ff6600' },
        { offset: 1, color: '#ffdd00' },
      ],
    },
  },
  {
    name: 'Peach',
    background: {
      type: 'linear-gradient',
      angle: 135,
      stops: [
        { offset: 0, color: '#ffb347' },
        { offset: 1, color: '#ff6b9d' },
      ],
    },
  },
  {
    name: 'Sky',
    background: {
      type: 'linear-gradient',
      angle: 180,
      stops: [
        { offset: 0, color: '#87ceeb' },
        { offset: 1, color: '#f0f8ff' },
      ],
    },
  },
  {
    name: 'Forest',
    background: {
      type: 'linear-gradient',
      angle: 180,
      stops: [
        { offset: 0, color: '#1a4731' },
        { offset: 1, color: '#2d6a4f' },
      ],
    },
  },
  {
    name: 'Berry',
    background: {
      type: 'linear-gradient',
      angle: 135,
      stops: [
        { offset: 0, color: '#6a0572' },
        { offset: 1, color: '#c0392b' },
      ],
    },
  },
  {
    name: 'Gold',
    background: {
      type: 'linear-gradient',
      angle: 135,
      stops: [
        { offset: 0, color: '#f9d71c' },
        { offset: 1, color: '#e67e22' },
      ],
    },
  },
  {
    name: 'Storm',
    background: {
      type: 'linear-gradient',
      angle: 180,
      stops: [
        { offset: 0, color: '#4a4a4a' },
        { offset: 1, color: '#7f8c9a' },
      ],
    },
  },
  {
    name: 'Neon',
    background: {
      type: 'linear-gradient',
      angle: 90,
      stops: [
        { offset: 0, color: '#00ffe7' },
        { offset: 1, color: '#ff00cc' },
      ],
    },
  },
  {
    name: 'Dusk',
    background: {
      type: 'linear-gradient',
      angle: 135,
      stops: [
        { offset: 0, color: '#ff7043' },
        { offset: 0.5, color: '#7e57c2' },
        { offset: 1, color: '#1565c0' },
      ],
    },
  },
  {
    name: 'Dawn',
    background: {
      type: 'linear-gradient',
      angle: 45,
      stops: [
        { offset: 0, color: '#f8a5c2' },
        { offset: 1, color: '#f9d976' },
      ],
    },
  },
  {
    name: 'Mint',
    background: {
      type: 'linear-gradient',
      angle: 135,
      stops: [
        { offset: 0, color: '#a8edca' },
        { offset: 1, color: '#00bcd4' },
      ],
    },
  },
  {
    name: 'Rose',
    background: {
      type: 'linear-gradient',
      angle: 135,
      stops: [
        { offset: 0, color: '#f48fb1' },
        { offset: 1, color: '#c2185b' },
      ],
    },
  },
  {
    name: 'Slate',
    background: {
      type: 'linear-gradient',
      angle: 180,
      stops: [
        { offset: 0, color: '#b0bec5' },
        { offset: 1, color: '#37474f' },
      ],
    },
  },
  {
    name: 'Arctic',
    background: {
      type: 'linear-gradient',
      angle: 180,
      stops: [
        { offset: 0, color: '#ffffff' },
        { offset: 1, color: '#b3e5fc' },
      ],
    },
  },
  {
    name: 'Tropical',
    background: {
      type: 'linear-gradient',
      angle: 90,
      stops: [
        { offset: 0, color: '#00897b' },
        { offset: 0.5, color: '#43a047' },
        { offset: 1, color: '#c8e64c' },
      ],
    },
  },
]
