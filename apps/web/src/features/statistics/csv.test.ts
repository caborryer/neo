import { csvCell, toCsv } from './csv';

describe('csvCell', () => {
  it('neutraliza fórmulas en texto', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+57 300')).toBe("'+57 300");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\t=x')).toBe("'\t=x");
  });
  it('no altera números, ni siquiera negativos', () => {
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell(4.5)).toBe('4.5');
  });
  it('escapa comillas, comas y saltos de línea', () => {
    expect(csvCell('Pérez, Ana')).toBe('"Pérez, Ana"');
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });
  it('nulos y vacíos quedan vacíos', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('añade BOM, CRLF y combina ambas protecciones', () => {
    const out = toCsv(['Nombre', 'Adherencia'], [['=HYPERLINK("x")', 80], ['Ana', null]]);
    expect(out.startsWith('﻿')).toBe(true);
    expect(out).toBe('﻿Nombre,Adherencia\r\n"\'=HYPERLINK(""x"")",80\r\nAna,\r\n');
  });
});
