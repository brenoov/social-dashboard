// SP-4: monta o adset.targeting a partir de um `publico` (preset ou config inline) + a loja.
// Nunca deixa sem geo: sem cidades no publico, usa as cidades da loja (evita público mundial).
export function montarTargeting(publico, loja) {
  const cidadesLoja = (loja?.geoCities || []).map((key) => ({ key }));
  if (!publico) return { geo_locations: { cities: cidadesLoja } };

  const t = {};
  const cities = (publico.geo?.cities || []).map((c) => {
    const o = { key: c.key };
    if (c.radius) { o.radius = c.radius; o.distance_unit = c.distance_unit || 'kilometer'; }
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
  return t;
}
