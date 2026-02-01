// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - NOTIFICATIONS COMPONENTS
// Composants d'affichage des notifications (utilise WebSocketContext)
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { 
  Snackbar, 
  Alert, 
  Badge, 
  IconButton, 
  Drawer, 
  List, 
  ListItem,
  ListItemText, 
  ListItemIcon, 
  Typography, 
  Box, 
  Divider, 
  Chip, 
  Button,
  Tooltip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  LocalShipping,
  Payment,
  Warning,
  CheckCircle,
  Close,
  MarkEmailRead,
  ShoppingCart,
  Info,
} from '@mui/icons-material';
import { useWebSocket, Notification, NotificationType } from '../contexts/WebSocketContext';

// ─── TYPE ICONS ────────────────────────────────────────────────────────────────

const typeIcons: Record<NotificationType, React.ReactElement> = {
  new_order: <ShoppingCart color="primary" />,
  order: <ShoppingCart color="primary" />,
  delivery_completed: <CheckCircle color="success" />,
  delivery: <LocalShipping color="info" />,
  delivery_failed: <Warning color="error" />,
  payment_received: <Payment color="success" />,
  payment: <Payment color="success" />,
  low_stock: <Warning color="warning" />,
  system: <Info color="info" />,
};

const typeColors: Record<NotificationType, 'primary' | 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  new_order: 'primary',
  order: 'primary',
  delivery_completed: 'success',
  delivery: 'info',
  delivery_failed: 'error',
  payment_received: 'success',
  payment: 'success',
  low_stock: 'warning',
  system: 'info',
};

// ─── NOTIFICATION BELL (HEADER) ────────────────────────────────────────────────

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isConnected } = useWebSocket();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read && !notification.isRead) {
      markAsRead(notification.id);
    }
  };

  return (
    <>
      <Tooltip title={isConnected ? 'Notifications' : 'Notifications (hors ligne)'}>
        <IconButton onClick={() => setDrawerOpen(true)}>
          <Badge badgeContent={unreadCount} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 380, p: 0 }}>
          {/* Header */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              p: 2,
              bgcolor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Box>
              <Typography variant="h6">Notifications</Typography>
              {isConnected ? (
                <Typography variant="caption" color="success.main">
                  ● En ligne
                </Typography>
              ) : (
                <Typography variant="caption" color="error.main">
                  ● Hors ligne
                </Typography>
              )}
            </Box>
            <Box>
              {unreadCount > 0 && (
                <Button 
                  size="small" 
                  startIcon={<MarkEmailRead />} 
                  onClick={markAllAsRead}
                  sx={{ mr: 1 }}
                >
                  Tout lire
                </Button>
              )}
              <IconButton onClick={() => setDrawerOpen(false)} size="small">
                <Close />
              </IconButton>
            </Box>
          </Box>

          {/* Notifications list */}
          {notifications.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center', px: 2 }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'grey.300' }} />
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Aucune notification
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Les nouvelles notifications apparaîtront ici
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {notifications.map((notification) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    sx={{
                      bgcolor: notification.read || notification.isRead ? 'transparent' : 'action.hover',
                      borderLeft: 4,
                      borderColor: `${typeColors[notification.type]}.main`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        bgcolor: 'action.selected',
                      },
                      py: 1.5,
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {typeIcons[notification.type] || typeIcons.system}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography
                            component="span"
                            variant="body2"
                            fontWeight={notification.read || notification.isRead ? 'normal' : 'bold'}
                          >
                            {notification.title}
                          </Typography>
                          {!(notification.read || notification.isRead) && (
                            <Chip size="small" label="Nouveau" color="primary" sx={{ height: 20, fontSize: 10 }} />
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" color="text.secondary" fontSize={12}>
                            {notification.message || notification.body}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" fontSize={11}>
                            {new Date(notification.createdAt).toLocaleString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          )}

          {/* Footer */}
          {notifications.length > 0 && (
            <Box 
              sx={{ 
                p: 1.5, 
                textAlign: 'center',
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2" color="primary" sx={{ cursor: 'pointer' }}>
                Voir toutes les notifications
              </Typography>
            </Box>
          )}
        </Box>
      </Drawer>
    </>
  );
};

// ─── TOAST NOTIFICATION ────────────────────────────────────────────────────────

export const NotificationToast: React.FC = () => {
  const { notifications } = useWebSocket();
  const [toastQueue, setToastQueue] = useState<Notification[]>([]);
  const [currentToast, setCurrentToast] = useState<Notification | null>(null);

  // Gérer la file d'attente des toasts
  React.useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      // Ajouter à la file si nouveau et non lu
      if (!latest.read && !latest.isRead && !toastQueue.find(t => t.id === latest.id)) {
        setToastQueue(prev => [latest, ...prev]);
      }
    }
  }, [notifications]);

  // Afficher le prochain toast
  React.useEffect(() => {
    if (!currentToast && toastQueue.length > 0) {
      setCurrentToast(toastQueue[toastQueue.length - 1]);
      setToastQueue(prev => prev.slice(0, -1));
    }
  }, [toastQueue, currentToast]);

  const handleClose = () => {
    setCurrentToast(null);
  };

  const severityMap: Record<NotificationType, 'success' | 'info' | 'warning' | 'error'> = {
    delivery_completed: 'success',
    payment_received: 'success',
    new_order: 'info',
    order: 'info',
    delivery: 'info',
    delivery_failed: 'error',
    low_stock: 'warning',
    system: 'info',
    payment: 'success',
  };

  return (
    <Snackbar
      open={!!currentToast}
      autoHideDuration={5000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      {currentToast ? (
        <Alert
          severity={severityMap[currentToast.type] || 'info'}
          onClose={handleClose}
          sx={{ minWidth: 300, maxWidth: 400 }}
          icon={typeIcons[currentToast.type]}
        >
          <Typography variant="subtitle2" fontWeight="bold">
            {currentToast.title}
          </Typography>
          <Typography variant="body2">
            {currentToast.message || currentToast.body}
          </Typography>
        </Alert>
      ) : undefined}
    </Snackbar>
  );
};

// ─── NOTIFICATIONS PAGE ─────────────────────────────────────────────────────────

export const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications, isConnected } = useWebSocket();

  const getNotificationIcon = (type: NotificationType) => {
    return typeIcons[type] || typeIcons.system;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Notifications
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {unreadCount} notification{unreadCount !== 1 ? 's' : ''} non lue{unreadCount !== 1 ? 's' : ''}
            {' · '}
            {isConnected ? (
              <span style={{ color: 'green' }}>● En ligne</span>
            ) : (
              <span style={{ color: 'red' }}>● Hors ligne</span>
            )}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          {unreadCount > 0 && (
            <Button variant="outlined" onClick={markAllAsRead}>
              Tout marquer comme lu
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outlined" color="error" onClick={clearNotifications}>
              Effacer tout
            </Button>
          )}
        </Box>
      </Box>

      <List>
        {notifications.length === 0 ? (
          <Box textAlign="center" py={8}>
            <NotificationsIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
            <Typography color="text.secondary">
              Aucune notification pour le moment
            </Typography>
          </Box>
        ) : (
          notifications.map((notification) => (
            <ListItem
              key={notification.id}
              sx={{
                bgcolor: notification.read || notification.isRead ? 'transparent' : 'action.hover',
                borderLeft: 4,
                borderColor: `${typeColors[notification.type]}.main`,
                mb: 1,
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
              }}
              onClick={() => markAsRead(notification.id)}
            >
              <ListItemIcon>
                {getNotificationIcon(notification.type)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography
                      component="span"
                      fontWeight={notification.read || notification.isRead ? 'normal' : 'bold'}
                    >
                      {notification.title}
                    </Typography>
                    {!(notification.read || notification.isRead) && (
                      <Chip size="small" label="Nouveau" color="primary" />
                    )}
                  </Box>
                }
                secondary={
                  <>
                    <Typography variant="body2" color="text.secondary">
                      {notification.message || notification.body}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(notification.createdAt).toLocaleString('fr-FR')}
                    </Typography>
                  </>
                }
              />
            </ListItem>
          ))
        )}
      </List>
    </Box>
  );
};

export default NotificationBell;
