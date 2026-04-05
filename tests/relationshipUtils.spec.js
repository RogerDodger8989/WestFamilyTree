import { describe, it, expect } from 'vitest';
import { calculateAdvancedRelationship } from '../src/relationshipUtils.js';

describe('calculateAdvancedRelationship', () => {
  // Enkel mock-databas med personer och deras föräldrar via relations-objektet
  const mockPeople = [
    { id: 'farfar', firstName: 'Farfar', relations: { parents: [] } },
    { id: 'farmor', firstName: 'Farmor', relations: { parents: [] } },
    
    // Barn till farfar & farmor (Helsyskon)
    { id: 'far', firstName: 'Far', relations: { parents: ['farfar', 'farmor'] } },
    { id: 'farbror', firstName: 'Farbror', relations: { parents: ['farfar', 'farmor'] } },
    
    // Barn till farfar och en annan kvinna (Halvsyskon till Far)
    { id: 'annan_kvinna', firstName: 'Annan Kvinna', relations: { parents: [] } },
    { id: 'halv_farbror', firstName: 'Halvfarbror', relations: { parents: ['farfar', 'annan_kvinna'] } },
    
    // Barnbarn (Kusiner & Halvkusiner)
    { id: 'jag', firstName: 'Jag', relations: { parents: ['far'] } },
    { id: 'kusin', firstName: 'Kusin', relations: { parents: ['farbror'] } },
    { id: 'halvkusin', firstName: 'Halvkusin', relations: { parents: ['halv_farbror'] } },
    
    // Barnbarns barn (Sysslingar)
    { id: 'mitt_barn', firstName: 'Mitt barn', relations: { parents: ['jag'] } },
    { id: 'kusins_barn', firstName: 'Kusins barn', relations: { parents: ['kusin'] } },
    
    // Barnbarns barnbarn (Bryllingar)
    { id: 'mitt_barnbarn', firstName: 'Mitt barnbarn', relations: { parents: ['mitt_barn'] } },
    { id: 'kusins_barnbarn', firstName: 'Kusins barnbarn', relations: { parents: ['kusins_barn'] } }
  ];

  it('identifierar samma person', () => {
    const res = calculateAdvancedRelationship('jag', 'jag', mockPeople);
    expect(res.text).toBe('Välj två olika personer');
  });

  it('identifierar förälder och barn', () => {
    const res1 = calculateAdvancedRelationship('jag', 'far', mockPeople);
    expect(res1.text).toBe('Barn');
    
    const res2 = calculateAdvancedRelationship('far', 'jag', mockPeople);
    expect(res2.text).toBe('Förälder');
  });

  it('identifierar helsyskon och halvsyskon via lcaCount', () => {
    const hel = calculateAdvancedRelationship('far', 'farbror', mockPeople);
    expect(hel.text).toBe('Syskon');
    expect(hel.lcaCount).toBe(2);

    const halv = calculateAdvancedRelationship('far', 'halv_farbror', mockPeople);
    expect(halv.text).toBe('Halvsyskon');
    expect(halv.lcaCount).toBe(1);
  });

  it('identifierar kusiner och halvkusiner', () => {
    const hel = calculateAdvancedRelationship('jag', 'kusin', mockPeople);
    expect(hel.text).toBe('Kusiner');

    const halv = calculateAdvancedRelationship('jag', 'halvkusin', mockPeople);
    expect(halv.text).toBe('Halvkusiner');
  });

  it('identifierar avlägsna släktskap (sysslingar och bryllingar)', () => {
    const syssling = calculateAdvancedRelationship('mitt_barn', 'kusins_barn', mockPeople);
    expect(syssling.text).toBe('Sysslingar (Nästkusiner)');

    const brylling = calculateAdvancedRelationship('mitt_barnbarn', 'kusins_barnbarn', mockPeople);
    expect(brylling.text).toBe('Bryllingar (Tredjekusiner)');
  });

  it('identifierar generationshopp (t.ex. farbror / brorson)', () => {
    const farbror = calculateAdvancedRelationship('jag', 'farbror', mockPeople);
    expect(farbror.text).toBe('Syskonbarn (Bror-/Systerson eller -dotter)');

    const brorson = calculateAdvancedRelationship('farbror', 'jag', mockPeople);
    expect(brorson.text).toBe('Faster / Moster / Farbror / Morbror');
  });

  it('identifierar flera gemensamma anor (lcaCount > 2) för t.ex. dubbelkusiner', () => {
    // Dubbelkusiner har två syskonpar som föräldrar, vilket ger 4 gemensamma mor-/farföräldrar
    const doubleCousinPeople = [
      ...mockPeople,
      { id: 'morfar', firstName: 'Morfar', relations: { parents: [] } },
      { id: 'mormor', firstName: 'Mormor', relations: { parents: [] } },
      { id: 'mor', firstName: 'Mor', relations: { parents: ['morfar', 'mormor'] } },
      { id: 'moster', firstName: 'Moster', relations: { parents: ['morfar', 'mormor'] } },
      { id: 'jag_dubbel', firstName: 'Jag Dubbelkusin', relations: { parents: ['far', 'mor'] } },
      { id: 'dubbelkusin', firstName: 'Dubbelkusin', relations: { parents: ['farbror', 'moster'] } }
    ];

    const res = calculateAdvancedRelationship('jag_dubbel', 'dubbelkusin', doubleCousinPeople);
    expect(res.text).toBe('Kusiner');
    expect(res.lcaCount).toBe(4);
  });
});