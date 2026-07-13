// SP-4: monta o adset.targeting a partir de um `publico` (preset ou config inline) + a loja.
// Nunca deixa sem geo: sem cidades no publico, usa as cidades da loja (evita público mundial).
export function montarTargeting(publico, loja) {
  const cidadesLoja = (loja?.geoCities || []).map((key) => ({ key }));
  if (!publico) return { geo_locations: { cities: cidadesLoja } };

  const t = {};
  const cities = (publico.geo?.cities || []).map((c) => {
    const o = { key: c.key };
    if (c.radius) {
      // Meta rejeita raio de cidade abaixo do mínimo (~17 km / 10 mi) com code 1487110 —
      // clamp defensivo pra subida nunca falhar por raio curto (validado ao vivo 2026-07-12).
      const unit = c.distance_unit || 'kilometer';
      const min = unit === 'mile' ? 10 : 17;
      o.radius = c.radius < min ? min : c.radius;
      o.distance_unit = unit;
    }
    return o;
  });
  t.geo_locations = { cities: cities.length ? cities : cidadesLoja };

  const excl = publico.geo?.excluded || [];
  if (excl.length) {
    const ex = {};
    for (const e of excl) {
      const bucket = e.type === 'region' ? 'regions' : 'cities';
      (ex[bucket] ||= []).push({ key: e.key });
    }
    t.excluded_geo_locations = ex;
  }

  if (publico.idade_min != null) t.age_min = publico.idade_min;
  if (publico.idade_max != null) t.age_max = publico.idade_max;
  if (publico.generos?.length) t.genders = publico.generos;
  if (publico.interesses?.length) t.flexible_spec = [{ interests: publico.interesses.map((i) => ({ id: i.id, name: i.name })) }];
  if (publico.custom_audiences?.length) t.custom_audiences = publico.custom_audiences.map((a) => ({ id: a.id }));
  // Meta liga o Advantage+ Audience por padrão e aí REJEITA segmentação manual de idade/gênero/
  // interesses (code 1870227). Como aqui o usuário definiu um público à mão, opta por sair —
  // as restrições viram limites de verdade (validado ao vivo 2026-07-12).
  t.targeting_automation = { advantage_audience: 0 };
  return t;
}
