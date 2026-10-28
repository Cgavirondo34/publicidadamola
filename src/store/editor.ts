import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { DesignElement, Project } from '../types';

const MAX_HISTORY = 100;
const MERGE_MS = 450; // cambios seguidos sobre la misma propiedad = un solo paso de historia

interface EditorState {
  project: Project | null;
  selectedId: string | null;
  past: DesignElement[][];
  future: DesignElement[][];
  dirty: boolean;
  lastKey: string;
  lastAt: number;

  load: (p: Project) => void;
  select: (id: string | null) => void;
  update: (id: string, patch: Partial<DesignElement>, key?: string) => void;
  setElements: (els: DesignElement[]) => void;
  add: (el: DesignElement, index?: number) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  reorder: (id: string, dir: 'up' | 'down' | 'top' | 'bottom') => void;
  rename: (name: string) => void;
  undo: () => void;
  redo: () => void;
  markSaved: (p: Partial<Project>) => void;
}

export const useEditor = create<EditorState>((set, get) => {
  /** guarda el estado actual en la historia antes de modificarlo */
  const snapshot = (key = '') => {
    const s = get();
    if (!s.project) return;
    const now = Date.now();
    if (key && key === s.lastKey && now - s.lastAt < MERGE_MS) {
      set({ lastAt: now });
      return;
    }
    set({
      past: [...s.past, s.project.elements].slice(-MAX_HISTORY),
      future: [],
      lastKey: key,
      lastAt: now,
    });
  };

  const apply = (fn: (els: DesignElement[]) => DesignElement[]) => {
    const p = get().project;
    if (!p) return;
    set({ project: { ...p, elements: fn(p.elements) }, dirty: true });
  };

  return {
    project: null,
    selectedId: null,
    past: [],
    future: [],
    dirty: false,
    lastKey: '',
    lastAt: 0,

    load: (p) => set({ project: p, selectedId: null, past: [], future: [], dirty: false, lastKey: '', lastAt: 0 }),
    select: (id) => set({ selectedId: id }),

    update: (id, patch, key) => {
      snapshot(key ? `${id}:${key}` : '');
      apply((els) => els.map((e) => (e.id === id ? ({ ...e, ...patch } as DesignElement) : e)));
    },

    setElements: (els) => {
      snapshot();
      apply(() => els);
    },

    add: (el, index) => {
      snapshot();
      apply((els) => {
        const copy = [...els];
        copy.splice(index ?? copy.length, 0, el);
        return copy;
      });
      set({ selectedId: el.id });
    },

    remove: (id) => {
      snapshot();
      apply((els) => els.filter((e) => e.id !== id));
      if (get().selectedId === id) set({ selectedId: null });
    },

    duplicate: (id) => {
      const el = get().project?.elements.find((e) => e.id === id);
      if (!el) return;
      const off = Math.round(Math.min(get().project!.width, get().project!.height) * 0.02);
      const copy = { ...el, id: nanoid(10), name: `${el.name} (copia)`, x: el.x + off, y: el.y + off, locked: false } as DesignElement;
      const idx = get().project!.elements.findIndex((e) => e.id === id);
      get().add(copy, idx + 1);
    },

    reorder: (id, dir) => {
      snapshot();
      apply((els) => {
        const i = els.findIndex((e) => e.id === id);
        if (i < 0) return els;
        const copy = [...els];
        const [el] = copy.splice(i, 1);
        const to = dir === 'up' ? Math.min(i + 1, copy.length) : dir === 'down' ? Math.max(i - 1, 0) : dir === 'top' ? copy.length : 0;
        copy.splice(to, 0, el);
        return copy;
      });
    },

    rename: (name) => {
      const p = get().project;
      if (p) set({ project: { ...p, name }, dirty: true });
    },

    undo: () => {
      const s = get();
      if (!s.project || !s.past.length) return;
      const prev = s.past[s.past.length - 1];
      set({
        past: s.past.slice(0, -1),
        future: [s.project.elements, ...s.future].slice(0, MAX_HISTORY),
        project: { ...s.project, elements: prev },
        dirty: true,
        lastKey: '',
      });
      if (s.selectedId && !prev.some((e) => e.id === s.selectedId)) set({ selectedId: null });
    },

    redo: () => {
      const s = get();
      if (!s.project || !s.future.length) return;
      const [next, ...rest] = s.future;
      set({
        future: rest,
        past: [...s.past, s.project.elements],
        project: { ...s.project, elements: next },
        dirty: true,
        lastKey: '',
      });
    },

    markSaved: (patch) => {
      const p = get().project;
      if (p) set({ project: { ...p, ...patch }, dirty: false });
    },
  };
});
