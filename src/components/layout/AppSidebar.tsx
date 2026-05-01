import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  CalendarCheck, FileSpreadsheet, Settings, TrendingUp, Award, LogOut, ShieldCheck, CalendarDays, Lock,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useChildContext } from '@/hooks/useChildContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const adminItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Users', url: '/users', icon: Users },
  { title: 'Students', url: '/students', icon: GraduationCap },
  { title: 'Classes', url: '/classes', icon: BookOpen },
  { title: 'Calendar', url: '/calendar', icon: CalendarDays },
  { title: 'Attendance', url: '/attendance', icon: CalendarCheck },
  { title: 'Marks', url: '/marks', icon: ClipboardList },
  { title: 'Exam Access', url: '/exam-access', icon: Lock },
  { title: 'Grade Ledger', url: '/ledger', icon: FileSpreadsheet },
  { title: 'Assignments', url: '/assignments', icon: ClipboardList },
  { title: 'Analytics', url: '/analytics', icon: TrendingUp },
  { title: 'Access Audit', url: '/access-audit', icon: ShieldCheck },
  { title: 'Promotion', url: '/promotion', icon: Award },
  { title: 'Settings', url: '/settings', icon: Settings },
];

const teacherItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Students', url: '/students', icon: GraduationCap },
  { title: 'Calendar', url: '/calendar', icon: CalendarDays },
  { title: 'Attendance', url: '/attendance', icon: CalendarCheck },
  { title: 'Marks', url: '/marks', icon: ClipboardList },
  { title: 'Grade Ledger', url: '/ledger', icon: FileSpreadsheet },
  { title: 'Assignments', url: '/assignments', icon: ClipboardList },
  { title: 'Analytics', url: '/analytics', icon: TrendingUp },
];

const parentItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Report Card', url: '/report-card', icon: FileSpreadsheet },
  { title: 'Calendar', url: '/calendar', icon: CalendarDays },
  { title: 'Attendance', url: '/attendance', icon: CalendarCheck },
  { title: 'Assignments', url: '/assignments', icon: ClipboardList },
  { title: 'Analytics', url: '/analytics', icon: TrendingUp },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { role, signOut, profile } = useAuth();

  const items = role === 'admin' ? adminItems : role === 'teacher' ? teacherItems : parentItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 py-4">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">DSS</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{role}</span>
                </div>
              </div>
            )}
          </SidebarGroupLabel>

          {/* Child Switcher for Parents */}
          {role === 'parent' && !collapsed && <ParentChildSwitcher />}

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-accent/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && profile && (
          <div className="mb-2 px-2 text-xs text-muted-foreground truncate">{profile.name}</div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          onClick={signOut}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

function ParentChildSwitcher() {
  const { children, selectedChild, setSelectedChildId } = useChildContext();

  if (children.length <= 1) return null;

  return (
    <div className="px-3 pb-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">Children</p>
      <div className="flex flex-col gap-1">
        {children.map(child => (
          <button
            key={child.id}
            onClick={() => setSelectedChildId(child.id)}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-all',
              selectedChild?.id === child.id
                ? 'bg-primary/10 text-primary font-medium ring-1 ring-primary/20'
                : 'hover:bg-accent/50 text-muted-foreground'
            )}
          >
            <span className="block truncate">{child.name}</span>
            <span className="text-[10px] text-muted-foreground">
              {child.class_name} · {child.section_name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
