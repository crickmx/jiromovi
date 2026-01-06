import type { LeccionContenido, LeccionSeccion } from '../../lib/cedulaATypes';
import { AlertTriangle, Lightbulb, BookOpen, CheckCircle2, FileText } from 'lucide-react';

interface Props {
  contenido: LeccionContenido;
}

export default function LeccionContent({ contenido }: Props) {
  const renderSeccion = (seccion: LeccionSeccion, index: number) => {
    switch (seccion.type) {
      case 'titulo':
        return (
          <h2 key={index} className="text-2xl font-bold text-neutral-900 mb-4 mt-8 first:mt-0">
            {seccion.content}
          </h2>
        );

      case 'parrafo':
        return (
          <p key={index} className="text-base text-neutral-700 leading-relaxed mb-4">
            {seccion.content}
          </p>
        );

      case 'definicion':
        return (
          <div key={index} className="bg-primary-50 border-l-4 border-primary-600 rounded-ios-lg p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary-600 rounded-ios flex items-center justify-center flex-shrink-0 mt-0.5">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-primary-900 mb-2">Definición</h4>
                <p className="text-neutral-700 leading-relaxed">{seccion.content}</p>
              </div>
            </div>
          </div>
        );

      case 'ejemplo':
        return (
          <div key={index} className="bg-emerald-50 rounded-ios-lg p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-600 rounded-ios flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lightbulb className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-emerald-900 mb-2">Ejemplo</h4>
                <p className="text-neutral-700 leading-relaxed">{seccion.content}</p>
              </div>
            </div>
          </div>
        );

      case 'alerta':
        return (
          <div key={index} className="bg-amber-50 border-l-4 border-amber-500 rounded-ios-lg p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-500 rounded-ios flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900 mb-2">Importante para el examen</h4>
                <p className="text-neutral-700 leading-relaxed">{seccion.content}</p>
              </div>
            </div>
          </div>
        );

      case 'lista':
        return (
          <div key={index} className="mb-6">
            {seccion.content && (
              <h4 className="font-semibold text-neutral-900 mb-3">{seccion.content}</h4>
            )}
            <ul className="space-y-2">
              {seccion.items?.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                  <span className="text-neutral-700 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );

      case 'caso_practico':
        return (
          <div key={index} className="bg-neutral-50 rounded-ios-lg p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-neutral-600 rounded-ios flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-neutral-900 mb-2">Caso Práctico</h4>
                <p className="text-neutral-700 leading-relaxed">{seccion.content}</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="prose prose-neutral max-w-none">
      {contenido.sections.map((seccion, index) => renderSeccion(seccion, index))}
    </div>
  );
}
