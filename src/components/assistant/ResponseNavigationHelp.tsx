import type { NavigationCategory } from '../../lib/assistantTypes';
import { ResponseActionButtons } from './ResponseActionButtons';

interface ResponseNavigationHelpProps {
  categories: NavigationCategory[];
}

export function ResponseNavigationHelp({ categories }: ResponseNavigationHelpProps) {
  return (
    <div className="space-y-3">
      {categories.map((category, index) => (
        <div key={index} className="p-3 border rounded bg-white">
          <h4 className="font-medium text-sm mb-2">{category.name}</h4>
          <ResponseActionButtons actions={category.actions} />
        </div>
      ))}
    </div>
  );
}
