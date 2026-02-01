// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE RAPPORTS (React Admin)
// Génération et export de rapports
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
} from '@mui/material';
import {
  Download,
  Assessment,
  TrendingUp,
  People,
  Inventory,
  LocalShipping,
  AttachMoney,
  CalendarToday,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, startOfWeek, startOfMonth, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { api, reportsApi } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface DailyReport {
  date: string;
  orders: {
    total: number;
    confirmed: number;
    delivered: number;
    cancelled: number;
    totalAmount: number;
  };
  deliveries: {
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  };
  payments: {
    total: number;
    cash: number;
    checks: number;
    other: number;
  };
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  delivererPerformance: Array<{
    id: string;
    name: string;
    deliveries: number;
    completed: number;
    collected: number;
  }>;
}

interface SalesData {
  date: string;
  orders: number;
  revenue: number;
  payments: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const EXPORT_TYPES = [
  { value: 'orders', label: 'Commandes', icon: <Assessment /> },
  { value: 'customers', label: 'Clients', icon: <People /> },
  { value: 'products', label: 'Produits', icon: <Inventory /> },
  { value: 'deliveries', label: 'Livraisons', icon: <LocalShipping /> },
  { value: 'payments', label: 'Paiements', icon: <AttachMoney /> },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const ReportsPage: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [exportType, setExportType] = useState('orders');
  const [exportStartDate, setExportStartDate] = useState<Date>(startOfMonth(new Date()));
  const [exportEndDate, setExportEndDate] = useState<Date>(new Date());

  // Fetch rapport journalier
  const { data: dailyReport, isLoading: loadingDaily } = useQuery<DailyReport>({
    queryKey: ['report', 'daily', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await reportsApi.getDailyReport(format(selectedDate, 'yyyy-MM-dd'));
      return response.data.data;
    },
    enabled: currentTab === 0,
  });

  // Fetch données ventes (graphique)
  const { data: salesData } = useQuery<SalesData[]>({
    queryKey: ['report', 'sales', format(subMonths(new Date(), 1), 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await api.get('/dashboard/sales', {
        params: {
          startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
          endDate: format(new Date(), 'yyyy-MM-dd'),
          groupBy: 'day',
        },
      });
      return response.data.data;
    },
    enabled: currentTab === 1,
  });

  // Mutation export
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/reports/export/${exportType}`, {
        params: {
          startDate: format(exportStartDate, 'yyyy-MM-dd'),
          endDate: format(exportEndDate, 'yyyy-MM-dd'),
        },
        responseType: 'blob',
      });
      return response.data;
    },
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${exportType}_${format(exportStartDate, 'yyyy-MM-dd')}_${format(exportEndDate, 'yyyy-MM-dd')}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box p={3}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight="bold">
            Rapports
          </Typography>
        </Box>

        {/* Onglets */}
        <Card sx={{ mb: 3 }}>
          <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
            <Tab label="Rapport Journalier" icon={<CalendarToday />} iconPosition="start" />
            <Tab label="Statistiques" icon={<TrendingUp />} iconPosition="start" />
            <Tab label="Exports" icon={<Download />} iconPosition="start" />
          </Tabs>
        </Card>

        {/* Contenu selon l'onglet */}
        {currentTab === 0 && (
          <DailyReportTab
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            report={dailyReport}
            isLoading={loadingDaily}
            formatCurrency={formatCurrency}
          />
        )}

        {currentTab === 1 && (
          <StatisticsTab salesData={salesData} formatCurrency={formatCurrency} />
        )}

        {currentTab === 2 && (
          <ExportsTab
            exportType={exportType}
            setExportType={setExportType}
            startDate={exportStartDate}
            setStartDate={setExportStartDate}
            endDate={exportEndDate}
            setEndDate={setExportEndDate}
            onExport={() => exportMutation.mutate()}
            isExporting={exportMutation.isPending}
          />
        )}
      </Box>
    </LocalizationProvider>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ONGLET RAPPORT JOURNALIER
// ═══════════════════════════════════════════════════════════════════════════════

interface DailyReportTabProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  report?: DailyReport;
  isLoading: boolean;
  formatCurrency: (value: number) => string;
}

const DailyReportTab: React.FC<DailyReportTabProps> = ({
  selectedDate,
  setSelectedDate,
  report,
  isLoading,
  formatCurrency,
}) => {
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      {/* Sélecteur de date */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} alignItems="center">
            <DatePicker
              label="Date du rapport"
              value={selectedDate}
              onChange={(date) => date && setSelectedDate(date)}
              slotProps={{ textField: { size: 'small' } }}
            />
            <Button variant="outlined" onClick={() => setSelectedDate(new Date())}>
              Aujourd'hui
            </Button>
          </Box>
        </CardContent>
      </Card>

      {report && (
        <>
          {/* KPIs */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">Commandes</Typography>
                  <Typography variant="h4">{report.orders.total}</Typography>
                  <Typography variant="caption" color="success.main">
                    {report.orders.delivered} livrées
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">Chiffre d'affaires</Typography>
                  <Typography variant="h5">{formatCurrency(report.orders.totalAmount)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">Encaissements</Typography>
                  <Typography variant="h5" color="success.main">
                    {formatCurrency(report.payments.total)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">Taux de livraison</Typography>
                  <Typography variant="h4" color="primary.main">
                    {report.deliveries.successRate.toFixed(0)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Détails */}
          <Grid container spacing={3}>
            {/* Top Produits */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Top Produits</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Produit</TableCell>
                          <TableCell align="right">Qté</TableCell>
                          <TableCell align="right">CA</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {report.topProducts.slice(0, 5).map((product, index) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    bgcolor: index < 3 ? 'primary.main' : 'grey.300',
                                    color: index < 3 ? 'white' : 'text.primary',
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: 1,
                                    fontWeight: 'bold',
                                  }}
                                >
                                  #{index + 1}
                                </Typography>
                                {product.name}
                              </Box>
                            </TableCell>
                            <TableCell align="right">{product.quantity}</TableCell>
                            <TableCell align="right">{formatCurrency(product.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Performance Livreurs */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Performance Livreurs</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Livreur</TableCell>
                          <TableCell align="center">Livraisons</TableCell>
                          <TableCell align="right">Encaissé</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {report.delivererPerformance.map((deliverer) => (
                          <TableRow key={deliverer.id}>
                            <TableCell>{deliverer.name}</TableCell>
                            <TableCell align="center">
                              {deliverer.completed}/{deliverer.deliveries}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(deliverer.collected)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Répartition paiements */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Répartition des paiements</Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Espèces', value: report.payments.cash },
                          { name: 'Chèques', value: report.payments.checks },
                          { name: 'Autres', value: report.payments.other },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={index} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ONGLET STATISTIQUES
// ═══════════════════════════════════════════════════════════════════════════════

interface StatisticsTabProps {
  salesData?: SalesData[];
  formatCurrency: (value: number) => string;
}

const StatisticsTab: React.FC<StatisticsTabProps> = ({ salesData, formatCurrency }) => {
  return (
    <Grid container spacing={3}>
      {/* Graphique ventes */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Évolution des ventes (30 derniers jours)</Typography>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'dd/MM')}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value), 'dd MMMM yyyy', { locale: fr })}
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : value,
                    name === 'revenue' ? 'Chiffre d\'affaires' : 'Commandes',
                  ]}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="orders"
                  stroke="#8884d8"
                  name="Commandes"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#82ca9d"
                  name="CA"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Graphique paiements */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Encaissements quotidiens</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'dd/MM')}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value), 'dd MMMM yyyy', { locale: fr })}
                  formatter={(value: number) => [formatCurrency(value), 'Encaissé']}
                />
                <Bar dataKey="payments" fill="#00C49F" name="Encaissements" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ONGLET EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

interface ExportsTabProps {
  exportType: string;
  setExportType: (type: string) => void;
  startDate: Date;
  setStartDate: (date: Date) => void;
  endDate: Date;
  setEndDate: (date: Date) => void;
  onExport: () => void;
  isExporting: boolean;
}

const ExportsTab: React.FC<ExportsTabProps> = ({
  exportType,
  setExportType,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onExport,
  isExporting,
}) => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Exporter des données</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Sélectionnez le type de données et la période à exporter au format Excel.
            </Typography>

            <Box display="flex" flexDirection="column" gap={3}>
              <FormControl fullWidth>
                <InputLabel>Type d'export</InputLabel>
                <Select
                  value={exportType}
                  label="Type d'export"
                  onChange={(e) => setExportType(e.target.value)}
                >
                  {EXPORT_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {type.icon}
                        {type.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <DatePicker
                label="Date de début"
                value={startDate}
                onChange={(date) => date && setStartDate(date)}
              />

              <DatePicker
                label="Date de fin"
                value={endDate}
                onChange={(date) => date && setEndDate(date)}
              />

              <Button
                variant="contained"
                size="large"
                startIcon={isExporting ? <CircularProgress size={20} /> : <Download />}
                onClick={onExport}
                disabled={isExporting}
              >
                {isExporting ? 'Export en cours...' : 'Télécharger Excel'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Rapports disponibles</Typography>
            <Box display="flex" flexDirection="column" gap={2}>
              {EXPORT_TYPES.map((type) => (
                <Paper
                  key={type.value}
                  variant="outlined"
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    border: exportType === type.value ? 2 : 1,
                    borderColor: exportType === type.value ? 'primary.main' : 'divider',
                  }}
                  onClick={() => setExportType(type.value)}
                >
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box color={exportType === type.value ? 'primary.main' : 'text.secondary'}>
                      {type.icon}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">{type.label}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        Export de toutes les {type.label.toLowerCase()}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default ReportsPage;
