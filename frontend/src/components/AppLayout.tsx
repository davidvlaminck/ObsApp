import { AxiosError } from 'axios'
import { ReactNode, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { clearToken, getMe, UserResponse } from '../services/auth'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import AssignmentIcon from '@mui/icons-material/Assignment'
import VisibilityIcon from '@mui/icons-material/Visibility'
import HomeIcon from '@mui/icons-material/Home'
import SchoolIcon from '@mui/icons-material/School'
import PeopleIcon from '@mui/icons-material/People'
import MenuIcon from '@mui/icons-material/Menu'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'

interface AppLayoutProps {
  children: ReactNode
}

interface MenuItem {
  label: string
  to: string
  icon: React.ElementType
  adminOnly?: boolean
  demoOnly?: boolean
  children?: MenuItem[]
}

const DRAWER_WIDTH = 220

const menuItems: MenuItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: DashboardIcon },
  { label: 'Overzicht per klas', to: '/overzicht', icon: AssignmentIcon },
  { label: 'Overzicht per leerling', to: '/overzicht/leerling', icon: AssignmentIcon },
  { label: 'Observeren', to: '/observeren', icon: VisibilityIcon },
  { label: 'Demo schoolbeheer', to: '/demo-school', icon: SchoolIcon, demoOnly: true },
  {
    label: 'Beheer',
    to: '/management',
    icon: AssignmentIcon,
    children: [
      { label: 'Observatiedoelen', to: '/management/observations', icon: AssignmentIcon },
      { label: 'Klasbeheer', to: '/management/classes', icon: SchoolIcon },
      { label: 'Scholen', to: '/schools', icon: HomeIcon, adminOnly: true },
      { label: 'Gebruikers', to: '/users', icon: PeopleIcon, adminOnly: true },
    ],
  },
]

const filterMenuItems = (items: MenuItem[], user: UserResponse | null): MenuItem[] => {
  return items
    .map((item) => {
      const children = item.children ? filterMenuItems(item.children, user) : []
      return {
        ...item,
        children,
      }
    })
    .filter((item) => {
      // If item has children, only show if at least one child is visible
      if (item.children && item.children.length > 0) {
        return true
      }
      if (item.demoOnly) {
        return user?.is_demo
      }
      return !item.adminOnly || user?.is_superuser
    })
    .map((item) => {
      // Remove empty children arrays
      if (item.children && item.children.length === 0) {
        const { children, ...rest } = item
        return rest
      }
      return item
    })
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await getMe()
        setUser(user)
        if (user.needs_koepel_selection) {
          navigate('/select-koepel')
        }
      } catch (error) {
        const axiosError = error as AxiosError
        if (axiosError.response?.status === 401) {
          clearToken()
          navigate('/login')
          return
        }
        clearToken()
        navigate('/login')
      }
    }

    loadCurrentUser()
  }, [navigate])

  const visibleItems = filterMenuItems(menuItems, user)

  const handleNavigate = () => setDrawerOpen(false)

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [label]: !prev[label],
    }))
  }

  const isItemActive = (item: MenuItem, pathname: string): boolean => {
    if (item.children) {
      return item.children.some((child) => pathname.startsWith(child.to))
    }
    return pathname === item.to
  }

  const renderMenuItem = (item: MenuItem, pathname: string, onNavigate: () => void) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems[item.label]
    const isActive = isItemActive(item, pathname)

    if (hasChildren) {
      return (
        <div key={item.to}>
          <ListItem disablePadding>
            <ListItemButton
              selected={isActive}
              onClick={() => toggleExpanded(item.label)}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 1,
                '&.Mui-selected': {
                  bgcolor: 'rgba(25, 118, 210, 0.12)',
                },
                '&.Mui-selected:hover': {
                  bgcolor: 'rgba(25, 118, 210, 0.16)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <item.icon color={isActive ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'primary.main' : 'text.primary',
                  },
                }}
              />
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          {isExpanded && (
            <List component="div" disablePadding>
              {item.children!.map((child) => (
                <ListItem key={child.to} disablePadding>
                  <ListItemButton
                    component={NavLink}
                    to={child.to}
                    onClick={onNavigate}
                    selected={pathname === child.to}
                    sx={{
                      mx: 1,
                      mb: 0.5,
                      ml: 3,
                      borderRadius: 1,
                      '&.Mui-selected': {
                        bgcolor: 'rgba(25, 118, 210, 0.12)',
                      },
                      '&.Mui-selected:hover': {
                        bgcolor: 'rgba(25, 118, 210, 0.16)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <child.icon color={pathname === child.to ? 'primary' : 'action'} />
                    </ListItemIcon>
                    <ListItemText
                      primary={child.label}
                      sx={{
                        '& .MuiListItemText-primary': {
                          fontSize: 14,
                          fontWeight: pathname === child.to ? 500 : 400,
                          color: pathname === child.to ? 'primary.main' : 'text.secondary',
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </div>
      )
    }

    return (
      <ListItem key={item.to} disablePadding>
        <ListItemButton
          component={NavLink}
          to={item.to}
          onClick={onNavigate}
          selected={isActive}
          sx={{
            mx: 1,
            mb: 0.5,
            borderRadius: 1,
            '&.Mui-selected': {
              bgcolor: 'rgba(25, 118, 210, 0.12)',
            },
            '&.Mui-selected:hover': {
              bgcolor: 'rgba(25, 118, 210, 0.16)',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <item.icon color={isActive ? 'primary' : 'inherit'} />
          </ListItemIcon>
          <ListItemText
            primary={item.label}
            sx={{
              '& .MuiListItemText-primary': {
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'primary.main' : 'text.primary',
              },
            }}
          />
        </ListItemButton>
      </ListItem>
    )
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? drawerOpen : true}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'primary.main',
              color: 'white',
              fontSize: 22,
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.25)',
            }}
          >
            O
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              ObsApp
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.school_id ? 'Schoolomgeving' : 'Beheer'}
            </Typography>
          </Box>
        </Box>

        <Divider />

        <List sx={{ flexGrow: 1, py: 1 }} aria-label="Hoofdmenu">
          {visibleItems.map((item) => renderMenuItem(item, location.pathname, handleNavigate))}
        </List>

        <Divider />

        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'primary.main',
                color: 'white',
                fontWeight: 500,
              }}
            >
              {user?.name?.charAt(0) ?? 'U'}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {user?.name ?? 'Gebruiker'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.is_superuser ? 'Admin' : 'Leerkracht'}
              </Typography>
            </Box>
          </Box>
          <button className="btn btn-outline btn-full" type="button" onClick={handleLogout}>
            Uitloggen
          </button>
        </Box>
      </Drawer>

      {isMobile && (
        <IconButton
          onClick={() => setDrawerOpen(true)}
          aria-label="Menu openen"
          sx={{
            position: 'fixed',
            top: 8,
            left: 8,
            zIndex: 10,
            bgcolor: 'background.paper',
            boxShadow: 1,
          }}
        >
          <MenuIcon />
        </IconButton>
      )}
        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            p: { xs: 1, md: 1.5 },
          }}
        >
        {children}
      </Box>
    </Box>
  )
}
