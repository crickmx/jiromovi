/*
  # TEST MANUAL: Verificar Fórmulas de ASIMILADOS

  Vamos a calcular paso a paso con el caso de referencia para ver
  cuál es la fórmula correcta.
*/

DO $$
DECLARE
  v_vida NUMERIC := 544.20;
  v_sin_vida NUMERIC := 14263.87;
  v_ret_contable NUMERIC;
  v_dispersion NUMERIC;
  v_base_isr_vida NUMERIC;
  v_isr_vida NUMERIC;
  v_base_isr_danios NUMERIC;
  v_isr_danios NUMERIC;
  v_isr_total NUMERIC;
  v_total_pagar NUMERIC;
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'TEST MANUAL: Caso de Referencia';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'ENTRADA:';
  RAISE NOTICE '  Vida: %', v_vida;
  RAISE NOTICE '  Sin Vida: %', v_sin_vida;
  RAISE NOTICE '  Total: %', v_vida + v_sin_vida;
  
  RAISE NOTICE '';
  RAISE NOTICE '-------------------------------------------';
  RAISE NOTICE 'OPCIÓN 1: CON división /1.09';
  RAISE NOTICE '-------------------------------------------';
  
  v_ret_contable := ROUND((v_vida * 0.16)::numeric, 2);
  v_dispersion := ROUND((v_sin_vida * 0.09)::numeric, 2);
  
  RAISE NOTICE 'Ret. Contable = % * 0.16 = %', v_vida, v_ret_contable;
  RAISE NOTICE 'Dispersión = % * 0.09 = %', v_sin_vida, v_dispersion;
  
  v_base_isr_vida := ROUND(((v_vida - v_ret_contable) / 1.09)::numeric, 2);
  v_isr_vida := ROUND((v_base_isr_vida * 0.10)::numeric, 2);
  
  RAISE NOTICE 'Base ISR Vida = (% - %) / 1.09 = %', v_vida, v_ret_contable, v_base_isr_vida;
  RAISE NOTICE 'ISR Vida = % * 0.10 = %', v_base_isr_vida, v_isr_vida;
  
  v_base_isr_danios := ROUND(((v_sin_vida - v_dispersion) / 1.09)::numeric, 2);
  v_isr_danios := ROUND((v_base_isr_danios * 0.10)::numeric, 2);
  
  RAISE NOTICE 'Base ISR Daños = (% - %) / 1.09 = %', v_sin_vida, v_dispersion, v_base_isr_danios;
  RAISE NOTICE 'ISR Daños = % * 0.10 = %', v_base_isr_danios, v_isr_danios;
  
  v_isr_total := ROUND((v_isr_vida + v_isr_danios)::numeric, 2);
  v_total_pagar := ROUND(((v_vida + v_sin_vida) - v_ret_contable - v_dispersion - v_isr_total)::numeric, 2);
  
  RAISE NOTICE '';
  RAISE NOTICE 'RESULTADO OPCIÓN 1:';
  RAISE NOTICE '  ISR Total = % + % = %', v_isr_vida, v_isr_danios, v_isr_total;
  RAISE NOTICE '  Total a Pagar = % - % - % - % = %', 
    (v_vida + v_sin_vida), v_ret_contable, v_dispersion, v_isr_total, v_total_pagar;
  
  RAISE NOTICE '';
  RAISE NOTICE '-------------------------------------------';
  RAISE NOTICE 'OPCIÓN 2: SIN división /1.09';
  RAISE NOTICE '-------------------------------------------';
  
  v_isr_vida := ROUND(((v_vida - v_ret_contable) * 0.10)::numeric, 2);
  v_isr_danios := ROUND(((v_sin_vida - v_dispersion) * 0.10)::numeric, 2);
  
  RAISE NOTICE 'ISR Vida = (% - %) * 0.10 = %', v_vida, v_ret_contable, v_isr_vida;
  RAISE NOTICE 'ISR Daños = (% - %) * 0.10 = %', v_sin_vida, v_dispersion, v_isr_danios;
  
  v_isr_total := ROUND((v_isr_vida + v_isr_danios)::numeric, 2);
  v_total_pagar := ROUND(((v_vida + v_sin_vida) - v_ret_contable - v_dispersion - v_isr_total)::numeric, 2);
  
  RAISE NOTICE '';
  RAISE NOTICE 'RESULTADO OPCIÓN 2:';
  RAISE NOTICE '  ISR Total = % + % = %', v_isr_vida, v_isr_danios, v_isr_total;
  RAISE NOTICE '  Total a Pagar = % - % - % - % = %', 
    (v_vida + v_sin_vida), v_ret_contable, v_dispersion, v_isr_total, v_total_pagar;
  
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'VALORES ESPERADOS (según usuario):';
  RAISE NOTICE '  Ret. Contable: 87.07';
  RAISE NOTICE '  Dispersión: 1,283.75';
  RAISE NOTICE '  ISR Total: 1,355.53';
  RAISE NOTICE '  Total: 12,081.72';
  RAISE NOTICE '===========================================';
END $$;