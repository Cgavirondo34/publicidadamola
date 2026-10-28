import { describe, expect, it } from 'vitest';
import { ALLOWED_CLAIMS, checkClaims, HEADLINE_SUGGESTIONS } from '../src/lib/claims';

const kinds = (text: string) => checkClaims([['Titular', text]]).map((i) => i.kind);

describe('control de claims (manual de marca)', () => {
  it('los claims permitidos y los titulares sugeridos no generan avisos', () => {
    expect(checkClaims(ALLOWED_CLAIMS.map((c, i) => [`Beneficio ${i + 1}`, c]))).toEqual([]);
    expect(checkClaims(HEADLINE_SUGGESTIONS.map((h) => ['Titular', h]))).toEqual([]);
  });

  it('frases cotidianas no son falsos positivos', () => {
    for (const t of ['Se trata de comer rico', 'Alimentación sana y consciente', 'Nuevas en tu dietética', '20% off en tu primera compra', '15 % de descuento', 'Recetas fáciles y ricas en 15 minutos'])
      expect(kinds(t), t).toEqual([]);
  });

  it('detecta promesas de salud', () => {
    expect(kinds('Previene la diabetes')).toContain('salud');
    expect(kinds('Ideal para bajar de peso')).toContain('salud');
    expect(kinds('Plan detox')).toContain('salud');
    expect(kinds('Fortalece tu sistema inmunológico')).toContain('salud');
  });

  it('detecta certificaciones no documentadas', () => {
    expect(kinds('Legumbres orgánicas')).toContain('certificacion');
    expect(kinds('Sin TACC')).toContain('certificacion');
    expect(kinds('Producto certificado')).toContain('certificacion');
  });

  it('detecta datos nutricionales y comparaciones', () => {
    expect(kinds('Alto en proteínas')).toContain('nutricional');
    expect(kinds('Con 30% más de hierro')).toContain('nutricional');
    expect(kinds('12 g de proteína por porción')).toContain('nutricional');
    expect(kinds('3 veces más nutritivas')).toContain('comparacion');
    expect(kinds('Las mejores legumbres')).toContain('comparacion');
    expect(kinds('Un sabor único')).toContain('comparacion');
  });

  it('detecta exageraciones y tono de marketing genérico', () => {
    expect(kinds('El alimento milagroso')).toContain('exageracion');
    expect(kinds('LEGUMBRES GERMINADAS YA')).toContain('tono');
    expect(kinds('¡¡¡Llegaron!!!')).toContain('tono');
  });

  it('indica el campo y el fragmento exacto', () => {
    const [issue] = checkClaims([['Beneficio 2', 'Rico en fibra']]);
    expect(issue.field).toBe('Beneficio 2');
    expect(issue.match.toLowerCase()).toBe('rico en fibra');
  });
});
