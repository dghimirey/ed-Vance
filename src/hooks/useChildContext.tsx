import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ChildInfo {
  id: string;
  name: string;
  symbol_number: string;
  class_id: string;
  section_id: string;
  class_name?: string;
  section_name?: string;
}

interface ChildContextType {
  children: ChildInfo[];
  selectedChild: ChildInfo | null;
  setSelectedChildId: (id: string) => void;
  loading: boolean;
}

const ChildContext = createContext<ChildContextType>({
  children: [],
  selectedChild: null,
  setSelectedChildId: () => {},
  loading: true,
});

export function ChildProvider({ children: reactChildren }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [childrenList, setChildrenList] = useState<ChildInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || role !== 'parent') {
      setLoading(false);
      return;
    }

    const fetchChildren = async () => {
      const { data: students } = await supabase
        .from('students')
        .select('id, name, symbol_number, class_id, section_id')
        .eq('parent_id', user.id)
        .order('name');

      if (!students || students.length === 0) {
        setChildrenList([]);
        setLoading(false);
        return;
      }

      // Fetch class and section names
      const classIds = [...new Set(students.map(s => s.class_id))];
      const sectionIds = [...new Set(students.map(s => s.section_id))];

      const [classRes, sectionRes] = await Promise.all([
        supabase.from('classes').select('id, name').in('id', classIds),
        supabase.from('sections').select('id, name').in('id', sectionIds),
      ]);

      const classMap = new Map((classRes.data || []).map(c => [c.id, c.name]));
      const sectionMap = new Map((sectionRes.data || []).map(s => [s.id, s.name]));

      const enriched: ChildInfo[] = students.map(s => ({
        ...s,
        class_name: classMap.get(s.class_id) || '',
        section_name: sectionMap.get(s.section_id) || '',
      }));

      setChildrenList(enriched);

      // Restore from session or pick first
      const saved = sessionStorage.getItem('dss_selected_child');
      const validSaved = saved && enriched.some(c => c.id === saved);
      setSelectedId(validSaved ? saved! : enriched[0].id);
      setLoading(false);
    };

    fetchChildren();
  }, [user, role]);

  const setSelectedChildId = (id: string) => {
    setSelectedId(id);
    sessionStorage.setItem('dss_selected_child', id);
  };

  const selectedChild = childrenList.find(c => c.id === selectedId) || null;

  return (
    <ChildContext.Provider value={{ children: childrenList, selectedChild, setSelectedChildId, loading }}>
      {reactChildren}
    </ChildContext.Provider>
  );
}

export const useChildContext = () => useContext(ChildContext);
