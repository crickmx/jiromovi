import type { Vehiculo, ModelMetadata } from './multiAutosTypes';

export const STATIC_VEHICLES: Vehiculo[] = [
  { id: 'v1', marca: 'Nissan', modelo: 'Versa', anio: 2024, version: 'Sense TM', descripcionCompleta: 'Nissan Versa 2024 Sense TM', claveAmis: '0401', armadoraGnp: 'NISSAN', carroceriaGnp: 'SEDAN', versionGnp: 'SENSE TM', valorReferencia: 329900 },
  { id: 'v2', marca: 'Nissan', modelo: 'Versa', anio: 2024, version: 'Advance CVT', descripcionCompleta: 'Nissan Versa 2024 Advance CVT', claveAmis: '0402', armadoraGnp: 'NISSAN', carroceriaGnp: 'SEDAN', versionGnp: 'ADVANCE CVT', valorReferencia: 369900 },
  { id: 'v3', marca: 'Nissan', modelo: 'Sentra', anio: 2024, version: 'Sense CVT', descripcionCompleta: 'Nissan Sentra 2024 Sense CVT', claveAmis: '0403', armadoraGnp: 'NISSAN', carroceriaGnp: 'SEDAN', versionGnp: 'SENSE CVT', valorReferencia: 419900 },
  { id: 'v4', marca: 'Nissan', modelo: 'Kicks', anio: 2024, version: 'Sense CVT', descripcionCompleta: 'Nissan Kicks 2024 Sense CVT', claveAmis: '0404', armadoraGnp: 'NISSAN', carroceriaGnp: 'SUV', versionGnp: 'SENSE CVT', valorReferencia: 399900 },
  { id: 'v5', marca: 'Nissan', modelo: 'X-Trail', anio: 2024, version: 'Sense CVT', descripcionCompleta: 'Nissan X-Trail 2024 Sense CVT', claveAmis: '0405', armadoraGnp: 'NISSAN', carroceriaGnp: 'SUV', versionGnp: 'SENSE CVT', valorReferencia: 499900 },
  { id: 'v6', marca: 'Toyota', modelo: 'Yaris', anio: 2024, version: 'Core Sedan TM', descripcionCompleta: 'Toyota Yaris 2024 Core Sedan TM', claveAmis: '0501', armadoraGnp: 'TOYOTA', carroceriaGnp: 'SEDAN', versionGnp: 'CORE TM', valorReferencia: 299900 },
  { id: 'v7', marca: 'Toyota', modelo: 'Corolla', anio: 2024, version: 'Base CVT', descripcionCompleta: 'Toyota Corolla 2024 Base CVT', claveAmis: '0502', armadoraGnp: 'TOYOTA', carroceriaGnp: 'SEDAN', versionGnp: 'BASE CVT', valorReferencia: 419900 },
  { id: 'v8', marca: 'Toyota', modelo: 'RAV4', anio: 2024, version: 'XLE AWD', descripcionCompleta: 'Toyota RAV4 2024 XLE AWD', claveAmis: '0503', armadoraGnp: 'TOYOTA', carroceriaGnp: 'SUV', versionGnp: 'XLE AWD', valorReferencia: 619900 },
  { id: 'v9', marca: 'Toyota', modelo: 'Hilux', anio: 2024, version: 'SR 4x2 TM', descripcionCompleta: 'Toyota Hilux 2024 SR 4x2 TM', claveAmis: '0504', armadoraGnp: 'TOYOTA', carroceriaGnp: 'PICKUP', versionGnp: 'SR 4X2', valorReferencia: 489900 },
  { id: 'v10', marca: 'Volkswagen', modelo: 'Jetta', anio: 2024, version: 'Trendline TM', descripcionCompleta: 'Volkswagen Jetta 2024 Trendline TM', claveAmis: '0601', armadoraGnp: 'VOLKSWAGEN', carroceriaGnp: 'SEDAN', versionGnp: 'TRENDLINE TM', valorReferencia: 429900 },
  { id: 'v11', marca: 'Volkswagen', modelo: 'Taos', anio: 2024, version: 'Trendline TM', descripcionCompleta: 'Volkswagen Taos 2024 Trendline TM', claveAmis: '0602', armadoraGnp: 'VOLKSWAGEN', carroceriaGnp: 'SUV', versionGnp: 'TRENDLINE TM', valorReferencia: 499900 },
  { id: 'v12', marca: 'Volkswagen', modelo: 'Tiguan', anio: 2024, version: 'Trendline', descripcionCompleta: 'Volkswagen Tiguan 2024 Trendline', claveAmis: '0603', armadoraGnp: 'VOLKSWAGEN', carroceriaGnp: 'SUV', versionGnp: 'TRENDLINE', valorReferencia: 589900 },
  { id: 'v13', marca: 'Chevrolet', modelo: 'Aveo', anio: 2024, version: 'LS TM', descripcionCompleta: 'Chevrolet Aveo 2024 LS TM', claveAmis: '0701', armadoraGnp: 'CHEVROLET', carroceriaGnp: 'SEDAN', versionGnp: 'LS TM', valorReferencia: 279900 },
  { id: 'v14', marca: 'Chevrolet', modelo: 'Onix', anio: 2024, version: 'LT TM', descripcionCompleta: 'Chevrolet Onix 2024 LT TM', claveAmis: '0702', armadoraGnp: 'CHEVROLET', carroceriaGnp: 'SEDAN', versionGnp: 'LT TM', valorReferencia: 339900 },
  { id: 'v15', marca: 'Chevrolet', modelo: 'Tracker', anio: 2024, version: 'LS TA', descripcionCompleta: 'Chevrolet Tracker 2024 LS TA', claveAmis: '0703', armadoraGnp: 'CHEVROLET', carroceriaGnp: 'SUV', versionGnp: 'LS TA', valorReferencia: 449900 },
  { id: 'v16', marca: 'Chevrolet', modelo: 'Equinox', anio: 2024, version: 'LT TA', descripcionCompleta: 'Chevrolet Equinox 2024 LT TA', claveAmis: '0704', armadoraGnp: 'CHEVROLET', carroceriaGnp: 'SUV', versionGnp: 'LT TA', valorReferencia: 589900 },
  { id: 'v17', marca: 'Honda', modelo: 'City', anio: 2024, version: 'LX CVT', descripcionCompleta: 'Honda City 2024 LX CVT', claveAmis: '0801', armadoraGnp: 'HONDA', carroceriaGnp: 'SEDAN', versionGnp: 'LX CVT', valorReferencia: 359900 },
  { id: 'v18', marca: 'Honda', modelo: 'Civic', anio: 2024, version: 'EX-L CVT', descripcionCompleta: 'Honda Civic 2024 EX-L CVT', claveAmis: '0802', armadoraGnp: 'HONDA', carroceriaGnp: 'SEDAN', versionGnp: 'EXL CVT', valorReferencia: 549900 },
  { id: 'v19', marca: 'Honda', modelo: 'CR-V', anio: 2024, version: 'EX CVT', descripcionCompleta: 'Honda CR-V 2024 EX CVT', claveAmis: '0803', armadoraGnp: 'HONDA', carroceriaGnp: 'SUV', versionGnp: 'EX CVT', valorReferencia: 619900 },
  { id: 'v20', marca: 'Honda', modelo: 'HR-V', anio: 2024, version: 'Uniq CVT', descripcionCompleta: 'Honda HR-V 2024 Uniq CVT', claveAmis: '0804', armadoraGnp: 'HONDA', carroceriaGnp: 'SUV', versionGnp: 'UNIQ CVT', valorReferencia: 449900 },
  { id: 'v21', marca: 'Hyundai', modelo: 'Grand i10', anio: 2024, version: 'GL TM', descripcionCompleta: 'Hyundai Grand i10 2024 GL TM', claveAmis: '0901', armadoraGnp: 'HYUNDAI', carroceriaGnp: 'SEDAN', versionGnp: 'GL TM', valorReferencia: 259900 },
  { id: 'v22', marca: 'Hyundai', modelo: 'Creta', anio: 2024, version: 'GLS TA', descripcionCompleta: 'Hyundai Creta 2024 GLS TA', claveAmis: '0902', armadoraGnp: 'HYUNDAI', carroceriaGnp: 'SUV', versionGnp: 'GLS TA', valorReferencia: 429900 },
  { id: 'v23', marca: 'Hyundai', modelo: 'Tucson', anio: 2024, version: 'GLS TA', descripcionCompleta: 'Hyundai Tucson 2024 GLS TA', claveAmis: '0903', armadoraGnp: 'HYUNDAI', carroceriaGnp: 'SUV', versionGnp: 'GLS TA', valorReferencia: 539900 },
  { id: 'v24', marca: 'Kia', modelo: 'Rio', anio: 2024, version: 'LX TM', descripcionCompleta: 'Kia Rio 2024 LX TM', claveAmis: '1001', armadoraGnp: 'KIA', carroceriaGnp: 'SEDAN', versionGnp: 'LX TM', valorReferencia: 309900 },
  { id: 'v25', marca: 'Kia', modelo: 'Forte', anio: 2024, version: 'LX TM', descripcionCompleta: 'Kia Forte 2024 LX TM', claveAmis: '1002', armadoraGnp: 'KIA', carroceriaGnp: 'SEDAN', versionGnp: 'LX TM', valorReferencia: 379900 },
  { id: 'v26', marca: 'Kia', modelo: 'Seltos', anio: 2024, version: 'LX TA', descripcionCompleta: 'Kia Seltos 2024 LX TA', claveAmis: '1003', armadoraGnp: 'KIA', carroceriaGnp: 'SUV', versionGnp: 'LX TA', valorReferencia: 429900 },
  { id: 'v27', marca: 'Kia', modelo: 'Sportage', anio: 2024, version: 'EX TA', descripcionCompleta: 'Kia Sportage 2024 EX TA', claveAmis: '1004', armadoraGnp: 'KIA', carroceriaGnp: 'SUV', versionGnp: 'EX TA', valorReferencia: 539900 },
  { id: 'v28', marca: 'Mazda', modelo: '3', anio: 2024, version: 'i Grand Touring TA', descripcionCompleta: 'Mazda 3 2024 i Grand Touring TA', claveAmis: '1101', armadoraGnp: 'MAZDA', carroceriaGnp: 'SEDAN', versionGnp: 'I GRAND TOURING', valorReferencia: 459900 },
  { id: 'v29', marca: 'Mazda', modelo: 'CX-30', anio: 2024, version: 'i Grand Touring TA', descripcionCompleta: 'Mazda CX-30 2024 i Grand Touring TA', claveAmis: '1102', armadoraGnp: 'MAZDA', carroceriaGnp: 'SUV', versionGnp: 'I GRAND TOURING', valorReferencia: 499900 },
  { id: 'v30', marca: 'Mazda', modelo: 'CX-5', anio: 2024, version: 'i Grand Touring TA', descripcionCompleta: 'Mazda CX-5 2024 i Grand Touring TA', claveAmis: '1103', armadoraGnp: 'MAZDA', carroceriaGnp: 'SUV', versionGnp: 'I GRAND TOURING', valorReferencia: 569900 },
  { id: 'v31', marca: 'Ford', modelo: 'Maverick', anio: 2024, version: 'XLT TA', descripcionCompleta: 'Ford Maverick 2024 XLT TA', claveAmis: '1201', armadoraGnp: 'FORD', carroceriaGnp: 'PICKUP', versionGnp: 'XLT TA', valorReferencia: 589900 },
  { id: 'v32', marca: 'Ford', modelo: 'Bronco Sport', anio: 2024, version: 'Big Bend TA', descripcionCompleta: 'Ford Bronco Sport 2024 Big Bend TA', claveAmis: '1202', armadoraGnp: 'FORD', carroceriaGnp: 'SUV', versionGnp: 'BIG BEND', valorReferencia: 629900 },
  { id: 'v33', marca: 'Ford', modelo: 'Escape', anio: 2024, version: 'SE TA', descripcionCompleta: 'Ford Escape 2024 SE TA', claveAmis: '1203', armadoraGnp: 'FORD', carroceriaGnp: 'SUV', versionGnp: 'SE TA', valorReferencia: 549900 },
  { id: 'v34', marca: 'SEAT', modelo: 'Ibiza', anio: 2024, version: 'Style TM', descripcionCompleta: 'SEAT Ibiza 2024 Style TM', claveAmis: '1301', armadoraGnp: 'SEAT', carroceriaGnp: 'HATCHBACK', versionGnp: 'STYLE TM', valorReferencia: 339900 },
  { id: 'v35', marca: 'SEAT', modelo: 'Arona', anio: 2024, version: 'Style TA', descripcionCompleta: 'SEAT Arona 2024 Style TA', claveAmis: '1302', armadoraGnp: 'SEAT', carroceriaGnp: 'SUV', versionGnp: 'STYLE TA', valorReferencia: 429900 },
  { id: 'v36', marca: 'SEAT', modelo: 'Ateca', anio: 2024, version: 'Style TA', descripcionCompleta: 'SEAT Ateca 2024 Style TA', claveAmis: '1303', armadoraGnp: 'SEAT', carroceriaGnp: 'SUV', versionGnp: 'STYLE TA', valorReferencia: 549900 },
  { id: 'v37', marca: 'Suzuki', modelo: 'Swift', anio: 2024, version: 'GLX TM', descripcionCompleta: 'Suzuki Swift 2024 GLX TM', claveAmis: '1401', armadoraGnp: 'SUZUKI', carroceriaGnp: 'HATCHBACK', versionGnp: 'GLX TM', valorReferencia: 299900 },
  { id: 'v38', marca: 'Suzuki', modelo: 'Vitara', anio: 2024, version: 'GLS TA', descripcionCompleta: 'Suzuki Vitara 2024 GLS TA', claveAmis: '1402', armadoraGnp: 'SUZUKI', carroceriaGnp: 'SUV', versionGnp: 'GLS TA', valorReferencia: 419900 },
  { id: 'v39', marca: 'MG', modelo: 'MG5', anio: 2024, version: 'Comfort TM', descripcionCompleta: 'MG MG5 2024 Comfort TM', claveAmis: '1501', armadoraGnp: 'MG', carroceriaGnp: 'SEDAN', versionGnp: 'COMFORT TM', valorReferencia: 299900 },
  { id: 'v40', marca: 'MG', modelo: 'ZS', anio: 2024, version: 'Excite TA', descripcionCompleta: 'MG ZS 2024 Excite TA', claveAmis: '1502', armadoraGnp: 'MG', carroceriaGnp: 'SUV', versionGnp: 'EXCITE TA', valorReferencia: 379900 },
  { id: 'v41', marca: 'MG', modelo: 'HS', anio: 2024, version: 'Excite TA', descripcionCompleta: 'MG HS 2024 Excite TA', claveAmis: '1503', armadoraGnp: 'MG', carroceriaGnp: 'SUV', versionGnp: 'EXCITE TA', valorReferencia: 449900 },
  { id: 'v42', marca: 'BMW', modelo: 'Serie 3', anio: 2024, version: '320i Sport Line', descripcionCompleta: 'BMW Serie 3 2024 320i Sport Line', claveAmis: '1601', armadoraGnp: 'BMW', carroceriaGnp: 'SEDAN', versionGnp: '320I SPORT LINE', valorReferencia: 899900 },
  { id: 'v43', marca: 'BMW', modelo: 'X1', anio: 2024, version: 'sDrive18i', descripcionCompleta: 'BMW X1 2024 sDrive18i', claveAmis: '1602', armadoraGnp: 'BMW', carroceriaGnp: 'SUV', versionGnp: 'SDRIVE18I', valorReferencia: 799900 },
  { id: 'v44', marca: 'Mercedes-Benz', modelo: 'Clase A', anio: 2024, version: 'A200 Progressive', descripcionCompleta: 'Mercedes-Benz Clase A 2024 A200 Progressive', claveAmis: '1701', armadoraGnp: 'MERCEDES BENZ', carroceriaGnp: 'SEDAN', versionGnp: 'A200 PROGRESSIVE', valorReferencia: 849900 },
  { id: 'v45', marca: 'Mercedes-Benz', modelo: 'GLA', anio: 2024, version: 'GLA200 Progressive', descripcionCompleta: 'Mercedes-Benz GLA 2024 GLA200 Progressive', claveAmis: '1702', armadoraGnp: 'MERCEDES BENZ', carroceriaGnp: 'SUV', versionGnp: 'GLA200 PROGRESSIVE', valorReferencia: 899900 },
  { id: 'v46', marca: 'Audi', modelo: 'A3', anio: 2024, version: 'Dynamic 35 TFSI', descripcionCompleta: 'Audi A3 2024 Dynamic 35 TFSI', claveAmis: '1801', armadoraGnp: 'AUDI', carroceriaGnp: 'SEDAN', versionGnp: 'DYNAMIC 35 TFSI', valorReferencia: 699900 },
  { id: 'v47', marca: 'Audi', modelo: 'Q3', anio: 2024, version: 'Dynamic 35 TFSI', descripcionCompleta: 'Audi Q3 2024 Dynamic 35 TFSI', claveAmis: '1802', armadoraGnp: 'AUDI', carroceriaGnp: 'SUV', versionGnp: 'DYNAMIC 35 TFSI', valorReferencia: 769900 },
  { id: 'v48', marca: 'RAM', modelo: '700', anio: 2024, version: 'SLT Club Cab', descripcionCompleta: 'RAM 700 2024 SLT Club Cab', claveAmis: '1901', armadoraGnp: 'RAM', carroceriaGnp: 'PICKUP', versionGnp: 'SLT CLUB CAB', valorReferencia: 329900 },
  { id: 'v49', marca: 'RAM', modelo: '1200', anio: 2024, version: 'SLT Crew Cab', descripcionCompleta: 'RAM 1200 2024 SLT Crew Cab', claveAmis: '1902', armadoraGnp: 'RAM', carroceriaGnp: 'PICKUP', versionGnp: 'SLT CREW CAB', valorReferencia: 459900 },
  { id: 'v50', marca: 'Renault', modelo: 'Kwid', anio: 2024, version: 'Intens TM', descripcionCompleta: 'Renault Kwid 2024 Intens TM', claveAmis: '2001', armadoraGnp: 'RENAULT', carroceriaGnp: 'HATCHBACK', versionGnp: 'INTENS TM', valorReferencia: 249900 },
];

export const BRAND_MODELS_METADATA: Record<string, ModelMetadata[]> = {
  'Nissan': [
    { modelo: 'Versa', tipoCarroceria: 'Sedan', precioBase: 329900 },
    { modelo: 'Sentra', tipoCarroceria: 'Sedan', precioBase: 419900 },
    { modelo: 'Kicks', tipoCarroceria: 'SUV', precioBase: 399900 },
    { modelo: 'X-Trail', tipoCarroceria: 'SUV', precioBase: 499900 },
    { modelo: 'Frontier', tipoCarroceria: 'Pickup', precioBase: 559900 },
  ],
  'Toyota': [
    { modelo: 'Yaris', tipoCarroceria: 'Sedan', precioBase: 299900 },
    { modelo: 'Corolla', tipoCarroceria: 'Sedan', precioBase: 419900 },
    { modelo: 'RAV4', tipoCarroceria: 'SUV', precioBase: 619900 },
    { modelo: 'Hilux', tipoCarroceria: 'Pickup', precioBase: 489900 },
    { modelo: 'Camry', tipoCarroceria: 'Sedan', precioBase: 589900 },
  ],
  'Volkswagen': [
    { modelo: 'Jetta', tipoCarroceria: 'Sedan', precioBase: 429900 },
    { modelo: 'Taos', tipoCarroceria: 'SUV', precioBase: 499900 },
    { modelo: 'Tiguan', tipoCarroceria: 'SUV', precioBase: 589900 },
    { modelo: 'T-Cross', tipoCarroceria: 'SUV', precioBase: 419900 },
  ],
  'Chevrolet': [
    { modelo: 'Aveo', tipoCarroceria: 'Sedan', precioBase: 279900 },
    { modelo: 'Onix', tipoCarroceria: 'Sedan', precioBase: 339900 },
    { modelo: 'Tracker', tipoCarroceria: 'SUV', precioBase: 449900 },
    { modelo: 'Equinox', tipoCarroceria: 'SUV', precioBase: 589900 },
  ],
  'Honda': [
    { modelo: 'City', tipoCarroceria: 'Sedan', precioBase: 359900 },
    { modelo: 'Civic', tipoCarroceria: 'Sedan', precioBase: 549900 },
    { modelo: 'CR-V', tipoCarroceria: 'SUV', precioBase: 619900 },
    { modelo: 'HR-V', tipoCarroceria: 'SUV', precioBase: 449900 },
  ],
  'Hyundai': [
    { modelo: 'Grand i10', tipoCarroceria: 'Sedan', precioBase: 259900 },
    { modelo: 'Creta', tipoCarroceria: 'SUV', precioBase: 429900 },
    { modelo: 'Tucson', tipoCarroceria: 'SUV', precioBase: 539900 },
  ],
  'Kia': [
    { modelo: 'Rio', tipoCarroceria: 'Sedan', precioBase: 309900 },
    { modelo: 'Forte', tipoCarroceria: 'Sedan', precioBase: 379900 },
    { modelo: 'Seltos', tipoCarroceria: 'SUV', precioBase: 429900 },
    { modelo: 'Sportage', tipoCarroceria: 'SUV', precioBase: 539900 },
  ],
  'Mazda': [
    { modelo: '3', tipoCarroceria: 'Sedan', precioBase: 459900 },
    { modelo: 'CX-30', tipoCarroceria: 'SUV', precioBase: 499900 },
    { modelo: 'CX-5', tipoCarroceria: 'SUV', precioBase: 569900 },
  ],
  'Ford': [
    { modelo: 'Maverick', tipoCarroceria: 'Pickup', precioBase: 589900 },
    { modelo: 'Bronco Sport', tipoCarroceria: 'SUV', precioBase: 629900 },
    { modelo: 'Escape', tipoCarroceria: 'SUV', precioBase: 549900 },
  ],
  'BMW': [
    { modelo: 'Serie 3', tipoCarroceria: 'Sedan', precioBase: 899900 },
    { modelo: 'X1', tipoCarroceria: 'SUV', precioBase: 799900 },
    { modelo: 'X3', tipoCarroceria: 'SUV', precioBase: 999900 },
  ],
  'Mercedes-Benz': [
    { modelo: 'Clase A', tipoCarroceria: 'Sedan', precioBase: 849900 },
    { modelo: 'GLA', tipoCarroceria: 'SUV', precioBase: 899900 },
    { modelo: 'Clase C', tipoCarroceria: 'Sedan', precioBase: 999900 },
  ],
  'Audi': [
    { modelo: 'A3', tipoCarroceria: 'Sedan', precioBase: 699900 },
    { modelo: 'Q3', tipoCarroceria: 'SUV', precioBase: 769900 },
    { modelo: 'Q5', tipoCarroceria: 'SUV', precioBase: 949900 },
  ],
};

export function getAvailableBrands(): string[] {
  return [...new Set(STATIC_VEHICLES.map((v) => v.marca))].sort();
}

export function getModelsForBrand(brand: string): string[] {
  return [...new Set(STATIC_VEHICLES.filter((v) => v.marca === brand).map((v) => v.modelo))].sort();
}

export function getVersionsForModel(brand: string, model: string): Vehiculo[] {
  return STATIC_VEHICLES.filter((v) => v.marca === brand && v.modelo === model);
}
