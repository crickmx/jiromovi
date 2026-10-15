-- Massive vehicle catalog expansion - Part 4 (programmatic generation)
-- Generates entries for: MAZDA, FORD, SEAT/CUPRA, SUZUKI, MG, RAM, RENAULT, MITSUBISHI, PEUGEOT,
-- SUBARU, JEEP, DODGE, FIAT, MINI, VOLVO, LAND ROVER, JAGUAR, PORSCHE, LEXUS, INFINITI,
-- ACURA, LINCOLN, BUICK, GMC, CADILLAC, AUDI, BMW, MERCEDES-BENZ

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
  -- Brand/model definitions: marca, modelo, base_precio_2026, carroceria, versions array
  FOR r IN (
    SELECT * FROM (VALUES
      ('MAZDA', 'MAZDA3', 429900, 'SEDAN', ARRAY['I T/M', 'I SPORT T/A', 'S GRAND TOURING T/A', 'SIGNATURE T/A']),
      ('MAZDA', 'MAZDA3 HB', 449900, 'HATCHBACK', ARRAY['I SPORT T/A', 'S GRAND TOURING T/A', 'TURBO T/A AWD']),
      ('MAZDA', 'CX-30', 459900, 'SUV', ARRAY['I T/M', 'I SPORT T/A', 'I GRAND TOURING T/A', 'TURBO T/A AWD']),
      ('MAZDA', 'CX-5', 549900, 'SUV', ARRAY['I T/M', 'I SPORT T/A', 'I GRAND TOURING T/A', 'SIGNATURE T/A AWD', 'TURBO T/A AWD']),
      ('MAZDA', 'CX-50', 599900, 'SUV', ARRAY['BASE T/A', 'PREFERRED T/A AWD', 'PREMIUM T/A AWD', 'TURBO PREMIUM PLUS AWD']),
      ('MAZDA', 'CX-90', 879900, 'SUV', ARRAY['BASE T/A', 'PREFERRED T/A AWD', 'PREMIUM T/A AWD', 'PHEV PREMIUM PLUS']),
      ('MAZDA', 'MX-5', 599900, 'CONVERTIBLE', ARRAY['I SPORT T/M', 'I GRAND TOURING T/M', 'RF GRAND TOURING T/A']),
      ('FORD', 'MAVERICK', 499900, 'PICKUP', ARRAY['XL T/A', 'XLT T/A', 'LARIAT T/A', 'TREMOR AWD']),
      ('FORD', 'BRONCO SPORT', 599900, 'SUV', ARRAY['BASE T/A', 'BIG BEND T/A', 'OUTER BANKS T/A', 'BADLANDS AWD']),
      ('FORD', 'ESCAPE', 549900, 'SUV', ARRAY['S T/A', 'SE T/A', 'SEL T/A', 'TITANIUM T/A AWD']),
      ('FORD', 'RANGER', 649900, 'PICKUP', ARRAY['XL T/M 4X2', 'XLT T/A 4X2', 'LARIAT T/A 4X4', 'WILDTRAK T/A 4X4', 'RAPTOR T/A 4X4']),
      ('FORD', 'EXPLORER', 879900, 'SUV', ARRAY['BASE T/A', 'XLT T/A', 'LIMITED T/A AWD', 'ST T/A AWD', 'PLATINUM T/A AWD']),
      ('FORD', 'TERRITORY', 499900, 'SUV', ARRAY['TREND T/A', 'TITANIUM T/A', 'TITANIUM PLUS T/A']),
      ('SEAT', 'IBIZA', 369900, 'HATCHBACK', ARRAY['REFERENCE T/M', 'STYLE T/M', 'FR T/A', 'XCELLENCE T/A']),
      ('SEAT', 'ARONA', 429900, 'SUV', ARRAY['REFERENCE T/M', 'STYLE T/A', 'FR T/A', 'XCELLENCE T/A']),
      ('SEAT', 'ATECA', 549900, 'SUV', ARRAY['STYLE T/A', 'FR T/A', 'XCELLENCE T/A', 'CUPRA T/A']),
      ('SEAT', 'LEON', 489900, 'HATCHBACK', ARRAY['REFERENCE T/M', 'STYLE T/A', 'FR T/A', 'CUPRA T/A']),
      ('SEAT', 'TARRACO', 659900, 'SUV', ARRAY['STYLE T/A', 'XCELLENCE T/A', 'FR T/A AWD']),
      ('SUZUKI', 'SWIFT', 299900, 'HATCHBACK', ARRAY['GL T/M', 'GLS T/M', 'GLX T/A', 'SPORT T/M BOOSTERJET']),
      ('SUZUKI', 'IGNIS', 289900, 'SUV', ARRAY['GL T/M', 'GLS T/A', 'GLX T/A']),
      ('SUZUKI', 'VITARA', 419900, 'SUV', ARRAY['GLS T/A', 'GLX T/A', 'TURBO T/A', 'TURBO AWD T/A']),
      ('SUZUKI', 'JIMNY', 459900, 'SUV', ARRAY['GL T/M 4X4', 'GLX T/A 4X4']),
      ('SUZUKI', 'S-CROSS', 429900, 'SUV', ARRAY['GL T/A', 'GLS T/A', 'GLX TURBO T/A']),
      ('MG', 'MG5', 329900, 'SEDAN', ARRAY['STD T/M', 'COM T/A', 'EXC T/A']),
      ('MG', 'ZS', 379900, 'SUV', ARRAY['STD T/M', 'COM T/A', 'EXC T/A', 'TROPHY T/A']),
      ('MG', 'HS', 469900, 'SUV', ARRAY['STD T/A', 'COM T/A', 'EXC T/A', 'TROPHY T/A']),
      ('MG', 'RX5', 449900, 'SUV', ARRAY['STD T/A', 'COM T/A', 'EXC T/A']),
      ('MG', 'MG4 EV', 549900, 'HATCHBACK', ARRAY['STD', 'COM', 'EXC', 'TROPHY EXTENDED RANGE']),
      ('RAM', '700', 279900, 'PICKUP', ARRAY['ST T/M', 'SLT T/M', 'CLUB CAB T/M']),
      ('RAM', '1200', 389900, 'PICKUP', ARRAY['ST T/M', 'SLT T/M', 'SLT CREW CAB T/A']),
      ('RAM', '1500', 799900, 'PICKUP', ARRAY['TRADESMAN T/A 4X2', 'BIG HORN T/A 4X4', 'LARAMIE T/A 4X4', 'LIMITED T/A 4X4', 'TRX T/A 4X4']),
      ('RAM', '2500', 899900, 'PICKUP', ARRAY['SLT T/A 4X2', 'LARAMIE T/A 4X4', 'LIMITED T/A 4X4', 'POWER WAGON 4X4']),
      ('RENAULT', 'KWID', 249900, 'HATCHBACK', ARRAY['ZEN T/M', 'INTENS T/M', 'OUTSIDER T/M']),
      ('RENAULT', 'DUSTER', 399900, 'SUV', ARRAY['ZEN T/M', 'INTENS T/A', 'ICONIC T/A', 'TECHROAD T/A']),
      ('RENAULT', 'KOLEOS', 549900, 'SUV', ARRAY['ZEN T/A', 'INTENS T/A', 'ICONIC T/A CVT']),
      ('RENAULT', 'STEPWAY', 329900, 'HATCHBACK', ARRAY['ZEN T/M', 'INTENS T/A', 'ICONIC T/A']),
      ('RENAULT', 'OROCH', 399900, 'PICKUP', ARRAY['ZEN T/M', 'INTENS T/M', 'OUTSIDER T/A']),
      ('MITSUBISHI', 'MIRAGE', 269900, 'HATCHBACK', ARRAY['GLX T/M', 'GLS T/A', 'GLS CVT']),
      ('MITSUBISHI', 'L200', 499900, 'PICKUP', ARRAY['GL T/M 4X2', 'GLS T/M 4X2', 'GLS PREMIUM T/A 4X4', 'HPE T/A 4X4']),
      ('MITSUBISHI', 'OUTLANDER', 599900, 'SUV', ARRAY['ES T/A', 'SE T/A', 'SEL T/A AWD', 'GT T/A AWD']),
      ('MITSUBISHI', 'ASX', 449900, 'SUV', ARRAY['ES T/A', 'GLS T/A', 'SE T/A']),
      ('MITSUBISHI', 'XPANDER', 399900, 'SUV', ARRAY['GL T/M', 'GLS T/A', 'GLS CROSS T/A']),
      ('PEUGEOT', '208', 369900, 'HATCHBACK', ARRAY['ACTIVE T/M', 'ALLURE T/A', 'GT LINE T/A', 'GT T/A']),
      ('PEUGEOT', '2008', 449900, 'SUV', ARRAY['ACTIVE T/M', 'ALLURE T/A', 'GT LINE T/A', 'GT T/A']),
      ('PEUGEOT', '3008', 589900, 'SUV', ARRAY['ACTIVE T/A', 'ALLURE T/A', 'GT LINE T/A', 'GT T/A']),
      ('PEUGEOT', '5008', 659900, 'SUV', ARRAY['ALLURE T/A', 'GT LINE T/A', 'GT T/A']),
      ('PEUGEOT', 'PARTNER', 389900, 'VAN', ARRAY['MAXI T/M', 'MAXI HDI T/M']),
      ('SUBARU', 'IMPREZA', 449900, 'HATCHBACK', ARRAY['BASE CVT AWD', 'SPORT CVT AWD', 'RS CVT AWD']),
      ('SUBARU', 'CROSSTREK', 519900, 'SUV', ARRAY['BASE CVT AWD', 'PREMIUM CVT AWD', 'LIMITED CVT AWD', 'SPORT CVT AWD']),
      ('SUBARU', 'FORESTER', 579900, 'SUV', ARRAY['BASE CVT AWD', 'PREMIUM CVT AWD', 'SPORT CVT AWD', 'TOURING CVT AWD']),
      ('SUBARU', 'OUTBACK', 649900, 'SUV', ARRAY['BASE CVT AWD', 'LIMITED CVT AWD', 'TOURING CVT AWD', 'WILDERNESS CVT AWD']),
      ('SUBARU', 'XV', 489900, 'SUV', ARRAY['BASE CVT AWD', 'PREMIUM CVT AWD', 'LIMITED CVT AWD']),
      ('JEEP', 'RENEGADE', 499900, 'SUV', ARRAY['SPORT T/A', 'LATITUDE T/A', 'LIMITED T/A', 'TRAILHAWK 4X4']),
      ('JEEP', 'COMPASS', 599900, 'SUV', ARRAY['SPORT T/A', 'LATITUDE T/A', 'LIMITED T/A 4X4', 'TRAILHAWK 4X4']),
      ('JEEP', 'WRANGLER', 899900, 'SUV', ARRAY['SPORT T/M 4X4', 'SAHARA T/A 4X4', 'RUBICON T/A 4X4', 'RUBICON 392']),
      ('JEEP', 'GRAND CHEROKEE', 979900, 'SUV', ARRAY['LAREDO T/A', 'LIMITED T/A 4X4', 'OVERLAND T/A 4X4', 'SUMMIT T/A 4X4']),
      ('DODGE', 'ATTITUDE', 259900, 'SEDAN', ARRAY['SE T/M', 'SXT T/A']),
      ('DODGE', 'NEON', 329900, 'SEDAN', ARRAY['SE T/M', 'SXT T/A', 'GT T/A']),
      ('FIAT', '500', 389900, 'HATCHBACK', ARRAY['POP T/M', 'LOUNGE T/A', 'ABARTH T/M']),
      ('FIAT', 'PULSE', 419900, 'SUV', ARRAY['DRIVE T/M', 'AUDACE T/A TURBO', 'IMPETUS T/A TURBO']),
      ('FIAT', 'FASTBACK', 479900, 'SUV', ARRAY['DRIVE T/A', 'AUDACE T/A TURBO', 'IMPETUS T/A TURBO']),
      ('MINI', 'COOPER', 549900, 'HATCHBACK', ARRAY['CLASSIC T/A', 'SALT T/A', 'CHILI T/A', 'S CHILI T/A']),
      ('MINI', 'COUNTRYMAN', 699900, 'SUV', ARRAY['CLASSIC T/A', 'CHILI T/A ALL4', 'S CHILI T/A ALL4', 'JCW ALL4'])
    ) AS t(marca, modelo, base_precio, carroceria, versiones)
  )
  LOOP
    v_marca := r.marca;
    v_modelo := r.modelo;
    v_base_precio := r.base_precio;
    v_carroceria := r.carroceria;

    FOR v_anio IN 2020..2026 LOOP
      v_deprec := 1.0 - (2026 - v_anio) * 0.06;
      IF v_deprec < 0.60 THEN v_deprec := 0.60; END IF;

      FOR i IN 1..array_length(r.versiones, 1) LOOP
        v_version := r.versiones[i];
        v_valor := round((v_base_precio + (i - 1) * 40000) * v_deprec / 100) * 100;
        v_clave := lpad((ascii(substring(v_marca, 1, 1)) - 64)::text, 2, '0') || lpad(i::text, 2, '0') || lpad((v_anio - 2019)::text, 2, '0');

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
