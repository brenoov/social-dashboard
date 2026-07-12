// coletor/lib/meta-subir.mjs — core reutilizável do "subir campanha": monta o payload da criativa
// (multi-destino Messenger+WhatsApp+Instagram OU WhatsApp-puro) e cria adcreative+ad PAUSED de
// forma idempotente (item × adset), pulando o que já existe e parando de forma retomável em rate
// limit (Meta code 17). Extraído de subir-campanha-genspark.mjs (multi-destino, proven em produção)
// + subir-campanha-meta.mjs (ramo WhatsApp-puro, payloadImagemUnica).

// Os conjuntos multi-destino (destination_type contendo WHATSAPP + MESSENGER/INSTAGRAM) NÃO podem
// receber um ad WhatsApp-puro (link wa.me + CTA WHATSAPP_MESSAGE) — a Meta exige asset_feed_spec com
// optimization_type DOF_MESSAGING_DESTINATION e um call_to_action por destino (senão: subcode
// 2446493 "degrees_of_freedom ausente" / destino inválido).
export const DOF_FEATURES = ["adapt_to_placement","add_text_overlay","ads_with_benefits","advantage_plus_creative","app_highlights","audio","auto_promotion_tag","biz_ai","carousel_to_video","catalog_feed_tag","creative_stickers","customize_product_recommendation","cv_transformation","description_automation","dha_optimization","dynamic_cta_text","dynamic_partner_content","enable_ncs_testimonials","enhance_cta","fb_feed_tag","fb_reels_tag","fb_story_tag","feed_caption_optimization","generate_cta","hide_price","hyperlink_formatting","ig_feed_tag","ig_glados_feed","ig_reels_tag","ig_stream_tag","ig_video_native_subtitle","image_animation","image_auto_crop","image_background_gen","image_banner","image_brightness_and_contrast","image_end_card","image_enhancement","image_templates","image_text_translation","image_touchups","image_uncrop","inline_comment","local_store_extension","media_liquidity_animated_image","media_order","media_type_automation","multi_creative_post_carousel","multi_photo_to_video","music_generation","pac_genai_recomposition","pac_recomposition","pac_relaxation","product_browsing","product_extensions","product_metadata_automation","product_tags","profile_card","profile_extension","replace_media_text","reveal_details_over_time","show_destination_blurbs","show_summary","site_extensions","standard_enhancements_catalog","text_extraction_for_headline","text_extraction_for_tap_target","text_formatting_optimization","text_generation","text_optimizations","text_overlay_translation","text_translation","translate_voiceover","video_auto_crop","video_filtering","video_highlight","video_highlights","video_to_image","video_uncrop","video_uncrop_9x16_to_9x18","wa_mm_image_filtering","wa_mm_text_truncation_length"];
// Todas OPT_OUT: mantém o PNG original EXATO (sem touch-up/overlay/crop/filtro automático da Meta).
export const DOF_SPEC = { creative_features_spec: Object.fromEntries(DOF_FEATURES.map((f) => [f, { enroll_status: 'OPT_OUT' }])) };

export const soDigitos = (numero) => String(numero).replace(/\D/g, '');

// Nome determinístico do ad — a idempotência do subirCriativos depende de bater exatamente com o
// nome de ads já criados numa rodada anterior (mesmo prefixo/chave/adsetName => mesmo nome).
export const nomeAd = (prefixo, chave, adsetName) => `${prefixo} · ${String(chave).replace(/\.png$/i, '')} · ${adsetName}`.slice(0, 200);

// Monta o object_story_spec (+asset_feed_spec se multi-destino) + degrees_of_freedom_spec pra um
// adcreative. `adsetDestinationType` = destination_type do conjunto (promoted_object ou similar):
// multi-destino quando contém WHATSAPP E (MESSENGER ou INSTAGRAM); senão WhatsApp-puro (wa.me).
export function payloadCriativa({ hash, adsetDestinationType, waNumero, page, ig, mensagem }) {
  const dt = String(adsetDestinationType || '').toUpperCase();
  const multi = dt.includes('WHATSAPP') && (dt.includes('MESSENGER') || dt.includes('INSTAGRAM'));
  if (!multi) {
    return {
      object_story_spec: {
        page_id: page,
        instagram_user_id: ig,
        link_data: {
          image_hash: hash,
          link: 'https://wa.me/' + soDigitos(waNumero),
          message: mensagem,
          call_to_action: { type: 'WHATSAPP_MESSAGE' },
        },
      },
      degrees_of_freedom_spec: DOF_SPEC,
    };
  }
  const mLink = `https://m.me/${page}`;
  const waUrl = `https://api.whatsapp.com/send?phone=${soDigitos(waNumero)}`;
  return {
    object_story_spec: {
      page_id: page,
      instagram_user_id: ig,
      link_data: {
        image_hash: hash,
        link: mLink,
        message: mensagem,
        call_to_action: { type: 'MESSAGE_PAGE', value: { app_destination: 'MESSENGER' } },
      },
    },
    // um CTA por destino do conjunto — a Meta escolhe o app onde o usuário responde melhor
    asset_feed_spec: {
      optimization_type: 'DOF_MESSAGING_DESTINATION',
      call_to_actions: [
        { type: 'MESSAGE_PAGE', value: { app_destination: 'MESSENGER', link: mLink } },
        { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP', link: waUrl } },
        { type: 'INSTAGRAM_MESSAGE', value: { app_destination: 'INSTAGRAM_DIRECT', link: 'https://www.instagram.com' } },
      ],
    },
    degrees_of_freedom_spec: DOF_SPEC,
  };
}

// Cria adcreative+ad PAUSED por (item × adset), pulando o que já existe em `jaTem`
// (Set de `${adsetId}::${nome}`). `item.getHash()` sobe a imagem 1x por item (hash é da conta,
// reusado em todos os adsets). Em rate limit (Meta code 17 / "request limit") para e devolve
// pendentes>0 + rateLimited:true — o chamador pode re-disparar pra retomar de onde parou.
export async function subirCriativos({ meta, act, page, ig, itens, adsets, prefixo, mensagem, jaTem, onAd }) {
  let criados = 0, pendentes = 0;
  for (const item of itens) {
    const hash = await item.getHash();
    for (const a of adsets) {
      const nome = nomeAd(prefixo, item.chave, a.name);
      if (jaTem.has(`${a.id}::${nome}`)) continue;
      try {
        const params = payloadCriativa({ hash, adsetDestinationType: a.destinationType, waNumero: a.whatsapp, page, ig, mensagem });
        const cr = await meta(`/${act}/adcreatives`, params, 'POST');
        if (cr.status !== 200 || !cr.d?.id) throw new Error('adcreative ' + JSON.stringify(cr.d).slice(0, 200));
        const ad = await meta(`/${act}/ads`, { name: nome, adset_id: a.id, creative: { creative_id: cr.d.id }, status: 'PAUSED' }, 'POST');
        if (ad.status !== 200 || !ad.d?.id) throw new Error('ad ' + JSON.stringify(ad.d).slice(0, 200));
        criados++;
        if (onAd) onAd({ adId: ad.d.id, item, adset: a });
      } catch (e) {
        if (/code\D*17|request limit/i.test(e.message)) { pendentes++; return { criados, pendentes, rateLimited: true }; }
        throw e;
      }
    }
  }
  return { criados, pendentes };
}
