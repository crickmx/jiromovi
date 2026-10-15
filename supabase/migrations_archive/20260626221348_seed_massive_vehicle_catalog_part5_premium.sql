-- Massive vehicle catalog expansion - Part 5 (Premium brands programmatic)
-- BMW, MERCEDES-BENZ, AUDI, VOLVO, LEXUS, INFINITI, ACURA, LINCOLN, PORSCHE, CADILLAC, BUICK, GMC

DO $$
DECLARE
  v_marca text;
  v_modelo text;
  v_anio int;
  v_version text;
  v_clave text;
  v_valor int;
  v_carroceria text;
  v_base_precio int;
  v_deprec numeric;
  r record;
BEGIN
  FOR r IN (
    SELECT * FROM (VALUES
      ('BMW', 'SERIE 1', 649900, 'HATCHBACK', ARRAY['118i T/A', '120i M SPORT T/A', 'M135i xDRIVE T/A']),
      ('BMW', 'SERIE 2 COUPE', 749900, 'SEDAN', ARRAY['220i T/A', '230i M SPORT T/A', 'M240i xDRIVE T/A']),
      ('BMW', 'SERIE 3', 799900, 'SEDAN', ARRAY['318i T/A', '320i T/A', '330i M SPORT T/A', '330e HYBRID', 'M340i xDRIVE T/A']),
      ('BMW', 'SERIE 4 GRAN COUPE', 899900, 'SEDAN', ARRAY['420i T/A', '430i M SPORT T/A', 'M440i xDRIVE T/A']),
      ('BMW', 'SERIE 5', 999900, 'SEDAN', ARRAY['520i T/A', '530i T/A', '540i M SPORT T/A', 'M550i xDRIVE T/A']),
      ('BMW', 'X1', 749900, 'SUV', ARRAY['sDRIVE 18i T/A', 'sDRIVE 20i T/A', 'xDRIVE 25i M SPORT', 'M35i xDRIVE']),
      ('BMW', 'X2', 799900, 'SUV', ARRAY['sDRIVE 20i T/A', 'xDRIVE 25i M SPORT', 'M35i xDRIVE']),
      ('BMW', 'X3', 899900, 'SUV', ARRAY['sDRIVE 20i T/A', 'xDRIVE 30i T/A', 'M40i xDRIVE T/A', 'M COMPETITION xDRIVE']),
      ('BMW', 'X5', 1299900, 'SUV', ARRAY['xDRIVE 40i T/A', 'xDRIVE 45e HYBRID', 'M50i xDRIVE T/A', 'M COMPETITION xDRIVE']),
      ('BMW', 'X6', 1499900, 'SUV', ARRAY['xDRIVE 40i T/A', 'M50i xDRIVE T/A', 'M COMPETITION xDRIVE']),
      ('MERCEDES-BENZ', 'CLASE A', 699900, 'HATCHBACK', ARRAY['A 200 T/A', 'A 200 PROGRESSIVE', 'A 250 AMG LINE', 'AMG A 35 4MATIC']),
      ('MERCEDES-BENZ', 'CLASE C', 899900, 'SEDAN', ARRAY['C 200 T/A', 'C 200 AVANTGARDE', 'C 300 AMG LINE', 'AMG C 43 4MATIC']),
      ('MERCEDES-BENZ', 'CLASE E', 1199900, 'SEDAN', ARRAY['E 200 AVANTGARDE', 'E 300 AMG LINE', 'E 450 4MATIC AMG', 'AMG E 53 4MATIC']),
      ('MERCEDES-BENZ', 'GLA', 749900, 'SUV', ARRAY['GLA 200 T/A', 'GLA 200 PROGRESSIVE', 'GLA 250 AMG LINE', 'AMG GLA 35 4MATIC']),
      ('MERCEDES-BENZ', 'GLB', 799900, 'SUV', ARRAY['GLB 200 T/A', 'GLB 200 PROGRESSIVE', 'GLB 250 AMG LINE 4MATIC', 'AMG GLB 35 4MATIC']),
      ('MERCEDES-BENZ', 'GLC', 999900, 'SUV', ARRAY['GLC 300 T/A', 'GLC 300 4MATIC', 'GLC 300 AMG LINE', 'AMG GLC 43 4MATIC']),
      ('MERCEDES-BENZ', 'GLE', 1399900, 'SUV', ARRAY['GLE 450 4MATIC', 'GLE 450 AMG LINE', 'AMG GLE 53 4MATIC', 'AMG GLE 63 S']),
      ('AUDI', 'A1', 549900, 'HATCHBACK', ARRAY['COOL T/A', 'EGO T/A', 'S LINE T/A']),
      ('AUDI', 'A3', 649900, 'SEDAN', ARRAY['DYNAMIC T/A', 'SELECT T/A', 'S LINE T/A', 'S3 T/A QUATTRO']),
      ('AUDI', 'A4', 799900, 'SEDAN', ARRAY['DYNAMIC T/A', 'SELECT T/A', 'S LINE T/A', 'S4 T/A QUATTRO']),
      ('AUDI', 'A5 SPORTBACK', 899900, 'SEDAN', ARRAY['DYNAMIC T/A', 'SELECT T/A', 'S LINE T/A QUATTRO', 'S5 SPORTBACK QUATTRO']),
      ('AUDI', 'Q2', 599900, 'SUV', ARRAY['DYNAMIC T/A', 'SELECT T/A', 'S LINE T/A', 'SQ2 QUATTRO']),
      ('AUDI', 'Q3', 699900, 'SUV', ARRAY['DYNAMIC T/A', 'SELECT T/A', 'S LINE T/A', 'RS Q3 SPORTBACK']),
      ('AUDI', 'Q5', 899900, 'SUV', ARRAY['DYNAMIC T/A QUATTRO', 'SELECT T/A QUATTRO', 'S LINE T/A QUATTRO', 'SQ5 T/A QUATTRO']),
      ('AUDI', 'Q7', 1199900, 'SUV', ARRAY['SELECT T/A QUATTRO', 'S LINE T/A QUATTRO', 'SQ7 T/A QUATTRO']),
      ('AUDI', 'Q8', 1499900, 'SUV', ARRAY['SELECT T/A QUATTRO', 'S LINE T/A QUATTRO', 'SQ8 T/A QUATTRO', 'RS Q8 T/A QUATTRO']),
      ('VOLVO', 'XC40', 699900, 'SUV', ARRAY['T4 MOMENTUM', 'T4 R-DESIGN', 'T5 INSCRIPTION AWD', 'RECHARGE PURE ELECTRIC']),
      ('VOLVO', 'XC60', 899900, 'SUV', ARRAY['T5 MOMENTUM', 'T5 R-DESIGN', 'T6 INSCRIPTION AWD', 'T8 RECHARGE AWD']),
      ('VOLVO', 'XC90', 1199900, 'SUV', ARRAY['T5 MOMENTUM', 'T6 R-DESIGN AWD', 'T6 INSCRIPTION AWD', 'T8 RECHARGE AWD']),
      ('VOLVO', 'S60', 749900, 'SEDAN', ARRAY['T4 MOMENTUM', 'T4 R-DESIGN', 'T5 INSCRIPTION', 'T8 RECHARGE']),
      ('LEXUS', 'NX', 799900, 'SUV', ARRAY['NX 250 T/A', 'NX 350 F SPORT AWD', 'NX 350h LUXURY', 'NX 450h+ F SPORT AWD']),
      ('LEXUS', 'RX', 999900, 'SUV', ARRAY['RX 350 T/A', 'RX 350 F SPORT AWD', 'RX 350h LUXURY', 'RX 500h F SPORT AWD']),
      ('LEXUS', 'ES', 849900, 'SEDAN', ARRAY['ES 250 T/A', 'ES 300h LUXURY', 'ES 350 F SPORT']),
      ('LEXUS', 'UX', 699900, 'SUV', ARRAY['UX 200 T/A', 'UX 250h LUXURY', 'UX 250h F SPORT']),
      ('INFINITI', 'Q50', 749900, 'SEDAN', ARRAY['PURE T/A', 'LUXE T/A', 'SENSORY T/A', 'RED SPORT 400']),
      ('INFINITI', 'QX50', 799900, 'SUV', ARRAY['PURE T/A', 'LUXE T/A', 'ESSENTIAL T/A AWD', 'SENSORY T/A AWD']),
      ('INFINITI', 'QX60', 999900, 'SUV', ARRAY['PURE T/A', 'LUXE T/A', 'SENSORY T/A AWD', 'AUTOGRAPH T/A AWD']),
      ('ACURA', 'INTEGRA', 649900, 'SEDAN', ARRAY['BASE CVT', 'A-SPEC CVT', 'A-SPEC TECH CVT', 'TYPE S T/M']),
      ('ACURA', 'TLX', 799900, 'SEDAN', ARRAY['BASE T/A', 'TECHNOLOGY T/A', 'A-SPEC T/A AWD', 'TYPE S T/A AWD']),
      ('ACURA', 'RDX', 849900, 'SUV', ARRAY['BASE T/A', 'TECHNOLOGY T/A', 'A-SPEC T/A AWD', 'ADVANCE T/A AWD']),
      ('ACURA', 'MDX', 999900, 'SUV', ARRAY['BASE T/A', 'TECHNOLOGY T/A AWD', 'A-SPEC T/A AWD', 'TYPE S T/A AWD']),
      ('LINCOLN', 'CORSAIR', 799900, 'SUV', ARRAY['BASE T/A', 'RESERVE T/A', 'RESERVE T/A AWD', 'GRAND TOURING PHEV']),
      ('LINCOLN', 'NAUTILUS', 899900, 'SUV', ARRAY['BASE T/A', 'RESERVE T/A', 'RESERVE T/A AWD', 'BLACK LABEL AWD']),
      ('LINCOLN', 'AVIATOR', 1199900, 'SUV', ARRAY['BASE T/A', 'RESERVE T/A AWD', 'BLACK LABEL AWD', 'GRAND TOURING PHEV']),
      ('GMC', 'TERRAIN', 599900, 'SUV', ARRAY['SLE T/A', 'SLT T/A', 'DENALI T/A', 'AT4 T/A AWD']),
      ('GMC', 'ACADIA', 799900, 'SUV', ARRAY['SLE T/A', 'SLT T/A AWD', 'AT4 T/A AWD', 'DENALI T/A AWD']),
      ('GMC', 'SIERRA 1500', 849900, 'PICKUP', ARRAY['BASE T/A 4X2', 'SLE T/A 4X4', 'SLT T/A 4X4', 'DENALI T/A 4X4', 'AT4 T/A 4X4']),
      ('BUICK', 'ENCORE', 499900, 'SUV', ARRAY['BASE T/A', 'PREFERRED T/A', 'SPORT TOURING T/A', 'ESSENCE T/A']),
      ('BUICK', 'ENCORE GX', 549900, 'SUV', ARRAY['PREFERRED T/A', 'SELECT T/A', 'ESSENCE T/A AWD', 'SPORT TOURING T/A']),
      ('BUICK', 'ENVISION', 699900, 'SUV', ARRAY['PREFERRED T/A', 'ESSENCE T/A', 'AVENIR T/A AWD']),
      ('BUICK', 'ENCLAVE', 899900, 'SUV', ARRAY['PREFERRED T/A', 'ESSENCE T/A', 'AVENIR T/A AWD']),
      ('CADILLAC', 'CT4', 749900, 'SEDAN', ARRAY['LUXURY T/A', 'SPORT T/A', 'PREMIUM LUXURY T/A', 'V-SERIES BLACKWING T/M']),
      ('CADILLAC', 'CT5', 899900, 'SEDAN', ARRAY['LUXURY T/A', 'SPORT T/A', 'PREMIUM LUXURY T/A', 'V-SERIES BLACKWING T/M']),
      ('CADILLAC', 'XT4', 699900, 'SUV', ARRAY['LUXURY T/A', 'PREMIUM LUXURY T/A', 'SPORT T/A AWD']),
      ('CADILLAC', 'XT5', 849900, 'SUV', ARRAY['LUXURY T/A', 'PREMIUM LUXURY T/A AWD', 'SPORT T/A AWD']),
      ('CADILLAC', 'ESCALADE', 1899900, 'SUV', ARRAY['LUXURY T/A', 'PREMIUM LUXURY T/A', 'SPORT T/A', 'V-SERIES T/A']),
      ('PORSCHE', 'MACAN', 1199900, 'SUV', ARRAY['BASE T/A', 'S T/A', 'GTS T/A', 'TURBO T/A']),
      ('PORSCHE', 'CAYENNE', 1599900, 'SUV', ARRAY['BASE T/A', 'S T/A', 'GTS T/A', 'TURBO GT']),
      ('PORSCHE', '911', 2199900, 'COUPE', ARRAY['CARRERA T/A', 'CARRERA S T/A', 'CARRERA 4S T/A AWD', 'TURBO S T/A AWD'])
    ) AS t(marca, modelo, base_precio, carroceria, versiones)
  )
  LOOP
    v_marca := r.marca;
    v_modelo := r.modelo;
    v_base_precio := r.base_precio;
    v_carroceria := r.carroceria;

    FOR v_anio IN 2020..2026 LOOP
      v_deprec := 1.0 - (2026 - v_anio) * 0.05;
      IF v_deprec < 0.65 THEN v_deprec := 0.65; END IF;

      FOR i IN 1..array_length(r.versiones, 1) LOOP
        v_version := r.versiones[i];
        v_valor := round((v_base_precio + (i - 1) * 80000) * v_deprec / 100) * 100;
        v_clave := 'P' || lpad((ascii(substring(v_marca, 1, 1)) - 64)::text, 2, '0') || lpad(i::text, 2, '0') || (v_anio - 2019)::text;

        INSERT INTO multi_autos_catalogo_vehiculos (marca, modelo, anio, version, descripcion_completa, clave_amis, valor_referencia, carroceria, metadata_aseguradoras)
        VALUES (
          v_marca,
          v_modelo,
          v_anio,
          v_version,
          v_marca || ' ' || v_modelo || ' ' || v_anio || ' ' || v_version,
          v_clave,
          v_valor,
          v_carroceria,
          json_build_object('armadora_gnp', v_marca, 'carroceria_gnp', v_carroceria)::jsonb
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
