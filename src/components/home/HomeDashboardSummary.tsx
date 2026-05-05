import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ProductionComparisonCard } from './ProductionComparisonCard';
import { RenewalsCard } from './RenewalsCard';
import { LatestEmissionsCard } from './LatestEmissionsCard';

interface Props {
  userId: string;
}

export function HomeDashboardSummary({ userId }: Props) {
  const navigate = useNavigate();
  const [productionData, setProductionData] = useState<any>(null);
  const [renewalsData, setRenewalsData] = useState<any[]>([]);
  const [emissionsData, setEmissionsData] = useState<any[]>([]);
  const [loadingProduction, setLoadingProduction] = useState(true);
  const [loadingRenewals, setLoadingRenewals] = useState(true);
  const [loadingEmissions, setLoadingEmissions] = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadAll();
  }, [userId]);

  const loadAll = async () => {
    loadProduction();
    loadRenewals();
    loadEmissions();
  };

  const loadProduction = async () => {
    try {
      setLoadingProduction(true);
      const { data, error } = await supabase.rpc('get_home_production_comparison', { p_user_id: userId });
      if (!error && data) setProductionData(data);
    } catch { /* silent */ }
    finally { setLoadingProduction(false); }
  };

  const loadRenewals = async () => {
    try {
      setLoadingRenewals(true);
      const { data, error } = await supabase.rpc('get_home_next_renewals', { p_user_id: userId, p_limit: 5 });
      if (!error && data) setRenewalsData(data);
    } catch { /* silent */ }
    finally { setLoadingRenewals(false); }
  };

  const loadEmissions = async () => {
    try {
      setLoadingEmissions(true);
      const { data, error } = await supabase.rpc('get_home_latest_emissions', { p_user_id: userId, p_limit: 5 });
      if (!error && data) setEmissionsData(data);
    } catch { /* silent */ }
    finally { setLoadingEmissions(false); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <ProductionComparisonCard
        data={productionData}
        loading={loadingProduction}
        onClick={() => navigate('/produccion-sicas')}
      />
      <RenewalsCard
        data={renewalsData}
        loading={loadingRenewals}
        onViewMore={() => navigate('/produccion-sicas?tab=renovaciones')}
        onClickItem={(item) => navigate(`/produccion-sicas?tab=documentos&doc=${item.id_docto}`)}
      />
      <LatestEmissionsCard
        data={emissionsData}
        loading={loadingEmissions}
        onViewMore={() => navigate('/produccion-sicas?tab=documentos')}
        onClickItem={(item) => navigate(`/produccion-sicas?tab=documentos&doc=${item.id_docto}`)}
      />
    </div>
  );
}
