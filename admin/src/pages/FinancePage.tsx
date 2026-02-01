// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE FINANCE
// Vue globale finances, aging report, encaissements, dettes
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
  TextField,
  MenuItem,
  LinearProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  Warning,
  Download,
  Refresh,
  CalendarToday,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '../api/client';
import { 
  FinancialOverview, 
  AgingReport, 
  Payment, 
  Customer,
  ApiResponse 
} from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} role="tabpanel">
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  // api client déjà importé

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  const { data: overview, isLoading: isLoadingOverview, refetch: refetchOverview } = 
    useQuery<ApiResponse<FinancialOverview>>({
      queryKey: ['finance-overview', startDate, endDate],
      queryFn: () => api.get('/finance/overview', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      }),
    });

  const { data: agingReport, isLoading: isLoadingAging } = 
    useQuery<ApiResponse<AgingReport>>({
      queryKey: ['finance-aging'],
      queryFn: () => api.get('/finance/aging-report'),
    });

  const { data: payments, isLoading: isLoadingPayments } = 
    useQuery<ApiResponse<{ data: Payment[] }>>({
      queryKey: ['finance-payments', startDate, endDate],
      queryFn: () => api.get('/finance/daily-summary', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      }),
    });

  const { data: debts, isLoading: isLoadingDebts } = 
    useQuery<ApiResponse<{ data: Customer[] }>>({
      queryKey: ['finance-debts'],
      queryFn: () => api.get('/finance/debts'),
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleExport = (type: string) => {
    window.open(`/api/reports/export?type=${type}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, '_blank');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" fontWeight="bold">
            💰 Finance
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => handleExport('financial')}
            >
              Exporter
            </Button>
            <IconButton onClick={() => refetchOverview()}>
              <Refresh />
            </IconButton>
          </Box>
        </Box>

        {/* Filtres de période */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <CalendarToday color="action" />
            <DatePicker
              label="Date début"
              value={startDate}
              onChange={(date) => date && setStartDate(date)}
              slotProps={{ textField: { size: 'small' } }}
            />
            <DatePicker
              label="Date fin"
              value={endDate}
              onChange={(date) => date && setEndDate(date)}
              slotProps={{ textField: { size: 'small' } }}
            />
            <Button 
              variant="contained" 
              onClick={() => refetchOverview()}
              size="small"
            >
              Appliquer
            </Button>
          </Box>
        </Paper>

        {/* Onglets */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Vue d'ensemble" />
            <Tab label="Aging Report" />
            <Tab label="Encaissements" />
            <Tab label="Dettes clients" />
          </Tabs>
        </Paper>

        {/* Contenu des onglets */}
        <Paper sx={{ minHeight: 400 }}>
          {/* Vue d'ensemble */}
          <TabPanel value={activeTab} index={0}>
            {isLoadingOverview ? (
              <LinearProgress />
            ) : overview?.data ? (
              <OverviewTab data={overview.data} />
            ) : (
              <Alert severity="error">Erreur de chargement des données</Alert>
            )}
          </TabPanel>

          {/* Aging Report */}
          <TabPanel value={activeTab} index={1}>
            {isLoadingAging ? (
              <LinearProgress />
            ) : agingReport?.data ? (
              <AgingReportTab data={agingReport.data} />
            ) : (
              <Alert severity="error">Erreur de chargement</Alert>
            )}
          </TabPanel>

          {/* Encaissements */}
          <TabPanel value={activeTab} index={2}>
            {isLoadingPayments ? (
              <LinearProgress />
            ) : (
              <PaymentsTab payments={payments?.data?.data || []} />
            )}
          </TabPanel>

          {/* Dettes */}
          <TabPanel value={activeTab} index={3}>
            {isLoadingDebts ? (
              <LinearProgress />
            ) : (
              <DebtsTab customers={debts?.data?.data || []} />
            )}
          </TabPanel>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ data }: { data: FinancialOverview }) {
  return (
    <Grid container spacing={3}>
      {/* KPIs */}
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TrendingUp color="success" fontSize="large" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Chiffre d'affaires
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {formatCurrency(data.revenue.totalRevenue)}
                </Typography>
                <Typography variant="caption" color="success.main">
                  {data.revenue.totalOrders} commandes
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AttachMoney color="primary" fontSize="large" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Encaissements
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {formatCurrency(data.collections.totalCollected)}
                </Typography>
                <Typography variant="caption" color="primary.main">
                  {data.collections.totalPayments} paiements
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TrendingDown color="error" fontSize="large" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Créances clients
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {formatCurrency(data.debts.totalDebt)}
                </Typography>
                <Typography variant="caption" color="error.main">
                  {data.debts.customerCount} clients
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Warning color="warning" fontSize="large" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Taux impayés
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {data.outstandingRate.toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="warning.main">
                  {formatCurrency(data.revenue.totalRevenue - data.collections.totalCollected)}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function AgingReportTab({ data }: { data: AgingReport }) {
  const getColorForBucket = (index: number) => {
    const colors = ['success', 'info', 'warning', 'error'];
    return colors[index] || 'default';
  };

  return (
    <Box>
      {/* Résumé des buckets */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {data.buckets.map((bucket, index) => (
          <Grid item xs={12} md={3} key={bucket.range}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {bucket.range}
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  {formatCurrency(bucket.amount)}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Chip 
                    size="small" 
                    label={`${bucket.count} clients`}
                    color={getColorForBucket(index) as any}
                  />
                  <Typography variant="caption">
                    {bucket.percentage}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tableau détaillé */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Client</TableCell>
              <TableCell align="right">Dette totale</TableCell>
              {data.buckets.map(bucket => (
                <TableCell key={bucket.range} align="right">
                  {bucket.range}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.customers.map(({ customer, currentDebt, buckets }) => (
              <TableRow key={customer.id}>
                <TableCell>
                  <Typography fontWeight="medium">{customer.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {customer.phone}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight="bold" color={currentDebt > customer.creditLimit ? 'error' : 'inherit'}>
                    {formatCurrency(currentDebt)}
                  </Typography>
                </TableCell>
                {buckets.map((amount, idx) => (
                  <TableCell key={idx} align="right">
                    {amount > 0 ? formatCurrency(amount) : '-'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function PaymentsTab({ payments }: { payments: Payment[] }) {
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Client</TableCell>
            <TableCell>Mode</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="right">Montant</TableCell>
            <TableCell>Collecté par</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>{formatDate(payment.collectedAt)}</TableCell>
              <TableCell>{payment.customer?.name}</TableCell>
              <TableCell>
                <Chip 
                  size="small" 
                  label={payment.mode}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <Chip 
                  size="small" 
                  label={payment.paymentType}
                  color={payment.paymentType === 'debt_payment' ? 'info' : 'default'}
                />
              </TableCell>
              <TableCell align="right">
                <Typography fontWeight="bold" color="success.main">
                  {formatCurrency(payment.amount)}
                </Typography>
              </TableCell>
              <TableCell>{payment.collector?.name || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DebtsTab({ customers }: { customers: Customer[] }) {
  const sortedCustomers = [...customers].sort((a, b) => b.currentDebt - a.currentDebt);

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Client</TableCell>
            <TableCell>Contact</TableCell>
            <TableCell align="right">Limite crédit</TableCell>
            <TableCell align="right">Dette actuelle</TableCell>
            <TableCell align="right">Disponible</TableCell>
            <TableCell>Statut</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedCustomers.map((customer) => {
            const available = customer.creditLimit - customer.currentDebt;
            const isOverLimit = customer.currentDebt > customer.creditLimit;
            
            return (
              <TableRow key={customer.id}>
                <TableCell>
                  <Typography fontWeight="medium">{customer.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {customer.code}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{customer.phone}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {customer.zone}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(customer.creditLimit)}
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight="bold" color={isOverLimit ? 'error' : 'inherit'}>
                    {formatCurrency(customer.currentDebt)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography color={available < 0 ? 'error' : 'success.main'}>
                    {formatCurrency(available)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {isOverLimit ? (
                    <Chip size="small" color="error" label="Dépassement" />
                  ) : customer.currentDebt > customer.creditLimit * 0.8 ? (
                    <Chip size="small" color="warning" label="Proche limite" />
                  ) : (
                    <Chip size="small" color="success" label="OK" />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
